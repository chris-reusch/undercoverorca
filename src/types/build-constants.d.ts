// Ambient declarations for compile-time constants substituted by the build
// configs. Privacy-hardened fork: product telemetry is removed, so there is no
// PostHog write key. ORCA_BUILD_IDENTITY remains because the diagnostics lane
// still reads it (it is `null` in contributor / `pnpm dev` / third-party builds).
declare const ORCA_BUILD_IDENTITY: 'stable' | 'rc' | null
