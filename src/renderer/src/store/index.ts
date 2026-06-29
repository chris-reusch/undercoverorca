import { create } from 'zustand'
import type { AppState } from './types'
import { createRepoSlice } from './slices/repos'
import { createSparsePresetsSlice } from './slices/sparse-presets'
import { createWorktreeSlice } from './slices/worktrees'
import { createTerminalSlice } from './slices/terminals'
import { createTabsSlice } from './slices/tabs'
import { createUISlice } from './slices/ui'
import { createSettingsSlice } from './slices/settings'
import { createKeybindingsSlice } from './slices/keybindings'
import { createPreflightSlice } from './slices/preflight'
import { createEditorSlice } from './slices/editor'
import { createStatsSlice } from './slices/stats'
import { createMemorySlice } from './slices/memory'
import { createWorkspaceSpaceSlice } from './slices/workspace-space'
import { createBrowserSlice } from './slices/browser'
import { createSshSlice } from './slices/ssh'
import { createAgentStatusSlice } from './slices/agent-status'
import { createDiffCommentsSlice } from './slices/diffComments'
import { createDetectedAgentsSlice } from './slices/detected-agents'
import { createWorktreeNavHistorySlice } from './slices/worktree-nav-history'
import { createDictationSlice } from './slices/dictation'
import { createWorkspaceCleanupSlice } from './slices/workspace-cleanup'
import { createRuntimeStatusSlice } from './slices/runtime-status'
import { createCommitMessageGenerationSlice } from './slices/commit-message-generation'
import { createPinnedTabCloseConfirmSlice } from './slices/pinned-tab-close-confirm'
import { e2eConfig } from '@/lib/e2e-config'
import { registerHttpLinkStoreAccessor } from '@/lib/http-link-routing'

export const useAppStore = create<AppState>()((...a) => ({
  ...createRepoSlice(...a),
  ...createSparsePresetsSlice(...a),
  ...createWorktreeSlice(...a),
  ...createTerminalSlice(...a),
  ...createTabsSlice(...a),
  ...createUISlice(...a),
  ...createSettingsSlice(...a),
  ...createKeybindingsSlice(...a),
  ...createPreflightSlice(...a),
  ...createEditorSlice(...a),
  ...createStatsSlice(...a),
  ...createMemorySlice(...a),
  ...createWorkspaceSpaceSlice(...a),
  ...createBrowserSlice(...a),
  ...createSshSlice(...a),
  ...createAgentStatusSlice(...a),
  ...createDiffCommentsSlice(...a),
  ...createDetectedAgentsSlice(...a),
  ...createWorktreeNavHistorySlice(...a),
  ...createDictationSlice(...a),
  ...createWorkspaceCleanupSlice(...a),
  ...createRuntimeStatusSlice(...a),
  ...createCommitMessageGenerationSlice(...a),
  ...createPinnedTabCloseConfirmSlice(...a)
}))

registerHttpLinkStoreAccessor(() => useAppStore.getState())

export type { AppState } from './types'

// Why: exposes the Zustand store on window for console debugging (dev) and
// E2E tests (VITE_EXPOSE_STORE). The E2E suite reads store state directly
// to avoid fragile DOM scraping. Harmless — the store is already reachable
// via React DevTools in any environment.
if ((import.meta.env.DEV || e2eConfig.exposeStore) && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__store = useAppStore
}
