import { describe, expect, test } from 'claude-code/testing'

import type { Entry, Thread } from '../hooks/log'
import { heights, limited, threadsOf } from '../hooks/log'

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
    author: { handle: 'me', name: 'Me' },
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

const at = (minute: number) => `2026-10-17T10:${String(minute).padStart(2, '0')}:00Z`

/** c1, its replies r1 to r4 (r4 the newest), and the replies s1 to s3 of r4 (s3 the newest). */
function thread(): Thread {
  const [found] = threadsOf(
    [entry('c1', at(0))],
    [
      ...[1, 2, 3, 4].map(index => entry(`r${index}`, at(index), 'c1')),
      ...[1, 2, 3].map(index => entry(`s${index}`, at(10 + index), 'r4')),
    ],
  )

  return found as Thread
}

const shown = (found: Thread) => found.replies.map(reply => reply.id)
const more = (found: Thread) =>
  found.replies.filter(reply => (reply.more ?? []).length > 0).map(reply => [reply.id, reply.more])

describe('showing so many replies under a commit', () => {
  test('shows the newest replies of each commit and reply, so many of each', () => {
    expect(shown(limited(thread(), 2))).toEqual(['r4', 's3', 's2', 'r3'])
  })

  test('says how many replies of each are left, after the last reply shown under it', () => {
    expect(more(limited(thread(), 2))).toEqual([
      ['s2', [{ id: 'r4', count: 1, depth: 2 }]],
      ['r3', [{ id: 'c1', count: 2, depth: 1 }]],
    ])
  })

  test('shows the replies of a reply left out with it', () => {
    expect(shown(limited(thread(), 1))).toEqual(['r4', 's3'])
    expect(more(limited(thread(), 1))).toEqual([
      [
        's3',
        [
          { id: 'r4', count: 2, depth: 2 },
          { id: 'c1', count: 3, depth: 1 },
        ],
      ],
    ])
  })

  test('shows as many replies of a commit or reply as asked for it', () => {
    expect(shown(limited(thread(), 1, { c1: 4 }))).toEqual(['r4', 's3', 'r3', 'r2', 'r1'])
    expect(more(limited(thread(), 1, { c1: 4 }))).toEqual([['s3', [{ id: 'r4', count: 2, depth: 2 }]]])
  })

  test('says nothing is left when all replies show', () => {
    expect(shown(limited(thread(), 5))).toEqual(shown(thread()))
    expect(more(limited(thread(), 5))).toEqual([])
  })

  test('counts a row for each Show more', () => {
    const all = heights([limited(thread(), 5)], 80, false)
    const some = heights([limited(thread(), 1)], 80, false)

    expect(some).toEqual([all[0], all[1], (all[2] ?? 0) + 2])
  })
})
