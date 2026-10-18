import { describe, expect, test } from 'claude-code/testing'

import { countdown } from '../hooks/countdown'

describe('counting down to the next refresh', () => {
  const NOW = Date.parse('2026-10-17T11:00:00Z')

  test('says how many seconds are left, rounded up, in three columns', () => {
    expect(countdown(NOW + 60_000, NOW)).toBe('60s')
    expect(countdown(NOW + 41_200, NOW)).toBe('42s')
    expect(countdown(NOW + 9_000, NOW)).toBe(' 9s')
  })

  test('never goes below a second, nor says more than its minutes in seconds', () => {
    expect(countdown(NOW, NOW)).toBe(' 1s')
    expect(countdown(NOW - 5_000, NOW)).toBe(' 1s')
  })
})
