import os from 'node:os'
import { app, clipboard, ipcMain } from 'electron'
import {
  type CrashReportBreadcrumbData,
  type ReactErrorBoundaryReportArgs,
  type ReactErrorBoundaryReportResult,
  formatCrashReportText,
  formatUncapturedCrashReportText,
  sanitizeCrashReportDetails,
  sanitizeCrashReportString
} from '../../shared/crash-reporting'
import type { CrashReportStore } from '../crash-reporting/crash-report-store'
import {
  getCrashBreadcrumbSnapshot,
  recordCrashBreadcrumb
} from '../crash-reporting/crash-breadcrumb-store'
import { startSpan } from '../observability/tracer'
import {
  assertClipboardTextWriteWithinLimit,
  isClipboardTextWriteTooLargeError
} from '../../shared/clipboard-text'

const recentRendererErrorReportKeys = new Map<string, number>()

const RENDERER_ERROR_DEDUPE_MS = 10 * 60 * 1000
const MAX_RENDERER_ERROR_KEY_AGE_MS = RENDERER_ERROR_DEDUPE_MS * 2
const MAX_RECENT_RENDERER_ERROR_REPORT_KEYS = 256

const REACT_ERROR_BOUNDARY_SURFACES = new Set<ReactErrorBoundaryReportArgs['surface']>([
  'app-root',
  'web-root',
  'workspace-shell',
  'sidebar',
  'terminal-workbench',
  'right-sidebar',
  'page',
  'modal',
  'overlay',
  'rich-markdown-editor'
])

function stringField(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function nullableStringField(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) {
    return null
  }
  return stringField(value, maxLength)
}

function normalizeRendererErrorReportArgs(args: unknown): ReactErrorBoundaryReportArgs | null {
  if (!args || typeof args !== 'object') {
    return null
  }
  const record = args as Record<string, unknown>
  const boundaryId = stringField(record.boundaryId, 120)
  const surface = stringField(record.surface, 80)
  const errorName = stringField(record.errorName, 120) ?? 'Error'
  const errorMessage = stringField(record.errorMessage, 1_000) ?? 'Unknown render error'
  if (
    !boundaryId ||
    !surface ||
    !REACT_ERROR_BOUNDARY_SURFACES.has(surface as ReactErrorBoundaryReportArgs['surface'])
  ) {
    return null
  }

  return {
    boundaryId,
    surface: surface as ReactErrorBoundaryReportArgs['surface'],
    errorName,
    errorMessage,
    ...(stringField(record.errorStack, 8_000)
      ? { errorStack: stringField(record.errorStack, 8_000) }
      : {}),
    ...(stringField(record.componentStack, 8_000)
      ? { componentStack: stringField(record.componentStack, 8_000) }
      : {}),
    ...(stringField(record.activeView, 80)
      ? { activeView: stringField(record.activeView, 80) }
      : {}),
    ...(nullableStringField(record.activeModal, 80) !== undefined
      ? { activeModal: nullableStringField(record.activeModal, 80) ?? null }
      : {}),
    ...(stringField(record.activeTabType, 80)
      ? { activeTabType: stringField(record.activeTabType, 80) }
      : {}),
    ...(stringField(record.activeRightSidebarTab, 80)
      ? { activeRightSidebarTab: stringField(record.activeRightSidebarTab, 80) }
      : {}),
    ...(typeof record.hasActiveWorktree === 'boolean'
      ? { hasActiveWorktree: record.hasActiveWorktree }
      : {})
  }
}

function pruneRendererErrorReportKeys(now: number): void {
  for (const [key, seenAt] of recentRendererErrorReportKeys) {
    if (now - seenAt > MAX_RENDERER_ERROR_KEY_AGE_MS) {
      recentRendererErrorReportKeys.delete(key)
    }
  }
  while (recentRendererErrorReportKeys.size > MAX_RECENT_RENDERER_ERROR_REPORT_KEYS) {
    const oldestKey = recentRendererErrorReportKeys.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    recentRendererErrorReportKeys.delete(oldestKey)
  }
}

function getRendererErrorReportKey(args: ReactErrorBoundaryReportArgs): string {
  return JSON.stringify({
    boundaryId: args.boundaryId,
    surface: args.surface,
    errorName: args.errorName,
    errorMessage: args.errorMessage,
    componentStack: args.componentStack
  }).slice(0, 12_000)
}

async function recordRendererErrorReport(
  store: CrashReportStore,
  args: unknown
): Promise<ReactErrorBoundaryReportResult> {
  const normalized = normalizeRendererErrorReportArgs(args)
  if (!normalized) {
    return { ok: false, error: 'Invalid renderer error report.' }
  }

  const now = Date.now()
  pruneRendererErrorReportKeys(now)
  const key = getRendererErrorReportKey(normalized)
  if (now - (recentRendererErrorReportKeys.get(key) ?? 0) < RENDERER_ERROR_DEDUPE_MS) {
    return { ok: true, report: null, deduped: true }
  }
  recentRendererErrorReportKeys.set(key, now)
  // Why: renderer error reports are IPC input. A broken renderer can vary the
  // component stack/message inside the age window, so bound the main-side
  // dedupe map by count as well as time.
  pruneRendererErrorReportKeys(now)

  const report = await store.record({
    source: 'renderer',
    processType: 'react-render',
    reason: 'react-error-boundary',
    exitCode: null,
    appVersion: app.getVersion(),
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    electronVersion: process.versions.electron ?? 'unknown',
    chromeVersion: process.versions.chrome ?? 'unknown',
    details: {
      boundary_id: normalized.boundaryId,
      surface: normalized.surface,
      error_name: normalized.errorName,
      error_message: normalized.errorMessage,
      ...(normalized.errorStack ? { error_stack: normalized.errorStack } : {}),
      ...(normalized.componentStack ? { component_stack: normalized.componentStack } : {}),
      ...(normalized.activeView ? { active_view: normalized.activeView } : {}),
      ...(normalized.activeModal !== undefined ? { active_modal: normalized.activeModal } : {}),
      ...(normalized.activeTabType ? { active_tab_type: normalized.activeTabType } : {}),
      ...(normalized.activeRightSidebarTab
        ? { right_sidebar_tab: normalized.activeRightSidebarTab }
        : {}),
      ...(normalized.hasActiveWorktree !== undefined
        ? { has_active_worktree: normalized.hasActiveWorktree }
        : {})
    },
    // Why: React render failures are recoverable only because a boundary
    // caught them; persist the same recent app breadcrumbs as native crashes.
    breadcrumbs: getCrashBreadcrumbSnapshot()
  })

  return { ok: true, report, deduped: false }
}

export function _resetRendererErrorReportDedupeForTests(): void {
  recentRendererErrorReportKeys.clear()
}

export function _getCrashReportingStateSizesForTests(): {
  recentRendererErrorReportKeys: number
} {
  return {
    recentRendererErrorReportKeys: recentRendererErrorReportKeys.size
  }
}

async function getLatestPendingReport(
  store: CrashReportStore
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  const reports = await store.listRecent()
  return reports.find((report) => report.status === 'pending') ?? null
}

async function getLatestSendableReport(
  store: CrashReportStore
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  const reports = await store.listRecent()
  return (
    reports.find((report) => report.status === 'pending' || report.status === 'dismissed') ?? null
  )
}

async function getRequestedCrashReport(
  store: CrashReportStore,
  args?: { reportId?: string }
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  if (args?.reportId) {
    return store.getById(args.reportId)
  }
  // Why: Help > Report Crash can intentionally submit without a report ID.
  // Do not replace that uncaptured report with a pending crash that appears later.
  return args ? null : getLatestPendingReport(store)
}

function sanitizeRendererBreadcrumbData(value: unknown): CrashReportBreadcrumbData | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const primitiveData: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'boolean' || entry === null) {
      primitiveData[key] = entry
    } else if (typeof entry === 'number' && Number.isFinite(entry)) {
      primitiveData[key] = entry
    }
  }
  const sanitized = sanitizeCrashReportDetails(primitiveData)
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function recordRendererBreadcrumbTrace(
  name: string,
  data: CrashReportBreadcrumbData | undefined
): void {
  const span = startSpan('renderer.breadcrumb', {
    attributes: {
      kind: 'crash-breadcrumb',
      'breadcrumb.name': sanitizeCrashReportString(name),
      ...(data ? { 'breadcrumb.data': data } : {})
    }
  })
  // Why: main-process native crashes cannot persist memory-only breadcrumbs.
  // A tiny trace span gives the next crash report durable pre-crash context.
  span.end()
}

function buildUncapturedCrashReportText(notes: string | undefined): string {
  return formatUncapturedCrashReportText(
    {
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      electronVersion: process.versions.electron ?? 'unknown',
      chromeVersion: process.versions.chrome ?? 'unknown'
    },
    notes
  )
}

export function registerCrashReportingHandlers(store: CrashReportStore): void {
  ipcMain.removeHandler('crashReports:getLatestPending')
  ipcMain.handle('crashReports:getLatestPending', () => getLatestPendingReport(store))

  ipcMain.removeHandler('crashReports:getLatestReport')
  ipcMain.handle('crashReports:getLatestReport', () => getLatestSendableReport(store))

  ipcMain.removeHandler('crashReports:dismiss')
  ipcMain.handle('crashReports:dismiss', (_event, args: { reportId: string }) =>
    store.dismiss(args.reportId)
  )

  ipcMain.removeAllListeners('crashReports:recordBreadcrumb')
  ipcMain.on(
    'crashReports:recordBreadcrumb',
    (_event, args?: { name?: unknown; data?: unknown }) => {
      if (!args || typeof args.name !== 'string') {
        return
      }
      const data = sanitizeRendererBreadcrumbData(args.data)
      recordCrashBreadcrumb(args.name, data)
      recordRendererBreadcrumbTrace(args.name, data)
    }
  )

  ipcMain.removeHandler('crashReports:copyLatestDiagnostics')
  ipcMain.handle(
    'crashReports:copyLatestDiagnostics',
    async (_event, args?: { reportId?: string; notes?: string }) => {
      const report = await getRequestedCrashReport(store, args)
      if (!report) {
        clipboard.writeText(buildUncapturedCrashReportText(args?.notes))
        return { ok: true as const }
      }
      try {
        clipboard.writeText(
          assertClipboardTextWriteWithinLimit(formatCrashReportText(report, args?.notes))
        )
      } catch (error) {
        if (isClipboardTextWriteTooLargeError(error)) {
          return { ok: false as const, error: 'Crash diagnostics are too large to copy safely.' }
        }
        throw error
      }
      return { ok: true as const }
    }
  )

  ipcMain.removeHandler('crashReports:recordRendererError')
  ipcMain.handle('crashReports:recordRendererError', async (_event, args: unknown) => {
    try {
      return await recordRendererErrorReport(store, args)
    } catch (error) {
      console.error('[crash-reporting] Failed to record renderer error report:', error)
      return { ok: false, error: 'Failed to record renderer error report.' }
    }
  })
}
