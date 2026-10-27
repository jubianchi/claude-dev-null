import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { BRANDS } from '../hooks/brand'
import type { Raw, Site } from './support'
import { LOG_PANE, log, mountLog, signedIn, surface, webCommit, webSite } from './support'

const MINUTE = 60_000

/** The commits `from` down to `to`, the newest first. */
function commits(from: number, to: number): Raw[] {
  return Array.from({ length: from - to + 1 }, (_, index) => webCommit(`c${from - index}`))
}

function following(data: Raw[], next?: string): Site['pages'] {
  return { '/log/following': next === undefined ? { data } : { data, next } }
}

async function opened($: Engine) {
  await log($)

  return mountLog($, 'terminal')
}

type Pane = Awaited<ReturnType<typeof opened>>

async function scroll($: Engine, pane: Pane, by: number): Promise<void> {
  const scrolled = { offset: 0, by, bodyRows: 30, contentRows: 100, origin: { kind: 'person' } } as const
  await $.ui.scroll({ component: 'Pane', requestId: LOG_PANE, ...scrolled })
  await pane.redraw()
}

/** The commits the log shows, from the first. */
async function shown(pane: Pane): Promise<string[]> {
  return (await pane.findAll({}))
    .map(element => element.key ?? '')
    .filter(key => key.startsWith('commit-'))
    .map(key => key.slice('commit-'.length))
}

const background = async (pane: Pane, id: string) => (await pane.find({ key: `commit-${id}` }))?.props.backgroundColor

const pill = async (pane: Pane) => (await pane.find({ type: 'Button', key: 'new-commits' }))?.text.trim()

describe('the commits that arrive while the log refreshes on its own', () => {
  test('keep the place of the log, and say how many arrived above it', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    on('ui.scroll', () => ({}))
    const pane = await opened($)
    await scroll($, pane, 1)

    expect((await shown(pane))[0]).toBe('c9')

    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.redraw()

    expect((await shown(pane))[0]).toBe('c9')
    expect(await pill(pane)).toBe('↑ 2 new commits')
    expect((await pane.find({ key: 'above' }))?.text).toBe('↑ 3 more')
  })

  test('say so in a badge drawn over the top of the log, in color, not in the row of the tabs', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following(commits(11, 1))
    await clock.advance(MINUTE)
    await pane.redraw()
    const badge = await pane.find({ key: 'new-commits-badge' })

    expect(await pill(pane)).toBe('↑ 1 new commit')
    expect(badge?.props).toMatchObject({ position: 'absolute', top: 0 })
    expect((await pane.find({ key: 'new-commits-pill' }))?.props.backgroundColor).toBe(BRANDS.dark.primary)
    expect((await pane.find({ key: 'tabs' }))?.text).not.toContain('new')
  })

  test('show on top once their button is pressed, which goes', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    on('ui.scroll', () => ({}))
    const pane = await opened($)
    await scroll($, pane, 1)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.press({ key: 'new-commits' })

    expect((await shown(pane))[0]).toBe('c12')
    expect(await pill(pane)).toBeUndefined()
  })

  test('stay above the log read from its top, as the web app holds them', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.redraw()

    expect((await shown(pane))[0]).toBe('c10')
    expect(await pill(pane)).toBe('↑ 2 new commits')
  })

  test('show once the log is scrolled up to them, their button gone', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    on('ui.scroll', () => ({}))
    const pane = await opened($)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await scroll($, pane, -10)

    expect((await shown(pane))[0]).toBe('c12')
    expect(await pill(pane)).toBeUndefined()
  })

  test('show on top at once when the tab is pressed, which loads the log again from its top', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.press({ key: 'tab-following' })

    expect((await shown(pane))[0]).toBe('c12')
    expect(await pill(pane)).toBeUndefined()
  })

  test('show on the soft primary of /dev/null, as the site highlights a commit, even once seen', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.press({ key: 'new-commits' })

    expect(await background(pane, 'c12')).toBe(BRANDS.dark.primarySoft)
    expect(await background(pane, 'c11')).toBe(BRANDS.dark.primarySoft)
    expect(await background(pane, 'c10')).toBeUndefined()
  })

  test('add to those shown on the soft primary when more arrive', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following(commits(11, 1))
    await clock.advance(MINUTE)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.press({ key: 'new-commits' })

    expect(await background(pane, 'c12')).toBe(BRANDS.dark.primarySoft)
    expect(await background(pane, 'c11')).toBe(BRANDS.dark.primarySoft)
  })

  test('lose their background once the tab loads the log again from its top', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = { pages: following(commits(10, 1)) }
    webSite(on, site)
    const pane = await opened($)
    site.pages = following(commits(12, 1))
    await clock.advance(MINUTE)
    await pane.press({ key: 'tab-following' })

    expect(await background(pane, 'c12')).toBeUndefined()
  })

  test('leave the pages More loaded in the log', async ($, on) => {
    const { clock } = signedIn(on, { autoRefresh: true })
    const site: Site = {
      pages: { ...following(commits(10, 3), 'n1'), '/log/following?cursor=n1': { data: commits(2, 1) } },
    }
    webSite(on, site)
    const pane = await opened($)
    await pane.press({ key: 'more' })
    site.pages = { ...site.pages, ...following(commits(11, 4), 'n2') }
    await clock.advance(MINUTE)
    await pane.redraw()

    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
    expect(await pill(pane)).toBe('↑ 1 new commit')
  })

  test('keep the place of trending, whose order changes, and say nothing arrived', async ($, on) => {
    const { clock } = surface(on, { autoRefresh: true })
    const site: Site = { pages: { '/log/trending': { data: commits(10, 1) } } }
    webSite(on, site)
    on('ui.scroll', () => ({}))
    const pane = await opened($)
    await pane.press({ key: 'tab-trending' })
    await scroll($, pane, 1)
    site.pages = { '/log/trending': { data: [...commits(12, 11), ...commits(10, 1)] } }
    await clock.advance(MINUTE)
    await pane.redraw()

    expect((await shown(pane))[0]).toBe('c9')
    expect(await pill(pane)).toBeUndefined()
  })
})
