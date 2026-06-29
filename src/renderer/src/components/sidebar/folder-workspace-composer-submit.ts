import { CLIENT_PLATFORM, ensureAgentStartupInTerminal } from '@/lib/new-workspace'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { buildAgentStartupPlan } from '@/lib/tui-agent-startup'
import { tuiAgentToAgentKind } from '../../../../shared/agent-kind'
import { activateAndRevealFolderWorkspace } from '@/lib/worktree-activation'
import { TUI_AGENT_CONFIG } from '../../../../shared/tui-agent-config'
import { isWindowsAbsolutePathLike } from '../../../../shared/cross-platform-path'
import type { FolderWorkspace, ProjectGroup, TuiAgent } from '../../../../shared/types'
import { isWslUncPath } from '../../../../shared/wsl-paths'
import type { LaunchSource } from '../../../../shared/agent-launch-source'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'

type FolderWorkspaceCreateInput = {
  projectGroupId: string
  name: string
  connectionId?: string | null
  linkedTask: FolderWorkspace['linkedTask']
  createdWithAgent?: TuiAgent
  pendingFirstAgentMessageRename?: boolean
}

type SubmitFolderWorkspaceCreateParams = {
  projectGroup: ProjectGroup
  name: string
  note: string
  quickAgent: TuiAgent | null
  autoRenameBranchFromWork: boolean | undefined
  agentCmdOverrides: Record<string, string> | undefined
  agentArgs?: string | null
  agentEnv?: Record<string, string>
  launchSource?: LaunchSource
  runtimeEnvironmentId?: string | null
  createFolderWorkspace: (input: FolderWorkspaceCreateInput) => Promise<FolderWorkspace | null>
  onOpenChange: (open: boolean) => void
}

export function getFolderWorkspaceAgentLaunchPlatform(
  projectGroup: Pick<ProjectGroup, 'connectionId' | 'parentPath'>
): NodeJS.Platform {
  const parentPath = projectGroup.parentPath?.trim() ?? ''
  if (projectGroup.connectionId) {
    return isWindowsAbsolutePathLike(parentPath) ? 'win32' : 'linux'
  }
  return parentPath && isWslUncPath(parentPath) ? 'linux' : CLIENT_PLATFORM
}

async function preflightFolderWorkspaceAgentTrust(args: {
  agent: TuiAgent | null
  workspacePath: string | null
  connectionId?: string | null
}): Promise<void> {
  if (!args.agent || !window.api.agentTrust?.markTrusted) {
    return
  }
  const preflight = TUI_AGENT_CONFIG[args.agent].preflightTrust
  if (!preflight || !args.workspacePath) {
    return
  }
  try {
    await window.api.agentTrust.markTrusted({
      preset: preflight,
      workspacePath: args.workspacePath,
      ...(args.connectionId ? { connectionId: args.connectionId } : {})
    })
  } catch {
    // Best-effort: the user can still accept the agent trust prompt manually.
  }
}

export async function submitFolderWorkspaceCreate({
  projectGroup,
  name,
  note,
  quickAgent,
  autoRenameBranchFromWork,
  agentCmdOverrides,
  agentArgs,
  agentEnv,
  launchSource = 'sidebar',
  runtimeEnvironmentId = null,
  createFolderWorkspace,
  onOpenChange
}: SubmitFolderWorkspaceCreateParams): Promise<boolean> {
  const workspaceName = name.trim() || `${projectGroup.name} workspace`
  const launchPlatform = getFolderWorkspaceAgentLaunchPlatform(projectGroup)
  const startupPlan = quickAgent
    ? buildAgentStartupPlan({
        agent: quickAgent,
        prompt: note,
        cmdOverrides: agentCmdOverrides ?? {},
        agentArgs,
        agentEnv,
        platform: launchPlatform,
        allowEmptyPromptLaunch: true
      })
    : null
  // Why: the pending badge should only appear when the submitted prompt can
  // actually produce the first agent message that names the workspace.
  const pendingFirstAgentMessageRename =
    autoRenameBranchFromWork === true &&
    !name.trim() &&
    Boolean(quickAgent) &&
    note.trim().length > 0

  const workspace = await createFolderWorkspace({
    projectGroupId: projectGroup.id,
    name: workspaceName,
    // Why: SSH folder groups must keep their target provenance even when the
    // focused runtime is local or another host.
    connectionId: projectGroup.connectionId ?? null,
    linkedTask: null,
    ...(quickAgent ? { createdWithAgent: quickAgent } : {}),
    ...(pendingFirstAgentMessageRename ? { pendingFirstAgentMessageRename: true } : {})
  })
  if (!workspace) {
    return false
  }
  await preflightFolderWorkspaceAgentTrust({
    agent: quickAgent,
    workspacePath: workspace.folderPath,
    connectionId: workspace.connectionId ?? projectGroup.connectionId
  })
  if (startupPlan && !startupPlan.launchToken) {
    // Why: delayed delivery must target the exact pane spawned from this queued
    // startup, so both halves share one renderer-session token.
    startupPlan.launchToken = createBrowserUuid()
  }

  const startup =
    quickAgent && startupPlan
      ? {
          command: startupPlan.launchCommand,
          ...(startupPlan.env ? { env: startupPlan.env } : {}),
          launchConfig: startupPlan.launchConfig,
          ...(startupPlan.launchToken ? { launchToken: startupPlan.launchToken } : {}),
          launchAgent: quickAgent,
          ...(startupPlan.startupCommandDelivery
            ? { startupCommandDelivery: startupPlan.startupCommandDelivery }
            : {}),
          telemetry: {
            agent_kind: tuiAgentToAgentKind(quickAgent),
            launch_source: launchSource,
            request_kind: 'new' as const
          }
        }
      : undefined
  onOpenChange(false)
  try {
    const activation = activateAndRevealFolderWorkspace(workspace.id, {
      ...(startup ? { startup } : {}),
      runtimeEnvironmentId
    })
    if (
      startupPlan &&
      (startupPlan.followupPrompt || startupPlan.draftPrompt) &&
      activation !== false
    ) {
      void ensureAgentStartupInTerminal({
        worktreeId: folderWorkspaceKey(workspace.id),
        primaryTabId: activation.primaryTabId,
        startup: startupPlan
      })
    }
  } catch (error) {
    // Why: creation already succeeded. Do not leave the completed create modal
    // open if the follow-up reveal/startup path hits a transient issue.
    console.error('Failed to activate folder workspace after create:', error)
  }
  return true
}
