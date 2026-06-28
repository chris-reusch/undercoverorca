// Local star-nag prompt types. The star-nag feature (prompting users to star
// the repo on GitHub) is not analytics, so it keeps its own source/mode
// discriminators instead of importing them from a telemetry module.

export const STAR_NAG_PROMPT_SOURCES = [
  'threshold',
  'force_show',
  'agent_value_moment',
  'onboarding_completed',
  'update_flow',
  'settings',
  'legacy_threshold'
] as const
export type StarNagPromptSource = (typeof STAR_NAG_PROMPT_SOURCES)[number]

export const STAR_NAG_PROMPT_MODES = ['gh', 'web'] as const
export type StarNagPromptMode = (typeof STAR_NAG_PROMPT_MODES)[number]

// Why: tracks per-prompt behavioral state (web handoff, in-flight direct-star
// attempt) so a later user action resolves against the prompt that was shown.
export type StarNagPromptSession = {
  source: StarNagPromptSource
  mode: StarNagPromptMode
  openedRepoTracked?: boolean
  starAttemptPromise?: Promise<boolean>
}
