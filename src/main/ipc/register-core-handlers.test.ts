/* eslint-disable max-lines -- Why: this test mirrors the complete core IPC handler registry so
   duplicate-registration coverage stays tied to the one production entry point. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  registerCliHandlersMock,
  registerPreflightHandlersMock,
  registerGitHubHandlersMock,
  registerFeedbackHandlersMock,
  registerStatsHandlersMock,
  registerMemoryHandlersMock,
  registerNotebookHandlersMock,
  registerNotificationHandlersMock,
  registerDeveloperPermissionHandlersMock,
  registerComputerUsePermissionHandlersMock,
  registerSettingsHandlersMock,
  registerKeybindingHandlersMock,
  registerDiagnosticsHandlersMock,
  registerShellHandlersMock,
  registerPetHandlersMock,
  registerSessionHandlersMock,
  registerUIHandlersMock,
  setTrustedUIRendererWebContentsIdMock,
  registerFilesystemHandlersMock,
  registerRuntimeHandlersMock,
  registerRuntimeEnvironmentHandlersMock,
  registerAiVaultHandlersMock,
  registerCodexAccountHandlersMock,
  registerAgentHookHandlersMock,
  registerAgentTrustHandlersMock,
  registerClaudeAccountHandlersMock,
  registerClipboardHandlersMock,
  setTrustedClipboardRendererWebContentsIdMock,
  registerBrowserHandlersMock,
  setAgentBrowserBridgeRefMock,
  setTrustedBrowserRendererWebContentsIdMock,
  registerFilesystemWatcherHandlersMock,
  registerAppHandlersMock,
  registerLinearHandlersMock,
  registerGitLabHandlersMock,
  registerExportHandlersMock,
  registerOnboardingHandlersMock,
  registerSpeechHandlersMock,
  registerSkillsHandlersMock,
  registerWorkspaceSpaceHandlersMock,
  registerWorkspacePortHandlersMock,
  registerEmulatorFrameStreamHandlersMock
} = vi.hoisted(() => ({
  registerCliHandlersMock: vi.fn(),
  registerPreflightHandlersMock: vi.fn(),
  registerGitHubHandlersMock: vi.fn(),
  registerFeedbackHandlersMock: vi.fn(),
  registerStatsHandlersMock: vi.fn(),
  registerMemoryHandlersMock: vi.fn(),
  registerNotebookHandlersMock: vi.fn(),
  registerNotificationHandlersMock: vi.fn(),
  registerDeveloperPermissionHandlersMock: vi.fn(),
  registerComputerUsePermissionHandlersMock: vi.fn(),
  registerSettingsHandlersMock: vi.fn(),
  registerKeybindingHandlersMock: vi.fn(),
  registerDiagnosticsHandlersMock: vi.fn(),
  registerShellHandlersMock: vi.fn(),
  registerPetHandlersMock: vi.fn(),
  registerSessionHandlersMock: vi.fn(),
  registerUIHandlersMock: vi.fn(),
  setTrustedUIRendererWebContentsIdMock: vi.fn(),
  registerFilesystemHandlersMock: vi.fn(),
  registerRuntimeHandlersMock: vi.fn(),
  registerRuntimeEnvironmentHandlersMock: vi.fn(),
  registerAiVaultHandlersMock: vi.fn(),
  registerCodexAccountHandlersMock: vi.fn(),
  registerAgentHookHandlersMock: vi.fn(),
  registerAgentTrustHandlersMock: vi.fn(),
  registerClaudeAccountHandlersMock: vi.fn(),
  registerClipboardHandlersMock: vi.fn(),
  setTrustedClipboardRendererWebContentsIdMock: vi.fn(),
  registerBrowserHandlersMock: vi.fn(),
  setAgentBrowserBridgeRefMock: vi.fn(),
  setTrustedBrowserRendererWebContentsIdMock: vi.fn(),
  registerFilesystemWatcherHandlersMock: vi.fn(),
  registerAppHandlersMock: vi.fn(),
  registerLinearHandlersMock: vi.fn(),
  registerGitLabHandlersMock: vi.fn(),
  registerExportHandlersMock: vi.fn(),
  registerOnboardingHandlersMock: vi.fn(),
  registerSpeechHandlersMock: vi.fn(),
  registerSkillsHandlersMock: vi.fn(),
  registerWorkspaceSpaceHandlersMock: vi.fn(),
  registerWorkspacePortHandlersMock: vi.fn(),
  registerEmulatorFrameStreamHandlersMock: vi.fn()
}))

vi.mock('./onboarding', () => ({
  registerOnboardingHandlers: registerOnboardingHandlersMock
}))

vi.mock('./speech', () => ({
  registerSpeechHandlers: registerSpeechHandlersMock
}))

vi.mock('./cli', () => ({
  registerCliHandlers: registerCliHandlersMock
}))

vi.mock('./preflight', () => ({
  registerPreflightHandlers: registerPreflightHandlersMock
}))

vi.mock('./github', () => ({
  registerGitHubHandlers: registerGitHubHandlersMock
}))

vi.mock('./feedback', () => ({
  registerFeedbackHandlers: registerFeedbackHandlersMock
}))

vi.mock('./export', () => ({
  registerExportHandlers: registerExportHandlersMock
}))

vi.mock('./stats', () => ({
  registerStatsHandlers: registerStatsHandlersMock
}))

vi.mock('./memory', () => ({
  registerMemoryHandlers: registerMemoryHandlersMock
}))

vi.mock('./notebook', () => ({
  registerNotebookHandlers: registerNotebookHandlersMock
}))

vi.mock('./notifications', () => ({
  registerNotificationHandlers: registerNotificationHandlersMock
}))

vi.mock('./developer-permissions', () => ({
  registerDeveloperPermissionHandlers: registerDeveloperPermissionHandlersMock
}))

vi.mock('./computer-use-permissions', () => ({
  registerComputerUsePermissionHandlers: registerComputerUsePermissionHandlersMock
}))

vi.mock('./settings', () => ({
  registerSettingsHandlers: registerSettingsHandlersMock
}))

vi.mock('./skills', () => ({
  registerSkillsHandlers: registerSkillsHandlersMock
}))

vi.mock('./workspace-space', () => ({
  registerWorkspaceSpaceHandlers: registerWorkspaceSpaceHandlersMock
}))

vi.mock('./workspace-ports', () => ({
  registerWorkspacePortHandlers: registerWorkspacePortHandlersMock
}))

vi.mock('./keybindings', () => ({
  registerKeybindingHandlers: registerKeybindingHandlersMock
}))

vi.mock('./diagnostics', () => ({
  registerDiagnosticsHandlers: registerDiagnosticsHandlersMock
}))

vi.mock('./shell', () => ({
  registerShellHandlers: registerShellHandlersMock
}))

vi.mock('./pet', () => ({
  registerPetHandlers: registerPetHandlersMock
}))

vi.mock('./session', () => ({
  registerSessionHandlers: registerSessionHandlersMock
}))

vi.mock('./ui', () => ({
  registerUIHandlers: registerUIHandlersMock,
  setTrustedUIRendererWebContentsId: setTrustedUIRendererWebContentsIdMock
}))

vi.mock('./emulator-frame-stream', () => ({
  registerEmulatorFrameStreamHandlers: registerEmulatorFrameStreamHandlersMock
}))

vi.mock('./filesystem', () => ({
  registerFilesystemHandlers: registerFilesystemHandlersMock
}))

vi.mock('./filesystem-watcher', () => ({
  registerFilesystemWatcherHandlers: registerFilesystemWatcherHandlersMock
}))

vi.mock('./runtime', () => ({
  registerRuntimeHandlers: registerRuntimeHandlersMock
}))

vi.mock('./runtime-environments', () => ({
  registerRuntimeEnvironmentHandlers: registerRuntimeEnvironmentHandlersMock
}))

vi.mock('./ai-vault', () => ({
  registerAiVaultHandlers: registerAiVaultHandlersMock
}))

vi.mock('./codex-accounts', () => ({
  registerCodexAccountHandlers: registerCodexAccountHandlersMock
}))

vi.mock('./agent-hooks', () => ({
  registerAgentHookHandlers: registerAgentHookHandlersMock
}))

vi.mock('./agent-trust', () => ({
  registerAgentTrustHandlers: registerAgentTrustHandlersMock
}))

vi.mock('./claude-accounts', () => ({
  registerClaudeAccountHandlers: registerClaudeAccountHandlersMock
}))

vi.mock('../window/clipboard-ipc-handlers', () => ({
  registerClipboardHandlers: registerClipboardHandlersMock,
  setTrustedClipboardRendererWebContentsId: setTrustedClipboardRendererWebContentsIdMock
}))

vi.mock('./browser', () => ({
  registerBrowserHandlers: registerBrowserHandlersMock,
  setTrustedBrowserRendererWebContentsId: setTrustedBrowserRendererWebContentsIdMock,
  setAgentBrowserBridgeRef: setAgentBrowserBridgeRefMock
}))

vi.mock('./app', () => ({
  registerAppHandlers: registerAppHandlersMock
}))

vi.mock('./linear', () => ({
  registerLinearHandlers: registerLinearHandlersMock
}))

vi.mock('./gitlab', () => ({
  registerGitLabHandlers: registerGitLabHandlersMock
}))

import { registerCoreHandlers } from './register-core-handlers'

describe('registerCoreHandlers', () => {
  beforeEach(() => {
    registerCliHandlersMock.mockReset()
    registerPreflightHandlersMock.mockReset()
    registerGitHubHandlersMock.mockReset()
    registerFeedbackHandlersMock.mockReset()
    registerStatsHandlersMock.mockReset()
    registerMemoryHandlersMock.mockReset()
    registerNotebookHandlersMock.mockReset()
    registerNotificationHandlersMock.mockReset()
    registerDeveloperPermissionHandlersMock.mockReset()
    registerComputerUsePermissionHandlersMock.mockReset()
    registerSettingsHandlersMock.mockReset()
    registerKeybindingHandlersMock.mockReset()
    registerDiagnosticsHandlersMock.mockReset()
    registerShellHandlersMock.mockReset()
    registerPetHandlersMock.mockReset()
    registerSessionHandlersMock.mockReset()
    registerUIHandlersMock.mockReset()
    setTrustedUIRendererWebContentsIdMock.mockReset()
    registerFilesystemHandlersMock.mockReset()
    registerRuntimeHandlersMock.mockReset()
    registerRuntimeEnvironmentHandlersMock.mockReset()
    registerAiVaultHandlersMock.mockReset()
    registerCodexAccountHandlersMock.mockReset()
    registerAgentHookHandlersMock.mockReset()
    registerAgentTrustHandlersMock.mockReset()
    registerClaudeAccountHandlersMock.mockReset()
    registerClipboardHandlersMock.mockReset()
    setTrustedClipboardRendererWebContentsIdMock.mockReset()
    registerBrowserHandlersMock.mockReset()
    setAgentBrowserBridgeRefMock.mockReset()
    setTrustedBrowserRendererWebContentsIdMock.mockReset()
    registerFilesystemWatcherHandlersMock.mockReset()
    registerAppHandlersMock.mockReset()
    registerLinearHandlersMock.mockReset()
    registerGitLabHandlersMock.mockReset()
    registerExportHandlersMock.mockReset()
    registerSpeechHandlersMock.mockReset()
    registerSkillsHandlersMock.mockReset()
    registerWorkspaceSpaceHandlersMock.mockReset()
    registerWorkspacePortHandlersMock.mockReset()
    registerEmulatorFrameStreamHandlersMock.mockReset()
  })

  it('passes the store through to handler registrars that need it', () => {
    const store = { marker: 'store' }
    const runtime = { marker: 'runtime', getAgentBrowserBridge: () => null }
    const stats = { marker: 'stats' }
    const codexAccounts = { marker: 'codexAccounts' }
    const claudeAccounts = { marker: 'claudeAccounts' }
    const agentAwakeService = { marker: 'agentAwakeService' }
    const onBeforeRelaunch = vi.fn()
    const getAdditionalAiVaultCodexHomePaths = vi.fn(() => ['/runtime/codex/home'])

    registerCoreHandlers(
      store as never,
      runtime as never,
      stats as never,
      codexAccounts as never,
      claudeAccounts as never,
      null,
      undefined,
      agentAwakeService as never,
      undefined,
      undefined,
      { getAdditionalAiVaultCodexHomePaths, onBeforeRelaunch }
    )

    expect(registerAppHandlersMock).toHaveBeenCalledWith(store, { onBeforeRelaunch })
    expect(registerCodexAccountHandlersMock).toHaveBeenCalledWith(codexAccounts)
    expect(registerAgentHookHandlersMock).toHaveBeenCalledWith(runtime)
    expect(registerPetHandlersMock).toHaveBeenCalled()
    expect(registerClaudeAccountHandlersMock).toHaveBeenCalledWith(claudeAccounts)
    expect(registerGitHubHandlersMock).toHaveBeenCalledWith(store, stats)
    expect(registerLinearHandlersMock).toHaveBeenCalled()
    expect(registerGitLabHandlersMock).toHaveBeenCalledWith(store)
    expect(registerFeedbackHandlersMock).toHaveBeenCalled()
    expect(registerStatsHandlersMock).toHaveBeenCalledWith(stats)
    expect(registerMemoryHandlersMock).toHaveBeenCalledWith(store)
    expect(registerNotebookHandlersMock).toHaveBeenCalledWith(store)
    expect(registerNotificationHandlersMock).toHaveBeenCalledWith(store, runtime)
    expect(registerDeveloperPermissionHandlersMock).toHaveBeenCalled()
    expect(registerComputerUsePermissionHandlersMock).toHaveBeenCalled()
    expect(registerSettingsHandlersMock).toHaveBeenCalledWith(store, agentAwakeService)
    expect(registerSkillsHandlersMock).toHaveBeenCalledWith(store)
    expect(registerWorkspaceSpaceHandlersMock).toHaveBeenCalledWith(store)
    expect(registerWorkspacePortHandlersMock).toHaveBeenCalledWith(store)
    expect(registerSessionHandlersMock).toHaveBeenCalledWith(store)
    expect(registerUIHandlersMock).toHaveBeenCalledWith(store)
    expect(registerEmulatorFrameStreamHandlersMock).toHaveBeenCalled()
    expect(registerFilesystemHandlersMock).toHaveBeenCalledWith(store)
    expect(registerRuntimeHandlersMock).toHaveBeenCalledWith(runtime)
    expect(registerRuntimeEnvironmentHandlersMock).toHaveBeenCalled()
    expect(registerAiVaultHandlersMock).toHaveBeenCalledWith({
      getAdditionalCodexHomePaths: getAdditionalAiVaultCodexHomePaths
    })
    expect(registerCliHandlersMock).toHaveBeenCalled()
    expect(registerPreflightHandlersMock).toHaveBeenCalled()
    expect(registerShellHandlersMock).toHaveBeenCalled()
    expect(registerClipboardHandlersMock).toHaveBeenCalledWith(store)
    expect(setTrustedBrowserRendererWebContentsIdMock).toHaveBeenCalledWith(null)
    expect(setTrustedClipboardRendererWebContentsIdMock).toHaveBeenCalledWith(null)
    expect(setTrustedUIRendererWebContentsIdMock).toHaveBeenCalledWith(null)
    expect(registerBrowserHandlersMock).toHaveBeenCalled()
    expect(registerFilesystemWatcherHandlersMock).toHaveBeenCalled()
    expect(registerSpeechHandlersMock).toHaveBeenCalledWith(store)
  })

  it('only registers IPC handlers once but always updates web contents id', () => {
    // The first test already called registerCoreHandlers, so the module-level
    // guard is now set. beforeEach reset all mocks, so call counts are 0.
    const store2 = { marker: 'store2' }
    const runtime2 = { marker: 'runtime2', getAgentBrowserBridge: () => null }
    const stats2 = { marker: 'stats2' }
    const codexAccounts2 = { marker: 'codexAccounts2' }
    const claudeAccounts2 = { marker: 'claudeAccounts2' }

    registerCoreHandlers(
      store2 as never,
      runtime2 as never,
      stats2 as never,
      codexAccounts2 as never,
      claudeAccounts2 as never,
      42
    )

    // Web contents ID should always be updated
    expect(setTrustedBrowserRendererWebContentsIdMock).toHaveBeenCalledWith(42)
    expect(setTrustedClipboardRendererWebContentsIdMock).toHaveBeenCalledWith(42)
    expect(setTrustedUIRendererWebContentsIdMock).toHaveBeenCalledWith(42)
    // IPC handlers should NOT be registered again
    expect(registerCliHandlersMock).not.toHaveBeenCalled()
    expect(registerPreflightHandlersMock).not.toHaveBeenCalled()
    expect(registerBrowserHandlersMock).not.toHaveBeenCalled()
    // Why: ipcMain.handle throws on duplicate channel registration, so the
    // memory handler must not be wired up a second time on reactivation.
    expect(registerMemoryHandlersMock).not.toHaveBeenCalled()
  })
})
