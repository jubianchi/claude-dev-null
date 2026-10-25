import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { LOAD_EVERY } from '../hooks/state/pictures'
import type { Panes, Site } from './support'
import { LOG, log, mountLog, PICTURES_FOLDER, PLUGIN, pictureSite, surface, webCommit, webSite } from './support'

const PROBE = 'picture-probe'

/** A lossy WebP 16×8 of one red, as /dev/null serves its pictures. */
const RED = 'UklGRj4AAABXRUJQVlA4IDIAAADQAQCdASoQAAgAAMASJaACdLoB+AADsAD+9hNf/uQD2QD2QD+E//9krfZ5f2St/2PIAA=='
let pictures = 0

/** The address of a picture of its own, since the module keeps the pictures it loaded from one test to the next. */
function picture(): string {
  return `https://dev-null.sh/commit-images/i${++pictures}`
}

function withPictures(...urls: string[]) {
  return webCommit('c1', { images: urls.map(url => ({ id: url, url, width: 1600, height: 800, description: null })) })
}

/** The log of a commit with pictures, once the terminal answered and what the log loaded is drawn. */
async function drawn($: Engine, panes: Panes, surfaceName: 'terminal' | 'desktop' = 'terminal') {
  await log($)
  const pane = await mountLog($, surfaceName)

  for (let step = 0; step < 6; step++) {
    await panes.clock.advance(LOAD_EVERY)
    await pane.redraw()
  }

  return pane
}

describe('the pictures of the log', () => {
  test('are drawn where the terminal draws pictures, as wide as the log lets them, their link under them', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const url = picture()
    pictureSite(on, { [url]: RED })
    webSite(on, { pages: { '/log/latest': { data: [withPictures(url)] } } })
    const pane = await drawn($, panes)
    const image = await pane.find({ key: 'picture-c1-0' })

    expect(image?.type).toBe('Image')
    expect(image?.props).toMatchObject({ columns: 60, rows: 15, alt: '[image 1600×800]' })
    expect(image?.props.source).toEqual({ file: `${PICTURES_FOLDER}/picture.2`, format: 'rgba', width: 16, height: 8 })
    expect((await pane.find({ type: 'Link', text: '[image 1600×800]' }))?.props.href).toBe(url)
  })

  test('are as wide as the words of their commit, a reply narrower, as the rows of the log count them', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const [ofCommit, ofReply] = [picture(), picture()]
    pictureSite(on, { [ofCommit]: RED, [ofReply]: RED })
    const image = (url: string) => ({ id: url, url, width: 1600, height: 800, description: null })
    const reply = webCommit('r1', { parent_id: 'c1', images: [image(ofReply)] })
    const commit = webCommit('c1', { images: [image(ofCommit)], replies_count: 1, reply_preview: { data: [reply] } })
    webSite(on, { pages: { '/log/latest': { data: [commit] } } })
    await log($)
    const pane = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      ...LOG,
      props: { ...LOG.props, bodyColumns: 40 },
    })

    for (let step = 0; step < 8; step++) {
      await panes.clock.advance(LOAD_EVERY)
      await pane.redraw()
    }

    expect((await pane.find({ key: 'picture-c1-0' }))?.props).toMatchObject({ columns: 34, rows: 9 })
    expect((await pane.find({ key: 'picture-r1-0' }))?.props).toMatchObject({ columns: 32, rows: 8 })
  })

  test('load those of the replies the log shows once scrolled past their commit', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const ofReply = picture()
    const downloads = pictureSite(on, { [ofReply]: RED })
    const image = { id: ofReply, url: ofReply, width: 1600, height: 800, description: null }
    const reply = webCommit('r1', { parent_id: 'c1', images: [image] })
    const commit = webCommit('c1', { replies_count: 1, reply_preview: { data: [reply] } })
    const after = ['c2', 'c3', 'c4', 'c5'].map(id => webCommit(id))
    webSite(on, { pages: { '/log/latest': { data: [commit, ...after] } } })
    on('ui.scroll', () => ({}))
    await log($)
    const pane = await mountLog($, 'terminal')
    const scroll = { offset: 0, by: 1, bodyRows: 30, contentRows: 100, origin: { kind: 'person' } } as const
    await $.ui.scroll({ component: 'Pane', requestId: LOG.requestId, ...scroll })

    for (let step = 0; step < 6; step++) {
      await panes.clock.advance(LOAD_EVERY)
      await pane.redraw()
    }

    expect(downloads).toEqual([ofReply])
    expect(await pane.find({ key: 'picture-r1-0' })).toBeDefined()
  })

  test('stay links where the terminal draws none, and nothing is downloaded', async ($, on) => {
    const panes = surface(on)
    const url = picture()
    const downloads = pictureSite(on, { [url]: RED })
    webSite(on, { pages: { '/log/latest': { data: [withPictures(url)] } } })
    const pane = await drawn($, panes)

    expect(downloads).toEqual([])
    expect(await pane.find({ key: 'picture-c1-0' })).toBeUndefined()
    expect((await pane.find({ type: 'Link', text: '[image 1600×800]' }))?.props.href).toBe(url)
  })

  test('stay links on the desktop, and nothing is downloaded', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const url = picture()
    const downloads = pictureSite(on, { [url]: RED })
    webSite(on, { pages: { '/log/latest': { data: [withPictures(url)] } } })
    const pane = await drawn($, panes, 'desktop')

    expect(downloads).toEqual([])
    expect(await pane.find({ key: 'picture-c1-0' })).toBeUndefined()
  })

  test('go on loading past one that never answers, after 75 seconds, which stays a link', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const [stuck, url] = [picture(), picture()]
    pictureSite(on, { [url]: RED }, [stuck])
    webSite(on, { pages: { '/log/latest': { data: [withPictures(stuck, url)] } } })
    const pane = await drawn($, panes)
    await panes.clock.advance(60_000)
    await pane.redraw()

    expect(await pane.find({ key: 'picture-c1-1' })).toBeUndefined()

    await panes.clock.advance(15_000)
    await panes.clock.advance(LOAD_EVERY)
    await pane.redraw()
    await panes.clock.advance(LOAD_EVERY)
    await pane.redraw()

    expect(await pane.find({ key: 'picture-c1-0' })).toBeUndefined()
    expect(await pane.find({ key: 'picture-c1-1' })).toBeDefined()
  })

  test('load those the log shows, not those it showed before it was refreshed', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const [stuck, gone, also, shown] = [picture(), picture(), picture(), picture()]
    const downloads = pictureSite(on, { [gone]: RED, [also]: RED, [shown]: RED }, [stuck])
    const site: Site = { pages: { '/log/latest': { data: [withPictures(stuck, gone, also)] } } }
    webSite(on, site)
    const pane = await drawn($, panes)
    site.pages = { '/log/latest': { data: [withPictures(shown)] } }
    await pane.press({ key: 'tab-latest' })
    await panes.clock.advance(75_000)

    for (let step = 0; step < 4; step++) {
      await panes.clock.advance(LOAD_EVERY)
      await pane.redraw()
    }

    expect(downloads).toEqual([stuck, shown])
    expect(await pane.find({ key: 'picture-c1-0' })).toBeDefined()
  })

  test('try again a picture that could not be loaded once the tab shown is pressed again', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const url = picture()
    const answers: Record<string, string> = {}
    const downloads = pictureSite(on, answers)
    webSite(on, { pages: { '/log/latest': { data: [withPictures(url)] } } })
    const pane = await drawn($, panes)

    expect(await pane.find({ key: 'picture-c1-0' })).toBeUndefined()

    answers[url] = RED
    await pane.press({ key: 'tab-latest' })

    for (let step = 0; step < 4; step++) {
      await panes.clock.advance(LOAD_EVERY)
      await pane.redraw()
    }

    expect(downloads).toEqual([url, url])
    expect(await pane.find({ key: 'picture-c1-0' })).toBeDefined()
  })

  test('go with their folder once the session ends with the process, not for a /clear or a resume', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const url = picture()
    const removed: string[] = []
    pictureSite(on, { [url]: RED }, [], removed)
    webSite(on, { pages: { '/log/latest': { data: [withPictures(url)] } } })
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
    await drawn($, panes)
    const end = (reason: 'clear' | 'resume' | 'prompt_input_exit') =>
      $.session.end({ reason, sessionId: panes.session, resume: { id: panes.session } })

    await end('clear')
    await end('resume')

    expect(removed).toEqual([])

    await end('prompt_input_exit')

    expect(removed).toEqual([PICTURES_FOLDER])
  })

  test('are downloaded once each; one that could not be stays a link, beside those drawn', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    const [url, missing] = [picture(), picture()]
    const downloads = pictureSite(on, { [url]: RED })
    webSite(on, { pages: { '/log/latest': { data: [withPictures(url, missing)] } } })
    const pane = await drawn($, panes)
    await panes.clock.advance(60_000)
    await pane.redraw()

    expect(downloads.toSorted()).toEqual([url, missing].toSorted())
    expect(await pane.find({ key: 'picture-c1-0' })).toBeDefined()
    expect(await pane.find({ key: 'picture-c1-1' })).toBeUndefined()
    expect((await pane.findAll({ type: 'Link' })).filter(link => link.props.href === missing)).toHaveLength(1)
  })
})

describe('asking the terminal whether it draws pictures', () => {
  /** The log, opened and drawn on the terminal. */
  async function opened($: Engine) {
    await log($)

    return mountLog($, 'terminal')
  }

  /** Lets a period of the timers go by, and draws the log again. */
  async function step(panes: Panes, pane: Awaited<ReturnType<typeof opened>>, times = 1) {
    for (let time = 0; time < times; time++) {
      await panes.clock.advance(LOAD_EVERY)
      await pane.redraw()
    }
  }

  test('draws a probe from a file, as a picture is, blits it once drawn, and leaves it out once answered', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'unmounted'
    pictureSite(on, {})
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await opened($)

    expect(await pane.find({ key: PROBE })).toBeUndefined()

    await step(panes, pane)
    const drawnFrom = (await pane.find({ key: PROBE }))?.props.source

    expect(drawnFrom).toEqual({ file: `${PICTURES_FOLDER}/picture.1`, format: 'rgba', width: 1, height: 1 })
    expect(panes.blitted).toEqual([])

    await step(panes, pane)

    expect(panes.blitted).toEqual([PROBE])
    expect(panes.blits[0]).toMatchObject({ file: `${PICTURES_FOLDER}/picture.1`, format: 'rgba', width: 1, height: 1 })
    expect(panes.blits[0]).not.toEqual(drawnFrom)
    expect(await pane.find({ key: PROBE })).toBeDefined()

    panes.blit = 'alt'
    await step(panes, pane)

    expect(panes.blitted).toEqual([PROBE, PROBE])
    expect(await pane.find({ key: PROBE })).toBeUndefined()
  })

  test('asks once, whatever the terminal answered', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    pictureSite(on, {})
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await opened($)
    await step(panes, pane, 4)

    expect(panes.blitted).toEqual([PROBE])
    expect(await pane.find({ key: PROBE })).toBeUndefined()
  })

  test('takes a terminal whose probe cannot be written for one without pictures, and asks nothing', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'drawn'
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await opened($)
    await step(panes, pane, 4)

    expect(panes.blitted).toEqual([])
    expect(await pane.find({ key: PROBE })).toBeUndefined()
  })

  test('asks again after a /clear, which may have moved the session to another terminal', async ($, on) => {
    const panes = surface(on)
    pictureSite(on, {})
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await opened($)
    await step(panes, pane, 3)
    panes.session = `${panes.session}-cleared`
    await step(panes, pane, 3)

    expect(panes.blitted).toEqual([PROBE, PROBE])
  })

  test('asks three times at most when the probe is not drawn yet, then takes the terminal for one without pictures', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'unmounted'
    pictureSite(on, {})
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await opened($)
    await step(panes, pane, 8)

    expect(panes.blitted).toEqual([PROBE, PROBE, PROBE])
    expect(await pane.find({ key: PROBE })).toBeUndefined()
  })

  test('asks three times at most when blitting fails, then takes the terminal for one without pictures', async ($, on) => {
    const panes = surface(on)
    panes.blit = 'throws'
    pictureSite(on, {})
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await opened($)
    await step(panes, pane, 8)

    expect(panes.blitted).toEqual([PROBE, PROBE, PROBE])
    expect(await pane.find({ key: PROBE })).toBeUndefined()
  })

  test('asks nothing on the desktop, which draws no pictures', async ($, on) => {
    const panes = surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    await log($)
    const pane = await mountLog($, 'desktop')
    await panes.clock.settle()

    expect(await pane.find({ key: PROBE })).toBeUndefined()
    expect(panes.blitted).toEqual([])
  })
})
