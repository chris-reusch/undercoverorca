import { useState } from 'react'
import {
  AzureDevOpsIntegrationCard,
  BitbucketIntegrationCard,
  GiteaIntegrationCard,
  GitHubIntegrationCard,
  GitLabIntegrationCard
} from '@/components/settings/source-control-integration-cards'
import {
  IntegrationCardGroup,
  IntegrationCardPresentationProvider
} from '@/components/settings/integration-card-presentation'
import { useIntegrationProviderStatusRefresh } from '@/components/settings/use-integration-provider-status-refresh'
import { IntegrationStep } from './connect-integration-step'
import {
  deriveIntegrationFlowState,
  useIntegrationConnectionStatus
} from './use-integration-connection-status'
import { translate } from '@/i18n/i18n'

// Progressive two-step integration setup: first connect a code host for review
// status, then a task source. The order is a recommendation, not a gate — step
// 2 starts collapsed but opens on click. A connected code host (GitHub/GitLab)
// resolves step 2 on its own since its issues double as a task source.
// Done-state is driven by real provider connection status, never an
// optimistic click.
export function ConnectIntegrationsList(): React.JSX.Element {
  useIntegrationProviderStatusRefresh()
  const status = useIntegrationConnectionStatus()
  // Lets the done review step reopen inline via "Change" without losing its
  // connected state. Cleared once the user collapses it again.
  const [reviewReopened, setReviewReopened] = useState(false)

  // A code host doubles as a task source, so a connected GitHub/GitLab
  // resolves step 2 on its own.
  const flow = deriveIntegrationFlowState({
    reviewConnected: status.reviewConnected,
    trackerProviderName: status.trackerProviderName,
    codeHostTaskProviderName: status.codeHostTaskProviderName,
    trackerChecking: status.trackerChecking
  })
  const reviewDone = status.reviewConnected
  const trackerDone = status.trackerProviderName !== null
  const reviewExpanded = !reviewDone || reviewReopened
  const reviewCanToggle = reviewDone
  // User's explicit expand/collapse of step 2, snapshotted against the
  // connection state so a provider connecting (or disconnecting) restores the
  // default for the new state instead of keeping a stale manual choice.
  const [taskToggle, setTaskToggle] = useState<{
    expanded: boolean
    whenTrackerDone: boolean
    whenReviewDone: boolean
  } | null>(null)
  const taskToggleCurrent =
    taskToggle !== null &&
    taskToggle.whenTrackerDone === trackerDone &&
    taskToggle.whenReviewDone === reviewDone
  // Step 2 defaults collapsed while step 1 is still active (but opens on
  // click — review is not a prerequisite), and expands once review is done so
  // the code-host task sources are visible.
  const taskExpanded = taskToggleCurrent ? taskToggle.expanded : reviewDone && !trackerDone

  return (
    <IntegrationCardPresentationProvider value="setup-guide">
      <div className="space-y-2.5">
        <IntegrationStep
          index={0}
          state={flow.review}
          expanded={reviewExpanded}
          title={translate(
            'auto.components.feature.wall.ConnectIntegrationsList.review_step_title',
            'See PR status while agents work'
          )}
          description={translate(
            'auto.components.feature.wall.ConnectIntegrationsList.review_step_description',
            'Connect a review provider so Orca can show PR or MR status, checks, and reviews.'
          )}
          summary={
            <>
              <span className="font-semibold text-foreground">{status.reviewProviderName}</span>{' '}
              {translate(
                'auto.components.feature.wall.ConnectIntegrationsList.5b3577a492',
                'connected for review status'
              )}
            </>
          }
          onToggle={() => setReviewReopened((value) => !value)}
          canToggle={reviewCanToggle}
        >
          <IntegrationCardGroup>
            <GitHubIntegrationCard />
            <GitLabIntegrationCard />
            <BitbucketIntegrationCard />
            <AzureDevOpsIntegrationCard />
            <GiteaIntegrationCard />
          </IntegrationCardGroup>
        </IntegrationStep>

        <IntegrationStep
          index={1}
          state={flow.task}
          expanded={taskExpanded}
          title={translate(
            'auto.components.feature.wall.ConnectIntegrationsList.task_step_title',
            'Start agents on your tasks without leaving Orca'
          )}
          description={translate(
            'auto.components.feature.wall.ConnectIntegrationsList.33b650af52',
            'Connect where your team tracks work. Orca starts workspaces with the issue title, link, and context already attached.'
          )}
          summary={
            <>
              <span className="font-semibold text-foreground">
                {status.codeHostTaskProviderName}
              </span>{' '}
              {translate(
                'auto.components.feature.wall.ConnectIntegrationsList.code_host_tasks_summary',
                'issues available as tasks'
              )}
            </>
          }
          onToggle={() =>
            setTaskToggle({
              expanded: !taskExpanded,
              whenTrackerDone: trackerDone,
              whenReviewDone: reviewDone
            })
          }
        >
          <p className="px-1 pt-0.5 text-[12px] leading-snug text-muted-foreground">
            {translate(
              'auto.components.feature.wall.ConnectIntegrationsList.code_host_tasks_caption',
              "Your code host's issues work as tasks."
            )}
          </p>
          <IntegrationCardGroup>
            <GitHubIntegrationCard />
            <GitLabIntegrationCard />
          </IntegrationCardGroup>
        </IntegrationStep>
      </div>
    </IntegrationCardPresentationProvider>
  )
}
