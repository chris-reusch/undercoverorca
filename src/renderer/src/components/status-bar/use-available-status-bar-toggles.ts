import type { StatusBarItem } from '../../../../shared/types'

/** Returns the status-bar toggles available to the user. The remaining toggles
 *  (Remote Hosts, Ports) are not gated on CLI detection, so all are shown. */
export function useAvailableStatusBarToggles<T extends { id: StatusBarItem }>(
  toggles: readonly T[]
): T[] {
  return [...toggles]
}
