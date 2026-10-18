import { describe, expect, test } from 'claude-code/testing'
import { current, EMPTY, more, refresh, within } from '../hooks/application/web-logs'
import type { Page, WebApp } from '../hooks/infrastructure/web-app'
import { SignInRequired, WebAppError } from '../hooks/infrastructure/web-app'
import type { WebLog } from '../types'

type Raw = Record<string, unknown>

function raw(id: string, parentId: string | null = null, replies = 0, preview: Raw[] = []): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-17T10:00:00.000000Z',
    parent_id: parentId,
    replies_count: replies,
    user: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
    reply_preview: { data: preview, next_cursor: null, prev_cursor: null },
  }
}

type Site = { pages: Record<string, { data: Raw[]; next: string | null }>; replies?: Record<string, Raw[]> }

/** A web app serving the pages of `site` by path, and the replies of its commits; records each path read. */
function app(site: Site | (() => Site)): WebApp & { paths: string[] } {
  const paths: string[] = []
  const current = () => (typeof site === 'function' ? site() : site)

  return {
    paths,
    visit: async (path: string): Promise<Page> => {
      paths.push(path)
      const found = current().pages[path]

      if (found === undefined) {
        throw new WebAppError('HTTP 404')
      }

      return {
        component: 'log/show',
        props: { commits: { data: found.data, next_cursor: found.next } },
        url: path,
        version: 'v1',
      }
    },
    json: async (path: string): Promise<unknown> => {
      paths.push(path)
      const id = path.split('/')[2] ?? ''

      return { data: current().replies?.[id] ?? [], next_cursor: null }
    },
  }
}

const ids = (entries: { id: string }[]) => entries.map(found => found.id)

describe('refreshing a log of the web app', () => {
  test('loads the first page of the log, with the replies of its commits', async () => {
    const web = app({
      pages: { '/log/latest': { data: [raw('c1', null, 2, [raw('r1', 'c1')]), raw('c2')], next: 'n1' } },
      replies: { c1: [raw('r1', 'c1'), raw('r2', 'c1')] },
    })
    const log = await refresh(web, 'latest')

    expect(ids(log.commits)).toEqual(['c1', 'c2'])
    expect(ids(log.replies)).toEqual(['r1', 'r2'])
    expect(log.next).toBe('n1')
    expect(log.error).toBe('')
  })

  test('does not read again the replies it read already', async () => {
    const site = {
      pages: { '/log/latest': { data: [raw('c1', null, 2, [raw('r1', 'c1')])], next: null } },
      replies: { c1: [raw('r1', 'c1'), raw('r2', 'c1')] },
    }
    const web = app(site)
    const first = await refresh(web, 'latest')
    web.paths.length = 0
    const again = await refresh(web, 'latest', first)

    expect(web.paths).toEqual(['/log/latest'])
    expect(ids(again.replies)).toEqual(['r1', 'r2'])
  })

  test('forgets the replies of commits the log no longer shows', async () => {
    let data = [raw('c1', null, 1, [raw('r1', 'c1')])]
    const web = app(() => ({ pages: { '/log/latest': { data, next: null } } }))
    const first = await refresh(web, 'latest')
    data = [raw('c2')]

    expect((await refresh(web, 'latest', first)).replies).toEqual([])
  })

  test('says why the log could not be loaded, and keeps what it showed', async () => {
    let failing = false
    const web = app(() => {
      if (failing) {
        throw new WebAppError('HTTP 429')
      }

      return { pages: { '/log/latest': { data: [raw('c1')], next: null } } }
    })
    const first = await refresh(web, 'latest')
    failing = true
    const again = await refresh(web, 'latest', first)

    expect(ids(again.commits)).toEqual(['c1'])
    expect(again.error).toBe('Could not load the latest log (HTTP 429).')
  })

  test('says when the log needs signing in', async () => {
    const web = app(() => {
      throw new SignInRequired()
    })

    expect((await refresh(web, 'following')).error).toBe(
      'Sign in again from the Account tab: the cookie no longer signs in to /dev/null.',
    )
  })

  test('says what went wrong when it is not the web app', async () => {
    const web = app(() => {
      throw new Error('socket hang up')
    })

    expect((await refresh(web, 'trending')).error).toBe('Could not load the trending log (socket hang up).')
  })
})

describe('reading a log kept from an earlier load', () => {
  test('takes a log of the current shape', async () => {
    const log = await refresh(app({ pages: { '/log/latest': { data: [raw('c1')], next: null } } }), 'latest')

    expect(current(log)).toEqual(log)
    expect(current(EMPTY)).toEqual(EMPTY)
  })

  test('drops a log of an older shape, for it to be loaded again', () => {
    const older = { commits: [{ id: 'c1', body: 'x', author: { username: 'a', name: 'A' } }], replies: [], next: null }

    expect(current({ ...older, error: '' })).toBeUndefined()
    expect(current({ ...EMPTY, replies: [{ id: 'r1' }] })).toBeUndefined()
    expect(current({ ...EMPTY, commits: [{ id: 'c1', segments: [], quote: null }] })).toBeUndefined()
    expect(current({ commits: 'none' })).toBeUndefined()
    expect(current(undefined)).toBeUndefined()
  })
})

describe('loading more of a log of the web app', () => {
  const site = {
    pages: {
      '/log/trending': { data: [raw('c1'), raw('c2')], next: 'n1' },
      '/log/trending?cursor=n1': { data: [raw('c2'), raw('c3', null, 1)], next: null },
    },
    replies: { c3: [raw('r3', 'c3')] },
  }

  test('adds the next page, with its replies, after what the log shows', async () => {
    const web = app(site)
    const log = await more(web, 'trending', await refresh(web, 'trending'))

    expect(ids(log.commits)).toEqual(['c1', 'c2', 'c3'])
    expect(ids(log.replies)).toEqual(['r3'])
    expect(log.next).toBeNull()
  })

  test('loads nothing more once the log ends', async () => {
    const web = app(site)
    const ended = { ...EMPTY, next: null }

    expect(await more(web, 'trending', ended)).toEqual(ended)
    expect(web.paths).toEqual([])
  })

  test('says why the next page could not be loaded, and keeps what it showed', async () => {
    const web = app(site)
    const first = await refresh(web, 'trending')
    const log = await more(web, 'trending', { ...first, next: 'gone' })

    expect(ids(log.commits)).toEqual(['c1', 'c2'])
    expect(log.next).toBe('gone')
    expect(log.error).toBe('Could not load the trending log (HTTP 404).')
  })
})

describe('keeping a log within a budget', () => {
  const site = {
    pages: { '/log/latest': { data: [raw('c1', null, 1), raw('c2', null, 1), raw('c3', null, 1)], next: 'n1' } },
    replies: { c1: [raw('r1', 'c1')], c2: [raw('r2', 'c2')], c3: [raw('r3', 'c3')] },
  }
  const bytes = (log: WebLog) => new TextEncoder().encode(JSON.stringify(log)).length

  test('keeps a log that fits as it is', async () => {
    const log = await refresh(app(site), 'latest')

    expect(within(log, bytes(log))).toEqual(log)
  })

  test('leaves out its last commits, with their replies, until it fits, and the pages after them', async () => {
    const log = await refresh(app(site), 'latest')
    const kept = within(log, bytes(log) - 1)

    expect(ids(kept?.commits ?? [])).toEqual(['c1', 'c2'])
    expect(ids(kept?.replies ?? [])).toEqual(['r1', 'r2'])
    expect(kept?.next).toBeNull()
    expect(bytes(kept ?? EMPTY)).toBeLessThan(bytes(log))
  })

  test('counts the bytes of what it keeps, not its characters', async () => {
    const log = await refresh(app({ pages: { '/log/latest': { data: [raw('c1'), raw('ç2')], next: null } } }), 'latest')
    const characters = JSON.stringify(log).length

    expect(ids(within(log, characters)?.commits ?? [])).toEqual(['c1'])
  })

  test('keeps nothing of a log whose first commit does not fit', async () => {
    const log = await refresh(app(site), 'latest')

    expect(within(log, 10)).toBeUndefined()
  })
})
