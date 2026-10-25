import { describe, expect, test } from 'claude-code/testing'

import type { Entry } from '../hooks/log'
import { anchorAt, arrived, offsetOf, threadsOf } from '../hooks/log'

function entry(id: string, createdAt: string, parentId: string | null = null): Entry {
  return {
    id,
    shortHash: id,
    body: id,
    parentId,
    url: `https://dev-null.sh/commits/${id}`,
    createdAt,
    stars: 0,
    replies: 0,
    author: { username: 'me', name: 'Me' },
    linkPreview: null,
    images: [],
    segments: [{ type: 'text', text: id }],
    quote: null,
    quotedId: null,
    continuationId: null,
    deletedAt: null,
    mentions: {},
    preview: null,
    poll: null,
  }
}

const c1 = entry('c1', '2026-10-17T09:00:00Z')
const c2 = entry('c2', '2026-10-17T10:00:00Z')
const c3 = entry('c3', '2026-10-17T11:00:00Z')
const c4 = entry('c4', '2026-10-17T12:00:00Z')
const r1 = entry('r1', '2026-10-17T09:30:00Z', 'c1')

describe('keeping the place of the log', () => {
  test('anchors the log on the commit or reply it shows first', () => {
    const log = threadsOf([c2, c1], [r1])

    expect(anchorAt(log, 0)).toBe('c2')
    expect(anchorAt(log, 2)).toBe('r1')
    expect(anchorAt(log, 9)).toBeUndefined()
  })

  test('finds where the commit or reply anchored shows once the log changed', () => {
    const log = threadsOf([c4, c3, c2, c1], [r1])

    expect(offsetOf(log, 'r1')).toBe(4)
    expect(offsetOf(log, 'c9')).toBeUndefined()
  })
})

describe('telling the commits that arrived', () => {
  test('are those above the commit the log started with', () => {
    expect(arrived([c2, c1], [c4, c3, c2, c1])).toEqual(['c4', 'c3'])
  })

  test('are none when the log starts as it did', () => {
    expect(arrived([c2, c1], [c2, c1])).toEqual([])
  })

  test('are none when the log was empty, or shares no commit with what it was', () => {
    expect(arrived([], [c2, c1])).toEqual([])
    expect(arrived([c4], [c2, c1])).toEqual([])
  })

  test('start from the first commit of the log still shown, the one before it gone', () => {
    expect(arrived([c3, c2, c1], [c4, c2, c1])).toEqual(['c4'])
  })
})
