import type { Api } from '../infrastructure/api'
import { ApiError } from '../infrastructure/api'
import { pollDevice, startDeviceSignIn } from '../infrastructure/api-device'

/** The name the device signs in under, which /dev/null shows the person approving it. */
const DEVICE_NAME = 'Claude Code'

/** How much longer to wait between polls when /dev/null asks to slow down, as RFC 8628 says. */
const SLOW_DOWN = 5_000

/** A sign-in of the device waiting for its approval: the code to type, where, until when and how often to ask. */
export type PendingSignIn = {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string
  /** In milliseconds. */
  expiresAt: number
  /** In milliseconds. */
  interval: number
}

const EXPIRED = 'The sign-in expired before the device was approved. Sign in again.'

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Starts signing in the device `api` signs as, at `now`; or says why it cannot. */
export async function startSignIn(
  api: Pick<Api, 'post'>,
  now: number,
): Promise<{ pending: PendingSignIn } | { error: string }> {
  try {
    const { expiresIn, interval, ...started } = await startDeviceSignIn(api, DEVICE_NAME)

    return { pending: { ...started, expiresAt: now + expiresIn * 1_000, interval: interval * 1_000 } }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { error: '/dev/null does not offer this sign-in yet (nunomaduro/dev-null.sh#585).' }
    }

    return { error: `Could not start signing in (${reason(error)}).` }
  }
}

/**
 * Asks once, at `now`, whether `pending` was approved: by whom, or the sign-in still waiting, maybe slower, or why it
 * ended.
 */
export async function pollSignIn(
  api: Pick<Api, 'post'>,
  pending: PendingSignIn,
  now: number,
): Promise<{ username: string } | { pending: PendingSignIn } | { error: string }> {
  if (now >= pending.expiresAt) {
    return { error: EXPIRED }
  }

  try {
    const polled = await pollDevice(api, pending.deviceCode)

    switch (polled.status) {
      case 'approved':
        return { username: polled.username }
      case 'pending':
        return { pending }
      case 'slow_down':
        return { pending: { ...pending, interval: pending.interval + SLOW_DOWN } }
      case 'denied':
        return { error: 'The device was denied on dev-null.sh. Sign in again if that was a mistake.' }
      case 'expired':
        return { error: EXPIRED }
    }
  } catch (error) {
    return { error: `Could not check the sign-in (${reason(error)}).` }
  }
}
