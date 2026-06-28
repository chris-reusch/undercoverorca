import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { getSelectedNestedRepoPathsInScanOrder } from '@/lib/nested-repo-selected-paths'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/agent-launch-source'
import type { NestedRepoScanResult, ProjectGroupImportResult } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'

export function useAddRepoNestedImportFlow({
  nestedAttemptId,
  nestedScan,
  nestedSelectedPaths,
  nestedConnectionId,
  nestedGroupName,
  nestedImportScanId,
  activeRuntimeEnvironmentId,
  fetchWorktrees,
  importNestedRepos,
  onGitRepoReady,
  setIsAdding
}: {
  nestedAttemptId: string | null
  nestedScan: NestedRepoScanResult | null
  nestedSelectedPaths: Set<string>
  nestedConnectionId: string | null
  nestedGroupName: string
  nestedImportScanId: string | null
  activeRuntimeEnvironmentId: string | null | undefined
  fetchWorktrees: (repoId: string, options?: { requireAuthoritative?: boolean }) => Promise<unknown>
  importNestedRepos: (args: {
    parentPath: string
    groupName: string
    projectPaths: string[]
    connectionId?: string
    scanId?: string
    mode: 'group' | 'separate'
  }) => Promise<ProjectGroupImportResult | null>
  onGitRepoReady: (repoId: string, source: AddRepoExistingWorkspaceSource) => Promise<void>
  setIsAdding: (isAdding: boolean) => void
}): {
  handleImportNestedRepos: (mode: 'group' | 'separate') => Promise<void>
  resetNestedImportFlow: () => void
} {
  const nestedImportGenRef = useRef(0)

  const resetNestedImportFlow = useCallback((): void => {
    nestedImportGenRef.current++
  }, [])

  const handleImportNestedRepos = useCallback(
    async (mode: 'group' | 'separate'): Promise<void> => {
      // Require a scan, a confirmed attempt, and at least one selection before
      // importing (previously enforced via the import-submit telemetry gate).
      if (!nestedScan || !nestedAttemptId || nestedSelectedPaths.size === 0) {
        return
      }
      const selectedProjectPaths = getSelectedNestedRepoPathsInScanOrder(
        nestedScan,
        nestedSelectedPaths
      )
      const gen = ++nestedImportGenRef.current
      setIsAdding(true)
      try {
        const result = await importNestedRepos({
          parentPath: nestedScan.selectedPath,
          groupName: nestedGroupName,
          // Why: Set insertion order can drift after deselect/reselect; import
          // ordering should match the visible scan order users reviewed.
          projectPaths: selectedProjectPaths,
          ...(nestedConnectionId ? { connectionId: nestedConnectionId } : {}),
          ...(nestedImportScanId ? { scanId: nestedImportScanId } : {}),
          mode
        })
        if (!result) {
          return
        }
        const importedRepoIds = result.projects
          .map((entry) => entry.projectId)
          .filter((projectId): projectId is string => typeof projectId === 'string')
        const firstRepoId = importedRepoIds[0]
        if (!firstRepoId) {
          const firstFailure = result.projects.find((entry) => entry.status === 'failed')?.error
          if (gen === nestedImportGenRef.current) {
            toast.error(
              translate(
                'auto.components.sidebar.useAddRepoNestedImportFlow.1b33c5f090',
                'No repositories imported'
              ),
              {
                description: firstFailure ?? undefined
              }
            )
          }
          return
        }
        for (const projectId of importedRepoIds) {
          // Why: imported repos are already persisted; non-authoritative SSH
          // refreshes should not block revealing the first imported project.
          await fetchWorktrees(projectId, { requireAuthoritative: true })
        }
        if (gen !== nestedImportGenRef.current) {
          return
        }
        if (result.failedCount > 0) {
          toast.warning(
            translate(
              'auto.components.sidebar.useAddRepoNestedImportFlow.cbfbc7a797',
              'Some repositories could not be imported'
            ),
            {
              description: translate(
                'auto.components.sidebar.useAddRepoNestedImportFlow.680cac2c82',
                '{{value0}} failed',
                { value0: result.failedCount }
              )
            }
          )
        }
        const repo = useAppStore.getState().repos.find((entry) => entry.id === firstRepoId)
        if (repo) {
          const source: AddRepoExistingWorkspaceSource = nestedConnectionId
            ? 'ssh_remote_path'
            : activeRuntimeEnvironmentId?.trim()
              ? 'runtime_server_path'
              : 'local_folder_picker'
          await onGitRepoReady(repo.id, source)
        }
      } catch (err) {
        if (gen === nestedImportGenRef.current) {
          toast.error(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (gen === nestedImportGenRef.current) {
          setIsAdding(false)
        }
      }
    },
    [
      activeRuntimeEnvironmentId,
      fetchWorktrees,
      importNestedRepos,
      nestedAttemptId,
      nestedConnectionId,
      nestedGroupName,
      nestedImportScanId,
      nestedScan,
      nestedSelectedPaths,
      onGitRepoReady,
      setIsAdding
    ]
  )

  return { handleImportNestedRepos, resetNestedImportFlow }
}
