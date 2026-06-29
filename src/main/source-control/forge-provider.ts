import type {
  CreateHostedReviewInput,
  CreateHostedReviewResult,
  HostedReviewProvider
} from '../../shared/hosted-review'
import { getRepoSlug } from '../github/client'
import { createGitHubPullRequest } from '../github/create-pr'
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

export type ForgeProvider = {
  id: ForgeProviderId
  supportsReviewCreation: boolean
  resolveRepository(context: ForgeProviderRepositoryContext): Promise<unknown | null>
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
