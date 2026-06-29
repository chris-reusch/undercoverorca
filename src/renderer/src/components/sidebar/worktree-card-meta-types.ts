import type { IssueInfo } from '../../../../shared/types'
import type { HostedReviewInfo } from '../../../../shared/hosted-review'
import type { WorktreeCardDetailsHoverControl } from './worktree-card-details-hover-state'

// Why: the PR/hosted-review fetch+display module was removed in the card
// teardown. The inert display shape stays here so the hover/detail components
// that still type a `review` prop keep compiling without that deleted module.
export type WorktreeCardPrDisplay =
  | HostedReviewInfo
  | {
      provider: Exclude<HostedReviewInfo['provider'], 'unsupported'>
      number: number
      title: string
      state?: HostedReviewInfo['state']
      url?: string
      status?: HostedReviewInfo['status']
    }

export type WorktreeCardIssueDisplay =
  | IssueInfo
  | {
      number: number
      title: string
      state?: IssueInfo['state']
      url?: string
      labels?: string[]
    }

export type WorktreeCardMetaBadgesProps = {
  issue: WorktreeCardIssueDisplay | null
  review: WorktreeCardPrDisplay | null
  comment: string | null
}

export type WorktreeCardMetaBadgesRootProps = WorktreeCardMetaBadgesProps &
  React.HTMLAttributes<HTMLDivElement>

export type WorktreeCardDetailsHoverProps = WorktreeCardMetaBadgesProps & {
  children: React.ReactElement
  branchName?: string
  workspaceTitle?: string
  identityOrder?: 'workspace-first' | 'branch-first'
  detailsAfter?: React.ReactNode
  openDelay?: number
  closeDelay?: number
  onEditIssue?: (event: React.MouseEvent) => void
  onEditComment?: (event: React.MouseEvent) => void
  onOpenGitHubIssueInOrca?: (event: React.MouseEvent) => void
  onOpenReviewInOrca?: (event: React.MouseEvent) => void
  onUnlinkReview?: () => void
  hoverControl?: WorktreeCardDetailsHoverControl
}
