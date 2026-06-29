/* eslint-disable max-lines */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  CloudUpload,
  Minus,
  Plus,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkle,
  Sparkles,
  SlidersHorizontal,
  Square,
  Undo2,
  Check,
  Copy,
  Folder,
  FolderOpen,
  GitFork,
  GitMerge,
  GitPullRequestArrow,
  MessageSquare,
  Trash,
  Trash2,
  TriangleAlert,
  CircleCheck,
  MoreHorizontal,
  type LucideIcon
} from 'lucide-react'
import { useAppStore } from '@/store'
import { resolveRemoteOperationErrorMessage } from '@/lib/source-control-remote-error'
import { useActiveWorktree, useRepoById, useWorktreeMap } from '@/store/selectors'
import { detectLanguage } from '@/lib/language-detect'
import { basename, dirname, joinPath } from '@/lib/path'
import { cn } from '@/lib/utils'
import { WORKSPACE_FILE_PATH_MIME } from '@/lib/workspace-file-drag'
import { isFolderRepo } from '../../../../shared/repo-kind'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { DetachedHeadBadge } from '@/components/DetachedHeadBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  resolveCommitAreaPrimaryAction,
  type PrimaryAction,
  type RemoteOpKind
} from './source-control-primary-action'
import {
  resolveDropdownItems,
  type DropdownActionKind,
  type DropdownEntry
} from './source-control-dropdown-items'
import { isCommitMessageFieldDisabled } from './source-control-commit-eligibility'
import { BulkActionBar } from './BulkActionBar'
import { useSourceControlSelection, type FlatEntry } from './useSourceControlSelection'
import {
  getDiscardAllPaths,
  getStageAllPaths,
  getUnstageAllPaths,
  isStageableStatusEntry,
  isSubmoduleWorktreeOnlyChange,
  runDiscardAllForArea,
  type DiscardAllArea
} from './discard-all-sequence'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import {
  buildGitStatusSourceControlTree,
  buildSourceControlTree,
  applyGitStatusEntryAreasToSourceControlTree,
  collectSourceControlTreeFileEntries,
  compactSourceControlTree,
  flattenSourceControlTree,
  namespaceSourceControlTreeDirectoryKeys,
  type SourceControlTreeNode
} from './source-control-tree'
import {
  buildSourceControlDisplaySections,
  getSourceControlSectionViewAction,
  resolveSourceControlGroupOrder,
  SOURCE_CONTROL_AREAS,
  type SourceControlDisplaySectionId,
  type SourceControlEntryGroups,
  type SourceControlSectionArea
} from './source-control-section-order'
import {
  buildActiveOpenFileSignature,
  buildActiveOpenRowKeys
} from './source-control-active-open-file-keys'
import {
  filterSourceControlGroupedPathEntries,
  filterSourceControlPathEntries,
  getSourceControlFileFilterState
} from './source-control-file-filter'
import { getCommitMessageTextareaRows } from './source-control-commit-message-rows'
import {
  SourceControlDiscardDialog,
  type PendingDiscardConfirmation
} from './source-control-discard-dialog'
import { refreshGitStatusForWorktree } from './git-status-refresh'
import { describeForkPushTarget } from './fork-push-target-label'
import { toast } from 'sonner'
import { SourceControlEntryContextMenu } from './source-control-entry-context-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { BaseRefPicker } from '@/components/settings/BaseRefPicker'
import { useConfirmationDialog } from '@/components/confirmation-dialog'
import { formatDiffComment, formatDiffComments } from '@/lib/diff-comments-format'
import { getDiffCommentLineLabel, getDiffCommentSource } from '@/lib/diff-comment-compat'
import { DiffNotesSendMenu } from '@/components/editor/DiffNotesSendMenu'
import {
  countPendingDiffCommentsClear,
  formatPendingDiffCommentsClearDescription,
  resolvePendingDiffCommentsClear,
  type PendingDiffCommentsClear
} from './diff-comments-clear-dialog-state'
import {
  pickSourceControlLaunchAgent,
  readSourceControlLaunchRecipeAgentId
} from '@/lib/source-control-launch-agent-selection'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import {
  notifyEditorExternalFileChange,
  requestEditorSaveQuiesce
} from '@/components/editor/editor-autosave'
import { getConnectionId } from '@/lib/connection-context'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import {
  abortRuntimeGitMerge,
  abortRuntimeGitRebase,
  bulkDiscardRuntimeGitPaths,
  bulkStageRuntimeGitPaths,
  bulkUnstageRuntimeGitPaths,
  cancelRuntimeGenerateCommitMessage,
  commitRuntimeGit,
  discardRuntimeGitPath,
  generateRuntimeCommitMessage,
  getRuntimeGitBranchCompare,
  getRuntimeGitHistory,
  stageRuntimeGitPath,
  unstageRuntimeGitPath,
  type RuntimeGitContext,
  type RuntimeGenerateCommitMessageOverrides
} from '@/runtime/runtime-git-client'
import { getRuntimeRepoBaseRefDefault } from '@/runtime/runtime-repo-client'

import { GitHistoryPanel, type GitHistoryPanelState } from './GitHistoryPanel'
import { useGitHistoryCommitActions } from './useGitHistoryCommitActions'
import { shouldForcePushWithLeaseForUpstream } from '../../../../shared/git-upstream-status'
import type {
  DiffComment,
  GitBranchChangeEntry,
  GitBranchCompareSummary,
  GitConflictOperation,
  GitPushTarget,
  GitStatusEntry,
  GitUpstreamStatus,
  SourceControlViewMode,
  TuiAgent
} from '../../../../shared/types'
import type { HostedReviewInfo } from '../../../../shared/hosted-review'
import { STATUS_COLORS, STATUS_LABELS } from './status-display'
import { isCustomAgentId } from '../../../../shared/commit-message-agent-spec'
import {
  type SourceControlActionRecipe,
  type SourceControlLaunchActionId
} from '../../../../shared/source-control-ai-actions'
import type { SourceControlAiWriteTarget } from '../../../../shared/source-control-ai-recipe-save'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import { resolveSourceControlLaunchPlatform } from '@/lib/source-control-launch-platform'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import {
  loadSessionCommitDrafts,
  saveSessionCommitDrafts
} from '@/lib/source-control-commit-draft-session'
import {
  getCommitFailureDialogWorktreeKey,
  shouldShowCommitFailureDialog,
  syncCommitFailureDialogState,
  type CommitFailureDialogState
} from './commit-failure-dialog-state'
import { hasExpandedCommitFailureDetails, summarizeCommitFailure } from './commit-failure-summary'
import {
  isSourceControlSplitOpenModifier,
  shouldOpenSourceControlRowAsPreview,
  toPermanentSourceControlRowOpenEvent,
  type SourceControlRowOpenEvent
} from './source-control-split-open'
import { SourceControlAgentActionDialog } from './SourceControlAgentActionDialog'
import {
  isPullPolicyRemoteActionError,
  PullPolicyRemoteActionNotice
} from './source-control-pull-policy-error-notice'
import { SourceControlTextGenerationDialog } from './SourceControlTextGenerationDialog'
import { hasConfiguredCommitMessageGenerationDefaults } from './source-control-text-generation-defaults'
import { useSourceControlAi } from './use-source-control-ai'
import { translate } from '@/i18n/i18n'
import {
  getNextSourceControlViewMode,
  shouldShowSourceControlCompareUnavailableCard,
  SourceControlHeaderToolbar
} from './source-control-header-toolbar'
import {
  createRunningCommitMessageGenerationRecord,
  getCommitMessageGenerationRecordKey,
  markCommitMessageGenerationHydrated,
  resolveCommitMessageGenerationCancel,
  resolveCommitMessageGenerationFailure,
  resolveCommitMessageGenerationSuccess,
  type CommitMessageGenerationRecord
} from '@/store/slices/commit-message-generation'

export {
  appendCommitFailureCustomInstruction,
  buildCommitFailureAgentCommandInput,
  buildFixCommitFailurePrompt,
  buildResolveConflictsPrompt,
  buildResolvePullRequestConflictsPrompt
} from './source-control-ai-prompts'
export {
  hasConfiguredCommitMessageGenerationDefaults,
  hasConfiguredSourceControlTextGenerationDefaults
} from './source-control-text-generation-defaults'

type AbortConflictOperation = Extract<GitConflictOperation, 'merge' | 'rebase'>
type AbortActionErrorKind = 'abort_merge' | 'abort_rebase'
export type SourceControlActionError = {
  kind: RemoteOpKind | AbortActionErrorKind
  message: string
}
type SourceControlOperationTarget = RuntimeGitContext & {
  worktreeId: string
  pushTarget?: GitPushTarget
}

export function resolveSourceControlBaseRef(input: {
  worktreeBaseRef?: string | null
  reviewBaseRefName?: string | null
  repoBaseRef?: string | null
  defaultBaseRef?: string | null
}): string | null {
  const worktreeBaseRef = input.worktreeBaseRef?.trim() || null
  const hasReviewBaseRefName = Boolean(input.reviewBaseRefName?.trim())
  const reviewBaseRef = resolveHostedReviewCompareBaseRef(input.reviewBaseRefName, [
    input.repoBaseRef,
    input.defaultBaseRef
  ])
  if (worktreeBaseRef && isFullGitCommitOid(worktreeBaseRef) && hasReviewBaseRefName) {
    return reviewBaseRef
  }
  return worktreeBaseRef || input.repoBaseRef?.trim() || input.defaultBaseRef?.trim() || null
}

export function resolveSourceControlPickerBaseRef(input: {
  pinnedBaseRef?: string | null
  effectiveBaseRef?: string | null
}): string | undefined {
  const pinnedBaseRef = input.pinnedBaseRef?.trim()
  if (!pinnedBaseRef) {
    return undefined
  }
  return input.effectiveBaseRef?.trim() || pinnedBaseRef
}

function isFullGitCommitOid(value: string): boolean {
  return /^[0-9a-f]{40}$/i.test(value)
}

function resolveHostedReviewCompareBaseRef(
  baseRefName: string | null | undefined,
  candidates: (string | null | undefined)[]
): string | null {
  const branch = baseRefName?.trim()
  if (!branch) {
    return null
  }
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (!trimmed) {
      continue
    }
    if (getCompareBaseCandidateBranchName(trimmed) === branch) {
      return trimmed
    }
  }
  for (const candidate of candidates) {
    const rewritten = rewriteCompareBaseBranchFromCandidate(candidate, branch)
    if (rewritten) {
      return rewritten
    }
  }
  return null
}

function getCompareBaseCandidateBranchName(candidate: string): string {
  const remoteRefPrefix = 'refs/remotes/'
  if (candidate.startsWith(remoteRefPrefix)) {
    const remoteAndBranch = candidate.slice(remoteRefPrefix.length)
    const slashIndex = remoteAndBranch.indexOf('/')
    return slashIndex > 0 ? remoteAndBranch.slice(slashIndex + 1) : remoteAndBranch
  }
  const headsRefPrefix = 'refs/heads/'
  if (candidate.startsWith(headsRefPrefix)) {
    return candidate.slice(headsRefPrefix.length)
  }
  const slashIndex = candidate.indexOf('/')
  return slashIndex > 0 ? candidate.slice(slashIndex + 1) : candidate
}

function rewriteCompareBaseBranchFromCandidate(
  candidate: string | null | undefined,
  branch: string
): string | null {
  const trimmed = candidate?.trim()
  if (!trimmed) {
    return null
  }
  const remoteRefPrefix = 'refs/remotes/'
  if (trimmed.startsWith(remoteRefPrefix)) {
    const remoteAndBranch = trimmed.slice(remoteRefPrefix.length)
    const slashIndex = remoteAndBranch.indexOf('/')
    return slashIndex > 0
      ? `${remoteRefPrefix}${remoteAndBranch.slice(0, slashIndex)}/${branch}`
      : null
  }
  const headsRefPrefix = 'refs/heads/'
  if (trimmed.startsWith(headsRefPrefix)) {
    return `${headsRefPrefix}${branch}`
  }
  const slashIndex = trimmed.indexOf('/')
  return slashIndex > 0 ? `${trimmed.slice(0, slashIndex)}/${branch}` : null
}

const EMPTY_GIT_STATUS_ENTRIES: GitStatusEntry[] = []
const EMPTY_BRANCH_CHANGE_ENTRIES: GitBranchChangeEntry[] = []

// Why: the "too many changes — add folder to .gitignore?" warning shows at most
// once per worktree per session (the analog of a "Don't show again" gate), so a
// repo that stays huge across polls doesn't re-toast every refresh.
const hugeRepoWarningDismissed = new Set<string>()

// Why: directional signifiers ahead of each primary action label. Commit
// (✓) is affirmative; Push (↑) points in the direction data flows; Sync
// (↕) is bidirectional; Publish gets a cloud-up to distinguish the
// first-time publish from a subsequent push. Pull is intentionally
// icon-less — the down-arrow read as a download/save affordance and was
// removed. Keeping the mapping outside the render function avoids
// reallocating it on every render.
const PRIMARY_ICONS: Partial<
  Record<
    PrimaryAction['kind'],
    React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  >
> = {
  commit: Check,
  stage: Plus,
  push: ArrowUp,
  sync: ArrowDownUp,
  publish: CloudUpload
}

const SECTION_LABELS: Record<SourceControlSectionArea, { key: string; fallback: string }> = {
  staged: {
    key: 'auto.components.right.sidebar.SourceControl.48a003c1b1',
    fallback: 'Staged Changes'
  },
  unstaged: {
    key: 'auto.components.right.sidebar.SourceControl.d4ef4bafc5',
    fallback: 'Changes'
  },
  untracked: {
    key: 'auto.components.right.sidebar.SourceControl.522f44dce5',
    fallback: 'Untracked Files'
  }
}
const CONFLICTS_SECTION_LABEL = {
  key: 'auto.components.right.sidebar.SourceControl.conflictsSection',
  fallback: 'Conflicts'
}

// Why: 5s branch compare polling churned git subprocesses in large repos.
// Explicit commit, remote, manual, and base-ref refresh paths still run immediately.
export const BRANCH_REFRESH_INTERVAL_MS = 30_000
// Why: row action buttons host Radix Tooltip triggers. Keeping the overlay
// measurable prevents transient top-left tooltip placement during hover.
const SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS =
  'absolute right-0 top-0 bottom-0 flex shrink-0 items-center gap-1.5 bg-accent pr-3 pl-2 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto'
const SOURCE_CONTROL_TREE_INDENT_PX = 12
const SOURCE_CONTROL_TREE_DIRECTORY_PADDING_PX = 8
const SOURCE_CONTROL_TREE_FILE_PADDING_PX = 20
const EMPTY_GIT_HISTORY_STATE: GitHistoryPanelState = { status: 'idle' }
const DEFAULT_COLLAPSED_SECTIONS = ['history'] as const
const SUBMODULE_WORKTREE_ONLY_LABEL = 'Submodule changes - stage inside submodule'
const SUBMODULE_WORKTREE_ONLY_STAGE_TOOLTIP = 'Stage these changes inside the submodule'

function createDefaultCollapsedSections(): Set<string> {
  return new Set(DEFAULT_COLLAPSED_SECTIONS)
}

function useCopyFeedbackState<T>(resetValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState(resetValue)
  const resetTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }, [])

  // Why: copy feedback timers are event-owned, but still need unmount cleanup
  // so delayed clipboard/timer work cannot update a destroyed component.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearResetTimer()
    }
  }, [clearResetTimer])

  const showFeedback = useCallback(
    (nextValue: T) => {
      if (!mountedRef.current) {
        return
      }
      clearResetTimer()
      setValue(nextValue)
      resetTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) {
          return
        }
        setValue(resetValue)
        resetTimerRef.current = null
      }, 1500)
    },
    [clearResetTimer, resetValue]
  )

  return [value, showFeedback]
}

function cancelSourceControlEditorRevealFrames(frameIds: React.MutableRefObject<number[]>): void {
  for (const frameId of frameIds.current) {
    cancelAnimationFrame(frameId)
  }
  frameIds.current = []
}

function requestSourceControlEditorRevealFrame(
  frameIds: React.MutableRefObject<number[]>,
  callback: FrameRequestCallback
): void {
  let completed = false
  let frameId: number | undefined
  frameId = requestAnimationFrame((timestamp) => {
    completed = true
    if (frameId !== undefined) {
      frameIds.current = frameIds.current.filter((pendingFrameId) => pendingFrameId !== frameId)
    }
    callback(timestamp)
  })
  if (!completed) {
    frameIds.current.push(frameId)
  }
}

// Why: the pure state-machine logic now lives in
// ./source-control-primary-action.ts. It is imported directly by callers
// (tests and other components) instead of going through this module.

type CommitDraftsByWorktree = Record<string, string>

export function normalizeSourceControlViewMode(value: unknown): SourceControlViewMode {
  return value === 'tree' || value === 'list' ? value : 'list'
}

type GitStatusSourceControlTreeNode = SourceControlTreeNode<
  GitStatusEntry,
  SourceControlSectionArea
>
type SourceControlTreeDirectoryNode = Extract<GitStatusSourceControlTreeNode, { type: 'directory' }>
type BranchSourceControlTreeNode = SourceControlTreeNode<GitBranchChangeEntry, 'branch'>
type BranchSourceControlTreeDirectoryNode = Extract<
  BranchSourceControlTreeNode,
  { type: 'directory' }
>

type SourceControlDirectoryActionPaths = {
  stagePaths: string[]
  unstagePaths: string[]
  discardPaths: string[]
}

function getSourceControlDirectoryActionPaths(
  node: SourceControlTreeDirectoryNode
): SourceControlDirectoryActionPaths {
  const entries = collectSourceControlTreeFileEntries(node)
  return {
    stagePaths: entries.filter(isStageableStatusEntry).map((entry) => entry.path),
    unstagePaths: getUnstageAllPaths(entries),
    discardPaths:
      node.area === 'unstaged' || node.area === 'untracked'
        ? getDiscardAllPaths(entries, node.area)
        : []
  }
}

export function readCommitDraftForWorktree(
  drafts: CommitDraftsByWorktree,
  worktreeId: string | null | undefined
): string {
  return drafts[worktreeId ?? ''] ?? ''
}

export function writeCommitDraftForWorktree(
  drafts: CommitDraftsByWorktree,
  worktreeId: string,
  value: string
): CommitDraftsByWorktree {
  return { ...drafts, [worktreeId]: value }
}

export function shouldRenderCommitArea(
  unresolvedConflictCount: number,
  conflictOperation: GitConflictOperation
): boolean {
  return unresolvedConflictCount === 0 && conflictOperation === 'unknown'
}

export function pickDefaultSourceControlAgent(
  defaultAgent: TuiAgent | 'blank' | null | undefined,
  detectedAgents: TuiAgent[],
  disabledAgents?: TuiAgent[]
): TuiAgent | null {
  return pickSourceControlLaunchAgent({
    defaultAgent,
    detectedAgents,
    disabledAgents
  })
}

function resolveRemoteActionError(kind: RemoteOpKind, error: unknown): string {
  return resolveRemoteOperationErrorMessage(error, {
    publish: kind === 'publish',
    isPush: kind === 'push',
    isForcePush: kind === 'force_push',
    isSync: kind === 'sync',
    isFetch: kind === 'fetch',
    isFastForward: kind === 'fast_forward',
    isRebase: kind === 'rebase'
  })
}

export function refreshSourceControlAfterRemoteAction({
  refreshGitStatus,
  refreshBranchCompare,
  refreshGitHistory,
  onError = (error) => console.warn('[SourceControl] post-remote refresh failed', error)
}: {
  refreshGitStatus: () => Promise<void>
  refreshBranchCompare: () => Promise<void>
  refreshGitHistory: () => Promise<void>
  onError?: (error: unknown) => void
}): void {
  // Why: fetch/sync can move the remote base ref without changing local files.
  // Refresh all three visible git projections so the branch comparison table
  // re-runs against the newly fetched base instead of waiting for polling.
  void Promise.all([refreshGitStatus(), refreshBranchCompare(), refreshGitHistory()]).catch(onError)
}

function remoteActionErrorMatchesSettledConflictOperation(
  kind: SourceControlActionError['kind'],
  operation: GitConflictOperation
): boolean {
  if (kind === 'rebase' || kind === 'abort_rebase') {
    return operation === 'rebase'
  }
  if (kind === 'abort_merge') {
    return operation === 'merge'
  }
  if (kind === 'pull' || kind === 'sync') {
    return operation === 'merge' || operation === 'rebase'
  }
  return false
}

export function clearRemoteActionErrorsForCompletedConflictOperations({
  remoteActionErrors,
  previousConflictOperations,
  currentConflictOperations
}: {
  remoteActionErrors: Record<string, SourceControlActionError | null>
  previousConflictOperations: Record<string, GitConflictOperation>
  currentConflictOperations: Record<string, GitConflictOperation>
}): Record<string, SourceControlActionError | null> {
  let next: Record<string, SourceControlActionError | null> | null = null
  for (const [worktreeId, error] of Object.entries(remoteActionErrors)) {
    if (!error) {
      continue
    }
    const previousOperation = previousConflictOperations[worktreeId] ?? 'unknown'
    const currentOperation = currentConflictOperations[worktreeId] ?? 'unknown'
    if (
      previousOperation === 'unknown' ||
      currentOperation !== 'unknown' ||
      !remoteActionErrorMatchesSettledConflictOperation(error.kind, previousOperation)
    ) {
      continue
    }
    next ??= { ...remoteActionErrors }
    next[worktreeId] = null
  }
  return next ?? remoteActionErrors
}

function SourceControlInner(): React.JSX.Element {
  const sourceControlRef = useRef<HTMLDivElement | null>(null)
  const isMac = useMemo(() => navigator.userAgent.includes('Mac'), [])
  const pendingCommentEditorRevealFrameIdsRef = useRef<number[]>([])
  // Why: React setState is async, so a rapid double-click on the Commit
  // button can both pass the isCommitting state guard before the disabled
  // state re-renders. A ref flipped synchronously at the start of
  // handleCommit gives us a true single-flight lock.
  const commitInFlightRef = useRef<Record<string, boolean>>({})
  const activeWorktree = useActiveWorktree()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeGroupId = useAppStore((s) =>
    activeWorktreeId ? s.activeGroupIdByWorktree[activeWorktreeId] : undefined
  )
  const worktreeMap = useWorktreeMap()
  const rightSidebarTab = useAppStore((s) => s.rightSidebarTab)
  const activeRepo = useRepoById(activeWorktree?.repoId ?? null)
  const entries = useAppStore((s) =>
    activeWorktreeId
      ? (s.gitStatusByWorktree[activeWorktreeId] ?? EMPTY_GIT_STATUS_ENTRIES)
      : EMPTY_GIT_STATUS_ENTRIES
  )
  const activeGitStatusHead = useAppStore((s) =>
    activeWorktreeId ? (s.gitStatusHeadByWorktree?.[activeWorktreeId] ?? null) : null
  )
  const repositoryHuge = useAppStore((s) =>
    activeWorktreeId ? s.gitStatusHugeByWorktree?.[activeWorktreeId] : undefined
  )
  const branchEntries = useAppStore((s) =>
    activeWorktreeId
      ? (s.gitBranchChangesByWorktree[activeWorktreeId] ?? EMPTY_BRANCH_CHANGE_ENTRIES)
      : EMPTY_BRANCH_CHANGE_ENTRIES
  )
  const branchSummary = useAppStore((s) =>
    activeWorktreeId ? (s.gitBranchCompareSummaryByWorktree[activeWorktreeId] ?? null) : null
  )
  const conflictOperation = useAppStore((s) =>
    activeWorktreeId ? (s.gitConflictOperationByWorktree[activeWorktreeId] ?? 'unknown') : 'unknown'
  )
  const conflictOperationsByWorktree = useAppStore((s) => s.gitConflictOperationByWorktree)
  // Why: leave undefined until fetchUpstreamStatus resolves for this worktree.
  // A synthetic "no upstream" flashes "Publish Branch" during worktree switches.
  const remoteStatus = useAppStore((s) =>
    activeWorktreeId ? s.remoteStatusesByWorktree[activeWorktreeId] : undefined
  )
  const isRemoteOperationActive = useAppStore((s) => s.isRemoteOperationActive)
  const inFlightRemoteOpKind = useAppStore((s) => s.inFlightRemoteOpKind)
  const settings = useAppStore((s) => s.settings)
  // Why: git/file mutations and repo metadata requests belong to the repo
  // OWNER host, not the currently focused host in the sidebar.
  const activeRepoSettings = useMemo(
    () => getRepoOwnerRoutedSettings(settings, activeRepo ?? null),
    [activeRepo, settings]
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const updateRepo = useAppStore((s) => s.updateRepo)
  const setGitStatus = useAppStore((s) => s.setGitStatus)
  const updateWorktreeGitIdentity = useAppStore((s) => s.updateWorktreeGitIdentity)
  const beginGitBranchCompareRequest = useAppStore((s) => s.beginGitBranchCompareRequest)
  const setGitBranchCompareResult = useAppStore((s) => s.setGitBranchCompareResult)
  const fetchUpstreamStatus = useAppStore((s) => s.fetchUpstreamStatus)
  const setUpstreamStatus = useAppStore((s) => s.setUpstreamStatus)
  const pushBranch = useAppStore((s) => s.pushBranch)
  const pullBranch = useAppStore((s) => s.pullBranch)
  const fastForwardBranch = useAppStore((s) => s.fastForwardBranch)
  const syncBranch = useAppStore((s) => s.syncBranch)
  const rebaseFromBase = useAppStore((s) => s.rebaseFromBase)
  const fetchBranch = useAppStore((s) => s.fetchBranch)
  const revealInExplorer = useAppStore((s) => s.revealInExplorer)
  const trackConflictPath = useAppStore((s) => s.trackConflictPath)
  const openDiff = useAppStore((s) => s.openDiff)
  const openFile = useAppStore((s) => s.openFile)
  const setEditorViewMode = useAppStore((s) => s.setEditorViewMode)
  const setMarkdownViewMode = useAppStore((s) => s.setMarkdownViewMode)
  const setPendingEditorReveal = useAppStore((s) => s.setPendingEditorReveal)
  const openConflictFile = useAppStore((s) => s.openConflictFile)
  const openConflictReview = useAppStore((s) => s.openConflictReview)
  const openBranchDiff = useAppStore((s) => s.openBranchDiff)
  const createEmptySplitGroup = useAppStore((s) => s.createEmptySplitGroup)
  const groupsByWorktree = useAppStore((s) => s.groupsByWorktree)
  const activeGroupIdByWorktree = useAppStore((s) => s.activeGroupIdByWorktree)
  const openAllDiffs = useAppStore((s) => s.openAllDiffs)
  const openBranchAllDiffs = useAppStore((s) => s.openBranchAllDiffs)
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment)
  const clearDiffComments = useAppStore((s) => s.clearDiffComments)
  const clearDiffCommentsForFile = useAppStore((s) => s.clearDiffCommentsForFile)
  const setScrollToDiffCommentId = useAppStore((s) => s.setScrollToDiffCommentId)
  // Why: pass activeWorktreeId directly (even when null/undefined) so the
  // slice's getDiffComments returns its stable EMPTY_COMMENTS sentinel. An
  // inline `[]` fallback would allocate a new array each store update, break
  // Zustand's Object.is equality, and cause this component plus the
  // diffCommentCountByPath memo to churn on every unrelated store change.
  const diffCommentsForActive = useAppStore((s) => s.getDiffComments(activeWorktreeId))
  const diffCommentCount = diffCommentsForActive.length
  // Why: per-file counts are fed into each UncommittedEntryRow so a comment
  // badge can appear next to the status letter. Compute once per render so
  // rows don't each re-filter the full list.
  const diffCommentCountByPath = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of diffCommentsForActive) {
      map.set(c.filePath, (map.get(c.filePath) ?? 0) + 1)
    }
    return map
  }, [diffCommentsForActive])
  const diffCommentsPrompt = useMemo(
    () => formatDiffComments(diffCommentsForActive),
    [diffCommentsForActive]
  )
  const [diffCommentsExpanded, setDiffCommentsExpanded] = useState(false)
  const [diffCommentsCopied, showDiffCommentsCopied] = useCopyFeedbackState(false)
  const [pendingDiffCommentsClear, setPendingDiffCommentsClear] =
    useState<PendingDiffCommentsClear | null>(null)
  const [isClearingDiffComments, setIsClearingDiffComments] = useState(false)
  const setSourceControlRoot = useCallback((node: HTMLDivElement | null) => {
    // Why: markdown-note reveal frames target the Source Control surface; cancel
    // them when that surface unmounts instead of from a passive Effect.
    if (node === null) {
      cancelSourceControlEditorRevealFrames(pendingCommentEditorRevealFrameIdsRef)
    }
    sourceControlRef.current = node
  }, [])

  const handleCopyDiffComments = useCallback(async (): Promise<void> => {
    if (diffCommentsForActive.length === 0) {
      return
    }
    try {
      await window.api.ui.writeClipboardText(diffCommentsPrompt)
      showDiffCommentsCopied(true)
    } catch {
      // Why: swallow — clipboard write can fail when the window isn't focused.
      // No dedicated error surface is warranted for a best-effort copy action.
    }
  }, [diffCommentsForActive, diffCommentsPrompt, showDiffCommentsCopied])

  const pendingDiffCommentsClearCount = useMemo(() => {
    return countPendingDiffCommentsClear(
      pendingDiffCommentsClear,
      activeWorktreeId,
      diffCommentsForActive
    )
  }, [activeWorktreeId, diffCommentsForActive, pendingDiffCommentsClear])

  const resolvedPendingDiffCommentsClear = resolvePendingDiffCommentsClear({
    activeWorktreeId,
    isClearing: isClearingDiffComments,
    pending: pendingDiffCommentsClear,
    pendingCount: pendingDiffCommentsClearCount
  })
  if (resolvedPendingDiffCommentsClear !== pendingDiffCommentsClear) {
    // Why: the confirmation is purely local UI state; clear impossible
    // confirmations before children observe a stale open dialog.
    setPendingDiffCommentsClear(resolvedPendingDiffCommentsClear)
  }

  const pendingDiffCommentsClearDescription = formatPendingDiffCommentsClearDescription(
    resolvedPendingDiffCommentsClear,
    pendingDiffCommentsClearCount
  )

  const handleConfirmDiffCommentsClear = useCallback(async (): Promise<void> => {
    const pending = resolvedPendingDiffCommentsClear
    if (!pending || isClearingDiffComments || pending.worktreeId !== activeWorktreeId) {
      return
    }
    if (pendingDiffCommentsClearCount === 0) {
      setPendingDiffCommentsClear(null)
      return
    }
    setIsClearingDiffComments(true)
    try {
      const ok =
        pending.kind === 'all'
          ? await clearDiffComments(pending.worktreeId)
          : await clearDiffCommentsForFile(pending.worktreeId, pending.filePath)
      if (ok) {
        setPendingDiffCommentsClear(null)
      } else {
        toast.error(
          translate(
            'auto.components.right.sidebar.SourceControl.eae7a1da5f',
            'Failed to clear notes.'
          )
        )
      }
    } finally {
      setIsClearingDiffComments(false)
    }
  }, [
    activeWorktreeId,
    clearDiffComments,
    clearDiffCommentsForFile,
    isClearingDiffComments,
    resolvedPendingDiffCommentsClear,
    pendingDiffCommentsClearCount
  ])

  const [filterExpanded, setFilterExpanded] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    createDefaultCollapsedSections
  )
  const persistedSourceControlViewMode = normalizeSourceControlViewMode(
    settings?.sourceControlViewMode
  )
  const sourceControlViewMode = persistedSourceControlViewMode
  const sourceControlGroupOrder = resolveSourceControlGroupOrder(settings?.sourceControlGroupOrder)
  const [collapsedTreeDirs, setCollapsedTreeDirs] = useState<Set<string>>(new Set())
  const [baseRefDialogOpen, setBaseRefDialogOpen] = useState(false)
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscardConfirmation | null>(null)
  // Why: start null rather than 'origin/main' so branch compare doesn't fire
  // with a fabricated ref before the IPC resolves. effectiveBaseRef stays
  // falsy until we have a real answer from the main process.
  const [defaultBaseRef, setDefaultBaseRef] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  // Why: Source Control unmounts when the user switches tabs, so keep commit
  // drafts in a module-scoped session cache and restore them on remount.
  const [commitDrafts, setCommitDrafts] = useState<CommitDraftsByWorktree>(() =>
    loadSessionCommitDrafts()
  )
  const commitDraftsRef = useRef<CommitDraftsByWorktree>(commitDrafts)
  const [commitErrors, setCommitErrors] = useState<Record<string, string | null>>({})
  const [remoteActionErrors, setRemoteActionErrors] = useState<
    Record<string, SourceControlActionError | null>
  >({})
  const previousConflictOperationsRef = useRef<Record<string, GitConflictOperation>>({})
  // Why: keep commit-in-flight state per-worktree. A single boolean would be
  // cleared when the user switched worktrees, letting them double-click Commit
  // on worktree A after briefly navigating to B and back while A's original
  // commit is still running.
  const [commitInFlightByWorktree, setCommitInFlightByWorktree] = useState<Record<string, boolean>>(
    {}
  )
  const [abortOperationInFlightByWorktree, setAbortOperationInFlightByWorktree] = useState<
    Record<string, boolean>
  >({})
  const isAbortingOperation = abortOperationInFlightByWorktree[activeWorktreeId ?? ''] ?? false
  const confirmAction = useConfirmationDialog()
  const isCommitting = commitInFlightByWorktree[activeWorktreeId ?? ''] ?? false
  // Why: parallel state to commit. Same per-worktree shape so navigating between
  // worktrees mid-generation never silently cancels the in-flight request.
  const generateInFlightRef = useRef<Record<string, boolean>>({})
  const [generateInFlightByWorktree, setGenerateInFlightByWorktree] = useState<
    Record<string, boolean>
  >({})
  const [generateErrors, setGenerateErrors] = useState<Record<string, string | null>>({})

  const commitMessageGenerationRecords = useAppStore((s) => s.commitMessageGenerationRecords)
  const allocateCommitMessageGenerationRequestId = useAppStore(
    (s) => s.allocateCommitMessageGenerationRequestId
  )
  const setCommitMessageGenerationRecord = useAppStore((s) => s.setCommitMessageGenerationRecord)
  const updateCommitMessageGenerationRecord = useAppStore(
    (s) => s.updateCommitMessageGenerationRecord
  )

  const commitMessage = readCommitDraftForWorktree(commitDrafts, activeWorktreeId)
  const commitError = commitErrors[activeWorktreeId ?? ''] ?? null
  const remoteActionError = remoteActionErrors[activeWorktreeId ?? ''] ?? null
  const [gitHistoryByWorktree, setGitHistoryByWorktree] = useState<
    Record<string, GitHistoryPanelState>
  >({})
  const gitHistoryRequestSeqRef = useRef(0)
  const gitHistoryRequestByWorktreeRef = useRef<Record<string, number>>({})
  const gitHistoryState = activeWorktreeId
    ? (gitHistoryByWorktree[activeWorktreeId] ?? EMPTY_GIT_HISTORY_STATE)
    : EMPTY_GIT_HISTORY_STATE
  const isGitHistoryExpanded = !collapsedSections.has('history')

  useEffect(() => {
    commitDraftsRef.current = commitDrafts
  }, [commitDrafts])

  const updateCommitDrafts = useCallback(
    (updater: (drafts: CommitDraftsByWorktree) => CommitDraftsByWorktree): void => {
      const next = updater(commitDraftsRef.current)
      // Why: Create PR intent reads this ref after awaits to avoid overwriting
      // user edits made before React's passive state sync effect runs.
      commitDraftsRef.current = next
      setCommitDrafts(next)
    },
    []
  )

  const isFolder = activeRepo ? isFolderRepo(activeRepo) : false
  const worktreePath = activeWorktree?.path ?? null
  const activeCommitMessageGenerationKey = getCommitMessageGenerationRecordKey(
    activeWorktreeId,
    worktreePath
  )
  const activeCommitMessageGenerationRecord: CommitMessageGenerationRecord | null =
    activeCommitMessageGenerationKey
      ? (commitMessageGenerationRecords[activeCommitMessageGenerationKey] ?? null)
      : null
  const isGenerating =
    activeCommitMessageGenerationRecord?.status === 'running' ||
    (generateInFlightByWorktree[activeWorktreeId ?? ''] ?? false)
  const generateError =
    activeCommitMessageGenerationRecord?.error ?? generateErrors[activeWorktreeId ?? ''] ?? null
  const activeConnectionId = activeWorktreeId
    ? (getConnectionId(activeWorktreeId) ?? activeRepo?.connectionId ?? null)
    : null
  const activeSourceControlLaunchPlatform = resolveSourceControlLaunchPlatform({
    connectionId: activeConnectionId,
    worktreePath,
    projectRuntime: activeConnectionId
      ? undefined
      : getLocalProjectExecutionRuntimeContext(useAppStore.getState(), activeWorktreeId)
  })
  const gitIdentityDisplay = activeWorktree ? getWorktreeGitIdentityDisplay(activeWorktree) : null
  const detachedHeadDisplay = gitIdentityDisplay?.kind === 'detached' ? gitIdentityDisplay : null
  const branchName = gitIdentityDisplay?.kind === 'branch' ? gitIdentityDisplay.branchName : ''
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)
  // Why: gate polling on both the active tab AND the sidebar being open.
  // The sidebar now stays mounted when closed (for performance), so without
  // this guard the branchCompare interval and PR fetch would keep running
  // with no visible consumer, wasting git process spawns and API calls.
  const isBranchVisible = rightSidebarTab === 'source-control' && rightSidebarOpen

  const refreshActiveGitStatus = useCallback(async (): Promise<void> => {
    if (!activeWorktreeId || !worktreePath || isFolder) {
      return
    }
    const connectionId = getConnectionId(activeWorktreeId) ?? undefined
    await refreshGitStatusForWorktree({
      // Why: route git status by the repo OWNER host, not the focused runtime.
      settings: activeRepoSettings,
      worktreeId: activeWorktreeId,
      worktreePath,
      connectionId,
      pushTarget: activeWorktree?.pushTarget,
      deps: {
        setGitStatus,
        updateWorktreeGitIdentity,
        setUpstreamStatus,
        fetchUpstreamStatus
      }
    })
  }, [
    activeRepoSettings,
    activeWorktreeId,
    activeWorktree?.pushTarget,
    fetchUpstreamStatus,
    isFolder,
    setGitStatus,
    setUpstreamStatus,
    updateWorktreeGitIdentity,
    worktreePath
  ])

  const refreshActiveGitStatusAfterMutation = useCallback(async (): Promise<void> => {
    try {
      await refreshActiveGitStatus()
    } catch (error) {
      console.warn('[SourceControl] post-mutation git status refresh failed', error)
    }
  }, [refreshActiveGitStatus])

  // Why: when status is truncated at the entry limit, offer (once per worktree)
  // to .gitignore the folder most likely flooding it — the usual cause is a
  // build/dependency dir that should have been ignored. Accepting writes the
  // .gitignore and refreshes, which clears the huge flag and resumes polling.
  // Local-only: the SSH huge-folder write path isn't wired, so skip remote.
  useEffect(() => {
    if (!repositoryHuge || !activeWorktreeId || !worktreePath || activeConnectionId) {
      return
    }
    if (hugeRepoWarningDismissed.has(activeWorktreeId)) {
      return
    }
    const worktreeId = activeWorktreeId
    let cancelled = false
    void window.api.git
      .findHugeFoldersToIgnore({ worktreePath })
      .then((folders) => {
        if (cancelled || folders.length === 0 || hugeRepoWarningDismissed.has(worktreeId)) {
          return
        }
        hugeRepoWarningDismissed.add(worktreeId)
        const folderName = folders[0]
        toast.warning(
          translate(
            'auto.components.right.sidebar.SourceControl.hugeRepoIgnorePrompt',
            'This repository has too many active changes. Add "{{value0}}" to .gitignore?',
            { value0: folderName }
          ),
          {
            action: {
              label: translate(
                'auto.components.right.sidebar.SourceControl.hugeRepoIgnoreAction',
                'Add to .gitignore'
              ),
              onClick: () => {
                void window.api.git
                  .appendGitignore({ worktreePath, folderName })
                  .then(() => refreshActiveGitStatus())
                  .catch((error) => console.warn('[SourceControl] add to .gitignore failed', error))
              }
            }
          }
        )
      })
      .catch((error) => console.warn('[SourceControl] findHugeFoldersToIgnore failed', error))
    return () => {
      cancelled = true
    }
  }, [repositoryHuge, activeWorktreeId, worktreePath, activeConnectionId, refreshActiveGitStatus])

  useEffect(() => {
    if (!isBranchVisible || !activeRepo || isFolder) {
      return
    }

    // Why: reset to null so that effectiveBaseRef becomes falsy until the IPC
    // resolves.  This prevents the branch compare from firing with a stale
    // defaultBaseRef left over from a *different* repo (e.g. 'origin/master'
    // when the new repo uses 'origin/main'), which would cause a transient
    // "invalid-base" error every time the user switches between repos.
    setDefaultBaseRef(null)

    let stale = false
    void getRuntimeRepoBaseRefDefault(activeRepoSettings, activeRepo.id)
      .then((result) => {
        if (!stale) {
          // Why: IPC now returns a `{ defaultBaseRef, remoteCount }` envelope;
          // this component only needs `defaultBaseRef`. `remoteCount` is used
          // by BaseRefPicker for the multi-remote hint.
          setDefaultBaseRef(result.defaultBaseRef)
        }
      })
      .catch((err) => {
        console.error('[SourceControl] getBaseRefDefault failed', err)
        // Why: leave defaultBaseRef null on failure instead of fabricating
        // 'origin/main'. effectiveBaseRef stays falsy, so branch compare and
        // PR fetch skip running against a ref that may not exist.
        if (!stale) {
          setDefaultBaseRef(null)
        }
      })

    return () => {
      stale = true
    }
  }, [activeRepo, activeRepoSettings, isBranchVisible, isFolder])

  const normalizedWorktreeBaseRef = activeWorktree?.baseRef?.trim() || null
  const normalizedRepoBaseRef = activeRepo?.worktreeBaseRef?.trim() || null
  const baseRefOwnedByWorktree = normalizedWorktreeBaseRef !== null
  const pinnedBaseRef = normalizedWorktreeBaseRef ?? normalizedRepoBaseRef
  const hasUncommittedEntries = entries.length > 0

  // Why: hosted-review status fetching/browsing and the create-PR flow were
  // removed; there is never a fetched review for the current branch.
  const hostedReview = null as HostedReviewInfo | null
  const effectiveBaseRef = resolveSourceControlBaseRef({
    worktreeBaseRef: normalizedWorktreeBaseRef,
    reviewBaseRefName: hostedReview?.baseRefName,
    repoBaseRef: normalizedRepoBaseRef,
    defaultBaseRef
  })
  const pickerBaseRef = resolveSourceControlPickerBaseRef({
    pinnedBaseRef,
    effectiveBaseRef
  })
  // Why: hosted-review status fetching/push-target resolution was removed, so
  // the primary-action publish gate no longer factors in a fetched review.
  const isHostedReviewStateLoading = false
  const canUseHostedReviewPushTarget = false
  const hostedReviewStateForActions = null as HostedReviewInfo['state'] | null
  const remoteStatusForActions = remoteStatus

  const grouped = useMemo(() => {
    const groups: SourceControlEntryGroups = { staged: [], unstaged: [], untracked: [] }
    for (const entry of entries) {
      groups[entry.area].push(entry)
    }
    for (const area of SOURCE_CONTROL_AREAS) {
      groups[area].sort(compareGitStatusEntries)
    }
    return groups
  }, [entries])

  const fileFilterState = useMemo(() => getSourceControlFileFilterState(filterQuery), [filterQuery])
  const normalizedFilter = fileFilterState.normalizedFilter
  const isGitHistoryVisible =
    !normalizedFilter &&
    !fileFilterState.tooLarge &&
    Boolean(activeWorktreeId && worktreePath && !isFolder)

  const filteredGrouped = useMemo(
    () => filterSourceControlGroupedPathEntries(grouped, fileFilterState),
    [fileFilterState, grouped]
  )

  const displaySections = useMemo(
    () => buildSourceControlDisplaySections(filteredGrouped, sourceControlGroupOrder),
    [filteredGrouped, sourceControlGroupOrder]
  )
  const unfilteredDisplaySections = useMemo(
    () => buildSourceControlDisplaySections(grouped, sourceControlGroupOrder),
    [grouped, sourceControlGroupOrder]
  )
  const unfilteredDisplaySectionsById = useMemo(
    () => new Map(unfilteredDisplaySections.map((section) => [section.id, section])),
    [unfilteredDisplaySections]
  )

  const filteredBranchEntries = useMemo(
    () => filterSourceControlPathEntries(branchEntries, fileFilterState),
    [branchEntries, fileFilterState]
  )

  const flatEntries = useMemo(() => {
    const arr: FlatEntry[] = []
    for (const section of displaySections) {
      if (!collapsedSections.has(section.id)) {
        for (const entry of section.items) {
          arr.push({ key: `${entry.area}::${entry.path}`, entry, area: entry.area })
        }
      }
    }
    return arr
  }, [collapsedSections, displaySections])

  const treeRootsBySection = useMemo(() => {
    const roots: Partial<Record<SourceControlDisplaySectionId, GitStatusSourceControlTreeNode[]>> =
      {}
    for (const section of displaySections) {
      const sectionRoots = compactSourceControlTree(
        buildGitStatusSourceControlTree(section.area, section.items)
      )
      roots[section.id] =
        section.id === 'conflicts'
          ? applyGitStatusEntryAreasToSourceControlTree(
              // Why: conflict rows can mirror normal paths, so their folder
              // collapse keys must not share state with normal area sections.
              namespaceSourceControlTreeDirectoryKeys(sectionRoots, 'conflicts')
            )
          : sectionRoots
    }
    return roots
  }, [displaySections])

  const visibleTreeRowsBySection = useMemo(() => {
    const rows: Partial<Record<SourceControlDisplaySectionId, GitStatusSourceControlTreeNode[]>> =
      {}
    for (const section of displaySections) {
      rows[section.id] = flattenSourceControlTree(
        treeRootsBySection[section.id] ?? [],
        collapsedTreeDirs
      )
    }
    return rows
  }, [collapsedTreeDirs, displaySections, treeRootsBySection])

  const branchTreeRoots = useMemo(
    () => compactSourceControlTree(buildSourceControlTree('branch', filteredBranchEntries)),
    [filteredBranchEntries]
  )
  const visibleBranchTreeRows = useMemo(
    () => flattenSourceControlTree(branchTreeRoots, collapsedTreeDirs),
    [branchTreeRoots, collapsedTreeDirs]
  )

  const visibleSelectionEntries = useMemo(() => {
    if (sourceControlViewMode === 'list') {
      return flatEntries
    }

    const arr: FlatEntry[] = []
    for (const section of displaySections) {
      if (collapsedSections.has(section.id)) {
        continue
      }
      for (const node of visibleTreeRowsBySection[section.id] ?? []) {
        if (node.type === 'file') {
          arr.push({ key: node.key, entry: node.entry, area: node.area })
        }
      }
    }
    return arr
  }, [
    collapsedSections,
    displaySections,
    flatEntries,
    sourceControlViewMode,
    visibleTreeRowsBySection
  ])

  const [isExecutingBulk, setIsExecutingBulk] = useState(false)
  const unresolvedConflicts = useMemo(
    () => entries.filter((entry) => entry.conflictStatus === 'unresolved' && entry.conflictKind),
    [entries]
  )
  const unresolvedConflictReviewEntries = useMemo(
    () =>
      unresolvedConflicts.map((entry) => ({
        path: entry.path,
        conflictKind: entry.conflictKind!
      })),
    [unresolvedConflicts]
  )
  const {
    sourceControlAiDiscoveryHostKey,
    sourceControlAiActionsVisible,
    resolvedCommitMessageAi,
    resolveConflictsComposerOpen,
    setResolveConflictsComposerOpen,
    commitGenerationDialogOpen,
    setCommitGenerationDialogOpen,
    openCommitGenerationDialog,
    isLaunchingCommitFailureAgent,
    resolveConflictsPrompt,
    commitFailureRecoveryPrompt,
    getLaunchActionRecipe,
    saveLaunchActionDefault,
    handleResolveConflictsWithAI,
    handleFixCommitFailureWithAI,
    handleSaveCommitMessageGenerationDefaults,
    openSourceControlAiSettings
  } = useSourceControlAi({
    settings: activeRepoSettings,
    activeRepo: activeRepo ?? null,
    activeWorktreeId,
    activeConnectionId,
    activeGroupId,
    activeSourceControlLaunchPlatform,
    conflictOperation,
    unresolvedConflicts,
    stagedEntries: grouped.staged,
    worktreePath,
    commitMessage,
    commitError,
    updateSettings,
    updateRepo,
    openSettingsTarget,
    openSettingsPage
  })

  useEffect(() => {
    if (sourceControlAiActionsVisible) {
      return
    }
    setResolveConflictsComposerOpen(false)
    setCommitGenerationDialogOpen(false)
  }, [
    setCommitGenerationDialogOpen,
    setResolveConflictsComposerOpen,
    sourceControlAiActionsVisible
  ])

  // Why: orphaned draft/error/in-flight entries accumulate when worktrees are
  // removed from the store (long sessions with many create/destroy cycles).
  // Prune them so a deleted-then-reused worktree ID doesn't inherit stale
  // state — especially commitInFlightRef, which would permanently disable
  // Commit for that ID if left stuck at `true`.
  useEffect(() => {
    const pruneRecord = <T,>(prev: Record<string, T>): Record<string, T> => {
      let changed = false
      const next: Record<string, T> = {}
      for (const key of Object.keys(prev)) {
        if (worktreeMap.has(key)) {
          next[key] = prev[key]
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    }
    updateCommitDrafts((prev) => pruneRecord(prev))
    setCommitErrors((prev) => pruneRecord(prev))
    setRemoteActionErrors((prev) => pruneRecord(prev))
    setCommitInFlightByWorktree((prev) => pruneRecord(prev))
    setAbortOperationInFlightByWorktree((prev) => pruneRecord(prev))
    setGenerateInFlightByWorktree((prev) => pruneRecord(prev))
    setGenerateErrors((prev) => pruneRecord(prev))
    setGitHistoryByWorktree((prev) => pruneRecord(prev))
    // Refs don't need setState — mutate in place to drop stale keys.
    for (const key of Object.keys(commitInFlightRef.current)) {
      if (!worktreeMap.has(key)) {
        delete commitInFlightRef.current[key]
      }
    }
    for (const key of Object.keys(generateInFlightRef.current)) {
      if (!worktreeMap.has(key)) {
        delete generateInFlightRef.current[key]
      }
    }
    for (const key of Object.keys(gitHistoryRequestByWorktreeRef.current)) {
      if (!worktreeMap.has(key)) {
        delete gitHistoryRequestByWorktreeRef.current[key]
      }
    }
  }, [updateCommitDrafts, worktreeMap])

  useEffect(() => {
    saveSessionCommitDrafts(commitDrafts)
  }, [commitDrafts])

  useEffect(() => {
    // Why: users often finish merge/rebase conflicts in a terminal. Once git
    // status observes that operation end, the old Source Control failure banner
    // is stale and should not survive the successful external continue/abort.
    const previousConflictOperations = previousConflictOperationsRef.current
    setRemoteActionErrors((prev) =>
      clearRemoteActionErrorsForCompletedConflictOperations({
        remoteActionErrors: prev,
        previousConflictOperations,
        currentConflictOperations: conflictOperationsByWorktree
      })
    )
    previousConflictOperationsRef.current = conflictOperationsByWorktree
  }, [conflictOperationsByWorktree])

  // Why: the sidebar no longer uses key={activeWorktreeId} to force a full
  // remount on worktree switch (that caused an IPC storm on Windows).
  // Instead, reset worktree-specific local state here so the previous
  // worktree's UI state doesn't leak into the new one.
  useEffect(() => {
    setFilterExpanded(false)
    setCollapsedSections(createDefaultCollapsedSections())
    setCollapsedTreeDirs(new Set())
    setBaseRefDialogOpen(false)
    setPendingDiscard(null)
    setPendingDiffCommentsClear(null)
    setIsClearingDiffComments(false)
    // Why: do NOT reset defaultBaseRef here. It is repo-scoped, not
    // worktree-scoped, and is resolved by the effect above on activeRepo
    // change. Resetting it to a hard-coded 'origin/main' on every worktree
    // switch within the same repo clobbered the correct value (e.g.
    // 'origin/master' for repos whose default branch isn't main), causing
    // a persistent "Branch compare unavailable" until the user switched
    // repos and back to re-trigger the resolver.
    setFilterQuery('')
    setIsExecutingBulk(false)
    // Why: no reset for commit-in-flight state — it now lives in a per-worktree
    // map, so it cannot leak across worktrees. Resetting here would actually
    // clear in-flight state for the *incoming* worktree if the user is coming
    // back to a worktree mid-commit, re-enabling the button while the commit
    // still runs.
  }, [activeWorktreeId])

  // Why: returns true on success so compound actions ("Commit & Push" etc.)
  // can skip the follow-up remote operation when the commit itself failed.
  const handleCommit = useCallback(
    async (
      messageOverride?: string,
      options?: {
        skipStagedSnapshotCheck?: boolean
        skipActiveConflictCheck?: boolean
        target?: SourceControlOperationTarget
      }
    ): Promise<boolean> => {
      const target =
        options?.target ??
        (activeWorktreeId && worktreePath
          ? {
              settings: activeRepoSettings,
              worktreeId: activeWorktreeId,
              worktreePath,
              connectionId: getConnectionId(activeWorktreeId) ?? undefined,
              pushTarget: activeWorktree?.pushTarget
            }
          : null)
      if (!target) {
        return false
      }
      const message = (messageOverride ?? commitMessage).trim()
      if (
        !message ||
        (!options?.skipStagedSnapshotCheck && grouped.staged.length === 0) ||
        (!options?.skipActiveConflictCheck && unresolvedConflicts.length > 0)
      ) {
        return false
      }

      if (commitInFlightRef.current[target.worktreeId]) {
        return false
      }
      commitInFlightRef.current[target.worktreeId] = true

      setCommitInFlightByWorktree((prev) => ({ ...prev, [target.worktreeId]: true }))
      setCommitErrors((prev) => ({ ...prev, [target.worktreeId]: null }))
      try {
        const commitResult = await commitRuntimeGit(
          {
            // Why: route the commit by the repo OWNER host, not the focused runtime.
            settings: target.settings,
            worktreeId: target.worktreeId,
            worktreePath: target.worktreePath,
            connectionId: target.connectionId
          },
          message
        )
        if (!commitResult.success) {
          setCommitErrors((prev) => ({
            ...prev,
            [target.worktreeId]: commitResult.error ?? 'Commit failed'
          }))
          return false
        }

        // Why: the textarea stays enabled during the in-flight commit (only the
        // button is disabled), so the user can keep typing after clicking Commit.
        // Unconditionally clearing the draft here would silently discard those
        // in-progress edits — the commit used the OLD `message` captured in this
        // closure, so the dropped text would never have been committed either.
        // Only clear when the current draft still matches what we committed.
        updateCommitDrafts((prev) => {
          const current = prev[target.worktreeId]
          if (current !== undefined && current.trim() !== message) {
            // User typed more after submit — preserve their in-progress edits.
            return prev
          }
          return writeCommitDraftForWorktree(prev, target.worktreeId, '')
        })
        setCommitErrors((prev) => ({ ...prev, [target.worktreeId]: null }))
        if (!options?.target) {
          void refreshActiveGitStatusAfterMutation()
        }
        // Why: flip branchSummary to 'loading' synchronously so the empty-state
        // guard
        //   (!hasUncommittedEntries && branchSummary.status === 'ready' &&
        //    branchEntries.length === 0)
        // doesn't briefly read true between setGitStatus clearing the
        // uncommitted list and the next branchCompare poll landing the new
        // commit. Without this flip "No changes on this branch" flashes for
        // the full poll-interval window.
        //
        // Then fire-and-forget refreshBranchCompare so the "Committed on
        // Branch" section repopulates as soon as the IPC returns instead of
        // waiting for the next poll. Unawaited on purpose:
        // compound flows (runCompoundCommitAction) need handleCommit to
        // resolve immediately so the push step starts without delay. Errors
        // here are best-effort — the polling tick will retry.
        if (!options?.target && effectiveBaseRef) {
          beginGitBranchCompareRequest(
            target.worktreeId,
            `${target.worktreeId}:${effectiveBaseRef}:${Date.now()}:post-commit`,
            effectiveBaseRef
          )
        }
        if (!options?.target) {
          void refreshBranchCompareRef.current()
          void refreshGitHistoryRef.current()
        }
        return true
      } catch (error) {
        setCommitErrors((prev) => ({
          ...prev,
          [target.worktreeId]: error instanceof Error ? error.message : 'Commit failed'
        }))
        return false
      } finally {
        setCommitInFlightByWorktree((prev) => ({ ...prev, [target.worktreeId]: false }))
        commitInFlightRef.current[target.worktreeId] = false
      }
    },
    [
      activeRepoSettings,
      activeWorktree?.pushTarget,
      activeWorktreeId,
      beginGitBranchCompareRequest,
      commitMessage,
      effectiveBaseRef,
      grouped.staged.length,
      refreshActiveGitStatusAfterMutation,
      updateCommitDrafts,
      unresolvedConflicts.length,
      worktreePath
    ]
  )

  const handleGenerate = useCallback(
    async (overrides?: RuntimeGenerateCommitMessageOverrides): Promise<void> => {
      if (!activeWorktreeId || !worktreePath || !activeCommitMessageGenerationKey) {
        return
      }
      if (generateInFlightRef.current[activeWorktreeId]) {
        return
      }
      if (!overrides?.sourceControlAiResolvedParams && resolvedCommitMessageAi?.ok !== true) {
        return
      }

      if (
        !overrides?.sourceControlAiResolvedParams &&
        resolvedCommitMessageAi?.ok === true &&
        isCustomAgentId(resolvedCommitMessageAi.value.params.agentId)
      ) {
        const command = resolvedCommitMessageAi.value.params.customAgentCommand?.trim() ?? ''
        if (!command) {
          setGenerateErrors((prev) => ({
            ...prev,
            [activeWorktreeId]:
              'Custom command is empty. Add one in Settings -> Git -> Source Control AI.'
          }))
          return
        }
      }

      generateInFlightRef.current[activeWorktreeId] = true
      const requestId = allocateCommitMessageGenerationRequestId()
      const connectionId = getConnectionId(activeWorktreeId) ?? undefined
      setCommitMessageGenerationRecord(
        activeCommitMessageGenerationKey,
        createRunningCommitMessageGenerationRecord({
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId,
          requestId,
          runtimeTargetSettings: activeRepoSettings
        })
      )
      setGenerateInFlightByWorktree((prev) => ({ ...prev, [activeWorktreeId]: true }))
      setGenerateErrors((prev) => ({ ...prev, [activeWorktreeId]: null }))
      try {
        const result = await generateRuntimeCommitMessage(
          {
            // Why: route generation by the repo OWNER host, not the focused runtime.
            settings: activeRepoSettings,
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId
          },
          overrides
        )

        if (!result.success) {
          // Why: cancellation is a deliberate user action, not a failure to
          // surface. Clear any prior error and stay quiet.
          if (result.canceled) {
            setGenerateErrors((prev) => ({ ...prev, [activeWorktreeId]: null }))
            updateCommitMessageGenerationRecord(activeCommitMessageGenerationKey, (record) =>
              resolveCommitMessageGenerationFailure({
                record,
                requestId,
                canceled: true,
                error: null
              })
            )
            return
          }
          setGenerateErrors((prev) => ({
            ...prev,
            [activeWorktreeId]: result.error
          }))
          updateCommitMessageGenerationRecord(activeCommitMessageGenerationKey, (record) =>
            resolveCommitMessageGenerationFailure({
              record,
              requestId,
              error: result.error
            })
          )
          return
        }

        updateCommitMessageGenerationRecord(activeCommitMessageGenerationKey, (record) =>
          resolveCommitMessageGenerationSuccess({
            record,
            requestId,
            message: result.message
          })
        )
        // Why: race protection — the user may have started typing into the
        // textarea while the agent was running. In that case we silently drop
        // the generated message rather than overwrite their in-progress edits.
        updateCommitDrafts((prev) => {
          const current = prev[activeWorktreeId]
          if (current && current.length > 0) {
            return prev
          }
          return writeCommitDraftForWorktree(prev, activeWorktreeId, result.message)
        })
        useAppStore.getState().recordFeatureInteraction('ai-commit-generation')
        setGenerateErrors((prev) => ({ ...prev, [activeWorktreeId]: null }))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate commit message'
        setGenerateErrors((prev) => ({
          ...prev,
          [activeWorktreeId]: message
        }))
        updateCommitMessageGenerationRecord(activeCommitMessageGenerationKey, (record) =>
          resolveCommitMessageGenerationFailure({
            record,
            requestId,
            error: message
          })
        )
      } finally {
        setGenerateInFlightByWorktree((prev) => ({ ...prev, [activeWorktreeId]: false }))
        generateInFlightRef.current[activeWorktreeId] = false
      }
    },
    [
      activeCommitMessageGenerationKey,
      activeRepoSettings,
      activeWorktreeId,
      allocateCommitMessageGenerationRequestId,
      resolvedCommitMessageAi,
      setCommitMessageGenerationRecord,
      updateCommitDrafts,
      updateCommitMessageGenerationRecord,
      worktreePath
    ]
  )

  const handleGenerateCommitMessageClick = useCallback((): void => {
    if (!sourceControlAiActionsVisible) {
      return
    }
    if (
      hasConfiguredCommitMessageGenerationDefaults({ settings, repo: activeRepo ?? null }) &&
      resolvedCommitMessageAi?.ok
    ) {
      void handleGenerate({ sourceControlAiResolvedParams: resolvedCommitMessageAi.value.params })
      return
    }
    openCommitGenerationDialog()
  }, [
    activeRepo,
    handleGenerate,
    openCommitGenerationDialog,
    resolvedCommitMessageAi,
    settings,
    sourceControlAiActionsVisible
  ])

  const handleCancelGenerate = useCallback((): void => {
    if (!activeWorktreeId || !worktreePath || !activeCommitMessageGenerationKey) {
      return
    }
    if (!generateInFlightRef.current[activeWorktreeId]) {
      return
    }
    updateCommitMessageGenerationRecord(activeCommitMessageGenerationKey, (record) =>
      resolveCommitMessageGenerationCancel(record)
    )
    const connectionId = getConnectionId(activeWorktreeId) ?? undefined
    // Why: fire-and-forget — the in-flight generateCommitMessage promise
    // resolves with `{canceled: true}` once the kill propagates, which is
    // where the spinner is cleared. Awaiting here would just delay UI feedback.
    void cancelRuntimeGenerateCommitMessage({
      // Why: route the cancel by the repo OWNER host, not the focused runtime.
      settings: activeRepoSettings,
      worktreeId: activeWorktreeId,
      worktreePath,
      connectionId
    })
  }, [
    activeCommitMessageGenerationKey,
    activeRepoSettings,
    activeWorktreeId,
    updateCommitMessageGenerationRecord,
    worktreePath
  ])

  // Why: a single dispatcher for every remote-only action the split button or
  // chevron dropdown can trigger. Keeps the error-swallow pattern in one
  // place — store slices already surface actionable toasts, so additional
  // try/catch here would duplicate the notification.
  const runRemoteAction = useCallback(
    async (
      kind:
        | 'push'
        | 'force_push'
        | 'pull'
        | 'fast_forward'
        | 'sync'
        | 'fetch'
        | 'publish'
        | 'rebase',
      options?: {
        target?: SourceControlOperationTarget
        remoteStatus?: GitUpstreamStatus
        baseRef?: string | null
      }
    ): Promise<boolean> => {
      const target =
        options?.target ??
        (activeWorktreeId && worktreePath
          ? {
              settings: activeRepoSettings,
              worktreeId: activeWorktreeId,
              worktreePath,
              connectionId: getConnectionId(activeWorktreeId) ?? undefined,
              pushTarget: activeWorktree?.pushTarget
            }
          : null)
      if (!target) {
        return false
      }
      setRemoteActionErrors((prev) => ({ ...prev, [target.worktreeId]: null }))
      try {
        if (kind === 'publish') {
          await pushBranch(
            target.worktreeId,
            target.worktreePath,
            true,
            target.connectionId,
            target.pushTarget,
            { runtimeTargetSettings: target.settings }
          )
          return true
        }
        if (kind === 'push') {
          const forceWithLease = shouldForcePushWithLeaseForUpstream(
            options?.remoteStatus ?? remoteStatus
          )
          await pushBranch(
            target.worktreeId,
            target.worktreePath,
            false,
            target.connectionId,
            target.pushTarget,
            forceWithLease
              ? { forceWithLease: true, runtimeTargetSettings: target.settings }
              : { runtimeTargetSettings: target.settings }
          )
          return true
        }
        if (kind === 'force_push') {
          await pushBranch(
            target.worktreeId,
            target.worktreePath,
            false,
            target.connectionId,
            target.pushTarget,
            { forceWithLease: true, runtimeTargetSettings: target.settings }
          )
          return true
        }
        if (kind === 'pull') {
          await pullBranch(
            target.worktreeId,
            target.worktreePath,
            target.connectionId,
            target.pushTarget,
            {
              runtimeTargetSettings: target.settings
            }
          )
          return true
        }
        if (kind === 'fast_forward') {
          await fastForwardBranch(
            target.worktreeId,
            target.worktreePath,
            target.connectionId,
            target.pushTarget,
            { runtimeTargetSettings: target.settings }
          )
          return true
        }
        if (kind === 'fetch') {
          await fetchBranch(
            target.worktreeId,
            target.worktreePath,
            target.connectionId,
            target.pushTarget,
            {
              runtimeTargetSettings: target.settings
            }
          )
          return true
        }
        if (kind === 'rebase') {
          const baseRef = options?.baseRef ?? effectiveBaseRef
          if (!baseRef) {
            return false
          }
          await rebaseFromBase(
            target.worktreeId,
            target.worktreePath,
            baseRef,
            target.connectionId,
            target.pushTarget,
            { runtimeTargetSettings: target.settings }
          )
          return true
        }
        await syncBranch(
          target.worktreeId,
          target.worktreePath,
          target.connectionId,
          target.pushTarget,
          {
            runtimeTargetSettings: target.settings
          }
        )
        setRemoteActionErrors((prev) => ({ ...prev, [target.worktreeId]: null }))
        return true
      } catch (error) {
        // Why: remote action failures are surfaced by editor-slice actions to keep
        // one consistent toast path and avoid duplicate notifications in the UI.
        // Keep the latest failure inline too: dropdown-only actions like Fetch can
        // otherwise look like nothing happened once the menu closes.
        setRemoteActionErrors((prev) => ({
          ...prev,
          [target.worktreeId]: {
            kind,
            message: resolveRemoteActionError(kind, error)
          }
        }))
        return false
      } finally {
        if (!options?.target) {
          refreshSourceControlAfterRemoteAction({
            refreshGitStatus: refreshActiveGitStatusAfterMutation,
            refreshBranchCompare: refreshBranchCompareRef.current,
            refreshGitHistory: refreshGitHistoryRef.current
          })
        }
      }
    },
    [
      activeRepoSettings,
      activeWorktree?.pushTarget,
      activeWorktreeId,
      fetchBranch,
      fastForwardBranch,
      effectiveBaseRef,
      pullBranch,
      pushBranch,
      rebaseFromBase,
      refreshActiveGitStatusAfterMutation,
      remoteStatus,
      syncBranch,
      worktreePath
    ]
  )

  const handleAbortOperation = useCallback(
    async (requestedOperation: AbortConflictOperation): Promise<void> => {
      if (
        !activeWorktreeId ||
        !worktreePath ||
        conflictOperation !== requestedOperation ||
        isAbortingOperation
      ) {
        return
      }

      const isRebase = requestedOperation === 'rebase'
      const label = isRebase ? 'rebase' : 'merge'
      const title = isRebase ? 'Abort rebase?' : 'Abort merge?'
      const description = isRebase
        ? 'This cancels the rebase in progress and can discard conflict resolutions made during this rebase.'
        : 'This cancels the merge in progress and can discard conflict resolutions made during this merge.'
      const confirmed = await confirmAction({
        title,
        description,
        confirmLabel: `Abort ${label}`,
        confirmVariant: 'destructive'
      })
      if (!confirmed) {
        return
      }

      const connectionId = getConnectionId(activeWorktreeId) ?? undefined
      setAbortOperationInFlightByWorktree((prev) => ({ ...prev, [activeWorktreeId]: true }))
      setRemoteActionErrors((prev) => ({ ...prev, [activeWorktreeId]: null }))
      try {
        const context = {
          // Why: route the abort by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        }
        const abortGitOperation = isRebase ? abortRuntimeGitRebase : abortRuntimeGitMerge
        await abortGitOperation(context)
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to abort ${label}`
        toast.error(
          translate(
            'auto.components.right.sidebar.SourceControl.f99560ab29',
            'Abort {{value0}} failed',
            { value0: label }
          ),
          { description: message }
        )
        setRemoteActionErrors((prev) => ({
          ...prev,
          [activeWorktreeId]: { kind: isRebase ? 'abort_rebase' : 'abort_merge', message }
        }))
      } finally {
        setAbortOperationInFlightByWorktree((prev) => ({ ...prev, [activeWorktreeId]: false }))
        refreshSourceControlAfterRemoteAction({
          refreshGitStatus: refreshActiveGitStatusAfterMutation,
          refreshBranchCompare: refreshBranchCompareRef.current,
          refreshGitHistory: refreshGitHistoryRef.current
        })
      }
    },
    [
      activeRepoSettings,
      activeWorktreeId,
      confirmAction,
      conflictOperation,
      isAbortingOperation,
      refreshActiveGitStatusAfterMutation,
      worktreePath
    ]
  )

  const handleAbortMerge = useCallback(async (): Promise<void> => {
    await handleAbortOperation('merge')
  }, [handleAbortOperation])

  const handleAbortRebase = useCallback(async (): Promise<void> => {
    await handleAbortOperation('rebase')
  }, [handleAbortOperation])

  const handleAbortOperationForConflict = useCallback(
    (operation: GitConflictOperation): void => {
      if (operation === 'merge') {
        void handleAbortMerge()
        return
      }
      if (operation === 'rebase') {
        void handleAbortRebase()
      }
    },
    [handleAbortMerge, handleAbortRebase]
  )

  // Why: compound actions must commit first and only run the follow-up remote
  // op when the commit succeeds. handleCommit's return value carries that
  // signal — a failure leaves commitError populated and short-circuits here
  // so we never push a commit the user didn't actually land. The primary
  // button never takes this path (it always emits a single-action kind);
  // compound flows are reached only from the dropdown, which offers
  // 'commit_push' and 'commit_sync' (there is no 'Commit & Publish' row).
  const runCompoundCommitAction = useCallback(
    async (remoteKind: 'push' | 'sync'): Promise<void> => {
      const ok = await handleCommit()
      if (!ok) {
        return
      }
      await runRemoteAction(remoteKind)
    },
    [handleCommit, runRemoteAction]
  )

  useEffect(() => {
    // Why: direct commit-message generation can finish after Source Control
    // unmounts; the store record lets the remounted textarea consume it once.
    if (
      !activeCommitMessageGenerationKey ||
      !activeWorktreeId ||
      !activeCommitMessageGenerationRecord ||
      activeCommitMessageGenerationRecord.status !== 'succeeded' ||
      !activeCommitMessageGenerationRecord.message ||
      activeCommitMessageGenerationRecord.hydrated
    ) {
      return
    }
    updateCommitDrafts((prev) => {
      const current = prev[activeWorktreeId]
      return current && current.length > 0
        ? prev
        : writeCommitDraftForWorktree(
            prev,
            activeWorktreeId,
            activeCommitMessageGenerationRecord.message ?? ''
          )
    })
    updateCommitMessageGenerationRecord(activeCommitMessageGenerationKey, (record) =>
      markCommitMessageGenerationHydrated(record)
    )
  }, [
    activeCommitMessageGenerationKey,
    activeCommitMessageGenerationRecord,
    activeWorktreeId,
    updateCommitDrafts,
    updateCommitMessageGenerationRecord
  ])

  const hasUnstagedChanges = grouped.unstaged.length > 0 || grouped.untracked.length > 0
  const hasStageableChanges = hasUnstagedChanges
  const hasPartiallyStagedChanges = useMemo(() => {
    if (grouped.staged.length === 0 || grouped.unstaged.length === 0) {
      return false
    }
    const unstagedPaths = new Set(grouped.unstaged.map((entry) => entry.path))
    return grouped.staged.some((entry) => unstagedPaths.has(entry.path))
  }, [grouped.staged, grouped.unstaged])

  const primaryAction: PrimaryAction = useMemo(() => {
    return resolveCommitAreaPrimaryAction({
      stagedCount: grouped.staged.length,
      hasUnstagedChanges,
      hasStageableChanges,
      hasPartiallyStagedChanges,
      hasMessage: commitMessage.trim().length > 0,
      hasUnresolvedConflicts: unresolvedConflicts.length > 0,
      isCommitting,
      isRemoteOperationActive: isRemoteOperationActive || isAbortingOperation,
      upstreamStatus: remoteStatusForActions,
      prState: hostedReviewStateForActions,
      isPRStateLoading: isHostedReviewStateLoading,
      inFlightRemoteOpKind,
      branchCommitsAhead:
        branchSummary?.status === 'ready' ? (branchSummary.commitsAhead ?? 0) : undefined,
      hasCurrentBranch: Boolean(branchName),
      canPushLinkedReviewWithoutUpstream: canUseHostedReviewPushTarget
    })
  }, [
    commitMessage,
    grouped.staged.length,
    hasStageableChanges,
    hasUnstagedChanges,
    hasPartiallyStagedChanges,
    isCommitting,
    isAbortingOperation,
    isRemoteOperationActive,
    inFlightRemoteOpKind,
    isHostedReviewStateLoading,
    hostedReviewStateForActions,
    canUseHostedReviewPushTarget,
    branchSummary?.commitsAhead,
    branchSummary?.status,
    branchName,
    remoteStatusForActions,
    unresolvedConflicts.length
  ])

  const dropdownItems: DropdownEntry[] = useMemo(
    () =>
      resolveDropdownItems({
        stagedCount: grouped.staged.length,
        hasUnstagedChanges,
        hasStageableChanges,
        hasPartiallyStagedChanges,
        hasMessage: commitMessage.trim().length > 0,
        hasUnresolvedConflicts: unresolvedConflicts.length > 0,
        isCommitting,
        isRemoteOperationActive: isRemoteOperationActive || isAbortingOperation,
        conflictOperation,
        upstreamStatus: remoteStatusForActions,
        prState: hostedReviewStateForActions,
        isPRStateLoading: isHostedReviewStateLoading,
        inFlightRemoteOpKind,
        branchCommitsAhead:
          branchSummary?.status === 'ready' ? (branchSummary.commitsAhead ?? 0) : undefined,
        hasCurrentBranch: Boolean(branchName),
        canPushLinkedReviewWithoutUpstream: canUseHostedReviewPushTarget,
        rebaseBaseRef: effectiveBaseRef
      }),
    [
      commitMessage,
      grouped.staged.length,
      hasStageableChanges,
      hasUnstagedChanges,
      hasPartiallyStagedChanges,
      isCommitting,
      conflictOperation,
      isAbortingOperation,
      isRemoteOperationActive,
      inFlightRemoteOpKind,
      isHostedReviewStateLoading,
      hostedReviewStateForActions,
      canUseHostedReviewPushTarget,
      branchSummary?.commitsAhead,
      branchSummary?.status,
      branchName,
      effectiveBaseRef,
      remoteStatusForActions,
      unresolvedConflicts.length
    ]
  )

  // Why: maps both the primary button click and any chevron dropdown item
  // click to the right handler. Commit-ish kinds flow through handleCommit
  // (which returns a boolean); compound actions use runCompoundCommitAction;
  // pure remote actions go through runRemoteAction.
  const handleActionInvoke = useCallback(
    (kind: DropdownActionKind): void => {
      switch (kind) {
        case 'commit':
          void handleCommit()
          return
        case 'commit_push':
          void runCompoundCommitAction('push')
          return
        case 'commit_sync':
          void runCompoundCommitAction('sync')
          return
        case 'abort_merge':
          void handleAbortMerge()
          return
        case 'abort_rebase':
          void handleAbortRebase()
          return
        case 'push':
        case 'force_push':
        case 'pull':
        case 'fast_forward':
        case 'sync':
        case 'fetch':
        case 'publish':
        case 'rebase_base':
          void runRemoteAction(kind === 'rebase_base' ? 'rebase' : kind)
      }
    },
    [handleCommit, handleAbortMerge, handleAbortRebase, runCompoundCommitAction, runRemoteAction]
  )

  // Why: modifier-click should keep the current pane intact by opening the
  // selected Source Control file in a fresh split to the right.
  const resolveSplitTargetGroupId = useCallback(
    (event?: SourceControlRowOpenEvent): string | undefined => {
      if (!event || !activeWorktreeId || !isSourceControlSplitOpenModifier(event, isMac)) {
        return undefined
      }
      const sourceGroupId =
        activeGroupIdByWorktree[activeWorktreeId] ?? groupsByWorktree[activeWorktreeId]?.[0]?.id
      if (!sourceGroupId) {
        return undefined
      }
      return createEmptySplitGroup(activeWorktreeId, sourceGroupId, 'right') ?? undefined
    },
    [activeGroupIdByWorktree, activeWorktreeId, createEmptySplitGroup, groupsByWorktree, isMac]
  )

  // Why: a stable string signature keeps this selector referentially stable so
  // the panel only re-renders when the active editor file (or its diff source)
  // actually changes. Gated on the visible tab being an editor so the highlight
  // clears when the user switches to a terminal or browser surface.
  const activeOpenFileSignature = useAppStore((s) => {
    if (!activeWorktreeId) {
      return null
    }
    if (s.activeTabTypeByWorktree?.[activeWorktreeId] !== 'editor') {
      return null
    }
    const activeFileId = s.activeFileIdByWorktree?.[activeWorktreeId]
    if (!activeFileId) {
      return null
    }
    const activeFile = s.openFiles?.find(
      (file) => file.id === activeFileId && file.worktreeId === activeWorktreeId
    )
    if (!activeFile) {
      return null
    }
    return buildActiveOpenFileSignature(activeFile.diffSource, activeFile.relativePath)
  })

  const activeOpenAvailableRowKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of visibleSelectionEntries) {
      keys.add(entry.key)
    }
    return keys
  }, [visibleSelectionEntries])

  const activeOpenRowKeys = useMemo(
    () => buildActiveOpenRowKeys(activeOpenFileSignature, activeOpenAvailableRowKeys),
    [activeOpenAvailableRowKeys, activeOpenFileSignature]
  )

  const handleOpenDiff = useCallback(
    (entry: GitStatusEntry, event?: SourceControlRowOpenEvent) => {
      if (!activeWorktreeId || !worktreePath) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      const openAsPreview = shouldOpenSourceControlRowAsPreview(event, targetGroupId)
      if (entry.conflictKind && entry.conflictStatus) {
        if (entry.conflictStatus === 'unresolved') {
          trackConflictPath(activeWorktreeId, entry.path, entry.conflictKind)
        }
        openConflictFile(activeWorktreeId, worktreePath, entry, detectLanguage(entry.path), {
          targetGroupId,
          preview: openAsPreview
        })
        return
      }
      const language = detectLanguage(entry.path)
      const filePath = joinPath(worktreePath, entry.path)
      // Why: unstaged markdown diffs open as a normal edit tab in Changes
      // view mode rather than a dedicated diff tab. This unifies sidebar
      // clicks with the header's Edit|Changes toggle: there is exactly one
      // tab per markdown file, and the sidebar click flips that tab's view
      // mode. Staged diffs still open as a separate diff tab because the
      // staged content is not what the editor would be editing. Non-markdown
      // files keep the existing diff-tab flow until the diff-tab type is
      // eventually collapsed (see reviews/changes-view-mode-plan.md §"Follow-up").
      if (language === 'markdown' && entry.area === 'unstaged') {
        openFile(
          {
            filePath,
            relativePath: entry.path,
            worktreeId: activeWorktreeId,
            language,
            mode: 'edit'
          },
          { targetGroupId, preview: openAsPreview }
        )
        setEditorViewMode(filePath, 'changes')
        return
      }
      openDiff(activeWorktreeId, filePath, entry.path, language, entry.area === 'staged', {
        targetGroupId,
        preview: openAsPreview
      })
    },
    [
      activeWorktreeId,
      worktreePath,
      resolveSplitTargetGroupId,
      trackConflictPath,
      openConflictFile,
      openDiff,
      openFile,
      setEditorViewMode
    ]
  )

  const { selectedKeys, handleSelect, handleContextMenu, clearSelection } =
    useSourceControlSelection({
      flatEntries: visibleSelectionEntries,
      onOpenDiff: handleOpenDiff,
      shouldOpenAsSplit: (event) => isSourceControlSplitOpenModifier(event, isMac),
      containerRef: sourceControlRef
    })

  // clear selection on list/tree presentation change
  useEffect(() => {
    clearSelection()
  }, [sourceControlViewMode, clearSelection])

  const handleToggleSourceControlViewMode = useCallback(() => {
    if (!settings) {
      return
    }
    updateSettings({
      sourceControlViewMode: getNextSourceControlViewMode(sourceControlViewMode)
    })
  }, [settings, sourceControlViewMode, updateSettings])

  // Clear selection on worktree or tab change
  useEffect(() => {
    clearSelection()
  }, [activeWorktreeId, rightSidebarTab, clearSelection])

  const flatEntriesByKey = useMemo(
    () => new Map(visibleSelectionEntries.map((entry) => [entry.key, entry])),
    [visibleSelectionEntries]
  )

  const selectedEntries = useMemo(
    () =>
      Array.from(selectedKeys)
        .map((key) => flatEntriesByKey.get(key))
        .filter((entry): entry is FlatEntry => Boolean(entry)),
    [selectedKeys, flatEntriesByKey]
  )

  const bulkStagePaths = useMemo(
    () =>
      selectedEntries
        .filter((entry) => isStageableStatusEntry(entry.entry))
        .map((entry) => entry.entry.path),
    [selectedEntries]
  )

  const bulkUnstagePaths = useMemo(
    () =>
      selectedEntries.filter((entry) => entry.area === 'staged').map((entry) => entry.entry.path),
    [selectedEntries]
  )

  const selectedKeySet = selectedKeys

  const handleBulkStage = useCallback(async () => {
    if (!worktreePath || bulkStagePaths.length === 0) {
      return
    }
    setIsExecutingBulk(true)
    try {
      const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
      await bulkStageRuntimeGitPaths(
        {
          // Why: route staging by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        },
        bulkStagePaths
      )
      await refreshActiveGitStatusAfterMutation()
      clearSelection()
    } finally {
      setIsExecutingBulk(false)
    }
  }, [
    activeRepoSettings,
    worktreePath,
    bulkStagePaths,
    clearSelection,
    activeWorktreeId,
    refreshActiveGitStatusAfterMutation
  ])

  const handleBulkUnstage = useCallback(async () => {
    if (!worktreePath || bulkUnstagePaths.length === 0) {
      return
    }
    setIsExecutingBulk(true)
    try {
      const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
      await bulkUnstageRuntimeGitPaths(
        {
          // Why: route unstaging by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        },
        bulkUnstagePaths
      )
      await refreshActiveGitStatusAfterMutation()
      clearSelection()
    } finally {
      setIsExecutingBulk(false)
    }
  }, [
    activeRepoSettings,
    worktreePath,
    bulkUnstagePaths,
    clearSelection,
    activeWorktreeId,
    refreshActiveGitStatusAfterMutation
  ])

  const handleStageAllPaths = useCallback(
    async (paths: readonly string[]) => {
      if (!worktreePath || isExecutingBulk || paths.length === 0) {
        return
      }
      setIsExecutingBulk(true)
      try {
        const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
        await bulkStageRuntimeGitPaths(
          {
            // Why: route staging by the repo OWNER host, not the focused runtime.
            settings: activeRepoSettings,
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId
          },
          [...paths]
        )
        await refreshActiveGitStatusAfterMutation()
        clearSelection()
      } finally {
        setIsExecutingBulk(false)
      }
    },
    [
      activeRepoSettings,
      activeWorktreeId,
      clearSelection,
      isExecutingBulk,
      refreshActiveGitStatusAfterMutation,
      worktreePath
    ]
  )

  const handleUnstagePaths = useCallback(
    async (paths: readonly string[]) => {
      if (!worktreePath || isExecutingBulk || paths.length === 0) {
        return
      }
      setIsExecutingBulk(true)
      try {
        const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
        await bulkUnstageRuntimeGitPaths(
          {
            // Why: route unstaging by the repo OWNER host, not the focused runtime.
            settings: activeRepoSettings,
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId
          },
          [...paths]
        )
        await refreshActiveGitStatusAfterMutation()
        clearSelection()
      } finally {
        setIsExecutingBulk(false)
      }
    },
    [
      activeRepoSettings,
      activeWorktreeId,
      clearSelection,
      isExecutingBulk,
      refreshActiveGitStatusAfterMutation,
      worktreePath
    ]
  )

  // Why: 'stage' primary stages every unstaged + untracked path in one
  // bulkStage call. It bypasses handleActionInvoke because that handler is
  // typed to DropdownActionKind and 'stage' is intentionally not in the
  // dropdown union — the dropdown surface is unchanged.
  const handleStageAllPrimary = useCallback(async (): Promise<void> => {
    if (!worktreePath || isExecutingBulk) {
      return
    }
    const filePaths = [
      ...getStageAllPaths(grouped.unstaged, 'unstaged'),
      ...getStageAllPaths(grouped.untracked, 'untracked')
    ]
    if (filePaths.length === 0) {
      return
    }
    setIsExecutingBulk(true)
    try {
      const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
      await bulkStageRuntimeGitPaths(
        {
          // Why: route staging by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        },
        filePaths
      )
      await refreshActiveGitStatusAfterMutation()
      clearSelection()
    } finally {
      setIsExecutingBulk(false)
    }
  }, [
    activeRepoSettings,
    worktreePath,
    isExecutingBulk,
    grouped,
    activeWorktreeId,
    clearSelection,
    refreshActiveGitStatusAfterMutation
  ])

  // Why: PrimaryActionKind is narrowed to the single-action kinds the
  // primary can emit ('commit' | 'stage' | 'push' | 'pull' | 'sync' |
  // 'publish') — compound commit_* kinds are dropdown-only. An exhaustive
  // switch keeps the mapping honest: if a new PrimaryActionKind is added,
  // TypeScript lights up the missing case instead of silently falling
  // through. 'stage' routes to a dedicated primary-only handler because
  // handleActionInvoke is typed to DropdownActionKind.
  const handlePrimaryClick = useCallback((): void => {
    switch (primaryAction.kind) {
      case 'stage':
        void handleStageAllPrimary()
        return
      case 'commit':
      case 'push':
      case 'pull':
      case 'sync':
      case 'publish':
        handleActionInvoke(primaryAction.kind)
    }
  }, [handleActionInvoke, handleStageAllPrimary, primaryAction.kind])

  const branchCompareInFlightRef = useRef(false)
  const branchCompareRerunRef = useRef(false)
  const branchCompareRunPromiseRef = useRef<Promise<void> | null>(null)
  const refreshBranchCompareRef = useRef<() => Promise<void>>(async () => {})
  const branchCompareStatusHeadRef = useRef<BranchCompareStatusHeadSnapshot | null>(null)
  const branchCompareRemoteStatusRef = useRef<BranchCompareRemoteStatusSnapshot | null>(null)

  const runBranchCompare = useCallback(async () => {
    if (!activeWorktreeId || !worktreePath || !effectiveBaseRef || isFolder) {
      return
    }

    const requestKey = `${activeWorktreeId}:${effectiveBaseRef}:${Date.now()}`
    const existingSummary =
      useAppStore.getState().gitBranchCompareSummaryByWorktree[activeWorktreeId]

    // Why: only show the loading spinner for the very first branch compare
    // request, or when the base ref has changed (user picked a new one, or
    // getBaseRefDefault corrected a stale cross-repo value).  Polling retries
    // — whether the previous result was 'ready' *or* an error — keep the
    // current UI visible until the new IPC result arrives.  Resetting to
    // 'loading' on every poll when the compare is in an error state caused a
    // visible loading→error→loading→error flicker.
    const baseRefChanged = existingSummary && existingSummary.baseRef !== effectiveBaseRef
    const shouldResetToLoading = !existingSummary || baseRefChanged
    if (shouldResetToLoading) {
      beginGitBranchCompareRequest(activeWorktreeId, requestKey, effectiveBaseRef)
    } else {
      beginGitBranchCompareRequest(activeWorktreeId, requestKey, effectiveBaseRef, {
        preserveExistingSummary: true
      })
    }

    try {
      const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
      const result = await getRuntimeGitBranchCompare(
        {
          // Why: route the branch compare by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        },
        effectiveBaseRef
      )
      setGitBranchCompareResult(activeWorktreeId, requestKey, result)
    } catch (error) {
      setGitBranchCompareResult(activeWorktreeId, requestKey, {
        summary: {
          baseRef: effectiveBaseRef,
          baseOid: null,
          compareRef: branchName,
          headOid: null,
          mergeBase: null,
          changedFiles: 0,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Branch compare failed'
        },
        entries: []
      })
    }
  }, [
    activeRepoSettings,
    activeWorktreeId,
    beginGitBranchCompareRequest,
    branchName,
    effectiveBaseRef,
    isFolder,
    setGitBranchCompareResult,
    worktreePath
  ])

  const refreshBranchCompare = useCallback(async () => {
    if (branchCompareInFlightRef.current) {
      branchCompareRerunRef.current = true
      return branchCompareRunPromiseRef.current ?? undefined
    }

    branchCompareInFlightRef.current = true
    const runPromise = (async (): Promise<void> => {
      // Why: branch compare shells out to git from both event-driven refreshes
      // and the fallback timer. Keep one compare chain in flight and
      // collapse skipped ticks into one trailing refresh instead of stacking
      // subprocesses while preserving the await contract for direct callers.
      try {
        await runBranchCompare()
      } finally {
        branchCompareInFlightRef.current = false
        if (branchCompareRerunRef.current) {
          branchCompareRerunRef.current = false
          await refreshBranchCompareRef.current()
        }
      }
    })()
    branchCompareRunPromiseRef.current = runPromise
    try {
      await runPromise
    } finally {
      if (branchCompareRunPromiseRef.current === runPromise) {
        branchCompareRunPromiseRef.current = null
      }
    }
  }, [runBranchCompare])

  refreshBranchCompareRef.current = refreshBranchCompare

  const refreshGitHistory = useCallback(async (): Promise<void> => {
    if (
      !activeWorktreeId ||
      !worktreePath ||
      isFolder ||
      !isBranchVisible ||
      !isGitHistoryExpanded ||
      !isGitHistoryVisible
    ) {
      return
    }

    const worktreeId = activeWorktreeId
    const requestId = gitHistoryRequestSeqRef.current + 1
    gitHistoryRequestSeqRef.current = requestId
    gitHistoryRequestByWorktreeRef.current[worktreeId] = requestId
    setGitHistoryByWorktree((prev) => {
      const previous = prev[worktreeId]
      return {
        ...prev,
        [worktreeId]: previous?.result
          ? { status: 'refreshing', result: previous.result }
          : { status: 'loading' }
      }
    })

    try {
      const connectionId = getConnectionId(worktreeId) ?? undefined
      const result = await getRuntimeGitHistory(
        {
          // Why: route the history read by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId,
          worktreePath,
          connectionId
        },
        { limit: 50, baseRef: effectiveBaseRef }
      )
      if (gitHistoryRequestByWorktreeRef.current[worktreeId] !== requestId) {
        return
      }
      setGitHistoryByWorktree((prev) => ({ ...prev, [worktreeId]: { status: 'ready', result } }))
    } catch (error) {
      if (gitHistoryRequestByWorktreeRef.current[worktreeId] !== requestId) {
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to load commits'
      setGitHistoryByWorktree((prev) => {
        const previous = prev[worktreeId]
        return {
          ...prev,
          [worktreeId]: previous?.result
            ? { status: 'error', result: previous.result, error: message }
            : { status: 'error', error: message }
        }
      })
    }
  }, [
    activeRepoSettings,
    activeWorktreeId,
    effectiveBaseRef,
    isBranchVisible,
    isFolder,
    isGitHistoryExpanded,
    isGitHistoryVisible,
    worktreePath
  ])

  const refreshGitHistoryRef = useRef(refreshGitHistory)
  refreshGitHistoryRef.current = refreshGitHistory

  useEffect(() => {
    if (!activeWorktreeId || !worktreePath || !isBranchVisible || !effectiveBaseRef || isFolder) {
      branchCompareStatusHeadRef.current = null
      return
    }

    const current = {
      baseRef: effectiveBaseRef,
      statusHead: activeGitStatusHead,
      worktreeId: activeWorktreeId
    }
    const previous = branchCompareStatusHeadRef.current
    branchCompareStatusHeadRef.current = current
    if (shouldRefreshBranchCompareForStatusHead(previous, current)) {
      void refreshBranchCompareRef.current()
    }
  }, [
    activeGitStatusHead,
    activeWorktreeId,
    effectiveBaseRef,
    isBranchVisible,
    isFolder,
    worktreePath
  ])

  useEffect(() => {
    if (!activeWorktreeId || !worktreePath || !isBranchVisible || !effectiveBaseRef || isFolder) {
      branchCompareRemoteStatusRef.current = null
      return
    }

    // Why: pushing a branch can move its remote-tracking base and ahead count
    // without changing local HEAD, so the HEAD-change effect alone misses it.
    const current = {
      ahead: remoteStatus?.ahead ?? null,
      baseRef: effectiveBaseRef,
      behind: remoteStatus?.behind ?? null,
      hasUpstream: remoteStatus?.hasUpstream ?? null,
      upstreamName: remoteStatus?.upstreamName ?? null,
      worktreeId: activeWorktreeId
    }
    const previous = branchCompareRemoteStatusRef.current
    branchCompareRemoteStatusRef.current = current
    if (shouldRefreshBranchCompareForRemoteStatus(previous, current)) {
      void refreshBranchCompareRef.current()
    }
  }, [
    activeWorktreeId,
    effectiveBaseRef,
    isBranchVisible,
    isFolder,
    remoteStatus?.ahead,
    remoteStatus?.behind,
    remoteStatus?.hasUpstream,
    remoteStatus?.upstreamName,
    worktreePath
  ])

  useEffect(() => {
    if (!activeWorktreeId || !worktreePath || !isBranchVisible || !effectiveBaseRef || isFolder) {
      return
    }

    // Why: git-status HEAD changes refresh branch compare immediately. Keep a
    // visible-window fallback for base refs or remote updates that do not move HEAD.
    return installWindowVisibilityInterval({
      run: () => void refreshBranchCompareRef.current(),
      intervalMs: BRANCH_REFRESH_INTERVAL_MS
    })
  }, [activeWorktreeId, effectiveBaseRef, isBranchVisible, isFolder, worktreePath])

  useEffect(() => {
    // Why: history shells out to git. Defer the first load until the user
    // expands Commits so source control stays cheap for large/remote repos.
    if (!isBranchVisible || !isGitHistoryExpanded || !isGitHistoryVisible) {
      return
    }
    void refreshGitHistoryRef.current()
  }, [
    activeWorktreeId,
    effectiveBaseRef,
    isBranchVisible,
    isFolder,
    isGitHistoryExpanded,
    isGitHistoryVisible,
    worktreePath
  ])

  useEffect(() => {
    // Why: gate on isBranchVisible so we don't spawn git processes while the
    // sidebar is closed. Store-slice remote operations refresh upstream-status
    // on success anyway, so the user's first sidebar open will show accurate
    // state.
    if (!activeWorktreeId || !worktreePath || isFolder || !isBranchVisible) {
      return
    }
    const connectionId = getConnectionId(activeWorktreeId) ?? undefined
    void fetchUpstreamStatus(
      activeWorktreeId,
      worktreePath,
      connectionId,
      activeWorktree?.pushTarget,
      { runtimeTargetSettings: activeRepoSettings }
    )
  }, [
    activeRepoSettings,
    activeWorktree?.pushTarget,
    activeWorktreeId,
    fetchUpstreamStatus,
    isBranchVisible,
    isFolder,
    worktreePath
  ])

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }, [])

  const toggleTreeDir = useCallback((key: string) => {
    setCollapsedTreeDirs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const openCommittedDiff = useCallback(
    (entry: GitBranchChangeEntry, event?: SourceControlRowOpenEvent) => {
      if (
        !activeWorktreeId ||
        !worktreePath ||
        !branchSummary ||
        branchSummary.status !== 'ready'
      ) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      openBranchDiff(
        activeWorktreeId,
        worktreePath,
        entry,
        branchSummary,
        detectLanguage(entry.path),
        { targetGroupId, preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId) }
      )
    },
    [activeWorktreeId, branchSummary, openBranchDiff, resolveSplitTargetGroupId, worktreePath]
  )

  const { loadCommitFiles, openHistoryCommitDiff, openCommitFile, handleCommitAction } =
    useGitHistoryCommitActions({
      activeWorktreeId,
      worktreePath,
      activeRepoSettings,
      resolveSplitTargetGroupId
    })

  // Why: a note's filePath is the same relative path used by GitStatusEntry /
  // GitBranchChangeEntry, so we can route the click to whichever diff surface
  // currently owns that file. Prefer the `unstaged` entry when a path is also
  // staged — diff comments are authored against the working-tree (unstaged)
  // diff card. Fall back to the branch compare, and finally just open the
  // file as a normal editor tab so the user still gets navigation when
  // neither side has the path anymore. When `commentId` is supplied and the
  // route lands on a diff surface, also stamp scrollToDiffCommentId so the
  // diff decorator scrolls that note into view; we clear any prior request
  // first, so the editor-tab fallback then leaves the global null and a
  // future DiffViewer mount can't accidentally consume a stale id.
  const handleOpenComment = useCallback(
    (comment: DiffComment) => {
      if (!activeWorktreeId || !worktreePath) {
        return
      }
      const filePath = comment.filePath
      const commentId = comment.id
      // Defensively clear any dangling prior scroll request before routing
      // this click; only the diff branches below will re-stamp it.
      cancelSourceControlEditorRevealFrames(pendingCommentEditorRevealFrameIdsRef)
      setScrollToDiffCommentId(null)
      if (getDiffCommentSource(comment) === 'markdown') {
        const absPath = joinPath(worktreePath, filePath)
        const language = detectLanguage(filePath)
        setEditorViewMode(absPath, 'edit')
        setMarkdownViewMode(absPath, 'source')
        openFile({
          filePath: absPath,
          relativePath: filePath,
          worktreeId: activeWorktreeId,
          language,
          mode: 'edit'
        })
        setPendingEditorReveal(null)
        requestSourceControlEditorRevealFrame(pendingCommentEditorRevealFrameIdsRef, () => {
          requestSourceControlEditorRevealFrame(pendingCommentEditorRevealFrameIdsRef, () => {
            setPendingEditorReveal({
              filePath: absPath,
              line: comment.lineNumber,
              column: 1,
              matchLength: 0
            })
            setScrollToDiffCommentId(commentId)
          })
        })
        return
      }
      const matches = entries.filter((e) => e.path === filePath)
      const uncommitted =
        matches.find((e) => e.area === 'unstaged') ??
        matches.find((e) => e.area === 'untracked') ??
        matches[0]
      if (uncommitted) {
        handleOpenDiff(uncommitted)
        if (commentId) {
          setScrollToDiffCommentId(commentId)
        }
        return
      }
      const branchEntry = branchEntries.find((e) => e.path === filePath)
      if (branchEntry && branchSummary?.status === 'ready') {
        openCommittedDiff(branchEntry)
        if (commentId) {
          setScrollToDiffCommentId(commentId)
        }
        return
      }
      // Why: fall through to a normal editor tab when neither the working-tree
      // nor branch-compare diff has the file (e.g. the change has since been
      // committed and merged, but the note still references the file). Force
      // the editor tab into 'changes' mode and stamp scrollToDiffCommentId so
      // the DiffViewer that EditorContent renders in changes mode picks up
      // the scroll request — same surface the user can flip into manually
      // via the editor's Edit/Changes toggle.
      const absPath = joinPath(worktreePath, filePath)
      const language = detectLanguage(filePath)
      openFile({
        filePath: absPath,
        relativePath: filePath,
        worktreeId: activeWorktreeId,
        language,
        mode: 'edit'
      })
      if (commentId) {
        setEditorViewMode(absPath, 'changes')
        setScrollToDiffCommentId(commentId)
      }
    },
    [
      activeWorktreeId,
      branchEntries,
      branchSummary,
      entries,
      handleOpenDiff,
      openCommittedDiff,
      openFile,
      setEditorViewMode,
      setScrollToDiffCommentId,
      setMarkdownViewMode,
      setPendingEditorReveal,
      worktreePath
    ]
  )

  const handleStage = useCallback(
    async (filePath: string) => {
      if (!worktreePath) {
        return
      }
      try {
        const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
        await stageRuntimeGitPath(
          {
            // Why: route staging by the repo OWNER host, not the focused runtime.
            settings: activeRepoSettings,
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId
          },
          filePath
        )
        await refreshActiveGitStatusAfterMutation()
      } catch {
        // git operation failed silently
      }
    },
    [activeRepoSettings, worktreePath, activeWorktreeId, refreshActiveGitStatusAfterMutation]
  )

  const handleUnstage = useCallback(
    async (filePath: string) => {
      if (!worktreePath) {
        return
      }
      try {
        const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
        await unstageRuntimeGitPath(
          {
            // Why: route unstaging by the repo OWNER host, not the focused runtime.
            settings: activeRepoSettings,
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId
          },
          filePath
        )
        await refreshActiveGitStatusAfterMutation()
      } catch {
        // git operation failed silently
      }
    },
    [activeRepoSettings, worktreePath, activeWorktreeId, refreshActiveGitStatusAfterMutation]
  )

  // Why: split into two variants — `discardSingle` throws so bulk callers can
  // aggregate failures into a single toast via `runDiscardAllForArea`'s
  // onError, while `handleDiscard` swallows for the per-row fire-and-forget UI
  // contract (no individual failure toast).
  const discardSingle = useCallback(
    async (filePath: string) => {
      if (!worktreePath || !activeWorktreeId) {
        return
      }
      const runtimeEnvironmentId =
        useAppStore.getState().settings?.activeRuntimeEnvironmentId?.trim() || null
      // Why: git discard replaces the working tree version of this file. Any
      // pending editor autosave must be quiesced first so it cannot recreate
      // the discarded edits after git restores the file.
      await requestEditorSaveQuiesce({
        worktreeId: activeWorktreeId,
        worktreePath,
        relativePath: filePath,
        runtimeEnvironmentId
      })
      const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
      await discardRuntimeGitPath(
        {
          // Why: route the discard by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        },
        filePath
      )
      notifyEditorExternalFileChange({
        worktreeId: activeWorktreeId,
        worktreePath,
        relativePath: filePath,
        runtimeEnvironmentId
      })
    },
    [activeRepoSettings, activeWorktreeId, worktreePath]
  )

  const discardMany = useCallback(
    async (filePaths: string[]) => {
      if (!worktreePath || !activeWorktreeId) {
        return
      }
      const runtimeEnvironmentId =
        useAppStore.getState().settings?.activeRuntimeEnvironmentId?.trim() || null
      // Why: bulk discard replaces many working-tree files at once. Quiesce
      // any matching editor autosaves before git mutates the files so a delayed
      // save cannot recreate edits after the restore.
      await Promise.all(
        filePaths.map((relativePath) =>
          requestEditorSaveQuiesce({
            worktreeId: activeWorktreeId,
            worktreePath,
            relativePath,
            runtimeEnvironmentId
          })
        )
      )
      const connectionId = getConnectionId(activeWorktreeId) ?? undefined
      await bulkDiscardRuntimeGitPaths(
        {
          // Why: route the discard by the repo OWNER host, not the focused runtime.
          settings: activeRepoSettings,
          worktreeId: activeWorktreeId,
          worktreePath,
          connectionId
        },
        filePaths
      )
      for (const relativePath of filePaths) {
        notifyEditorExternalFileChange({
          worktreeId: activeWorktreeId,
          worktreePath,
          relativePath,
          runtimeEnvironmentId
        })
      }
    },
    [activeRepoSettings, activeWorktreeId, worktreePath]
  )

  const handleDiscard = useCallback(
    async (filePath: string) => {
      try {
        await discardSingle(filePath)
        await refreshActiveGitStatusAfterMutation()
      } catch {
        // Why: per-row discard is fire-and-forget for the UI; failures are not
        // surfaced individually. Bulk callers use `discardSingle` directly so
        // they can aggregate failures into a single toast.
      }
    },
    [discardSingle, refreshActiveGitStatusAfterMutation]
  )

  // Why: "Discard all" mirrors the per-row discard rules — it skips unresolved
  // and resolved_locally rows because discarding those can silently re-create
  // the conflict or lose the resolution (no v1 UX to explain this clearly).
  // The happy path uses bulk discard IPC; the sequencing helper falls back to
  // per-file discard when an older SSH relay does not support that method yet.
  // The sequencing + filter rules live in discard-all-sequence.ts so they can
  // be unit-tested independently of the full component (staged area needs a
  // bulk-unstage first, and a failed unstage must skip the discard loop).
  const handleRevertAllInArea = useCallback(
    async (area: DiscardAllArea, confirmedPaths?: readonly string[]) => {
      if (!worktreePath || !activeWorktreeId || isExecutingBulk) {
        return
      }
      const paths = confirmedPaths ? [...confirmedPaths] : getDiscardAllPaths(grouped[area], area)
      if (paths.length === 0) {
        return
      }
      setIsExecutingBulk(true)
      try {
        const connectionId = getConnectionId(activeWorktreeId) ?? undefined
        // Why: `onError` fires once per failure — both for the bulk-unstage
        // pre-step and for each per-file discard failure. Aggregate into one
        // toast after the sequence completes so a partial failure across N
        // files doesn't spam N error toasts.
        const errors: unknown[] = []
        const result = await runDiscardAllForArea(area, paths, {
          bulkUnstage: (filePaths) =>
            bulkUnstageRuntimeGitPaths(
              {
                // Why: route unstaging by the repo OWNER host, not the focused runtime.
                settings: activeRepoSettings,
                worktreeId: activeWorktreeId,
                worktreePath,
                connectionId
              },
              filePaths
            ),
          discardMany,
          discardOne: discardSingle,
          onError: (error) => {
            errors.push(error)
            console.error('[SourceControl] discard-all failure', error)
          }
        })
        if (result.aborted) {
          toast.error(
            translate(
              'auto.components.right.sidebar.SourceControl.a5e5a11090',
              'Discard all failed — unable to unstage files before discard'
            ),
            {
              description: errors[0] instanceof Error ? errors[0].message : undefined
            }
          )
        } else if (result.failed.length > 0) {
          // Why: only include the first error message to avoid a huge toast
          // body on bulk failures; a short sample of failed paths gives users
          // enough context to retry or investigate.
          const firstMsg = errors[0] instanceof Error ? errors[0].message : undefined
          const sample = result.failed.slice(0, 3).join(', ')
          const more = result.failed.length > 3 ? `, +${result.failed.length - 3} more` : ''
          toast.error(
            translate(
              'auto.components.right.sidebar.SourceControl.8eb3782a0c',
              'Failed to discard {{value0}} file{{value1}}',
              { value0: result.failed.length, value1: result.failed.length === 1 ? '' : 's' }
            ),
            {
              description: firstMsg
                ? translate(
                    'auto.components.right.sidebar.SourceControl.dc5a6465fc',
                    '{{value0}} (e.g. {{value1}}{{value2}})',
                    { value0: firstMsg, value1: sample, value2: more }
                  )
                : `${sample}${more}`
            }
          )
        }
        if (!result.aborted) {
          await refreshActiveGitStatusAfterMutation()
          clearSelection()
        }
      } finally {
        setIsExecutingBulk(false)
      }
    },
    [
      activeRepoSettings,
      worktreePath,
      activeWorktreeId,
      grouped,
      isExecutingBulk,
      clearSelection,
      discardMany,
      discardSingle,
      refreshActiveGitStatusAfterMutation
    ]
  )

  const requestDiscardAllInArea = useCallback(
    (area: DiscardAllArea, confirmedPaths?: readonly string[]): void => {
      if (!worktreePath || !activeWorktreeId || isExecutingBulk) {
        return
      }
      const paths = confirmedPaths ? [...confirmedPaths] : getDiscardAllPaths(grouped[area], area)
      if (paths.length === 0) {
        return
      }
      setPendingDiscard({ kind: 'area', area, paths })
    },
    [activeWorktreeId, grouped, isExecutingBulk, worktreePath]
  )

  const requestDiscardEntry = useCallback(
    (entry: GitStatusEntry): void => {
      if (!worktreePath || !activeWorktreeId || isExecutingBulk) {
        return
      }
      setPendingDiscard({ kind: 'entry', entry })
    },
    [activeWorktreeId, isExecutingBulk, worktreePath]
  )

  const confirmPendingDiscard = useCallback((): void => {
    const pending = pendingDiscard
    if (!pending) {
      return
    }
    setPendingDiscard(null)
    if (pending.kind === 'entry') {
      void handleDiscard(pending.entry.path)
      return
    }
    void handleRevertAllInArea(pending.area, pending.paths)
  }, [handleDiscard, handleRevertAllInArea, pendingDiscard])

  if (!activeWorktree || !activeRepo || !worktreePath) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground px-4 text-center">
        {translate(
          'auto.components.right.sidebar.SourceControl.c07b236287',
          'Select a workspace to view changes'
        )}
      </div>
    )
  }
  if (isFolder) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground px-4 text-center">
        {translate(
          'auto.components.right.sidebar.SourceControl.e131cd7128',
          'Source Control is only available for Git repositories'
        )}
      </div>
    )
  }

  const hasFilteredUncommittedEntries =
    filteredGrouped.staged.length > 0 ||
    filteredGrouped.unstaged.length > 0 ||
    filteredGrouped.untracked.length > 0
  const hasFilteredBranchEntries = filteredBranchEntries.length > 0
  const showGenericEmptyState =
    !hasUncommittedEntries && branchSummary?.status === 'ready' && branchEntries.length === 0
  const currentWorktreeId = activeWorktree.id

  return (
    <>
      <div ref={setSourceControlRoot} className="relative flex h-full flex-col overflow-hidden">
        <SourceControlHeaderToolbar
          filterQuery={filterQuery}
          filterExpanded={filterExpanded}
          onFilterQueryChange={setFilterQuery}
          onFilterExpandedChange={setFilterExpanded}
          sourceControlViewMode={sourceControlViewMode}
          viewModeToggleDisabled={settings === null}
          onToggleViewMode={handleToggleSourceControlViewMode}
          onChangeBaseRef={() => setBaseRefDialogOpen(true)}
          onRefreshBranchCompare={() => void refreshBranchCompare()}
          branchCompareRefreshDisabled={!branchSummary || branchSummary.status === 'loading'}
          diffCommentCount={diffCommentCount}
          onExpandNotes={() => setDiffCommentsExpanded(true)}
          branchSummary={branchSummary}
          compareBaseRef={effectiveBaseRef}
          upstreamStatus={remoteStatus}
        />

        {detachedHeadDisplay && (
          <div className="border-b border-border px-3 py-2">
            <DetachedHeadBadge display={detachedHeadDisplay} side="bottom" />
          </div>
        )}

        {/* Why: Diff-comments live on the worktree and apply across every diff
            view the user opens. The header row expands inline to show per-file
            comment previews plus a Copy-all action so the user can hand the
            set off to whichever tool they want without leaving the sidebar.
            Hidden when count is 0: notes are created from the diff view, so
            an empty Notes shelf in the sidebar is pure chrome — it adds a
            border, a row of space, and an expand control that only reveals
            a redirect hint. */}
        {activeWorktreeId && worktreePath && diffCommentCount > 0 && (
          <div className="border-b border-border">
            <div className="flex items-center gap-1 pl-3 pr-2 py-1.5">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setDiffCommentsExpanded((prev) => !prev)}
                aria-expanded={diffCommentsExpanded}
                title={
                  diffCommentsExpanded
                    ? translate(
                        'auto.components.right.sidebar.SourceControl.d13edef890',
                        'Collapse notes'
                      )
                    : translate(
                        'auto.components.right.sidebar.SourceControl.72f2bea3f4',
                        'Expand notes'
                      )
                }
              >
                <ChevronDown
                  className={cn(
                    'size-3 shrink-0 transition-transform',
                    !diffCommentsExpanded && '-rotate-90'
                  )}
                />
                <MessageSquare className="size-3.5 shrink-0" />
                <span>
                  {translate('auto.components.right.sidebar.SourceControl.cc474e0b8c', 'Notes')}
                </span>
                {diffCommentCount > 0 && (
                  <span className="text-[11px] leading-none text-muted-foreground tabular-nums">
                    {diffCommentCount}
                  </span>
                )}
              </button>
              <div className="ml-1 flex shrink-0 items-center gap-1.5">
                <DiffNotesSendMenu
                  worktreeId={activeWorktreeId}
                  groupId={activeGroupId ?? activeWorktreeId}
                  comments={diffCommentsForActive}
                  triggerClassName="size-6"
                />
                {diffCommentCount > 0 && (
                  <TooltipProvider delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          onClick={() => void handleCopyDiffComments()}
                          aria-label={translate(
                            'auto.components.right.sidebar.SourceControl.3baf6c77b4',
                            'Copy all notes to clipboard'
                          )}
                        >
                          {diffCommentsCopied ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6}>
                        {translate(
                          'auto.components.right.sidebar.SourceControl.eae2d051af',
                          'Copy all notes'
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <DropdownMenu>
                  <TooltipProvider delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label={translate(
                              'auto.components.right.sidebar.SourceControl.2fe2a67580',
                              'More note actions'
                            )}
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6}>
                        {translate(
                          'auto.components.right.sidebar.SourceControl.2fe2a67580',
                          'More note actions'
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={diffCommentCount === 0}
                      onSelect={() => {
                        if (!activeWorktreeId || diffCommentCount === 0) {
                          return
                        }
                        setPendingDiffCommentsClear({ kind: 'all', worktreeId: activeWorktreeId })
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      {translate(
                        'auto.components.right.sidebar.SourceControl.1406954883',
                        'Clear all notes...'
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {diffCommentsExpanded && (
              <DiffCommentsInlineList
                comments={diffCommentsForActive}
                onDelete={(id) => void deleteDiffComment(activeWorktreeId, id)}
                onOpen={(comment) => handleOpenComment(comment)}
                onClearFile={(filePath) =>
                  setPendingDiffCommentsClear({
                    kind: 'file',
                    worktreeId: activeWorktreeId,
                    filePath
                  })
                }
              />
            )}
          </div>
        )}

        <div
          className="relative flex flex-1 flex-col overflow-auto scrollbar-sleek pt-1"
          style={{ paddingBottom: selectedKeys.size > 0 ? 50 : undefined }}
        >
          {unresolvedConflictReviewEntries.length > 0 && (
            <div className="px-3 pb-2">
              <ConflictSummaryCard
                conflictOperation={conflictOperation}
                unresolvedCount={unresolvedConflictReviewEntries.length}
                sourceControlAiActionsVisible={sourceControlAiActionsVisible}
                isResolvingWithAI={false}
                isAbortingOperation={isAbortingOperation}
                onAbortOperation={handleAbortOperationForConflict}
                onResolveWithAI={() => {
                  void handleResolveConflictsWithAI()
                }}
                onReview={() => {
                  if (!activeWorktreeId || !worktreePath) {
                    return
                  }
                  openConflictReview(
                    activeWorktreeId,
                    worktreePath,
                    unresolvedConflictReviewEntries,
                    'live-summary'
                  )
                }}
              />
            </div>
          )}
          {/* Why: show operation banner when rebase/merge/cherry-pick is in progress
              but there are no unresolved conflicts (e.g. between rebase steps, or
              after resolving all conflicts before running --continue). The
              ConflictSummaryCard handles the "has conflicts" case above. */}
          {unresolvedConflictReviewEntries.length === 0 && conflictOperation !== 'unknown' && (
            <div className="px-3 pb-2">
              <OperationBanner
                conflictOperation={conflictOperation}
                isAbortingOperation={isAbortingOperation}
                onAbortOperation={handleAbortOperationForConflict}
              />
            </div>
          )}

          {repositoryHuge && (
            <div className="px-3 pb-2">
              <TooManyChangesBanner limit={repositoryHuge.limit} />
            </div>
          )}

          {showGenericEmptyState && !normalizedFilter ? (
            <EmptyState
              heading="No changes on this branch"
              supportingText={`This workspace is clean and this branch has no changes ahead of ${branchSummary?.baseRef ?? 'base'}`}
            />
          ) : null}

          {fileFilterState.tooLarge && (
            <EmptyState
              heading="Search text is too large"
              supportingText="Use a shorter file filter."
            />
          )}

          {normalizedFilter && !hasFilteredUncommittedEntries && !hasFilteredBranchEntries && (
            <EmptyState
              heading="No matching files"
              supportingText={`No changed files match "${filterQuery}"`}
            />
          )}

          {/* Why: keep CommitArea mounted across normal source-control states.
              The split-button primary rotates through Push / Pull / Sync /
              Publish on a clean tree and disables Commit with a "Nothing to
              commit" tooltip when nothing is staged — gating on
              hasUncommittedEntries (added by #1448 for the older Commit-only
              design) would unmount the whole action surface on clean
              worktrees and tear it down mid-commit when the staged list
              clears. Active merge/rebase/cherry-pick operations are the
              exception: commits would be misleading before the user continues
              or aborts the operation. */}
          {activeWorktree?.pushTarget && activeWorktree.pushTarget.remoteName !== 'origin' ? (
            <div
              className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
              title={translate(
                'auto.components.right.sidebar.SourceControl.c05fe04839',
                'Pushes to the fork at {{value0}} (not origin)',
                { value0: activeWorktree.pushTarget.remoteName }
              )}
            >
              <GitFork className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {translate(
                  'auto.components.right.sidebar.SourceControl.78ce2d37ac',
                  'Pushes to fork'
                )}
                {describeForkPushTarget(activeWorktree.pushTarget)}
              </span>
            </div>
          ) : null}

          {shouldRenderCommitArea(unresolvedConflicts.length, conflictOperation) && (
            <CommitArea
              worktreeId={activeWorktreeId}
              connectionId={activeConnectionId}
              repoId={activeRepo?.id ?? null}
              launchPlatform={activeSourceControlLaunchPlatform}
              commitMessage={commitMessage}
              commitError={commitError}
              commitFailureRecoveryPrompt={commitFailureRecoveryPrompt}
              remoteActionError={remoteActionError?.message ?? null}
              isCommitting={isCommitting}
              isFixingCommitFailureWithAI={isLaunchingCommitFailureAgent}
              groupId={activeGroupId ?? activeWorktreeId}
              showComposer={!showGenericEmptyState}
              sourceControlAiActionsVisible={sourceControlAiActionsVisible}
              aiEnabled={sourceControlAiActionsVisible && resolvedCommitMessageAi?.ok === true}
              aiAgentConfigured={resolvedCommitMessageAi?.ok === true}
              isGenerating={isGenerating}
              generateError={generateError}
              stagedCount={grouped.staged.length}
              hasPartiallyStagedChanges={hasPartiallyStagedChanges}
              hasUnresolvedConflicts={unresolvedConflicts.length > 0}
              isRemoteOperationActive={isRemoteOperationActive || isAbortingOperation}
              inFlightRemoteOpKind={inFlightRemoteOpKind}
              primaryAction={primaryAction}
              dropdownItems={dropdownItems}
              fixCommitFailureRecipe={getLaunchActionRecipe('fixCommitFailure')}
              onCommitMessageChange={(value) => {
                if (!activeWorktreeId) {
                  return
                }
                updateCommitDrafts((prev) =>
                  writeCommitDraftForWorktree(prev, activeWorktreeId, value)
                )
              }}
              onGenerate={handleGenerateCommitMessageClick}
              onCancelGenerate={handleCancelGenerate}
              onSaveLaunchActionDefault={saveLaunchActionDefault}
              onOpenSourceControlAiSettings={openSourceControlAiSettings}
              onFixCommitFailureWithAI={handleFixCommitFailureWithAI}
              onPrimaryAction={handlePrimaryClick}
              onDropdownAction={handleActionInvoke}
            />
          )}

          {hasFilteredUncommittedEntries && (
            <>
              {displaySections.map((section) => {
                const { area, id, items } = section
                const isCollapsed = collapsedSections.has(id)
                // Why: "Stage all"/"Unstage all" operate on the *unfiltered*
                // group for the area — acting on just the filter-visible subset
                // would surprise users who don't realize a filter is active.
                // The +/- is hidden when the filter is active to avoid that
                // mismatch between what's shown and what would be staged.
                // Why: visibility and execution both resolve paths through the
                // same eligibility rules as the handlers so the button can
                // never show for a set the handler would then filter to empty.
                const actionSection = unfilteredDisplaySectionsById.get(id) ?? section
                const actionItems = actionSection.items
                const stageAllPaths = actionItems
                  .filter(isStageableStatusEntry)
                  .map((entry) => entry.path)
                const unstageAllPaths = getUnstageAllPaths(actionItems)
                const discardAllPaths = getDiscardAllPaths(actionItems, area)
                const canStageAll = !normalizedFilter && stageAllPaths.length > 0
                const canUnstageAll = !normalizedFilter && unstageAllPaths.length > 0
                const canRevertAll = !normalizedFilter && discardAllPaths.length > 0
                const sectionLabel =
                  id === 'conflicts' ? CONFLICTS_SECTION_LABEL : SECTION_LABELS[area]
                const sectionViewAction = getSourceControlSectionViewAction(actionSection)
                return (
                  <div key={id}>
                    <SectionHeader
                      label={translate(sectionLabel.key, sectionLabel.fallback)}
                      count={items.length}
                      conflictCount={
                        items.filter((entry) => entry.conflictStatus === 'unresolved').length
                      }
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleSection(id)}
                      actions={
                        <>
                          {/* Why: bulk action buttons are hover-only on
                              pointer devices to avoid cluttering the section
                              header with persistent icons. On no-hover
                              pointers (touch, and SSH sessions where hover
                              state is unreliable — see AGENTS.md "SSH Use
                              Case"), force them visible so they're reachable
                              without tabbing. One outer wrapper so that
                              focusing any action reveals all three siblings —
                              otherwise keyboard users tab into an invisible
                              next stop. */}
                          <div className="flex items-center can-hover:opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
                            {canRevertAll && (
                              <ActionButton
                                icon={area === 'untracked' ? Trash : Undo2}
                                // Why: for untracked files, discard deletes the file
                                // outright (rm -rf via git.discard's untracked branch).
                                // A generic "Discard all" label hides that severity —
                                // label explicitly for the destructive variant.
                                title={
                                  area === 'untracked'
                                    ? translate(
                                        'auto.components.right.sidebar.SourceControl.2f609a2e7c',
                                        'Delete all untracked'
                                      )
                                    : translate(
                                        'auto.components.right.sidebar.SourceControl.ce41708855',
                                        'Discard all'
                                      )
                                }
                                onClick={(event) => {
                                  event.stopPropagation()
                                  requestDiscardAllInArea(area, discardAllPaths)
                                }}
                                disabled={isExecutingBulk}
                              />
                            )}
                            {canStageAll && (
                              <ActionButton
                                icon={Plus}
                                title={translate(
                                  'auto.components.right.sidebar.SourceControl.24d2598eff',
                                  'Stage all'
                                )}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleStageAllPaths(stageAllPaths)
                                }}
                                disabled={isExecutingBulk}
                              />
                            )}
                            {canUnstageAll && (
                              <ActionButton
                                icon={Minus}
                                title={translate(
                                  'auto.components.right.sidebar.SourceControl.9339382454',
                                  'Unstage all'
                                )}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleUnstagePaths(unstageAllPaths)
                                }}
                                disabled={isExecutingBulk}
                              />
                            )}
                          </div>
                          {sectionViewAction ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={
                                items.some((entry) => entry.conflictStatus === 'unresolved')
                                  ? 'h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground'
                                  : 'h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground'
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!activeWorktreeId || !worktreePath) {
                                  return
                                }
                                if (sectionViewAction.kind === 'conflict-review') {
                                  openConflictReview(
                                    activeWorktreeId,
                                    worktreePath,
                                    sectionViewAction.entries,
                                    'live-summary'
                                  )
                                } else {
                                  openAllDiffs(
                                    activeWorktreeId,
                                    worktreePath,
                                    undefined,
                                    sectionViewAction.area,
                                    sectionViewAction.entries
                                  )
                                }
                              }}
                            >
                              {translate(
                                'auto.components.right.sidebar.SourceControl.48db37cca9',
                                'View all'
                              )}
                            </Button>
                          ) : null}
                        </>
                      }
                    />
                    {!isCollapsed &&
                      (sourceControlViewMode === 'tree'
                        ? (visibleTreeRowsBySection[id] ?? []).map((node) => {
                            if (node.type === 'directory') {
                              return (
                                <SourceControlTreeDirectoryRow
                                  key={node.key}
                                  node={node}
                                  actionPaths={getSourceControlDirectoryActionPaths(node)}
                                  hideBulkActions={Boolean(normalizedFilter)}
                                  isExecutingBulk={isExecutingBulk}
                                  isCollapsed={collapsedTreeDirs.has(node.key)}
                                  onToggle={() => toggleTreeDir(node.key)}
                                  onRequestDiscardPaths={(discardArea, paths) =>
                                    setPendingDiscard({
                                      kind: 'area',
                                      area: discardArea,
                                      paths
                                    })
                                  }
                                  onStagePaths={handleStageAllPaths}
                                  onUnstagePaths={handleUnstagePaths}
                                />
                              )
                            }
                            return (
                              <UncommittedEntryRow
                                key={node.key}
                                entryKey={node.key}
                                entry={node.entry}
                                currentWorktreeId={currentWorktreeId}
                                worktreePath={worktreePath}
                                depth={node.depth}
                                selected={selectedKeySet.has(node.key)}
                                isOpenFile={activeOpenRowKeys.has(node.key)}
                                onSelect={handleSelect}
                                onContextMenu={handleContextMenu}
                                onRevealInExplorer={revealInExplorer}
                                connectionId={activeConnectionId}
                                onOpen={handleOpenDiff}
                                onStage={handleStage}
                                onUnstage={handleUnstage}
                                onDiscard={requestDiscardEntry}
                                commentCount={diffCommentCountByPath.get(node.entry.path) ?? 0}
                                showPathHint={false}
                              />
                            )
                          })
                        : items.map((entry) => {
                            const key = `${entry.area}::${entry.path}`
                            return (
                              <UncommittedEntryRow
                                key={key}
                                entryKey={key}
                                entry={entry}
                                currentWorktreeId={currentWorktreeId}
                                worktreePath={worktreePath}
                                selected={selectedKeySet.has(key)}
                                isOpenFile={activeOpenRowKeys.has(key)}
                                onSelect={handleSelect}
                                onContextMenu={handleContextMenu}
                                onRevealInExplorer={revealInExplorer}
                                connectionId={activeConnectionId}
                                onOpen={handleOpenDiff}
                                onStage={handleStage}
                                onUnstage={handleUnstage}
                                onDiscard={requestDiscardEntry}
                                commentCount={diffCommentCountByPath.get(entry.path) ?? 0}
                              />
                            )
                          }))}
                  </div>
                )
              })}
            </>
          )}

          {shouldShowSourceControlCompareUnavailableCard(
            branchSummary,
            hasUncommittedEntries,
            branchEntries.length > 0,
            Boolean(normalizedFilter)
          ) && branchSummary ? (
            <CompareUnavailable
              summary={branchSummary}
              onChangeBaseRef={() => setBaseRefDialogOpen(true)}
              onRetry={() => void refreshBranchCompare()}
            />
          ) : null}

          {branchSummary?.status === 'ready' && hasFilteredBranchEntries && (
            <div>
              <SectionHeader
                label={translate(
                  'auto.components.right.sidebar.SourceControl.d7ae61269b',
                  'Committed on Branch'
                )}
                count={filteredBranchEntries.length}
                isCollapsed={collapsedSections.has('branch')}
                onToggle={() => toggleSection('branch')}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (activeWorktreeId && worktreePath && branchSummary) {
                        openBranchAllDiffs(activeWorktreeId, worktreePath, branchSummary)
                      }
                    }}
                  >
                    {translate(
                      'auto.components.right.sidebar.SourceControl.48db37cca9',
                      'View all'
                    )}
                  </Button>
                }
              />
              {!collapsedSections.has('branch') &&
                (sourceControlViewMode === 'tree'
                  ? visibleBranchTreeRows.map((node) => {
                      if (node.type === 'directory') {
                        return (
                          <SourceControlBranchTreeDirectoryRow
                            key={node.key}
                            node={node}
                            isCollapsed={collapsedTreeDirs.has(node.key)}
                            onToggle={() => toggleTreeDir(node.key)}
                          />
                        )
                      }
                      return (
                        <BranchEntryRow
                          key={node.key}
                          entry={node.entry}
                          currentWorktreeId={currentWorktreeId}
                          worktreePath={worktreePath}
                          depth={node.depth}
                          onRevealInExplorer={revealInExplorer}
                          connectionId={activeConnectionId}
                          onOpen={(event) => openCommittedDiff(node.entry, event)}
                          commentCount={diffCommentCountByPath.get(node.entry.path) ?? 0}
                          showPathHint={false}
                        />
                      )
                    })
                  : filteredBranchEntries.map((entry) => (
                      <BranchEntryRow
                        key={`branch:${entry.path}`}
                        entry={entry}
                        currentWorktreeId={currentWorktreeId}
                        worktreePath={worktreePath}
                        onRevealInExplorer={revealInExplorer}
                        connectionId={activeConnectionId}
                        onOpen={(event) => openCommittedDiff(entry, event)}
                        commentCount={diffCommentCountByPath.get(entry.path) ?? 0}
                      />
                    )))}
            </div>
          )}

          {isGitHistoryVisible && (
            // Why: the graph is reference context for the whole panel, so when
            // file sections are short it should occupy the bottom, and when the
            // pane scrolls it should remain docked as branch context.
            <div className="sticky bottom-0 z-10 mt-auto shrink-0 border-t border-border bg-sidebar/95 backdrop-blur-sm">
              <GitHistoryPanel
                state={gitHistoryState}
                collapsed={collapsedSections.has('history')}
                onToggle={() => toggleSection('history')}
                onRefresh={() => void refreshGitHistory()}
                onOpenCommit={(item) => void openHistoryCommitDiff(item)}
                onLoadCommitFiles={loadCommitFiles}
                onOpenCommitFile={openCommitFile}
                onCommitAction={handleCommitAction}
              />
            </div>
          )}
        </div>

        {selectedKeys.size > 0 && (
          <BulkActionBar
            selectedCount={selectedKeys.size}
            stageableCount={bulkStagePaths.length}
            unstageableCount={bulkUnstagePaths.length}
            onStage={handleBulkStage}
            onUnstage={handleBulkUnstage}
            onClear={clearSelection}
            isExecuting={isExecutingBulk}
          />
        )}
      </div>

      <Dialog
        open={resolvedPendingDiffCommentsClear !== null}
        onOpenChange={(open) => {
          if (!open && !isClearingDiffComments) {
            setPendingDiffCommentsClear(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {translate('auto.components.right.sidebar.SourceControl.574d2f4413', 'Clear Notes')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {pendingDiffCommentsClearDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDiffCommentsClear(null)}
              disabled={isClearingDiffComments}
            >
              {translate('auto.components.right.sidebar.SourceControl.05bb8f4a48', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDiffCommentsClear()}
              disabled={isClearingDiffComments || pendingDiffCommentsClearCount === 0}
            >
              <Trash2 className="size-4" />
              {translate('auto.components.right.sidebar.SourceControl.574d2f4413', 'Clear Notes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SourceControlDiscardDialog
        pendingDiscard={pendingDiscard}
        onCancel={() => setPendingDiscard(null)}
        onConfirm={confirmPendingDiscard}
      />

      <Dialog open={baseRefDialogOpen} onOpenChange={setBaseRefDialogOpen}>
        <DialogContent className="flex max-h-[min(85vh,36rem)] max-w-xl flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm">
              {translate(
                'auto.components.right.sidebar.SourceControl.476b77745b',
                'Change Base Ref'
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {translate(
                'auto.components.right.sidebar.SourceControl.c9ad22888e',
                'Pick the branch compare target for this repository.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto scrollbar-sleek">
            <BaseRefPicker
              repoId={activeRepo.id}
              currentBaseRef={pickerBaseRef}
              onSelect={(ref) => {
                if (baseRefOwnedByWorktree && activeWorktreeId) {
                  void updateWorktreeMeta(activeWorktreeId, { baseRef: ref })
                } else {
                  void updateRepo(activeRepo.id, { worktreeBaseRef: ref })
                }
                setBaseRefDialogOpen(false)
                window.setTimeout(() => void refreshBranchCompare(), 0)
              }}
              onUsePrimary={() => {
                if (baseRefOwnedByWorktree && activeWorktreeId) {
                  void updateWorktreeMeta(activeWorktreeId, { baseRef: undefined })
                } else {
                  void updateRepo(activeRepo.id, { worktreeBaseRef: undefined })
                }
                setBaseRefDialogOpen(false)
                window.setTimeout(() => void refreshBranchCompare(), 0)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      <SourceControlAgentActionDialog
        open={sourceControlAiActionsVisible && resolveConflictsComposerOpen}
        onOpenChange={setResolveConflictsComposerOpen}
        actionId="resolveConflicts"
        title={translate(
          'auto.components.right.sidebar.SourceControl.19652ddd76',
          'Resolve Conflicts With AI'
        )}
        description={translate(
          'auto.components.right.sidebar.SourceControl.901140f47d',
          'Review and edit the full command input before starting an agent.'
        )}
        baseCommandInput={resolveConflictsPrompt}
        worktreeId={activeWorktreeId}
        groupId={activeGroupId ?? activeWorktreeId}
        connectionId={activeConnectionId}
        repoId={activeRepo?.id ?? null}
        promptDelivery="submit-after-ready"
        launchPlatform={activeSourceControlLaunchPlatform}
        launchSource="conflict_resolution"
        savedAgentId={readSourceControlLaunchRecipeAgentId(
          getLaunchActionRecipe('resolveConflicts')
        )}
        savedCommandInputTemplate={
          getLaunchActionRecipe('resolveConflicts').commandInputTemplate ?? null
        }
        savedAgentArgs={getLaunchActionRecipe('resolveConflicts').agentArgs ?? null}
        onSaveAgentDefault={saveLaunchActionDefault}
        onOpenSettings={openSourceControlAiSettings}
        onLaunched={() =>
          toast.success(
            translate(
              'auto.components.right.sidebar.SourceControl.e48caaf0dd',
              'Started an AI agent for the conflicts.'
            )
          )
        }
      />
      <SourceControlTextGenerationDialog
        open={sourceControlAiActionsVisible && commitGenerationDialogOpen}
        onOpenChange={setCommitGenerationDialogOpen}
        actionId="commitMessage"
        title={translate(
          'auto.components.right.sidebar.SourceControl.6b122529d4',
          'Generate Commit Message'
        )}
        description={translate(
          'auto.components.right.sidebar.SourceControl.f4c766f1ca',
          'Choose the agent and command template for this run.'
        )}
        generateLabel="Generate"
        settings={settings}
        repo={activeRepo ?? null}
        discoveryHostKey={sourceControlAiDiscoveryHostKey}
        onGenerate={(params) => {
          void handleGenerate({ sourceControlAiResolvedParams: params })
        }}
        onSaveDefaults={handleSaveCommitMessageGenerationDefaults}
      />
    </>
  )
}

const SourceControl = React.memo(SourceControlInner)
export default SourceControl

type CommitFailureFixSplitButtonProps = {
  label: string
  worktreeId: string | null
  groupId: string | null
  connectionId?: string | null
  repoId?: string | null
  launchPlatform?: NodeJS.Platform
  prompt: string | null
  isLaunching: boolean
  variant: React.ComponentProps<typeof Button>['variant']
  size: React.ComponentProps<typeof Button>['size']
  iconClassName: string
  primaryClassName?: string
  chevronClassName?: string
  savedAgentId?: TuiAgent | null
  savedCommandInputTemplate?: string | null
  savedAgentArgs?: string | null
  onSaveAgentDefault?: (
    target: SourceControlAiWriteTarget,
    actionId: SourceControlLaunchActionId,
    recipe: SourceControlActionRecipe
  ) => void | Promise<void>
  onOpenSettings?: () => void
  onFixWithDefaultAgent: (promptOverride?: string) => Promise<boolean> | boolean
  onPromptDelivered: () => void
}

function CommitFailureFixSplitButton({
  label,
  worktreeId,
  groupId,
  connectionId,
  repoId,
  launchPlatform,
  prompt,
  isLaunching,
  variant,
  size,
  iconClassName,
  primaryClassName,
  chevronClassName,
  savedAgentId,
  savedCommandInputTemplate,
  savedAgentArgs,
  onSaveAgentDefault,
  onOpenSettings,
  onFixWithDefaultAgent,
  onPromptDelivered
}: CommitFailureFixSplitButtonProps): React.JSX.Element {
  const [composerOpen, setComposerOpen] = useState(false)
  const canLaunch = Boolean(worktreeId && groupId && prompt)
  const dividerClass = variant === 'default' ? 'border-primary-foreground/20' : 'border-border'

  return (
    <>
      <DropdownMenu>
        <div className="flex shrink-0 items-stretch">
          <Button
            type="button"
            variant={variant}
            size={size}
            className={cn('rounded-r-none', primaryClassName)}
            disabled={isLaunching || !canLaunch}
            onClick={() => void onFixWithDefaultAgent()}
            title={translate(
              'auto.components.right.sidebar.SourceControl.4b37ae99b0',
              'Start the default AI agent to fix this commit failure'
            )}
            aria-label={translate(
              'auto.components.right.sidebar.SourceControl.30b8d4f181',
              'Fix commit failure with AI'
            )}
          >
            {isLaunching ? (
              <RefreshCw className={cn(iconClassName, 'animate-spin')} />
            ) : (
              <Sparkle className={iconClassName} />
            )}
            {label}
          </Button>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={variant}
              size={size}
              className={cn('rounded-l-none border-l', dividerClass, chevronClassName)}
              disabled={isLaunching || !canLaunch}
              title={translate(
                'auto.components.right.sidebar.SourceControl.dd43c47089',
                'Choose an agent for this commit failure'
              )}
              aria-label={translate(
                'auto.components.right.sidebar.SourceControl.ec7bfced55',
                'Choose agent to fix commit failure'
              )}
            >
              <ChevronDown className={iconClassName} />
            </Button>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent align="end" className="min-w-[210px] p-1">
          {worktreeId && groupId && prompt ? (
            <DropdownMenuItem
              onSelect={() => setComposerOpen(true)}
              className="gap-2 rounded-[7px] px-2 py-1.5 text-[12px] leading-5 font-medium"
            >
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              {translate(
                'auto.components.right.sidebar.SourceControl.f0a2dc9e46',
                'Customize launch...'
              )}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              {translate(
                'auto.components.right.sidebar.SourceControl.9e5ccd00aa',
                'Commit failure context unavailable'
              )}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {worktreeId && groupId && prompt ? (
        <SourceControlAgentActionDialog
          open={composerOpen}
          onOpenChange={setComposerOpen}
          actionId="fixCommitFailure"
          title={translate(
            'auto.components.right.sidebar.SourceControl.054ead86b1',
            'Fix Commit Failure With AI'
          )}
          description={translate(
            'auto.components.right.sidebar.SourceControl.15b7f210d7',
            'Choose the agent and edit the full command input before launch.'
          )}
          baseCommandInput={prompt}
          worktreeId={worktreeId}
          groupId={groupId}
          connectionId={connectionId}
          repoId={repoId}
          promptDelivery="submit-after-ready"
          launchPlatform={launchPlatform}
          launchSource="source_control_recovery"
          savedAgentId={savedAgentId}
          savedCommandInputTemplate={savedCommandInputTemplate}
          savedAgentArgs={savedAgentArgs}
          onSaveAgentDefault={onSaveAgentDefault}
          onOpenSettings={onOpenSettings}
          onLaunched={onPromptDelivered}
        />
      ) : null}
    </>
  )
}

function getCommitFailureKindLabel(summary: string): string | null {
  if (/\blint\b/i.test(summary)) {
    return 'Lint'
  }

  if (/\bhook\b|\bpre-commit\b/i.test(summary)) {
    return 'Hook'
  }

  return null
}

type CommitAreaProps = {
  worktreeId: string | null
  groupId: string | null
  connectionId?: string | null
  repoId?: string | null
  launchPlatform?: NodeJS.Platform
  commitMessage: string
  commitError: string | null
  commitFailureRecoveryPrompt: string | null
  remoteActionError: string | null
  isCommitting: boolean
  isFixingCommitFailureWithAI: boolean
  showComposer?: boolean
  sourceControlAiActionsVisible: boolean
  aiEnabled: boolean
  aiAgentConfigured: boolean
  isGenerating: boolean
  generateError: string | null
  stagedCount: number
  hasPartiallyStagedChanges: boolean
  hasUnresolvedConflicts: boolean
  isRemoteOperationActive: boolean
  inFlightRemoteOpKind: RemoteOpKind | null
  primaryAction: PrimaryAction
  dropdownItems: DropdownEntry[]
  fixCommitFailureRecipe?: SourceControlActionRecipe
  onCommitMessageChange: (message: string) => void
  onGenerate: () => void
  onCancelGenerate: () => void
  onSaveLaunchActionDefault?: (
    target: SourceControlAiWriteTarget,
    actionId: SourceControlLaunchActionId,
    recipe: SourceControlActionRecipe
  ) => void | Promise<void>
  onOpenSourceControlAiSettings?: () => void
  onFixCommitFailureWithAI: (promptOverride?: string) => Promise<boolean> | boolean
  onPrimaryAction: () => void
  onDropdownAction: (kind: DropdownActionKind) => void
}

export function CommitArea({
  worktreeId,
  groupId,
  connectionId,
  repoId,
  launchPlatform,
  commitMessage,
  commitError,
  commitFailureRecoveryPrompt,
  remoteActionError,
  isCommitting,
  isFixingCommitFailureWithAI,
  showComposer = true,
  sourceControlAiActionsVisible,
  aiEnabled,
  aiAgentConfigured,
  isGenerating,
  generateError,
  stagedCount,
  hasPartiallyStagedChanges,
  hasUnresolvedConflicts,
  isRemoteOperationActive,
  inFlightRemoteOpKind,
  primaryAction,
  dropdownItems,
  fixCommitFailureRecipe,
  onCommitMessageChange,
  onGenerate,
  onCancelGenerate,
  onSaveLaunchActionDefault,
  onOpenSourceControlAiSettings,
  onFixCommitFailureWithAI,
  onPrimaryAction,
  onDropdownAction
}: CommitAreaProps): React.JSX.Element {
  // Why: cap at 12 rows so a pasted multi-page commit message doesn't push
  // the Commit button off-screen. The textarea keeps `resize-none` (matching
  // the existing style) — the browser scrolls internally past 12 rows.
  const rows = getCommitMessageTextareaRows(commitMessage)
  // Why: only spin the primary when its label matches what's actually
  // running. The commit-area resolver overrides the primary kind to mirror
  // the in-flight op (e.g. user picks Sync from the dropdown → primary
  // becomes "Sync"), so the equality check spins the button for any primary-
  // eligible remote op the user triggered. Background ops the primary
  // doesn't show (Fetch) leave primaryAction.kind unchanged and the
  // mismatch keeps the spinner off — the disabled state alone is enough
  // signal there. Commit still spins on isCommitting because that path
  // doesn't go through inFlightRemoteOpKind.
  const primaryHostsRemoteOperation =
    primaryAction.kind === inFlightRemoteOpKind ||
    (primaryAction.kind === 'push' && inFlightRemoteOpKind === 'force_push')
  const showSpinner =
    primaryAction.kind === 'commit'
      ? isCommitting
      : isRemoteOperationActive && primaryHostsRemoteOperation
  // Why: when the primary doesn't host the in-flight op (e.g. Fetch, or any
  // dropdown action that mismatches the primary's natural label) the click
  // would otherwise be silent — the toast only fires on failure and a
  // no-op fetch leaves status counts unchanged. Spinning the chevron gives
  // the user immediate feedback that the action they picked is running,
  // while still leaving the menu reachable to read the disabled-row
  // tooltips.
  const showChevronSpinner = (isCommitting || isRemoteOperationActive) && !showSpinner
  const commitFailureSummary = useMemo(
    () => (commitError ? summarizeCommitFailure(commitError) : null),
    [commitError]
  )
  const commitFailureKindLabel = useMemo(
    () => (commitFailureSummary ? getCommitFailureKindLabel(commitFailureSummary) : null),
    [commitFailureSummary]
  )
  const hasCommitFailureDetails = useMemo(
    () =>
      commitError && commitFailureSummary
        ? hasExpandedCommitFailureDetails(commitError, commitFailureSummary)
        : false,
    [commitError, commitFailureSummary]
  )
  // Why: the details dialog is scoped to the worktree, not the exact stderr
  // text, so a retried commit can refresh an open dialog with newer output.
  const commitFailureWorktreeKey = getCommitFailureDialogWorktreeKey(worktreeId)
  const [commitFailureDialogState, setCommitFailureDialogState] =
    useState<CommitFailureDialogState>({
      worktreeKey: commitFailureWorktreeKey,
      open: false
    })
  const isCommitFailureDialogOpen = shouldShowCommitFailureDialog(
    commitFailureDialogState,
    commitFailureWorktreeKey,
    hasCommitFailureDetails
  )
  const setCommitFailureDialogOpen = useCallback(
    (open: boolean) => {
      setCommitFailureDialogState({ worktreeKey: commitFailureWorktreeKey, open })
    },
    [commitFailureWorktreeKey]
  )
  const handleFixCommitFailureWithAI = useCallback(
    async (promptOverride?: string): Promise<boolean> => {
      const launched = await onFixCommitFailureWithAI(promptOverride)
      if (launched) {
        setCommitFailureDialogOpen(false)
      }
      return launched
    },
    [onFixCommitFailureWithAI, setCommitFailureDialogOpen]
  )
  const handleCommitFailureAgentPromptDelivered = useCallback(() => {
    setCommitFailureDialogOpen(false)
  }, [setCommitFailureDialogOpen])

  useEffect(() => {
    setCommitFailureDialogState((current) =>
      syncCommitFailureDialogState(current, commitFailureWorktreeKey, hasCommitFailureDetails)
    )
  }, [commitFailureWorktreeKey, hasCommitFailureDetails])

  // Why: most primary-kind labels are anchored by a directional icon so
  // the affirmative Commit (✓) reads distinctly from the remote-state
  // labels sharing this slot — Push (↑), Sync (↕), Publish (☁︎↑). Pull is
  // intentionally icon-less because the down-arrow read as a
  // download/save affordance. The icon is decorative; the label and
  // title attribute carry the meaning for assistive tech.
  const PrimaryIcon = PRIMARY_ICONS[primaryAction.kind]

  const hasMessage = commitMessage.trim().length > 0
  const isCommitMessageDisabled = isCommitMessageFieldDisabled({
    stagedCount,
    hasPartiallyStagedChanges,
    hasMessage,
    hasUnresolvedConflicts,
    isCommitting,
    isRemoteOperationActive,
    isPullRequestOperationActive: false
  })
  const describedBy = [
    commitError ? 'commit-area-error' : null,
    remoteActionError ? 'commit-area-remote-error' : null,
    generateError ? 'commit-area-generate-error' : null
  ]
    .filter(Boolean)
    .join(' ')

  // Why: only render Generate when it has a runnable path; otherwise the
  // composer should stay focused on the normal Commit action.
  const showGenerate = showComposer && aiEnabled && (aiAgentConfigured || isGenerating)
  let generateDisabledReason: string | undefined
  if (isGenerating) {
    generateDisabledReason = 'Generating commit message…'
  } else if (isCommitting) {
    generateDisabledReason = 'Commit in progress…'
  } else if (!aiAgentConfigured) {
    generateDisabledReason = 'Pick an agent in Settings -> Git -> Source Control AI.'
  } else if (stagedCount === 0) {
    generateDisabledReason = 'Stage at least one file to generate a message.'
  } else if (hasMessage) {
    generateDisabledReason = 'Clear the message to regenerate.'
  }
  const isGenerateDisabled =
    !aiAgentConfigured ||
    isGenerating ||
    isCommitting ||
    stagedCount === 0 ||
    hasMessage ||
    hasUnresolvedConflicts
  const moreCommitAndRemoteActionsLabel = translate(
    'auto.components.right.sidebar.SourceControl.cc199ccc5f',
    'More commit and remote actions'
  )
  const moreActionsLabel = translate(
    'auto.components.right.sidebar.SourceControl.4d6e1fd7f3',
    'More actions'
  )
  const dropdownMenuContent = (
    <DropdownMenuContent align="end" className="min-w-[14rem]">
      {dropdownItems.map((entry, index) =>
        entry.kind === 'separator' ? (
          <DropdownMenuSeparator key={`sep-${index}`} />
        ) : (
          <Tooltip key={entry.kind}>
            <TooltipTrigger asChild>
              <div className="block">
                <DropdownMenuItem
                  disabled={entry.disabled}
                  title={entry.title}
                  variant={entry.variant}
                  className="w-full"
                  onSelect={(event) => {
                    if (entry.disabled) {
                      event.preventDefault()
                      return
                    }
                    onDropdownAction(entry.kind)
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span>{entry.label}</span>
                    {entry.hint ? (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {entry.hint}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8} className="max-w-72">
              {entry.title}
            </TooltipContent>
          </Tooltip>
        )
      )}
    </DropdownMenuContent>
  )

  return (
    <div className="px-3 pb-2">
      {showComposer ? (
        <div className="relative">
          <textarea
            rows={rows}
            value={commitMessage}
            disabled={isCommitMessageDisabled}
            onChange={(e) => onCommitMessageChange(e.target.value)}
            placeholder={translate(
              'auto.components.right.sidebar.SourceControl.0d0a8359d3',
              'Message'
            )}
            aria-label={translate(
              'auto.components.right.sidebar.SourceControl.b94112eb9e',
              'Commit message'
            )}
            aria-describedby={describedBy || undefined}
            // Why: reserve right padding so typed text does not slide under the
            // absolute-positioned Generate icon in the top-right corner.
            // Why: match Input surface tokens and pin disabled:border-input so
            // Chromium's UA disabled styles don't wash out the field outline.
            className={`mt-0.5 min-h-14 w-full resize-none appearance-none rounded-md border border-input bg-background shadow-xs px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-input disabled:bg-background disabled:text-foreground disabled:shadow-xs dark:bg-input/30 dark:disabled:bg-input/30 ${
              showGenerate ? 'pr-8' : ''
            }`}
          />
          {showGenerate &&
            (isGenerating ? (
              // Why: while generating the icon doubles as the cancel affordance.
              // Default state shows the spinning RefreshCw; on hover/focus we
              // swap to a Square ("stop") with a destructive tint so the user
              // sees that clicking will abort the run. Group/group-hover toggles
              // keep this stateless on the React side.
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onCancelGenerate()}
                    title={translate(
                      'auto.components.right.sidebar.SourceControl.527e130b6f',
                      'Stop generating'
                    )}
                    aria-label={translate(
                      'auto.components.right.sidebar.SourceControl.ddc1fbd690',
                      'Stop generating commit message'
                    )}
                    className="group absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/40"
                  >
                    <RefreshCw className="size-3.5 animate-spin group-hover:hidden group-focus-visible:hidden" />
                    <Square className="hidden size-3.5 fill-current group-hover:block group-focus-visible:block" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={6}>
                  {translate(
                    'auto.components.right.sidebar.SourceControl.37a81f29ad',
                    'Generating commit message. Click to stop.'
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-disabled={isGenerateDisabled}
                    onClick={(event) => {
                      if (isGenerateDisabled) {
                        event.preventDefault()
                        return
                      }
                      onGenerate()
                    }}
                    title={
                      generateDisabledReason ??
                      translate(
                        'auto.components.right.sidebar.SourceControl.b16b8f0e4b',
                        'ai commit msg'
                      )
                    }
                    aria-label={translate(
                      'auto.components.right.sidebar.SourceControl.461575b9bc',
                      'Generate commit message with AI'
                    )}
                    className={cn(
                      'absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isGenerateDisabled &&
                        'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground'
                    )}
                  >
                    <Sparkles className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={6}>
                  {generateDisabledReason ??
                    translate(
                      'auto.components.right.sidebar.SourceControl.b16b8f0e4b',
                      'ai commit msg'
                    )}
                </TooltipContent>
              </Tooltip>
            ))}
        </div>
      ) : null}
      {/* Why: the current manual action + chevron sit together as a visual
          split button so the edit → commit → push loop stays in a single
          vertical band. The chevron exposes the full action surface without
          forcing morphing labels to carry every possible intent. */}
      <div
        className={cn(showComposer ? 'mt-1 flex items-stretch gap-1' : 'flex items-stretch gap-1')}
      >
        <div className="flex flex-1 items-stretch">
          {/* Why: match the hosted-review action buttons in Checks
              (size="xs", px-3 text-[11px]) so the sidebar has a consistent
              action-button shape across Source Control and Checks. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={primaryAction.disabled}
                  onClick={() => onPrimaryAction()}
                  className="w-full rounded-r-none px-3 text-[11px]"
                  title={primaryAction.title}
                >
                  {showSpinner ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : PrimaryIcon ? (
                    <PrimaryIcon className="size-3.5" aria-hidden="true" />
                  ) : null}
                  {primaryAction.label}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-72">
              {primaryAction.title}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0">
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className={cn(
                        'rounded-l-none border-l border-border px-1.5 shrink-0',
                        // Why: mirror the primary's disabled dimming so the split
                        // button reads as one unit when Commit is unavailable. The
                        // chevron itself stays clickable — its dropdown exposes
                        // independently-gated remote actions (push / fetch / pull)
                        // that are still valid when the primary is disabled.
                        primaryAction.disabled && 'opacity-50'
                      )}
                      aria-label={moreCommitAndRemoteActionsLabel}
                      title={moreActionsLabel}
                    >
                      {showChevronSpinner ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {moreCommitAndRemoteActionsLabel}
              </TooltipContent>
            </Tooltip>
            {dropdownMenuContent}
          </DropdownMenu>
        </div>
      </div>
      {commitError && (
        // Why: role="alert" + aria-live="polite" lets screen readers announce
        // commit failures; the id ties the message to the textarea via
        // aria-describedby so assistive tech associates the two.
        <div
          id="commit-area-error"
          role="alert"
          aria-live="polite"
          className="mt-2 min-w-0 overflow-hidden rounded-lg border border-destructive/20 bg-card text-card-foreground shadow-xs"
        >
          <div className="h-0.5 bg-destructive/70" aria-hidden="true" />
          <div className="grid min-w-0 gap-2 px-2.5 py-2.5">
            <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-1.5">
              <span className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <TriangleAlert className="size-3" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {translate(
                    'auto.components.right.sidebar.SourceControl.011f9713fc',
                    'Commit blocked'
                  )}
                </span>
                {commitFailureKindLabel ? (
                  <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px text-[10px] leading-4 font-semibold text-destructive">
                    {commitFailureKindLabel}
                  </span>
                ) : null}
              </div>
              <p className="col-start-2 mt-0.5 line-clamp-3 min-w-0 font-mono text-[11px] leading-4 break-words text-muted-foreground [overflow-wrap:anywhere]">
                {commitFailureSummary}
              </p>
            </div>
            <div className="ml-[1.375rem] flex min-w-0 items-center gap-1.5">
              {sourceControlAiActionsVisible ? (
                <CommitFailureFixSplitButton
                  label={translate(
                    'auto.components.right.sidebar.SourceControl.60bd988f0b',
                    'AI Fix'
                  )}
                  worktreeId={worktreeId}
                  groupId={groupId}
                  connectionId={connectionId}
                  repoId={repoId}
                  launchPlatform={launchPlatform}
                  prompt={commitFailureRecoveryPrompt}
                  isLaunching={isFixingCommitFailureWithAI}
                  variant="secondary"
                  size="xs"
                  iconClassName="size-3"
                  primaryClassName="h-6 px-2 text-[11px]"
                  chevronClassName="h-6 px-1.5"
                  savedAgentId={readSourceControlLaunchRecipeAgentId(fixCommitFailureRecipe)}
                  savedCommandInputTemplate={fixCommitFailureRecipe?.commandInputTemplate ?? null}
                  savedAgentArgs={fixCommitFailureRecipe?.agentArgs ?? null}
                  onSaveAgentDefault={onSaveLaunchActionDefault}
                  onOpenSettings={onOpenSourceControlAiSettings}
                  onFixWithDefaultAgent={handleFixCommitFailureWithAI}
                  onPromptDelivered={handleCommitFailureAgentPromptDelivered}
                />
              ) : null}
              {hasCommitFailureDetails && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-6 shrink-0 border-foreground/25 px-2 text-[11px] font-semibold"
                  onClick={() => setCommitFailureDialogOpen(true)}
                >
                  {translate('auto.components.right.sidebar.SourceControl.03d238218c', 'Details')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {commitError && commitFailureSummary && hasCommitFailureDetails && (
        <Dialog
          key={commitFailureWorktreeKey}
          open={isCommitFailureDialogOpen}
          onOpenChange={setCommitFailureDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {translate(
                  'auto.components.right.sidebar.SourceControl.a9bf7c171a',
                  'Commit Failed'
                )}
              </DialogTitle>
              <DialogDescription>{commitFailureSummary}</DialogDescription>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap text-foreground scrollbar-sleek">
              {commitError}
            </pre>
            <DialogFooter>
              {sourceControlAiActionsVisible ? (
                <CommitFailureFixSplitButton
                  label={translate(
                    'auto.components.right.sidebar.SourceControl.834cb3f23d',
                    'Fix with AI'
                  )}
                  worktreeId={worktreeId}
                  groupId={groupId}
                  connectionId={connectionId}
                  repoId={repoId}
                  launchPlatform={launchPlatform}
                  prompt={commitFailureRecoveryPrompt}
                  isLaunching={isFixingCommitFailureWithAI}
                  variant="default"
                  size="sm"
                  iconClassName="size-4"
                  primaryClassName="rounded-r-none"
                  chevronClassName="rounded-l-none border-l border-primary-foreground/20 px-2"
                  savedAgentId={readSourceControlLaunchRecipeAgentId(fixCommitFailureRecipe)}
                  savedCommandInputTemplate={fixCommitFailureRecipe?.commandInputTemplate ?? null}
                  savedAgentArgs={fixCommitFailureRecipe?.agentArgs ?? null}
                  onSaveAgentDefault={onSaveLaunchActionDefault}
                  onOpenSettings={onOpenSourceControlAiSettings}
                  onFixWithDefaultAgent={handleFixCommitFailureWithAI}
                  onPromptDelivered={handleCommitFailureAgentPromptDelivered}
                />
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  {translate('auto.components.right.sidebar.SourceControl.783a808870', 'Close')}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {remoteActionError && isPullPolicyRemoteActionError(remoteActionError) ? (
        <PullPolicyRemoteActionNotice id="commit-area-remote-error" />
      ) : remoteActionError ? (
        <p
          id="commit-area-remote-error"
          role="alert"
          aria-live="polite"
          className="mt-1 text-[11px] text-destructive"
        >
          {remoteActionError}
        </p>
      ) : null}
      {generateError && (
        <p
          id="commit-area-generate-error"
          role="alert"
          aria-live="polite"
          className="mt-1 text-[11px] text-destructive"
        >
          {generateError}
        </p>
      )}
    </div>
  )
}

type BranchCompareStatusHeadSnapshot = {
  baseRef: string
  statusHead: string | null
  worktreeId: string
}

type BranchCompareRemoteStatusSnapshot = {
  ahead: number | null
  baseRef: string
  behind: number | null
  hasUpstream: boolean | null
  upstreamName: string | null
  worktreeId: string
}

export function shouldRefreshBranchCompareForStatusHead(
  previous: BranchCompareStatusHeadSnapshot | null,
  current: BranchCompareStatusHeadSnapshot
): boolean {
  return (
    current.statusHead !== null &&
    previous !== null &&
    previous.worktreeId === current.worktreeId &&
    previous.baseRef === current.baseRef &&
    previous.statusHead !== current.statusHead
  )
}

export function shouldRefreshBranchCompareForRemoteStatus(
  previous: BranchCompareRemoteStatusSnapshot | null,
  current: BranchCompareRemoteStatusSnapshot
): boolean {
  return (
    previous !== null &&
    previous.worktreeId === current.worktreeId &&
    previous.baseRef === current.baseRef &&
    (previous.hasUpstream !== current.hasUpstream ||
      previous.upstreamName !== current.upstreamName ||
      previous.ahead !== current.ahead ||
      previous.behind !== current.behind)
  )
}

export function shouldShowCompareSummary(summary: GitBranchCompareSummary | null): boolean {
  if (!summary || summary.status === 'loading') {
    return true
  }
  if (summary.status !== 'ready') {
    return true
  }
  return typeof summary.commitsAhead === 'number' && summary.commitsAhead > 0
}

export function CompareSummary({
  summary,
  onChangeBaseRef,
  onRetry
}: {
  summary: GitBranchCompareSummary | null
  onChangeBaseRef: () => void
  onRetry: () => void
}): React.JSX.Element | null {
  if (!summary || summary.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="size-3.5 animate-spin" />
        <span>
          {translate('auto.components.right.sidebar.SourceControl.11b5dd8e41', 'Comparing against')}
          {summary?.baseRef ?? '…'}
        </span>
      </div>
    )
  }

  if (summary.status !== 'ready') {
    return (
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">
          {summary.errorMessage ??
            translate(
              'auto.components.right.sidebar.SourceControl.715d229c86',
              'Branch compare unavailable'
            )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <CompareSummaryToolbarButton
            icon={Settings2}
            label={translate(
              'auto.components.right.sidebar.SourceControl.493f963029',
              'Change base ref'
            )}
            onClick={onChangeBaseRef}
          />
          <CompareSummaryToolbarButton
            icon={RefreshCw}
            label={translate('auto.components.right.sidebar.SourceControl.286dbda4d6', 'Retry')}
            onClick={onRetry}
          />
        </div>
      </div>
    )
  }

  const commitsAhead = summary.commitsAhead
  const showCommitsAhead = typeof commitsAhead === 'number' && commitsAhead > 0
  const commitsAheadTitle = showCommitsAhead
    ? `${commitsAhead} ${commitsAhead === 1 ? 'commit' : 'commits'} ahead of ${summary.baseRef}`
    : undefined

  if (!showCommitsAhead) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1" title={commitsAheadTitle}>
        <ArrowUp className="size-3" />
        <span>
          {commitsAhead}{' '}
          {translate('auto.components.right.sidebar.SourceControl.3278b2767b', 'ahead')}
        </span>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <CompareSummaryToolbarButton
          icon={Settings2}
          label={translate(
            'auto.components.right.sidebar.SourceControl.493f963029',
            'Change base ref'
          )}
          onClick={onChangeBaseRef}
        />
        <CompareSummaryToolbarButton
          icon={RefreshCw}
          label={translate(
            'auto.components.right.sidebar.SourceControl.ed34038d0d',
            'Refresh branch compare'
          )}
          onClick={onRetry}
        />
      </div>
    </div>
  )
}

export function CompareSummaryToolbarButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label={label}
          onClick={onClick}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function CompareUnavailable({
  summary,
  onChangeBaseRef,
  onRetry
}: {
  summary: GitBranchCompareSummary
  onChangeBaseRef: () => void
  onRetry: () => void
}): React.JSX.Element {
  const changeBaseRefAllowed =
    summary.status === 'invalid-base' ||
    summary.status === 'no-merge-base' ||
    summary.status === 'error'

  return (
    <div className="m-3 rounded-md border border-border/60 bg-muted/20 px-3 py-3 text-xs">
      <div className="font-medium text-foreground">
        {summary.status === 'error'
          ? translate(
              'auto.components.right.sidebar.SourceControl.97d8b03cdf',
              'Branch compare failed'
            )
          : translate(
              'auto.components.right.sidebar.SourceControl.715d229c86',
              'Branch compare unavailable'
            )}
      </div>
      <div className="mt-1 text-muted-foreground">
        {summary.errorMessage ??
          translate(
            'auto.components.right.sidebar.SourceControl.b6922abb13',
            'Unable to load branch compare.'
          )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {changeBaseRefAllowed && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onChangeBaseRef}
          >
            <Settings2 className="size-3.5" />
            {translate('auto.components.right.sidebar.SourceControl.476b77745b', 'Change Base Ref')}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          {translate('auto.components.right.sidebar.SourceControl.286dbda4d6', 'Retry')}
        </Button>
      </div>
    </div>
  )
}

function SectionHeader({
  label,
  count,
  conflictCount = 0,
  isCollapsed,
  onToggle,
  actions
}: {
  label: string
  count: number
  conflictCount?: number
  isCollapsed: boolean
  onToggle: () => void
  actions?: React.ReactNode
}): React.JSX.Element {
  // Why: wrap the toggle button and actions in a shared rounded container
  // so the hover background spans the entire row instead of clipping around
  // the label. The outer div keeps the vertical spacing that separates
  // sections; the inner wrapper owns the hover rectangle.
  return (
    <div className="pl-1 pr-3 pt-3 pb-1">
      <div className="group/section flex items-center rounded-md pr-1 hover:bg-accent hover:text-accent-foreground">
        <button
          type="button"
          className="flex flex-1 items-center gap-1 px-0.5 py-0.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground/70 group-hover/section:text-accent-foreground"
          onClick={onToggle}
        >
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
          />
          <span>{label}</span>
          <span className="text-[11px] font-medium tabular-nums">{count}</span>
          {conflictCount > 0 && (
            <span className="text-[11px] font-medium text-destructive/80">
              · {conflictCount}{' '}
              {translate('auto.components.right.sidebar.SourceControl.413a3ba113', 'conflict')}
              {conflictCount === 1 ? '' : 's'}
            </span>
          )}
        </button>
        <div className="shrink-0 flex items-center">{actions}</div>
      </div>
    </div>
  )
}

function getLocalizedDiffCommentLineLabel(
  comment: Pick<DiffComment, 'lineNumber' | 'startLine'>
): string {
  if (comment.startLine !== undefined && comment.startLine !== comment.lineNumber) {
    return translate(
      'auto.components.right.sidebar.SourceControl.d97ef8f221',
      'lines {{value0}}-{{value1}}',
      {
        value0: comment.startLine,
        value1: comment.lineNumber
      }
    )
  }
  return translate('auto.components.right.sidebar.SourceControl.6f8bfa0eb9', 'line {{value0}}', {
    value0: comment.lineNumber
  })
}

function getLocalizedConflictKindLabel(kind: NonNullable<GitStatusEntry['conflictKind']>): string {
  switch (kind) {
    case 'both_modified':
      return translate('auto.components.right.sidebar.SourceControl.c569d29a02', 'both modified')
    case 'both_added':
      return translate('auto.components.right.sidebar.SourceControl.ea7287d84f', 'both added')
    case 'deleted_by_us':
      return translate('auto.components.right.sidebar.SourceControl.bd0151ef7b', 'deleted by us')
    case 'deleted_by_them':
      return translate('auto.components.right.sidebar.SourceControl.44594e8c61', 'deleted by them')
    case 'added_by_us':
      return translate('auto.components.right.sidebar.SourceControl.24773ee581', 'added by us')
    case 'added_by_them':
      return translate('auto.components.right.sidebar.SourceControl.c03d7c952f', 'added by them')
    case 'both_deleted':
      return translate('auto.components.right.sidebar.SourceControl.5b176fa431', 'both deleted')
  }
}

function DiffCommentsInlineList({
  comments,
  onDelete,
  onClearFile,
  onOpen
}: {
  comments: DiffComment[]
  onDelete: (commentId: string) => void
  onClearFile: (filePath: string) => void
  // Why: clicking the note row navigates the user to that file's diff (or
  // editor as a fallback) and, when a `commentId` is supplied, scrolls the
  // diff to that specific note via the scrollToDiffCommentId UI slice.
  onOpen: (comment: DiffComment) => void
}): React.JSX.Element {
  // Why: group by filePath so the inline list mirrors the structure in the
  // Notes tab — a compact section per file with line-number prefixes.
  const groups = useMemo(() => {
    const map = new Map<string, DiffComment[]>()
    for (const c of comments) {
      const list = map.get(c.filePath) ?? []
      list.push(c)
      map.set(c.filePath, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.lineNumber - b.lineNumber)
    }
    return Array.from(map.entries())
  }, [comments])

  const [copiedId, showCopiedId] = useCopyFeedbackState<string | null>(null)

  const handleCopyOne = useCallback(
    async (c: DiffComment): Promise<void> => {
      try {
        await window.api.ui.writeClipboardText(formatDiffComment(c))
        showCopiedId(c.id)
      } catch {
        // Why: swallow — clipboard write can fail when the window isn't focused.
      }
    },
    [showCopiedId]
  )

  if (comments.length === 0) {
    return (
      <div className="px-6 py-2 text-[11px] text-muted-foreground">
        {translate(
          'auto.components.right.sidebar.SourceControl.ac8cbe3bf5',
          'Hover over a line in the diff view and click the + to add a note.'
        )}
      </div>
    )
  }

  return (
    <div className="bg-muted/20">
      {groups.map(([filePath, list]) => (
        <div key={filePath} className="px-3 py-1.5">
          <div className="group/file flex items-center gap-1">
            <button
              type="button"
              className="block min-w-0 flex-1 truncate text-left text-[10px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => {
                const first = list[0]
                if (first) {
                  onOpen(first)
                }
              }}
              title={translate(
                'auto.components.right.sidebar.SourceControl.0d963bf982',
                'Open {{value0}}',
                { value0: filePath }
              )}
            >
              {filePath}
            </button>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground can-hover:opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/file:opacity-100"
              onClick={() => onClearFile(filePath)}
              title={translate(
                'auto.components.right.sidebar.SourceControl.59654650d3',
                'Clear notes for {{value0}}',
                { value0: filePath }
              )}
              aria-label={translate(
                'auto.components.right.sidebar.SourceControl.59654650d3',
                'Clear notes for {{value0}}',
                { value0: filePath }
              )}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
          <ul className="mt-1 space-y-1">
            {list.map((c) => (
              <li
                key={c.id}
                className="group flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent/40"
              >
                <button
                  type="button"
                  // Why: a single inner button is the click/keyboard target so
                  // the row's action buttons (copy/delete) can stay as
                  // siblings without nesting interactive elements — that
                  // pattern violates ARIA's no-interactive-descendants rule
                  // for buttons and lets bubbled key events from the children
                  // fire the row's open handler.
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded text-left"
                  onClick={() => onOpen(c)}
                  title={translate(
                    'auto.components.right.sidebar.SourceControl.0b5b8c234c',
                    'Open {{value0}} ({{value1}})',
                    { value0: c.filePath, value1: getLocalizedDiffCommentLineLabel(c) }
                  )}
                  aria-label={translate(
                    'auto.components.right.sidebar.SourceControl.3eb9b2805e',
                    'Open note on {{value0}}',
                    { value0: getLocalizedDiffCommentLineLabel(c) }
                  )}
                >
                  <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] leading-none tabular-nums text-muted-foreground">
                    {getDiffCommentLineLabel(c, true)}
                  </span>
                  <span className="shrink-0 rounded bg-muted/70 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
                    {getDiffCommentSource(c) === 'markdown'
                      ? translate('auto.components.right.sidebar.SourceControl.94c42b252e', 'MD')
                      : translate('auto.components.right.sidebar.SourceControl.c56ba7fa06', 'Diff')}
                  </span>
                  {c.sentAt ? (
                    <span className="shrink-0 rounded bg-muted/70 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
                      {translate('auto.components.right.sidebar.SourceControl.655633c08a', 'Sent')}
                    </span>
                  ) : null}
                  <span className="block min-w-0 flex-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-foreground">
                    {c.body}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground can-hover:opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => void handleCopyOne(c)}
                  title={translate(
                    'auto.components.right.sidebar.SourceControl.1623bf4e19',
                    'Copy note'
                  )}
                  aria-label={translate(
                    'auto.components.right.sidebar.SourceControl.c085946bda',
                    'Copy note on line {{value0}}',
                    { value0: c.lineNumber }
                  )}
                >
                  {copiedId === c.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground can-hover:opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => onDelete(c.id)}
                  title={translate(
                    'auto.components.right.sidebar.SourceControl.b656381c18',
                    'Delete note'
                  )}
                  aria-label={translate(
                    'auto.components.right.sidebar.SourceControl.c321542ee2',
                    'Delete note on line {{value0}}',
                    { value0: c.lineNumber }
                  )}
                >
                  <Trash className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function ConflictSummaryCard({
  conflictOperation,
  unresolvedCount,
  sourceControlAiActionsVisible,
  isResolvingWithAI,
  isAbortingOperation = false,
  onAbortOperation,
  onResolveWithAI,
  onReview
}: {
  conflictOperation: GitConflictOperation
  unresolvedCount: number
  sourceControlAiActionsVisible: boolean
  isResolvingWithAI: boolean
  isAbortingOperation?: boolean
  onAbortOperation?: (operation: GitConflictOperation) => void
  onResolveWithAI: () => void
  onReview: () => void
}): React.JSX.Element {
  const operationLabel =
    conflictOperation === 'merge'
      ? 'Merge conflicts'
      : conflictOperation === 'rebase'
        ? 'Rebase conflicts'
        : conflictOperation === 'cherry-pick'
          ? 'Cherry-pick conflicts'
          : 'Conflicts'

  return (
    <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground" aria-live="polite">
            {translate(
              'auto.components.right.sidebar.SourceControl.d7a5942e41',
              '{{value0}}: {{value1}} unresolved',
              { value0: operationLabel, value1: unresolvedCount }
            )}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {translate(
              'auto.components.right.sidebar.SourceControl.3eeccbb221',
              'Resolved files move back to normal changes after they leave the live conflict state.'
            )}
          </div>
        </div>
      </div>
      <div className="mt-2">
        {sourceControlAiActionsVisible ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={isResolvingWithAI}
            onClick={onResolveWithAI}
          >
            {isResolvingWithAI ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {translate('auto.components.right.sidebar.SourceControl.f6cb48b6fe', 'Resolve with AI')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(sourceControlAiActionsVisible && 'mt-1.5', 'h-7 w-full text-xs')}
          onClick={onReview}
        >
          <GitMerge className="size-3.5" />
          {translate('auto.components.right.sidebar.SourceControl.27a50fe970', 'Review conflicts')}
        </Button>
        {(conflictOperation === 'merge' || conflictOperation === 'rebase') && onAbortOperation ? (
          <Button
            type="button"
            // Why: abort is the escape hatch for this state, so match the quiet
            // outline conflict-review action instead of reading as destructive.
            variant="outline"
            size="sm"
            className="mt-1.5 h-7 w-full text-xs"
            disabled={isResolvingWithAI || isAbortingOperation}
            onClick={() => onAbortOperation(conflictOperation)}
          >
            {isAbortingOperation ? <RefreshCw className="size-3.5 animate-spin" /> : null}
            {conflictOperation === 'rebase'
              ? translate('auto.components.right.sidebar.SourceControl.425f138269', 'Abort rebase')
              : translate('auto.components.right.sidebar.SourceControl.540ca8f78c', 'Abort merge')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// Why: this banner is separate from ConflictSummaryCard because a rebase (or
// merge/cherry-pick) can be in progress without any conflicts — e.g. between
// rebase steps, or after resolving all conflicts but before --continue. The
// user needs to see the operation state so they know the worktree is mid-rebase
// and that they should run `git rebase --continue` or `--abort`.
export function OperationBanner({
  conflictOperation,
  isAbortingOperation = false,
  onAbortOperation
}: {
  conflictOperation: GitConflictOperation
  isAbortingOperation?: boolean
  onAbortOperation?: (operation: GitConflictOperation) => void
}): React.JSX.Element {
  const label =
    conflictOperation === 'merge'
      ? 'Merge in progress'
      : conflictOperation === 'rebase'
        ? 'Rebase in progress'
        : conflictOperation === 'cherry-pick'
          ? 'Cherry-pick in progress'
          : 'Operation in progress'

  const Icon = conflictOperation === 'rebase' ? GitPullRequestArrow : GitMerge

  return (
    <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
      <div className="flex items-center justify-center gap-2">
        <Icon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      {(conflictOperation === 'merge' || conflictOperation === 'rebase') && onAbortOperation ? (
        <Button
          type="button"
          // Why: abort is the escape hatch for this state, so match the quiet
          // outline conflict-review action instead of reading as destructive.
          variant="outline"
          size="sm"
          className="mt-2 h-7 w-full text-xs"
          disabled={isAbortingOperation}
          onClick={() => onAbortOperation(conflictOperation)}
        >
          {isAbortingOperation ? <RefreshCw className="size-3.5 animate-spin" /> : null}
          {conflictOperation === 'rebase'
            ? translate('auto.components.right.sidebar.SourceControl.425f138269', 'Abort rebase')
            : translate('auto.components.right.sidebar.SourceControl.540ca8f78c', 'Abort merge')}
        </Button>
      ) : null}
    </div>
  )
}

export function TooManyChangesBanner({ limit }: { limit: number }): React.JSX.Element {
  return (
    <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs text-foreground">
          {translate(
            'auto.components.right.sidebar.SourceControl.tooManyChanges',
            'Too many changes detected. Only the first {{value0}} are shown.',
            { value0: limit.toLocaleString() }
          )}
        </span>
      </div>
    </div>
  )
}

function SourceControlTreeDirectoryRow({
  node,
  actionPaths,
  hideBulkActions,
  isExecutingBulk,
  isCollapsed,
  onToggle,
  onRequestDiscardPaths,
  onStagePaths,
  onUnstagePaths
}: {
  node: SourceControlTreeDirectoryNode
  actionPaths: SourceControlDirectoryActionPaths
  hideBulkActions: boolean
  isExecutingBulk: boolean
  isCollapsed: boolean
  onToggle: () => void
  onRequestDiscardPaths: (area: DiscardAllArea, paths: readonly string[]) => void
  onStagePaths: (paths: readonly string[]) => Promise<void>
  onUnstagePaths: (paths: readonly string[]) => Promise<void>
}): React.JSX.Element {
  // Why: filtered tree nodes only contain visible descendants. Folder-wide
  // bulk labels would overpromise if they acted on that filtered subset.
  const canStage = !hideBulkActions && actionPaths.stagePaths.length > 0
  const canUnstage = !hideBulkActions && actionPaths.unstagePaths.length > 0
  const canDiscard = !hideBulkActions && actionPaths.discardPaths.length > 0

  return (
    <div
      className="group relative flex w-full items-center gap-1 pr-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
      style={{
        paddingLeft: `${node.depth * SOURCE_CONTROL_TREE_INDENT_PX + SOURCE_CONTROL_TREE_DIRECTORY_PADDING_PX}px`
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <ChevronDown
          className={cn('size-3 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
        />
        {isCollapsed ? (
          <Folder className="size-3 shrink-0" />
        ) : (
          <FolderOpen className="size-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      <span className="w-4 shrink-0 text-center text-[10px] font-bold tabular-nums text-muted-foreground/80">
        {node.fileCount}
      </span>
      {(canDiscard || canStage || canUnstage) && (
        <div className={SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS}>
          {canDiscard && (
            <ActionButton
              icon={node.area === 'untracked' ? Trash : Undo2}
              title={
                node.area === 'untracked'
                  ? translate(
                      'auto.components.right.sidebar.SourceControl.9b367363b6',
                      'Delete untracked in folder'
                    )
                  : translate(
                      'auto.components.right.sidebar.SourceControl.6d7f2a47e5',
                      'Discard folder'
                    )
              }
              onClick={(event) => {
                event.stopPropagation()
                onRequestDiscardPaths(node.area, actionPaths.discardPaths)
              }}
              disabled={isExecutingBulk}
            />
          )}
          {canStage && (
            <ActionButton
              icon={Plus}
              title={translate(
                'auto.components.right.sidebar.SourceControl.bfe9011a0e',
                'Stage folder'
              )}
              onClick={(event) => {
                event.stopPropagation()
                void onStagePaths(actionPaths.stagePaths)
              }}
              disabled={isExecutingBulk}
            />
          )}
          {canUnstage && (
            <ActionButton
              icon={Minus}
              title={translate(
                'auto.components.right.sidebar.SourceControl.ab31221779',
                'Unstage folder'
              )}
              onClick={(event) => {
                event.stopPropagation()
                void onUnstagePaths(actionPaths.unstagePaths)
              }}
              disabled={isExecutingBulk}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SourceControlBranchTreeDirectoryRow({
  node,
  isCollapsed,
  onToggle
}: {
  node: BranchSourceControlTreeDirectoryNode
  isCollapsed: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <div
      className="group relative flex w-full items-center gap-1 pr-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
      style={{
        paddingLeft: `${node.depth * SOURCE_CONTROL_TREE_INDENT_PX + SOURCE_CONTROL_TREE_DIRECTORY_PADDING_PX}px`
      }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <ChevronDown
          className={cn('size-3 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
        />
        {isCollapsed ? (
          <Folder className="size-3 shrink-0" />
        ) : (
          <FolderOpen className="size-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>
      <span className="w-4 shrink-0 text-center text-[10px] font-bold tabular-nums text-muted-foreground/80">
        {node.fileCount}
      </span>
    </div>
  )
}

// Why: a compact +added/-removed magnitude lets users gauge change size at a
// glance. Use git decoration tokens so the source-control sidebar follows the
// documented light/dark status palette.
function DiffLineCounts({
  added,
  removed
}: {
  added?: number
  removed?: number
}): React.JSX.Element | null {
  const hasAdded = typeof added === 'number' && added > 0
  const hasRemoved = typeof removed === 'number' && removed > 0
  if (!hasAdded && !hasRemoved) {
    return null
  }
  return (
    <span className="shrink-0 tabular-nums text-[10px]">
      {hasAdded && <span style={{ color: 'var(--git-decoration-added)' }}>+{added}</span>}
      {hasAdded && hasRemoved && <span> </span>}
      {hasRemoved && <span style={{ color: 'var(--git-decoration-deleted)' }}>-{removed}</span>}
    </span>
  )
}

const UncommittedEntryRow = React.memo(function UncommittedEntryRow({
  entryKey,
  entry,
  currentWorktreeId,
  worktreePath,
  depth = 0,
  selected,
  isOpenFile = false,
  onSelect,
  onContextMenu,
  onRevealInExplorer,
  connectionId,
  onOpen,
  onStage,
  onUnstage,
  onDiscard,
  commentCount,
  showPathHint = true
}: {
  entryKey: string
  entry: GitStatusEntry
  currentWorktreeId: string
  worktreePath: string
  depth?: number
  selected?: boolean
  isOpenFile?: boolean
  onSelect?: (e: React.MouseEvent, key: string, entry: GitStatusEntry) => void
  onContextMenu?: (key: string) => void
  onRevealInExplorer: (worktreeId: string, absolutePath: string) => void
  connectionId?: string | null
  onOpen: (entry: GitStatusEntry, event?: SourceControlRowOpenEvent) => void
  onStage: (filePath: string) => Promise<void>
  onUnstage: (filePath: string) => Promise<void>
  onDiscard: (entry: GitStatusEntry) => void
  commentCount: number
  showPathHint?: boolean
}): React.JSX.Element {
  const FileIcon = getFileTypeIcon(entry.path)
  const fileName = basename(entry.path)
  const parentDir = dirname(entry.path)
  const dirPath = parentDir === '.' ? '' : parentDir
  const isUnresolvedConflict = entry.conflictStatus === 'unresolved'
  const isResolvedLocally = entry.conflictStatus === 'resolved_locally'
  const isSubmoduleWorktreeOnly = isSubmoduleWorktreeOnlyChange(entry)
  const conflictLabel = entry.conflictKind
    ? getLocalizedConflictKindLabel(entry.conflictKind)
    : null
  // Why: the hint text ("Open and edit…", "Decide whether to…") was removed
  // from the sidebar because it's not actionable here — the user can only
  // click the row, and the conflict-kind label alone is sufficient context.
  // Why: Stage is suppressed for unresolved conflicts because `git add` would
  // immediately erase the `u` record — the only live conflict signal in the
  // sidebar — before the user has actually reviewed the file. The user should
  // resolve in the editor first, then stage from the post-resolution state.
  //
  // Discard is hidden for both unresolved AND resolved_locally rows in v1.
  // For unresolved: discarding is too easy to misfire on a high-risk file.
  // For resolved_locally: discarding can silently re-create the conflict or
  // lose the resolution, and v1 does not have UX to explain this clearly.
  const canDiscard =
    !isUnresolvedConflict &&
    !isResolvedLocally &&
    (entry.area === 'unstaged' || entry.area === 'untracked')
  const canStage = isStageableStatusEntry(entry)
  const canUnstage = entry.area === 'staged'

  return (
    <SourceControlEntryContextMenu
      currentWorktreeId={currentWorktreeId}
      absolutePath={joinPath(worktreePath, entry.path)}
      connectionId={connectionId}
      onView={() => onOpen(entry)}
      onRevealInExplorer={onRevealInExplorer}
      onOpenChange={(open) => {
        if (open && onContextMenu) {
          onContextMenu(entryKey)
        }
      }}
    >
      <div
        data-testid="source-control-entry"
        data-source-control-path={entry.path}
        data-source-control-area={entry.area}
        // Why: the currently open file gets the strongest "current row" accent
        // (full `bg-accent` + `data-current`) per the styleguide, outranking the
        // lighter bulk-selection tint so the open file always reads as active.
        data-current={isOpenFile ? 'true' : undefined}
        className={cn(
          'group relative flex cursor-pointer items-center gap-1 pr-3 py-1 transition-colors',
          isOpenFile ? 'bg-accent hover:bg-accent' : 'hover:bg-accent/40',
          !isOpenFile && selected && 'bg-accent/60'
        )}
        style={{
          paddingLeft: `${depth * SOURCE_CONTROL_TREE_INDENT_PX + SOURCE_CONTROL_TREE_FILE_PADDING_PX}px`
        }}
        draggable
        onDragStart={(e) => {
          if (isUnresolvedConflict && entry.status === 'deleted') {
            e.preventDefault()
            return
          }
          const absolutePath = joinPath(worktreePath, entry.path)
          e.dataTransfer.setData(WORKSPACE_FILE_PATH_MIME, absolutePath)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={(e) => {
          if (onSelect) {
            onSelect(e, entryKey, entry)
          } else {
            onOpen(entry, e)
          }
        }}
        onDoubleClick={(e) => {
          onOpen(entry, toPermanentSourceControlRowOpenEvent(e))
        }}
      >
        <FileIcon className="size-3.5 shrink-0" style={{ color: STATUS_COLORS[entry.status] }} />
        <div className="min-w-0 flex-1 text-xs">
          <span className="min-w-0 block truncate">
            <span className="text-foreground">{fileName}</span>
            {showPathHint && dirPath && (
              <span className="ml-1.5 text-[11px] text-muted-foreground">{dirPath}</span>
            )}
          </span>
          {(conflictLabel || isSubmoduleWorktreeOnly) && (
            <div className="truncate text-[11px] text-muted-foreground">
              {conflictLabel ?? SUBMODULE_WORKTREE_ONLY_LABEL}
            </div>
          )}
        </div>
        {commentCount > 0 && (
          // Why: show a small note marker on any row that has diff notes
          // so the user can tell at a glance which files have review notes
          // attached, without opening the Notes tab.
          <span
            className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
            title={translate(
              'auto.components.right.sidebar.SourceControl.657e0c90ad',
              '{{value0}} note{{value1}}',
              { value0: commentCount, value1: commentCount === 1 ? '' : 's' }
            )}
          >
            <MessageSquare className="size-3" />
            <span className="tabular-nums">{commentCount}</span>
          </span>
        )}
        {entry.conflictStatus ? (
          <ConflictBadge entry={entry} />
        ) : (
          <>
            <DiffLineCounts added={entry.added} removed={entry.removed} />
            <span
              className="w-4 shrink-0 text-center text-[10px] font-bold"
              style={{ color: STATUS_COLORS[entry.status] }}
            >
              {STATUS_LABELS[entry.status]}
            </span>
          </>
        )}
        <div className={SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS}>
          {canDiscard && (
            <ActionButton
              icon={entry.area === 'untracked' ? Trash : Undo2}
              title={
                entry.area === 'untracked'
                  ? translate(
                      'auto.components.right.sidebar.SourceControl.11463f7a98',
                      'Delete untracked file'
                    )
                  : entry.status === 'deleted'
                    ? translate(
                        'auto.components.right.sidebar.SourceControl.989f3d5e34',
                        'Restore file'
                      )
                    : translate(
                        'auto.components.right.sidebar.SourceControl.d54dd48b0b',
                        'Discard changes'
                      )
              }
              onClick={(event) => {
                event.stopPropagation()
                onDiscard(entry)
              }}
            />
          )}
          {(canStage || isSubmoduleWorktreeOnly) && (
            <ActionButton
              icon={Plus}
              title={
                isSubmoduleWorktreeOnly
                  ? SUBMODULE_WORKTREE_ONLY_STAGE_TOOLTIP
                  : translate('auto.components.right.sidebar.SourceControl.8cde1a2fb0', 'Stage')
              }
              onClick={(event) => {
                event.stopPropagation()
                void onStage(entry.path)
              }}
              disabled={isSubmoduleWorktreeOnly}
            />
          )}
          {canUnstage && (
            <ActionButton
              icon={Minus}
              title={translate('auto.components.right.sidebar.SourceControl.df5040e3c3', 'Unstage')}
              onClick={(event) => {
                event.stopPropagation()
                void onUnstage(entry.path)
              }}
            />
          )}
        </div>
      </div>
    </SourceControlEntryContextMenu>
  )
})

function ConflictBadge({ entry }: { entry: GitStatusEntry }): React.JSX.Element {
  const isUnresolvedConflict = entry.conflictStatus === 'unresolved'
  const label = isUnresolvedConflict
    ? translate('auto.components.right.sidebar.SourceControl.31f6d46278', 'Unresolved')
    : translate('auto.components.right.sidebar.SourceControl.2c417432b7', 'Resolved locally')
  const conflictKindLabel = entry.conflictKind
    ? getLocalizedConflictKindLabel(entry.conflictKind)
    : null
  const Icon = isUnresolvedConflict ? TriangleAlert : CircleCheck
  const badge = (
    <span
      role="status"
      aria-label={
        conflictKindLabel
          ? translate(
              'auto.components.right.sidebar.SourceControl.d206117f90',
              '{{value0}} conflict ({{value1}})',
              { value0: label, value1: conflictKindLabel }
            )
          : translate(
              'auto.components.right.sidebar.SourceControl.05838cfdeb',
              '{{value0}} conflict',
              { value0: label }
            )
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        isUnresolvedConflict
          ? 'bg-destructive/12 text-destructive'
          : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
      )}
    >
      <Icon className="size-3" />
      <span>{label}</span>
    </span>
  )

  if (isUnresolvedConflict) {
    return badge
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="left" sideOffset={6}>
          {translate(
            'auto.components.right.sidebar.SourceControl.03194cfff4',
            'Local session state derived from a conflict you opened here.'
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function BranchEntryRow({
  entry,
  currentWorktreeId,
  worktreePath,
  depth = 0,
  onRevealInExplorer,
  connectionId,
  onOpen,
  commentCount,
  showPathHint = true
}: {
  entry: GitBranchChangeEntry
  currentWorktreeId: string
  worktreePath: string
  depth?: number
  onRevealInExplorer: (worktreeId: string, absolutePath: string) => void
  connectionId?: string | null
  onOpen: (event?: SourceControlRowOpenEvent) => void
  commentCount: number
  showPathHint?: boolean
}): React.JSX.Element {
  const FileIcon = getFileTypeIcon(entry.path)
  const fileName = basename(entry.path)
  const parentDir = dirname(entry.path)
  const dirPath = parentDir === '.' ? '' : parentDir

  return (
    <SourceControlEntryContextMenu
      currentWorktreeId={currentWorktreeId}
      absolutePath={joinPath(worktreePath, entry.path)}
      connectionId={connectionId}
      onView={() => onOpen()}
      onRevealInExplorer={onRevealInExplorer}
    >
      <div
        className="group flex cursor-pointer items-center gap-1 pr-3 py-1 transition-colors hover:bg-accent/40"
        style={{
          paddingLeft: `${depth * SOURCE_CONTROL_TREE_INDENT_PX + SOURCE_CONTROL_TREE_FILE_PADDING_PX}px`
        }}
        draggable
        onDragStart={(e) => {
          const absolutePath = joinPath(worktreePath, entry.path)
          e.dataTransfer.setData(WORKSPACE_FILE_PATH_MIME, absolutePath)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={(e) => onOpen(e)}
        onDoubleClick={(e) => onOpen(toPermanentSourceControlRowOpenEvent(e))}
      >
        <FileIcon className="size-3.5 shrink-0" style={{ color: STATUS_COLORS[entry.status] }} />
        <span className="min-w-0 flex-1 truncate text-xs">
          <span className="text-foreground">{fileName}</span>
          {showPathHint && dirPath && (
            <span className="ml-1.5 text-[11px] text-muted-foreground">{dirPath}</span>
          )}
        </span>
        {commentCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
            title={translate(
              'auto.components.right.sidebar.SourceControl.657e0c90ad',
              '{{value0}} note{{value1}}',
              { value0: commentCount, value1: commentCount === 1 ? '' : 's' }
            )}
          >
            <MessageSquare className="size-3" />
            <span className="tabular-nums">{commentCount}</span>
          </span>
        )}
        <DiffLineCounts added={entry.added} removed={entry.removed} />
        <span
          className="w-4 shrink-0 text-center text-[10px] font-bold"
          style={{ color: STATUS_COLORS[entry.status] }}
        >
          {STATUS_LABELS[entry.status]}
        </span>
      </div>
    </SourceControlEntryContextMenu>
  )
}

function EmptyState({
  heading,
  supportingText
}: {
  heading: string
  supportingText: string
}): React.JSX.Element {
  return (
    <div className="px-4 py-6">
      <div className="text-sm font-medium text-foreground">{heading}</div>
      <div className="mt-1 text-xs text-muted-foreground">{supportingText}</div>
    </div>
  )
}

export function ActionButton({
  icon: Icon,
  title,
  onClick,
  disabled
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  onClick: (event: React.MouseEvent) => void
  disabled?: boolean
}): React.JSX.Element {
  // Why: use the Radix Tooltip instead of the native `title` attribute so the
  // label matches the rest of the sidebar chrome (consistent styling, no OS
  // delay quirks, dismissible on pointer leave).
  //
  // Why (no local TooltipProvider): the app root mounts a single
  // TooltipProvider (see App.tsx); nesting another one here gives this subtree
  // its own delay-timing state and breaks Radix's "skip the open delay when
  // moving between adjacent tooltip triggers" handoff between sibling action
  // buttons in the section header.
  //
  // Why (disabled handling): Radix's TooltipTrigger asChild on a disabled
  // <button> gets pointer-events blocked in Chromium, which suppresses the
  // tooltip entirely — a regression vs. the native `title` attribute it
  // replaced. We keep the button interactive and rely on the caller's
  // `isExecutingBulk` early-return to no-op the click during bulk ops;
  // `aria-disabled` + visual dimming preserves the disabled affordance.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(
            'text-muted-foreground hover:bg-background/70 hover:text-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label={title}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault()
              return
            }
            onClick(event)
          }}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {title}
      </TooltipContent>
    </Tooltip>
  )
}

function compareGitStatusEntries(a: GitStatusEntry, b: GitStatusEntry): number {
  return (
    getConflictSortRank(a) - getConflictSortRank(b) ||
    a.path.localeCompare(b.path, undefined, { numeric: true })
  )
}

function getConflictSortRank(entry: GitStatusEntry): number {
  if (entry.conflictStatus === 'unresolved') {
    return 0
  }
  if (entry.conflictStatus === 'resolved_locally') {
    return 1
  }
  return 2
}
