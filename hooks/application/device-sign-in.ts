import type { PendingApproval, PendingSignIn } from '../../types'
import type { Api } from '../infrastructure/api'
import { ApiError } from '../infrastructure/api'
import { approvalUrl, codeIn, pollDevice, redeemCode, startDeviceSignIn } from '../infrastructure/api-device'
import type { Pkce } from '../pkce'

/** The name the device signs in under, which /dev/null shows the person approving it. */
const DEVICE_NAME = 'Claude Code'

/** How much longer to wait between polls when /dev/null asks to slow down, as RFC 8628 says. */
const SLOW_DOWN = 5_000

/**
 * What /dev/null answers the start of a sign-in it does not offer: no such route, or none for a POST, as production
 * answers while an address of the API takes other methods.
 */
const NOT_OFFERED: readonly number[] = [404, 405]

const EXPIRED = 'The sign-in expired before the device was approved. Sign in again.'

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Starts signing in the device `api` signs as, at `now`, with a code to type on dev-null.sh; while /dev/null offers no
 * such sign-in (dev-null-sh/dev-null.sh#585), asks for its approval as its app does instead, for the key of
 * `fingerprint` with the proof `pkce`; or says why it cannot.
 */
export async function startSignIn(
  api: Pick<Api, 'post'>,
  now: number,
  { fingerprint, pkce }: { fingerprint: string; pkce: Pkce },
): Promise<{ pending: PendingSignIn } | { approval: PendingApproval } | { error: string }> {
  try {
    const { expiresIn, interval, ...started } = await startDeviceSignIn(api, DEVICE_NAME)

    return { pending: { ...started, expiresAt: now + expiresIn * 1_000, interval: interval * 1_000 } }
  } catch (error) {
    if (error instanceof ApiError && NOT_OFFERED.includes(error.status)) {
      const { challenge, state, verifier } = pkce

      return {
        approval: { url: approvalUrl({ fingerprint, deviceName: DEVICE_NAME, challenge, state }), state, verifier },
      }
    }

    return { error: `Could not start signing in (${reason(error)}).` }
  }
}

/** Approves the device with the link dev-null.sh sent back for `approval`, once pasted: who approved it, or why not. */
export async function approveDevice(
  api: Pick<Api, 'post'>,
  approval: PendingApproval,
  pasted: string,
): Promise<{ username: string } | { error: string }> {
  const found = codeIn(pasted, approval.state)

  if ('error' in found) {
    return found
  }

  try {
    return await redeemCode(api, found.code, approval.verifier)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'invalid_grant') {
      return { error: 'This link expired, or was used already: approve the plugin again.' }
    }

    return { error: `Could not check the approval (${reason(error)}).` }
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
