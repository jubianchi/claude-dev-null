import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { log, mountLog, surface } from './support'

const COOKIE = 'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=eyJpdiI6secret'

/** Answers the web app's terms page, signing in `username` with COOKIE and no one without; records each request. */
function webApp(on: On, username = 'jubianchi'): { url: string; cookie?: string }[] {
  const requests: { url: string; cookie?: string }[] = []

  on('http.fetch', (_$, e) => {
    const cookie = e.init?.headers?.Cookie
    requests.push({ url: e.url, ...(cookie === undefined ? {} : { cookie }) })
    const user = cookie === COOKIE ? { username } : null

    return {
      value: {
        status: 200,
        ok: true,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify({ component: 'terms/show', props: { auth: { user } }, url: '/terms', version: 'v1' }),
      },
    }
  })

  return requests
}

async function account($: Engine) {
  await log($)
  const pane = await mountLog($, 'terminal')
  await pane.press({ key: 'tab-account' })

  return pane
}

describe('the account of the log', () => {
  test('comes after the logs, and says how to sign in', async ($, on) => {
    surface(on)
    webApp(on)
    const pane = await account($)
    const keys = (await pane.findAll({})).map(element => element.key ?? '')
    const shown = (await pane.find({ key: 'account-body' }))?.text ?? ''

    expect(keys.indexOf('tab-account')).toBeGreaterThan(keys.indexOf('tab-trending'))
    expect(shown).toContain('https://dev-null.sh')
    expect(shown).toContain('remember_web_')
    expect(await pane.find({ key: 'cookie' })).toBeDefined()
  })

  test('warns that the cookie stands in for a sign-in /dev/null does not offer yet', async ($, on) => {
    surface(on)
    webApp(on)
    const warning = await (await account($)).find({ key: 'cookie-warning' })

    expect(warning?.props).toMatchObject({ borderStyle: 'round', borderColor: 'warning' })
    expect(warning?.text).toContain('stopgap')
    expect(warning?.text).toContain('https://github.com/nunomaduro/dev-null.sh/pull/130')
  })

  test('warns once signed in too', async ($, on) => {
    surface(on, { cookie: COOKIE, username: 'jubianchi' })
    webApp(on)

    expect(await (await account($)).find({ key: 'cookie-warning' })).toBeDefined()
  })

  test('opens dev-null.sh, to copy the cookie from', async ($, on) => {
    surface(on)
    webApp(on)
    const link = await (await account($)).find({ type: 'Link', text: 'Open dev-null.sh' })

    expect(link?.props.href).toBe('https://dev-null.sh')
  })

  test('signs in with the cookie pasted, and keeps it for the next sessions', async ($, on) => {
    const { store } = surface(on)
    webApp(on)
    const pane = await account($)
    await pane.input({ key: 'cookie', text: `Cookie: XSRF-TOKEN=abc; ${COOKIE}` })

    expect(store.get('cookie')).toBe(COOKIE)
    expect(store.get('username')).toBe('jubianchi')
    expect((await pane.find({ key: 'account-body' }))?.text).toContain('Signed in to /dev/null as @jubianchi.')
    expect(await pane.find({ key: 'cookie' })).toBeUndefined()
  })

  test('never shows the cookie once signed in', async ($, on) => {
    surface(on)
    webApp(on)
    const pane = await account($)
    await pane.input({ key: 'cookie', text: COOKIE })

    expect((await pane.findAll({ text: 'secret' })).length).toBe(0)
  })

  test('sends the cookie to /dev/null only', async ($, on) => {
    surface(on)
    const requests = webApp(on)
    const pane = await account($)
    await pane.input({ key: 'cookie', text: COOKIE })

    expect(requests.filter(request => request.cookie !== undefined).map(request => request.url)).toEqual([
      'https://dev-null.sh/terms',
    ])
  })

  test('says what to paste when it is not the remember cookie, and keeps nothing', async ($, on) => {
    const { store } = surface(on)
    const requests = webApp(on)
    const pane = await account($)
    await pane.input({ key: 'cookie', text: 'devnull-session=xyz' })

    expect((await pane.find({ key: 'account-error' }))?.text).toContain('Paste the remember_web_… cookie')
    expect(store.has('cookie')).toBe(false)
    expect(requests.filter(request => request.url.endsWith('/terms'))).toEqual([])
  })

  test('says when the cookie signs no one in, and keeps nothing', async ($, on) => {
    const { store } = surface(on)
    webApp(on)
    const pane = await account($)
    await pane.input({ key: 'cookie', text: 'remember_web_0123abcd=ended' })

    expect((await pane.find({ key: 'account-error' }))?.text).toContain('signs no one in')
    expect(store.has('cookie')).toBe(false)
  })

  test('is signed in from one session to the next', async ($, on) => {
    surface(on, { cookie: COOKIE, username: 'jubianchi' })
    webApp(on)
    const pane = await account($)

    expect((await pane.find({ key: 'account-body' }))?.text).toContain('Signed in to /dev/null as @jubianchi.')
  })

  test('forgets the cookie on demand', async ($, on) => {
    const { store } = surface(on, { cookie: COOKIE, username: 'jubianchi' })
    webApp(on)
    const pane = await account($)
    await pane.press({ key: 'sign-out' })

    expect(store.has('cookie')).toBe(false)
    expect(store.has('username')).toBe(false)
    expect(await pane.find({ key: 'cookie' })).toBeDefined()
  })
})
