import { describe, expect, it } from 'vitest'
import {
  filterAvailableTaskProviders,
  normalizeTaskProviderSettings,
  normalizeVisibleTaskProviders,
  restoreAvailableDefaultTaskProvider,
  resolveVisibleTaskProvider
} from './task-providers'

describe('task providers', () => {
  it('normalizes provider lists to the supported set', () => {
    expect(normalizeVisibleTaskProviders(['github', 'unknown', 'github'])).toEqual(['github'])
  })

  it('falls back to all providers when none are visible', () => {
    expect(normalizeVisibleTaskProviders([])).toEqual(['github'])
  })

  it('normalizes invalid saved defaults to the first visible provider', () => {
    expect(
      normalizeTaskProviderSettings({
        visibleTaskProviders: ['github'],
        defaultTaskSource: 'bitbucket'
      })
    ).toEqual({
      defaultTaskSource: 'github',
      visibleTaskProviders: ['github']
    })
  })

  it('resolves preferred providers to the first visible provider', () => {
    expect(resolveVisibleTaskProvider('github', ['github'])).toBe('github')
  })

  it('keeps GitHub available regardless of runtime detection', () => {
    expect(filterAvailableTaskProviders(['github'], { gitlabInstalled: false })).toEqual(['github'])
  })

  it('restores the saved default while normalizing visible providers', () => {
    expect(
      restoreAvailableDefaultTaskProvider(['github'], { gitlabInstalled: false }, 'github')
    ).toEqual(['github'])
  })

  it('falls back to GitHub when no preferred provider is available', () => {
    expect(filterAvailableTaskProviders([], { gitlabInstalled: false })).toEqual(['github'])
  })
})
