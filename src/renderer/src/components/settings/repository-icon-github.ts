import type { GitHubRepositoryIdentity, Repo } from '../../../../shared/types'
import { callRuntimeRpc, type getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeTarget = ReturnType<typeof getActiveRuntimeTarget>

export async function resolveRepositoryUpstreamLive(
  runtimeTarget: RuntimeTarget,
  repo: Repo
): Promise<GitHubRepositoryIdentity | null> {
  return runtimeTarget.kind === 'environment'
    ? await callRuntimeRpc<GitHubRepositoryIdentity | null>(
        runtimeTarget,
        'github.repoUpstream',
        { repo: repo.id },
        { timeoutMs: 30_000 }
      )
    : await window.api.gh.repoUpstream({ repoPath: repo.path, repoId: repo.id })
}
