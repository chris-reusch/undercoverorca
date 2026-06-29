import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRepoSlugMock, getPRForBranchMock } = vi.hoisted(() => ({
  getRepoSlugMock: vi.fn(),
  getPRForBranchMock: vi.fn()
}))

vi.mock('../github/client', () => ({
  getRepoSlug: getRepoSlugMock,
  getPRForBranch: getPRForBranchMock
}))

vi.mock('../github/create-pr', () => ({
  createGitHubPullRequest: vi.fn()
}))

import { getHostedReviewForBranch } from './hosted-review'

describe('getHostedReviewForBranch', () => {
  beforeEach(() => {
    getRepoSlugMock.mockReset()
    getPRForBranchMock.mockReset()
  })

  it('maps GitHub pull requests into the hosted review surface', async () => {
    getRepoSlugMock.mockResolvedValue({ owner: 'o', repo: 'r' })
    getPRForBranchMock.mockResolvedValue({
      number: 3,
      title: 'GitHub branch',
      state: 'open',
      url: 'https://github.com/o/r/pull/3',
      checksStatus: 'pending',
      updatedAt: '2026-05-10T00:00:00.000Z',
      mergeable: 'UNKNOWN'
    })

    await expect(
      getHostedReviewForBranch({
        repoPath: '/repo',
        branch: 'feature',
        linkedGitHubPR: 3
      })
    ).resolves.toMatchObject({
      provider: 'github',
      number: 3,
      status: 'pending'
    })
    expect(getPRForBranchMock).toHaveBeenCalledWith('/repo', 'feature', 3, undefined)
  })

  it('routes local WSL project branch lookup through the selected execution options', async () => {
    getRepoSlugMock.mockResolvedValue({ owner: 'o', repo: 'r' })
    getPRForBranchMock.mockResolvedValue({
      number: 9,
      title: 'GitHub WSL branch',
      state: 'open',
      url: 'https://github.com/o/r/pull/9',
      checksStatus: 'pending',
      updatedAt: '2026-06-16T00:00:00.000Z',
      mergeable: 'UNKNOWN'
    })

    await expect(
      getHostedReviewForBranch({
        repoPath: '/repo',
        branch: 'feature/wsl',
        linkedGitHubPR: 9,
        localGitExecOptions: { wslDistro: 'Ubuntu' }
      })
    ).resolves.toMatchObject({
      provider: 'github',
      number: 9,
      status: 'pending'
    })

    const executionOptions = { localGitExecOptions: { wslDistro: 'Ubuntu' } }
    expect(getRepoSlugMock).toHaveBeenCalledWith('/repo', undefined, executionOptions)
    expect(getPRForBranchMock).toHaveBeenCalledWith(
      '/repo',
      'feature/wsl',
      9,
      undefined,
      null,
      executionOptions
    )
  })

  it('uses fallback GitHub PR when branch is empty', async () => {
    getRepoSlugMock.mockResolvedValue({ owner: 'o', repo: 'r' })
    getPRForBranchMock.mockResolvedValue({
      number: 42,
      title: 'Detached GitHub branch',
      state: 'open',
      url: 'https://github.com/o/r/pull/42',
      checksStatus: 'success',
      updatedAt: '2026-05-10T00:00:00.000Z',
      mergeable: 'MERGEABLE'
    })

    await expect(
      getHostedReviewForBranch({
        repoPath: '/repo',
        branch: '',
        fallbackGitHubPR: 42
      })
    ).resolves.toMatchObject({
      provider: 'github',
      number: 42,
      status: 'success'
    })
    expect(getPRForBranchMock).toHaveBeenCalledWith('/repo', '', null, undefined, 42, {
      acceptMergedFallbackPR: true
    })
  })
})
