import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import type { Store } from '../persistence'
import type { GlobalSettings, PersistedState } from '../../shared/types'
import { listSystemFontFamilies } from '../system-fonts'
import { previewGhosttyImport } from '../ghostty/index'
import { previewWarpThemeImport } from '../warp-themes'
import { setMainUiLanguage } from '../i18n/main-i18n'
import { rebuildAppMenu } from '../menu/register-app-menu'
import type { AgentAwakeService } from '../agent-awake-service'
import { sanitizeFloatingWorkspaceDirectorySetting } from './floating-workspace-directory'
import { applyAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { applyElectronProxySettings } from '../network/proxy-settings'
import { normalizeProxyBypassRules, normalizeProxyUrl } from '../../shared/network-proxy'
import { normalizeAppIconId } from '../../shared/app-icon'
import { normalizeUiLanguage } from '../../shared/ui-language'
import { applyAppIcon } from '../app-icon'
import { normalizeTerminalCustomThemes } from '../../shared/terminal-custom-themes'
import { prepareLocalWorktreeRootsForRepos } from '../worktree-root-preparation'

// Why: fields that appear in the View > Appearance submenu need the menu
// rebuilt after any update so the checkbox `checked` state stays in sync
// with the persisted value. Electron doesn't reactively re-render menu
// items when the backing state changes.
const APPEARANCE_MENU_KEYS: readonly (keyof GlobalSettings)[] = [
  'showMobileButton',
  'showTitlebarAppName'
]

export function registerSettingsHandlers(
  store: Store,
  agentAwakeService?: AgentAwakeService
): void {
  store.onSettingsChanged((updates, _settings, originWebContentsId) => {
    for (const window of BrowserWindow.getAllWindows()) {
      const isOrigin =
        originWebContentsId !== undefined && window.webContents.id === originWebContentsId
      if (!window.isDestroyed() && !isOrigin) {
        window.webContents.send('settings:changed', updates)
      }
    }
  })

  ipcMain.handle('settings:get', () => {
    return store.getSettings()
  })

  ipcMain.handle('settings:set', async (event, args: Partial<GlobalSettings>) => {
    const sanitizedArgs = { ...args }
    // Why: Floating Workspace grants are trusted only when written by the
    // main-process directory picker, never by renderer-provided settings IPC.
    delete sanitizedArgs.floatingTerminalTrustedCwds
    if (typeof args.floatingTerminalCwd === 'string') {
      sanitizedArgs.floatingTerminalCwd = await sanitizeFloatingWorkspaceDirectorySetting(
        store,
        args.floatingTerminalCwd
      )
    }
    if ('httpProxyUrl' in args) {
      const proxyUrl = normalizeProxyUrl(args.httpProxyUrl)
      sanitizedArgs.httpProxyUrl = proxyUrl.ok ? proxyUrl.value : ''
    }
    if ('httpProxyBypassRules' in args) {
      sanitizedArgs.httpProxyBypassRules = normalizeProxyBypassRules(args.httpProxyBypassRules)
    }
    if ('appIcon' in args) {
      sanitizedArgs.appIcon = normalizeAppIconId(args.appIcon)
    }
    if ('terminalCustomThemes' in args) {
      sanitizedArgs.terminalCustomThemes = normalizeTerminalCustomThemes(args.terminalCustomThemes)
    }
    if ('uiLanguage' in args) {
      sanitizedArgs.uiLanguage = normalizeUiLanguage(args.uiLanguage)
    }
    if (args.theme) {
      nativeTheme.themeSource = args.theme
    }
    // Why: capture the pre-update value so we only emit when the value
    // actually changes. The settings UI sometimes re-saves the same value
    // (e.g. blur after a no-op edit), and a `settings_changed` event for a
    // no-op flip would inflate the experimental-feature-adoption signal.
    const before = store.getSettings()
    const result = store.updateSettings(sanitizedArgs, {
      notifyListeners: true,
      originWebContentsId: event.sender.id
    })
    if ('keepComputerAwakeWhileAgentsRun' in sanitizedArgs) {
      agentAwakeService?.setEnabled(result.keepComputerAwakeWhileAgentsRun)
    }
    if (
      'agentStatusHooksEnabled' in sanitizedArgs &&
      before.agentStatusHooksEnabled !== result.agentStatusHooksEnabled
    ) {
      try {
        applyAgentStatusHooksEnabled(result.agentStatusHooksEnabled)
      } catch (error) {
        console.warn('[settings] failed to apply agentStatusHooksEnabled:', error)
      }
    }
    if ('uiLanguage' in sanitizedArgs && before.uiLanguage !== result.uiLanguage) {
      await setMainUiLanguage(result.uiLanguage)
      rebuildAppMenu()
    }
    if (
      ('workspaceDir' in sanitizedArgs && before.workspaceDir !== result.workspaceDir) ||
      ('nestWorkspaces' in sanitizedArgs && before.nestWorkspaces !== result.nestWorkspaces)
    ) {
      void prepareLocalWorktreeRootsForRepos(store)
    }
    if (APPEARANCE_MENU_KEYS.some((key) => key in sanitizedArgs)) {
      rebuildAppMenu()
    }
    if ('httpProxyUrl' in sanitizedArgs || 'httpProxyBypassRules' in sanitizedArgs) {
      try {
        await applyElectronProxySettings(result)
      } catch {
        console.warn('[settings] failed to apply network proxy settings')
      }
    }
    if ('appIcon' in sanitizedArgs && before.appIcon !== result.appIcon) {
      applyAppIcon(result.appIcon)
    }

    return result
  })

  ipcMain.handle('settings:listFonts', () => {
    return listSystemFontFamilies()
  })

  ipcMain.handle('settings:previewGhosttyImport', () => {
    return previewGhosttyImport(store)
  })

  ipcMain.handle('settings:previewWarpThemeImport', (event, args?: unknown) => {
    const source = args === undefined ? { kind: 'auto' } : args
    return previewWarpThemeImport(store, source, event.sender)
  })

  ipcMain.handle('cache:getGitHub', () => {
    return store.getGitHubCache()
  })

  ipcMain.handle('cache:setGitHub', (_event, args: { cache: PersistedState['githubCache'] }) => {
    store.setGitHubCache(args.cache)
  })
}
