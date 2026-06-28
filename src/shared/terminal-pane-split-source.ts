// Where a terminal-pane split was initiated from. Used as plain data when
// creating splits; extracted here when the telemetry module that originally
// declared it was removed in the privacy-hardened fork.
export const TERMINAL_PANE_SPLIT_SOURCES = [
  'contextual_tour',
  'keyboard',
  'context_menu',
  'command',
  'unknown'
] as const

export type TerminalPaneSplitSource = (typeof TERMINAL_PANE_SPLIT_SOURCES)[number]
