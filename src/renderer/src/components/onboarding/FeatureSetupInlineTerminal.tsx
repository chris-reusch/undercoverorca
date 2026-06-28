import { notifyInstalledAgentSkillsChanged } from '@/hooks/useInstalledAgentSkills'
import { OnboardingInlineCommandTerminal } from './OnboardingInlineCommandTerminal'
import type { OnboardingFeatureSetupSelection } from './onboarding-feature-setup'
import { translate } from '@/i18n/i18n'

type FeatureSetupInlineTerminalProps = {
  command: string
  // Retained for call-site compatibility; no longer used now that the
  // terminal open/interaction telemetry has been removed.
  selection: OnboardingFeatureSetupSelection
}

export function FeatureSetupInlineTerminal({
  command
}: FeatureSetupInlineTerminalProps): React.JSX.Element {
  return (
    <OnboardingInlineCommandTerminal
      command={command}
      title={translate(
        'auto.components.onboarding.FeatureSetupInlineTerminal.c767ab7061',
        'Skill setup'
      )}
      ariaLabel={translate(
        'auto.components.onboarding.FeatureSetupInlineTerminal.47fc6cc6dc',
        'Skill setup command'
      )}
      description={translate(
        'auto.components.onboarding.FeatureSetupInlineTerminal.789b59936e',
        'Press Enter to run the command and confirm npx if asked. You can also set this up later in Settings.'
      )}
      terminalHeightPx={180}
      terminalTopMarginPx={16}
      autoScrollIntoView={false}
      onTerminalExit={notifyInstalledAgentSkillsChanged}
    />
  )
}
