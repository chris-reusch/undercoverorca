import { ShieldCheck } from 'lucide-react'
import type { GlobalSettings } from '../../../../shared/types'
import { Label } from '../ui/label'
import { PrivacyDiagnosticsSection } from './PrivacyDiagnosticsSection'
import { translate } from '@/i18n/i18n'

type PrivacyPaneProps = {
  settings: GlobalSettings
}

// Privacy-hardened build: there is no PostHog client and no telemetry IPC,
// so the pane only documents that no analytics are collected and keeps the
// local diagnostics controls.
export function PrivacyPane(_props: PrivacyPaneProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 py-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-0.5">
          <Label>{translate('components.settings.PrivacyPane.noTelemetryTitle', 'Telemetry')}</Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'components.settings.PrivacyPane.noTelemetryBody',
              'This build collects no analytics or usage telemetry. No usage data leaves your device.'
            )}
          </p>
        </div>
      </div>
      <PrivacyDiagnosticsSection />
    </div>
  )
}
