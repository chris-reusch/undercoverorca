# Handoff — privacy-hardened Orca fork

Branch: `privacy-hardened-no-telemetry-no-mobile` (pushed to `origin` =
`github.com/chris-reusch/undercoverorca`). Upstream is `stablyai/orca` (added as
remote `upstream`). The branch was rebased onto `upstream/main` at the start, so it
contains all upstream history up to that point plus the fork changes.

**Current state: `pnpm typecheck` is genuinely green (node/web/cli all 0). The app
builds and runs.** Head commit: `fix: reconcile latent typecheck errors masked by
stale tsgo cache`.

## ⚠️ Critical gotchas (read first)

1. **The tsgo incremental cache LIES.** `*.tsbuildinfo` files cache stale results and
   reported "0 errors" while real errors existed during big deletions. ALWAYS run this
   before trusting a typecheck:
   ```
   find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
   ```
   Do it before EVERY verification pass during large refactors.
2. **Toolchain in this environment:** `pnpm` is not on PATH by default. Use:
   ```
   export PATH="/Users/chris/.hermes/node/bin:$PATH"
   ```
   Node here is v22 (repo wants 24 — engine warning is harmless for typecheck).
3. **Deps were installed with `--ignore-scripts`**, so native `node-pty` was NOT built.
   PTY/daemon tests fail with `posix_spawnp failed` IN THIS SANDBOX ONLY — they pass on
   a real machine after a normal `pnpm install` on Node 24. Don't "fix" those tests.
4. **Verify gate used so far = typecheck (all 3) green.** Full `pnpm test` has sandbox-only
   PTY failures; on a real machine run the full suite to confirm.

## ✅ Done & committed (each commit verified typecheck-green)

- **Telemetry: fully removed** (PostHog lane). Deleted `src/main/telemetry/`, shared
  `*-telemetry*` schemas, renderer track() call sites, preload bridge, settings/persistence,
  `posthog-node` dep, the CI verify step. Non-telemetry types that lived in `telemetry-events`
  were rehomed to `src/shared/agent-launch-source.ts` and `terminal-pane-split-source.ts`.
  The separate observability/diagnostics lane was left intact (no PostHog).
- **Mobile sessions: off.** `enableWebSocket: false` in `src/main/index.ts` (relay never
  binds, no device registry/pairing) + `showMobileButton: false`.
- **Usage / rate-limit tracking: removed** (`src/main/rate-limits/`, the bottom status-bar
  usage widget, stats pages). Account auth/login kept.
- **Tasks feature: removed** (TaskPage, task-providers, Jira *connect dialog* deferred — see
  below).
- **Automations feature: removed** (`src/main/automations/`, renderer `components/automations/`,
  the page-view nav-history mechanism, `hideAutomationGeneratedWorkspaces` filter,
  `automationProvenance` metadata).
- **Hermes agent: removed** as a supported agent kind (catalog/config/enum/hooks/AI-vault).
- **`Cmd/Ctrl+Shift+[` / `]`** now cycles across ALL tab types (terminal ↔ markdown), not just
  same-type (swapped with the Alt variant in `src/shared/keybindings.ts`).
- **11 upstream fixes cherry-picked** (terminal/editor/CLI/Windows bug fixes + Copy Context).
  Mobile, GitHub-CI-check, and README/release upstream commits were intentionally skipped.
- **README rewritten** for the fork (removed badges/social, Supported Agents, Community,
  Developing, old Homebrew block, usage/mobile/GitHub-Linear marketing). Added a privacy
  NOTE + Homebrew-tap outline.
- **Docs:** `docs/disable-telemetry-and-mobile-plan.md`, `docs/build-from-source-macos.md`.
- **Create-PR keystone:** extracted `createGitHubPullRequest` (the `gh pr create` shell-out)
  into `src/main/github/create-pr.ts`, decoupled from the GitHub GraphQL fetchers — so the
  fetch code can be deleted without breaking create-PR.

## ✅ DONE since this handoff

### 1. Provider-API removal (was the main remaining task) — COMPLETE
Removed in-app provider DATA FETCHING + UI across all providers, one vertical slice
per commit (each typecheck-green: node/cli/web = 0), keeping local git, branch push,
and create-PR via `gh pr create`. ~130k lines removed across 4 commits:
- `feat: remove the Jira integration` (Jira was deferred from the Tasks pass).
- `feat: remove the Linear integration` (main client/ipc/rpc/ssh-cli + `orca linear`
  CLI + the agent-skill setup + store/components/shared + skills).
- `feat: remove GitLab + Azure DevOps/Gitea/Bitbucket providers` (collapsed
  forge-provider + hosted-review-creation to GitHub-only; preflight is now git + gh).
- `feat: prune GitHub to gh-CLI-only` (removed PR/issue/check/work-item/project
  fetching, ChecksPanel, PullRequestPage, GitHubItemDialog; pruned SourceControl.tsx
  to local-git + create-PR; kept getRepoSlug/getRepoUpstream/getPullRequestPushTarget/
  checkOrcaStarred/starOrca/diagnoseAuth + the full create-PR path).

`TaskProvider` is now `'github'` only. `getHostedReviewCreationEligibility` no longer
pre-checks for an existing PR (gh pr create rejects duplicates).

**Inert leftovers intentionally kept** (github-only, harmless, swept later if desired):
the worktree `linkedLinearIssue`/`linkedGitLabMR`/etc. metadata fields (still woven
through worktree schemas/persistence), and the github-only task-provider /
integrations-settings / feature-wall scaffolding (still used by the kept
setup-guide / onboarding / AgentSkill / orchestration surfaces).

**Pre-existing test gaps (NOT from this work, confirmed failing on the base commit):**
`persistence.test.ts` has 5 failures — feature-discovery, default-profiles, two
compact-preset-migration cases (reference the already-removed Automations feature),
and a ~6s "very large split layout" timeout.

## ⬜ What's left

### 2. iCloud permission prompts
macOS TCC fires when Orca reads Documents/Downloads/iCloud. Causes: the Info.plist declares
`NSDocumentsFolderUsageDescription`/`NSDownloadsFolderUsageDescription`
(`config/electron-builder.config.cjs`), and directory-walking features
(`workspace-space-analysis.ts` disk-usage scan, `terminal-history.ts`) touch protected dirs.
To pinpoint the exact scan, run on the Mac while reproducing:
`log stream --predicate 'subsystem == "com.apple.TCC"' --info`. Then gate that scan to only
walk the user's worktrees (and consider dropping the Documents/Downloads usage strings —
but `NSDownloadsFolderUsageDescription` may be needed by the in-app browser's downloads).

### 3. App logo → "orca with a spyglass"
`resources/build/icon.png` / `icon.icns` are bitmaps. Needs a real image asset (can't be
generated here). Option: hand-author an SVG mark + a rasterize script (`sips`/`rsvg-convert`)
to produce the icon set.

### 4. Final full test suite on a real machine
After a normal `pnpm install` on Node 24, run `pnpm test` to confirm (the PTY tests that
fail in the sandbox should pass there).

## How to continue
```
export PATH="<your pnpm>:$PATH"     # or use corepack on Node 24
pnpm install                        # rebuilds native node-pty on Node 24
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm run typecheck                  # expect 0
pnpm dev                            # run the app
```
