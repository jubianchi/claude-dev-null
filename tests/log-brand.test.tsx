import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { BRANDS } from '../hooks/brand'
import { log, mountBand, mountLog, run, signedIn, surface, theme, webCommit, webSite } from './support'

const MINUTE = 60_000

async function latest($: Engine) {
  await log($)

  return mountLog($, 'terminal')
}

type Mounted = Pick<Awaited<ReturnType<typeof latest>> | Awaited<ReturnType<typeof mountBand>>, 'findAll'>

/** The colors the texts `text` are drawn in. */
async function colors(drawing: Mounted, text: string): Promise<unknown[]> {
  return (await drawing.findAll({ type: 'Text' })).filter(found => found.text === text).map(found => found.props.color)
}

const LANE_2 = webCommit('c1', { body_segments: [{ type: 'text', text: 'on /dev/null' }] })

for (const [name, brand] of Object.entries(BRANDS)) {
  describe(`the colors of /dev/null, in the ${name} theme of Claude Code`, () => {
    test('draw the lanes of the authors', async ($, on) => {
      surface(on)
      theme(on, name)
      webSite(on, { pages: { '/log/latest': { data: [LANE_2] } } })
      const pane = await latest($)

      expect(await colors(pane, '● ')).toEqual([brand.lanes[2]])
    })

    test('draw the outlined slash of the logo, and of /dev/null in a commit, in the accent', async ($, on) => {
      surface(on)
      theme(on, name)
      webSite(on, { pages: { '/log/latest': { data: [LANE_2] } } })
      const pane = await latest($)

      expect(await colors(pane, '/')).toEqual(expect.arrayContaining([brand.accent]))
      expect(await colors(pane, '/')).not.toContain(name === 'light' ? BRANDS.dark.accent : BRANDS.light.accent)
    })

    test('draw the links of a commit in the primary, as the site does', async ($, on) => {
      surface(on)
      theme(on, name)
      const text = 'See https://laravel.com/docs, https://github.com/a/b/pull/7 and @brendt'
      const linked = webCommit('c1', {
        body: text,
        body_segments: [{ type: 'text', text }],
        mentions: { brendt: '01a1-brendt' },
      })
      webSite(on, { pages: { '/log/latest': { data: [linked] } } })
      const pane = await latest($)

      expect(await colors(pane, 'laravel.com/docs')).toEqual([brand.primary])
      expect(await colors(pane, 'a/b#7')).toEqual([brand.primary])
      expect(await colors(pane, '@brendt')).toEqual([brand.primary])
    })

    test('draw the links of the pane in the primary, the handle and the hash of a commit muted', async ($, on) => {
      surface(on)
      theme(on, name)
      const poll = {
        closes_at: '2099-01-01T00:00:00Z',
        is_closed: false,
        has_voted: false,
        total_votes: null,
        options: [{ id: 'o1', label: 'Yes', votes_count: null, voted: false }],
      }
      const images = [{ id: 'i1', url: 'https://dev-null.sh/commit-images/i1', width: 640, height: 480 }]
      const linked = webCommit('c1', { continuation_id: 'r1', poll, images })
      webSite(on, { pages: { '/log/latest': { data: [linked] } } })
      const pane = await latest($)
      const dimmed = async (text: string) =>
        (await pane.findAll({ type: 'Text' })).filter(found => found.text === text).map(found => found.props.dimColor)

      expect(await colors(pane, 'Show thread')).toEqual([brand.primary])
      expect(await colors(pane, 'Vote on dev-null.sh')).toEqual([brand.primary])
      expect(await colors(pane, '[image 640×480]')).toEqual([brand.primary])
      expect(await dimmed('@nunomaduro')).toEqual([true])
      expect(await dimmed('c1')).toEqual([true])
    })

    test('draw the logo above the prompt in the accent too', async ($, on) => {
      surface(on)
      theme(on, name)
      await run($, 'dev-null:compose')
      const band = await mountBand($)

      expect(await colors(band, '/')).toContain(brand.accent)
    })

    test('draw the badge of the new commits in the primary, its words in the shell', async ($, on) => {
      const { clock } = signedIn(on, { autoRefresh: true })
      theme(on, name)
      const site = { pages: { '/log/following': { data: [webCommit('c1')] } } }
      webSite(on, site)
      const pane = await latest($)
      site.pages = { '/log/following': { data: [webCommit('c2'), webCommit('c1')] } }
      await clock.advance(MINUTE)
      await pane.redraw()

      expect((await pane.find({ key: 'new-commits-pill' }))?.props.backgroundColor).toBe(brand.primary)
      expect(await colors(pane, ' ↑ 1 new commit ')).toEqual([brand.shell])
    })
  })
}

test('the colors of /dev/null are those of its dark theme when Claude Code says no theme', async ($, on) => {
  surface(on)
  webSite(on, { pages: { '/log/latest': { data: [LANE_2] } } })
  const pane = await latest($)

  expect(await colors(pane, '● ')).toEqual([BRANDS.dark.lanes[2]])
})
