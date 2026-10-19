import { describe, expect, test } from 'claude-code/testing'
import type { Api } from '../hooks/infrastructure/api'
import { readApiReplies } from '../hooks/infrastructure/api-replies'
import type { LogEntry } from '../types'

type Raw = Record<string, unknown>

function raw(id: string, parentId: string | null, replies = 0): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-19T10:00:00Z',
    parent_id: parentId,
    replies_count: replies,
    author: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
  }
}

function entry(id: string, parentId: string | null, replies = 0): LogEntry {
  return {
    id,
    shortHash: id,
    body: '',
    parentId,
    url: '',
    createdAt: '',
    stars: 0,
    replies,
    author: { username: 'nunomaduro', name: 'Nuno Maduro' },
    linkPreview: null,
    images: [],
    segments: [],
    quote: null,
    poll: null,
  }
}

/** The API answering each path with the page `pages` holds for it, recording each path in `paths`. */
function reader(pages: Record<string, { data: Raw[]; next?: string }>): Api & { paths: string[] } {
  const paths: string[] = []

  return {
    paths,
    get: async path => {
      paths.push(path)
      const found = pages[path]

      if (found === undefined) {
        throw new Error(`no page at ${path}`)
      }

      return { data: found.data, meta: { per_page: 50, next_cursor: found.next ?? null, prev_cursor: null } }
    },
  }
}

const ids = (entries: LogEntry[]) => entries.map(found => found.id)

describe('reading the replies of the API', () => {
  test('reads the replies of the commits that have some, down their threads', async () => {
    const api = reader({
      '/api/v1/commits/c1/replies': { data: [raw('r1', 'c1', 1)] },
      '/api/v1/commits/r1/replies': { data: [raw('r2', 'r1')] },
    })

    expect(ids(await readApiReplies(api, [entry('c1', null, 1), entry('c2', null, 0)]))).toEqual(['r1', 'r2'])
    expect(api.paths).toEqual(['/api/v1/commits/c1/replies', '/api/v1/commits/r1/replies'])
  })

  test('reads every page of replies, from the cursor of the next one', async () => {
    const api = reader({
      '/api/v1/commits/c1/replies': { data: [raw('r1', 'c1')], next: "eyJ+/='" },
      '/api/v1/commits/c1/replies?cursor=eyJ%2B%2F%3D%27': { data: [raw('r2', 'c1')] },
    })

    expect(ids(await readApiReplies(api, [entry('c1', null, 2)]))).toEqual(['r1', 'r2'])
  })

  test('reads no replies the log already shows', async () => {
    const api = reader({})

    expect(await readApiReplies(api, [entry('c1', null, 1)], [entry('r1', 'c1')])).toEqual([])
    expect(api.paths).toEqual([])
  })

  test('stops at the first request that fails, with what it read', async () => {
    const api = reader({ '/api/v1/commits/c1/replies': { data: [raw('r1', 'c1')] } })

    expect(ids(await readApiReplies(api, [entry('c1', null, 1), entry('c2', null, 1)]))).toEqual(['r1'])
  })

  test('leaves out what is not a reply', async () => {
    const api = reader({
      '/api/v1/commits/c1/replies': { data: [raw('r1', 'c1'), { id: 'gone', deleted_at: '2026-10-19T10:00:00Z' }] },
    })

    expect(ids(await readApiReplies(api, [entry('c1', null, 2)]))).toEqual(['r1'])
  })
})
