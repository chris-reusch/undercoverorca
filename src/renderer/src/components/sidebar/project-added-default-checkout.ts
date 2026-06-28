import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type {
  AddRepoDefaultCheckoutHandoffSource,
  AddRepoDefaultCheckoutHandoffReason
} from '../../../../shared/agent-launch-source'
import type { DetectedWorktreeListResult, Worktree } from '../../../../shared/types'
import { markOnboardingProjectAdded } from '@/lib/onboarding-project-checklist'
import { finalizeImportedRepoAfterSkip } from './add-repo-skip-finalization'

type DefaultCheckoutHandoffReason = AddRepoDefaultCheckoutHandoffReason

export function getProjectDefaultCheckout(worktrees: readonly Worktree[]): Worktree | null {
  return worktrees.find((worktree) => worktree.isMainWorktree) ?? null
}

function getDetectedProjectDefaultCheckout(
  detected: DetectedWorktreeListResult | undefined
): DetectedWorktreeListResult['worktrees'][number] | null {
  if (detected?.authoritative !== true) {
    return null
  }
  return detected.worktrees.find((worktree) => worktree.isMainWorktree) ?? null
}

function hasDetectedHiddenLinkedExternalWorktrees(
  detected: DetectedWorktreeListResult | undefined
): boolean {
  if (detected?.authoritative !== true) {
    return false
  }
  return detected.worktrees.some(
    (worktree) =>
      !worktree.isMainWorktree &&
      !worktree.selectedCheckout &&
      !worktree.visible &&
      worktree.ownership !== 'orca-managed'
  )
}

async function revealDetectedHiddenLinkedExternalWorktrees(
  repoId: string
): Promise<DefaultCheckoutHandoffReason | null> {
  const state = useAppStore.getState()
  if (!hasDetectedHiddenLinkedExternalWorktrees(state.detectedWorktreesByRepo[repoId])) {
    return null
  }

  // Why: the removed setup step's existing-worktree path made linked external
  // worktrees visible; the automatic handoff must preserve that import result.
  const updated = await state.updateRepo(repoId, { externalWorktreeVisibility: 'show' })
  if (!updated) {
    return 'show_detected_linked_failed'
  }
  const refreshed = await useAppStore.getState().fetchWorktrees(repoId, {
    requireAuthoritative: true
  })
  return refreshed ? null : 'linked_external_refresh_failed'
}

async function findDetectedDefaultCheckout(repoId: string): Promise<{
  worktree: Worktree | null
  reason: DefaultCheckoutHandoffReason
}> {
  const state = useAppStore.getState()
  const detected = state.detectedWorktreesByRepo[repoId]
  const detectedDefaultCheckout = getDetectedProjectDefaultCheckout(detected)
  if (!detectedDefaultCheckout) {
    return {
      worktree: null,
      reason:
        detected?.authoritative === true ? 'no_default_checkout' : 'no_authoritative_detection'
    }
  }
  if (!detectedDefaultCheckout.visible) {
    // Why: a freshly cloned primary checkout can be detected as a hidden
    // external worktree; adding a project should make that checkout usable.
    const updated = await state.updateRepo(repoId, { externalWorktreeVisibility: 'show' })
    if (!updated) {
      return { worktree: null, reason: 'show_detected_default_failed' }
    }
  }
  const refreshed = await useAppStore.getState().fetchWorktrees(repoId, {
    requireAuthoritative: true
  })
  if (!refreshed) {
    return { worktree: null, reason: 'authoritative_refresh_failed' }
  }
  const worktree = getProjectDefaultCheckout(useAppStore.getState().worktreesByRepo[repoId] ?? [])
  return {
    worktree,
    reason: worktree ? 'detected_default_checkout' : 'refreshed_default_missing'
  }
}

export async function openProjectDefaultCheckout({
  repoId,
  setHideDefaultBranchWorkspace
}: {
  repoId: string
  // Retained for call-site compatibility across the add-project flow; the value
  // no longer drives behavior after telemetry removal.
  source: AddRepoDefaultCheckoutHandoffSource
  setHideDefaultBranchWorkspace: (value: boolean) => void
}): Promise<void> {
  let defaultCheckout = getProjectDefaultCheckout(
    useAppStore.getState().worktreesByRepo[repoId] ?? []
  )
  if (!defaultCheckout) {
    const detectedDefaultCheckout = await findDetectedDefaultCheckout(repoId)
    defaultCheckout = detectedDefaultCheckout.worktree
  }

  if (defaultCheckout) {
    const revealLinkedFailureReason = await revealDetectedHiddenLinkedExternalWorktrees(repoId)
    if (revealLinkedFailureReason) {
      finalizeImportedRepoAfterSkip(useAppStore.getState(), repoId)
      return
    }
    // Why: the onboarding handoff should land on the default checkout even
    // when the user normally hides default-branch workspaces in the sidebar.
    const state = useAppStore.getState()
    if (state.hideDefaultBranchWorkspace) {
      setHideDefaultBranchWorkspace(false)
    }
    activateAndRevealWorktree(defaultCheckout.id)
    return
  }

  finalizeImportedRepoAfterSkip(useAppStore.getState(), repoId)
}

export async function finishProjectAddWithDefaultCheckout({
  repoId,
  source,
  closeModal,
  setHideDefaultBranchWorkspace
}: {
  repoId: string
  source: AddRepoDefaultCheckoutHandoffSource
  closeModal: () => void
  setHideDefaultBranchWorkspace: (value: boolean) => void
}): Promise<void> {
  await markOnboardingProjectAdded('addedRepo')
  closeModal()
  await openProjectDefaultCheckout({ repoId, source, setHideDefaultBranchWorkspace })
}
