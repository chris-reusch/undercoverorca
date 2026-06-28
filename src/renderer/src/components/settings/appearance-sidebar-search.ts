import type { SettingsSearchEntry } from './settings-search'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getLeftSidebarAppearanceEntry = createLocalizedCatalog(
  (): SettingsSearchEntry => ({
    title: translate(
      'auto.components.settings.appearance.search.leftSidebarAppearance.title',
      'Left Sidebar Appearance'
    ),
    description: translate(
      'auto.components.settings.appearance.search.leftSidebarAppearance.description',
      'Make the left sidebar match your terminal, stay default, or use a tint.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.appearance.search.5bff6a2ef0', 'sidebar'),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.leftSidebarAppearance.project',
        'project'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.leftSidebarAppearance.terminal',
        'terminal'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.leftSidebarAppearance.background',
        'background'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.leftSidebarAppearance.tint',
        'tint'
      )
    ]
  })
)

export const getWorkspaceCardLayoutEntry = createLocalizedCatalog(
  (): SettingsSearchEntry => ({
    title: translate(
      'auto.components.settings.appearance.search.workspaceCardLayout.title',
      'Workspace Card Layout'
    ),
    description: translate(
      'auto.components.settings.appearance.search.workspaceCardLayout.description',
      'Switch between compact and detailed workspace cards from the workspace sidebar options menu.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.compact',
        'compact'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.compactDisplay',
        'compact display'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.workspaceCards',
        'workspace cards'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.worktreeCards',
        'worktree cards'
      ),
      ...translateSearchKeyword('auto.components.settings.appearance.search.5bff6a2ef0', 'sidebar'),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.cardLayout',
        'card layout'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.workspaceOptions',
        'workspace options'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.appearance.search.workspaceCardLayout.detailed',
        'detailed'
      )
    ]
  })
)

export const getSidebarEntries = createLocalizedCatalog((): SettingsSearchEntry[] => [
  {
    title: translate(
      'auto.components.settings.appearance.search.1de96ec8a6',
      'Show Orca Mobile Button'
    ),
    description: translate(
      'auto.components.settings.appearance.search.682293cadf',
      'Show the Orca Mobile button at the top of the left sidebar.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.appearance.search.74618577c7', 'mobile'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.5e5b8878bf', 'phone'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.5bff6a2ef0', 'sidebar'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.6cf5f54ce1', 'button'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.648eeada79', 'hide'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.ac79fe4a04', 'show'),
      ...translateSearchKeyword('auto.components.settings.appearance.search.839fb1e3ed', 'toolbox')
    ]
  },
  getWorkspaceCardLayoutEntry(),
  getLeftSidebarAppearanceEntry()
])
