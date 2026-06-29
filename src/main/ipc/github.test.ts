import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleMock,
  getRepoSlugMock,
  getRepoUpstreamMock,
  diagnoseGhAuthMock,
  getLocalProjectWorktreeGitOptionsMock
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  getRepoSlugMock: vi.fn(),
  getRepoUpstreamMock: vi.fn(),
  diagnoseGhAuthMock: vi.fn(),
  getLocalProjectWorktreeGitOptionsMock: vi.fn(() => ({}))
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock
  }
}))

vi.mock('../github/client', () => ({
  getRepoSlug: getRepoSlugMock,
  getRepoUpstream: getRepoUpstreamMock
}))

vi.mock('../github/auth-diagnose', () => ({
  diagnoseGhAuth: diagnoseGhAuthMock
}))

vi.mock('../project-runtime-git-options', () => ({
  getLocalProjectWorktreeGitOptions: getLocalProjectWorktreeGitOptionsMock
}))

import { registerGitHubHandlers } from './github'

type HandlerMap = Record<string, (_event: unknown, args: unknown) => unknown>

describe('registerGitHubHandlers', () => {
  const handlers: HandlerMap = {}
  let repos: { id: string; path: string; connectionId?: string | null }[] = []
  const store = {
    getRepos: () => repos
  }
  const stats = { hasCountedPR: () => false, record: vi.fn() }

  beforeEach(() => {
    handleMock.mockReset()
    getRepoSlugMock.mockReset()
    getRepoUpstreamMock.mockReset()
    diagnoseGhAuthMock.mockReset()
    getLocalProjectWorktreeGitOptionsMock.mockReset()
    getLocalProjectWorktreeGitOptionsMock.mockReturnValue({})
    for (const key of Object.keys(handlers)) {
      delete handlers[key]
    }
    repos = [{ id: 'repo-1', path: '/workspace/repo' }]
    handleMock.mockImplementation((channel: string, handler: HandlerMap[string]) => {
      handlers[channel] = handler
    })
    registerGitHubHandlers(store as never, stats as never)
  })

  it('registers only the gh-CLI-backed handlers', () => {
    expect(Object.keys(handlers).sort()).toEqual(
      ['gh:diagnoseAuth', 'gh:repoSlug', 'gh:repoUpstream'].sort()
    )
  })

  it('resolves the repo slug for a registered repo', async () => {
    getRepoSlugMock.mockResolvedValue({ owner: 'acme', repo: 'orca' })

    await expect(handlers['gh:repoSlug'](null, { repoPath: '/workspace/repo' })).resolves.toEqual({
      owner: 'acme',
      repo: 'orca'
    })
    expect(getRepoSlugMock).toHaveBeenCalledWith('/workspace/repo', null)
  })

  it('resolves the repo upstream for a registered repo', async () => {
    getRepoUpstreamMock.mockResolvedValue({ owner: 'stablyai', repo: 'orca' })

    await expect(
      handlers['gh:repoUpstream'](null, { repoPath: '/workspace/repo' })
    ).resolves.toEqual({ owner: 'stablyai', repo: 'orca' })
    expect(getRepoUpstreamMock).toHaveBeenCalledWith('/workspace/repo', null)
  })

  it('rejects unknown repository paths', () => {
    expect(() => handlers['gh:repoSlug'](null, { repoPath: '/not/registered' })).toThrow(
      'Access denied: unknown repository path'
    )
  })

  it('forwards diagnose calls to the client', async () => {
    diagnoseGhAuthMock.mockResolvedValue({ ok: true })

    await expect(handlers['gh:diagnoseAuth'](null, undefined)).resolves.toEqual({ ok: true })
  })
})
