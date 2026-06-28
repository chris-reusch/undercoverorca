import { describe, expect, it } from 'vitest'
import { getLinkedWorkItemProvider } from './new-workspace'

describe('getLinkedWorkItemProvider', () => {
  it.each([
    [
      'explicit provider metadata',
      {
        type: 'issue',
        provider: 'linear',
        number: 0,
        title: 'ENG-123 Fix Linear',
        url: 'https://linear.app/team/issue/ENG-123/fix-linear',
        linearIdentifier: 'ENG-123'
      },
      'linear'
    ],
    [
      'legacy Linear linked issue',
      {
        type: 'issue',
        number: 0,
        title: 'Fix Linear',
        url: 'https://linear.app/team/issue/ENG-123/fix-linear',
        linearIdentifier: 'ENG-123'
      },
      'linear'
    ]
  ] as const)('detects %s', (_label, item, provider) => {
    expect(getLinkedWorkItemProvider(item)).toBe(provider)
  })
})
