import { describe, expect, test } from 'claude-code/testing'

import { FRAME_EVERY, FRAMES, spinner } from '../hooks/spinner'

describe('spinning while something loads', () => {
  test('turns a frame every so many milliseconds, in a loop', () => {
    expect(spinner(0)).toBe(FRAMES[0])
    expect(spinner(FRAME_EVERY)).toBe(FRAMES[1])
    expect(spinner(FRAME_EVERY * FRAMES.length)).toBe(FRAMES[0])
    expect(spinner(FRAME_EVERY * 3 + FRAME_EVERY / 2)).toBe(FRAMES[3])
  })

  test('draws each frame in one column', () => {
    expect(FRAMES.every(frame => [...frame].length === 1)).toBe(true)
  })
})
