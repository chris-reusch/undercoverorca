// Ambient declarations for compile-time constants substituted by the build
// configs. Privacy-hardened fork: product telemetry is removed, so there is no
// PostHog write key. ORCA_BUILD_IDENTITY remains because the diagnostics lane
// still reads it (it is `null` in contributor / `pnpm dev` / third-party builds).
declare const ORCA_BUILD_IDENTITY: 'stable' | 'rc' | null

// Diagnostic-bundle upload endpoint for Mode 3 (telemetry-error-tracking.md
// §Endpoint contract). Substituted by CI; `null` in contributor builds, at
// which point the upload IPC handler returns "endpoint not configured"
// rather than POSTing to a placeholder. The dev escape hatch is the
// `ORCA_DIAGNOSTICS_TOKEN_URL` env var, which env wins so a developer can
// point a packaged build at a staging server without re-running the
// release pipeline.
declare const ORCA_DIAGNOSTICS_TOKEN_URL: string | null
