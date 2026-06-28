import type { StatusBarItem } from '../../../../shared/types'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getStatusBarToggles = createLocalizedCatalog(
  (): readonly {
    id: StatusBarItem
    title: string
    description: string
    keywords: string[]
    toggleDescription: string
  }[] => [
    {
      id: 'ssh',
      title: translate('auto.components.settings.appearance.search.57fb424c56', 'Remote Hosts'),
      description: translate(
        'auto.components.settings.appearance.search.f17d66d0d2',
        'Show remote host connection status in the status bar.'
      ),
      keywords: [
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.896eb53fd4',
          'status bar'
        ),
        ...translateSearchKeyword('auto.components.settings.appearance.search.6ecad74eb3', 'ssh'),
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.a278406ed5',
          'remote'
        ),
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.f4997e0f8a',
          'connection'
        ),
        ...translateSearchKeyword('auto.components.settings.appearance.search.fe192b060e', 'host')
      ],
      toggleDescription: translate(
        'settings.appearance.statusBar.sshToggleDescription',
        'Show configured SSH and remote Orca hosts when any are available.'
      )
    },
    {
      id: 'ports',
      title: translate('auto.components.settings.appearance.search.cf409b6c4d', 'Ports'),
      description: translate(
        'auto.components.settings.appearance.search.0ececfa190',
        'Show live workspace ports in the status bar.'
      ),
      keywords: [
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.896eb53fd4',
          'status bar'
        ),
        ...translateSearchKeyword('auto.components.settings.appearance.search.006e67b279', 'ports'),
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.46d21eef62',
          'localhost'
        ),
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.43cfba3b95',
          'server'
        ),
        ...translateSearchKeyword(
          'auto.components.settings.appearance.search.dc02c8759d',
          'workspace'
        )
      ],
      toggleDescription: translate(
        'settings.appearance.statusBar.portsToggleDescription',
        'Show live workspace ports. Click it for workspace-scoped ports and external listeners.'
      )
    }
  ]
)
