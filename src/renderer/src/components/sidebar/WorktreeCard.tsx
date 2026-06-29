/* eslint-disable max-lines -- Why: the worktree card centralizes sidebar card state (selection, drag, agent status, git info, context menu) in one cohesive component so sidebar rendering doesn't fan out across files. */
import React, { useCallback, useState } from 'react'
import { useAppStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  GitMerge,
  LoaderCircle,
  Server,
  ServerOff,
  Star,
  Trash2,
  Workflow
} from 'lucide-react'
import CacheTimer, { usePromptCacheCountdownStartedAt } from './CacheTimer'
import WorktreeContextMenu from './WorktreeContextMenu'
import { SshDisconnectedDialog } from './SshDisconnectedDialog'
import { AutoRenameFailedDialog } from './AutoRenameFailedDialog'
import WorktreeCardAgents from './WorktreeCardAgents'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import { WorktreeCardStatusSlot } from './WorktreeCardStatusSlot'
import { cn } from '@/lib/utils'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Worktree, Repo } from '../../../../shared/types'
import { CONFLICT_OPERATION_LABELS } from './WorktreeCardHelpers'
import {
  WorktreeCardDetailsHover,
  hasWorktreeCardDetails,
  WorktreeCardMetaBadges
} from './WorktreeCardMeta'
import { WorktreeCardPortsDetails, WorktreeCardPortsTrigger } from './WorktreeCardPorts'
import { writeWorkspaceDragData } from './workspace-status'
import {
  coerceWorktreeCardVisibleTitle,
  getWorktreeCardTitleDisplay
} from './worktree-card-title-display'
import { useWorktreeCardDetailsHoverControl } from './worktree-card-details-hover-state'
import { isEventTargetInsideCurrentTarget } from './worktree-card-dom-events'
import { getWorkspacePortsByWorktreeId } from '@/lib/workspace-port-groups'
import { RepoBadgeMark } from '@/components/repo/RepoBadgeLabel'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { resolveRepoHeaderColor } from './project-header-color'
import { runWorktreeDelete } from './delete-worktree-flow'
import { WorktreeTitleInlineRename } from './WorktreeTitleInlineRename'
import { TruncatedSidebarLabel } from './truncated-sidebar-label'
import {
  canShowWorkspaceDeleteQuickAction,
  useWorkspaceDeleteModifierPressed
} from './workspace-delete-quick-action'
import { DetachedHeadBadge } from '@/components/DetachedHeadBadge'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import {
  getFlushWorktreeCardPaddingLeft,
  getNewCardStyleParentContentMarginLeft
} from './worktree-list-indentation'
import { translate } from '@/i18n/i18n'
import { recordRendererCrashBreadcrumb } from '@/lib/crash-diagnostics'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { parseExecutionHostId } from '../../../../shared/execution-host'
import { DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE } from '../../../../shared/constants'

type WorktreeRenameRequest = {
  worktreeId: string
  rowKey?: string
}

export type ActiveSurfaceVariant = 'primary' | 'secondary'

type WorktreeCardProps = {
  worktree: Worktree
  repo: Repo | undefined
  isActive: boolean
  isCurrentWorktree?: boolean
  isActiveSurface?: boolean
  activeSurfaceVariant?: ActiveSurfaceVariant
  isMultiSelected?: boolean
  revealHighlight?: boolean
  revealHighlightTone?: 'default' | 'ai'
  selectedWorktrees?: readonly Worktree[]
  hideRepoBadge?: boolean
  hostContextLabel?: string
  inPinnedSection?: boolean
  activationRowKey?: string
  renameRowKey?: string
  contentIndent?: number
  flushSurface?: boolean
  lineageChildCount?: number
  lineageCollapsed?: boolean
  lineageChildren?: React.ReactNode
  lineageChildrenStyle?: React.CSSProperties
  onLineageToggle?: (event: React.MouseEvent<HTMLButtonElement>) => void
  isLineageDropTarget?: boolean
  onActivate?: () => void
  onImmediateActivate?: (worktreeId: string, rowKey: string | undefined) => void
  onSelectionGesture?: (event: React.MouseEvent<HTMLElement>, worktreeId: string) => boolean
  onContextMenuSelect?: (
    event: React.MouseEvent<HTMLElement>,
    worktree: Worktree
  ) => readonly Worktree[]
  onCardDragStart?: (
    event: React.DragEvent<HTMLDivElement>,
    worktreeId: string,
    draggedIds: readonly string[]
  ) => void
  onCardDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
  nativeDragEnabled?: boolean
  affiliateListMode?: boolean
}

const EMPTY_WORKSPACE_PORTS = []

export function shouldBeginWorktreeRename(
  request: WorktreeRenameRequest | null,
  worktreeId: string,
  rowKey: string | undefined
): boolean {
  return (
    request?.worktreeId === worktreeId &&
    (request.rowKey === undefined || request.rowKey === rowKey)
  )
}

function formatSparseDirectoryPreview(directories: string[]): string {
  const preview = directories.slice(0, 4).join(', ')
  return directories.length <= 4 ? preview : `${preview}, +${directories.length - 4} more`
}

function getDirectoryName(folderPath: string): string {
  const normalized = folderPath.replace(/[\\/]+$/, '')
  const parts = normalized.split(/[\\/]+/)
  return parts.at(-1) || normalized || folderPath
}

// Why: the pinned repo icon and the compact inline badge share one chip shell;
// keep the box + tooltip identical so both repo cues read as the same affordance.
function RepoIdentityChip({
  repo,
  children
}: {
  repo: Repo
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-worktree-sidebar-border bg-worktree-sidebar-accent/55"
          aria-label={translate(
            'auto.components.sidebar.WorktreeCard.35ccfe2475',
            'Project {{value0}}',
            { value0: repo.displayName }
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {repo.displayName}
      </TooltipContent>
    </Tooltip>
  )
}

const WorktreeCard = React.memo(function WorktreeCard({
  worktree,
  repo,
  isActive,
  isActiveSurface = isActive,
  activeSurfaceVariant = 'primary',
  isMultiSelected = false,
  revealHighlight = false,
  revealHighlightTone = 'default',
  selectedWorktrees,
  onActivate,
  onImmediateActivate,
  onSelectionGesture,
  onContextMenuSelect,
  onCardDragStart,
  onCardDragEnd,
  nativeDragEnabled = true,
  hideRepoBadge,
  hostContextLabel,
  inPinnedSection = false,
  activationRowKey,
  renameRowKey,
  contentIndent = 0,
  flushSurface = false,
  lineageChildCount = 0,
  lineageCollapsed = false,
  lineageChildren,
  lineageChildrenStyle,
  onLineageToggle,
  isLineageDropTarget = false,
  affiliateListMode = false
}: WorktreeCardProps) {
  const openModal = useAppStore((s) => s.openModal)
  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const deleteFolderWorkspace = useAppStore((s) => s.deleteFolderWorkspace)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const renamingWorktreeId = useAppStore((s) => s.renamingWorktreeId)
  const setRenamingWorktreeId = useAppStore((s) => s.setRenamingWorktreeId)
  const settings = useAppStore((s) => s.settings)
  const cardProps = useAppStore((s) => s.worktreeCardProperties)
  const agentActivityDisplayMode =
    useAppStore((s) => s.agentActivityDisplayMode) ?? DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE
  const projectGroups = useAppStore((s) => s.projectGroups)
  const newCardStyle = settings?.experimentalNewWorktreeCardStyle === true
  const compactCards = !newCardStyle && settings?.compactWorktreeCards === true
  const activeSurfaceIsSecondary = isActiveSurface && activeSurfaceVariant === 'secondary'
  const handleEditComment = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openModal('edit-meta', {
        worktreeId: worktree.id,
        currentDisplayName: worktree.displayName,
        currentIssue: worktree.linkedIssue,
        currentPR: worktree.linkedPR,
        currentComment: worktree.comment,
        focus: 'comment'
      })
    },
    [worktree, openModal]
  )

  const deleteState = useAppStore((s) => s.deleteStateByWorktreeId[worktree.id])
  const conflictOperation = useAppStore((s) => s.gitConflictOperationByWorktree[worktree.id])
  const remoteBranchConflict = useAppStore((s) => s.remoteBranchConflictByWorktreeId[worktree.id])
  const workspacePorts = useAppStore(
    (s) =>
      getWorkspacePortsByWorktreeId(s.workspacePortScan?.result).get(worktree.id) ??
      EMPTY_WORKSPACE_PORTS
  )

  // SSH disconnected state
  const sshStatus = useAppStore((s) => {
    if (!repo?.connectionId) {
      return null
    }
    const state = s.sshConnectionStates.get(repo.connectionId)
    return state?.status ?? 'disconnected'
  })
  const isSshDisconnected = sshStatus != null && sshStatus !== 'connected'

  // Why: runtime ("Orca server") hosts get the same disconnected treatment as
  // SSH — when the host's runtime environment has no live status, its worktrees
  // are dimmed and marked disconnected instead of looking fully available.
  const isRuntimeDisconnected = useAppStore((s) => {
    const parsed = parseExecutionHostId(repo?.executionHostId)
    if (parsed?.kind !== 'runtime') {
      return false
    }
    return !s.runtimeStatusByEnvironmentId.get(parsed.environmentId)?.status
  })
  const [showDisconnectedDialog, setShowDisconnectedDialog] = useState(false)
  const sshDisconnectedPromptKey = isActive && isSshDisconnected ? worktree.id : null
  const [lastSshDisconnectedPromptKey, setLastSshDisconnectedPromptKey] = useState<string | null>(
    null
  )
  const [titleRenaming, setTitleRenaming] = useState(false)
  const [showRenameErrorDialog, setShowRenameErrorDialog] = useState(false)

  // Why: on restart the previously-active worktree is auto-restored without a
  // click, so the dialog never opens. Auto-show it for the active card when SSH
  // is disconnected, but keep dismissals sticky until that prompt key changes.
  if (sshDisconnectedPromptKey !== lastSshDisconnectedPromptKey) {
    setLastSshDisconnectedPromptKey(sshDisconnectedPromptKey)
    if (sshDisconnectedPromptKey) {
      setShowDisconnectedDialog(true)
    }
  }
  // Why: read the target label from the store (populated during hydration in
  // useIpcEvents.ts) instead of calling listTargets IPC per card instance.
  const sshTargetLabel = useAppStore((s) =>
    repo?.connectionId ? (s.sshTargetLabels.get(repo.connectionId) ?? '') : ''
  )

  const gitIdentityDisplay = getWorktreeGitIdentityDisplay(worktree)
  const detachedHeadDisplay = gitIdentityDisplay?.kind === 'detached' ? gitIdentityDisplay : null
  const branch = gitIdentityDisplay?.kind === 'branch' ? gitIdentityDisplay.branchName : ''
  const workspaceScope = parseWorkspaceKey(worktree.id)
  const folderWorkspaceId =
    workspaceScope?.type === 'folder' ? workspaceScope.folderWorkspaceId : null
  const isFolder = repo ? isFolderRepo(repo) : folderWorkspaceId !== null
  // Why: project groups are the product gate for folder workspaces, so folder
  // paths stay hidden from identity surfaces until that capability exists.
  const hasProjectGroups = projectGroups.length > 0
  const branchIdentityDisplay = !isFolder && branch.length > 0 ? branch : undefined
  const folderPathIdentityDisplay =
    isFolder && hasProjectGroups && worktree.path.trim().length > 0 ? worktree.path : undefined
  const identityDisplay = branchIdentityDisplay ?? folderPathIdentityDisplay
  const hasPathIdentityEnabled = cardProps.includes('branch')
  const showIdentityInNewCard = newCardStyle && hasPathIdentityEnabled && Boolean(identityDisplay)
  const folderMetaRowContent = newCardStyle
    ? hasPathIdentityEnabled && Boolean(folderPathIdentityDisplay)
    : isFolder
  const cardTitleDisplay = getWorktreeCardTitleDisplay({
    storedDisplayName: worktree.displayName,
    branchName: branch
  })
  const legacyCardTitleDisplay = coerceWorktreeCardVisibleTitle(worktree.displayName)
  const visibleCardTitle = newCardStyle ? cardTitleDisplay : legacyCardTitleDisplay
  const isDeleting = deleteState?.isDeleting ?? false
  const deleteModifierPressed = useWorkspaceDeleteModifierPressed()

  const showStatus = cardProps.includes('status')
  const showComment = cardProps.includes('comment')
  const showPorts = cardProps.includes('ports')
  const detailsHoverControl = useWorktreeCardDetailsHoverControl()

  // Stable click handler – ignore clicks that are really text selections.
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isEventTargetInsideCurrentTarget(event.currentTarget, event.target)) {
        return
      }
      const selection = window.getSelection()
      // Why: only suppress the click when the selection is *inside this card*
      // (a real drag-select on the card's own text). A selection anchored
      // elsewhere — e.g. inside the markdown preview while the AI is streaming
      // writes — must not block worktree switching, otherwise the user can't
      // leave the current worktree without first clicking into a terminal to
      // clear the foreign selection.
      if (selection && selection.toString().length > 0) {
        const card = event.currentTarget
        const anchor = selection.anchorNode
        const focus = selection.focusNode
        const selectionInsideCard =
          (anchor instanceof Node && card.contains(anchor)) ||
          (focus instanceof Node && card.contains(focus))
        if (selectionInsideCard) {
          return
        }
      }
      const selectionOnly = affiliateListMode
        ? false
        : (onSelectionGesture?.(event, worktree.id) ?? false)
      if (selectionOnly) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (isDeleting) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      // Why: route sidebar clicks through the shared activation path so the
      // back/forward stack stays complete for the primary worktree navigation
      // surface instead of only recording palette-driven switches.
      recordRendererCrashBreadcrumb('sidebar_worktree_activate', {
        worktreeId: worktree.id,
        repoId: worktree.repoId,
        wasActive: isActive,
        sshDisconnected: isSshDisconnected
      })
      onImmediateActivate?.(worktree.id, activationRowKey)
      activateWorktreeFromSidebar(worktree.id)
      if (isSshDisconnected) {
        setShowDisconnectedDialog(true)
      }
      onActivate?.()
    },
    [
      affiliateListMode,
      worktree.id,
      worktree.repoId,
      isActive,
      isDeleting,
      activationRowKey,
      isSshDisconnected,
      onActivate,
      onImmediateActivate,
      onSelectionGesture
    ]
  )

  const handleRenameTitle = useCallback(
    (displayName: string) => updateWorktreeMeta(worktree.id, { displayName }),
    [updateWorktreeMeta, worktree.id]
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (affiliateListMode) {
        return
      }
      if (!isEventTargetInsideCurrentTarget(event.currentTarget, event.target)) {
        return
      }
      openModal('edit-meta', {
        worktreeId: worktree.id,
        currentDisplayName: worktree.displayName,
        currentIssue: worktree.linkedIssue,
        currentPR: worktree.linkedPR,
        currentComment: worktree.comment
      })
    },
    [
      openModal,
      affiliateListMode,
      worktree.comment,
      worktree.displayName,
      worktree.id,
      worktree.linkedIssue,
      worktree.linkedPR
    ]
  )

  const handleToggleUnreadQuick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      updateWorktreeMeta(worktree.id, { isUnread: !worktree.isUnread })
    },
    [worktree.id, worktree.isUnread, updateWorktreeMeta]
  )
  // Why: delete is destructive, so it only appears while the user is holding
  // Option/Alt instead of being part of the ordinary hover chrome.
  const showDeleteQuickAction =
    !affiliateListMode &&
    canShowWorkspaceDeleteQuickAction({
      deleteModifierPressed,
      isDeleting,
      isMainWorktree: worktree.isMainWorktree
    })
  const handleWorkspaceQuickAction = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (showDeleteQuickAction) {
        if (folderWorkspaceId) {
          void deleteFolderWorkspace(folderWorkspaceId).then((deleted) => {
            if (
              deleted &&
              useAppStore.getState().activeWorktreeId === folderWorkspaceKey(folderWorkspaceId)
            ) {
              setActiveWorktree(null)
            }
          })
          return
        }
        runWorktreeDelete(worktree.id)
      }
    },
    [
      deleteFolderWorkspace,
      folderWorkspaceId,
      setActiveWorktree,
      showDeleteQuickAction,
      worktree.id
    ]
  )
  const handleOpenRenameErrorDialog = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setShowRenameErrorDialog(true)
  }, [])
  const unreadTooltip = worktree.isUnread ? 'Mark read' : 'Mark unread'
  const lineageChildAriaLabel =
    lineageChildCount === 1
      ? lineageCollapsed
        ? translate(
            'auto.components.sidebar.WorktreeList.20bebf9c7f',
            'Show {{value0}} child workspace',
            { value0: lineageChildCount }
          )
        : translate(
            'auto.components.sidebar.WorktreeList.e97297cb75',
            'Hide {{value0}} child workspace',
            { value0: lineageChildCount }
          )
      : lineageCollapsed
        ? translate(
            'auto.components.sidebar.WorktreeList.c1f4a31623',
            'Show {{value0}} child workspaces',
            { value0: lineageChildCount }
          )
        : translate(
            'auto.components.sidebar.WorktreeList.0cd15956d4',
            'Hide {{value0}} child workspaces',
            { value0: lineageChildCount }
          )
  const childWorkspaceShortLabel = `${lineageChildCount} ${
    lineageChildCount === 1
      ? translate('auto.components.sidebar.WorktreeList.0c6ee14f23', 'child')
      : translate('auto.components.sidebar.WorktreeList.045a8aed48', 'children')
  }`
  const showLineageChildChip = lineageChildCount > 0 && onLineageToggle !== undefined

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isEventTargetInsideCurrentTarget(event.currentTarget, event.target)) {
        event.preventDefault()
        return
      }
      if (isDeleting) {
        event.preventDefault()
        return
      }
      const dragIds =
        isMultiSelected && selectedWorktrees && selectedWorktrees.length > 1
          ? selectedWorktrees.map((item) => item.id)
          : worktree.id
      writeWorkspaceDragData(event.dataTransfer, dragIds)
      onCardDragStart?.(event, worktree.id, Array.isArray(dragIds) ? dragIds : [dragIds])
    },
    [isDeleting, isMultiSelected, onCardDragStart, selectedWorktrees, worktree.id]
  )

  const handleDragEnd = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isEventTargetInsideCurrentTarget(event.currentTarget, event.target)) {
        return
      }
      onCardDragEnd?.(event)
    },
    [onCardDragEnd]
  )

  const handleContextMenuSelect = useCallback(
    (event: React.MouseEvent<HTMLElement>) => onContextMenuSelect?.(event, worktree) ?? [worktree],
    [onContextMenuSelect, worktree]
  )

  const stopQuickActionPointerPropagation = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      // Why: the Kanban board is dismissed by document-level pointer handling.
      // Quick card actions mutate metadata, but must not count as card activation.
      event.stopPropagation()
    },
    []
  )

  // Why: unread is part of the left status lane, so the Status display toggle
  // owns both the dot/PR slot and unread emphasis. The persisted
  // `worktree.isUnread` flag is unchanged; only the rendering changes.
  const showUnreadEmphasis = showStatus && worktree.isUnread
  const hoverComment = worktree.comment
  const metaComment = showComment ? hoverComment : null
  const showInlineAgentList = cardProps.includes('inline-agents') && (newCardStyle || !compactCards)
  const compactInlineAgentRows = useWorktreeAgentRows(
    worktree.id,
    showInlineAgentList && agentActivityDisplayMode === 'compact'
  )
  const compactInlineAgentRowsVisible =
    showInlineAgentList &&
    agentActivityDisplayMode === 'compact' &&
    compactInlineAgentRows.length > 0
  const showAggregateCacheTimer = !compactCards && !compactInlineAgentRowsVisible
  const hasDetails = hasWorktreeCardDetails({
    issue: null,
    review: null,
    comment: metaComment
  })
  const hasPorts = showPorts && workspacePorts.length > 0
  const cacheStartedAt = usePromptCacheCountdownStartedAt(worktree.id, showAggregateCacheTimer)
  const cacheTtlMs = useAppStore((s) =>
    showAggregateCacheTimer ? (s.settings?.promptCacheTtlMs ?? 0) : 0
  )
  // Why: pinned trees mix repos in one section; a leading repo icon keeps the
  // list scannable, so it shows regardless of groupBy's hideRepoBadge.
  const showPinnedRepoIcon = inPinnedSection && !!repo
  // Why: the new card style retired the Compact/Detailed layout switch; repo
  // identity uses the same compact chip as pinned cards instead of a lower pill.
  const showRepoIdentityInTitle = newCardStyle || compactCards
  const showInlineRepoBadge =
    showRepoIdentityInTitle && !!repo && !hideRepoBadge && !isFolder && !showPinnedRepoIcon
  const showRepoBadgeInMetaRow =
    !showRepoIdentityInTitle && !!repo && !hideRepoBadge && !showPinnedRepoIcon
  const showHostContextBadge = !compactCards && !!hostContextLabel
  const showDetachedHeadInMetaRow = !compactCards && !isFolder && detachedHeadDisplay !== null
  const showBranch =
    !isFolder &&
    branch.length > 0 &&
    !newCardStyle &&
    (!compactCards || branch !== worktree.displayName)
  // Why: rebases already surface in source control; keep dense cards from
  // carrying a persistent rebase chip while preserving other interruption cues.
  const showConflictOperationBadge =
    !!conflictOperation && conflictOperation !== 'unknown' && conflictOperation !== 'rebase'
  const hasMetadataBadge = showConflictOperationBadge
  const showUnreadQuickAction = !affiliateListMode && showStatus && !newCardStyle
  // Why: the slot owns the tiny unread/status lane; legacy keeps the bell
  // toggle, while the experimental card keeps the status glyph passive.
  const showCombinedStatusSlot = showStatus
  const showTitleRowPrimary = compactCards && worktree.isMainWorktree && !isFolder
  const showMetaRowDetails = !newCardStyle && !compactCards && (hasDetails || hasPorts)
  const showTitleRowIndicators = (newCardStyle || compactCards) && (hasDetails || hasPorts)
  // Why: detailed cards need a stable metadata lane only when it has content.
  // Grouped project views can hide the repo badge; don't reserve a blank
  // metadata lane unless branch or detached-head identity has content.
  const hasDetailedMetaRowContent = Boolean(
    (showRepoBadgeInMetaRow && repo) ||
    showHostContextBadge ||
    folderMetaRowContent ||
    showBranch ||
    showIdentityInNewCard ||
    showDetachedHeadInMetaRow ||
    showConflictOperationBadge ||
    cacheStartedAt != null ||
    showMetaRowDetails
  )
  const hasMetaRow = compactCards
    ? hasMetadataBadge || cacheStartedAt != null
    : hasDetailedMetaRowContent
  const showHeaderActions = showTitleRowPrimary || showDeleteQuickAction
  // Why: the hover owns full identity when the row truncates; normalize once
  // so title/branch de-dupe and identity-only hover eligibility stay in sync.
  const trimmedVisibleCardTitle = visibleCardTitle.trim()
  const showBranchIdentityHover = newCardStyle
    ? Boolean(identityDisplay) &&
      !cardProps.includes('branch') &&
      identityDisplay !== trimmedVisibleCardTitle
    : compactCards && showBranch
  const hoverBranchName = newCardStyle
    ? identityDisplay
    : showBranchIdentityHover
      ? branch
      : undefined
  const hoverWorkspaceTitle =
    trimmedVisibleCardTitle.length > 0 && trimmedVisibleCardTitle !== hoverBranchName
      ? trimmedVisibleCardTitle
      : undefined
  const hasHoverIdentity = Boolean(hoverWorkspaceTitle || hoverBranchName)
  const hasHoverDetails =
    newCardStyle &&
    (hasWorktreeCardDetails({
      issue: null,
      review: null,
      comment: hoverComment
    }) ||
      workspacePorts.length > 0 ||
      hasHoverIdentity)
  // Why: the parent row owns metadata hover; avoid stacking the title's
  // truncation tooltip on top of the richer details popover.
  const titleWrapper = newCardStyle
    ? hasHoverDetails
      ? (title: React.ReactElement): React.ReactElement => title
      : undefined
    : compactCards && (showBranchIdentityHover || hasDetails || hasPorts)
      ? (title: React.ReactElement): React.ReactElement => (
          <WorktreeCardDetailsHover
            issue={null}
            review={null}
            comment={metaComment}
            branchName={showBranchIdentityHover ? branch : undefined}
            workspaceTitle={worktree.displayName}
            identityOrder="branch-first"
            detailsAfter={hasPorts ? <WorktreeCardPortsDetails ports={workspacePorts} /> : null}
            openDelay={100}
            hoverControl={detailsHoverControl}
            onEditComment={affiliateListMode ? undefined : handleEditComment}
          >
            {title}
          </WorktreeCardDetailsHover>
        )
      : undefined
  // Why: sidebar rows need a small surface inset, while their content remains
  // aligned with the pre-inset layout and the repo header hierarchy.
  const applyNewCardStyleStatusLaneOffset = newCardStyle && showCombinedStatusSlot
  const cardPaddingLeft = flushSurface
    ? getFlushWorktreeCardPaddingLeft(contentIndent, applyNewCardStyleStatusLaneOffset)
    : contentIndent > 0
      ? `calc(0.125rem + ${contentIndent}px)`
      : null
  const parentContentMarginLeft =
    flushSurface && applyNewCardStyleStatusLaneOffset
      ? getNewCardStyleParentContentMarginLeft(contentIndent)
      : 0
  const cardStyle = cardPaddingLeft ? { paddingLeft: cardPaddingLeft } : undefined
  const detailsAndPortsContent =
    hasDetails || hasPorts ? (
      <div className="flex shrink-0 items-center gap-1">
        {hasPorts && <WorktreeCardPortsTrigger ports={workspacePorts} />}
        {hasDetails && (
          <WorktreeCardMetaBadges
            issue={null}
            review={null}
            comment={metaComment}
            className="ml-0 pr-0"
          />
        )}
      </div>
    ) : null
  const detailsAndPorts =
    detailsAndPortsContent && !newCardStyle ? (
      <WorktreeCardDetailsHover
        issue={null}
        review={null}
        comment={metaComment}
        detailsAfter={hasPorts ? <WorktreeCardPortsDetails ports={workspacePorts} /> : null}
        hoverControl={detailsHoverControl}
        onEditComment={affiliateListMode ? undefined : handleEditComment}
      >
        {detailsAndPortsContent}
      </WorktreeCardDetailsHover>
    ) : (
      detailsAndPortsContent
    )
  const titleRowIndicators = showTitleRowIndicators ? (
    <div className="ml-auto flex shrink-0 items-center gap-1 pr-1.5">{detailsAndPorts}</div>
  ) : null
  const hasSecondaryCardContent =
    hasMetaRow || !!remoteBranchConflict || showInlineAgentList || showLineageChildChip
  const titleOnlyCard = !hasSecondaryCardContent

  const parentCardContent = (
    <div
      className={cn(
        'flex w-full min-w-0 gap-0.5 pl-0',
        titleOnlyCard ? 'items-center' : 'items-start'
      )}
      style={
        parentContentMarginLeft < 0 ? { marginLeft: `${parentContentMarginLeft}px` } : undefined
      }
      data-worktree-card-parent-content=""
    >
      {showCombinedStatusSlot ? (
        <div
          className={cn(
            'flex shrink-0 justify-center',
            newCardStyle ? 'mr-1 w-5 items-center' : 'items-start pt-[2px]',
            affiliateListMode && 'px-1'
          )}
          data-worktree-card-status-slot=""
        >
          <WorktreeCardStatusSlot
            worktreeId={worktree.id}
            showStatus={showStatus}
            showUnreadAction={showUnreadQuickAction}
            isUnread={worktree.isUnread}
            unreadTooltip={unreadTooltip}
            onPointerDown={stopQuickActionPointerPropagation}
            onToggleUnread={handleToggleUnreadQuick}
            newCardStyle={newCardStyle}
            hasBranchIdentity={Boolean(branchIdentityDisplay)}
          />
        </div>
      ) : null}

      {/* Content area */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1.5',
          // Why: inline agent rows intentionally outdent into the card gutter;
          // title/meta truncation is handled by their own inner elements.
          showInlineAgentList || (!newCardStyle && lineageChildren)
            ? 'overflow-visible'
            : 'overflow-hidden'
        )}
      >
        {/* Header row: Title */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {showPinnedRepoIcon && (
              <RepoIdentityChip repo={repo}>
                <RepoIconGlyph
                  repoIcon={repo.repoIcon}
                  color={resolveRepoHeaderColor(repo.badgeColor)}
                  className="size-full"
                  iconClassName="size-3"
                />
              </RepoIdentityChip>
            )}

            {repo?.connectionId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 inline-flex items-center">
                    {isSshDisconnected ? (
                      <ServerOff className="size-3 text-red-400" />
                    ) : (
                      <Server className="size-3 text-muted-foreground" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {isSshDisconnected
                    ? translate(
                        'auto.components.sidebar.WorktreeCard.021538e1d1',
                        'SSH disconnected'
                      )
                    : translate(
                        'auto.components.sidebar.WorktreeCard.ca74db7550',
                        'Project on SSH host'
                      )}
                </TooltipContent>
              </Tooltip>
            )}

            {!repo?.connectionId &&
              parseExecutionHostId(repo?.executionHostId)?.kind === 'runtime' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 inline-flex items-center">
                      {isRuntimeDisconnected ? (
                        <ServerOff className="size-3 text-red-400" />
                      ) : (
                        <Server className="size-3 text-muted-foreground" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {isRuntimeDisconnected
                      ? translate(
                          'auto.components.sidebar.WorktreeCard.runtimeHostDisconnected',
                          'Server disconnected'
                        )
                      : translate(
                          'auto.components.sidebar.WorktreeCard.runtimeHostProject',
                          'Project on Orca server'
                        )}
                  </TooltipContent>
                </Tooltip>
              )}

            {showInlineRepoBadge && (
              <RepoIdentityChip repo={repo}>
                <RepoIconGlyph
                  repoIcon={repo.repoIcon}
                  color={resolveRepoHeaderColor(repo.badgeColor)}
                  className="size-full"
                  iconClassName="size-3"
                />
              </RepoIdentityChip>
            )}

            {/* Why: unread alert lives in the left status lane; weight plus dimmed
                 read titles carry scan contrast in the title row. */}
            <WorktreeTitleInlineRename
              displayName={visibleCardTitle}
              disabled={isDeleting || affiliateListMode}
              showUnreadEmphasis={showUnreadEmphasis}
              dimReadTitle={newCardStyle}
              className="text-[13px] leading-5"
              editingClassName="flex-1"
              titleWrapper={titleWrapper}
              onEditingChange={affiliateListMode ? undefined : setTitleRenaming}
              onRename={handleRenameTitle}
              beginEditing={
                !affiliateListMode &&
                shouldBeginWorktreeRename(renamingWorktreeId, worktree.id, renameRowKey)
              }
              onBeginEditingConsumed={
                affiliateListMode ? undefined : () => setRenamingWorktreeId(null)
              }
            />

            {typeof worktree.firstAgentMessageRenameError === 'string' &&
            worktree.firstAgentMessageRenameError.length > 0 &&
            !titleRenaming ? (
              // The full error can be raw agent CLI output, so the title-row
              // badge opens a dialog instead of squeezing details into a tooltip.
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onPointerDown={stopQuickActionPointerPropagation}
                    onClick={handleOpenRenameErrorDialog}
                    onDoubleClick={handleOpenRenameErrorDialog}
                    className="h-4 shrink-0 gap-0.5 rounded !px-0.5 text-[10px] font-medium leading-none text-destructive border border-destructive/40 bg-destructive/10 hover:bg-destructive/15 hover:text-destructive has-[>svg]:!px-0.5"
                    aria-label={translate(
                      'auto.components.sidebar.WorktreeCard.02e19349f4',
                      'Auto-rename failed: view error'
                    )}
                  >
                    <AlertCircle className="size-2.5" />
                    {translate('auto.components.sidebar.WorktreeCard.74522ee457', 'rename failed')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {translate(
                    'auto.components.sidebar.WorktreeCard.4eba2ea99e',
                    'Auto-name failed. Click to see details.'
                  )}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {!compactCards && worktree.isMainWorktree && !isFolder && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="h-[16px] px-1.5 text-[10px] font-medium rounded shrink-0 leading-none text-foreground/70 border-foreground/20 bg-foreground/[0.06]"
                  >
                    {translate('auto.components.sidebar.WorktreeCard.7d517f82e2', 'primary')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {translate(
                    'auto.components.sidebar.WorktreeCard.0777de5970',
                    'Primary worktree (original clone directory)'
                  )}
                </TooltipContent>
              </Tooltip>
            )}

            {worktree.isSparse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="h-[16px] px-1.5 text-[10px] font-medium rounded shrink-0 leading-none text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/5"
                  >
                    {translate('auto.components.sidebar.WorktreeCard.4f964d5e8c', 'sparse')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="max-w-72">
                  <div className="space-y-1">
                    <div>
                      {translate(
                        'auto.components.sidebar.WorktreeCard.0f33af979b',
                        'Partial checkout. Files outside these paths are not on disk.'
                      )}
                    </div>
                    {worktree.sparseDirectories && worktree.sparseDirectories.length > 0 ? (
                      <div className="font-mono text-[11px] opacity-80">
                        {formatSparseDirectoryPreview(worktree.sparseDirectories)}
                      </div>
                    ) : null}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {showTitleRowIndicators && titleRowIndicators}
          </div>

          {showHeaderActions && (
            <div className="ml-auto flex shrink-0 items-center justify-center gap-1 pr-1.5">
              {showTitleRowPrimary && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="shrink-0 inline-flex items-center"
                      aria-label={translate(
                        'auto.components.sidebar.WorktreeCard.0d224eff10',
                        'Primary worktree'
                      )}
                    >
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {translate(
                      'auto.components.sidebar.WorktreeCard.0777de5970',
                      'Primary worktree (original clone directory)'
                    )}
                  </TooltipContent>
                </Tooltip>
              )}

              {showDeleteQuickAction && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-workspace-board-preserve-open=""
                      onPointerDown={stopQuickActionPointerPropagation}
                      onClick={handleWorkspaceQuickAction}
                      className={cn(
                        'inline-flex size-4 items-center justify-center rounded bg-transparent opacity-0 transition-colors transition-opacity',
                        'group-hover/worktree-card:opacity-100 group-focus-within/worktree-card:opacity-100 focus-visible:opacity-100',
                        'text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive'
                      )}
                      aria-label={translate(
                        'auto.components.sidebar.WorktreeCard.6f09f58541',
                        'Delete workspace'
                      )}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {translate(
                      'auto.components.sidebar.WorktreeCard.6f09f58541',
                      'Delete workspace'
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {hasMetaRow && (
          <div className="flex items-center gap-1.5 min-w-0" data-worktree-card-meta-row="">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {showRepoBadgeInMetaRow && repo && (
                <div className="flex items-center gap-1.5 shrink-0 px-1.5 py-0.5 rounded-[4px] bg-accent border border-border dark:bg-accent/50 dark:border-border/60">
                  <RepoBadgeMark color={repo.badgeColor} />
                  <span className="text-[10px] font-semibold text-foreground truncate max-w-[6rem] leading-none lowercase">
                    {repo.displayName}
                  </span>
                </div>
              )}

              {showHostContextBadge && (
                <Badge
                  variant="secondary"
                  className="h-[16px] max-w-[7rem] shrink-0 rounded border border-border bg-accent px-1.5 text-[10px] font-medium leading-none text-muted-foreground dark:bg-accent/80 dark:border-border/50"
                >
                  <span className="truncate">{hostContextLabel}</span>
                </Badge>
              )}

              {showIdentityInNewCard ? (
                <TruncatedSidebarLabel
                  text={identityDisplay!}
                  className="text-[11px] text-muted-foreground leading-none"
                  tooltipEnabled={!hasHoverDetails}
                />
              ) : isFolder && !newCardStyle ? (
                <span
                  className="min-w-0 truncate font-mono text-[11px] leading-none text-muted-foreground"
                  title={worktree.path}
                >
                  {getDirectoryName(worktree.path)}
                </span>
              ) : showBranch ? (
                <TruncatedSidebarLabel
                  text={branch}
                  className="text-[11px] text-muted-foreground leading-none"
                  // Why: the whole-card details hover already exposes full
                  // identity; a nested tooltip would compete for the same hover.
                  tooltipEnabled={!hasHoverDetails}
                />
              ) : showDetachedHeadInMetaRow && detachedHeadDisplay ? (
                <DetachedHeadBadge
                  display={detachedHeadDisplay}
                  label="sidebar"
                  side="right"
                  className="h-[16px]"
                />
              ) : null}

              {showConflictOperationBadge && (
                <Badge
                  variant="outline"
                  className="h-[16px] px-1.5 text-[10px] font-medium rounded shrink-0 gap-1 text-amber-600 border-amber-500/30 bg-amber-500/5 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-400/5 leading-none"
                >
                  <GitMerge className="size-2.5" />
                  {CONFLICT_OPERATION_LABELS[conflictOperation]}
                </Badge>
              )}

              {cacheStartedAt != null && (
                <CacheTimer startedAt={cacheStartedAt} ttlMs={cacheTtlMs} />
              )}
            </div>

            {showMetaRowDetails && (
              <div className="ml-auto flex shrink-0 items-center gap-1 pr-1.5">
                {detailsAndPorts}
              </div>
            )}
          </div>
        )}

        {remoteBranchConflict && (
          <div className="mt-0.5 flex items-start gap-1.5 rounded border border-amber-500/25 bg-amber-500/5 px-1.5 py-1 text-[10.5px] leading-snug text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-[1px] size-3 shrink-0" />
            <span className="min-w-0 flex-1">
              {translate(
                'auto.components.sidebar.WorktreeCard.a88c92d0e3',
                '{{value0}}/{{value1}} already exists.',
                {
                  value0: remoteBranchConflict.remote,
                  value1: remoteBranchConflict.branchName
                }
              )}
            </span>
          </div>
        )}

        {/* Why: inline agent list. Gated on the 'inline-agents' card
             property so users can hide it. Layout coupling: this block
             grows the card height dynamically — WorktreeList uses
             measureElement on each row, so the virtualizer re-measures
             naturally when agents appear/disappear. When agents directly
             follow the title, counterbalance the card stack gap so both rows
             read as one compact header group. */}
        {showInlineAgentList && (
          <WorktreeCardAgents
            worktreeId={worktree.id}
            agents={agentActivityDisplayMode === 'compact' ? compactInlineAgentRows : undefined}
            className={hasMetaRow || remoteBranchConflict ? 'mt-0' : '-mt-1'}
          />
        )}

        {showLineageChildChip && (
          <div
            className={cn('relative mt-1 flex min-w-0 justify-start', !newCardStyle && '-ml-1')}
            style={{
              color: 'color-mix(in srgb, var(--muted-foreground) 42%, var(--worktree-sidebar))'
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="relative z-10 h-[18px] max-w-[8rem] gap-1 rounded-md border border-worktree-sidebar-border bg-worktree-sidebar px-1.5 text-[10px] font-medium leading-none text-muted-foreground shadow-none hover:bg-worktree-sidebar-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
                  aria-label={lineageChildAriaLabel}
                  aria-expanded={!lineageCollapsed}
                  onClick={onLineageToggle}
                >
                  <Workflow className="size-2.5" />
                  <span className="truncate">{childWorkspaceShortLabel}</span>
                  <ChevronDown
                    className={cn(
                      'size-2.5 transition-transform',
                      lineageCollapsed && '-rotate-90'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {lineageCollapsed
                  ? translate(
                      'auto.components.sidebar.WorktreeCard.8cb634cda6',
                      'Show child workspaces'
                    )
                  : translate(
                      'auto.components.sidebar.WorktreeCard.57eaa61b55',
                      'Hide child workspaces'
                    )}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {!newCardStyle && lineageChildren && (
          <div className="-ml-[1.125rem] mt-1.5 w-[calc(100%+1.125rem)] space-y-1">
            {lineageChildren}
          </div>
        )}
      </div>
    </div>
  )

  const parentHoverTriggerBody = (
    <div className="group/worktree-card w-full min-w-0" data-worktree-card-hover-trigger="">
      {parentCardContent}
    </div>
  )

  const parentCardBodyWithHoverDetails =
    hasHoverDetails && !titleRenaming ? (
      <WorktreeCardDetailsHover
        issue={null}
        review={null}
        comment={hoverComment}
        branchName={hoverBranchName}
        workspaceTitle={hoverWorkspaceTitle}
        detailsAfter={
          workspacePorts.length > 0 ? <WorktreeCardPortsDetails ports={workspacePorts} /> : null
        }
        openDelay={100}
        hoverControl={detailsHoverControl}
        onEditComment={affiliateListMode ? undefined : handleEditComment}
      >
        {parentHoverTriggerBody}
      </WorktreeCardDetailsHover>
    ) : (
      parentHoverTriggerBody
    )

  const cardBody = (
    <div
      className={cn(
        'relative flex cursor-pointer flex-col pr-1.5 transition-[background-color,border-color,opacity,box-shadow] duration-200 outline-none select-none',
        titleOnlyCard ? 'py-2' : 'pt-1.25 pb-1.5',
        flushSurface ? 'ml-1 w-[calc(100%-0.25rem)]' : 'ml-1',
        'rounded-lg',
        isLineageDropTarget
          ? 'border border-accent-foreground/20 bg-accent/80'
          : isActiveSurface
            ? activeSurfaceIsSecondary
              ? 'border border-sidebar-ring/25 bg-sidebar-accent/45 shadow-none ring-1 ring-sidebar-ring/15'
              : 'bg-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.015] dark:bg-white/[0.10] dark:border-border/40 dark:shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
            : isMultiSelected
              ? 'border border-worktree-sidebar-ring/35 bg-worktree-sidebar-accent/70 ring-1 ring-worktree-sidebar-ring/30'
              : 'border border-transparent worktree-sidebar-card-hover',
        isActiveSurface && isMultiSelected && 'ring-1 ring-worktree-sidebar-ring/35',
        revealHighlight && [
          'scroll-to-current-workspace-reveal-highlight',
          revealHighlightTone === 'ai' && 'scroll-to-current-workspace-reveal-highlight--ai'
        ],
        titleRenaming && '!border-transparent !bg-transparent !shadow-none !ring-0',
        isDeleting && 'opacity-50 grayscale cursor-not-allowed',
        (isSshDisconnected || isRuntimeDisconnected) && !isDeleting && 'opacity-60'
      )}
      data-worktree-card-surface="true"
      data-worktree-card-active={isActiveSurface ? activeSurfaceVariant : undefined}
      onClick={handleClick}
      onDoubleClick={affiliateListMode ? undefined : handleDoubleClick}
      draggable={!affiliateListMode && nativeDragEnabled && !isDeleting && !titleRenaming}
      onDragStart={!affiliateListMode && nativeDragEnabled ? handleDragStart : undefined}
      onDragEnd={!affiliateListMode && nativeDragEnabled ? handleDragEnd : undefined}
      aria-busy={isDeleting}
      style={cardStyle}
    >
      {isDeleting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/50">
            <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
            {translate('auto.components.sidebar.WorktreeCard.691ccfd622', 'Deleting…')}
          </div>
        </div>
      )}
      {parentCardBodyWithHoverDetails}

      {newCardStyle && lineageChildren ? (
        <div
          className="mt-1.5 space-y-1"
          data-worktree-lineage-children=""
          style={lineageChildrenStyle}
        >
          {lineageChildren}
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      {affiliateListMode ? (
        cardBody
      ) : (
        <WorktreeContextMenu
          worktree={worktree}
          newCardStyle={newCardStyle}
          selectedWorktrees={selectedWorktrees}
          onContextMenuSelect={handleContextMenuSelect}
        >
          {cardBody}
        </WorktreeContextMenu>
      )}

      {repo?.connectionId && (
        <SshDisconnectedDialog
          open={showDisconnectedDialog && isSshDisconnected}
          onOpenChange={setShowDisconnectedDialog}
          targetId={repo.connectionId}
          targetLabel={sshTargetLabel || repo.displayName}
          status={sshStatus ?? 'disconnected'}
        />
      )}

      {typeof worktree.firstAgentMessageRenameError === 'string' &&
        worktree.firstAgentMessageRenameError.length > 0 && (
          <AutoRenameFailedDialog
            open={showRenameErrorDialog}
            onOpenChange={setShowRenameErrorDialog}
            worktreeName={worktree.displayName}
            error={worktree.firstAgentMessageRenameError}
          />
        )}
    </>
  )
})

export default WorktreeCard
