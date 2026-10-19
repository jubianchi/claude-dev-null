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

  const username = record(record(approved)?.data)?.username

  if (typeof username !== 'string' || username === '') {
    throw new ApiError('/dev/null named no one for the device.', 200)
  }

  return { status: 'approved', username }
}
