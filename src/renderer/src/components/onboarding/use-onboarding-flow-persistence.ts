import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { ONBOARDING_FINAL_STEP, ONBOARDING_FLOW_VERSION } from '../../../../shared/constants'
import type { GlobalSettings, OnboardingState, TuiAgent } from '../../../../shared/types'
import { applyAgentPermissionMode } from '../../../../shared/tui-agent-permissions'
import type { StepId } from './use-onboarding-flow-types'

export async function persistStep(
  stepNumber: number,
  updates: Partial<OnboardingState> = {}
): Promise<OnboardingState> {
  return window.api.onboarding.update({
    flowVersion: ONBOARDING_FLOW_VERSION,
    lastCompletedStep: Math.max(stepNumber, -1),
    ...updates
  })
}

function selectedAgentOrBlank(agent: TuiAgent | null): TuiAgent | 'blank' {
  return agent ?? 'blank'
}

export function buildCompletedOnboardingNotificationSettings(
  notifications: GlobalSettings['notifications']
): GlobalSettings['notifications'] {
  return {
    ...notifications,
    enabled: true,
    agentTaskComplete: true,
    terminalBell: true
  }
}

type CloseWithDeps = {
  onOnboardingChange: (state: OnboardingState) => void
  setError: (msg: string | null) => void
}

export function useCloseWith({ onOnboardingChange, setError }: CloseWithDeps) {
  return useCallback(
    async (
      outcome: 'completed' | 'dismissed',
      checklist: Partial<OnboardingState['checklist']>
    ): Promise<boolean> => {
      let nextState: OnboardingState
      try {
        // Why: main-process updateOnboarding already merges with current state,
        // so spreading the local (potentially stale) onboarding.checklist would
        // overwrite concurrent updates.
        nextState = await window.api.onboarding.update({
          flowVersion: ONBOARDING_FLOW_VERSION,
          closedAt: Date.now(),
          outcome,
          lastCompletedStep: outcome === 'completed' ? ONBOARDING_FINAL_STEP : -1,
          checklist: {
            ...checklist,
            dismissed: outcome === 'dismissed'
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      }
      onOnboardingChange(nextState)
      return true
    },
    [onOnboardingChange, setError]
  )
}

type PersistCurrentStepDeps = {
  currentStepId: StepId
  selectedAgent: TuiAgent | null
  yoloPermissions: boolean
  theme: GlobalSettings['theme']
  settings: GlobalSettings | null
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void> | void
  onboardingChecklist: OnboardingState['checklist']
  onOnboardingChange: (state: OnboardingState) => void
  setError: (msg: string | null) => void
}

export type PersistCurrentStepResult = {
  ok: boolean
}

export function usePersistCurrentStep({
  currentStepId,
  selectedAgent,
  yoloPermissions,
  theme,
  settings,
  updateSettings,
  onboardingChecklist,
  onOnboardingChange,
  setError
}: PersistCurrentStepDeps) {
  return useCallback(async (): Promise<PersistCurrentStepResult> => {
    if (!settings) {
      return { ok: false }
    }
    try {
      if (currentStepId === 'agent') {
        const defaultTuiAgent = selectedAgentOrBlank(selectedAgent)
        await updateSettings({
          defaultTuiAgent,
          ...applyAgentPermissionMode({
            mode: yoloPermissions ? 'yolo' : 'manual',
            agentDefaultArgs: settings.agentDefaultArgs,
            agentDefaultEnv: settings.agentDefaultEnv
          })
        })
        const choseAgent = defaultTuiAgent !== 'blank'
        onOnboardingChange(
          await persistStep(1, {
            checklist: { ...onboardingChecklist, choseAgent }
          })
        )
        return { ok: true }
      }
      if (currentStepId === 'theme') {
        await updateSettings({ theme })
        onOnboardingChange(await persistStep(2))
        return { ok: true }
      }
      if (currentStepId === 'notifications') {
        await updateSettings({
          notifications: buildCompletedOnboardingNotificationSettings(settings.notifications)
        })
        useAppStore.getState().recordFeatureInteraction('notifications')
        onOnboardingChange(await persistStep(ONBOARDING_FINAL_STEP))
        return { ok: true }
      }
      if (currentStepId === 'windows_terminal') {
        // Why: the Windows terminal controls persist on selection. Continuing
        // only marks the preference page complete for resume/telemetry state.
        onOnboardingChange(await persistStep(4))
        return { ok: true }
      }
      if (currentStepId === 'integrations') {
        // Why: GitHub and Linear connections persist through their own
        // store slices when the user actually wires them up. The step itself
        // is a no-op for settings/onboarding state beyond marking it
        // completed.
        onOnboardingChange(await persistStep(3))
        return { ok: true }
      }
      return { ok: false }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return { ok: false }
    }
  }, [
    currentStepId,
    onboardingChecklist,
    onOnboardingChange,
    selectedAgent,
    settings,
    theme,
    updateSettings,
    yoloPermissions,
    setError
  ])
}
