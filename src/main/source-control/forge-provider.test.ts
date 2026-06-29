import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createGitHubPullRequestMock, getRepoSlugMock } = vi.hoisted(() => ({
  createGitHubPullRequestMock: vi.fn(),
  getRepoSlugMock: vi.fn()
}))

vi.mock('../github/client', () => ({
  getRepoSlug: getRepoSlugMock
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
})
