import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  execFileAsyncMock,
  ghExecFileAsyncMock,
  getOwnerRepoMock,
  getOwnerRepoForRemoteMock,
  resolvePRRepositoryCandidatesMock,
  getRemoteUrlForRepoMock,
  gitExecFileAsyncMock,
  ghRepoExecOptionsMock,
  githubRepoContextMock,
  acquireMock,
  releaseMock
} = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn(),
  ghExecFileAsyncMock: vi.fn(),
  getOwnerRepoMock: vi.fn(),
  getOwnerRepoForRemoteMock: vi.fn(),
  resolvePRRepositoryCandidatesMock: vi.fn(),
  getRemoteUrlForRepoMock: vi.fn(),
  gitExecFileAsyncMock: vi.fn(),
  ghRepoExecOptionsMock: vi.fn((context) =>
    context.connectionId
      ? {}
      : {
          cwd: context.repoPath,
          ...(context.wslDistro ? { wslDistro: context.wslDistro } : {})
        }
  ),
  githubRepoContextMock: vi.fn((repoPath, connectionId, localGitOptions) => ({
    repoPath,
    connectionId: connectionId ?? null,
    ...localGitOptions
  })),
  acquireMock: vi.fn(),
  releaseMock: vi.fn()
}))

vi.mock('./gh-utils', () => ({
  execFileAsync: execFileAsyncMock,
  ghExecFileAsync: ghExecFileAsyncMock,
  getOwnerRepo: getOwnerRepoMock,
  getOwnerRepoForRemote: getOwnerRepoForRemoteMock,
  resolvePRRepositoryCandidates: resolvePRRepositoryCandidatesMock,
  getRemoteUrlForRepo: getRemoteUrlForRepoMock,
  ghRepoExecOptions: ghRepoExecOptionsMock,
  githubRepoContext: githubRepoContextMock,
  classifyGhError: (stderr: string) => {
    const lower = stderr.toLowerCase()
    if (lower.includes('not found') || stderr.includes('HTTP 404')) {
      return { type: 'not_found', message: stderr }
    }
    if (lower.includes('rate limit')) {
      return { type: 'rate_limited', message: stderr }
    }
    return { type: 'unknown', message: stderr }
  },
  acquire: acquireMock,
  release: releaseMock,
  _resetOwnerRepoCache: vi.fn()
}))

import { getRepoUpstream, getPullRequestPushTarget, _resetOwnerRepoCache } from './client'

describe('push target and upstream resolution', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset()
    ghExecFileAsyncMock.mockReset()
    getOwnerRepoMock.mockReset()
    getOwnerRepoForRemoteMock.mockReset()
    resolvePRRepositoryCandidatesMock.mockReset()
    resolvePRRepositoryCandidatesMock.mockImplementation(async (repoPath, connectionId) => {
      const origin = await getOwnerRepoMock(repoPath, connectionId)
      return { candidates: origin ? [origin] : [], headRepo: origin }
    })
    getRemoteUrlForRepoMock.mockReset()
    gitExecFileAsyncMock.mockReset()
    ghRepoExecOptionsMock.mockClear()
    githubRepoContextMock.mockClear()
    acquireMock.mockReset()
    releaseMock.mockReset()
    acquireMock.mockResolvedValue(undefined)
    _resetOwnerRepoCache()
  })

  it('resolves fork PR push target using the origin URL protocol', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    ghExecFileAsyncMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        head: {
          ref: 'prateek/fix-sidebar-agents-toggle',
          repo: {
            full_name: 'prateek/orca',
            name: 'orca',
            clone_url: 'https://github.com/prateek/orca.git',
            ssh_url: 'git@github.com:prateek/orca.git',
            owner: { login: 'prateek' }
          }
        }
      })
    })
    getRemoteUrlForRepoMock.mockResolvedValueOnce('git@github.com:stablyai/orca.git')

    const target = await getPullRequestPushTarget('/repo-root', 1738)

    expect(ghExecFileAsyncMock).toHaveBeenCalledWith(['api', 'repos/stablyai/orca/pulls/1738'], {
      cwd: '/repo-root'
    })
    expect(target).toEqual({
      pushTarget: {
        remoteName: 'pr-prateek-orca',
        branchName: 'prateek/fix-sidebar-agents-toggle',
        remoteUrl: 'git@github.com:prateek/orca.git'
      }
    })
  })

  it('surfaces maintainer_can_modify=false alongside a fork PR push target', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    ghExecFileAsyncMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        maintainer_can_modify: false,
        head: {
          ref: 'prateek/fix-sidebar-agents-toggle',
          repo: {
            full_name: 'prateek/orca',
            name: 'orca',
            clone_url: 'https://github.com/prateek/orca.git',
            ssh_url: 'git@github.com:prateek/orca.git',
            owner: { login: 'prateek' }
          }
        }
      })
    })
    getRemoteUrlForRepoMock.mockResolvedValueOnce('git@github.com:stablyai/orca.git')

    await expect(getPullRequestPushTarget('/repo-root', 1738)).resolves.toEqual({
      pushTarget: {
        remoteName: 'pr-prateek-orca',
        branchName: 'prateek/fix-sidebar-agents-toggle',
        remoteUrl: 'git@github.com:prateek/orca.git'
      },
      maintainerCanModify: false
    })
  })

  it('uses origin for same-repository PR push targets', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    ghExecFileAsyncMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        head: {
          ref: 'fix-sidebar',
          repo: {
            full_name: 'stablyai/orca',
            name: 'orca',
            clone_url: 'https://github.com/stablyai/orca.git',
            ssh_url: 'git@github.com:stablyai/orca.git',
            owner: { login: 'stablyai' }
          }
        }
      })
    })

    await expect(getPullRequestPushTarget('/repo-root', 1738)).resolves.toEqual({
      pushTarget: {
        remoteName: 'origin',
        branchName: 'fix-sidebar'
      }
    })
    expect(gitExecFileAsyncMock).not.toHaveBeenCalled()
  })

  it('resolves a distinct upstream remote as the repo upstream', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'tmchow', repo: 'orca' })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })

    await expect(getRepoUpstream('/repo-root')).resolves.toEqual({
      owner: 'stablyai',
      repo: 'orca'
    })

    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })

  it('does not treat a same-repository upstream remote as a fork', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'StablyAI', repo: 'Orca' })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce({ owner: 'stablyai', repo: 'orca' })
    ghExecFileAsyncMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ isFork: false, parent: null })
    })

    await expect(getRepoUpstream('/repo-root')).resolves.toBeNull()

    expect(ghExecFileAsyncMock).toHaveBeenCalledWith(
      ['repo', 'view', 'StablyAI/Orca', '--json', 'isFork,parent'],
      { cwd: '/repo-root', timeout: 10_000 }
    )
  })

  it('does not mark an upstream-only GitHub remote as a fork', async () => {
    getOwnerRepoMock.mockResolvedValueOnce(null)

    await expect(getRepoUpstream('/repo-root')).resolves.toBeNull()

    expect(getOwnerRepoForRemoteMock).not.toHaveBeenCalled()
    expect(ghExecFileAsyncMock).not.toHaveBeenCalled()
  })

  it('falls back to the GitHub parent when no upstream remote is configured', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'tmchow', repo: 'orca' })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce(null)
    ghExecFileAsyncMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        isFork: true,
        parent: { name: 'orca', owner: { login: 'stablyai' } }
      })
    })

    await expect(getRepoUpstream('/repo-root')).resolves.toEqual({
      owner: 'stablyai',
      repo: 'orca'
    })
  })

  it('probes additional PR repo candidates when the first lookup is not found', async () => {
    resolvePRRepositoryCandidatesMock.mockResolvedValueOnce({
      candidates: [
        { owner: 'fork', repo: 'orca' },
        { owner: 'stablyai', repo: 'orca' }
      ],
      headRepo: { owner: 'fork', repo: 'orca' }
    })
    getOwnerRepoForRemoteMock.mockResolvedValueOnce({ owner: 'fork', repo: 'orca' })
    ghExecFileAsyncMock
      .mockRejectedValueOnce(new Error('HTTP 404: Not Found'))
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          head: {
            ref: 'feature/test',
            repo: {
              full_name: 'fork/orca',
              name: 'orca',
              clone_url: 'https://github.com/fork/orca.git',
              ssh_url: 'git@github.com:fork/orca.git',
              owner: { login: 'fork' }
            }
          }
        })
      })

    await expect(getPullRequestPushTarget('/repo-root', 1849)).resolves.toEqual({
      pushTarget: {
        remoteName: 'origin',
        branchName: 'feature/test'
      }
    })
    expect(ghExecFileAsyncMock).toHaveBeenNthCalledWith(1, ['api', 'repos/fork/orca/pulls/1849'], {
      cwd: '/repo-root'
    })
    expect(ghExecFileAsyncMock).toHaveBeenNthCalledWith(
      2,
      ['api', 'repos/stablyai/orca/pulls/1849'],
      { cwd: '/repo-root' }
    )
  })
})
