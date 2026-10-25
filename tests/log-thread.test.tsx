import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import type { Raw } from './support'
import { LOG_PANE, log, mountLog, signedIn, surface, webCommit, webSite } from './support'

/** The log pane, open, on Latest. */
async function latest($: Engine) {
  await log($)
  const pane = await mountLog($, 'terminal')
  await pane.press({ key: 'tab-latest' })

  return pane
}

async function keys(pane: Awaited<ReturnType<typeof latest>>): Promise<string[]> {
  return (await pane.findAll({})).map(element => element.key ?? '')
}

const reply = (id: string, parent: string, extra: Raw = {}) => webCommit(id, { parent_id: parent, ...extra })

const LATEST = { '/log/latest': { data: [webCommit('c1'), webCommit('c2'), webCommit('c3'), webCommit('c4')] } }

describe('the thread of a commit', () => {
  test('opens from a commit once the device is approved', async ($, on) => {
    signedIn(on)
    webSite(on, {
      pages: LATEST,
      threads: {
        c2: { commit: reply('c2', 'p2', { replies_count: 1 }), ancestors: [webCommit('p1'), reply('p2', 'p1')] },
      },
      replies: { c2: [reply('r1', 'c2')] },
    })
    const pane = await latest($)
    await pane.press({ key: 'thread-c2' })

    expect(await pane.find({ key: 'commit-p1' })).toBeDefined()
    expect(await keys(pane)).toEqual(expect.arrayContaining(['reply-p2', 'reply-c2', 'reply-r1']))
    expect(await pane.find({ key: 'commit-c1' })).toBeUndefined()
  })

  test('shows back in place of the tabs, which shows the log again', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: LATEST, threads: { c2: { commit: webCommit('c2') } } })
    const pane = await latest($)
    await pane.press({ key: 'thread-c2' })

    expect(await pane.find({ key: 'tab-latest' })).toBeUndefined()

    await pane.press({ key: 'back' })

    expect(await pane.find({ key: 'tab-latest' })).toBeDefined()
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
  })

  test('shows the log again where it was scrolled to', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: LATEST, threads: { c3: { commit: webCommit('c3') } } })
    on('ui.scroll', () => ({}))
    const pane = await latest($)
    const scroll = { offset: 0, by: 1, bodyRows: 30, contentRows: 100, origin: { kind: 'person' } } as const
    await $.ui.scroll({ component: 'Pane', requestId: LOG_PANE, ...scroll })
    await pane.redraw()
    await pane.press({ key: 'thread-c3' })

    expect(await pane.find({ key: 'above' })).toBeUndefined()

    await pane.press({ key: 'back' })

    expect((await pane.find({ key: 'above' }))?.text).toBe('↑ 1 more')
    expect(await pane.find({ key: 'commit-c1' })).toBeUndefined()
  })

  test('says why it could not be loaded', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: LATEST })
    const pane = await latest($)
    await pane.press({ key: 'thread-c2' })

    expect((await pane.find({ key: 'log-error' }))?.text).toContain('Could not load the thread')
  })

  test('shows the results of a poll voted in from it', async ($, on) => {
    const poll = (voted: boolean) => ({
      closes_at: '2026-10-19T11:00:00Z',
      is_closed: false,
      has_voted: voted,
      total_votes: voted ? 1 : null,
      options: [
        { id: 'o1', label: 'Yes', votes_count: voted ? 1 : null, voted },
        { id: 'o2', label: 'No', votes_count: voted ? 0 : null, voted: false },
      ],
    })
    const C = '01a14bab-0ec6-734a-91a3-8008640033a0'
    signedIn(on)
    webSite(on, {
      pages: { '/log/latest': { data: [webCommit(C)] } },
      threads: { [C]: { commit: webCommit(C, { poll: poll(false) }) } },
      votes: { [C]: webCommit(C, { poll: poll(true) }) },
    })
    const pane = await latest($)
    await pane.press({ key: `thread-${C}` })
    await pane.press({ key: `poll-option-${C}-o1` })
    await pane.press({ key: `poll-vote-${C}` })

    expect((await pane.find({ key: `poll-${C}` }))?.text).toContain('100% Yes ✓')
  })

  test('does not open while no one approved the device', async ($, on) => {
    surface(on)
    webSite(on, { pages: LATEST })
    const pane = await latest($)

    expect(await pane.find({ key: 'commit-c2' })).toBeDefined()
    expect(await pane.find({ key: 'thread-c2' })).toBeUndefined()
  })
})
