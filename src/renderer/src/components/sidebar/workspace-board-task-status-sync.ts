import type { WorkspaceStatus, WorkspaceStatusDefinition, Worktree } from '../../../../shared/types'
import { getWorkspaceStatus } from '../../../../shared/workspace-statuses'

export type WorkspaceBoardTaskStatusSyncResult = {
  updated: number
  skipped: number
  failed: number
  messages: WorkspaceBoardTaskStatusSyncMessage[]
}

export type WorkspaceBoardTaskStatusSyncMessage =
  | { kind: 'issue-read-failed'; issueIdentifier: string }
  | { kind: 'missing-workflow-state'; statusLabel: string }
  | { kind: 'ambiguous-workflow-state'; statusLabel: string }
  | { kind: 'update-failed'; issueIdentifier: string; detail?: string }
  | { kind: 'provider-error'; issueIdentifier: string; detail?: string }
  | { kind: 'unexpected-error'; detail?: string }

export type SyncWorkspaceBoardTaskStatusesArgs = {
  worktreeIds: readonly string[]
  targetStatus: WorkspaceStatusDefinition
  worktreesById: ReadonlyMap<
    string,
    Pick<Worktree, 'linkedLinearIssue' | 'linkedLinearIssueWorkspaceId'>
  >
  getSettingsForWorktree?: (worktreeId: string) => unknown
  getLatestWorkspaceStatus: (worktreeId: string) => WorkspaceStatus | null | undefined
}

export type WorkspaceBoardTaskStatusSyncRequest = {
  worktreeIds: string[]
  targetStatus: WorkspaceStatusDefinition
}

export function getWorkspaceBoardTaskStatusSyncRequest(args: {
  enabled: boolean
  worktreeIds: readonly string[]
  status: WorkspaceStatus
  worktreesById: ReadonlyMap<string, Pick<Worktree, 'workspaceStatus'>>
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
}): WorkspaceBoardTaskStatusSyncRequest | null {
  if (!args.enabled || args.worktreeIds.length === 0) {
    return null
  }
  const targetStatus = args.workspaceStatuses.find((item) => item.id === args.status)
  if (!targetStatus) {
    return null
  }
  const changedWorktreeIds = [...new Set(args.worktreeIds)].filter((worktreeId) => {
    const worktree = args.worktreesById.get(worktreeId)
    return worktree ? getWorkspaceStatus(worktree, args.workspaceStatuses) !== args.status : false
  })
  if (changedWorktreeIds.length === 0) {
    return null
  }
  return { worktreeIds: changedWorktreeIds, targetStatus }
}

// Why: board task-status sync only ever targeted Linear workflow states. With the
// Linear integration removed there is no provider to sync to, so this resolves to
// an inert no-op while the board's status-change request plumbing stays intact.
export async function syncWorkspaceBoardTaskStatuses(
  _args: SyncWorkspaceBoardTaskStatusesArgs
): Promise<WorkspaceBoardTaskStatusSyncResult> {
  return { updated: 0, skipped: 0, failed: 0, messages: [] }
}
