import { ipcMain } from 'electron'
import { resolve } from 'path'
import type { Repo } from '../../shared/types'
import { getRepoExecutionHostId } from '../../shared/execution-host'
import type { TaskSourceContext } from '../../shared/task-source-context'
import type { Store } from '../persistence'
import type { StatsCollector } from '../stats/collector'
import { getRepoSlug, getRepoUpstream } from '../github/client'
import { diagnoseGhAuth } from '../github/auth-diagnose'
import { getLocalProjectWorktreeGitOptions } from '../project-runtime-git-options'

type RepoScopedArgs = {
  repoPath: string
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
}

function assertRegisteredRepo(args: string | RepoScopedArgs, store: Store): Repo {
  const repoPath = typeof args === 'string' ? args : args.repoPath
  const repoId = typeof args === 'string' ? undefined : args.repoId
  const resolvedRepoPath = resolve(repoPath)
  const repos = store.getRepos()
  const repo = repos.find((r) => (repoId ? r.id === repoId : resolve(r.path) === resolvedRepoPath))
  if (!repo) {
    throw new Error('Access denied: unknown repository path')
  }
  if (repoId && resolve(repo.path) !== resolvedRepoPath) {
    throw new Error('Access denied: repository path does not match repo id')
  }
  if (
    typeof args !== 'string' &&
    args.sourceContext?.provider === 'github' &&
    args.sourceContext.hostId !== getRepoExecutionHostId(repo)
  ) {
    throw new Error('Access denied: GitHub source host does not match repository host')
  }
  return repo
}

function repoConnectionId(repo: Repo): string | null {
  return repo.connectionId ?? null
}

function localGitOptionArgs(store: Store, repo: Repo): [] | [{ wslDistro?: string }] {
  const localGitOptions = getLocalProjectWorktreeGitOptions(store, repo)
  return Object.keys(localGitOptions).length > 0 ? [localGitOptions] : []
}

export function registerGitHubHandlers(store: Store, _stats: StatsCollector): void {
  ipcMain.handle('gh:repoSlug', (_event, args: { repoPath: string }) => {
    const repo = assertRegisteredRepo(args, store)
    const localGitOptions = localGitOptionArgs(store, repo)[0]
    return localGitOptions
      ? getRepoSlug(repo.path, repoConnectionId(repo), { localGitExecOptions: localGitOptions })
      : getRepoSlug(repo.path, repoConnectionId(repo))
  })

  ipcMain.handle('gh:repoUpstream', (_event, args: { repoPath: string }) => {
    const repo = assertRegisteredRepo(args, store)
    const localGitOptions = localGitOptionArgs(store, repo)[0]
    return localGitOptions
      ? getRepoUpstream(repo.path, repoConnectionId(repo), { localGitExecOptions: localGitOptions })
      : getRepoUpstream(repo.path, repoConnectionId(repo))
  })

  ipcMain.handle('gh:diagnoseAuth', () => diagnoseGhAuth())
}
