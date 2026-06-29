import type { StateCreator } from 'zustand'
import type {
  CreateHostedReviewInput,
  CreateHostedReviewResult,
  HostedReviewCreationEligibility,
  HostedReviewCreationEligibilityArgs
} from '../../../../shared/hosted-review'
import type { Repo } from '../../../../shared/types'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import type { AppState } from '../types'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../../shared/execution-host'

type CreateHostedReviewStoreInput = CreateHostedReviewInput & { repoId?: string | null }

function findHostedReviewRepoByPath(
  repos: readonly Repo[] | undefined,
  repoPath: string,
  repoId?: string | null
): Repo | undefined {
  return repos?.find((candidate) =>
    repoId ? candidate.id === repoId : candidate.path === repoPath
  )
}

function settingsForHostedReviewRepoOwner(
  settings: AppState['settings'],
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | undefined
): AppState['settings'] {
  if (!repo) {
    return settings
  }
  const parsed = parseExecutionHostId(getRepoExecutionHostId(repo))
  if (parsed?.kind === 'runtime') {
    return settings
      ? { ...settings, activeRuntimeEnvironmentId: parsed.environmentId }
      : ({ activeRuntimeEnvironmentId: parsed.environmentId } as AppState['settings'])
  }
  // Why: local and SSH-owned reviews are served by the desktop client's local
  // IPC path, even when the sidebar is focused on a runtime host.
  return settings
    ? { ...settings, activeRuntimeEnvironmentId: null }
    : ({ activeRuntimeEnvironmentId: null } as AppState['settings'])
}

function settingsForHostedReviewActionOwner(
  settings: AppState['settings'],
  repo: Pick<Repo, 'connectionId' | 'executionHostId'> | undefined
): AppState['settings'] {
  if (!repo?.executionHostId && !repo?.connectionId) {
    return settings
  }
  return settingsForHostedReviewRepoOwner(settings, repo)
}

export type HostedReviewSlice = {
  getHostedReviewCreationEligibility: (
    args: HostedReviewCreationEligibilityArgs
  ) => Promise<HostedReviewCreationEligibility>
  createHostedReview: (
    repoPath: string,
    input: CreateHostedReviewStoreInput
  ) => Promise<CreateHostedReviewResult>
}

export const createHostedReviewSlice: StateCreator<AppState, [], [], HostedReviewSlice> = (
  _set,
  get
) => ({
  getHostedReviewCreationEligibility: async (args) => {
    const settings = get().settings
    const repo = findHostedReviewRepoByPath(get().repos, args.repoPath, args.repoId)
    const ownerSettings = settingsForHostedReviewActionOwner(settings, repo)
    const target = getActiveRuntimeTarget(ownerSettings)
    if (target.kind === 'environment') {
      const { repoPath: _repoPath, worktreePath, ...runtimeArgs } = args
      void _repoPath
      return callRuntimeRpc<HostedReviewCreationEligibility>(
        target,
        'hostedReview.getCreationEligibility',
        {
          repo: repo?.id ?? args.repoPath,
          ...(worktreePath ? { worktree: `path:${worktreePath}` } : {}),
          ...runtimeArgs
        },
        { timeoutMs: 30_000 }
      )
    }
    return window.api.hostedReview.getCreationEligibility({
      ...args,
      repoId: repo?.id ?? args.repoId,
      connectionId: repo?.connectionId ?? null
    })
  },

  createHostedReview: async (repoPath, input) => {
    const settings = get().settings
    const repo = findHostedReviewRepoByPath(get().repos, repoPath, input.repoId)
    const ownerSettings = settingsForHostedReviewActionOwner(settings, repo)
    const target = getActiveRuntimeTarget(ownerSettings)
    const { repoId: inputRepoId, ...hostedReviewInput } = input
    if (target.kind === 'environment') {
      const { worktreePath, ...runtimeInput } = hostedReviewInput
      return callRuntimeRpc<CreateHostedReviewResult>(
        target,
        'hostedReview.create',
        {
          repo: repo?.id ?? repoPath,
          ...(worktreePath ? { worktree: `path:${worktreePath}` } : {}),
          ...runtimeInput
        },
        { timeoutMs: 60_000 }
      )
    }
    return window.api.hostedReview.create({
      repoPath,
      repoId: repo?.id ?? inputRepoId ?? undefined,
      connectionId: repo?.connectionId ?? null,
      ...hostedReviewInput
    })
  }
})
