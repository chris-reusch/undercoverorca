import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useAppStore } from '@/store'
import {
  getContextualTour,
  type ContextualTourStepAction
} from '../../../../shared/contextual-tours'
import { isContextualTourAllowedForModal } from './contextual-tour-gate'
import { measureContextualTourOverlayRenderState } from './contextual-tour-overlay-measurement'
import {
  ContextualTourOverlaySurface,
  getContextualTourFocusableElements,
  handleContextualTourOverlayKeyDown,
  type ActiveTourRenderState
} from './ContextualTourOverlaySurface'
import { requestActiveTerminalPaneSplit } from '@/components/tab-bar/request-active-terminal-pane-split'
import { performContextualTourStepAction } from './contextual-tour-step-actions'
import { openWorkspaceCreationComposerWithTourHandoff } from './workspace-creation-tour-handoff'

export function ContextualTourOverlay(): JSX.Element | null {
  const activeTourId = useAppStore((s) => s.activeContextualTourId)
  const activeStepIndex = useAppStore((s) => s.activeContextualTourStepIndex)
  const activeTourSource = useAppStore((s) => s.activeContextualTourSource)
  const activeModal = useAppStore((s) => s.activeModal)
  const onboardingVisible = useAppStore((s) => s.contextualToursOnboardingVisible)
  const blockingSurfaceVisible = useAppStore((s) => s.contextualToursBlockingSurfaceVisible)
  const activeTourSuppressed = useAppStore((s) => s.activeContextualTourSuppressed)
  const keybindings = useAppStore((s) => s.keybindings)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const canCreateWorkspace = useAppStore((s) => s.repos.length > 0)
  const markContextualToursSeen = useAppStore((s) => s.markContextualToursSeen)
  const advanceContextualTour = useAppStore((s) => s.advanceContextualTour)
  const regressContextualTour = useAppStore((s) => s.regressContextualTour)
  const dismissContextualTour = useAppStore((s) => s.dismissContextualTour)
  const completeContextualTour = useAppStore((s) => s.completeContextualTour)
  const cancelContextualTour = useAppStore((s) => s.cancelContextualTour)
  const detachContextualTourSource = useAppStore((s) => s.detachContextualTourSource)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const openModal = useAppStore((s) => s.openModal)
  const [renderState, setRenderState] = useState<ActiveTourRenderState | null>(null)
  const [measureVersion, setMeasureVersion] = useState(0)
  const panelRef = useRef<HTMLElement | null>(null)
  const markedTourIdRef = useRef<string | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const focusedStepRef = useRef<string | null>(null)

  const activeTour = useMemo(
    () => (activeTourId ? getContextualTour(activeTourId) : null),
    [activeTourId]
  )

  useLayoutEffect(() => {
    if (!activeTourId) {
      setRenderState(null)
      return
    }
    // Why: reset before the measurement layout effect below, otherwise the
    // first passive effect can hide a freshly measured tour until the next tick.
    markedTourIdRef.current = null
    setRenderState(null)
  }, [activeTour?.steps.length, activeTourId])

  useEffect(() => {
    if (!activeTour || !activeTourId) {
      return
    }
    if (
      onboardingVisible ||
      blockingSurfaceVisible ||
      activeTourSuppressed ||
      !isContextualTourAllowedForModal(activeTour, activeModal)
    ) {
      cancelContextualTour(activeTourId)
    }
  }, [
    activeModal,
    activeTourSuppressed,
    activeTour,
    activeTourId,
    blockingSurfaceVisible,
    cancelContextualTour,
    onboardingVisible
  ])

  useEffect(() => {
    if (!activeTourId) {
      return
    }
    const scheduleMeasure = (): void => setMeasureVersion((version) => version + 1)
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)
    const interval = window.setInterval(scheduleMeasure, 500)
    return () => {
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
      window.clearInterval(interval)
    }
  }, [activeTourId])

  useLayoutEffect(() => {
    if (!activeTour || activeTourId === null) {
      setRenderState(null)
      return
    }

    const measurement = measureContextualTourOverlayRenderState({
      tour: activeTour,
      activeStepIndex,
      sidebarOpen,
      keybindings
    })

    if (measurement.kind === 'advance') {
      advanceContextualTour()
      return
    }
    if (measurement.kind === 'wait') {
      return
    }
    if (measurement.kind === 'cancel') {
      cancelContextualTour(activeTourId)
      return
    }

    setRenderState(measurement.renderState)
  }, [
    activeStepIndex,
    activeTour,
    activeTourId,
    advanceContextualTour,
    cancelContextualTour,
    keybindings,
    measureVersion,
    sidebarOpen
  ])

  useEffect(() => {
    if (!activeTourId || !renderState || markedTourIdRef.current === activeTourId) {
      return
    }
    // Why: a tour is considered seen only after its first measured target
    // paints, so missing or removed surfaces can retry on a later visit.
    markedTourIdRef.current = activeTourId
    markContextualToursSeen([activeTourId])
  }, [activeTourId, markContextualToursSeen, renderState])

  useEffect(() => {
    if (!activeTourId || !renderState) {
      return
    }
    const focusKey = `${activeTourId}:${activeStepIndex}`
    if (focusedStepRef.current === focusKey) {
      return
    }
    focusedStepRef.current = focusKey

    const currentFocus = document.activeElement
    if (
      !previousFocusRef.current &&
      currentFocus instanceof HTMLElement &&
      !panelRef.current?.contains(currentFocus)
    ) {
      previousFocusRef.current = currentFocus
    }

    const timeout = window.setTimeout(() => {
      const panel = panelRef.current
      const firstFocusable = panel ? getContextualTourFocusableElements(panel)[0] : null
      ;(firstFocusable ?? panel)?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activeStepIndex, activeTourId, renderState])

  useEffect(() => {
    if (activeTourId) {
      return
    }
    focusedStepRef.current = null
    const previousFocus = previousFocusRef.current
    previousFocusRef.current = null
    if (previousFocus?.isConnected) {
      previousFocus.focus({ preventScroll: true })
    }
  }, [activeTourId])

  if (!activeTourId || !renderState) {
    return null
  }

  const finishTour = (): void => {
    completeContextualTour(activeTourId)
  }

  const handleStepAction = (action: ContextualTourStepAction): void => {
    performContextualTourStepAction({
      action,
      activeTabId,
      isLastStep: renderState.isLastStep,
      finishTour,
      advanceContextualTour,
      detachContextualTourSource: () => {
        if (activeTourSource) {
          detachContextualTourSource(activeTourId, activeTourSource)
        }
      },
      setSidebarOpen,
      openModal,
      canCreateWorkspace,
      openWorkspaceComposer: openWorkspaceCreationComposerWithTourHandoff,
      dispatchTerminalPaneSplit: requestActiveTerminalPaneSplit,
      schedule: (callback) => {
        window.setTimeout(callback, 0)
      }
    })
  }

  return (
    <ContextualTourOverlaySurface
      activeTourId={activeTourId}
      renderState={renderState}
      panelRef={panelRef}
      panelHost={renderState.panelHost}
      onSkip={(id) => {
        dismissContextualTour(id)
      }}
      onBack={regressContextualTour}
      onNext={() => {
        if (renderState.isLastStep) {
          finishTour()
        } else {
          advanceContextualTour()
        }
      }}
      onStepAction={handleStepAction}
      onOverlayKeyDownCapture={handleContextualTourOverlayKeyDown}
    />
  )
}
