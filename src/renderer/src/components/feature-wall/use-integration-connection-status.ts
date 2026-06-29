import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'

export type IntegrationStepState = 'active' | 'done' | 'upcoming'

// Pure derivation of the two-step flow's step states from connection facts,
// extracted so the progressive logic is testable without the store or DOM.
// `codeHostTaskConnected` means a connected code host whose issues double as
// a task source (GitHub/GitLab), which resolves step 2 without a tracker.
export function deriveIntegrationStepStates(input: {
  reviewConnected: boolean
  trackerConnected: boolean
  codeHostTaskConnected: boolean
}): { review: IntegrationStepState; task: IntegrationStepState; complete: boolean } {
  const review: IntegrationStepState = input.reviewConnected ? 'done' : 'active'
  // A dedicated tracker resolves tasks outright. The code host only counts
  // once review is connected, since step 2 is unreachable before then.
  const taskResolved =
    input.trackerConnected || (input.reviewConnected && input.codeHostTaskConnected)
  const task: IntegrationStepState = taskResolved
    ? 'done'
    : input.reviewConnected
      ? 'active'
      : 'upcoming'
  return { review, task, complete: input.reviewConnected && taskResolved }
}

export function deriveIntegrationFlowState(input: {
  reviewConnected: boolean
  trackerProviderName: null
  codeHostTaskProviderName: 'GitHub' | 'GitLab' | null
  trackerChecking: boolean
}): {
  review: IntegrationStepState
  task: IntegrationStepState
  complete: boolean
  taskResolved: boolean
} {
  const trackerConnected = input.trackerProviderName !== null
  // The code host resolves the task step only after dedicated tracker facts
  // have settled for this runtime, so the collapsed summary names the right
  // completion reason instead of flashing the code-host fallback copy.
  const codeHostTaskReady = input.codeHostTaskProviderName !== null && !input.trackerChecking
  const stepStates = deriveIntegrationStepStates({
    reviewConnected: input.reviewConnected,
    trackerConnected,
    codeHostTaskConnected: codeHostTaskReady
  })
  return {
    ...stepStates,
    taskResolved: stepStates.task === 'done'
  }
}

type CliStatus = {
  installed?: boolean
  authenticated?: boolean
}

type BitbucketStatus = {
  configured?: boolean
  authenticated?: boolean
}

type TokenReviewStatus = {
  configured?: boolean
  authenticated?: boolean
  baseUrl?: string | null
  tokenConfigured?: boolean
}

type ProviderStatusFacts = {
  preflightStatus: {
    gh?: CliStatus
    glab?: CliStatus
    bitbucket?: BitbucketStatus
    azureDevOps?: TokenReviewStatus
    gitea?: TokenReviewStatus
  } | null
  preflightStatusChecked: boolean
  preflightStatusContextKey: string | null
  preflightStatusError: string | null
  preflightStatusLoading: boolean
  expectedPreflightContextKey: string
}

export type IntegrationConnectionStatus = {
  // True once any review provider is connected/configured for this context.
  reviewConnected: boolean
  // Display name of the connected review provider, or null while none is.
  reviewProviderName: 'GitHub' | 'GitLab' | 'Bitbucket' | 'Azure DevOps' | 'Gitea' | null
  // GitHub/GitLab issues can double as tasks; token/env review providers do not.
  codeHostTaskProviderName: 'GitHub' | 'GitLab' | null
  // True once any task source is usable. Only code hosts (their issues double
  // as a task source) remain after dedicated trackers were removed.
  trackerConnected: boolean
  // No dedicated trackers remain; always null. Code hosts are surfaced via
  // reviewProviderName.
  trackerProviderName: null
  // Every connected task source, for "GitHub and GitLab connected for tasks"
  // summaries that don't under-report what's usable.
  taskSourceNames: ('GitHub' | 'GitLab')[]
  // True while the code-host check is unresolved, stale, loading, or errored.
  reviewChecking: boolean
  // No dedicated trackers remain, so this is always false.
  trackerChecking: boolean
  // True until the underlying provider checks have resolved for this surface.
  // Callers should treat unknown state as "not connected yet" rather than
  // flashing summaries.
  checking: boolean
}

function isBitbucketReviewConnected(status: BitbucketStatus | undefined): boolean {
  return status?.configured === true && status.authenticated === true
}

function isAzureDevOpsReviewConfigured(status: TokenReviewStatus | undefined): boolean {
  if (status?.configured !== true) {
    return false
  }
  if (status.tokenConfigured === true && status.baseUrl && status.authenticated !== true) {
    return false
  }
  return true
}

function isGiteaReviewConfigured(status: TokenReviewStatus | undefined): boolean {
  if (status?.configured !== true) {
    return false
  }
  if (status.tokenConfigured === true && status.authenticated !== true) {
    return false
  }
  return true
}

export function deriveIntegrationConnectionStatus(
  facts: ProviderStatusFacts
): IntegrationConnectionStatus {
  const preflightCurrent = facts.preflightStatusContextKey === facts.expectedPreflightContextKey
  const reviewChecking =
    facts.preflightStatusLoading || !facts.preflightStatusChecked || !preflightCurrent
  const reviewReadyForConnection = !reviewChecking && facts.preflightStatusError === null
  const githubConnected =
    reviewReadyForConnection &&
    facts.preflightStatus?.gh?.installed === true &&
    facts.preflightStatus.gh.authenticated === true
  const gitlabConnected =
    reviewReadyForConnection &&
    facts.preflightStatus?.glab?.installed === true &&
    facts.preflightStatus.glab.authenticated === true
  const bitbucketConnected =
    reviewReadyForConnection && isBitbucketReviewConnected(facts.preflightStatus?.bitbucket)
  const azureDevOpsConnected =
    reviewReadyForConnection && isAzureDevOpsReviewConfigured(facts.preflightStatus?.azureDevOps)
  const giteaConnected =
    reviewReadyForConnection && isGiteaReviewConfigured(facts.preflightStatus?.gitea)

  const reviewProviderName = githubConnected
    ? 'GitHub'
    : gitlabConnected
      ? 'GitLab'
      : bitbucketConnected
        ? 'Bitbucket'
        : azureDevOpsConnected
          ? 'Azure DevOps'
          : giteaConnected
            ? 'Gitea'
            : null
  const codeHostTaskProviderName = githubConnected ? 'GitHub' : gitlabConnected ? 'GitLab' : null
  const trackerProviderName = null
  const taskSourceNames: IntegrationConnectionStatus['taskSourceNames'] = [
    ...(githubConnected ? (['GitHub'] as const) : []),
    ...(gitlabConnected ? (['GitLab'] as const) : [])
  ]
  const hasUsableTaskSource = taskSourceNames.length > 0
  // No dedicated trackers remain, so the task step depends solely on code hosts.
  const trackerChecking = false

  return {
    reviewConnected:
      githubConnected ||
      gitlabConnected ||
      bitbucketConnected ||
      azureDevOpsConnected ||
      giteaConnected,
    reviewProviderName,
    codeHostTaskProviderName,
    trackerConnected: hasUsableTaskSource,
    trackerProviderName,
    taskSourceNames,
    reviewChecking,
    trackerChecking,
    checking: !hasUsableTaskSource && (reviewChecking || trackerChecking)
  }
}

// Derives the two-step progressive flow's done-state from real provider
// connection status, mirroring use-feature-wall-task-source-presentation so a
// code host counts as both a review source and a task source.
export function useIntegrationConnectionStatus(): IntegrationConnectionStatus {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusContextKey = useAppStore((s) => s.preflightStatusContextKey)
  const preflightStatusError = useAppStore((s) => s.preflightStatusError)
  const preflightStatusLoading = useAppStore((s) => s.preflightStatusLoading)
  const expectedPreflightContextKey = useAppStore((s) =>
    localPreflightContextKey(getLocalPreflightContext(s))
  )

  return deriveIntegrationConnectionStatus({
    preflightStatus,
    preflightStatusChecked,
    preflightStatusContextKey,
    preflightStatusError,
    preflightStatusLoading,
    expectedPreflightContextKey
  })
}
