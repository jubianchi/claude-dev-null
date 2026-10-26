import { describe, expect, test } from 'claude-code/testing'

import type { WebApp } from '../hooks/infrastructure/web-app'
import { WebAppError } from '../hooks/infrastructure/web-app'
import { readReplies } from '../hooks/infrastructure/web-replies'
import type { LogEntry } from '../types'

type Raw = Record<string, unknown>

function raw(id: string, parentId: string | null, replies = 0, quotedId: string | null = null): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-17T10:00:00.000000Z',
    parent_id: parentId,
    quoted_commit_id: quotedId,
    replies_count: replies,
    user: { handle: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
  }
}

function entry(id: string, parentId: string | null, replies = 0, quotedId: string | null = null): LogEntry {
  return {
    id,
    shortHash: id,
    body: `body of ${id}`,
    parentId,
    url: '',
    createdAt: '2026-10-17T10:00:00.000000Z',
    stars: 0,
    replies,
    author: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
    linkPreview: null,
    images: [],
    segments: [{ type: 'text', text: `body of ${id}` }],
    quote: null,
    quotedId,
    continuationId: null,
    deletedAt: null,
    mentions: {},
    preview: null,
    poll: null,
  }
}

/**
 * A web app whose commits have the replies of `tree`, by parent, `perPage` at a time; records each path read in
 * `paths`, and fails those in `failing`.
 */
function app(tree: Record<string, Raw[]>, perPage = 50, failing: string[] = []): WebApp & { paths: string[] } {
  const paths: string[] = []
  const json = async (path: string): Promise<unknown> => {
    paths.push(path)
    const url = new URL(path, 'https://dev-null.sh')
    const id = decodeURIComponent(url.pathname.split('/')[2] ?? '')

    if (failing.includes(id)) {
      throw new WebAppError('HTTP 429')
    }

    const start = Number(url.searchParams.get('cursor') ?? 0)
    const all = tree[id] ?? []
    const next = start + perPage < all.length ? String(start + perPage) : null

    return { data: all.slice(start, start + perPage), next_cursor: next, prev_cursor: null, per_page: perPage }
  }

  return { visit: async () => Promise.reject(new Error('not a page')), json, paths }
}

const ids = (entries: LogEntry[]) => entries.map(found => found.id)

describe('reading the replies of the web app', () => {
  test('reads the replies of the commits that have some', async () => {
    const web = app({ c1: [raw('r1', 'c1'), raw('r2', 'c1')] })
    const replies = await readReplies(web, [entry('c1', null, 2), entry('c2', null, 0)])

    expect(ids(replies)).toEqual(['r1', 'r2'])
    expect(web.paths).toEqual(['/commits/c1/replies'])
  })

  test('reads down the replies that have replies', async () => {
    const web = app({ c1: [raw('r1', 'c1', 1), raw('r2', 'c1')], r1: [raw('r3', 'r1', 1)], r3: [raw('r4', 'r3')] })
    const replies = await readReplies(web, [entry('c1', null, 2)])

    expect(ids(replies)).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(replies.find(found => found.id === 'r4')?.parentId).toBe('r3')
  })

  test('reads every page of replies', async () => {
    const web = app({ c1: [raw('r1', 'c1'), raw('r2', 'c1'), raw('r3', 'c1')] }, 2)

    expect(ids(await readReplies(web, [entry('c1', null, 3)]))).toEqual(['r1', 'r2', 'r3'])
    expect(web.paths).toEqual(['/commits/c1/replies', '/commits/c1/replies?cursor=2'])
  })

  test('does not read again the replies the log already shows', async () => {
    const web = app({ c1: [raw('r1', 'c1')] })

    expect(await readReplies(web, [entry('c1', null, 1)], [entry('r1', 'c1')])).toEqual([])
    expect(web.paths).toEqual([])
  })

  test('reads down a reply the log already shows', async () => {
    const web = app({ r1: [raw('r2', 'r1')] })

    expect(ids(await readReplies(web, [entry('c1', null, 1)], [entry('r1', 'c1', 1)]))).toEqual(['r2'])
    expect(web.paths).toEqual(['/commits/r1/replies'])
  })

  test('reads all the replies of a commit the log shows only some of', async () => {
    const web = app({ c1: [raw('r1', 'c1'), raw('r2', 'c1')] })

    expect(ids(await readReplies(web, [entry('c1', null, 2)], [entry('r1', 'c1')]))).toEqual(['r2'])
  })

  test('reads the commits in the order of the log, up to so many requests', async () => {
    const web = app({ c1: [raw('r1', 'c1')], c2: [raw('r2', 'c2')], c3: [raw('r3', 'c3')] })
    const replies = await readReplies(web, [entry('c2', null, 1), entry('c1', null, 1), entry('c3', null, 1)], [], 2)

    expect(ids(replies)).toEqual(['r2', 'r1'])
    expect(web.paths).toHaveLength(2)
  })

  test('stops at the first request that fails, with what it read', async () => {
    const web = app({ c1: [raw('r1', 'c1')], c3: [raw('r3', 'c3')] }, 50, ['c2'])
    const replies = await readReplies(web, [entry('c1', null, 1), entry('c2', null, 1), entry('c3', null, 1)])

    expect(ids(replies)).toEqual(['r1'])
    expect(web.paths).toHaveLength(2)
  })

  test('leaves out what is not a reply', async () => {
    const web = app({ c1: [raw('r1', 'c1'), { id: 'r2' } as Raw] })

    expect(ids(await readReplies(web, [entry('c1', null, 2)]))).toEqual(['r1'])
  })

  test('counts the quotes of a commit among its replies, as /dev/null does', async () => {
    const web = app({ c1: [raw('r1', 'c1'), raw('q1', null, 0, 'c1')] })

    expect(ids(await readReplies(web, [entry('c1', null, 2)]))).toEqual(['r1', 'q1'])
    expect(await readReplies(web, [entry('c1', null, 2)], [entry('r1', 'c1'), entry('q1', null, 0, 'c1')])).toEqual([])
    expect(web.paths).toEqual(['/commits/c1/replies'])
  })

  test('leaves out the reply an author continues a commit with, as /dev/null does', async () => {
    const web = app({ c1: [raw('r1', 'c1')] })
    const continued = { ...entry('c1', null, 1), continuationId: 'r9' }

    expect(ids(await readReplies(web, [continued]))).toEqual(['r1'])
    expect(web.paths).toEqual(['/commits/c1/replies?except=r9'])
  })

  test('reads nothing of a commit its author only continues', async () => {
    const web = app({ c1: [raw('r9', 'c1')] })

    expect(await readReplies(web, [{ ...entry('c1', null, 0), continuationId: 'r9' }])).toEqual([])
    expect(web.paths).toEqual([])
  })

  test('reads each commit once', async () => {
    const web = app({ c1: [raw('r1', 'c1', 1)], r1: [raw('c1', 'r1', 1)] })

    expect(ids(await readReplies(web, [entry('c1', null, 1)]))).toEqual(['r1'])
    expect(web.paths).toEqual(['/commits/c1/replies', '/commits/r1/replies'])
  })
})
