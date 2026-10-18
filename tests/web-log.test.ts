import { describe, expect, test } from 'claude-code/testing'

import type { Page, Visit, WebApp } from '../hooks/infrastructure/web-app'
import { SignInRequired, WebAppError } from '../hooks/infrastructure/web-app'
import { readLog } from '../hooks/infrastructure/web-log'

type Raw = Record<string, unknown>

function raw(id: string, extra: Raw = {}): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-17T10:00:00.000000Z',
    parent_id: null,
    user: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
    reply_preview: { data: [], next_cursor: null, prev_cursor: null },
    ...extra,
  }
}

/** A web app answering every visit with `props`, recording each in `visits`. */
function app(props: Record<string, unknown> | (() => never)): WebApp & { visits: [string, Visit | undefined][] } {
  const visits: [string, Visit | undefined][] = []
  const visit = async (path: string, options?: Visit): Promise<Page> => {
    visits.push([path, options])

    return { component: 'log/show', props: typeof props === 'function' ? props() : props, url: path, version: 'v1' }
  }

  return { visit, json: async () => Promise.reject(new Error('not JSON')), visits }
}

function page(data: unknown[], next: string | null = null): Record<string, unknown> {
  return { errors: {}, commits: { data, next_cursor: next, prev_cursor: null, per_page: 20 } }
}

describe('reading a log of the web app', () => {
  test('asks for the commits of the log only', async () => {
    const web = app(page([]))
    await readLog(web, 'trending')

    expect(web.visits).toEqual([['/log/trending', { partial: { component: 'log/show', props: ['commits'] } }]])
  })

  test('asks for the commits after a cursor', async () => {
    const web = app(page([]))
    await readLog(web, 'latest', { cursor: 'eyJ+/=' })

    expect(web.visits[0]?.[0]).toBe('/log/latest?cursor=eyJ%2B%2F%3D')
  })

  test('reads the commits in the order of the log, and where it goes on', async () => {
    const log = await readLog(app(page([raw('c2'), raw('c1'), raw('c3')], 'next')), 'trending')

    expect(log.commits.map(found => found.id)).toEqual(['c2', 'c1', 'c3'])
    expect(log.next).toBe('next')
  })

  test('says when the log ends', async () => {
    expect((await readLog(app(page([raw('c1')])), 'latest')).next).toBeNull()
  })

  test('reads the replies the log shows under its commits', async () => {
    const preview = { data: [raw('r1', { parent_id: 'c1' })], next_cursor: null, prev_cursor: null }
    const log = await readLog(app(page([raw('c1', { reply_preview: preview }), raw('c2')])), 'latest')

    expect(log.commits.map(found => found.id)).toEqual(['c1', 'c2'])
    expect(log.replies.map(found => [found.id, found.parentId])).toEqual([['r1', 'c1']])
  })

  test('leaves out what is not a commit', async () => {
    const log = await readLog(app(page([raw('c1'), { id: 'c2' }, null])), 'latest')

    expect(log.commits.map(found => found.id)).toEqual(['c1'])
  })

  test('says so when the page has no log', async () => {
    await expect(readLog(app({ errors: {} }), 'latest')).rejects.toBeInstanceOf(WebAppError)
    await expect(readLog(app({ commits: { data: 'none' } }), 'latest')).rejects.toBeInstanceOf(WebAppError)
  })

  test('lets the web app say the log needs signing in', async () => {
    const web = app(() => {
      throw new SignInRequired()
    })

    await expect(readLog(web, 'following')).rejects.toBeInstanceOf(SignInRequired)
  })
})
