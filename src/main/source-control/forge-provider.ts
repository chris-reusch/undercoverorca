import type {
  CreateHostedReviewInput,
  CreateHostedReviewResult,
  HostedReviewInfo,
  HostedReviewProvider
} from '../../shared/hosted-review'
import { getPRForBranch, getRepoSlug } from '../github/client'
import { createGitHubPullRequest } from '../github/create-pr'
import { mapGitHubReview } from './forge-review-mappers'
import {
  hasHostedReviewLocalGitOptions,
  getHostedReviewLocalGitOptions,
  type HostedReviewExecutionOptions
} from './hosted-review-git-options'

export type ForgeProviderId = Exclude<HostedReviewProvider, 'unsupported'>

export type ForgeProviderRepositoryContext = HostedReviewExecutionOptions & {
  repoPath: string
  connectionId?: string | null
}

export type ForgeReviewForBranchInput = ForgeProviderRepositoryContext & {
  branch: string
  linkedReviewNumber?: number | null
  fallbackReviewNumber?: number | null
}

export type ForgeReviewByNumberInput = ForgeProviderRepositoryContext & {
  number: number
}

export type ForgeProvider = {
  id: ForgeProviderId
  supportsReviewCreation: boolean
  resolveRepository(context: ForgeProviderRepositoryContext): Promise<unknown | null>
  getReviewForBranch(input: ForgeReviewForBranchInput): Promise<HostedReviewInfo | null>
  getReviewByNumber(input: ForgeReviewByNumberInput): Promise<HostedReviewInfo | null>
  createReview?(
    repoPath: string,
    input: CreateHostedReviewInput,
    connectionId?: string | null,
    options?: HostedReviewExecutionOptions
  ): Promise<CreateHostedReviewResult>
}

function hostedReviewExecutionArgs(
  options: HostedReviewExecutionOptions
): [] | [HostedReviewExecutionOptions] {
  return hasHostedReviewLocalGitOptions(options)
    ? [{ localGitExecOptions: getHostedReviewLocalGitOptions(options) }]
    : []
}

const gitHubForgeProvider = {
  id: 'github',
  supportsReviewCreation: true,
  resolveRepository: (context) =>
    getRepoSlug(context.repoPath, context.connectionId, ...hostedReviewExecutionArgs(context)),
  async getReviewForBranch(input) {
    const fallbackReviewNumber =
      input.linkedReviewNumber == null ? (input.fallbackReviewNumber ?? null) : null
    const executionArgs = hostedReviewExecutionArgs(input)
    const pr =
      fallbackReviewNumber !== null
        ? await getPRForBranch(
            input.repoPath,
            input.branch,
            input.linkedReviewNumber ?? null,
            input.connectionId,
            fallbackReviewNumber,
            {
              ...executionArgs[0],
              acceptMergedFallbackPR: true
            }
          )
        : executionArgs.length > 0
          ? await getPRForBranch(
              input.repoPath,
              input.branch,
              input.linkedReviewNumber ?? null,
              input.connectionId,
              null,
              ...executionArgs
            )
          : await getPRForBranch(
              input.repoPath,
              input.branch,
              input.linkedReviewNumber ?? null,
              input.connectionId
            )
    return pr ? mapGitHubReview(pr) : null
  },
  async getReviewByNumber(input) {
    const executionArgs = hostedReviewExecutionArgs(input)
    const pr =
      executionArgs.length > 0
        ? await getPRForBranch(
            input.repoPath,
            '',
            input.number,
            input.connectionId,
            null,
            ...executionArgs
          )
        : await getPRForBranch(input.repoPath, '', input.number, input.connectionId)
    return pr ? mapGitHubReview(pr) : null
  },
  createReview: createGitHubPullRequest
} satisfies ForgeProvider

export const FORGE_PROVIDERS = [gitHubForgeProvider] as const satisfies readonly ForgeProvider[]

export function getForgeProviderById(id: ForgeProviderId): ForgeProvider {
  return FORGE_PROVIDERS.find((provider) => provider.id === id) ?? gitHubForgeProvider
}

export async function getForgeProviderForRepository(
  context: ForgeProviderRepositoryContext
): Promise<ForgeProvider | null> {
  for (const provider of FORGE_PROVIDERS) {
    if (await provider.resolveRepository(context)) {
      return provider
    }
  }
  return null
}

export async function detectHostedReviewProvider(
  context: ForgeProviderRepositoryContext
): Promise<HostedReviewProvider> {
  return (await getForgeProviderForRepository(context))?.id ?? 'unsupported'
}
