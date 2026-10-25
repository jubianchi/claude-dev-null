import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { log, mountLog, surface, webCommit, webSite } from './support'

/** c1, with its replies r1 to r5, r5 the newest. */
const SITE = {
  pages: { '/log/latest': { data: [webCommit('c1', { replies_count: 5 })] } },
  replies: {
    c1: [1, 2, 3, 4, 5].map(index =>
      webCommit(`r${index}`, { parent_id: 'c1', created_at: `2026-10-17T10:2${index}:00.000000Z` }),
    ),
  },
}

async function opened($: Engine) {
  await log($)

  return mountLog($, 'terminal')
}

async function replies(pane: Awaited<ReturnType<typeof opened>>): Promise<string[]> {
  return (await pane.findAll({}))
    .map(element => element.key ?? '')
    .filter(key => key.startsWith('reply-r'))
    .map(key => key.slice('reply-'.length))
}

describe('the replies shown under a commit', () => {
  test('are the newest 3, as /dev/null shows them by default, then Show more', async ($, on) => {
    surface(on)
    webSite(on, SITE)
    const pane = await opened($)

    expect(await replies(pane)).toEqual(['r5', 'r4', 'r3'])
    expect((await pane.find({ key: 'more-replies-c1' }))?.props.label).toBe('Show 2 more')
  })

  test('go on with as many more once Show more is pressed', async ($, on) => {
    surface(on)
    webSite(on, SITE)
    const pane = await opened($)
    await pane.press({ key: 'more-replies-c1' })

    expect(await replies(pane)).toEqual(['r5', 'r4', 'r3', 'r2', 'r1'])
    expect(await pane.find({ key: 'more-replies-c1' })).toBeUndefined()
  })

  test('are as many as the settings choose, from one session to the next', async ($, on) => {
    const { store } = surface(on)
    webSite(on, SITE)
    const pane = await opened($)
    await pane.press({ key: 'settings' })
    await pane.press({ key: 'replies-1' })
    await pane.press({ key: 'settings' })

    expect(await replies(pane)).toEqual(['r5'])
    expect((await pane.find({ key: 'more-replies-c1' }))?.props.label).toBe('Show 4 more')
    expect(store.get('repliesPerPage')).toEqual({ version: 1, value: 1 })
  })

  test('are as many as the store kept', async ($, on) => {
    surface(on, { repliesPerPage: { version: 1, value: 5 } })
    webSite(on, SITE)
    const pane = await opened($)

    expect(await replies(pane)).toEqual(['r5', 'r4', 'r3', 'r2', 'r1'])
  })

  test('are 3 when the store kept a number /dev/null does not offer', async ($, on) => {
    const { store } = surface(on, { repliesPerPage: { version: 1, value: 4 } })
    webSite(on, SITE)
    const pane = await opened($)

    expect(await replies(pane)).toEqual(['r5', 'r4', 'r3'])
    expect(store.has('repliesPerPage')).toBe(false)
  })
})
