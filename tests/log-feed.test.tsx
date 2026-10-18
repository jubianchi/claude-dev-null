import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { WORDMARK } from '../hooks/components/body'
import type { Raw, Site, WebRequest } from './support'
import { COOKIE, log, mountLog, SIGNED_IN, surface, webCommit, webSite } from './support'

const SIGNED = { cookie: COOKIE, username: SIGNED_IN }

async function opened($: Engine) {
  await log($)

  return mountLog($, 'terminal')
}

async function keys(pane: Awaited<ReturnType<typeof opened>>): Promise<string[]> {
  return (await pane.findAll({})).map(element => element.key ?? '')
}

function following(data: Raw[], next?: string): Site['pages'] {
  return { '/log/following': next === undefined ? { data } : { data, next } }
}

function loads(requests: readonly WebRequest[], path: string): number {
  return requests.filter(request => request.url === `https://dev-null.sh${path}`).length
}

describe('the following log', () => {
  test('is the log the pane opens on', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, { pages: following([webCommit('c1')]) })
    const all = await keys(await opened($))

    expect(all.indexOf('tab-following')).toBeLessThan(all.indexOf('tab-latest'))
    expect(all).toContain('commit-c1')
  })

  test('is not read while no one is signed in', async ($, on) => {
    surface(on, { autoRefresh: true })
    const requests = webSite(on, { pages: { ...following([webCommit('c1')]), '/log/latest': { data: [] } } })
    const pane = await opened($)

    expect(await pane.find({ key: 'tab-following' })).toBeUndefined()
    expect(loads(requests, '/log/following')).toBe(0)
  })

  test('reads the commits of the people followed, signed in with the cookie', async ($, on) => {
    surface(on, SIGNED)
    const requests = webSite(on, { pages: following([webCommit('c1')]) })
    await opened($)

    expect(requests.find(request => request.url === 'https://dev-null.sh/log/following')?.headers.Cookie).toBe(COOKIE)
  })

  test('says so when the cookie no longer signs in', async ($, on) => {
    surface(on, { cookie: 'remember_web_0123abcd=ended', username: SIGNED_IN })
    webSite(on, { pages: following([webCommit('c1')]) })
    const pane = await opened($)

    expect((await pane.find({ key: 'log-error' }))?.text).toContain('Sign in again from the Account tab')
  })

  test('is read again once signed in, and forgotten once signed out', async ($, on) => {
    surface(on)
    webSite(on, { pages: following([webCommit('c1')]) })
    const pane = await opened($)
    await pane.press({ key: 'tab-account' })
    await pane.input({ key: 'cookie', text: COOKIE })
    await pane.press({ key: 'tab-following' })

    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    await pane.press({ key: 'tab-account' })
    await pane.press({ key: 'sign-out' })

    expect(await pane.find({ key: 'tab-following' })).toBeUndefined()
  })

  test('gives way to latest when signing out from it', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, { pages: { ...following([webCommit('c1')]), '/log/latest': { data: [webCommit('l1')] } } })
    const pane = await opened($)
    await pane.press({ key: 'tab-account' })
    await pane.press({ key: 'sign-out' })
    await pane.press({ key: 'tab-latest' })

    expect(await pane.find({ key: 'commit-l1' })).toBeDefined()
  })

  test('shows what a commit says, who wrote it and when', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, { pages: following([webCommit('c1', { stars_count: 2, replies_count: 1 })]) })
    const shown = (await (await opened($)).find({ key: 'commit-c1' }))?.text ?? ''

    expect(shown).toContain('nunomaduro name')
    expect(shown).toContain('@nunomaduro · 42m')
    expect(shown).toContain('body of c1')
    expect(shown).toContain('⭐️ 2')
    expect(shown).toContain('💬 1')
  })

  test('draws the text of a commit as /dev/null does, with its links, mentions and code', async ($, on) => {
    surface(on, SIGNED)
    const body_segments = [
      { type: 'text', text: 'Ask @brendt about ' },
      { type: 'code', code: 'php artisan test' },
      { type: 'text', text: ' on /dev/null *now*' },
    ]
    webSite(on, { pages: following([webCommit('c1', { body_segments })]) })
    const pane = await opened($)
    const body = await pane.find({ key: 'body-c1-0' })

    expect(body?.text).toBe('Ask @brendt about php artisan test on /dev/null *now*')
    expect((await pane.find({ type: 'Link', text: '@brendt' }))?.props.href).toBe('https://dev-null.sh/@brendt')
    const texts = await pane.findAll({ type: 'Text' })

    expect(texts.some(found => found.text === 'php artisan test' && found.props.mono === true)).toBe(true)
    expect(texts.some(found => found.text === '/' && found.props.color === WORDMARK)).toBe(true)
  })

  test('draws a block of code in its language, under its name', async ($, on) => {
    surface(on, SIGNED)
    const body_segments = [
      { type: 'text', text: 'tia running this:\n' },
      { type: 'block', language: 'shell', html: '  Tests: <span class="hl-number">2194</span> passed' },
      { type: 'text', text: 'fast!' },
    ]
    webSite(on, { pages: following([webCommit('c1', { body_segments })]) })
    const pane = await opened($)
    const block = await pane.find({ key: 'block-c1-1' })
    const code = (await pane.findAll({ type: 'Code' }))[0]

    expect(block?.text).toContain('shell')
    expect(code?.props).toMatchObject({ source: '  Tests: 2194 passed', language: 'shell' })
    expect((await pane.find({ key: 'body-c1-2' }))?.text).toBe('fast!')
  })

  test('shows the commit a commit quotes, in a card', async ($, on) => {
    surface(on, SIGNED)
    const quoted_commit = webCommit('q1', { body: 'Had Claude cook up some stats' }, 'camilleislasse')
    webSite(on, { pages: following([webCommit('c1', { quoted_commit })]) })
    const card = (await (await opened($)).find({ key: 'quote-c1' }))?.text ?? ''

    expect(card).toContain('camilleislasse name')
    expect(card).toContain('@camilleislasse')
    expect(card).toContain('Had Claude cook up some stats')
  })

  test('names the images of the commit a commit quotes', async ($, on) => {
    surface(on, SIGNED)
    const images = [{ id: 'i1', url: 'https://dev-null.sh/commit-images/i1', width: 1200, height: 675 }]
    const quoted_commit = webCommit('q1', { images }, 'camilleislasse')
    webSite(on, { pages: following([webCommit('c1', { quoted_commit })]) })
    const pane = await opened($)

    expect((await pane.find({ key: 'quote-c1' }))?.text).toContain('[image 1200×675]')
    expect((await pane.find({ type: 'Link', text: '[image 1200×675]' }))?.props.href).toBe(
      'https://dev-null.sh/commit-images/i1',
    )
  })

  test('shows the results of a poll, and what was voted for', async ($, on) => {
    surface(on, SIGNED)
    const poll = {
      closes_at: '2026-10-16T11:00:00Z',
      is_closed: true,
      has_voted: true,
      total_votes: 3,
      options: [
        { label: 'Rust :crab:', votes_count: 2, voted: true },
        { label: 'Go', votes_count: 1, voted: false },
      ],
    }
    webSite(on, { pages: following([webCommit('c1', { poll })]) })
    const pane = await opened($)
    const shown = (await pane.find({ key: 'poll-c1' }))?.text ?? ''

    expect(shown).toContain(`${'█'.repeat(20)}${'░'.repeat(10)} 67% Rust 🦀 ✓`)
    expect(shown).toContain('33% Go')
    expect(shown).toContain('Final results · 3 votes')
    expect(await pane.find({ type: 'Link', text: 'Vote on dev-null.sh' })).toBeUndefined()
  })

  test('shows the options of a poll still open, and where to vote in it', async ($, on) => {
    surface(on, SIGNED)
    const poll = {
      closes_at: '2026-10-19T11:00:00Z',
      is_closed: false,
      has_voted: false,
      total_votes: null,
      options: [
        { label: 'Yes', votes_count: null, voted: false },
        { label: 'No', votes_count: null, voted: false },
      ],
    }
    webSite(on, { pages: following([webCommit('c1', { poll })]) })
    const pane = await opened($)
    const shown = (await pane.find({ key: 'poll-c1' }))?.text ?? ''

    expect(shown).toContain('○ Yes')
    expect(shown).toContain('○ No')
    expect(shown).toContain('2d left')
    expect((await pane.find({ type: 'Link', text: 'Vote on dev-null.sh' }))?.props.href).toBe(
      'https://dev-null.sh/@nunomaduro/commits/c1',
    )
  })

  test('shows the card of a link', async ($, on) => {
    surface(on, SIGNED)
    const link_preview = { url: 'https://example.com', title: 'Example', description: 'An example', site_name: 'Site' }
    webSite(on, { pages: following([webCommit('c1', { link_preview })]) })
    const card = (await (await opened($)).find({ key: 'preview-c1' }))?.text ?? ''

    expect(card).toContain('Site')
    expect(card).toContain('Example')
    expect(card).toContain('An example')
  })

  test('names the images of a commit', async ($, on) => {
    surface(on, SIGNED)
    const images = [{ id: 'i1', url: 'https://dev-null.sh/commit-images/i1', width: 800, height: 600 }]
    webSite(on, { pages: following([webCommit('c1', { images })]) })

    expect((await (await opened($)).find({ key: 'images-c1' }))?.text).toContain('[image 800×600]')
  })

  test('puts a reply to a reply right under it, one level right, down to the third', async ($, on) => {
    surface(on, SIGNED)
    const reply = (id: string, parent: string, at: string, replies = 0) =>
      webCommit(id, { parent_id: parent, created_at: at, replies_count: replies })
    webSite(on, {
      pages: following([webCommit('c1', { replies_count: 2 })]),
      replies: {
        c1: [reply('r1', 'c1', '2026-10-17T09:00:00Z', 1), reply('r2', 'c1', '2026-10-17T10:00:00Z')],
        r1: [reply('r3', 'r1', '2026-10-17T10:30:00Z', 1)],
        r3: [reply('r4', 'r3', '2026-10-17T10:40:00Z', 1)],
        r4: [reply('r5', 'r4', '2026-10-17T10:50:00Z')],
      },
    })
    const pane = await opened($)
    const all = await keys(pane)
    const order = ['r2', 'r1', 'r3', 'r4', 'r5']
    const indent = async (id: string) => (await pane.find({ key: `nest-${id}` }))?.props.paddingLeft

    expect(order.map(id => all.indexOf(`reply-${id}`))).toEqual(
      order.map(id => all.indexOf(`reply-${id}`)).sort((a, b) => a - b),
    )
    expect(all).toContain('reply-r5')
    expect(await Promise.all(order.map(indent))).toEqual([0, 0, 2, 4, 4])
  })

  test('keeps the actions of a reply on the right', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, {
      pages: following([
        webCommit('c1', { replies_count: 1, reply_preview: { data: [webCommit('r1', { parent_id: 'c1' })] } }),
      ]),
    })

    expect((await (await opened($)).find({ key: 'reply-r1' }))?.props.flexGrow).toBe(1)
  })
})

describe('loading the log', () => {
  function held() {
    let release: () => void = () => undefined
    const until = new Promise<void>(resolve => {
      release = resolve
    })

    return { until, release }
  }

  test('shows a loader while the log loads, then its commits', async ($, on) => {
    surface(on)
    const { until, release } = held()
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } }, until })
    const opening = log($)
    const pane = await mountLog($, 'terminal')

    expect(await pane.find({ key: 'log-loading' })).toBeDefined()
    expect(await pane.find({ key: 'log-empty' })).toBeUndefined()

    release()
    await opening
    await pane.redraw()

    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
  })

  test('says the log is empty once loaded with no commits', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/latest': { data: [] } } })
    const pane = await opened($)

    expect((await pane.find({ key: 'log-empty' }))?.text).toContain('No commits yet.')
    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()
  })

  test('centers More at the end of the log', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')], next: 'n1' } } })
    const pane = await opened($)
    const row = await pane.find({ key: 'more-row' })

    expect(row?.props.justifyContent).toBe('center')
    expect((await pane.findAll({ key: 'more' })).length).toBe(1)
  })

  test('greys More out and shows a loader beside it while the next page loads', async ($, on) => {
    surface(on)
    const { until, release } = held()
    const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')], next: 'n1' } } }
    const requests = webSite(on, site)
    const pane = await opened($)
    site.pages = { ...site.pages, '/log/latest?cursor=n1': { data: [webCommit('c2')] } }
    site.until = until
    const pressing = pane.press({ key: 'more' })
    await pane.redraw()

    expect((await pane.find({ key: 'more' }))?.props.dimColor).toBe(true)
    expect((await pane.find({ key: 'more-row' }))?.text).toContain('Loading')
    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    const asked = loads(requests, '/log/latest?cursor=n1')
    await pane.press({ key: 'more' })

    expect(loads(requests, '/log/latest?cursor=n1')).toBe(asked)

    release()
    await pressing
    await pane.redraw()

    expect((await pane.find({ key: 'more-row' }))?.text ?? '').not.toContain('Loading')
    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
  })

  test('greys refresh out and shows a loader beside it while the log loads again', async ($, on) => {
    surface(on)
    const { until, release } = held()
    const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')] } } }
    const requests = webSite(on, site)
    const pane = await opened($)
    site.until = until
    const pressing = pane.press({ key: 'refresh' })
    await pane.redraw()

    expect((await pane.find({ key: 'refresh' }))?.props.dimColor).toBe(true)
    expect((await pane.find({ key: 'tabs' }))?.text).toContain('Loading')
    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    await pane.press({ key: 'refresh' })

    expect(loads(requests, '/log/latest')).toBe(2)

    release()
    await pressing
    await pane.redraw()

    expect((await pane.find({ key: 'refresh' }))?.props.dimColor).toBeFalsy()
    expect((await pane.find({ key: 'tabs' }))?.text).not.toContain('Loading')
  })
})

describe('the actions of the log', () => {
  const ID = '01a14bab-0ec6-734a-91a3-8008640033a0'
  const URL = `https://dev-null.sh/@nunomaduro/commits/${ID}`

  test('the count of replies puts the commit in the reply field of the composer', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, { pages: following([webCommit(ID, { replies_count: 4 })]) })
    const pane = await opened($)
    const count = await pane.find({ key: `reply-to-${ID}` })
    await pane.press({ key: `reply-to-${ID}` })

    expect(count?.type).toBe('Button')
    expect(count?.text).toBe('💬 4')
    expect((await pane.find({ key: 'reply' }))?.props.value).toBe('40033a0')
  })

  test('a reply can be replied to, from its count of replies', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, {
      pages: following([
        webCommit('c1', { replies_count: 1, reply_preview: { data: [webCommit('r1', { parent_id: 'c1' })] } }),
      ]),
    })
    const pane = await opened($)
    await pane.press({ key: 'reply-to-r1' })

    expect((await pane.find({ key: 'reply' }))?.props.value).toBe('r1')
  })

  test('the username of an author links to their profile, in a commit and in the commit it quotes', async ($, on) => {
    surface(on, SIGNED)
    const quoted_commit = webCommit('q1', {}, 'camilleislasse')
    webSite(on, { pages: following([webCommit(ID, { quoted_commit })]) })
    const pane = await opened($)

    expect((await pane.find({ type: 'Link', text: '@nunomaduro' }))?.props.href).toBe('https://dev-null.sh/@nunomaduro')
    expect((await pane.find({ type: 'Link', text: '@camilleislasse' }))?.props.href).toBe(
      'https://dev-null.sh/@camilleislasse',
    )
  })

  test('the hash of a commit links to it, in place of a button', async ($, on) => {
    surface(on, SIGNED)
    webSite(on, { pages: following([webCommit(ID)]) })
    const pane = await opened($)

    expect((await pane.find({ type: 'Link', text: '40033a0' }))?.props.href).toBe(URL)
    expect(await pane.find({ key: `link-${ID}` })).toBeUndefined()
  })
})

describe('refreshing the log', () => {
  const MINUTE = 60_000

  test('↻ loads the log shown again', async ($, on) => {
    surface(on, SIGNED)
    const site: Site = { pages: following([webCommit('c1')]) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following([webCommit('c2'), webCommit('c1')])
    await pane.press({ key: 'refresh' })

    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
  })

  test('does not refresh on its own at first', async ($, on) => {
    const { clock } = surface(on, SIGNED)
    const requests = webSite(on, { pages: following([]) })
    const pane = await opened($)
    await clock.advance(10 * MINUTE)

    expect(loads(requests, '/log/following')).toBe(1)
    expect((await pane.find({ key: 'auto' }))?.props.label).toBe('auto 🔴')
  })

  test('refreshes every minute once auto is on, and keeps it on for the next sessions', async ($, on) => {
    const { clock, store } = surface(on, SIGNED)
    const requests = webSite(on, { pages: following([]) })
    const pane = await opened($)
    await pane.press({ key: 'auto' })
    await clock.advance(MINUTE)
    await clock.advance(MINUTE)

    expect(loads(requests, '/log/following')).toBe(3)
    expect(store.get('autoRefresh')).toBe(true)
    expect((await pane.find({ key: 'auto' }))?.props.label).toBe('auto 🟢 60s')
  })

  test('counts down to the next refresh, second by second, from a minute', async ($, on) => {
    const { clock } = surface(on, { ...SIGNED, autoRefresh: true })
    webSite(on, { pages: following([]) })
    const pane = await opened($)
    const label = async () => (await pane.find({ key: 'auto' }))?.props.label

    expect(await label()).toBe('auto 🟢 60s')

    await clock.advance(15_000)
    await pane.redraw()

    expect(await label()).toBe('auto 🟢 45s')

    await clock.advance(45_000)
    await pane.redraw()

    expect(await label()).toBe('auto 🟢 60s')
  })

  test('counts down to nothing once auto is off', async ($, on) => {
    surface(on, { ...SIGNED, autoRefresh: true })
    webSite(on, { pages: following([]) })
    const pane = await opened($)
    await pane.press({ key: 'auto' })

    expect((await pane.find({ key: 'auto' }))?.props.label).toBe('auto 🔴')
  })

  test('refreshes on its own when auto was left on', async ($, on) => {
    const { clock } = surface(on, { ...SIGNED, autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    await opened($)
    await clock.advance(MINUTE)

    expect(loads(requests, '/log/following')).toBe(2)
  })

  test('refreshes the log shown', async ($, on) => {
    const { clock } = surface(on, { ...SIGNED, autoRefresh: true })
    const requests = webSite(on, { pages: { ...following([]), '/log/latest': { data: [] } } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    await clock.advance(MINUTE)

    expect(loads(requests, '/log/following')).toBe(1)
    expect(loads(requests, '/log/latest')).toBe(2)
  })

  test('stops refreshing once auto is off', async ($, on) => {
    const { clock, store } = surface(on, { ...SIGNED, autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    const pane = await opened($)
    await pane.press({ key: 'auto' })
    await clock.advance(10 * MINUTE)

    expect(loads(requests, '/log/following')).toBe(1)
    expect(store.get('autoRefresh')).toBe(false)
  })

  test('stops refreshing once the log is closed', async ($, on) => {
    const { clock } = surface(on, { ...SIGNED, autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    await opened($)
    await log($)
    await clock.advance(10 * MINUTE)

    expect(loads(requests, '/log/following')).toBe(1)
  })
})
