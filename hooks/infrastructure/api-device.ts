import type { Api } from './api'
import { ApiError } from './api'

/** A sign-in of the device under way, as /dev/null started it: the code to type, where, and how often to poll. */
export type DeviceSignIn = {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string
  /** In seconds. */
  expiresIn: number
  /** In seconds. */
  interval: number
}

/** Where the sign-in of the device is: approved by someone, still waiting, asked to poll slower, or over. */
export type DevicePoll =
  | { status: 'approved'; username: string }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'denied' }
  | { status: 'expired' }

const ENDED: ReadonlyMap<string, DevicePoll> = new Map([
  ['authorization_pending', { status: 'pending' }],
  ['slow_down', { status: 'slow_down' }],
  ['access_denied', { status: 'denied' }],
  ['invalid_grant', { status: 'expired' }],
])

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isPage(value: unknown): value is string {
  return typeof value === 'string' && URL.canParse(value) && new URL(value).origin === 'https://dev-null.sh'
}

function isSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Starts signing in the device the API knows by the key `api` signs with, under `deviceName`. */
export async function startDeviceSignIn(api: Pick<Api, 'post'>, deviceName: string): Promise<DeviceSignIn> {
  const started = record(await api.post('/api/v1/device-authorizations', { device_name: deviceName }))
  const deviceCode = started?.device_code
  const userCode = started?.user_code
  const verificationUri = started?.verification_uri
  const verificationUriComplete = started?.verification_uri_complete
  const expiresIn = started?.expires_in
  const interval = started?.interval

  if (
    typeof deviceCode !== 'string' ||
    typeof userCode !== 'string' ||
    !isPage(verificationUri) ||
    !isPage(verificationUriComplete) ||
    !isSeconds(expiresIn) ||
    !isSeconds(interval)
  ) {
    throw new ApiError('/dev/null sent no sign-in.', 200)
  }

  return { deviceCode, userCode, verificationUri, verificationUriComplete, expiresIn, interval }
}

/** Asks /dev/null once whether the sign-in of `deviceCode` was approved. */
export async function pollDevice(api: Pick<Api, 'post'>, deviceCode: string): Promise<DevicePoll> {
  let approved: unknown

  try {
    approved = await api.post('/api/v1/devices', { device_code: deviceCode })
  } catch (error) {
    const ended = error instanceof ApiError && error.code !== null ? ENDED.get(error.code) : undefined

    if (ended === undefined) {
      throw error
    }

    return ended
  }

  return { status: 'approved', username: approver(approved) }
}

/** Who approved the device, as /dev/null answers once it does, as GET /api/v1/me would. */
function approver(approved: unknown): string {
  const username = record(record(approved)?.data)?.handle

  if (typeof username !== 'string' || username === '') {
    throw new ApiError('/dev/null named no one for the device.', 200)
  }

  return username
}

/**
 * Where the app of /dev/null asks the person to approve a device, for the key of `fingerprint`, under `deviceName`:
 * once they do, dev-null.sh sends them back to the app with a code, in a devnull://authorize link.
 */
export function approvalUrl({
  fingerprint,
  deviceName,
  challenge,
  state,
}: {
  fingerprint: string
  deviceName: string
  challenge: string
  state: string
}): string {
  const query = new URLSearchParams({
    fingerprint,
    device_name: deviceName,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    redirect_uri: APP_REDIRECT,
  })

  return `https://dev-null.sh/mobile/authorize?${query}`
}

/** Where dev-null.sh sends back the person who approved a device, for its app. */
const APP_REDIRECT = 'devnull://authorize'

/** The code in the link dev-null.sh sends back once the device is approved, for the sign-in of `state` only. */
export function codeIn(pasted: string, state: string): { code: string } | { error: string } {
  const link = pasted.trim()
  const url = URL.canParse(link) ? new URL(link) : null

  if (url === null || `${url.protocol}//${url.host}` !== APP_REDIRECT) {
    return { error: 'Paste the devnull://authorize?code=… link dev-null.sh sends back once you approve.' }
  }

  if (url.searchParams.get('state') !== state) {
    return { error: 'This link answers another sign-in: approve the plugin again from here.' }
  }

  const code = url.searchParams.get('code')

  return code === null || code === ''
    ? { error: 'The device was denied on dev-null.sh. Sign in again if that was a mistake.' }
    : { code }
}

/** Redeems `code` for the device, with the verifier of the challenge it was asked with; who approved it. */
export async function redeemCode(
  api: Pick<Api, 'post'>,
  code: string,
  verifier: string,
): Promise<{ username: string }> {
  return { username: approver(await api.post('/api/v1/devices', { code, code_verifier: verifier })) }
}
