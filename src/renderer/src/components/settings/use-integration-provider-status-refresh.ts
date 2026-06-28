import { useEffect } from 'react'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'

export function useIntegrationProviderStatusRefresh(): void {
  const settings = useAppStore((s) => s.settings)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusContextKey = useAppStore((s) => s.preflightStatusContextKey)
  const linearStatusChecked = useAppStore((s) => s.linearStatusChecked)
  const linearStatusContextKey = useAppStore((s) => s.linearStatusContextKey)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const expectedPreflightContextKey = useAppStore((s) =>
    localPreflightContextKey(getLocalPreflightContext(s))
  )
  const providerRuntimeContextKey = getProviderRuntimeContextKey(settings)
  const preflightStatusCurrent = preflightStatusContextKey === expectedPreflightContextKey
  const linearStatusCurrent = linearStatusContextKey === providerRuntimeContextKey

  useEffect(() => {
    if (!linearStatusCurrent || !linearStatusChecked) {
      void checkLinearConnection()
    }
    if (!preflightStatusCurrent || !preflightStatusChecked) {
      void refreshPreflightStatus()
    }
  }, [
    checkLinearConnection,
    linearStatusChecked,
    linearStatusCurrent,
    linearStatusContextKey,
    expectedPreflightContextKey,
    preflightStatusChecked,
    preflightStatusContextKey,
    preflightStatusCurrent,
    providerRuntimeContextKey,
    refreshPreflightStatus
  ])
}
