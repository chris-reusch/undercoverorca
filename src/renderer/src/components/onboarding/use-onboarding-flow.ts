/* eslint-disable max-lines -- Why: this hook is the single orchestrator for every onboarding-step transition (navigation, persistence, telemetry, ref-mirror, auto-select); splitting would force callers to coordinate ordering across multiple hooks and lose the controller-shape contract OnboardingFlow.tsx consumes. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { applyDocumentTheme } from '@/lib/document-theme'
import { getSelectedNestedRepoPathsInScanOrder } from '@/lib/nested-repo-selected-paths'
import { ONBOARDING_FINAL_STEP, ONBOARDING_FLOW_VERSION } from '../../../../shared/constants'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type {
  GlobalSettings,
  NestedRepoScanResult,
  OnboardingState,
  Repo,
  TuiAgent
} from '../../../../shared/types'
import { STEPS } from './use-onboarding-flow-types'
import { persistStep, useCloseWith, usePersistCurrentStep } from './use-onboarding-flow-persistence'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { buildOnboardingFolderAgentStartup } from '@/lib/onboarding-folder-agent-startup'
import { resolveOnboardingSettingsHydration } from './onboarding-settings-hydration'
import { openProjectDefaultCheckout } from '../sidebar/project-added-default-checkout'
import { translate } from '@/i18n/i18n'
import { resolveAgentPermissionModeSummary } from '../../../../shared/tui-agent-permissions'
import { isWindowsUserAgent } from '@/components/terminal-pane/pane-helpers'

export { STEPS } from './use-onboarding-flow-types'
export type { StepId, StepNumber } from './use-onboarding-flow-types'

export type OnboardingFlowController = ReturnType<typeof useOnboardingFlow>

function shouldSkipIntegrationsStep(
  status: ReturnType<typeof useAppStore.getState>['preflightStatus']
): boolean {
  return status?.gh.installed === true
}

function shouldSkipWindowsTerminalStep(isWindows: boolean): boolean {
  return !isWindows
}

type OnboardingStepSkipOptions = {
  skipIntegrations: boolean
  skipWindowsTerminal: boolean
}

function isSkippedStepIndex(index: number, options: OnboardingStepSkipOptions): boolean {
  const step = STEPS[index]
  return (
    (options.skipIntegrations && step?.id === 'integrations') ||
    (options.skipWindowsTerminal && step?.id === 'windows_terminal')
  )
}

function resolveStepIndex(
  index: number,
  skipOptions: OnboardingStepSkipOptions,
  direction: 'forward' | 'backward'
): number {
  const lastIndex = STEPS.length - 1
  let nextIndex = Math.min(Math.max(index, 0), lastIndex)
  while (isSkippedStepIndex(nextIndex, skipOptions)) {
    const candidate = nextIndex + (direction === 'forward' ? 1 : -1)
    if (candidate < 0 || candidate > lastIndex) {
      return direction === 'forward' ? lastIndex : 0
    }
    nextIndex = candidate
  }
  return nextIndex
}

function createNestedRepoScanId(): string {
  return `nested-repo-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type OnboardingStepId = (typeof STEPS)[number]['id']

type OnboardingProgressSnapshot = Pick<
  OnboardingState,
  'flowVersion' | 'lastCompletedStep' | 'outcome'
>

export function remapOpenOnboardingLastCompletedStep({
  flowVersion,
  lastCompletedStep,
  outcome
}: OnboardingProgressSnapshot): number {
  if (flowVersion === ONBOARDING_FLOW_VERSION) {
    return lastCompletedStep
  }
  if (outcome === 'completed' && lastCompletedStep >= 4) {
    return ONBOARDING_FINAL_STEP
  }
  // Why: v3 was the four-step flow before the Windows terminal preference
  // page. Step 4 already meant notifications, so open progress should resume
  // there rather than treating it as the newly inserted Windows step.
  if (flowVersion === 3) {
    return Math.min(4, lastCompletedStep)
  }
  // Why: v2 was the five-step flow; missing/older versions were seven-step
  // data where step 4 was removed agent setup, not completed integrations.
  if (flowVersion === 2) {
    if (lastCompletedStep === 3) {
      return 2
    }
    if (lastCompletedStep >= 4) {
      return 3
    }
    return lastCompletedStep
  }
  if (lastCompletedStep === 3) {
    return 2
  }
  if (lastCompletedStep === 4) {
    return 2
  }
  if (lastCompletedStep >= 5) {
    return 3
  }
  return lastCompletedStep
}

type SkippedOnboardingPreferenceOptions = {
  currentStepId: OnboardingStepId
  themeBeforePreview: GlobalSettings['theme'] | null
  settingsTheme: GlobalSettings['theme'] | undefined
  selectedAgent: TuiAgent | null
  setTheme: (theme: GlobalSettings['theme']) => void
  applyTheme: (theme: GlobalSettings['theme']) => void
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void> | void
  setError: (message: string | null) => void
}

export async function prepareSkippedOnboardingPreferences({
  currentStepId,
  themeBeforePreview,
  settingsTheme,
  selectedAgent,
  setTheme,
  applyTheme,
  updateSettings,
  setError
}: SkippedOnboardingPreferenceOptions): Promise<boolean> {
  try {
    // Why: theme tiles save immediately for a stable preview, but skip still
    // means "do not keep this step's choice."
    if (currentStepId === 'theme') {
      const themeToRestore = themeBeforePreview ?? settingsTheme
      if (themeToRestore) {
        setTheme(themeToRestore)
        applyTheme(themeToRestore)
        await updateSettings({ theme: themeToRestore })
      }
    }
    // Why: the repo step seeds folder terminals from saved settings. Preserve
    // the visible agent choice when optional preferences are skipped.
    if (currentStepId === 'agent' && selectedAgent) {
      await updateSettings({ defaultTuiAgent: selectedAgent })
    }
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setError(message)
    toast.error(
      translate(
        'auto.components.onboarding.use.onboarding.flow.52acfbef51',
        'Could not save progress'
      ),
      { description: message }
    )
    return false
  }
}

export function useOnboardingFlow(
  onboarding: OnboardingState,
  onOnboardingChange: (state: OnboardingState) => void,
  options: { onSettingsDetourStart?: () => void } = {}
) {
  const { onSettingsDetourStart } = options
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const refreshDetectedAgents = useAppStore((s) => s.refreshDetectedAgents)
  const detectedAgentIds = useAppStore((s) => s.detectedAgentIds)
  const isDetectingAgents = useAppStore((s) => s.isDetectingAgents || s.isRefreshingAgents)
  const fetchRepos = useAppStore((s) => s.fetchRepos)
  const fetchWorktrees = useAppStore((s) => s.fetchWorktrees)
  const setHideDefaultBranchWorkspace = useAppStore((s) => s.setHideDefaultBranchWorkspace)
  const addRepoPath = useAppStore((s) => s.addRepoPath)
  const scanNestedRepos = useAppStore((s) => s.scanNestedRepos)
  const cancelNestedRepoScan = useAppStore((s) => s.cancelNestedRepoScan)
  const importNestedRepos = useAppStore((s) => s.importNestedRepos)
  const openModal = useAppStore((s) => s.openModal)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  // Why: App hydrates repos before mounting onboarding. Reading the store
  // synchronously lets the final step render its already-added state without a flash.
  const repos = useAppStore((s) => s.repos)
  // Why: renderToStaticMarkup uses Zustand's initial server snapshot. The
  // synchronous read keeps tests and the first client render aligned.
  const effectivePreflightStatus = preflightStatus ?? useAppStore.getState().preflightStatus

  const skipIntegrations = shouldSkipIntegrationsStep(effectivePreflightStatus)
  const skipWindowsTerminal = shouldSkipWindowsTerminalStep(isWindowsUserAgent())
  const skipOptions = useMemo(
    () => ({ skipIntegrations, skipWindowsTerminal }),
    [skipIntegrations, skipWindowsTerminal]
  )
  const remappedLastCompletedStep = remapOpenOnboardingLastCompletedStep(onboarding)
  const initialStep = resolveStepIndex(
    Math.min(Math.max(remappedLastCompletedStep, 0), STEPS.length - 1),
    skipOptions,
    'forward'
  )
  const [stepIndex, setStepIndex] = useState(initialStep)
  const [selectedAgent, setSelectedAgent] = useState<TuiAgent | null>(
    settings?.defaultTuiAgent && settings.defaultTuiAgent !== 'blank'
      ? settings.defaultTuiAgent
      : null
  )
  const [yoloPermissions, setYoloPermissions] = useState(
    resolveAgentPermissionModeSummary({
      agentDefaultArgs: settings?.agentDefaultArgs,
      agentDefaultEnv: settings?.agentDefaultEnv
    }) !== 'manual'
  )
  // Why: hydrate theme from saved settings instead of hardcoding 'dark' so users
  // who already configured a theme see their choice preselected.
  const [theme, setTheme] = useState<GlobalSettings['theme']>(settings?.theme ?? 'dark')
  const [cloneUrl, setCloneUrl] = useState('')
  const [serverPath, setServerPath] = useState('')
  const [cloneDestination, setCloneDestination] = useState('')
  const [nestedScan, setNestedScan] = useState<NestedRepoScanResult | null>(null)
  const [nestedSelectedPaths, setNestedSelectedPaths] = useState<Set<string>>(new Set())
  const [nestedScanInProgress, setNestedScanInProgress] = useState(false)
  const [nestedImportScanId, setNestedImportScanId] = useState<string | null>(null)
  const nestedScanIdRef = useRef<string | null>(null)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Why: settings load async; the lazy useState initializers above run before
  // settings hydrates. Re-sync once before commit so children never paint the
  // fallback defaults, unless the user already interacted with that field.
  const themeInteractedRef = useRef(false)
  const agentInteractedRef = useRef(false)
  const yoloPermissionsInteractedRef = useRef(false)
  const [settingsHydrated, setSettingsHydrated] = useState(settings != null)
  const settingsHydration = resolveOnboardingSettingsHydration({
    settings,
    settingsHydrated,
    themeInteracted: themeInteractedRef.current,
    agentInteracted: agentInteractedRef.current,
    currentTheme: theme,
    currentAgent: selectedAgent
  })
  if (settingsHydration) {
    setSettingsHydrated(settingsHydration.settingsHydrated)
    if (settingsHydration.theme !== undefined) {
      setTheme(settingsHydration.theme)
    }
    if (settingsHydration.selectedAgent !== undefined) {
      setSelectedAgent(settingsHydration.selectedAgent)
    }
  }
  if (settings && !yoloPermissionsInteractedRef.current) {
    const nextYoloPermissions =
      resolveAgentPermissionModeSummary({
        agentDefaultArgs: settings.agentDefaultArgs,
        agentDefaultEnv: settings.agentDefaultEnv
      }) !== 'manual'
    if (nextYoloPermissions !== yoloPermissions) {
      setYoloPermissions(nextYoloPermissions)
    }
  }

  // Why: track user interaction so async settings hydration above doesn't
  // overwrite a value the user explicitly chose.
  const setThemeInteractive = useCallback((value: GlobalSettings['theme']) => {
    themeInteractedRef.current = true
    setTheme(value)
  }, [])
  // Why: refs let `setSelectedAgentInteractive` and the auto-select effect read
  // the freshest selection at click/async time without re-creating callbacks.
  const selectedAgentRef = useRef(selectedAgent)
  selectedAgentRef.current = selectedAgent
  const setSelectedAgentInteractive = useCallback((value: TuiAgent | null) => {
    agentInteractedRef.current = true
    setSelectedAgent(value)
  }, [])
  const setYoloPermissionsInteractive = useCallback((enabled: boolean) => {
    yoloPermissionsInteractedRef.current = true
    setYoloPermissions(enabled)
  }, [])

  const detectedSet = useMemo(() => new Set(detectedAgentIds ?? []), [detectedAgentIds])
  const currentStep = STEPS[stepIndex]
  const visibleSteps = useMemo(
    () =>
      STEPS.map((step, index) => ({ step, index })).filter(
        ({ index }) => !isSkippedStepIndex(index, skipOptions)
      ),
    [skipOptions]
  )
  const progressSteps = useMemo(
    () =>
      STEPS.map((step, index) => ({
        step,
        index,
        isSkipped: isSkippedStepIndex(index, skipOptions)
      })).filter(({ step }) => step.id !== 'windows_terminal' || !skipWindowsTerminal),
    [skipOptions, skipWindowsTerminal]
  )
  const visibleStepIndex = Math.max(
    0,
    visibleSteps.findIndex(({ index }) => index === stepIndex)
  )
  const progressStepIndex = Math.max(
    0,
    progressSteps.findIndex(({ index }) => index === stepIndex)
  )
  const hasExistingProject = repos.length > 0

  // Why: track the latest persisted theme in a ref so the unmount-only revert
  // below uses the freshest value without retriggering on each settings change.
  const persistedThemeRef = useRef<GlobalSettings['theme']>(settings?.theme ?? 'dark')
  persistedThemeRef.current = settings?.theme ?? 'dark'
  const themeStepEntryThemeRef = useRef<GlobalSettings['theme'] | null>(null)
  const themeStepEntryCapturedRef = useRef(false)
  useEffect(() => {
    if (currentStep.id !== 'theme') {
      themeStepEntryCapturedRef.current = false
      return
    }
    if (!settings || themeStepEntryCapturedRef.current) {
      return
    }
    // Why: theme tile clicks persist immediately for normal progression, but
    // "Skip to project setup" should keep the preference the user arrived with.
    themeStepEntryCapturedRef.current = true
    themeStepEntryThemeRef.current = settings.theme
  }, [currentStep.id, settings])

  // Apply preview when local theme changes.
  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  useEffect(() => {
    void refreshPreflightStatus()
  }, [refreshPreflightStatus])

  const getNextStepIndex = useCallback(
    (idx: number): number => resolveStepIndex(idx + 1, skipOptions, 'forward'),
    [skipOptions]
  )

  const getPreviousStepIndex = useCallback(
    (idx: number): number => resolveStepIndex(idx - 1, skipOptions, 'backward'),
    [skipOptions]
  )

  useEffect(() => {
    if (currentStep.id !== 'integrations' || !preflightStatusChecked || !skipIntegrations) {
      return
    }
    const nextIndex = getNextStepIndex(stepIndex)
    setStepIndex(nextIndex)
    // Why: users with gh already on PATH don't need this setup page, but
    // persistence must still resume them at the next visible step instead of
    // bouncing back through skipped optional pages.
    const skippedThroughStepNumber = Math.max(
      currentStep.stepNumber,
      STEPS[nextIndex].stepNumber - 1
    )
    void persistStep(skippedThroughStepNumber).then(onOnboardingChange, (err) => {
      toast.error(
        translate(
          'auto.components.onboarding.use.onboarding.flow.52acfbef51',
          'Could not save progress'
        ),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
    })
  }, [
    currentStep.id,
    currentStep.stepNumber,
    getNextStepIndex,
    onOnboardingChange,
    preflightStatusChecked,
    skipIntegrations,
    stepIndex
  ])

  const setLifecycleRootRef = useCallback((node: HTMLElement | null): void => {
    if (node !== null) {
      return
    }
    // Why: onboarding previews theme state outside this component; tie
    // final cleanup to the modal root detaching instead of passive Effects.
    applyDocumentTheme(persistedThemeRef.current)
  }, [])

  // Why: only auto-pick on first mount when detection completes; otherwise
  // selecting an agent would re-trigger this effect and clobber/race user clicks.
  const didAutoSelectRef = useRef(false)
  useEffect(() => {
    if (didAutoSelectRef.current) {
      return
    }
    didAutoSelectRef.current = true
    // Why: re-read PATH on wizard mount instead of reusing the session cache.
    // The cache can be poisoned if a prior caller ran before shell PATH
    // hydration finished, leaving the wizard with a false "no agents" state.
    void refreshDetectedAgents().then((ids) => {
      if (selectedAgentRef.current !== null) {
        return
      }
      const preferred = getAgentCatalog().find((agent) => ids.includes(agent.id))?.id ?? null
      setSelectedAgent(preferred)
    })
  }, [refreshDetectedAgents])

  const closeWith = useCloseWith({
    onOnboardingChange,
    setError
  })

  const completeRepo = useCallback(
    async (projectId: string, isGit: boolean, path: 'open_folder' | 'clone_url') => {
      await fetchRepos()
      // Why: once the project is persisted, a non-authoritative Git refresh
      // should still complete onboarding onto the project row as a fallback.
      await fetchWorktrees(projectId, isGit ? { requireAuthoritative: true } : undefined)
      const worktrees = useAppStore.getState().worktreesByRepo[projectId] ?? []
      if (isGit) {
        await openProjectDefaultCheckout({
          repoId: projectId,
          source: path === 'clone_url' ? 'onboarding_clone_url' : 'onboarding_open_folder',
          setHideDefaultBranchWorkspace
        })
      } else {
        const worktree = worktrees[0] ?? null
        if (worktree) {
          // Why: onboarding asks for a default agent immediately before this step.
          // Non-git folders skip the composer, so seed their first terminal here.
          const startup = buildOnboardingFolderAgentStartup(settings)
          activateAndRevealWorktree(worktree.id, { startup })
        }
      }
      // Why: next() short-circuits the repo step, so close onboarding here once
      // the repo is successfully added to keep the funnel consistent.
      await closeWith('completed', isGit ? { addedRepo: true } : { addedFolder: true })
    },
    [closeWith, fetchRepos, fetchWorktrees, setHideDefaultBranchWorkspace, settings]
  )

  const persistCurrentStep = usePersistCurrentStep({
    currentStepId: currentStep.id,
    selectedAgent,
    yoloPermissions,
    theme,
    settings,
    updateSettings,
    onboardingChecklist: onboarding.checklist,
    onOnboardingChange,
    setError
  })

  // Why: synchronous re-entry latch. `busyLabel` is React state and only
  // commits after the awaited persistCurrentStep round-trip resolves, so a
  // second Cmd+Enter (auto-repeat fires every ~30ms) re-enters next() before
  // the first call's setStepIndex has run, advancing twice and skipping a
  // step. A ref flips synchronously so re-entries bail immediately.
  const nextInFlightRef = useRef(false)
  const next = useCallback(
    // `advancedVia` is retained for the controller API (keyboard vs button)
    // even though the per-step completion telemetry it fed has been removed.
    async (_advancedVia: 'button' | 'keyboard' = 'button') => {
      if (nextInFlightRef.current || busyLabel) {
        return
      }
      nextInFlightRef.current = true
      try {
        const result = await persistCurrentStep()
        if (result.ok) {
          if (currentStep.id === 'notifications') {
            setBusyLabel('Opening Add Project...')
            const closed = await closeWith('completed', {})
            if (closed) {
              openModal('add-repo')
            }
            return
          }
          const nextIndex = getNextStepIndex(stepIndex)
          const skippedThroughStepNumber = STEPS[nextIndex].stepNumber - 1
          if (skippedThroughStepNumber > currentStep.stepNumber) {
            // Why: resolveStepIndex can skip optional pages before they render,
            // but persisted progress must still resume at the visible page.
            try {
              onOnboardingChange(await persistStep(skippedThroughStepNumber))
            } catch (err) {
              toast.error(
                translate(
                  'auto.components.onboarding.use.onboarding.flow.52acfbef51',
                  'Could not save progress'
                ),
                {
                  description: err instanceof Error ? err.message : String(err)
                }
              )
            }
          }
          setStepIndex(nextIndex)
        }
      } finally {
        setBusyLabel(null)
        nextInFlightRef.current = false
      }
    },
    [
      busyLabel,
      closeWith,
      currentStep.id,
      currentStep.stepNumber,
      getNextStepIndex,
      onOnboardingChange,
      openModal,
      persistCurrentStep,
      stepIndex
    ]
  )

  const showNestedRepoReview = useCallback(
    (scan: NestedRepoScanResult, inProgress = false, scanId: string | null = null) => {
      setNestedScan(scan)
      setNestedSelectedPaths(new Set(scan.repos.map((repo) => repo.path)))
      setNestedScanInProgress(inProgress)
      setNestedImportScanId(scanId)
    },
    []
  )

  const openFolder = useCallback(
    async (kind: 'git' | 'folder' = 'git') => {
      // Why: re-entry guard — rapid Cmd+Enter must not launch duplicate pickers.
      if (busyLabel !== null) {
        return
      }
      setError(null)
      if (settings?.activeRuntimeEnvironmentId?.trim()) {
        const path = serverPath.trim()
        if (!path) {
          const message = 'Enter a path on the selected host.'
          setError(message)
          return
        }
        setBusyLabel(kind === 'git' ? 'Scanning for repositories…' : 'Opening folder…')
        try {
          if (kind === 'git') {
            const scan = await scanNestedRepos(path)
            if (scan?.selectedPathKind === 'non_git_folder' && scan.repos.length > 0) {
              showNestedRepoReview(scan)
              return
            }
          }
          setBusyLabel(kind === 'git' ? 'Opening project…' : 'Opening folder…')
          const repo = await addRepoPath(path, kind)
          if (!repo) {
            return
          }
          await completeRepo(repo.id, isGitRepoKind(repo), 'open_folder')
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          nestedScanIdRef.current = null
          setNestedScanInProgress(false)
          setBusyLabel(null)
        }
        return
      }
      const path = await window.api.repos.pickFolder()
      if (!path) {
        return
      }
      setBusyLabel('Opening project…')
      try {
        let result = await window.api.repos.add({ path })
        if ('error' in result && result.error.includes('Not a valid git repository')) {
          setBusyLabel('Scanning for repositories...')
          const scanId = createNestedRepoScanId()
          nestedScanIdRef.current = scanId
          setNestedScanInProgress(true)
          const scan = await scanNestedRepos(path, undefined, {
            scanId,
            onProgress: (progressScan) => {
              if (
                nestedScanIdRef.current !== scanId ||
                progressScan.selectedPathKind !== 'non_git_folder' ||
                progressScan.repos.length === 0
              ) {
                return
              }
              showNestedRepoReview(progressScan, true, scanId)
            }
          })
          if (nestedScanIdRef.current !== scanId) {
            return
          }
          nestedScanIdRef.current = null
          setNestedScanInProgress(false)
          if (scan?.selectedPathKind === 'non_git_folder' && scan.repos.length > 0) {
            showNestedRepoReview(scan, false, scanId)
            return
          }
          result = await window.api.repos.add({ path, kind: 'folder' })
        }
        if ('error' in result) {
          throw new Error(result.error)
        }
        await completeRepo(result.repo.id, isGitRepoKind(result.repo), 'open_folder')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        nestedScanIdRef.current = null
        setNestedScanInProgress(false)
        setBusyLabel(null)
      }
    },
    [
      addRepoPath,
      busyLabel,
      completeRepo,
      scanNestedRepos,
      serverPath,
      showNestedRepoReview,
      settings?.activeRuntimeEnvironmentId
    ]
  )

  const importNested = useCallback(async () => {
    const mode = 'separate'
    if (!nestedScan || nestedSelectedPaths.size === 0 || busyLabel !== null) {
      return
    }
    setError(null)
    setBusyLabel('Importing repositories…')
    try {
      const selectedProjectPaths = getSelectedNestedRepoPathsInScanOrder(
        nestedScan,
        nestedSelectedPaths
      )
      const result = await importNestedRepos({
        parentPath: nestedScan.selectedPath,
        groupName: '',
        // Why: Set insertion order can drift after deselect/reselect; import
        // ordering should match the visible scan order users reviewed.
        projectPaths: selectedProjectPaths,
        ...(nestedImportScanId ? { scanId: nestedImportScanId } : {}),
        mode
      })
      const importedRepoIds =
        result?.projects
          .map((entry) => entry.projectId)
          .filter((projectId): projectId is string => typeof projectId === 'string') ?? []
      const projectId = importedRepoIds[0]
      if (!projectId) {
        const firstFailure = result?.projects.find((entry) => entry.status === 'failed')?.error
        throw new Error(
          firstFailure ? `No repositories imported: ${firstFailure}` : 'No repositories imported'
        )
      }
      for (const importedRepoId of importedRepoIds) {
        // Why: imported repos are already persisted; non-authoritative SSH
        // refreshes should not block onboarding from revealing the first project.
        await fetchWorktrees(importedRepoId, { requireAuthoritative: true })
      }
      await completeRepo(projectId, true, 'open_folder')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyLabel(null)
    }
  }, [
    busyLabel,
    completeRepo,
    fetchWorktrees,
    importNestedRepos,
    nestedScan,
    nestedSelectedPaths,
    nestedImportScanId
  ])

  const clearNestedRepoReview = useCallback(() => {
    setNestedScan(null)
    setNestedSelectedPaths(new Set())
    setNestedScanInProgress(false)
    setNestedImportScanId(null)
    nestedScanIdRef.current = null
    setBusyLabel(null)
    setError(null)
  }, [])

  // Why: lets the user back out of the nested-repo step in onboarding to
  // re-pick a folder/clone target. Mirrors the dialog's left-aligned Back.
  const cancelNested = useCallback(() => {
    if (busyLabel !== null && !nestedScanInProgress) {
      return
    }
    if (nestedScanInProgress && nestedScanIdRef.current) {
      void cancelNestedRepoScan(nestedScanIdRef.current)
    }
    clearNestedRepoReview()
  }, [busyLabel, cancelNestedRepoScan, nestedScanInProgress, clearNestedRepoReview])

  const stopNestedScan = useCallback(() => {
    const scanId = nestedScanIdRef.current
    if (!scanId) {
      return
    }
    void cancelNestedRepoScan(scanId)
  }, [cancelNestedRepoScan])

  const clone = useCallback(async () => {
    // Why: re-entry guard — prevents Enter spamming from triggering duplicate clones.
    if (busyLabel !== null) {
      return
    }
    const trimmed = cloneUrl.trim()
    if (!trimmed || !settings) {
      return
    }
    setError(null)
    const target = getActiveRuntimeTarget(settings)
    const destination =
      target.kind === 'environment' ? cloneDestination.trim() : settings.workspaceDir
    if (!destination) {
      const message = 'Enter a host path for the clone destination.'
      setError(message)
      return
    }
    setBusyLabel('Cloning repo…')
    try {
      const repo =
        target.kind === 'environment'
          ? (
              await callRuntimeRpc<{ repo: Repo }>(
                target,
                'repo.clone',
                { url: trimmed, destination },
                { timeoutMs: 10 * 60_000 }
              )
            ).repo
          : await window.api.repos.clone({
              url: trimmed,
              destination
            })
      await completeRepo(repo.id, true, 'clone_url')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      toast.error(
        translate('auto.components.onboarding.use.onboarding.flow.fd74e7558e', 'Clone failed'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
    } finally {
      setBusyLabel(null)
    }
  }, [busyLabel, cloneDestination, cloneUrl, completeRepo, settings])

  const continueWithExistingProject = useCallback(
    // `advancedVia` is kept for the controller API even though the per-step
    // completion telemetry it fed has been removed.
    async (_advancedVia: 'button' | 'keyboard' = 'button') => {
      if (busyLabel !== null || repos.length === 0) {
        return
      }
      setError(null)
      setBusyLabel('Finishing...')
      try {
        const checklist = repos.some((repo) => isGitRepoKind(repo))
          ? { addedRepo: true }
          : { addedFolder: true }
        await closeWith('completed', checklist)
      } finally {
        setBusyLabel(null)
      }
    },
    [busyLabel, closeWith, repos]
  )

  const skipToRepo = useCallback(async () => {
    if (busyLabel) {
      return
    }
    setError(null)
    if (currentStep.id === 'notifications') {
      return
    }
    const preferencesSaved = await prepareSkippedOnboardingPreferences({
      currentStepId: currentStep.id,
      themeBeforePreview: themeStepEntryThemeRef.current,
      settingsTheme: settings?.theme,
      selectedAgent,
      setTheme,
      applyTheme: applyDocumentTheme,
      updateSettings,
      setError
    })
    if (!preferencesSaved) {
      return
    }
    setBusyLabel('Opening Add Project...')
    try {
      const closed = await closeWith('completed', {})
      if (!closed) {
        return
      }
      // Why: the repo picker moved to the Add Project dialog, so skipping
      // optional setup now closes onboarding and hands off to that modal.
      openModal('add-repo')
    } finally {
      setBusyLabel(null)
    }
  }, [
    busyLabel,
    closeWith,
    currentStep.id,
    openModal,
    selectedAgent,
    settings,
    updateSettings
  ])

  const dismissOnboarding = useCallback(
    // `advancedVia` is kept for the controller API even though the dismissal
    // telemetry it fed has been removed.
    async (_advancedVia: 'button' | 'keyboard' = 'button'): Promise<boolean> => {
      if (busyLabel) {
        return false
      }
      setError(null)
      const closed = await closeWith('dismissed', {})
      if (closed && nestedScan) {
        clearNestedRepoReview()
      }
      return closed
    },
    [busyLabel, closeWith, nestedScan, clearNestedRepoReview]
  )

  const openSshSettings = useCallback(async () => {
    if (busyLabel) {
      return
    }
    setError(null)
    try {
      onOnboardingChange(await persistStep(currentStep.stepNumber - 1))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(
        translate(
          'auto.components.onboarding.use.onboarding.flow.dce4bdce5b',
          'Could not open SSH settings'
        ),
        { description: message }
      )
      return
    }
    // Why: Settings renders behind the fullscreen onboarding layer; SSH users
    // need a temporary detour without marking required repo setup dismissed.
    onSettingsDetourStart?.()
    // Why: keep the target in the store before the Settings view mounts. A
    // timer here can run before the lazy view subscribes and strand users on
    // the default General pane.
    openSettingsTarget({ pane: 'ssh', repoId: null, sectionId: 'ssh' })
    openSettingsPage()
  }, [
    busyLabel,
    currentStep.stepNumber,
    onOnboardingChange,
    onSettingsDetourStart,
    openSettingsPage,
    openSettingsTarget
  ])

  const back = useCallback(() => {
    if (nestedScan) {
      clearNestedRepoReview()
      return
    }
    setStepIndex(getPreviousStepIndex)
  }, [getPreviousStepIndex, nestedScan, clearNestedRepoReview])

  const jumpToStep = useCallback(
    (idx: number) => {
      if (nestedScan && idx !== stepIndex) {
        clearNestedRepoReview()
      }
      setStepIndex(resolveStepIndex(idx, skipOptions, idx < stepIndex ? 'backward' : 'forward'))
    },
    [nestedScan, skipOptions, stepIndex, clearNestedRepoReview]
  )

  return {
    settings,
    updateSettings,
    stepIndex,
    visibleSteps,
    visibleStepIndex,
    progressSteps,
    progressStepIndex,
    currentStep,
    selectedAgent,
    setSelectedAgent: setSelectedAgentInteractive,
    yoloPermissions,
    setYoloPermissions: setYoloPermissionsInteractive,
    theme,
    setTheme: setThemeInteractive,
    cloneUrl,
    setCloneUrl,
    nestedScan,
    nestedScanInProgress,
    nestedSelectedPaths,
    setNestedSelectedPaths,
    importNested,
    cancelNested,
    stopNestedScan,
    hasExistingProject,
    serverPath,
    setServerPath,
    cloneDestination,
    setCloneDestination,
    busyLabel,
    error,
    detectedSet,
    isDetectingAgents,
    next,
    skipToRepo,
    dismissOnboarding,
    back,
    jumpToStep,
    setLifecycleRootRef,
    openFolder,
    continueWithExistingProject,
    openSshSettings,
    clone
  }
}
