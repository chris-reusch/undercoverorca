import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { AppState } from '../types'
import { createHostedReviewSlice } from './hosted-review'

const runtimeRpc = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn()
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: runtimeRpc.callRuntimeRpc,
  getActiveRuntimeTarget: (
    settings: { activeRuntimeEnvironmentId?: string | null } | null | undefined
  ) => {
    const environmentId = settings?.activeRuntimeEnvironmentId?.trim()
    return environmentId ? { kind: 'environment', environmentId } : { kind: 'local' }
  }
}))

const mockApi = {
  hostedReview: {
    getCreationEligibility: vi.fn(),
    create: vi.fn()
  }
}

globalThis.window = { api: mockApi } as never

function makeStore(settings: AppState['settings'] = null) {
  return create<
    Pick<
      AppState,
      'getHostedReviewCreationEligibility' | 'createHostedReview' | 'settings' | 'repos'
    >
  >()((...args) => ({
    settings,
    repos: [{ id: 'repo-1', path: '/repo', connectionId: null } as AppState['repos'][number]],
    ...createHostedReviewSlice(...(args as Parameters<typeof createHostedReviewSlice>))
  }))
}

describe('hosted review slice', () => {
  beforeEach(() => {
    mockApi.hostedReview.getCreationEligibility.mockReset()
    mockApi.hostedReview.create.mockReset()
    runtimeRpc.callRuntimeRpc.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('forwards the selected worktree path when creating a local pull request', async () => {
    mockApi.hostedReview.create.mockResolvedValueOnce({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })
    const store = makeStore()

    await expect(
      store.getState().createHostedReview('/repo', {
        provider: 'github',
        base: 'main',
        head: 'feature/create-pr',
        title: 'Create PR',
        worktreePath: '/worktrees/feature'
      })
    ).resolves.toMatchObject({ ok: true, number: 12 })

    expect(mockApi.hostedReview.create).toHaveBeenCalledWith({
      repoPath: '/repo',
      repoId: 'repo-1',
      connectionId: null,
      provider: 'github',
      base: 'main',
      head: 'feature/create-pr',
      title: 'Create PR',
      worktreePath: '/worktrees/feature'
    })
  })

  it('forwards SSH connectionId when creating pull requests through local IPC', async () => {
    mockApi.hostedReview.create.mockResolvedValueOnce({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })
    const store = makeStore()
    store.setState({
      repos: [{ id: 'repo-1', path: '/repo', connectionId: 'ssh-1' } as AppState['repos'][number]]
    })

    await expect(
      store.getState().createHostedReview('/repo', {
        provider: 'github',
        base: 'main',
        head: 'feature/create-pr',
        title: 'Create PR',
        worktreePath: '/remote/worktree'
      })
    ).resolves.toMatchObject({ ok: true, number: 12 })

    expect(mockApi.hostedReview.create).toHaveBeenCalledWith({
      repoPath: '/repo',
      repoId: 'repo-1',
      connectionId: 'ssh-1',
      provider: 'github',
      base: 'main',
      head: 'feature/create-pr',
      title: 'Create PR',
      worktreePath: '/remote/worktree'
    })
  })

  it('forwards SSH connectionId when checking pull request creation eligibility', async () => {
    mockApi.hostedReview.getCreationEligibility.mockResolvedValueOnce({
      provider: 'github',
      review: null,
      canCreate: true,
      blockedReason: null,
      nextAction: null
    })
    const store = makeStore()
    store.setState({
      repos: [{ id: 'repo-1', path: '/repo', connectionId: 'ssh-1' } as AppState['repos'][number]]
    })

    await store.getState().getHostedReviewCreationEligibility({
      repoPath: '/repo',
      worktreePath: '/remote/worktree',
      branch: 'feature/create-pr',
      base: 'main'
    })

    expect(mockApi.hostedReview.getCreationEligibility).toHaveBeenCalledWith({
      repoPath: '/repo',
      repoId: 'repo-1',
      connectionId: 'ssh-1',
      worktreePath: '/remote/worktree',
      branch: 'feature/create-pr',
      base: 'main'
    })
  })

  it('uses the selected worktree selector for runtime pull request creation', async () => {
    runtimeRpc.callRuntimeRpc.mockResolvedValueOnce({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })
    const store = makeStore({
      activeRuntimeEnvironmentId: 'env-win'
    } as AppState['settings'])

    await store.getState().createHostedReview('/repo', {
      provider: 'github',
      base: 'main',
      head: 'feature/create-pr',
      title: 'Create PR',
      worktreePath: 'C:\\worktrees\\feature'
    })

    expect(runtimeRpc.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-win' },
      'hostedReview.create',
      {
        repo: 'repo-1',
        worktree: 'path:C:\\worktrees\\feature',
        provider: 'github',
        base: 'main',
        head: 'feature/create-pr',
        title: 'Create PR'
      },
      { timeoutMs: 60_000 }
    )
  })

  it('uses the selected worktree selector for runtime pull request creation eligibility', async () => {
    runtimeRpc.callRuntimeRpc.mockResolvedValueOnce({
      provider: 'github',
      review: null,
      canCreate: true,
      blockedReason: null,
      nextAction: null
    })
    const store = makeStore({
      activeRuntimeEnvironmentId: 'env-win'
    } as AppState['settings'])

    await store.getState().getHostedReviewCreationEligibility({
      repoPath: '/repo',
      worktreePath: 'C:\\worktrees\\feature',
      branch: 'feature/create-pr',
      base: 'main'
    })

    expect(runtimeRpc.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-win' },
      'hostedReview.getCreationEligibility',
      {
        repo: 'repo-1',
        worktree: 'path:C:\\worktrees\\feature',
        branch: 'feature/create-pr',
        base: 'main'
      },
      { timeoutMs: 30_000 }
    )
  })
})
