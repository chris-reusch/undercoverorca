import type { CheckStatus, PRConflictSummary, PRMergeableState, PRReviewDecision } from './types'

export type HostedReviewProvider =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure-devops'
  | 'gitea'
  | 'unsupported'

export type HostedReviewState = 'open' | 'closed' | 'merged' | 'draft'

export type HostedReviewInfo = {
  provider: HostedReviewProvider
  number: number
  title: string
  state: HostedReviewState
  url: string
  status: CheckStatus
  updatedAt: string
  mergeable: PRMergeableState
  reviewDecision?: PRReviewDecision | null
  autoMergeEnabled?: boolean
  autoMergeAllowed?: boolean | null
  mergeQueueRequired?: boolean | null
  mergeStateStatus?: string | null
  headSha?: string
  /** Target branch name for review-created worktree compare-base repair. */
  baseRefName?: string
  conflictSummary?: PRConflictSummary
}

export type HostedReviewForBranchArgs = {
  repoPath: string
  repoId?: string
  branch: string
  linkedGitHubPR?: number | null
  fallbackGitHubPR?: number | null
  linkedGitLabMR?: number | null
  linkedBitbucketPR?: number | null
  linkedAzureDevOpsPR?: number | null
  linkedGiteaPR?: number | null
}

export type HostedReviewSummary = {
  number?: number
  url: string
}

export type HostedReviewIdentity = {
  provider: HostedReviewProvider
  host: string
  owner: string
  repo: string
  number: number
}

export type HostedReviewUser = {
  login: string | null
  isBot?: boolean
}

export type HostedReviewDecision = 'approved' | 'changes_requested' | 'review_required' | null

export type HostedReviewThreadSummary = {
  unresolvedCount: number | null
  dataCompleteness?: 'full' | 'partial'
}

export type HostedReviewQueueSummary = {
  identity: HostedReviewIdentity
  title: string
  url: string
  state: HostedReviewState
  author: HostedReviewUser | null
  updatedAt: string
  lastViewedAt?: number
  mergeable: PRMergeableState
  mergeStateStatus?: string | null
  checksStatus: CheckStatus
  reviewDecision?: HostedReviewDecision
  threadSummary?: HostedReviewThreadSummary
  requestedReviewerLogins?: string[] | null
  draft?: boolean
}

export type HostedReviewQueueKey =
  | 'mine'
  | 'requested'
  | 'agent'
  | 'teammate'
  | 'needs-response'
  | 'ready-to-merge'

export type HostedReviewQueueState = 'mine' | 'requested' | 'agent' | 'teammate'

export type HostedReviewQueueClassification = {
  state: HostedReviewQueueState
  needsResponse: boolean
  readyToMerge: boolean
  requested: boolean
}
