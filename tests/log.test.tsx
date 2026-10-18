import { describe, expect, test } from 'claude-code/testing'

import {
  COOKIE,
  fakeCommitScript,
  log,
  mountBand,
  mountLog,
  LOG_PANE as PANE,
  run,
  SIGNED_IN,
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
    test(`the pane draws the composer, then the tabs, then the log on ${where}`, async ($, on) => {
      surface(on)
      await log($)
      const pane = await mountLog($, where)
      const keys = (await pane.findAll({})).map(element => element.key)

      expect(keys.filter(key => key === 'logo')).toHaveLength(1)
      expect(keys.indexOf('message')).toBeGreaterThanOrEqual(0)
      expect(keys.indexOf('tab-latest')).toBeGreaterThan(keys.indexOf('message'))
      expect(keys.indexOf('tab-account')).toBeGreaterThan(keys.indexOf('tab-latest'))
      expect(keys.indexOf('log-body')).toBeGreaterThan(keys.indexOf('tab-account'))
    })
  }

  async function tabs(pane: Awaited<ReturnType<typeof mountLog<'terminal'>>>): Promise<string[]> {
    return (await pane.findAll({ type: 'Button' }))
      .map(button => button.key ?? '')
      .filter(key => key.startsWith('tab-'))
  }

  test('the tabs are following, latest, trending and account once signed in', async ($, on) => {
    surface(on, { cookie: COOKIE, username: SIGNED_IN })
    webSite(on)
    await log($)

    expect(await tabs(await mountLog($, 'terminal'))).toEqual([
      'tab-following',
      'tab-latest',
      'tab-trending',
      'tab-account',
    ])
  })

  test('the following tab hides while no one is signed in, and the log opens on latest', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    await log($)
    const pane = await mountLog($, 'terminal')

    expect(await tabs(pane)).toEqual(['tab-latest', 'tab-trending', 'tab-account'])
    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
  })

  test('the account tab replaces the log under the tabs, and back', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.press({ key: 'tab-account' })

    expect(await pane.find({ key: 'account-body' })).toBeDefined()
    expect(await pane.find({ key: 'log-body' })).toBeUndefined()
    expect(await pane.find({ key: 'message' })).toBeDefined()

    await pane.press({ key: 'tab-latest' })

    expect(await pane.find({ key: 'log-body' })).toBeDefined()
    expect(await pane.find({ key: 'account-body' })).toBeUndefined()
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

  test('the composer checks the commit as it is typed', async ($, on) => {
    surface(on)
    await log($)
    const pane = await mountLog($, 'terminal')
    await pane.input({ key: 'message', text: 'It was DNS.', kind: 'change' })

    expect((await pane.find({ key: 'count' }))?.text).toBe('11 / 4,000')
    expect(await pane.find({ type: 'Button', key: 'commit' })).toBeDefined()

    await pane.input({ key: 'message', text: 'ok', kind: 'change' })

    expect((await pane.find({ key: 'error' }))?.text).toBe('At least 3 characters.')
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
