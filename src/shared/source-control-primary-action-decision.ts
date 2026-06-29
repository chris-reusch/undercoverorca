import { shouldForcePushWithLeaseForUpstream } from './git-upstream-status'
import { resolveSourceControlPrimaryActionDuringRemoteOp } from './source-control-primary-action-in-flight'
import type {
  SourceControlPrimaryActionDecision,
  SourceControlPrimaryActionDecisionInputs
} from './source-control-primary-action-decision-types'
import { resolveUnpublishedSourceControlPrimaryAction } from './source-control-primary-unpublished-action'

export type {
  SourceControlPrimaryActionKind,
  SourceControlRemoteOpKind,
  SourceControlPrimaryActionDecision,
  SourceControlPrimaryActionDecisionInputs
} from './source-control-primary-action-decision-types'

export function resolveSourceControlPrimaryActionDecision(
  inputs: SourceControlPrimaryActionDecisionInputs
): SourceControlPrimaryActionDecision {
  const {
    stagedCount,
    hasUnstagedChanges,
    hasStageableChanges,
    hasMessage,
    hasUnresolvedConflicts,
    isCommitting,
    isRemoteOperationActive,
    upstreamStatus,
    prState,
    isPRStateLoading,
    branchCommitsAhead,
    hasCurrentBranch = true,
    canPushLinkedReviewWithoutUpstream = false
  } = inputs

  if (isCommitting) {
    return {
      kind: 'commit',
      labelIntent: 'commit',
      titleIntent: 'commit_in_progress',
      disabled: true
    }
  }

  if (isRemoteOperationActive) {
    return resolveSourceControlPrimaryActionDuringRemoteOp(
      inputs,
      resolveSourceControlPrimaryActionDecision
    )
  }

  if (hasUnresolvedConflicts) {
    return {
      kind: 'commit',
      labelIntent: 'commit',
      titleIntent: 'resolve_conflicts_before_commit',
      disabled: true
    }
  }

  const hasStaged = stagedCount > 0
  const hasOpenHostedReview = prState === 'open' || prState === 'draft'

  if (hasStaged && hasMessage) {
    return {
      kind: 'commit',
      labelIntent: 'commit',
      titleIntent: 'commit_staged_changes',
      disabled: false
    }
  }

  if (hasStaged && !hasMessage) {
    return {
      kind: 'commit',
      labelIntent: 'commit',
      titleIntent: 'enter_commit_message',
      disabled: true
    }
  }

  if (!hasStaged && hasStageableChanges) {
    return {
      kind: 'stage',
      labelIntent: 'stage',
      titleIntent: 'stage_all_changes',
      disabled: false
    }
  }

  if (!upstreamStatus) {
    return {
      kind: 'commit',
      labelIntent: 'commit',
      titleIntent: 'stage_file_to_commit',
      disabled: true
    }
  }

  if (!upstreamStatus.hasUpstream) {
    const unpublishedAction = resolveUnpublishedSourceControlPrimaryAction({
      hasCurrentBranch,
      isPRStateLoading,
      prState
    })

    if (unpublishedAction.kind === 'publish') {
      const linkedReviewAction = resolveLinkedReviewSourceControlPrimaryAction({
        hasOpenHostedReview,
        canPushLinkedReviewWithoutUpstream
      })
      if (linkedReviewAction) {
        return linkedReviewAction
      }
    }

    return unpublishedAction
  }

  if (upstreamStatus.ahead > 0 && upstreamStatus.behind > 0) {
    if (shouldForcePushWithLeaseForUpstream(upstreamStatus)) {
      return {
        kind: 'push',
        labelIntent: 'force_push',
        titleIntent: 'force_push_with_lease',
        disabled: false,
        count: branchCommitsAhead,
        upstreamName: upstreamStatus.upstreamName,
        requiresForceWithLease: true
      }
    }
    return {
      kind: 'sync',
      labelIntent: 'sync',
      titleIntent: 'sync_counts',
      disabled: false,
      ahead: upstreamStatus.ahead,
      behind: upstreamStatus.behind
    }
  }

  if (upstreamStatus.behind > 0) {
    return {
      kind: 'pull',
      labelIntent: 'pull',
      titleIntent: 'pull_count',
      disabled: false,
      count: upstreamStatus.behind
    }
  }

  if (upstreamStatus.ahead > 0) {
    return {
      kind: 'push',
      labelIntent: 'push',
      titleIntent: 'push_count',
      disabled: false,
      count: upstreamStatus.ahead
    }
  }

  return {
    kind: 'commit',
    labelIntent: 'commit',
    titleIntent: hasUnstagedChanges ? 'stage_file_to_commit' : 'nothing_to_commit_up_to_date',
    disabled: true
  }
}

export function resolveSourceControlCommitAreaPrimaryActionDecision(
  inputs: SourceControlPrimaryActionDecisionInputs
): SourceControlPrimaryActionDecision {
  return resolveSourceControlPrimaryActionDecision(inputs)
}

function resolveLinkedReviewSourceControlPrimaryAction(args: {
  hasOpenHostedReview: boolean
  canPushLinkedReviewWithoutUpstream: boolean
}): SourceControlPrimaryActionDecision | null {
  if (!args.hasOpenHostedReview) {
    return null
  }
  if (args.canPushLinkedReviewWithoutUpstream) {
    return {
      kind: 'push',
      labelIntent: 'push',
      titleIntent: 'push_linked_review',
      disabled: false
    }
  }
  return {
    kind: 'commit',
    labelIntent: 'commit',
    titleIntent: 'linked_review_target_unavailable',
    disabled: true
  }
}
