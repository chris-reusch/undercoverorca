import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createGitHubPullRequestMock, getPRForBranchMock, getRepoSlugMock } = vi.hoisted(() => ({
  createGitHubPullRequestMock: vi.fn(),
  getPRForBranchMock: vi.fn(),
  getRepoSlugMock: vi.fn()
}))

vi.mock('../github/client', () => ({
  getRepoSlug: getRepoSlugMock,
  getPRForBranch: getPRForBranchMock
}))

vi.mock('../github/create-pr', () => ({
  createGitHubPullRequest: createGitHubPullRequestMock
}))

import {
  FORGE_PROVIDERS,
  detectHostedReviewProvider,
  getForgeProviderById,
  getForgeProviderForRepository
} from './forge-provider'

describe('forge provider interface', () => {
  beforeEach(() => {
    createGitHubPullRequestMock.mockReset()
    getPRForBranchMock.mockReset()
    getRepoSlugMock.mockReset()
  })

  it('detects GitHub as the only hosted provider', async () => {
    getRepoSlugMock.mockResolvedValue({ owner: 'team', repo: 'orca' })

    await expect(detectHostedReviewProvider({ repoPath: '/repo' })).resolves.toBe('github')
    await expect(getForgeProviderForRepository({ repoPath: '/repo' })).resolves.toMatchObject({
      id: 'github'
    })
  })

  it('exposes GitHub review creation capability', async () => {
    expect(
      FORGE_PROVIDERS.map((provider) => [provider.id, provider.supportsReviewCreation])
    ).toEqual([['github', true]])
    createGitHubPullRequestMock.mockResolvedValue({
      ok: true,
      number: 12,
      url: 'https://github.com/team/orca/pull/12'
    })

    const provider = getForgeProviderById('github')
    await expect(
      provider.createReview?.('/repo', {
        provider: 'github',
        base: 'main',
        head: 'feature/provider-interface',
        title: 'Add provider interface'
      })
    ).resolves.toEqual({
      ok: true,
      number: 12,
      url: 'https://github.com/team/orca/pull/12'
    })
    expect(createGitHubPullRequestMock).toHaveBeenCalledWith('/repo', {
      provider: 'github',
      base: 'main',
      head: 'feature/provider-interface',
      title: 'Add provider interface'
    })
  })

  it('adapts GitHub branch lookup through the shared provider contract', async () => {
    getPRForBranchMock.mockResolvedValue({
      number: 7,
      title: 'Provider branch',
      state: 'open',
      url: 'https://github.com/team/orca/pull/7',
      checksStatus: 'success',
      updatedAt: '2026-05-29T00:00:00.000Z',
      mergeable: 'MERGEABLE'
    })

    await expect(
      getForgeProviderById('github').getReviewForBranch({
        repoPath: '/repo',
        connectionId: 'ssh-1',
        branch: '',
        fallbackReviewNumber: 7
      })
    ).resolves.toMatchObject({
      provider: 'github',
      number: 7,
      status: 'success'
    })
    expect(getPRForBranchMock).toHaveBeenCalledWith('/repo', '', null, 'ssh-1', 7, {
      acceptMergedFallbackPR: true
    })
  })
})
