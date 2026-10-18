import { describe, expect, test } from 'claude-code/testing'

import { LeastRecent } from '../hooks/least-recent'

describe('keeping the values used last', () => {
  test('leaves out the value used least recently once over its size, and gives it', () => {
    const kept = new LeastRecent<string>(2)

    expect(kept.set('a', 'A')).toEqual([])
    expect(kept.set('b', 'B')).toEqual([])
    expect(kept.get('a')).toBe('A')
    expect(kept.set('c', 'C')).toEqual(['B'])
    expect([kept.has('a'), kept.has('b'), kept.has('c')]).toEqual([true, false, true])
  })

  test('tells whether it holds a value without making it used', () => {
    const kept = new LeastRecent<string>(2)
    kept.set('a', 'A')
    kept.set('b', 'B')

    expect(kept.has('a')).toBe(true)
    expect(kept.set('c', 'C')).toEqual(['A'])
  })

  test('replaces the value of a key it holds, giving the one it replaced', () => {
    const kept = new LeastRecent<string>(2)
    kept.set('a', 'A')

    expect(kept.set('a', 'A2')).toEqual(['A'])
    expect(kept.get('a')).toBe('A2')
  })
})
