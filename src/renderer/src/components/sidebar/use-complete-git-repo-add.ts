import { useCallback } from 'react'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/agent-launch-source'
import { finishProjectAddWithDefaultCheckout } from './project-added-default-checkout'

type CompleteGitRepoAddOptions = {
  closeModal: () => void
  setHideDefaultBranchWorkspace: (hide: boolean) => void
}

export function useCompleteGitRepoAdd({
  closeModal,
  setHideDefaultBranchWorkspace
}: CompleteGitRepoAddOptions): (
  repoId: string,
  source: AddRepoExistingWorkspaceSource
) => Promise<void> {
  return useCallback(
    async (repoId: string, source: AddRepoExistingWorkspaceSource): Promise<void> => {
      await finishProjectAddWithDefaultCheckout({
        repoId,
        source,
        closeModal,
        setHideDefaultBranchWorkspace
      })
    },
    [closeModal, setHideDefaultBranchWorkspace]
  )
}
