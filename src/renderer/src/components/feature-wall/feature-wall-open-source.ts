// Why: the shared telemetry-events module was removed in the privacy fork, but
// this open-source label still drives non-telemetry behavior (default workflow,
// doc-link routing), so the literal union lives here instead.
export type FeatureWallOpenSourceTelemetry = 'help_menu' | 'popup' | 'onboarding' | 'unknown'
