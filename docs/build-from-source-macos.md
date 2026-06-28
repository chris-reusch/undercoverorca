# Build from source & run on macOS

How to clone, build, and run this privacy-hardened Orca fork on a Mac — and how to
verify the privacy changes (no telemetry, no mobile sessions) once it's running.

## Prerequisites

- **macOS** on Apple Silicon or Intel.
- **Xcode Command Line Tools** (for native module compilation):
  ```bash
  xcode-select --install
  ```
- **Node.js 24** (the repo pins `engines.node` to 24). Install via your version
  manager of choice, e.g.:
  ```bash
  # with nvm
  nvm install 24 && nvm use 24
  # or with Homebrew
  brew install node@24
  ```
- **pnpm 10.24** — the repo declares `packageManager: pnpm@10.24.0`. The easiest way
  to get the exact version is Corepack (bundled with Node):
  ```bash
  corepack enable
  corepack prepare pnpm@10.24.0 --activate
  pnpm --version   # should print 10.24.0
  ```

## 1. Clone

```bash
git clone https://github.com/chris-reusch/undercoverorca.git
cd undercoverorca
git checkout privacy-hardened-no-telemetry-no-mobile
```

## 2. Install dependencies

```bash
pnpm install
```

This also runs the `postinstall` step that rebuilds native modules against Electron.
If native rebuilds fail, confirm the Command Line Tools are installed and that you're
on Node 24, then re-run `pnpm install`.

## 3. Run in development

```bash
pnpm dev
```

This launches the Electron app with hot reload. Use this while iterating — it's the
fastest way to see changes and to verify behavior.

## 4. Build a distributable `.dmg`

```bash
pnpm build:mac
```

The packaged app and installer land in the `dist/` directory (e.g.
`dist/Orca-<version>-arm64.dmg`). `build:mac` produces an **unsigned** local build.

### Signing & notarization (optional, for distribution)

A distributable that opens without Gatekeeper warnings must be signed with a Developer
ID certificate and notarized. The repo wires this through
`config/electron-builder.config.cjs` and `pnpm build:mac:release`, which calls
`config/scripts/verify-macos-release-env.mjs` to check the required env vars
(Apple ID / Developer ID credentials). For a personal local build you can skip this and
run the unsigned `pnpm build:mac`; macOS will require a right-click → Open the first time.

## 5. Verify the privacy changes

Once the app is running (`pnpm dev` or the built app):

**No telemetry**
- There is no PostHog client and no telemetry module in the build. Confirm there's no
  telemetry consent prompt on first launch, and no "Share anonymous usage data" toggle
  in Settings → Privacy.
- With a network monitor (e.g. Little Snitch, or `lsof`/proxy), confirm there are no
  outbound requests to analytics/diagnostics hosts while you use the app.

**No mobile sessions**
- The mobile WebSocket relay never binds. Confirm no mobile-pairing port is listening:
  ```bash
  lsof -iTCP -sTCP:LISTEN -n -P | grep -i orca
  ```
  You should not see the mobile relay socket. The local Unix-socket CLI transport is
  unaffected, so `orca` CLI commands still work.
- The Mobile button is hidden from the sidebar, and no QR/pairing UI is reachable.

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the app in development with hot reload |
| `pnpm start` | Preview a production build locally |
| `pnpm build:mac` | Build an unsigned macOS `.dmg` in `dist/` |
| `pnpm typecheck` | Type-check all projects |
| `pnpm test` | Run the test suite |
| `pnpm lint` | Lint + project verification checks |

## Troubleshooting

- **Native module errors at launch:** re-run `pnpm install` on Node 24 so `postinstall`
  rebuilds against the bundled Electron runtime.
- **Wrong pnpm version:** `corepack prepare pnpm@10.24.0 --activate`.
- **App won't open after `build:mac`:** it's unsigned — right-click the app → Open, or
  build with `pnpm build:mac:release` once signing env vars are set.
