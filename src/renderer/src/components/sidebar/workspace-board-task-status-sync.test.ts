import { describe, expect, it } from 'vitest'
import type { WorkspaceStatusDefinition, Worktree } from '../../../../shared/types'
import { getWorkspaceBoardTaskStatusSyncRequest } from './workspace-board-task-status-sync'

function worktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo::/worktree',
    linkedLinearIssue: 'ORC-1',
    linkedLinearIssueWorkspaceId: 'workspace-1',
    ...overrides
  } as Worktree
}

describe('getWorkspaceBoardTaskStatusSyncRequest', () => {
  const workspaceStatuses: WorkspaceStatusDefinition[] = [
    { id: 'todo', label: 'Todo' },
    { id: 'in-review', label: 'In review' }
  ]

  it('builds a sync request for enabled status moves', () => {
    const request = getWorkspaceBoardTaskStatusSyncRequest({
      enabled: true,
      worktreeIds: ['repo::/a'],
      status: 'in-review',
      worktreesById: new Map([['repo::/a', worktree({ workspaceStatus: 'todo' })]]),
      workspaceStatuses
    })

    expect(request).toEqual({
      worktreeIds: ['repo::/a'],
      targetStatus: { id: 'in-review', label: 'In review' }
    })
  })

  it('does not build a sync request while the board setting is disabled', () => {
    expect(
      getWorkspaceBoardTaskStatusSyncRequest({
        enabled: false,
        worktreeIds: ['repo::/a'],
        status: 'in-review',
        worktreesById: new Map([['repo::/a', worktree({ workspaceStatus: 'todo' })]]),
        workspaceStatuses
      })
    ).toBeNull()
  })

  it('skips same-status and duplicate ids so manual-order-only drops do not sync', () => {
    expect(
      getWorkspaceBoardTaskStatusSyncRequest({
        enabled: true,
        worktreeIds: ['repo::/a', 'repo::/a'],
        status: 'in-review',
        worktreesById: new Map([['repo::/a', worktree({ workspaceStatus: 'in-review' })]]),
        workspaceStatuses
      })
    ).toBeNull()
  })

  it('does not build a sync request without a board status target', () => {
    expect(
      getWorkspaceBoardTaskStatusSyncRequest({
        enabled: true,
        worktreeIds: ['repo::/a'],
        status: 'unknown-status',
        worktreesById: new Map([['repo::/a', worktree({ workspaceStatus: 'todo' })]]),
        workspaceStatuses
      })
    ).toBeNull()
  })
})
