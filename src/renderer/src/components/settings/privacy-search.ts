// Settings-search entries for the Privacy pane. Kept in its own file to
// mirror the other per-pane search modules (notifications-search.ts,
// terminal-search.ts, etc.) and keep Settings.tsx imports uniform.

import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getPrivacyPaneSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.privacy.search.5c508bad41', 'Privacy & Telemetry'),
    description: translate(
      'components.settings.privacy.search.noTelemetry',
      'This build collects no analytics or usage telemetry. Privacy and diagnostics controls.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.privacy.search.10124159f1', 'privacy'),
      ...translateSearchKeyword('auto.components.settings.privacy.search.77d3180def', 'telemetry'),
      ...translateSearchKeyword('auto.components.settings.privacy.search.4104f6f0f3', 'analytics'),
      ...translateSearchKeyword('auto.components.settings.privacy.search.2b5a5c312f', 'posthog')
    ]
  },
  {
    title: translate('auto.components.settings.privacy.search.6d258d2ed6', 'Diagnostics'),
    description: translate(
      'auto.components.settings.privacy.search.8b08f32366',
      'App diagnostics and support sharing controls.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.privacy.search.c0494ff48a',
        'diagnostics'
      ),
      ...translateSearchKeyword('auto.components.settings.privacy.search.1686c07fee', 'support')
    ]
  }
])
