import type { GitPushTarget } from '../../shared/types'
import {
  ghExecFileAsync,
  acquire,
  release,
  getOwnerRepo,
  getOwnerRepoForRemote,
  resolvePRRepositoryCandidates,
  classifyGhError,
  ghRepoExecOptions,
  githubRepoContext,
  getRemoteUrlForRepo,
  type LocalGitExecOptions,
  type OwnerRepo
} from './gh-utils'
import {
  hasHostedReviewLocalGitOptions,
  getHostedReviewLocalGitOptions,
  type HostedReviewExecutionOptions
} from '../source-control/hosted-review-git-options'
export { _resetOwnerRepoCache } from './gh-utils'

type HostedReviewLocalGitOptions = ReturnType<typeof getHostedReviewLocalGitOptions>

function hostedReviewLocalGitOptionArgs(
  options: HostedReviewExecutionOptions = {}
): [] | [HostedReviewLocalGitOptions] {
  return hasHostedReviewLocalGitOptions(options) ? [getHostedReviewLocalGitOptions(options)] : []
}

function pickPushRemoteUrl(args: {
  originUrl: string | null
  cloneUrl: string
  sshUrl: string
}): string {
  const { originUrl, cloneUrl, sshUrl } = args
  if (originUrl && (/^(git@|ssh:)/.test(originUrl) || originUrl.includes('ssh.github.com'))) {
    return sshUrl
  }
  return cloneUrl
}

function sanitizeRemoteName(owner: string, repo: string): string {
  const slug = `${owner}-${repo}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
  return slug ? `pr-${slug}` : 'pr-head'
}

/**
 * A fork push target plus the PR's `maintainer_can_modify` flag. The flag rides
 * alongside the target (rather than inside {@link GitPushTarget}) so it never
 * leaks into the persisted, validated push-target shape.
 */
export type PullRequestPushTarget = {
  pushTarget: GitPushTarget
  /** false when the PR has "Allow edits from maintainers" off; a push may be rejected. */
  maintainerCanModify?: boolean
}

export async function getPullRequestPushTarget(
  repoPath: string,
  prNumber: number,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<PullRequestPushTarget | null> {
  const context = githubRepoContext(repoPath, connectionId, localGitOptions)
  const ghOptions = ghRepoExecOptions(context)
  const { candidates } = await resolvePRRepositoryCandidates(
    repoPath,
    connectionId,
    localGitOptions
  )
  if (candidates.length === 0) {
    return null
  }

  await acquire()
  try {
    let prStdout = ''
    for (const candidate of candidates) {
      try {
        const { stdout } = await ghExecFileAsync(
          ['api', `repos/${candidate.owner}/${candidate.repo}/pulls/${prNumber}`],
          {
            ...ghOptions
          }
        )
        prStdout = stdout
        break
      } catch (error) {
        // Why: in fork workflows `origin` is often the contributor fork while
        // the PR number belongs to `upstream`; probe all known PR repos before
        // deciding this PR number is unavailable.
        if (isNotFoundGhError(error)) {
          continue
        }
        throw error
      }
    }
    if (!prStdout) {
      return null
    }
    const origin = await getOwnerRepoForRemote(repoPath, 'origin', connectionId, localGitOptions)
    const pr = JSON.parse(prStdout) as {
      maintainer_can_modify?: boolean
      head?: {
        ref?: string
        repo?: {
          full_name?: string
          clone_url?: string
          ssh_url?: string
          owner?: { login?: string }
          name?: string
        } | null
      }
    }
    const headRepo = pr.head?.repo
    const branchName = pr.head?.ref?.trim()
    const owner = headRepo?.owner?.login?.trim()
    const repo = headRepo?.name?.trim() ?? headRepo?.full_name?.split('/')[1]?.trim()
    const cloneUrl = headRepo?.clone_url?.trim()
    const sshUrl = headRepo?.ssh_url?.trim()
    const maintainerCanModify =
      typeof pr.maintainer_can_modify === 'boolean' ? pr.maintainer_can_modify : undefined
    if (!owner || !repo || !branchName || !cloneUrl || !sshUrl) {
      return null
    }
    if (
      origin &&
      origin.owner.toLowerCase() === owner.toLowerCase() &&
      origin.repo.toLowerCase() === repo.toLowerCase()
    ) {
      return {
        pushTarget: { remoteName: 'origin', branchName },
        ...(maintainerCanModify !== undefined ? { maintainerCanModify } : {})
      }
    }

    let originUrl: string | null = null
    try {
      const rawOriginUrl = await getRemoteUrlForRepo(context, 'origin')
      originUrl = rawOriginUrl?.trim() || null
    } catch {
      originUrl = null
    }
    return {
      pushTarget: {
        remoteName: sanitizeRemoteName(owner, repo),
        branchName,
        remoteUrl: pickPushRemoteUrl({ originUrl, cloneUrl, sshUrl })
      },
      ...(maintainerCanModify !== undefined ? { maintainerCanModify } : {})
    }
  } finally {
    release()
  }
}

function sameOwnerRepo(left: OwnerRepo | null, right: OwnerRepo | null): boolean {
  // Why: GitHub treats owner and repo names as case-insensitive, so remotes
  // with different casing (StablyAI/Orca vs stablyai/orca) point at the same
  // repo and should not split into two search queries.
  return (
    left?.owner.toLowerCase() === right?.owner.toLowerCase() &&
    left?.repo.toLowerCase() === right?.repo.toLowerCase()
  )
}

export async function getRepoSlug(
  repoPath: string,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<{ owner: string; repo: string } | null> {
  return getOwnerRepo(repoPath, connectionId, ...hostedReviewLocalGitOptionArgs(options))
}

/**
 * Resolve a fork's upstream/parent owner/repo, or null when the repo is not a
 * fork. Why: a fork's `origin` points at the personal copy, so repo identity
 * (notably the avatar) should prefer the upstream. Fast-paths the `upstream`
 * remote (offline); otherwise asks the GitHub API for the fork parent. The API
 * call targets the explicit origin slug, so it works for SSH repos too.
 * Best-effort: any failure (offline, unauthed, non-GitHub) resolves to null.
 */
export async function getRepoUpstream(
  repoPath: string,
  connectionId?: string | null,
  options: HostedReviewExecutionOptions = {}
): Promise<OwnerRepo | null> {
  const localGitArgs = hostedReviewLocalGitOptionArgs(options)
  const localGitOptions = localGitArgs[0] ?? {}
  const origin = await getOwnerRepo(repoPath, connectionId, ...localGitArgs)
  if (!origin) {
    return null
  }
  const upstreamRemote = await getOwnerRepoForRemote(
    repoPath,
    'upstream',
    connectionId,
    ...localGitArgs
  )
  if (upstreamRemote && !sameOwnerRepo(upstreamRemote, origin)) {
    return upstreamRemote
  }
  await acquire()
  try {
    const { stdout } = await ghExecFileAsync(
      ['repo', 'view', `${origin.owner}/${origin.repo}`, '--json', 'isFork,parent'],
      // Why: best-effort fork lookup runs at add-time; cap latency so a stalled
      // gh process can't hold up repo creation.
      {
        ...ghRepoExecOptions(githubRepoContext(repoPath, connectionId, localGitOptions)),
        timeout: 10_000
      }
    )
    const data = JSON.parse(stdout) as {
      isFork?: boolean
      parent?: { name?: string; owner?: { login?: string } } | null
    }
    const owner = data.parent?.owner?.login
    const repo = data.parent?.name
    return data.isFork && owner && repo ? { owner, repo } : null
  } catch {
    return null
  } finally {
    release()
  }
}

function isNotFoundGhError(err: unknown): boolean {
  const stderr = err instanceof Error ? err.message : String(err)
  return classifyGhError(stderr).type === 'not_found'
}

// Why: create-PR shells out to `gh pr create` and must stay decoupled from the
// GraphQL fetchers in this file so it can survive their later removal.
export { createGitHubPullRequest } from './create-pr'
