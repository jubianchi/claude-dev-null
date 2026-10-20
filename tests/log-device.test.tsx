import type { On, ProcessRunInit } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { seal } from '../hooks/versioned'
import { COOKIE, held, log, mountLog, SIGNED_IN, surface } from './support'

const PUBLIC = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIZtH7X2lV6hO1Cm2rEHdA4nbXo2nOq0v2O3yXo6Zw1r dev-null'
const FINGERPRINT = 'SHA256:Q0pTMVuu8Nb2lb8ZQZp3mJqB8X2b0e3B1Gd6l7VY0rk'
const PRIVATE = [
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWprivate',
  '-----END OPENSSH PRIVATE KEY-----',
].join('\n')
const KEY = { publicKey: PUBLIC, fingerprint: FINGERPRINT, privateKey: PRIVATE }

const STARTED = {
  device_code: 'b4c0d3',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://dev-null.sh/activate',
  verification_uri_complete: 'https://dev-null.sh/activate?user_code=WDJB-MJHT',
  expires_in: 900,
  interval: 5,
}

type Answer = { status: number; body: unknown }

const PENDING: Answer = {
  status: 400,
  body: { message: 'Waiting for the device to be approved on the web.', code: 'authorization_pending' },
}
const APPROVED: Answer = { status: 200, body: { data: { username: 'octocat' } } }

type Device = {
  /** The runs of device-key.sh, with what they were given. */
  runs: { argv: readonly string[]; init?: ProcessRunInit }[]
  /** The requests to the API, by method and path, with their headers. */
  requests: { method: string; path: string; headers: Record<string, string> }[]
  /** What /dev/null answers the start of a sign-in. */
  start: Answer
  /** What /dev/null answers each poll, in turn, the last one again once there is no other. */
  polls: Answer[]
  /** What the requests to the API wait for before /dev/null answers, for a test to act meanwhile. */
  until?: Promise<unknown>
}

/** device-key.sh, creating KEY and signing anything, and the sign-in of the API, as `device` says: nothing is sent. */
function device(on: On, start: Answer = { status: 201, body: STARTED }, polls: Answer[] = [PENDING]): Device {
  const faked: Device = { runs: [], requests: [], start, polls }

  on('process.run', (_$, e) => {
    if (!e.argv[0]?.endsWith('/hooks/device-key.sh')) {
      return { deny: 'only device-key.sh runs here' }
    }

    faked.runs.push({ argv: e.argv, ...(e.init === undefined ? {} : { init: e.init }) })
    const stdout = e.argv[1] === 'create' ? `${PUBLIC}\n${FINGERPRINT}\n${PRIVATE}\n` : 'c2lnbmF0dXJl\n'

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('http.fetch', async (_$, e) => {
    const url = new URL(e.url)
    faked.requests.push({ method: e.init?.method ?? 'GET', path: url.pathname, headers: e.init?.headers ?? {} })

    if (url.pathname.startsWith('/api/')) {
      await faked.until
    }

    const answer =
      url.pathname === '/api/v1/device-authorizations'
        ? faked.start
        : url.pathname === '/api/v1/devices'
          ? ((faked.polls.length > 1 ? faked.polls.shift() : faked.polls[0]) ?? PENDING)
          : { status: 404, body: { message: 'Not Found' } }

    return {
      value: {
        status: answer.status,
        ok: answer.status >= 200 && answer.status < 300,
        headers: { 'content-type': 'application/json' },
        text: JSON.stringify(answer.body),
      },
    }
  })

  return faked
}

async function account($: Engine) {
  await log($)
  const pane = await mountLog($, 'terminal')
  await pane.press({ key: 'tab-account' })

  return pane
}

function polls(faked: Device): number {
  return faked.requests.filter(request => request.path === '/api/v1/devices').length
}

describe('signing in the device', () => {
  test('offers to approve the plugin on dev-null.sh', async ($, on) => {
    surface(on)
    device(on)
    const pane = await account($)

    expect(await pane.find({ key: 'device-start' })).toBeDefined()
    expect((await pane.find({ key: 'device-sign-in' }))?.text).toContain('nunomaduro/dev-null.sh#585')
  })

  test('creates the key of the device once, and keeps it', async ($, on) => {
    const { store } = surface(on)
    const faked = device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })

    expect(faked.runs.filter(run => run.argv[1] === 'create').length).toBe(1)
    expect(faked.runs[0]?.argv[0]).toMatch(/\/hooks\/device-key\.sh$/)
    expect(store.get('deviceKey')).toEqual(seal(1, KEY))
  })

  test('starts once while it starts, however fast it is pressed, and says so', async ($, on) => {
    const { store } = surface(on)
    const faked = device(on)
    const { until, release } = held()
    faked.until = until
    const pane = await account($)
    const first = pane.press({ key: 'device-start' })
    const second = pane.press({ key: 'device-start' })
    await pane.redraw()

    expect(await pane.find({ key: 'device-start' })).toBeUndefined()
    expect((await pane.find({ key: 'device-starting' }))?.text).toContain('Starting…')

    release()
    await first
    await second

    expect(faked.runs.filter(run => run.argv[1] === 'create').length).toBe(1)
    expect(faked.requests.filter(request => request.path === '/api/v1/device-authorizations').length).toBe(1)
    expect(store.get('deviceKey')).toEqual(seal(1, KEY))
  })

  test('leaves a sign-in that was cancelled, and shows the one started since', async ($, on) => {
    const panes = surface(on)
    const faked = device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    const { until, release } = held()
    faked.until = until
    await panes.clock.advance(5_000)
    await pane.press({ key: 'device-cancel' })
    faked.until = undefined
    faked.start = { status: 201, body: { ...STARTED, device_code: 'n3w', user_code: 'BCDF-GHJK' } }
    await pane.press({ key: 'device-start' })
    release()
    await panes.clock.advance(0)

    expect((await pane.find({ key: 'device-code' }))?.text).toContain('BCDF-GHJK')

    await panes.clock.advance(5_000)

    expect(polls(faked)).toBe(2)
  })

  test('signs with the key it keeps, without creating another', async ($, on) => {
    surface(on, { deviceKey: seal(1, KEY) })
    const faked = device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })

    expect(faked.runs.map(run => run.argv[1])).toEqual(['sign'])
    expect(
      faked.requests.filter(request => request.path.startsWith('/api/')).map(request => [request.method, request.path]),
    ).toEqual([['POST', '/api/v1/device-authorizations']])
  })

  test('shows the code to type, and the page to type it on', async ($, on) => {
    surface(on)
    device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })

    expect((await pane.find({ key: 'device-code' }))?.text).toContain('WDJB-MJHT')
    expect((await pane.find({ type: 'Link', text: 'https://dev-null.sh/activate' }))?.props.href).toBe(
      'https://dev-null.sh/activate?user_code=WDJB-MJHT',
    )
    expect(await pane.find({ key: 'device-start' })).toBeUndefined()
  })

  test('asks whether the device was approved, as often as /dev/null says', async ($, on) => {
    const panes = surface(on)
    const faked = device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    await panes.clock.advance(4_999)

    expect(polls(faked)).toBe(0)

    await panes.clock.advance(1)
    await panes.clock.advance(5_000)

    expect(polls(faked)).toBe(2)
    expect((await pane.find({ key: 'device-code' }))?.text).toContain('WDJB-MJHT')
  })

  test('asks less often when /dev/null says to slow down', async ($, on) => {
    const panes = surface(on)
    const slowDown = { status: 400, body: { message: 'Asking too often.', code: 'slow_down' } }
    const faked = device(on, undefined, [slowDown, PENDING])
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    await panes.clock.advance(5_000)
    await panes.clock.advance(5_000)

    expect(polls(faked)).toBe(1)

    await panes.clock.advance(5_000)

    expect(polls(faked)).toBe(2)
  })

  test('says who approved the device, keeps it, and stops asking', async ($, on) => {
    const panes = surface(on)
    const faked = device(on, undefined, [PENDING, APPROVED])
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    await panes.clock.advance(10_000)

    expect((await pane.find({ key: 'device-sign-in' }))?.text).toContain('@octocat')
    expect(panes.store.get('deviceUser')).toEqual(seal(1, 'octocat'))

    await panes.clock.advance(60_000)

    expect(polls(faked)).toBe(2)
  })

  test('is approved from one session to the next', async ($, on) => {
    surface(on, { deviceKey: seal(1, KEY), deviceUser: seal(1, 'octocat') })
    device(on)
    const pane = await account($)

    expect((await pane.find({ key: 'device-sign-in' }))?.text).toContain('@octocat')
    expect(await pane.find({ key: 'device-start' })).toBeUndefined()
  })

  test('forgets the approval on demand, and keeps the key', async ($, on) => {
    const { store } = surface(on, { deviceKey: seal(1, KEY), deviceUser: seal(1, 'octocat') })
    device(on)
    const pane = await account($)
    await pane.press({ key: 'device-forget' })

    expect(store.has('deviceUser')).toBe(false)
    expect(store.has('deviceKey')).toBe(true)
    expect(await pane.find({ key: 'device-start' })).toBeDefined()
  })

  test('says why the sign-in ended, and stops asking', async ($, on) => {
    const panes = surface(on)
    const denied = { status: 400, body: { message: 'Denied.', code: 'access_denied' } }
    const faked = device(on, undefined, [denied])
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    await panes.clock.advance(5_000)

    expect((await pane.find({ key: 'device-error' }))?.text).toContain('denied')
    expect(await pane.find({ key: 'device-start' })).toBeDefined()

    await panes.clock.advance(60_000)

    expect(polls(faked)).toBe(1)
  })

  test('says when /dev/null does not offer this sign-in yet', async ($, on) => {
    surface(on)
    device(on, { status: 404, body: { message: 'Not Found' } })
    const pane = await account($)
    await pane.press({ key: 'device-start' })

    expect((await pane.find({ key: 'device-error' }))?.text).toContain('does not offer this sign-in yet')
  })

  test('stops asking on demand', async ($, on) => {
    const panes = surface(on)
    const faked = device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    await pane.press({ key: 'device-cancel' })
    await panes.clock.advance(60_000)

    expect(polls(faked)).toBe(0)
    expect(await pane.find({ key: 'device-start' })).toBeDefined()
  })

  test('never shows the private key, nor passes it as an argument', async ($, on) => {
    const panes = surface(on)
    const faked = device(on, undefined, [PENDING, APPROVED])
    const pane = await account($)
    await pane.press({ key: 'device-start' })
    await panes.clock.advance(10_000)

    expect((await pane.findAll({ text: 'private' })).length).toBe(0)
    expect(faked.runs.some(run => run.argv.join(' ').includes('PRIVATE KEY'))).toBe(false)
    expect(faked.runs.filter(run => run.argv[1] === 'sign').map(run => run.init?.env?.DEVNULL_KEY)).toEqual([
      PRIVATE,
      PRIVATE,
      PRIVATE,
    ])
  })

  test('sends no cookie with the sign-in', async ($, on) => {
    surface(on, { cookie: COOKIE, username: SIGNED_IN })
    const faked = device(on)
    const pane = await account($)
    await pane.press({ key: 'device-start' })

    expect(
      faked.requests.filter(request => request.path.startsWith('/api/')).map(request => request.headers.Cookie),
    ).toEqual([undefined])
  })
})
