import { Plug, PanelsTopLeft, Server } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '../../store'
import { UpdateStatusSegment } from './UpdateStatusSegment'
import { shouldOpenStatusBarContextMenu } from './status-bar-context-menu-policy'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { FloatingTerminalIconContextMenu } from '@/components/floating-terminal/FloatingTerminalIconContextMenu'
import { translate } from '@/i18n/i18n'

type StatusBarProps = {
  floatingTerminalOpen: boolean
}

const PetStatusSegment = lazyWithRetry(() =>
  import('./PetStatusSegment').then((module) => ({ default: module.PetStatusSegment }))
)
const PortsStatusSegment = lazyWithRetry(() =>
  import('./PortsStatusSegment').then((module) => ({ default: module.PortsStatusSegment }))
)
const SshStatusSegment = lazyWithRetry(() =>
  import('./SshStatusSegment').then((module) => ({ default: module.SshStatusSegment }))
)

const CLOSE_ALL_CONTEXT_MENUS_EVENT = 'orca-close-all-context-menus'

function StatusBarInner({ floatingTerminalOpen }: StatusBarProps): React.JSX.Element | null {
  const floatingTerminalShortcut = useShortcutLabel('floatingTerminal.toggle')
  const settings = useAppStore((s) => s.settings)
  const statusBarVisible = useAppStore((s) => s.statusBarVisible)
  const statusBarItems = useAppStore((s) => s.statusBarItems)
  const recordFeatureInteraction = useAppStore((s) => s.recordFeatureInteraction)
  const floatingTerminalEnabled = settings?.floatingTerminalEnabled === true
  const floatingTerminalTriggerLocation =
    settings?.floatingTerminalTriggerLocation ?? 'floating-button'
  // Why: pet segment intentionally does NOT participate in statusBarItems
  // (see design doc — gating with both the experimental flag and a
  // statusBarItems checkbox would double-toggle the surface). It is driven
  // purely by the experimentalPet settings flag.
  const petEnabled = useAppStore((s) => s.settings?.experimentalPet === true)
  const toggleStatusBarItem = useAppStore((s) => s.toggleStatusBarItem)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPoint, setMenuPoint] = useState({ x: 0, y: 0 })

  const [containerWidth, setContainerWidth] = useState(900)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    const closeMenu = (): void => setMenuOpen(false)
    window.addEventListener(CLOSE_ALL_CONTEXT_MENUS_EVENT, closeMenu)
    return () => window.removeEventListener(CLOSE_ALL_CONTEXT_MENUS_EVENT, closeMenu)
  }, [])

  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = null
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width)
        }
      })
      observer.observe(node)
      resizeObserverRef.current = observer
      setContainerWidth(node.getBoundingClientRect().width)
    }
  }, [])

  if (!statusBarVisible) {
    return null
  }

  const showSsh = statusBarItems.includes('ssh')
  const showPorts = statusBarItems.includes('ports')
  const showFloatingTerminalToggle =
    floatingTerminalEnabled && floatingTerminalTriggerLocation === 'status-bar'

  const compact = containerWidth < 900
  const iconOnly = containerWidth < 500
  const floatingTerminalActionLabel = floatingTerminalOpen
    ? 'Minimize Floating Workspace'
    : 'Show Floating Workspace'

  return (
    <div
      ref={containerRefCallback}
      className="flex items-center h-6 min-h-[24px] px-3 gap-4 border-t border-border bg-[var(--bg-titlebar,var(--card))] text-xs select-none shrink-0 relative"
      onContextMenuCapture={(event) => {
        if (!shouldOpenStatusBarContextMenu(event.target)) {
          return
        }
        // Why: mirror the right-click pattern used across the app
        // (WorktreeContextMenu, TerminalContextMenu, tab bar) — dispatch the
        // global close event so peer menus dismiss, then place a hidden
        // trigger at the cursor so the menu anchors there.
        event.preventDefault()
        window.dispatchEvent(new Event(CLOSE_ALL_CONTEXT_MENUS_EVENT))
        const bounds = event.currentTarget.getBoundingClientRect()
        setMenuPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
        setMenuOpen(true)
      }}
    >
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <UpdateStatusSegment compact={compact} iconOnly={iconOnly} />
        <React.Suspense fallback={null}>
          {petEnabled ? <PetStatusSegment /> : null}
          {showPorts ? <PortsStatusSegment compact={compact} iconOnly={iconOnly} /> : null}
          {showSsh ? <SshStatusSegment compact={compact} iconOnly={iconOnly} /> : null}
        </React.Suspense>
        {showFloatingTerminalToggle && (
          <FloatingTerminalIconContextMenu currentLocation="status-bar" className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded border border-border bg-secondary text-secondary-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                  aria-label={floatingTerminalActionLabel}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent(TOGGLE_FLOATING_TERMINAL_EVENT))
                  }}
                >
                  <PanelsTopLeft className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {floatingTerminalActionLabel} ({floatingTerminalShortcut})
              </TooltipContent>
            </Tooltip>
          </FloatingTerminalIconContextMenu>
        )}
      </div>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none absolute size-px opacity-0"
            style={{ left: menuPoint.x, top: menuPoint.y }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-0 w-fit" sideOffset={0} align="start">
          <DropdownMenuCheckboxItem
            checked={statusBarItems.includes('ssh')}
            onCheckedChange={() => {
              recordFeatureInteraction('ssh')
              toggleStatusBarItem('ssh')
            }}
          >
            <Server className="size-3.5" />
            {translate('auto.components.status.bar.StatusBar.24ac89df1a', 'Remote Hosts')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={statusBarItems.includes('ports')}
            onCheckedChange={() => {
              recordFeatureInteraction('ports')
              toggleStatusBarItem('ports')
            }}
          >
            <Plug className="size-3.5" />
            {translate('auto.components.status.bar.StatusBar.9659e38343', 'Ports')}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export const StatusBar = React.memo(StatusBarInner)
