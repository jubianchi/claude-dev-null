import type { HttpInit, On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { log, mountLog, surface } from './support'

type Raw = Record<string, unknown>

function raw(id: string, extra: Raw = {}): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-17T10:18:00.000000Z',
    parent_id: null,
    replies_count: 0,
    stars_count: 1,
    user: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 2 },
    reply_preview: { data: [], next_cursor: null, prev_cursor: null },
    link_preview: null,
    images: [],
    ...extra,
  }
}

type Request = { url: string; init?: HttpInit }

/**
 * Answers the web app: its log pages by path (and query) from `pages`, the replies of its commits from `replies`, and
 * 500 for the paths of `failing`; the API answers no one. Records each request.
 */
function webApp(
  on: On,
  pages: Record<string, { data: Raw[]; next?: string }>,
  replies: Record<string, Raw[]> = {},
  failing: string[] = [],
): Request[] {
  const requests: Request[] = []

  on('http.fetch', (_$, e) => {
    requests.push({ url: e.url, init: e.init })
    const url = new URL(e.url)
    const path = `${url.pathname}${url.search}`
    const answer = (status: number, body: unknown) => ({
      value: {
        status,
        ok: status === 200,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify(body),
      },
    })

    if (failing.includes(path)) {
      return answer(500, { message: 'Server Error' })
    }

    const [, kind, id] = url.pathname.split('/')

    if (kind === 'commits') {
      return answer(200, { data: replies[id ?? ''] ?? [], next_cursor: null })
    }

    const page = pages[path]

    return page === undefined
      ? answer(404, { message: 'Not Found' })
      : answer(200, {
          component: 'log/show',
          props: { commits: { data: page.data, next_cursor: page.next ?? null } },
          url: url.pathname,
          version: 'v1',
        })
  })

  return requests
}

async function opened($: Engine) {
  await log($)

  return mountLog($, 'terminal')
}

async function keys(pane: Awaited<ReturnType<typeof opened>>): Promise<string[]> {
  return (await pane.findAll({})).map(element => element.key ?? '')
}

describe('the logs of the web app', () => {
  test('latest shows the latest commits, read from the web app as its pages do', async ($, on) => {
    surface(on)
    const requests = webApp(on, { '/log/latest': { data: [raw('c1'), raw('c2')] } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    const all = await keys(pane)

    expect(all.indexOf('commit-c2')).toBeGreaterThan(all.indexOf('commit-c1'))
    expect((await pane.find({ key: 'commit-c1' }))?.text).toContain('body of c1')
    expect(requests.find(request => request.url === 'https://dev-null.sh/log/latest')?.init?.headers).toMatchObject({
      'X-Inertia': 'true',
      'X-Inertia-Partial-Data': 'commits',
    })
  })

  test('trending keeps the order of the web app', async ($, on) => {
    surface(on)
    webApp(on, {
      '/log/trending': {
        data: [raw('c1', { created_at: '2026-10-17T08:00:00Z' }), raw('c2', { created_at: '2026-10-17T10:00:00Z' })],
      },
    })
    const pane = await opened($)
    await pane.press({ key: 'tab-trending' })
    const all = await keys(pane)

    expect(all.indexOf('commit-c2')).toBeGreaterThan(all.indexOf('commit-c1'))
  })

  test('shows the replies under their commit', async ($, on) => {
    surface(on)
    webApp(
      on,
      { '/log/latest': { data: [raw('c1', { replies_count: 2 })] } },
      {
        c1: [raw('r1', { parent_id: 'c1', replies_count: 1 }), raw('r2', { parent_id: 'c1' })],
        r1: [raw('r3', { parent_id: 'r1' })],
      },
    )
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    const all = await keys(pane)

    expect(['commit-c1', 'reply-r1', 'reply-r3', 'reply-r2'].map(key => all.indexOf(key))).toEqual(
      ['commit-c1', 'reply-r1', 'reply-r3', 'reply-r2'].map(key => all.indexOf(key)).sort((a, b) => a - b),
    )
    expect(all).toContain('reply-r3')
  })

  test('draws each developer in the lane they picked', async ($, on) => {
    surface(on)
    webApp(on, { '/log/latest': { data: [raw('c1')] } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })

    expect((await pane.find({ key: 'commit-c1' }))?.props.borderColor).toBe('#da77f2')
  })

  test('more loads the next page of the log, after what it shows', async ($, on) => {
    surface(on)
    const requests = webApp(on, {
      '/log/latest': { data: [raw('c1')], next: 'n1' },
      '/log/latest?cursor=n1': { data: [raw('c2')] },
    })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    await pane.press({ key: 'more' })
    const all = await keys(pane)

    expect(requests.map(request => request.url)).toContain('https://dev-null.sh/log/latest?cursor=n1')
    expect(all.indexOf('commit-c2')).toBeGreaterThan(all.indexOf('commit-c1'))
    expect(all).not.toContain('more')
  })

  test('says why the log could not be loaded', async ($, on) => {
    surface(on)
    webApp(on, {}, {}, ['/log/latest'])
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })

    expect((await pane.find({ key: 'log-error' }))?.text).toContain('Could not load the latest log (HTTP 500).')
  })

  test('says when the log has no commits yet', async ($, on) => {
    surface(on)
    webApp(on, { '/log/latest': { data: [] } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })

    expect((await pane.find({ key: 'log-body' }))?.text).toContain('No commits yet.')
  })

  test('↻ loads the log shown again', async ($, on) => {
    surface(on)
    const requests = webApp(on, { '/log/trending': { data: [raw('c1')] } })
    const pane = await opened($)
    await pane.press({ key: 'tab-trending' })
    await pane.press({ key: 'refresh' })

    expect(requests.filter(request => request.url === 'https://dev-null.sh/log/trending')).toHaveLength(2)
  })

  test('sends no cookie', async ($, on) => {
    surface(on)
    const requests = webApp(on, { '/log/latest': { data: [raw('c1')] } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })

    expect(requests.some(request => request.init?.headers?.Cookie !== undefined)).toBe(false)
  })
})
