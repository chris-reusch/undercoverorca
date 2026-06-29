import type { RepoSlice } from './slices/repos'
import type { SparsePresetsSlice } from './slices/sparse-presets'
import type { WorktreeSlice } from './slices/worktrees'
import type { TerminalSlice } from './slices/terminals'
import type { TabsSlice } from './slices/tabs'
import type { UISlice } from './slices/ui'
import type { SettingsSlice } from './slices/settings'
import type { KeybindingsSlice } from './slices/keybindings'
import type { PreflightSlice } from './slices/preflight'
import type { EditorSlice } from './slices/editor'
import type { StatsSlice } from './slices/stats'
import type { MemorySlice } from './slices/memory'
import type { WorkspaceSpaceSlice } from './slices/workspace-space'
import type { BrowserSlice } from './slices/browser'
import type { SshSlice } from './slices/ssh'
import type { AgentStatusSlice } from './slices/agent-status'
import type { DiffCommentsSlice } from './slices/diffComments'
import type { DetectedAgentsSlice } from './slices/detected-agents'
import type { WorktreeNavHistorySlice } from './slices/worktree-nav-history'
import type { WorkspaceCleanupSlice } from './slices/workspace-cleanup'
import type { RuntimeStatusSlice } from './slices/runtime-status'
import type { CommitMessageGenerationSlice } from './slices/commit-message-generation'
import type { PinnedTabCloseConfirmSlice } from './slices/pinned-tab-close-confirm'

export type AppState = RepoSlice &
  SparsePresetsSlice &
  WorktreeSlice &
  TerminalSlice &
  TabsSlice &
  UISlice &
  SettingsSlice &
  KeybindingsSlice &
  PreflightSlice &
  EditorSlice &
  StatsSlice &
  MemorySlice &
  WorkspaceSpaceSlice &
  BrowserSlice &
  SshSlice &
  AgentStatusSlice &
  DiffCommentsSlice &
  DetectedAgentsSlice &
  WorktreeNavHistorySlice &
  WorkspaceCleanupSlice &
  RuntimeStatusSlice &
  CommitMessageGenerationSlice &
  PinnedTabCloseConfirmSlice
