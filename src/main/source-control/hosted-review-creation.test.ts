/* eslint-disable max-lines -- Why: hosted review creation permutations share large mocks; splitting would hide branch-specific expectations. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createGitHubPullRequestMock,
  getRepoSlugMock,
  ghExecFileAsyncMock,
  gitExecFileAsyncMock,
  getUpstreamStatusMock,
  getSshGitProviderMock
} = vi.hoisted(() => ({
  createGitHubPullRequestMock: vi.fn(),
  getRepoSlugMock: vi.fn(),
  ghExecFileAsyncMock: vi.fn(),
  gitExecFileAsyncMock: vi.fn(),
  getUpstreamStatusMock: vi.fn(),
  getSshGitProviderMock: vi.fn()
}))

vi.mock('../github/client', () => ({
  getRepoSlug: getRepoSlugMock
}))

vi.mock('../github/create-pr', () => ({
  createGitHubPullRequest: createGitHubPullRequestMock
}))

vi.mock('../github/gh-utils', () => ({
  acquire: vi.fn(),
  release: vi.fn(),
  ghExecFileAsync: ghExecFileAsyncMock,
  gitExecFileAsync: gitExecFileAsyncMock
}))

vi.mock('../git/upstream', () => ({
  getUpstreamStatus: getUpstreamStatusMock
}))

vi.mock('../providers/ssh-git-dispatch', () => ({
  getSshGitProvider: getSshGitProviderMock
}))

import { createHostedReview, getHostedReviewCreationEligibility } from './hosted-review-creation'

function resetMocks(): void {
  for (const mock of [
    createGitHubPullRequestMock,
    getRepoSlugMock,
    ghExecFileAsyncMock,
    gitExecFileAsyncMock,
    getUpstreamStatusMock,
    getSshGitProviderMock
  ]) {
    mock.mockReset()
  }
}

function mockGitHubProvider(): void {
  getRepoSlugMock.mockResolvedValue({ owner: 'acme', repo: 'orca' })
}

describe('createHostedReview', () => {
  beforeEach(() => {
    resetMocks()

    mockGitHubProvider()
    ghExecFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' })
    getUpstreamStatusMock.mockResolvedValue({
      hasUpstream: true,
      upstreamName: 'origin/feature',
      ahead: 0,
      behind: 0
    })
    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      if (args[0] === 'rev-parse') {
        return { stdout: 'feature\n', stderr: '' }
      }
      if (args[0] === 'status') {
        return { stdout: '', stderr: '' }
      }
      if (args[0] === 'log' && args.includes('--pretty=%s')) {
        return { stdout: 'Feature title\n', stderr: '' }
      }
      if (args[0] === 'log') {
        return { stdout: '- Feature title\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })
    createGitHubPullRequestMock.mockResolvedValue({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })
  })

  it('revalidates ahead commits before creating a GitHub pull request', async () => {
    getUpstreamStatusMock.mockResolvedValue({
      hasUpstream: true,
      upstreamName: 'origin/feature',
      ahead: 1,
      behind: 0
    })

    await expect(
      createHostedReview('/repo', {
        provider: 'github',
        base: 'main',
        head: 'feature',
        title: 'Feature'
      })
    ).resolves.toEqual({
      ok: false,
      code: 'validation',
      error: 'Create PR failed: push this branch before creating a pull request.'
    })
    expect(createGitHubPullRequestMock).not.toHaveBeenCalled()
  })

  it('rejects creation when the selected head is no longer checked out', async () => {
    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      if (args[0] === 'rev-parse') {
        return { stdout: 'other-branch\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })

    await expect(
      createHostedReview('/repo', {
        provider: 'github',
        base: 'main',
        head: 'feature',
        title: 'Feature'
      })
    ).resolves.toEqual({
      ok: false,
      code: 'validation',
      error: 'Create PR failed: switch back to the selected branch before creating a pull request.'
    })
    expect(createGitHubPullRequestMock).not.toHaveBeenCalled()
  })

  it('creates the pull request after fresh main-process validation passes', async () => {
    await expect(
      createHostedReview('/repo', {
        provider: 'github',
        base: 'main',
        head: 'feature',
        title: 'Feature'
      })
    ).resolves.toEqual({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })
    expect(createGitHubPullRequestMock).toHaveBeenCalledOnce()
  })

  it('routes local WSL git and GitHub review creation through the selected runtime', async () => {
    await expect(
      createHostedReview(
        '/repo',
        {
          provider: 'github',
          base: 'main',
          head: 'feature',
          title: 'Feature'
        },
        null,
        { localGitExecOptions: { wslDistro: 'Ubuntu' } }
      )
    ).resolves.toEqual({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })

    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: '/repo',
      wslDistro: 'Ubuntu'
    })
    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(
      ['status', '--porcelain'],
      expect.objectContaining({ cwd: '/repo', wslDistro: 'Ubuntu' })
    )
    expect(getUpstreamStatusMock).toHaveBeenCalledWith('/repo', undefined, {
      wslDistro: 'Ubuntu'
    })
    expect(getRepoSlugMock).toHaveBeenCalledWith('/repo', null, {
      localGitExecOptions: { wslDistro: 'Ubuntu' }
    })
    expect(ghExecFileAsyncMock).toHaveBeenCalledWith(
      ['auth', 'status', '--hostname', 'github.com'],
      { cwd: '/repo', wslDistro: 'Ubuntu' }
    )
    expect(createGitHubPullRequestMock).toHaveBeenCalledWith(
      '/repo',
      expect.objectContaining({ provider: 'github', head: 'feature' }),
      null,
      { localGitExecOptions: { wslDistro: 'Ubuntu' } }
    )
  })

  it('uses the SSH git provider for remote hosted-review preflight', async () => {
    const remoteGit = {
      getStatus: vi.fn(async () => ({ entries: [], conflictOperation: 'unknown' })),
      getUpstreamStatus: vi.fn(async () => ({
        hasUpstream: true,
        upstreamName: 'origin/feature',
        ahead: 0,
        behind: 0
      })),
      exec: vi.fn(async (args: string[]) => {
        if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref' && args[2] === 'HEAD') {
          return { stdout: 'feature\n', stderr: '' }
        }
        if (args[0] === 'log' && args.includes('--pretty=%s')) {
          return { stdout: 'Feature title\n', stderr: '' }
        }
        if (args[0] === 'log') {
          return { stdout: '- Feature title\n', stderr: '' }
        }
        return { stdout: '', stderr: '' }
      })
    }
    getSshGitProviderMock.mockReturnValue(remoteGit)

    await expect(
      createHostedReview(
        '/remote/repo',
        {
          provider: 'github',
          base: 'main',
          head: 'feature',
          title: 'Feature'
        },
        'ssh-1'
      )
    ).resolves.toEqual({
      ok: true,
      number: 12,
      url: 'https://github.com/acme/orca/pull/12'
    })

    expect(remoteGit.exec).toHaveBeenCalledWith(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      '/remote/repo'
    )
    expect(remoteGit.getStatus).toHaveBeenCalledWith('/remote/repo')
    expect(remoteGit.exec).not.toHaveBeenCalledWith(['status', '--porcelain'], '/remote/repo')
    expect(remoteGit.getUpstreamStatus).toHaveBeenCalledWith('/remote/repo')
    expect(remoteGit.exec).not.toHaveBeenCalledWith(
      ['rev-list', '--left-right', '--count', 'HEAD...@{u}'],
      '/remote/repo'
    )
    expect(getUpstreamStatusMock).not.toHaveBeenCalled()
    expect(ghExecFileAsyncMock).toHaveBeenCalledWith(
      ['auth', 'status', '--hostname', 'github.com'],
      {}
    )
    expect(createGitHubPullRequestMock).toHaveBeenCalledWith(
      '/remote/repo',
      {
        provider: 'github',
        base: 'main',
        head: 'feature',
        title: 'Feature'
      },
      'ssh-1'
    )
  })
})

describe('getHostedReviewCreationEligibility', () => {
  beforeEach(() => {
    resetMocks()

    mockGitHubProvider()
    ghExecFileAsyncMock.mockResolvedValue({ stdout: '', stderr: '' })
    gitExecFileAsyncMock.mockResolvedValue({ stdout: 'Feature title\n', stderr: '' })
  })

  it('treats short remote base refs as the default branch name', async () => {
    await expect(
      getHostedReviewCreationEligibility({
        repoPath: '/repo',
        branch: 'main',
        base: 'origin/main',
        hasUncommittedChanges: false,
        hasUpstream: true,
        ahead: 0,
        behind: 0
      })
    ).resolves.toMatchObject({
      canCreate: false,
      blockedReason: 'default_branch',
      defaultBaseRef: 'origin/main'
    })
  })

  it('blocks dirty tracked GitHub branches before PR creation', async () => {
    await expect(
      getHostedReviewCreationEligibility({
        repoPath: '/repo',
        branch: 'feature/create-pr',
        base: 'main',
        hasUncommittedChanges: true,
        hasUpstream: true,
        ahead: 0,
        behind: 0
      })
    ).resolves.toMatchObject({
      provider: 'github',
      canCreate: false,
      blockedReason: 'dirty',
      nextAction: 'commit',
      head: 'feature/create-pr'
    })
  })

  it('keeps dirty feature branches eligible for PR preparation', async () => {
    await expect(
      getHostedReviewCreationEligibility({
        repoPath: '/repo',
        branch: 'feature/create-pr',
        base: 'main',
        hasUncommittedChanges: true,
        hasUpstream: false,
        ahead: 0,
        behind: 0
      })
    ).resolves.toMatchObject({
      provider: 'github',
      canCreate: false,
      blockedReason: 'dirty',
      nextAction: 'commit',
      head: 'feature/create-pr'
    })
  })

  it('enables creation for clean, in-sync, authenticated GitHub feature branches', async () => {
    await expect(
      getHostedReviewCreationEligibility({
        repoPath: '/repo',
        branch: 'refs/heads/feature/create-pr',
        base: 'origin/main',
        hasUncommittedChanges: false,
        hasUpstream: true,
        ahead: 0,
        behind: 0
      })
    ).resolves.toMatchObject({
      provider: 'github',
      canCreate: true,
      blockedReason: null,
      nextAction: null,
      defaultBaseRef: 'origin/main',
      head: 'feature/create-pr'
    })
  })

  it('resolves remote eligibility through SSH repo metadata without generating PR copy', async () => {
    const remoteGit = {
      exec: vi.fn(async () => ({ stdout: '', stderr: '' }))
    }
    getSshGitProviderMock.mockReturnValue(remoteGit)

    await expect(
      getHostedReviewCreationEligibility({
        repoPath: '/remote/repo',
        connectionId: 'ssh-1',
        branch: 'feature/create-pr',
        base: 'origin/main',
        hasUncommittedChanges: false,
        hasUpstream: true,
        ahead: 0,
        behind: 0
      })
    ).resolves.toMatchObject({
      provider: 'github',
      canCreate: true,
      head: 'feature/create-pr'
    })

    expect(getRepoSlugMock).toHaveBeenCalledWith('/remote/repo', 'ssh-1')
    expect(remoteGit.exec).not.toHaveBeenCalled()
  })

  it('offers push as the next action for authenticated branches with local-only commits', async () => {
    await expect(
      getHostedReviewCreationEligibility({
        repoPath: '/repo',
        branch: 'feature/create-pr',
        base: 'main',
        hasUncommittedChanges: false,
        hasUpstream: true,
        ahead: 2,
        behind: 0
      })
    ).resolves.toMatchObject({
      canCreate: false,
      blockedReason: 'needs_push',
      nextAction: 'push'
    })
  })
})
