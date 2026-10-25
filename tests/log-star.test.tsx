import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import type { Raw, Site, WebRequest } from './support'
import { log, mountLog, SIGNED_IN, signedIn, surface, webCommit, webSite } from './support'

const theirs = (starred: boolean, stars: number) => webCommit('c1', { starred, stars_count: stars })

/** Latest, with c1, by someone else, not starred, and how /dev/null answers a star of it, or the star taken back. */
const SITE: Site = {
  pages: { '/log/latest': { data: [theirs(false, 1)] } },
  stars: { c1: { POST: theirs(true, 2), DELETE: theirs(false, 1) } },
}

async function latest($: Engine) {
  await log($)
  const pane = await mountLog($, 'terminal')
  await pane.press({ key: 'tab-latest' })

  return pane
}

const stars = (requests: readonly WebRequest[]) =>
  requests.filter(request => request.url.endsWith('/star')).map(request => [request.method, request.url])

/** The label of the star of c1, and whether it is dimmed. */
const label = async (pane: Awaited<ReturnType<typeof latest>>) => {
  const button = await pane.find({ type: 'Button', key: 'star-c1' })

  return [button?.props.label, button?.props.dimColor]
}

describe('starring a commit from the log', () => {
  test('shows the stars of a commit as a button once the device is approved, dimmed while not starred', async ($, on) => {
    signedIn(on)
    webSite(on, SITE)
    const pane = await latest($)

    expect(await label(pane)).toEqual(['⭐️ 1', true])
  })

  test('stars it once pressed, and takes its star back once pressed again', async ($, on) => {
    signedIn(on)
    const requests = webSite(on, SITE)
    const pane = await latest($)
    await pane.press({ key: 'star-c1' })

    expect(await label(pane)).toEqual(['⭐️ 2', false])

    await pane.press({ key: 'star-c1' })

    expect(await label(pane)).toEqual(['⭐️ 1', true])
    expect(stars(requests)).toEqual([
      ['POST', 'https://dev-null.sh/api/v1/commits/c1/star'],
      ['DELETE', 'https://dev-null.sh/api/v1/commits/c1/star'],
    ])
  })

  test('says why /dev/null refused it, the stars as they were', async ($, on) => {
    signedIn(on)
    webSite(on, { ...SITE, stars: {} })
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)

      return { value: undefined }
    })
    const pane = await latest($)
    await pane.press({ key: 'star-c1' })

    expect(toasts).toEqual(['This action is unauthorized.'])
    expect(await label(pane)).toEqual(['⭐️ 1', true])
  })

  test('draws the stars of one own commit, which /dev/null does not let one star', async ($, on) => {
    signedIn(on)
    const own: Raw = webCommit('c1', { starred: false, stars_count: 3 }, SIGNED_IN)
    webSite(on, { pages: { '/log/latest': { data: [own] } } })
    const pane = await latest($)

    expect(await pane.find({ key: 'star-c1' })).toBeUndefined()
    expect((await pane.find({ key: 'counts-c1' }))?.text).toContain('⭐️ 3')
  })

  test('draws the stars, not a button, while no one approved the device', async ($, on) => {
    surface(on)
    webSite(on, SITE)
    const pane = await latest($)

    expect(await pane.find({ key: 'star-c1' })).toBeUndefined()
    expect((await pane.find({ key: 'counts-c1' }))?.text).toContain('⭐️ 1')
  })
})
