<h1 align="center">
  <a href="https://onOrca.dev"><img src="resources/build/icon.png" alt="Orca" width="64" valign="middle" /></a> Orca
</h1>

<p align="center">
  <strong>The AI Orchestrator for 100x builders.</strong><br/>
  Run Codex, ClaudeCode, OpenCode or Pi side-by-side — each in its own worktree, tracked in one place.
</p>

> [!NOTE]
> **This is a privacy-hardened fork of Orca: no telemetry, no mobile sessions, no third-party reach-out.**
> The product-analytics / telemetry code is *removed* (not merely disabled) — no PostHog client, no event schemas, no install ID, nothing sent to any analytics or diagnostics endpoint. The mobile companion / phone-pairing feature is turned off entirely. The GitHub/Linear integration, Tasks, Automations, the usage/account-switcher widget, and the Hermes agent have been stripped out. It tracks upstream Orca otherwise. See [`docs/disable-telemetry-and-mobile-plan.md`](docs/disable-telemetry-and-mobile-plan.md) for what changed, and [`docs/build-from-source-macos.md`](docs/build-from-source-macos.md) to build and run it.

<p align="center">
  <img src="docs/assets/readme-hero.jpg" alt="Orca desktop app running agents in parallel worktrees" width="960" />
</p>

## Features

<table>
<tr>
<td width="50%" valign="middle">

### Parallel Worktrees

Fan one prompt across five agents, each in its own isolated git worktree — compare the results and merge the winner.

[Docs →](https://www.onorca.dev/docs/model/worktrees)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/model/worktrees"><picture><source srcset="docs/assets/feature-wall/parallel-worktrees.gif" type="image/gif"><img src="docs/assets/feature-wall/parallel-worktrees.jpg" alt="Parallel worktree orchestration" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Terminal Splits

Ghostty-class terminals with WebGL rendering, infinite splits, and scrollback that survives restarts.

[Docs →](https://www.onorca.dev/docs/terminal)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/terminal"><picture><source srcset="docs/assets/feature-wall/terminal-splits.gif" type="image/gif"><img src="docs/assets/feature-wall/terminal-splits.jpg" alt="Terminal splits" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Design Mode

Click any UI element in a real Chromium window to send its HTML, CSS, and a cropped screenshot straight into your agent's prompt.

[Docs →](https://www.onorca.dev/docs/browser/design-mode)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/browser/design-mode"><picture><source srcset="docs/assets/feature-wall/design-mode.gif" type="image/gif"><img src="docs/assets/feature-wall/design-mode.jpg" alt="Embedded browser and Design Mode" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### SSH Worktrees

Run agents on a beefy remote box with full file editing, git, and terminals — auto-reconnect and port forwarding included.

[Docs →](https://www.onorca.dev/docs/ssh)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/ssh"><picture><source srcset="docs/assets/feature-wall/ssh-worktrees.gif" type="image/gif"><img src="docs/assets/feature-wall/ssh-worktrees.jpg" alt="Remote worktrees over SSH" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Annotate AI Diffs

Drop comments on any diff line and ship them back to the agent — review, edit, and commit without leaving Orca.

[Docs →](https://www.onorca.dev/docs/review/annotate-ai-diff)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/review/annotate-ai-diff"><picture><source srcset="docs/assets/feature-wall/annotate-diff.gif" type="image/gif"><img src="docs/assets/feature-wall/annotate-diff.jpg" alt="Annotate AI-generated diffs" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Drag Files to Agents

VS Code's editor with autosave everywhere — drag files or images straight into an agent prompt.

[Docs →](https://www.onorca.dev/docs/editing/file-explorer)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/editing/file-explorer"><picture><source srcset="docs/assets/feature-wall/file-drag.gif" type="image/gif"><img src="docs/assets/feature-wall/file-drag.jpg" alt="Drag files and images into an agent prompt" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Orca CLI

Agents drive Orca too — script every workflow with `orca worktree create`, `snapshot`, `click`, and `fill`.

[Docs →](https://www.onorca.dev/docs/cli/overview)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/cli/overview"><picture><source srcset="docs/assets/feature-wall/orca-cli.gif" type="image/gif"><img src="docs/assets/feature-wall/orca-cli.jpg" alt="Script Orca from the CLI" width="100%" /></picture></a>
</td>
</tr>
</table>

**Also in the box:**

- **[Quick open](https://www.onorca.dev/docs/model/quick-open)** — Search across worktrees, files, agents, commands, and repo context without leaving your flow.
- **[Rich repo previews](https://www.onorca.dev/docs/editing/markdown)** — Preview Markdown, images, PDFs, and repo docs in the workspace.
- **[Computer Use](https://www.onorca.dev/docs/cli/computer-use)** — Let agents operate desktop apps and visible UI when a workflow needs real interaction.
- **[Notifications and unread state](https://www.onorca.dev/docs/notifications)** — Know when an agent finishes or needs attention, then mark threads unread to come back later.

---

## Install

This privacy-hardened fork is not published to the upstream Orca download channels — you build it yourself.

- **[Build from source & run on macOS →](docs/build-from-source-macos.md)** — clone, install, run in dev, and produce a `.dmg`.

### Homebrew (your own tap)

To distribute your built `.dmg` via Homebrew, publish it to a GitHub release and point a cask in your own tap at it. Outline:

```bash
# 1. Build a signed/notarized DMG (see the build-from-source doc), then attach it
#    to a GitHub release on your fork.

# 2. Create a tap repo named homebrew-orca under your GitHub account, e.g.
#    github.com/<you>/homebrew-orca, with Casks/orca.rb:
#
#      cask "orca" do
#        version "1.4.92"
#        sha256 "<shasum -a 256 of your dmg>"
#        url "https://github.com/<you>/undercoverorca/releases/download/v#{version}/orca-macos-arm64.dmg"
#        name "Orca"
#        app "Orca.app"
#      end

# 3. Install from your tap:
brew install --cask <you>/orca/orca
```

See [`docs/build-from-source-macos.md`](docs/build-from-source-macos.md) for the full build and notarization steps.

---

## License

Orca is free and open source under the [MIT License](LICENSE).
