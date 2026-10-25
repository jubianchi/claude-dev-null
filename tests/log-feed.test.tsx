import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { WORDMARK } from '../hooks/components/body'
import { commit } from '../hooks/infrastructure/web-commit'
import { LANES } from '../hooks/log'
import { FRAME_EVERY, FRAMES } from '../hooks/spinner'
import { seal } from '../hooks/versioned'
import type { Raw, Site, WebRequest } from './support'
import {
  DEVICE_KEY,
  held,
  LOG_PANE,
  log,
  mountLog,
  SIGNATURE,
  SIGNED_IN,
  signedIn,
  surface,
  webCommit,
  webSite,
} from './support'

/**
 * How long a test that moves the clock 30 seconds on while a log loads may take: the pane draws each of the spinner's
 * 250 frames, which takes a few seconds on a slow runner, over the 5 a test is given.
 */
const SPINNING_30S = 20_000

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
    signedIn(on)
    webSite(on, { pages: following([webCommit('c1')]) })
    const all = await keys(await opened($))

    expect(all.indexOf('tab-following')).toBeLessThan(all.indexOf('tab-latest'))
    expect(all).toContain('commit-c1')
  })

  test('reads Latest and Trending from the API too once the device is approved, from the web app before', async ($, on) => {
    signedIn(on)
    const pages = { '/log/latest': { data: [webCommit('l1')] }, '/log/trending': { data: [webCommit('t1')] } }
    const requests = webSite(on, { pages: { ...following([webCommit('c1')]), ...pages } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    await pane.press({ key: 'tab-trending' })

    expect(await pane.find({ key: 'commit-t1' })).toBeDefined()
    expect(loads(requests, '/api/v1/log/latest')).toBe(1)
    expect(loads(requests, '/api/v1/log/trending')).toBe(1)
    expect(loads(requests, '/log/latest') + loads(requests, '/log/trending')).toBe(0)
  })

  test('reads Latest from the web app while no one approved the device', async ($, on) => {
    surface(on)
    const requests = webSite(on, { pages: { '/log/latest': { data: [webCommit('l1')] } } })
    const pane = await opened($)

    expect(await pane.find({ key: 'commit-l1' })).toBeDefined()
    expect(loads(requests, '/log/latest')).toBe(1)
    expect(requests.some(request => request.url.includes('/api/'))).toBe(false)
  })

  test('is not read while no one is signed in', async ($, on) => {
    surface(on, { autoRefresh: true })
    const requests = webSite(on, { pages: { ...following([webCommit('c1')]), '/log/latest': { data: [] } } })
    const pane = await opened($)

    expect(await pane.find({ key: 'tab-following' })).toBeUndefined()
    expect(loads(requests, '/api/v1/log/following')).toBe(0)
  })

  test('reads the commits of the people followed from the API, as the device approved, with no cookie', async ($, on) => {
    signedIn(on)
    const requests = webSite(on, { pages: following([webCommit('c1')]) })
    await opened($)
    const read = requests.find(request => request.url === 'https://dev-null.sh/api/v1/log/following')

    expect(read?.headers['X-SSH-Signature']).toBe(SIGNATURE)
    expect(loads(requests, '/log/following')).toBe(0)
    expect(requests.some(request => 'Cookie' in request.headers)).toBe(false)
  })

  test('says so when /dev/null no longer knows the device', async ($, on) => {
    surface(on, { deviceKey: seal(1, DEVICE_KEY), deviceUser: seal(1, SIGNED_IN) })
    on('process.run', () => ({
      value: { exitCode: 0, stdout: 'cmV2b2tlZA==\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    webSite(on, { pages: following([webCommit('c1')]) })
    const pane = await opened($)

    expect((await pane.find({ key: 'log-error' }))?.text).toContain('/dev/null no longer knows this device')
  })

  test('is forgotten once the approval of the device is', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: following([webCommit('c1')]) })
    const pane = await opened($)

    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    await pane.press({ key: 'settings' })
    await pane.press({ key: 'device-forget' })

    expect(await pane.find({ key: 'tab-following' })).toBeUndefined()
  })

  test('gives way to latest when signing out from it', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: { ...following([webCommit('c1')]), '/log/latest': { data: [webCommit('l1')] } } })
    const pane = await opened($)
    await pane.press({ key: 'settings' })
    await pane.press({ key: 'device-forget' })
    await pane.press({ key: 'tab-latest' })

    expect(await pane.find({ key: 'commit-l1' })).toBeDefined()
  })

  test('shows what a commit says, who wrote it and when', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: following([webCommit('c1', { stars_count: 2, replies_count: 1 })]) })
    const shown = (await (await opened($)).find({ key: 'commit-c1' }))?.text ?? ''

    expect(shown).toContain('nunomaduro name')
    expect(shown).toContain('@nunomaduro · 42m')
    expect(shown).toContain('body of c1')
    expect(shown).toContain('⭐️ 2')
    expect(shown).toContain('💬 1')
  })

  test('draws the text of a commit as /dev/null does, with its links, mentions and code', async ($, on) => {
    signedIn(on)
    const body_segments = [
      { type: 'text', text: 'Ask @brendt about ' },
      { type: 'code', code: 'php artisan test' },
      { type: 'text', text: ' on /dev/null *now*' },
    ]
    webSite(on, { pages: following([webCommit('c1', { body_segments, mentions: { brendt: '01a1-brendt' } })]) })
    const pane = await opened($)
    const body = await pane.find({ key: 'body-c1-0' })

    expect(body?.text).toBe('Ask @brendt about php artisan test on /dev/null *now*')
    expect((await pane.find({ type: 'Link', text: '@brendt' }))?.props.href).toBe(
      'https://dev-null.sh/mentions/01a1-brendt',
    )
    const texts = await pane.findAll({ type: 'Text' })

    expect(texts.some(found => found.text === 'php artisan test' && found.props.mono === true)).toBe(true)
    expect(texts.some(found => found.text === '/' && found.props.color === WORDMARK)).toBe(true)
  })

  test('draws a block of code in its language, under its name', async ($, on) => {
    signedIn(on)
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
    signedIn(on)
    const quoted_commit = webCommit('q1', { body: 'Had Claude cook up some stats' }, 'camilleislasse')
    webSite(on, { pages: following([webCommit('c1', { quoted_commit })]) })
    const card = (await (await opened($)).find({ key: 'quote-c1' }))?.text ?? ''

    expect(card).toContain('camilleislasse name')
    expect(card).toContain('@camilleislasse')
    expect(card).toContain('Had Claude cook up some stats')
  })

  test('names the images of the commit a commit quotes', async ($, on) => {
    signedIn(on)
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
    signedIn(on)
    const poll = {
      closes_at: '2026-10-16T11:00:00Z',
      is_closed: true,
      has_voted: true,
      total_votes: 3,
      options: [
        { id: 'o1', label: 'Rust :crab:', votes_count: 2, voted: true },
        { id: 'o2', label: 'Go', votes_count: 1, voted: false },
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

  test('shows the options of a poll still open, and where to vote in it, to whom approved no device', async ($, on) => {
    surface(on)
    const poll = {
      closes_at: '2026-10-19T11:00:00Z',
      is_closed: false,
      has_voted: false,
      total_votes: null,
      options: [
        { id: 'o1', label: 'Yes', votes_count: null, voted: false },
        { id: 'o2', label: 'No', votes_count: null, voted: false },
      ],
    }
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1', { poll })] } } })
    const pane = await opened($)
    const shown = (await pane.find({ key: 'poll-c1' }))?.text ?? ''

    expect(shown).toContain('○ Yes')
    expect(shown).toContain('○ No')
    expect(shown).toContain('2d left')
    expect((await pane.find({ type: 'Link', text: 'Vote on dev-null.sh' }))?.props.href).toBe(
      'https://dev-null.sh/@nunomaduro/commits/c1',
    )
    expect(await pane.find({ key: 'poll-option-c1-o1' })).toBeUndefined()
  })

  test('offers no vote in the polls of the person signed in, nor in those of the commits quoted', async ($, on) => {
    signedIn(on)
    const poll = {
      closes_at: '2026-10-19T11:00:00Z',
      is_closed: false,
      has_voted: false,
      total_votes: null,
      options: [{ id: 'o1', label: 'Yes', votes_count: null, voted: false }],
    }
    webSite(on, {
      pages: following([
        webCommit('c1', { poll }, SIGNED_IN.toUpperCase()),
        webCommit('c2', { quoted_commit: webCommit('q1', { poll }) }),
      ]),
    })
    const pane = await opened($)

    expect(await pane.find({ key: 'poll-c1' })).toBeDefined()
    expect(await pane.find({ key: 'poll-quote-q1' })).toBeDefined()
    expect(await pane.find({ type: 'Link', text: 'Vote on dev-null.sh' })).toBeUndefined()
  })

  test('shows the start of a long commit, and links to the whole of it, as /dev/null does', async ($, on) => {
    signedIn(on)
    const body_segments = [{ type: 'text', text: 'The start of it, then the rest' }]
    const preview_segments = [{ type: 'text', text: 'The start of it…' }]
    webSite(on, { pages: following([webCommit('c1', { body_segments, preview_segments }), webCommit('c2')]) })
    const pane = await opened($)

    expect((await pane.find({ key: 'body-c1-0' }))?.text).toBe('The start of it…')
    expect((await pane.find({ type: 'Link', text: 'Show more' }))?.props.href).toBe(
      'https://dev-null.sh/@nunomaduro/commits/c1',
    )
    expect((await pane.findAll({ type: 'Link', text: 'Show more' })).length).toBe(1)
  })

  test('shows the start of a quoted commit, its links as written and not linked, as /dev/null does', async ($, on) => {
    signedIn(on)
    const url = `https://example.com/${'a'.repeat(30)}`
    const quoted_commit = webCommit('q1', {
      body_segments: [{ type: 'text', text: `See ${url} and the rest` }],
      preview_segments: [{ type: 'text', text: `See ${url}…` }],
    })
    webSite(on, { pages: following([webCommit('c1', { quoted_commit })]) })
    const pane = await opened($)

    expect((await pane.find({ key: 'body-quote-q1-0' }))?.text).toBe(`See ${url}…`)
    expect(await pane.find({ type: 'Link', text: 'example.com/aaaaaaaaaaaaaaaaaaa…' })).toBeUndefined()
  })

  test('says when the commit quoted was deleted, or is out of sight, as /dev/null does', async ($, on) => {
    signedIn(on)
    webSite(on, {
      pages: following([
        webCommit('c1', {
          quoted_commit_id: 'q1',
          quoted_commit: { id: 'q1', parent_id: null, deleted_at: '2026-10-18' },
        }),
        webCommit('c2', { quoted_commit_id: 'q2', quoted_commit: null }),
        webCommit('c3', {
          replies_count: 1,
          reply_preview: { data: [webCommit('r1', { parent_id: 'c3', quoted_commit_id: 'q3' })], next_cursor: null },
        }),
      ]),
    })
    const pane = await opened($)

    expect((await pane.find({ key: 'quote-c1' }))?.text).toBe('[deleted] This commit was deleted.')
    expect((await pane.find({ key: 'quote-c2' }))?.text).toBe("[unavailable] This commit isn't available.")
    expect(await pane.find({ key: 'quote-r1' })).toBeUndefined()
  })

  test('shows the card of a link', async ($, on) => {
    signedIn(on)
    const link_preview = { url: 'https://example.com', title: 'Example', description: 'An example', site_name: 'Site' }
    webSite(on, { pages: following([webCommit('c1', { link_preview })]) })
    const card = (await (await opened($)).find({ key: 'preview-c1' }))?.text ?? ''

    expect(card).toContain('Site')
    expect(card).toContain('Example')
    expect(card).toContain('An example')
  })

  test('names the site of a link card after its host when it has no name, and draws none without a title', async ($, on) => {
    signedIn(on)
    webSite(on, {
      pages: following([
        webCommit('c1', { link_preview: { url: 'https://www.example.com/a', title: 'Example', site_name: null } }),
        webCommit('c2', { link_preview: { url: 'https://example.org', title: null, site_name: 'Site' } }),
      ]),
    })
    const pane = await opened($)

    expect((await pane.find({ key: 'preview-c1' }))?.text).toContain('example.com')
    expect(await pane.find({ key: 'preview-c2' })).toBeUndefined()
  })

  test('draws the parts of a commit in the order of /dev/null: words, images, poll, quote, link card', async ($, on) => {
    signedIn(on)
    const images = [{ id: 'i1', url: 'https://dev-null.sh/commit-images/i1', width: 800, height: 600 }]
    const poll = {
      closes_at: null,
      is_closed: false,
      has_voted: false,
      total_votes: null,
      options: [{ id: 'o1', label: 'A' }],
    }
    webSite(on, {
      pages: following([
        webCommit('c1', {
          images,
          poll,
          quoted_commit: webCommit('q1'),
          link_preview: { url: 'https://example.com', title: 'Example', site_name: 'Site' },
        }),
      ]),
    })
    const keys = (await (await opened($)).findAll({})).map(found => found.key ?? '')
    const order = ['body-c1-0', 'images-c1', 'poll-c1', 'quote-c1', 'preview-c1'].map(key => keys.indexOf(key))

    expect(order.every(index => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  test('names the images of a commit', async ($, on) => {
    signedIn(on)
    const images = [{ id: 'i1', url: 'https://dev-null.sh/commit-images/i1', width: 800, height: 600 }]
    webSite(on, { pages: following([webCommit('c1', { images })]) })

    expect((await (await opened($)).find({ key: 'images-c1' }))?.text).toContain('[image 800×600]')
  })

  test('puts a reply to a reply right under it, one level right, down to the third', async ($, on) => {
    signedIn(on)
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
    signedIn(on)
    webSite(on, {
      pages: following([
        webCommit('c1', { replies_count: 1, reply_preview: { data: [webCommit('r1', { parent_id: 'c1' })] } }),
      ]),
    })

    expect((await (await opened($)).find({ key: 'reply-r1' }))?.props.flexGrow).toBe(1)
  })

  test('scrolls one commit or reply at a time, a reply keeping the lane of what it replies to', async ($, on) => {
    signedIn(on)
    const reply = (id: string, parent: string, at: string, lane: number, replies = 0) =>
      webCommit(id, {
        parent_id: parent,
        created_at: at,
        replies_count: replies,
        user: { username: id, name: id, lane },
      })
    webSite(on, {
      pages: following([
        webCommit('c1', { replies_count: 1, user: { username: 'nunomaduro', name: 'Nuno', lane: 0 } }),
        ...['c2', 'c3', 'c4'].map(id => webCommit(id)),
      ]),
      replies: {
        c1: [reply('r1', 'c1', '2026-10-17T09:00:00Z', 4, 1)],
        r1: [reply('r2', 'r1', '2026-10-17T10:00:00Z', 2)],
      },
    })
    on('ui.scroll', () => ({}))
    const pane = await opened($)
    const tick = async (by: number) => {
      const scroll = { offset: 0, by, bodyRows: 30, contentRows: 100, origin: { kind: 'person' } } as const
      await $.ui.scroll({ component: 'Pane', requestId: LOG_PANE, ...scroll })
      await pane.redraw()
    }
    const lanes = async () =>
      (await pane.findAll({ type: 'Text' })).filter(found => found.text === '∟ ').map(found => found.props.color)

    await tick(1)
    const all = await keys(pane)

    expect(all).not.toContain('commit-c1')
    expect(all).toEqual(expect.arrayContaining(['reply-r1', 'reply-r2', 'commit-c2', 'commit-c3']))
    expect(all.indexOf('reply-r1')).toBeLessThan(all.indexOf('reply-r2'))
    expect(await lanes()).toEqual([LANES[0], LANES[4]])
    expect((await pane.find({ key: 'above' }))?.text).toBe('↑ 1 more')

    await tick(1)

    expect(await keys(pane)).not.toContain('reply-r1')
    expect(await keys(pane)).toContain('reply-r2')
    expect(await lanes()).toEqual([LANES[4]])
    expect((await pane.find({ key: 'above' }))?.text).toBe('↑ 2 more')

    await tick(-1)

    expect(await keys(pane)).toContain('reply-r1')
    expect(await keys(pane)).not.toContain('commit-c1')
  })
})

describe('loading the log', () => {
  test('shows a loader while the log loads, then its commits', async ($, on) => {
    surface(on)
    const { until, release } = held()
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } }, until })
    const opening = log($)
    const pane = await mountLog($, 'terminal')
    const loader = await pane.find({ key: 'log-loading' })

    expect(loader?.props).toMatchObject({ borderStyle: 'round', borderDimColor: true, justifyContent: 'center' })
    expect(loader?.text).toContain(`${FRAMES[0]} Loading…`)
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

  test('loads again a log an earlier load of the module left loading', async ($, on) => {
    surface(on)
    const { until, release } = held()
    const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')] } }, until }
    const requests = webSite(on, site)
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    const opening = log($)
    const pane = await mountLog($, 'terminal')
    await $.session.start({ surface: 'terminal', cwd: '/', isInteractive: true })
    site.until = undefined
    await pane.press({ key: 'tab-latest' })

    expect(loads(requests, '/log/latest')).toBe(2)
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    release()
    await opening
  })

  test('shows what a load of the module brings once it ends after the session started again', async ($, on) => {
    surface(on)
    const { until, release } = held()
    const requests = webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } }, until })
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    const opening = log($)
    const pane = await mountLog($, 'terminal')
    await $.session.start({ surface: 'terminal', cwd: '/', isInteractive: true })
    release()
    await opening
    await pane.redraw()

    expect(loads(requests, '/log/latest')).toBe(1)
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()
  })

  test(
    'stops waiting for a load that does not answer, after 30 seconds',
    { timeoutMs: SPINNING_30S },
    async ($, on) => {
      const { clock } = surface(on)
      const { until, release } = held()
      const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')] } }, until }
      const requests = webSite(on, site)
      const opening = log($)
      const pane = await mountLog($, 'terminal')
      site.until = undefined
      await pane.press({ key: 'tab-latest' })

      expect(loads(requests, '/log/latest')).toBe(1)

      await clock.advance(30_001)
      await pane.press({ key: 'tab-latest' })

      expect(loads(requests, '/log/latest')).toBe(2)
      expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

      release()
      await opening
    },
  )

  test('turns the spinner of the loader while the log loads', async ($, on) => {
    const { clock } = surface(on)
    const { until, release } = held()
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } }, until })
    const opening = log($)
    const pane = await mountLog($, 'terminal')
    await clock.advance(FRAME_EVERY)
    await pane.redraw()

    expect((await pane.find({ key: 'log-loading' }))?.text).toContain(`${FRAMES[1]} Loading…`)

    release()
    await opening
  })

  test('ends the log with More, centered in a box as wide as the log', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')], next: 'n1' } } })
    const pane = await opened($)
    const box = await pane.find({ key: 'more-box' })

    expect(box?.props).toMatchObject({ borderStyle: 'round', borderDimColor: true, justifyContent: 'center' })
    expect(box?.props.width).toBe('100%')
    expect(box?.text).toBe(' More ')
  })

  test('draws the loader in the box of More while the next page loads', async ($, on) => {
    surface(on)
    const { until, release } = held()
    const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')], next: 'n1' } } }
    webSite(on, site)
    const pane = await opened($)
    site.pages = { ...site.pages, '/log/latest?cursor=n1': { data: [webCommit('c2')] } }
    site.until = until
    const pressing = pane.press({ key: 'more' })
    await pane.redraw()

    expect((await pane.find({ key: 'more-box' }))?.text).toContain('Loading…')
    expect(await pane.find({ key: 'more' })).toBeUndefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    release()
    await pressing
    await pane.redraw()

    expect(await pane.find({ key: 'more-box' })).toBeUndefined()
    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
  })

  test('keeps the log shown while it loads again, loading it once at a time', async ($, on) => {
    surface(on)
    const { until, release } = held()
    const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')] } } }
    const requests = webSite(on, site)
    const pane = await opened($)
    site.until = until
    const pressing = pane.press({ key: 'tab-latest' })
    await pane.redraw()

    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()

    await pane.press({ key: 'tab-latest' })

    expect(loads(requests, '/log/latest')).toBe(2)

    release()
    await pressing
  })
})

describe('voting in a poll, as on /dev/null', () => {
  const C = '01a14bab-0ec6-734a-91a3-8008640033a0'
  const OPEN = {
    closes_at: '2026-10-19T11:00:00Z',
    is_closed: false,
    has_voted: false,
    total_votes: null,
    options: [
      { id: 'o1', label: 'Yes', votes_count: null, voted: false },
      { id: 'o2', label: 'No', votes_count: null, voted: false },
    ],
  }
  const VOTED = {
    ...OPEN,
    has_voted: true,
    total_votes: 3,
    options: [
      { id: 'o1', label: 'Yes', votes_count: 2, voted: true },
      { id: 'o2', label: 'No', votes_count: 1, voted: false },
    ],
  }
  const votes = (requests: readonly WebRequest[]) =>
    requests.filter(request => request.url === `https://dev-null.sh/api/v1/commits/${C}/poll/votes`)

  test('takes an option, then votes for it once Vote is pressed, and shows the results', async ($, on) => {
    signedIn(on)
    const requests = webSite(on, {
      pages: following([webCommit(C, { poll: OPEN })]),
      votes: { [C]: webCommit(C, { poll: VOTED }) },
    })
    const pane = await opened($)

    expect(await pane.find({ type: 'Button', key: `poll-vote-${C}` })).toBeUndefined()
    expect((await pane.find({ key: `poll-${C}` }))?.text).toContain('Vote')

    await pane.press({ key: `poll-option-${C}-o1` })

    expect((await pane.find({ key: `poll-${C}` }))?.text).toContain('● Yes')

    await pane.press({ key: `poll-vote-${C}` })
    const shown = (await pane.find({ key: `poll-${C}` }))?.text ?? ''

    expect(votes(requests).map(request => [request.method, request.body])).toEqual([['POST', '{"option":"o1"}']])
    expect(shown).toContain('67% Yes ✓')
    expect(await pane.find({ key: `poll-option-${C}-o1` })).toBeUndefined()
  })

  test('votes once, however fast Vote is pressed, and says it votes meanwhile', async ($, on) => {
    signedIn(on)
    const { until, release } = held()
    const site: Site = {
      pages: following([webCommit(C, { poll: OPEN })]),
      votes: { [C]: webCommit(C, { poll: VOTED }) },
    }
    const requests = webSite(on, site)
    const pane = await opened($)
    await pane.press({ key: `poll-option-${C}-o2` })
    site.until = until
    const first = pane.press({ key: `poll-vote-${C}` })
    const second = pane.press({ key: `poll-vote-${C}` })
    await pane.redraw()

    expect((await pane.find({ key: `poll-${C}` }))?.text).toContain('Voting…')

    release()
    await first
    await second

    expect(votes(requests).map(request => request.body)).toEqual(['{"option":"o2"}'])
  })

  test('says why /dev/null refused the vote, and keeps the option taken', async ($, on) => {
    signedIn(on)
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)

      return { value: undefined }
    })
    webSite(on, { pages: following([webCommit(C, { poll: OPEN })]) })
    const pane = await opened($)
    await pane.press({ key: `poll-option-${C}-o1` })
    await pane.press({ key: `poll-vote-${C}` })

    expect(toasts).toEqual(['This poll is closed.'])
    expect((await pane.find({ key: `poll-${C}` }))?.text).toContain('● Yes')
  })

  test('offers no vote in a poll voted in, closed, of the person signed in, or of a commit quoted', async ($, on) => {
    signedIn(on)
    const closed = { ...OPEN, closes_at: '2026-10-16T11:00:00Z' }
    webSite(on, {
      pages: following([
        webCommit('01a14bab-0ec6-734a-91a3-8008640033a1', { poll: VOTED }),
        webCommit('01a14bab-0ec6-734a-91a3-8008640033a2', { poll: closed }),
        webCommit('01a14bab-0ec6-734a-91a3-8008640033a3', { poll: OPEN }, SIGNED_IN),
        webCommit('01a14bab-0ec6-734a-91a3-8008640033a4', { quoted_commit: webCommit(C, { poll: OPEN }) }),
      ]),
    })
    const pane = await opened($)
    const buttons = (await pane.findAll({ type: 'Button' })).map(button => button.key ?? '')

    expect(buttons.filter(key => key.startsWith('poll-'))).toEqual([])
    expect(await pane.find({ type: 'Link', text: 'Vote on dev-null.sh' })).toBeUndefined()
  })
})

describe('the actions of the log', () => {
  const ID = '01a14bab-0ec6-734a-91a3-8008640033a0'
  const URL = `https://dev-null.sh/@nunomaduro/commits/${ID}`

  test('the count of replies puts the commit in the reply field of the composer', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: following([webCommit(ID, { replies_count: 4 })]) })
    const pane = await opened($)
    const count = await pane.find({ key: `reply-to-${ID}` })
    await pane.press({ key: `reply-to-${ID}` })

    expect(count?.type).toBe('Button')
    expect(count?.text).toBe('💬 4')
    expect((await pane.find({ key: 'reply' }))?.props.value).toBe('40033a0')
  })

  test('a reply can be replied to, from its count of replies', async ($, on) => {
    signedIn(on)
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
    signedIn(on)
    const quoted_commit = webCommit('q1', {}, 'camilleislasse')
    webSite(on, { pages: following([webCommit(ID, { quoted_commit })]) })
    const pane = await opened($)

    expect((await pane.find({ type: 'Link', text: '@nunomaduro' }))?.props.href).toBe('https://dev-null.sh/@nunomaduro')
    expect((await pane.find({ type: 'Link', text: '@camilleislasse' }))?.props.href).toBe(
      'https://dev-null.sh/@camilleislasse',
    )
  })

  test('the hash of a commit links to it, in place of a button', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: following([webCommit(ID)]) })
    const pane = await opened($)

    expect((await pane.find({ type: 'Link', text: '40033a0' }))?.props.href).toBe(URL)
    expect(await pane.find({ key: `link-${ID}` })).toBeUndefined()
  })
})

describe('refreshing the log', () => {
  const MINUTE = 60_000

  /** Turns auto refresh `value` from the settings, showing the log again. */
  async function auto(pane: Awaited<ReturnType<typeof opened>>, value: 'on' | 'off'): Promise<void> {
    await pane.press({ key: 'settings' })
    await pane.press({ key: `auto-${value}` })
    await pane.press({ key: 'settings' })
  }

  test('the tab shown, pressed again, loads its log again', async ($, on) => {
    signedIn(on)
    const site: Site = { pages: following([webCommit('c1')]) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following([webCommit('c2'), webCommit('c1')])
    await pane.press({ key: 'tab-following' })

    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
  })

  test('does not refresh on its own at first', async ($, on) => {
    const { clock } = signedIn(on)
    const requests = webSite(on, { pages: following([]) })
    await opened($)
    await clock.advance(10 * MINUTE)

    expect(loads(requests, '/api/v1/log/following')).toBe(1)
  })

  test('refreshes every minute once auto is on, and keeps it on for the next sessions', async ($, on) => {
    const { clock, store } = signedIn(on)
    const requests = webSite(on, { pages: following([]) })
    const pane = await opened($)
    await auto(pane, 'on')
    await clock.advance(MINUTE)
    await clock.advance(MINUTE)

    expect(loads(requests, '/api/v1/log/following')).toBe(3)
    expect(store.get('autoRefresh')).toBe(true)
  })

  test('refreshes the tab it opens on', async ($, on) => {
    signedIn(on)
    const requests = webSite(on, { pages: following([]) })
    await opened($)
    await log($)
    await log($)

    expect(loads(requests, '/api/v1/log/following')).toBe(2)
  })

  test('refreshes each tab it switches to, loaded already or not', async ($, on) => {
    signedIn(on)
    const requests = webSite(on, { pages: { ...following([]), '/log/latest': { data: [] } } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    await pane.press({ key: 'tab-following' })
    await pane.press({ key: 'tab-latest' })

    expect(loads(requests, '/api/v1/log/latest')).toBe(2)
    expect(loads(requests, '/api/v1/log/following')).toBe(2)
  })

  test('refreshes on its own a minute after the tab shown is pressed again', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    const pane = await opened($)
    await clock.advance(20_000)
    await pane.press({ key: 'tab-following' })
    await clock.advance(40_000)

    expect(loads(requests, '/api/v1/log/following')).toBe(2)

    await clock.advance(20_000)

    expect(loads(requests, '/api/v1/log/following')).toBe(3)
  })

  test('goes on refreshing a minute apart while More loads the next page', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const requests = webSite(on, {
      pages: { ...following([webCommit('c1')], 'n1'), '/log/following?cursor=n1': { data: [webCommit('c2')] } },
    })
    const pane = await opened($)
    await clock.advance(20_000)
    await pane.press({ key: 'more' })
    await clock.advance(40_000)

    expect(loads(requests, '/api/v1/log/following')).toBe(2)
  })

  test('refreshes on its own when auto was left on', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    await opened($)
    await clock.advance(MINUTE)

    expect(loads(requests, '/api/v1/log/following')).toBe(2)
  })

  test('refreshes the log shown', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const requests = webSite(on, { pages: { ...following([]), '/log/latest': { data: [] } } })
    const pane = await opened($)
    await pane.press({ key: 'tab-latest' })
    await clock.advance(MINUTE)

    expect(loads(requests, '/api/v1/log/following')).toBe(1)
    expect(loads(requests, '/api/v1/log/latest')).toBe(2)
  })

  test('stops refreshing once auto is off', async ($, on) => {
    const { clock, store } = signedIn(on, { autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    const pane = await opened($)
    await auto(pane, 'off')
    await clock.advance(10 * MINUTE)

    expect(loads(requests, '/api/v1/log/following')).toBe(1)
    expect(store.get('autoRefresh')).toBe(false)
  })

  test('stops refreshing once the log is closed', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const requests = webSite(on, { pages: following([]) })
    await opened($)
    await log($)
    await clock.advance(10 * MINUTE)

    expect(loads(requests, '/api/v1/log/following')).toBe(1)
  })
})

describe('the pane a /clear leaves shown', () => {
  const pages = { '/log/latest': { data: [webCommit('l1')] }, '/log/trending': { data: [webCommit('t1')] } }

  test('goes on refreshing on its own once a tab is shown', async ($, on) => {
    const { clock, shown } = surface(on, { autoRefresh: true })
    const requests = webSite(on, { pages })
    shown.set(LOG_PANE, '/dev/null')
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'tab-trending' })
    await clock.advance(60_000)

    expect(loads(requests, '/log/trending')).toBe(2)
  })

  test('refreshes on its own again as soon as it is drawn', async ($, on) => {
    const { clock, shown } = surface(on, { autoRefresh: true })
    const requests = webSite(on, { pages })
    shown.set(LOG_PANE, '/dev/null')
    const pane = await mountLog($, 'terminal')
    await clock.settle()
    await pane.redraw()
    await clock.advance(60_000)

    expect(loads(requests, '/log/latest')).toBe(1)
  })

  test('arms auto refresh again in the session a /clear goes on under', async ($, on) => {
    const panes = surface(on, { autoRefresh: true })
    const requests = webSite(on, { pages })
    const pane = await opened($)
    await panes.clock.advance(20_000)
    panes.session = `${panes.session}-cleared`
    await pane.redraw()
    await panes.clock.settle()
    await pane.redraw()
    await panes.clock.advance(60_000)

    expect(loads(requests, '/log/latest')).toBe(2)
  })

  test('is closed by the command', async ($, on) => {
    const { shown, closed } = surface(on)
    webSite(on, { pages })
    shown.set(LOG_PANE, '/dev/null')

    expect(await log($)).toBe('Log closed.')
    expect(closed).toEqual([LOG_PANE])
  })
})

describe('the logs kept after a /clear', () => {
  function kept(data: Raw[], next: string | null = null): Record<string, unknown> {
    return { version: 7, value: { commits: data.map(commit), replies: [], next, error: '' } }
  }

  test('keeps each log loaded in the store, under a key of its own', async ($, on) => {
    const { store } = surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    await opened($)

    expect(store.get('webLog.latest')).toEqual(kept([webCommit('c1')]))
  })

  test('shows the log the store kept while it loads again', async ($, on) => {
    surface(on, { 'webLog.latest': kept([webCommit('c1')]) })
    const { until, release } = held()
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c2')] } }, until })
    const opening = log($)
    const pane = await mountLog($, 'terminal')

    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
    expect(await pane.find({ key: 'log-loading' })).toBeUndefined()

    release()
    await opening
  })

  test('keeps the other logs the store kept when one loads', async ($, on) => {
    const { store } = surface(on, { 'webLog.trending': kept([webCommit('t1')]) })
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    await opened($)

    expect(store.get('webLog.trending')).toEqual(kept([webCommit('t1')]))
    expect(store.get('webLog.latest')).toEqual(kept([webCommit('c1')]))
  })

  test('keeps both logs loading at once', async ($, on) => {
    const { store } = signedIn(on)
    const { until, release } = held()
    webSite(on, { pages: { ...following([webCommit('f1')]), '/log/latest': { data: [webCommit('l1')] } }, until })
    const opening = log($)
    const pane = await mountLog($, 'terminal')
    const pressing = pane.press({ key: 'tab-latest' })
    release()
    await Promise.all([opening, pressing])

    expect(store.get('webLog.following')).toEqual(kept([webCommit('f1')]))
    expect(store.get('webLog.latest')).toEqual(kept([webCommit('l1')]))
  })

  test('keeps the first page of a log only, which a refresh loads again', async ($, on) => {
    const { store } = surface(on)
    webSite(on, {
      pages: {
        '/log/latest': { data: [webCommit('c1')], next: 'n1' },
        '/log/latest?cursor=n1': { data: [webCommit('c2')] },
      },
    })
    const pane = await opened($)
    await pane.press({ key: 'more' })

    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
    expect(store.get('webLog.latest')).toEqual(kept([webCommit('c1')], 'n1'))
  })

  test('keeps the first page a refresh loaded last, not a refresh that failed', async ($, on) => {
    const { store } = surface(on)
    const site: Site = {
      pages: {
        '/log/latest': { data: [webCommit('c1')], next: 'n1' },
        '/log/latest?cursor=n1': { data: [webCommit('c2')] },
      },
    }
    webSite(on, site)
    const pane = await opened($)
    await pane.press({ key: 'more' })
    site.failing = ['/log/latest']
    await pane.press({ key: 'tab-latest' })

    expect((await pane.find({ key: 'log-error' }))?.text).toContain('HTTP 500')
    expect(store.get('webLog.latest')).toEqual(kept([webCommit('c1')], 'n1'))
  })

  test('forgets a log in the store that the store cannot hold any more', async ($, on) => {
    const { store, refusing } = surface(on, { 'webLog.latest': kept([webCommit('c1')]) })
    refusing.add('webLog.latest')
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c2')] } } })
    const pane = await opened($)

    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
    expect(store.has('webLog.latest')).toBe(false)
  })

  test('drops a load of the following log once signed out meanwhile', async ($, on) => {
    const { store } = signedIn(on)
    const { until, release } = held()
    const requests = webSite(on, {
      pages: { ...following([webCommit('c1')]), '/log/latest': { data: [webCommit('c2')] } },
      until,
    })
    const opening = log($)
    const pane = await mountLog($, 'terminal')

    for (let tries = 0; loads(requests, '/api/v1/log/following') === 0 && tries < 100; tries++) {
      await pane.redraw()
    }

    expect(loads(requests, '/api/v1/log/following')).toBe(1)

    await pane.press({ key: 'settings' })
    await pane.redraw()

    expect(await pane.find({ key: 'device-forget' })).toBeDefined()

    await pane.press({ key: 'device-forget' })
    release()
    await opening

    expect(store.has('webLog.following')).toBe(false)
  })

  test('drops a load another load of the log replaced', { timeoutMs: SPINNING_30S }, async ($, on) => {
    const { store, clock } = surface(on)
    const { until, release } = held()
    const site: Site = { pages: { '/log/latest': { data: [webCommit('c1')] } }, until }
    const requests = webSite(on, site)
    const opening = log($)
    const pane = await mountLog($, 'terminal')

    for (let tries = 0; loads(requests, '/log/latest') === 0 && tries < 100; tries++) {
      await pane.redraw()
    }

    expect(loads(requests, '/log/latest')).toBe(1)

    site.until = undefined
    site.pages = { '/log/latest': { data: [webCommit('c2')] } }
    await clock.advance(30_001)
    await pane.press({ key: 'tab-latest' })
    release()
    await opening
    await pane.redraw()

    expect(loads(requests, '/log/latest')).toBe(2)
    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeUndefined()
    expect(store.get('webLog.latest')).toEqual(kept([webCommit('c2')]))
  })

  test('forgets the following log in the store once signed out', async ($, on) => {
    const { store } = signedIn(on)
    webSite(on, { pages: { ...following([webCommit('c1')]), '/log/latest': { data: [webCommit('c2')] } } })
    const pane = await opened($)

    expect(store.has('webLog.following')).toBe(true)

    await pane.press({ key: 'settings' })
    await pane.press({ key: 'device-forget' })

    expect(store.has('webLog.following')).toBe(false)
  })

  const unreadable: Record<string, unknown> = {
    'of a newer version': { version: 8, value: kept([webCommit('c1')]).value },
    'of the version before quotes threaded as replies': { version: 1, value: kept([webCommit('c1')]).value },
    'of the version before the threads authors continue': { version: 2, value: kept([webCommit('c1')]).value },
    'of the version before deleted commits': { version: 3, value: kept([webCommit('c1')]).value },
    'of the version before mentions': { version: 4, value: kept([webCommit('c1')]).value },
    'of the version before long commits': { version: 5, value: kept([webCommit('c1')]).value },
    'of the version before the ids of the options of a poll': { version: 6, value: kept([webCommit('c1')]).value },
    'not a log': { version: 7, value: { commits: 'c1' } },
    'not sealed': kept([webCommit('c1')]).value,
  }

  for (const [why, stored] of Object.entries(unreadable)) {
    test(`resets what the store kept, ${why}`, async ($, on) => {
      const { store } = surface(on, { 'webLog.latest': stored })
      const { until, release } = held()
      webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } }, until })
      const opening = log($)
      const pane = await mountLog($, 'terminal')

      expect(await pane.find({ key: 'log-loading' })).toBeDefined()
      expect(store.has('webLog.latest')).toBe(false)

      release()
      await opening
    })
  }
})
