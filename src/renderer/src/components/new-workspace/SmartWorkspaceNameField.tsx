/* eslint-disable max-lines -- Why: the smart name field owns source tabs,
search orchestration, and result rendering so the unified create flow stays
in one predictable form control instead of splitting state across fragments. */
/* oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Why: this component's existing reset effects need a dedicated refactor outside this provider-removal change. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CaseSensitive,
  ExternalLink,
  GitBranch,
  GitBranchPlus,
  LoaderCircle,
  Search,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { cn } from '@/lib/utils'
import { searchRuntimeRepoBaseRefDetails } from '@/runtime/runtime-repo-client'
import {
  buildSmartWorkspaceSourceRows,
  getBranchSearchRequest,
  getSmartWorkspaceEmptyHint,
  getVisibleBranchResults,
  isSmartWorkspaceSourceQueryWithinLimit,
  type SmartNameMode,
  type SmartWorkspaceSourceRow
} from './smart-workspace-source-results'
import type { BaseRefSearchResult, GitHubWorkItem } from '../../../../shared/types'
import { resolveSmartWorkspaceCommandValue } from './smart-workspace-command-value'
import { isComposerFieldToFieldFocus } from './smart-workspace-source-popover-focus'
import { translate } from '@/i18n/i18n'
import { getSmartWorkspaceNameModes } from './smart-workspace-localized-options'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'

type RepoOption = ReturnType<typeof useAppStore.getState>['repos'][number]

type SmartWorkspaceNameFieldProps = {
  repos: RepoOption[]
  repoId: string
  onRepoChange: (repoId: string) => void
  value: string
  onValueChange: (value: string) => void
  onBranchSelect: (refName: string, localBranchName: string) => void
  selectedSource: SmartWorkspaceNameSelection | null
  onClearSelectedSource: () => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  onPlainEnter?: () => void
  disabled?: boolean
  disabledPlaceholder?: string
  textOnly?: boolean
  branchesEnabled?: boolean
  repoBackedSourcesDisabled?: boolean
  onActiveSourceModeChange?: (mode: SmartNameMode) => void
  // Why: GitHub/GitLab work-item sources were removed, but the composer card
  // still forwards these props. They are accepted and ignored so the card
  // type-checks without re-plumbing its prop wiring.
  onGitHubItemSelect?: (item: GitHubWorkItem) => void
  repoBackedSearchRepos?: readonly RepoOption[]
  allowCrossRepoProjectAdd?: boolean
  crossRepoSwitchTarget?: 'project' | 'task-source'
}

export type SmartWorkspaceNameSelection = {
  kind: 'github-pr' | 'github-issue' | 'branch'
  label: string
  url?: string
}

const SEARCH_DEBOUNCE_MS = 200
const RESULT_LIMIT = 12
const EMPTY_GITHUB_ITEMS = [] as const

export function canUseGitLabSmartSource({
  localGitlabAvailable,
  repoBackedSourcesDisabled,
  sourceHostId
}: {
  localGitlabAvailable: boolean
  repoBackedSourcesDisabled: boolean
  sourceHostId: ExecutionHostId | null | undefined
}): boolean {
  if (repoBackedSourcesDisabled) {
    return false
  }
  const parsedHost = parseExecutionHostId(sourceHostId)
  return parsedHost?.kind === 'ssh' || parsedHost?.kind === 'runtime' || localGitlabAvailable
}

type RowEntry = SmartWorkspaceSourceRow

const ROW_ITEM_CLASS_NAME = 'gap-2 px-3 py-2 text-xs'

function isTypedTextSourceRow(row: RowEntry): boolean {
  return row.kind === 'use-name' || row.kind === 'create-branch'
}

function getRowItemClassName(row: RowEntry, options?: { pinnedAction?: boolean }): string {
  return cn(
    ROW_ITEM_CLASS_NAME,
    options?.pinnedAction && isTypedTextSourceRow(row) && 'bg-muted/35'
  )
}

export default function SmartWorkspaceNameField({
  repos,
  repoId,
  onRepoChange,
  value,
  onValueChange,
  onBranchSelect,
  selectedSource,
  onClearSelectedSource,
  inputRef,
  onPlainEnter,
  disabled = false,
  disabledPlaceholder,
  textOnly = false,
  branchesEnabled = true,
  repoBackedSourcesDisabled = false,
  onActiveSourceModeChange
}: SmartWorkspaceNameFieldProps): React.JSX.Element {
  // Why: tab/filter labels use the lightweight translate() helper; subscribing
  // here makes them refresh even when language changes don't remount the field.
  useTranslation()
  // Why: onRepoChange stays in the prop list for parity with the composer's
  // repo selector even though branch-only sources never switch repos here.
  void onRepoChange
  const settings = useAppStore((s) => s.settings)
  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === repoId) ?? null,
    [repoId, repos]
  )
  const selectedRepoOwnerSettings = useMemo(
    () => getRepoOwnerRoutedSettings(settings, selectedRepo),
    [selectedRepo, settings]
  )
  const [mode, setMode] = useState<SmartNameMode>(textOnly ? 'text' : 'smart')
  const [open, setOpen] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(value)
  const [branches, setBranches] = useState<BaseRefSearchResult[]>([])
  const [branchResultsSource, setBranchResultsSource] = useState<{
    repoId: string
    query: string
  } | null>(null)
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [commandValue, setCommandValue] = useState('')
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const focusedSelectedSourceKeyRef = useRef<string | null>(null)
  const tabsListRef = useRef<HTMLDivElement | null>(null)
  const localInputFocusFrameRef = useRef<number | null>(null)
  // Why: dialog autofocus and other programmatic .focus() calls can look
  // user-initiated in Electron, so gate the source popover until the user
  // actually interacts with this field or tabs from another composer control.
  const deferSourcePopoverUntilInteractionRef = useRef(true)

  useEffect(() => {
    onActiveSourceModeChange?.(mode)
  }, [mode, onActiveSourceModeChange])
  // Why: GitHub/GitLab work-item sources were removed from the renderer; only
  // the typed-name, smart (branch) and branches tabs remain.
  const availableModes = getSmartWorkspaceNameModes().filter((item) => {
    if (textOnly) {
      return item.id === 'text'
    }
    if (item.id === 'github' || item.id === 'gitlab') {
      return false
    }
    if (item.id === 'branches') {
      return branchesEnabled && !repoBackedSourcesDisabled
    }
    return true
  })

  useEffect(() => {
    if (availableModes.some((item) => item.id === mode)) {
      return
    }
    setMode(availableModes[0]?.id ?? 'text')
  }, [availableModes, mode])

  useEffect(() => {
    if (!repoBackedSourcesDisabled) {
      return
    }
    setBranches([])
    setBranchesLoading(false)
    setBranchResultsSource(null)
  }, [repoBackedSourcesDisabled])

  const selectedSourceFocusKey = selectedSource
    ? `${selectedSource.kind}:${selectedSource.label}:${selectedSource.url ?? ''}`
    : null
  const setSelectedSourceNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        focusedSelectedSourceKeyRef.current = null
        return
      }
      if (
        !selectedSourceFocusKey ||
        focusedSelectedSourceKeyRef.current === selectedSourceFocusKey
      ) {
        return
      }
      focusedSelectedSourceKeyRef.current = selectedSourceFocusKey
      // Why: after Enter accepts a source row, the input unmounts. Move focus
      // to the pill immediately so the next Enter advances to Agent.
      node.focus({ preventScroll: true })
    },
    [selectedSourceFocusKey]
  )

  const cancelLocalInputFocusFrame = useCallback((): void => {
    if (localInputFocusFrameRef.current === null) {
      return
    }
    cancelAnimationFrame(localInputFocusFrameRef.current)
    localInputFocusFrameRef.current = null
  }, [])

  const markSourcePopoverUserEngaged = useCallback((): void => {
    deferSourcePopoverUntilInteractionRef.current = false
  }, [])

  const tryOpenSourcePopover = useCallback((): void => {
    if (disabled || mode === 'text' || deferSourcePopoverUntilInteractionRef.current) {
      return
    }
    setOpen(true)
  }, [disabled, mode])

  const handleSourcePopoverOpenChange = useCallback(
    (next: boolean): void => {
      if (disabled || selectedSource) {
        setOpen(false)
        return
      }
      if (next && deferSourcePopoverUntilInteractionRef.current) {
        return
      }
      setOpen(next)
    },
    [disabled, selectedSource]
  )

  const setInputNode = useCallback(
    (node: HTMLInputElement | null) => {
      if (node === null) {
        cancelLocalInputFocusFrame()
      }
      localInputRef.current = node
      if (inputRef) {
        inputRef.current = node
      }
    },
    [cancelLocalInputFocusFrame, inputRef]
  )

  useEffect(() => {
    if (textOnly) {
      if (mode !== 'text') {
        setMode('text')
      }
      setOpen(false)
    }
  }, [mode, textOnly])

  useEffect(() => {
    if (!disabled) {
      return
    }
    setOpen(false)
    setBranches([])
    setBranchResultsSource(null)
    setBranchesLoading(false)
    setCommandValue('')
  }, [disabled])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [value])

  const branchSearchRequest = useMemo(
    () =>
      getBranchSearchRequest({
        disabled,
        branchesEnabled: branchesEnabled && !repoBackedSourcesDisabled,
        textOnly,
        mode,
        selectedRepoId: selectedRepo?.id ?? null,
        query: debouncedQuery,
        limit: RESULT_LIMIT
      }),
    [
      branchesEnabled,
      debouncedQuery,
      disabled,
      mode,
      repoBackedSourcesDisabled,
      selectedRepo?.id,
      textOnly
    ]
  )

  useEffect(() => {
    if (!branchSearchRequest) {
      setBranches([])
      setBranchResultsSource(null)
      setBranchesLoading(false)
      return
    }
    let stale = false
    setBranches([])
    setBranchResultsSource(null)
    setBranchesLoading(true)
    void searchRuntimeRepoBaseRefDetails(
      selectedRepoOwnerSettings,
      branchSearchRequest.repoId,
      branchSearchRequest.query,
      branchSearchRequest.limit
    )
      .then((results) => {
        if (!stale) {
          setBranches(results)
          setBranchResultsSource({
            repoId: branchSearchRequest.repoId,
            query: branchSearchRequest.query
          })
        }
      })
      .catch(() => {
        if (!stale) {
          setBranches([])
          setBranchResultsSource(null)
        }
      })
      .finally(() => {
        if (!stale) {
          setBranchesLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [branchSearchRequest, selectedRepoOwnerSettings])

  const rows = useMemo<RowEntry[]>(
    () =>
      buildSmartWorkspaceSourceRows({
        branches: getVisibleBranchResults({
          branches,
          mode,
          resultRepoId: branchResultsSource?.repoId ?? null,
          resultQuery: branchResultsSource?.query ?? null,
          selectedRepoId: selectedRepo?.id ?? null,
          value
        }),
        githubItems: [...EMPTY_GITHUB_ITEMS],
        mode,
        resultLimit: RESULT_LIMIT,
        value
      }),
    [branches, branchResultsSource, mode, selectedRepo?.id, value]
  )
  const { typedTextActionRow, searchResultRows } = useMemo(() => {
    const typedTextRow = rows.find(isTypedTextSourceRow) ?? null
    return {
      typedTextActionRow: typedTextRow,
      searchResultRows: typedTextRow ? rows.filter((row) => row !== typedTextRow) : rows
    }
  }, [rows])

  // Why: source rows (branches) are driven by debouncedQuery, so they're stale
  // until the user pauses typing for SEARCH_DEBOUNCE_MS. We don't filter them
  // out (causes flicker), but we force the highlight onto the pinned typed-text
  // row so cmdk's Enter handler can't auto-select a stale branch.
  const valueWithinSourceLimit = isSmartWorkspaceSourceQueryWithinLimit(value)
  const debouncedQueryWithinSourceLimit = isSmartWorkspaceSourceQueryWithinLimit(debouncedQuery)
  const trimmedValue = valueWithinSourceLimit ? value.trim() : ''
  const trimmedDebouncedQuery = debouncedQueryWithinSourceLimit ? debouncedQuery.trim() : ''
  const isQueryStale = trimmedValue.length > 0 && trimmedDebouncedQuery !== trimmedValue

  const resolvedCommandValue = resolveSmartWorkspaceCommandValue({
    currentValue: commandValue,
    rows,
    isQueryStale,
    sourceIntent: null
  })

  const loading = branchesLoading
  const ActiveInputIcon = mode === 'text' ? CaseSensitive : loading ? LoaderCircle : Search

  const handleSelect = useCallback(
    (row: RowEntry) => {
      if (row.kind === 'use-name' || row.kind === 'create-branch') {
        // Why: "create new branch" has no existing ref to base from, so
        // it follows the same path as a typed name — the workspace's branch
        // is derived from `name` and `baseBranch` stays unset (default base).
        onValueChange(row.name)
      } else if (row.kind === 'branch') {
        onBranchSelect(row.refName, row.localBranchName)
      }
      setOpen(false)
    },
    [onBranchSelect, onValueChange]
  )

  const smartPlaceholder = repoBackedSourcesDisabled
    ? translate(
        'auto.components.new.workspace.SmartWorkspaceNameField.placeholderWorkspaceName',
        'Type a workspace name'
      )
    : branchesEnabled
      ? translate(
          'auto.components.new.workspace.SmartWorkspaceNameField.placeholderSmartWithBranch',
          'Type a name or branch'
        )
      : translate(
          'auto.components.new.workspace.SmartWorkspaceNameField.placeholderWorkspaceName',
          'Type a workspace name'
        )

  const placeholder = disabled
    ? (disabledPlaceholder ??
      translate('auto.components.new.workspace.SmartWorkspaceNameField.unavailable', 'Unavailable'))
    : mode === 'smart'
      ? smartPlaceholder
      : mode === 'branches'
        ? translate(
            'auto.components.new.workspace.SmartWorkspaceNameField.searchBranches',
            'Search branches'
          )
        : translate(
            'auto.components.new.workspace.SmartWorkspaceNameField.workspaceName',
            'Workspace name'
          )

  return (
    <div className="min-w-0 space-y-1.5">
      {textOnly ? null : (
        <div className="flex min-w-0 items-center gap-2 border-b border-border/40">
          <Tabs
            value={mode}
            onValueChange={(next) => {
              const nextMode = next as SmartNameMode
              onActiveSourceModeChange?.(nextMode)
              setMode(nextMode)
              if (!disabled && nextMode !== 'text' && selectedSource === null) {
                markSourcePopoverUserEngaged()
                setOpen(true)
              } else {
                setOpen(false)
              }
              cancelLocalInputFocusFrame()
              localInputFocusFrameRef.current = requestAnimationFrame(() => {
                localInputFocusFrameRef.current = null
                localInputRef.current?.focus({ preventScroll: true })
              })
            }}
            className="min-w-0 flex-1 gap-0"
          >
            <TabsList
              ref={tabsListRef}
              variant="line"
              className="h-7 w-full justify-start gap-4 px-0"
              onFocusCapture={(event) => {
                // Why: Radix Tabs uses roving focus and re-applies tabindex=0 to
                // the active trigger on every render, so we can't keep it out of
                // the natural Tab order via props or a MutationObserver (race
                // with React commits). Instead, intercept focus on entry into
                // the tabs list so forward Tab goes straight to the input.
                const previous = event.relatedTarget as HTMLElement | null
                const list = tabsListRef.current
                const input = localInputRef.current
                if (!list || !input) {
                  return
                }
                if (!previous || previous === input || list.contains(previous)) {
                  return
                }
                event.stopPropagation()
                input.focus({ preventScroll: true })
              }}
            >
              {availableModes.map(({ id, label, Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  tabIndex={-1}
                  data-smart-name-mode={id}
                  className="flex-none gap-1.5 px-0 text-xs"
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <Popover
        open={!disabled && open && mode !== 'text' && selectedSource === null}
        onOpenChange={handleSourcePopoverOpenChange}
      >
        <Command
          value={resolvedCommandValue}
          onValueChange={setCommandValue}
          shouldFilter={false}
          className="overflow-visible bg-transparent"
        >
          <PopoverAnchor asChild>
            <div className="relative min-w-0">
              {selectedSource ? (
                // Why: min-w-0 + w-full lets the pill shrink to its flex
                // parent; without them the inner truncate's intrinsic
                // min-content (long branch name) propagates up and pushes the
                // dialog wider than its max-w.
                <div
                  ref={setSelectedSourceNode}
                  data-workspace-source-pill="true"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (
                      event.currentTarget !== event.target ||
                      event.key !== 'Enter' ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return
                    }
                    event.preventDefault()
                    onPlainEnter?.()
                  }}
                  className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
                >
                  <SelectionIcon kind={selectedSource.kind} />
                  <span className="min-w-0 flex-1 truncate font-medium leading-none text-foreground">
                    {selectedSource.label}
                  </span>
                  {selectedSource.url ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void window.api.shell.openUrl(selectedSource.url!)}
                          className="size-6 shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                          aria-label={translate(
                            'auto.components.new.workspace.SmartWorkspaceNameField.2c69728c2a',
                            'Open link in browser'
                          )}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6}>
                        {translate(
                          'auto.components.new.workspace.SmartWorkspaceNameField.370a1faf67',
                          'Open in browser'
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={onClearSelectedSource}
                        className="size-6 shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                        aria-label={translate(
                          'auto.components.new.workspace.SmartWorkspaceNameField.7199ff19c7',
                          'Clear selected source'
                        )}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {translate(
                        'auto.components.new.workspace.SmartWorkspaceNameField.0c9e668e3a',
                        'Clear'
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <>
                  <ActiveInputIcon
                    className={cn(
                      'pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground',
                      loading && mode !== 'text' && 'animate-spin'
                    )}
                  />
                  <Input
                    ref={setInputNode}
                    data-workspace-name-input="true"
                    value={value}
                    onPointerDown={() => {
                      if (!disabled && mode !== 'text') {
                        markSourcePopoverUserEngaged()
                        setOpen(true)
                      }
                    }}
                    onChange={(event) => {
                      onValueChange(event.target.value)
                      if (!disabled && mode !== 'text') {
                        markSourcePopoverUserEngaged()
                        setOpen(true)
                      }
                    }}
                    onFocus={(event) => {
                      // Why: only open when focus moves from another composer
                      // control (Tab/Shift+Tab). Dialog autofocus comes from
                      // outside the composer root and stays suppressed until
                      // click/type/tab-within-composer engagement above.
                      if (!isComposerFieldToFieldFocus(event)) {
                        return
                      }
                      markSourcePopoverUserEngaged()
                      tryOpenSourcePopover()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Tab' && event.shiftKey) {
                        const activeTrigger = tabsListRef.current?.querySelector<HTMLElement>(
                          `[data-smart-name-mode="${mode}"]`
                        )
                        if (activeTrigger) {
                          event.preventDefault()
                          activeTrigger.focus()
                          return
                        }
                      }
                      if (
                        event.key === 'Enter' &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey
                      ) {
                        if (open && rows.length > 0) {
                          const row = rows.find((entry) => entry.value === resolvedCommandValue)
                          if (row) {
                            event.preventDefault()
                            handleSelect(row)
                            return
                          }
                          // No highlighted row (e.g., stale results where the
                          // highlight was cleared to avoid auto-selecting a
                          // stale branch). Fall through to onPlainEnter so the
                          // keypress doesn't feel inert.
                        }
                        onPlainEnter?.()
                      }
                      if (event.key === 'Escape' && open) {
                        event.stopPropagation()
                        setOpen(false)
                      }
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="h-9 pl-8 text-sm"
                  />
                </>
              )}
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="popover-scroll-content flex w-[var(--radix-popover-trigger-width)] flex-col p-0"
            // Why: this popover lives inside the create-workspace dialog; a
            // taller result list can cover the submit footer while typing.
            style={{ maxHeight: 'min(var(--radix-popover-content-available-height,7rem),7rem)' }}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => {
              // Why: the input is a PopoverAnchor, not a PopoverTrigger, so
              // Radix treats clicks on it as outside the popover. Keep focus
              // clicks and mode-tab clicks from immediately closing results.
              const target = event.target as Node
              if (
                localInputRef.current?.contains(target) ||
                tabsListRef.current?.contains(target)
              ) {
                event.preventDefault()
              }
            }}
            onFocusOutside={(event) => {
              const target = event.target as Node
              if (
                localInputRef.current?.contains(target) ||
                tabsListRef.current?.contains(target)
              ) {
                event.preventDefault()
              }
            }}
          >
            <CommandList className="!max-h-none min-h-0 flex-1 scrollbar-sleek">
              {typedTextActionRow ? (
                <div
                  className="sticky top-0 z-10 border-b border-border/40 bg-popover p-1"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <CommandItem
                    key={typedTextActionRow.value}
                    value={typedTextActionRow.value}
                    onSelect={() => handleSelect(typedTextActionRow)}
                    className={getRowItemClassName(typedTextActionRow, { pinnedAction: true })}
                  >
                    <RowIcon row={typedTextActionRow} />
                    <RowLabel row={typedTextActionRow} />
                  </CommandItem>
                </div>
              ) : null}
              {loading && searchResultRows.length === 0 ? (
                <div className="space-y-1 p-1">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="h-8 animate-pulse rounded bg-muted/40" />
                  ))}
                </div>
              ) : searchResultRows.length === 0 && !typedTextActionRow ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {getSmartWorkspaceEmptyHint(mode)}
                </div>
              ) : searchResultRows.length > 0 ? (
                <CommandGroup className="p-1">
                  {searchResultRows.map((row) => (
                    <CommandItem
                      key={row.value}
                      value={row.value}
                      onSelect={() => handleSelect(row)}
                      className={getRowItemClassName(row)}
                    >
                      <RowIcon row={row} />
                      <RowLabel row={row} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </PopoverContent>
        </Command>
      </Popover>
    </div>
  )
}

function RowIcon({ row }: { row: RowEntry }): React.JSX.Element {
  if (row.kind === 'use-name') {
    return <CaseSensitive className="size-3.5 shrink-0 text-muted-foreground" />
  }
  if (row.kind === 'create-branch') {
    return <GitBranchPlus className="size-3.5 shrink-0 text-muted-foreground" />
  }
  return <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
}

function SelectionIcon({ kind }: { kind: SmartWorkspaceNameSelection['kind'] }): React.JSX.Element {
  // Why: github-pr / github-issue kinds are retained on the selection type for
  // backward compatibility but are no longer produced by the plain composer.
  void kind
  return <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
}

function RowLabel({ row }: { row: RowEntry }): React.JSX.Element {
  if (row.kind === 'use-name') {
    return (
      <span className="min-w-0 truncate">
        {translate('auto.components.new.workspace.SmartWorkspaceNameField.b1a7d679ba', 'Use')}{' '}
        <span className="font-medium text-foreground">
          {translate('auto.components.new.workspace.SmartWorkspaceNameField.34ca97bce3', '"')}
          {row.name}
          {translate('auto.components.new.workspace.SmartWorkspaceNameField.766083a596', '"')}
        </span>{' '}
        {translate(
          'auto.components.new.workspace.SmartWorkspaceNameField.a44229ce4d',
          'as workspace name'
        )}
      </span>
    )
  }
  if (row.kind === 'create-branch') {
    return (
      <span className="min-w-0 truncate">
        {translate(
          'auto.components.new.workspace.SmartWorkspaceNameField.2a0d535f69',
          'Create new branch'
        )}{' '}
        <span className="font-mono text-[11px] font-medium text-foreground">{row.name}</span>
      </span>
    )
  }
  if (row.kind === 'branch') {
    return <span className="min-w-0 truncate font-mono text-[11px]">{row.refName}</span>
  }
  return <span className="min-w-0 truncate" />
}
