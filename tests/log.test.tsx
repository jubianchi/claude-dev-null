import { describe, expect, test } from 'claude-code/testing'

import { REPLYING } from '../hooks/components/composer'

import {
  fakeCommitScript,
  log,
  mountBand,
  mountLog,
  LOG_PANE as PANE,
  run,
  signedIn,
  surface,
  webCommit,
  webSite,
} from './support'

describe('log', () => {
  test('the command opens the log in a pane', async ($, on) => {
    const panes = surface(on)
    const text = await log($)

    expect(text).toBe('Log open.')
    expect(panes.opened).toHaveLength(1)
    expect(panes.opened[0]).toMatchObject({ id: PANE, title: '/dev/null' })
  })

  for (const where of ['terminal', 'desktop'] as const) {
    test(`the pane draws the composer, then the tabs and settings, then the log on ${where}`, async ($, on) => {
      surface(on)
      await log($)
      const pane = await mountLog($, where)
      const keys = (await pane.findAll({})).map(element => element.key)

      expect(keys.filter(key => key === 'logo')).toHaveLength(1)
      expect(keys.indexOf('message')).toBeGreaterThanOrEqual(0)
      expect(keys.indexOf('tab-latest')).toBeGreaterThan(keys.indexOf('message'))
      expect(keys.indexOf('settings')).toBeGreaterThan(keys.indexOf('tab-latest'))
      expect(keys.indexOf('log-body')).toBeGreaterThan(keys.indexOf('settings'))
    })
  }

  async function tabs(pane: Awaited<ReturnType<typeof mountLog<'terminal'>>>): Promise<string[]> {
    return (await pane.findAll({ type: 'Button' }))
      .map(button => button.key ?? '')
      .filter(key => key.startsWith('tab-'))
  }

  test('the tabs are following, latest, trending and starred once signed in', async ($, on) => {
    signedIn(on)
    webSite(on)
    await log($)

    expect(await tabs(await mountLog($, 'terminal'))).toEqual([
      'tab-following',
      'tab-latest',
      'tab-trending',
      'tab-starred',
    ])
  })

  test('the starred tab shows the commits starred, as the device approved reads them', async ($, on) => {
    signedIn(on)
    const requests = webSite(on, { pages: { '/starred': { data: [webCommit('s1')] } } })
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'tab-starred' })

    expect(await pane.find({ key: 'commit-s1' })).toBeDefined()
    expect(requests.map(request => new URL(request.url).pathname)).toContain('/api/v1/starred')
  })

  test('the commits starred are forgotten once the approval of the device is', async ($, on) => {
    const { store } = signedIn(on)
    webSite(on, { pages: { '/starred': { data: [webCommit('s1')] } } })
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'tab-starred' })

    expect(store.has('webLog.starred')).toBe(true)

    await pane.press({ key: 'settings' })
    await pane.press({ key: 'device-forget' })

    expect(store.has('webLog.starred')).toBe(false)
  })

  test('the following and starred tabs hide while no one is signed in, and the log opens on latest', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    await log($)
    const pane = await mountLog($, 'terminal')

    expect(await tabs(pane)).toEqual(['tab-latest', 'tab-trending'])
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
  })

  test('settings replace the log under the tabs, and a tab shows it again', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'settings' })

    expect(await pane.find({ key: 'device-sign-in' })).toBeDefined()
    expect(await pane.find({ key: 'log-body' })).toBeUndefined()
    expect(await pane.find({ key: 'message' })).toBeDefined()

    await pane.press({ key: 'tab-latest' })

    expect(await pane.find({ key: 'log-body' })).toBeDefined()
    expect(await pane.find({ key: 'device-sign-in' })).toBeUndefined()
  })

  test('settings close on a second press, showing the log they were opened from', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/trending': { data: [webCommit('t1')] } } })
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'tab-trending' })
    await pane.press({ key: 'settings' })
    await pane.press({ key: 'settings' })

    expect(await pane.find({ key: 'commit-t1' })).toBeDefined()
    expect(await pane.find({ key: 'device-sign-in' })).toBeUndefined()
  })

  test('the toolbar draws no refresh, a tab pressed loading its log again', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')

    expect(await pane.find({ key: 'refresh' })).toBeUndefined()
    expect((await pane.find({ key: 'tabs' }))?.text).not.toContain('🔄')
  })

  test('settings turn auto refresh on or off, which the toolbar does not', async ($, on) => {
    const { store } = surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')

    expect(await pane.find({ key: 'auto' })).toBeUndefined()

    await pane.press({ key: 'settings' })
    await pane.press({ key: 'auto-on' })

    expect(store.get('autoRefresh')).toBe(true)

    await pane.press({ key: 'auto-off' })

    expect(store.get('autoRefresh')).toBe(false)
  })

  test('settings show the composer above the prompt always, or on demand, as chosen', async ($, on) => {
    const { store } = surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'settings' })
    await pane.press({ key: 'mode-always' })

    expect(store.get('mode')).toBe('always')

    await pane.press({ key: 'mode-manual' })

    expect(store.get('mode')).toBe('manual')
  })

  test('the command closes an open log', async ($, on) => {
    const panes = surface(on)
    await log($)
    const text = await log($)

    expect(text).toBe('Log closed.')
    expect(panes.closed).toEqual([PANE])
  })

  test('the log opens again once closed', async ($, on) => {
    const panes = surface(on)
    await log($)
    await log($)
    await log($)

    expect(panes.opened).toHaveLength(2)
  })
})

describe('log and compose', () => {
  test('the compose band hides while the log is open, in always mode', async ($, on) => {
    surface(on, { mode: 'always' })
    await log($)
    const band = await mountBand($)

    expect(await band.find({ key: 'message' })).toBeUndefined()
  })

  test('the compose band comes back when the log closes, in always mode', async ($, on) => {
    surface(on, { mode: 'always' })
    await log($)
    await log($)
    const band = await mountBand($)

    expect(await band.find({ key: 'message' })).toBeDefined()
  })

  test('an open compose band closes for good when the log opens, in manual mode', async ($, on) => {
    surface(on)
    await run($, 'dev-null:compose')
    await log($)
    await log($)
    const band = await mountBand($)

    expect(await band.find({ key: 'message' })).toBeUndefined()
  })

  test('the compose command keeps the band hidden while the log is open', async ($, on) => {
    surface(on)
    await log($)
    await run($, 'dev-null:compose')
    const band = await mountBand($)

    expect(await band.find({ key: 'message' })).toBeUndefined()
  })
})

describe('log composer', () => {
  const COMMITTED = 'Committed: https://dev-null.sh/@me/commits/1'

  for (const where of ['terminal', 'desktop'] as const) {
    test(`the pane ends with the composer on ${where}`, async ($, on) => {
      surface(on)
      await log($)
      const pane = await mountLog($, where)

      expect(await pane.find({ type: 'Input', key: 'message' })).toBeDefined()
      expect(await pane.find({ type: 'Input', key: 'reply' })).toBeDefined()
      expect(await pane.find({ type: 'Button', key: 'cancel' })).toBeDefined()
    })
  }

  test('the reply field stands out once filled', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')

    expect((await pane.find({ key: 'reply-field' }))?.props.backgroundColor).toBeUndefined()

    await pane.input({ key: 'reply', text: '0be0130', kind: 'change' })

    expect((await pane.find({ key: 'reply-field' }))?.props.backgroundColor).toBe(REPLYING)
  })

  test('the composer checks the commit as it is typed', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.input({ key: 'message', text: 'It was DNS.', kind: 'change' })

    expect((await pane.find({ key: 'count' }))?.text).toBe('11 / 4,000')
    expect(await pane.find({ type: 'Button', key: 'commit' })).toBeDefined()

    await pane.input({ key: 'message', text: '  ', kind: 'change' })

    expect((await pane.find({ key: 'error' }))?.text).toBe('At least 1 character.')
    expect(await pane.find({ key: 'commit' })).toBeUndefined()
  })

  test('the composer commits verbatim and stays open, emptied', async ($, on) => {
    surface(on)
    const { runs, toasts } = fakeCommitScript(on, { stdout: COMMITTED })
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.input({ key: 'message', text: 'Agreed!', kind: 'change' })
    await pane.input({ key: 'reply', text: '0be0130', kind: 'change' })
    await pane.press({ key: 'commit' })

    expect(runs).toHaveLength(1)
    expect(runs[0]?.stdin).toBe('Agreed!')
    expect(runs[0]?.argv.slice(1)).toEqual(['--reply', '0be0130'])
    expect(toasts).toEqual([COMMITTED])
    expect((await pane.find({ key: 'message' }))?.props.value).toBe('')
    expect((await pane.find({ key: 'reply' }))?.props.value).toBe('')
  })

  test('enter in the composer commits', async ($, on) => {
    surface(on)
    const { runs } = fakeCommitScript(on, { stdout: COMMITTED })
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.input({ key: 'message', text: 'It was DNS.' })

    expect(runs).toHaveLength(1)
  })

  test('clear empties the draft and keeps the log open', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.input({ key: 'message', text: 'It was DNS.', kind: 'change' })

    expect((await pane.find({ key: 'cancel' }))?.props.label).toBe('Clear')

    await pane.press({ key: 'cancel' })

    expect((await pane.find({ key: 'message' }))?.props.value).toBe('')
    expect(await pane.find({ key: 'logo' })).toBeDefined()
  })

  test('the band and the log share the draft', async ($, on) => {
    surface(on, { mode: 'always' })
    const band = await mountBand($)
    await band.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await log($)
    const pane = await mountLog($, 'terminal')

    expect((await pane.find({ key: 'message' }))?.props.value).toBe('It was DNS.')

    await pane.input({ key: 'message', text: 'It was always DNS.', kind: 'change' })
    await log($)
    await band.redraw()

    expect((await band.find({ key: 'message' }))?.props.value).toBe('It was always DNS.')
  })
})

describe('the tab kept after a /clear', () => {
  const pages = { '/log/latest': { data: [webCommit('l1')] }, '/log/trending': { data: [webCommit('t1')] } }

  test('keeps the tab shown in the store', async ($, on) => {
    const { store } = surface(on)
    webSite(on, { pages })
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'tab-trending' })

    expect(store.get('logTab')).toEqual({ version: 1, value: 'trending' })
  })

  test('opens the log on the tab the store kept', async ($, on) => {
    surface(on, { logTab: { version: 1, value: 'trending' } })
    webSite(on, { pages })
    await log($)
    const pane = await mountLog($, 'terminal')

    expect(await pane.find({ key: 'commit-t1' })).toBeDefined()
    expect(await pane.find({ key: 'commit-l1' })).toBeUndefined()
  })

  const unreadable: Record<string, unknown> = {
    'of a newer version': { version: 2, value: 'trending' },
    'no tab': { version: 1, value: 'saved' },
    'no tab any more': { version: 1, value: 'account' },
    'a view no tab opens': { version: 1, value: 'settings' },
    'not sealed': 'trending',
  }

  for (const [why, logTab] of Object.entries(unreadable)) {
    test(`opens the log on the first tab when what the store kept is ${why}`, async ($, on) => {
      const { store } = surface(on, { logTab })
      webSite(on, { pages })
      await log($)
      const pane = await mountLog($, 'terminal')

      expect(await pane.find({ key: 'commit-l1' })).toBeDefined()
      expect(store.has('logTab')).toBe(false)
    })
  }
})
