# Plan: No Telemetry + All Mobile Sessions Off

This document describes how this fork turns Orca into a privacy-hardened build:
**no telemetry of any kind, and the entire mobile companion / phone-pairing
feature disabled.** It records the chokepoints, the exact edits, and the
verification steps so the change is auditable and easy to re-apply after merges
from upstream.

## Goals

1. **Zero telemetry egress.** No product analytics (PostHog), no error/observability
   uploads, no crash-report or diagnostic-bundle uploads. No anonymous IDs created
   or transmitted.
2. **Mobile sessions fully off.** The desktop must never bind the mobile WebSocket
   relay, never create the device registry / E2EE keypair, and never offer pairing.
   The UI entry points should be gone so the feature isn't advertised.
3. **Minimal, central, re-appliable.** Prefer flipping the few intended kill-switches
   over editing the ~120 leaf call sites, so upstream merges stay clean.

## Non-goals

- Removing the **mobile *emulator*** dev tool (`mobileEmulatorEnabled`,
  `MobileEmulator*`) — that's an in-app device emulator, not a companion session.
- Touching `src/relay/` or `src/main/ssh/ssh-relay-*` — despite the name these are
  the SSH/remote-agent execution backend, not the mobile relay.

---

## Part 1 — Telemetry

There are three independent lanes. The observability lane forbids importing to/from
the telemetry lane, so they're handled separately.

### Lane 1 — Product telemetry (PostHog) — *fully removed*

Per the fork's intent, the product-analytics code is **deleted, not disabled** — no
PostHog client, no event schemas, no install ID, no consent machinery. Because ~120
call sites import a renderer-side `track()` helper, the strategy is:

1. **Keep one tiny seam, drop everything behind it.** Replace
   `src/renderer/src/lib/telemetry.ts` and the main-side entry points with a no-op
   surface *only as a migration aid*, then sweep call sites and delete the seam — OR
   sweep call sites first. Either way the end state has **no** telemetry module.
2. **Delete the main-side telemetry lane:** the entire `src/main/telemetry/` directory
   (`client.ts`, `consent.ts`, `install-id.ts`, `burst-cap.ts`, `validator.ts`,
   `cohort-classifier.ts`, `onboarding-cohort-classifier.ts`, `classify-error.ts`,
   plus tests) and `src/main/ipc/telemetry.ts` (+ its registration in
   `register-core-handlers.ts`).
3. **Delete the shared schemas/helpers:** `src/shared/telemetry-events.ts`,
   `telemetry-consent-types.ts`, `telemetry-common-props.*`, and every
   `src/shared/*-telemetry*.ts` / `src/renderer/.../*-telemetry*.ts` per-feature module
   (feature-education, feature-wall, nested-repo, setup-script, star-nag, onboarding-tour,
   add-repo-existing-workspaces, feature-tip, etc.).
4. **Remove the renderer call sites** (~50 importer files): delete each `track(...)`
   call and its import; delete telemetry-only hooks/observers
   (`use-setup-guide-telemetry.ts`, `SetupGuideTelemetryObserver.tsx`,
   `use-feature-wall-tour-telemetry.ts`, …).
5. **Remove the preload bridge** telemetry entries in `src/preload/index.ts` and
   `src/preload/api-types.ts`.
6. **Remove lifecycle wiring** in `src/main/index.ts`: `initTelemetry`,
   `trackAppOpenedOnce`, `shutdownTelemetry`.
7. **Remove persistence + types:** the `telemetry.*` settings (installId, optedIn,
   existedBeforeTelemetryRelease) in `src/main/persistence.ts` and `src/shared/types.ts`.
8. **Remove build-time injection** in `electron.vite.config.ts`
   (`ORCA_BUILD_IDENTITY`, `ORCA_POSTHOG_WRITE_KEY` defines) and delete
   `config/scripts/verify-telemetry-constants.mjs` (and its lint hookup).
9. **Drop the dependency:** remove `posthog-node` from `package.json`, re-run
   `pnpm install` to update the lockfile.

> Sequencing note: because removal touches ~80 files, do it as
> *delete-modules → fix-the-resulting-type-errors* in waves, running `pnpm typecheck`
> between waves so the compiler enumerates every remaining reference for us.

### Lane 2 — Error-tracking / observability — `src/main/observability/`

- **Edit `src/main/index.ts`:** remove (or guard) the `initObservability()` call
  (~line 1307) and the matching `shutdownObservability()` (~line 1797). With the
  sink never initialized, every `withSpan`/`startSpan` becomes a no-op automatically.
  Alternatively make `initObservability()` itself an early-return no-op so the
  call sites can stay.

### Lane 3 — Crash reporting + diagnostic-bundle upload

This lane is mostly local-only and user-initiated, but to guarantee no remote egress:

- **`src/main/observability/diagnostic-bundle-upload.ts`** (+ `diagnostic-upload-endpoint.ts`,
  `diagnostic-upload-http.ts`): no-op the upload path.
- **`src/main/ipc/diagnostics.ts`:** make `diagnostics:uploadBundle` a no-op / reject,
  so the renderer can't trigger an upload.
- **`src/main/index.ts`:** optionally drop the `child-process-gone` handler (~line 1517)
  and `recordCrashBreadcrumb` (~line 1548) if we want no local crash capture at all.

### Settings UI cleanup (telemetry)

With the telemetry module gone, the opt-in surfaces must be removed (they'd otherwise
reference deleted code):

- `src/renderer/src/components/settings/PrivacyPane.tsx` — drop the "Share anonymous
  usage data" switch; leave a static "This build collects no telemetry" line.
- `src/renderer/src/components/TelemetryFirstLaunchSurface.tsx` /
  `FirstLaunchBanner.tsx` — delete the first-launch opt-in prompt.
- `src/renderer/src/components/settings/PrivacyDiagnosticsSection.tsx` /
  `PrivacyDiagnosticBundleControls.tsx` — remove the diagnostic upload controls.
- `privacy-search.ts` and the i18n locale strings that mention PostHog/telemetry.

### Env-var note

Upstream honored `DO_NOT_TRACK`, `ORCA_TELEMETRY_DISABLED`, `ORCA_DIAGNOSTICS_DISABLED`
as runtime kill-switches. With telemetry removed they're moot for analytics; the
diagnostics one still gates the (local) observability/crash lanes below.

---

## Part 2 — Mobile sessions

The entire mobile companion surface hangs off one hardcoded flag.

### The single global off-switch

- **Edit `src/main/index.ts` (~line 1627–1636):** the only production construction of
  `new OrcaRuntimeRpcServer({ ... enableWebSocket: true ... })`. Set
  `enableWebSocket: false`.
  - In `src/main/runtime/runtime-rpc.ts` the block `if (this.enableWebSocket) { ... }`
    (~line 669) is the *only* place the `WebSocketTransport`, `DeviceRegistry`,
    `E2EEKeypair`, and E2EE channels are created. With the flag off, the WS server
    never binds, no device registry/keypair is created, and no pairing offers exist.
    The Unix-socket local CLI transport is unaffected.
  - The default param is already `false` — index.ts is the only opt-in.
- **Skip `registerMobileHandlers(runtimeRpc)`** (~line 1636) so the `mobile:*` IPC
  handlers (`getPairingQR`, `getRuntimePairingUrl`, `listDevices`, `revokeDevice`,
  `isWebSocketReady`, …) aren't registered.

### Wire it to a real setting (recommended)

A flag named `experimentalMobile` already exists
(`src/shared/constants.ts`, `src/shared/types.ts`, default `false`) but is **not wired
to anything**. Wire it into the `enableWebSocket` gate so the off state is the real
default and the behavior is discoverable/auditable:

```ts
enableWebSocket: settings.experimentalMobile === true, // off by default in this fork
```

For this fork we keep it `false` and do not expose a UI toggle, so mobile stays off.

### Hide the UI entry points

- `showMobileButton` (`src/shared/constants.ts`, default `true`) → default `false`,
  which hides the Mobile sidebar button (`SidebarNav.tsx`, `AppearancePane.tsx`,
  `register-app-menu.ts`, propagated in `index.ts`).
- Hide / remove the Mobile page and settings panes so they aren't dead ends:
  `src/renderer/src/components/mobile/*`,
  `src/renderer/src/components/settings/Mobile*Section.tsx`, `MobilePane.tsx`,
  `RuntimePairingUrlGenerator.tsx`.
- The web/phone companion clients (`src/renderer/src/web/web-pairing.ts`,
  `web-runtime-session.ts`, `src/shared/remote-runtime-client.ts`) become unreachable
  once the server is off; no required change, but they can be left as-is.

---

## Order of operations

1. Telemetry Lane 1 (`TELEMETRY_ENABLED = false`, `resolveConsent` hard-off) +
   verify-script update.
2. Telemetry Lanes 2 & 3 (observability init, diagnostic upload).
3. Mobile off-switch (`enableWebSocket: false`, skip `registerMobileHandlers`).
4. UI cleanup for both (privacy panes, mobile button/pages).
5. Optional: remove `posthog-node` dep + `pnpm install`.

## Verification

- **Build/lint/types:** `pnpm lint && pnpm typecheck && pnpm test`. Note the
  telemetry verify script runs inside `pnpm lint`.
- **Static egress audit:** grep that no PostHog client is constructed and no
  diagnostic upload endpoint is reachable at runtime; confirm `track()` early-returns.
- **Runtime — telemetry:** launch the app and confirm no outbound requests to the
  PostHog/diagnostics hosts (devtools network / a local proxy), and that the
  Privacy settings show the disabled state.
- **Runtime — mobile:** confirm no WebSocket relay port is listening
  (`lsof -iTCP -sTCP:LISTEN` should show no mobile WS bind), `mobile:isWebSocketReady`
  is unavailable, the Mobile sidebar button is gone, and no QR/pairing UI renders.
- **Cross-platform:** keep all checks behind runtime/platform-safe code; verify on
  macOS, Linux, and Windows per the repo's cross-platform requirement.

## Re-applying after upstream merges

The fragile spots after a merge are: `TELEMETRY_ENABLED` (may be reset to `true`),
the `enableWebSocket: true` literal in `index.ts`, and the
`verify-telemetry-constants.mjs` expectation. Re-check those three first, then the
observability/diagnostics call sites in `index.ts`.
