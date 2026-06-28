// Plain launch / source unions describing where an agent launch or repo-add
// originated. Threaded as data through the launch flows. These previously lived
// in the telemetry-events module, which was removed in the privacy-hardened
// fork; nothing here is transmitted anywhere.
import type { AgentKind } from './agent-kind'

export type LaunchSource =
  | 'command_palette'
  | 'sidebar'
  | 'quick_command'
  | 'tab_bar_quick_launch'
  | 'task_page'
  | 'new_workspace_composer'
  | 'workspace_jump_palette'
  | 'shortcut'
  | 'onboarding'
  | 'diff_notes_send'
  | 'notes_send'
  | 'conflict_resolution'
  | 'source_control_recovery'
  | 'terminal_context_menu'
  | 'unknown'

export type RequestKind = 'new' | 'resume' | 'followup'

export type AddRepoExistingWorkspaceSource =
  | 'local_folder_picker'
  | 'runtime_server_path'
  | 'ssh_remote_path'
  | 'clone_url'
  | 'create_project'

export type AddRepoDefaultCheckoutHandoffSource =
  | 'local_folder_picker'
  | 'runtime_server_path'
  | 'ssh_remote_path'
  | 'clone_url'
  | 'create_project'
  | 'onboarding_open_folder'
  | 'onboarding_clone_url'
  | 'project_added_compat'

export type AddRepoDefaultCheckoutHandoffReason =
  | 'loaded_default_checkout'
  | 'detected_default_checkout'
  | 'no_authoritative_detection'
  | 'no_default_checkout'
  | 'show_detected_default_failed'
  | 'show_detected_linked_failed'
  | 'authoritative_refresh_failed'
  | 'linked_external_refresh_failed'
  | 'refreshed_default_missing'

// Agent launch attributes threaded into the PTY spawn path. Formerly the
// `agent_started` telemetry payload; retained as inert data, never transmitted.
export type AgentStartedTelemetry = {
  agent_kind: AgentKind
  launch_source: LaunchSource
  request_kind: RequestKind
  nth_repo_added?: number
}
