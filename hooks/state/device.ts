import type { EngineInterface, Timer } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { PendingSignIn } from '../../types'
import { approveDevice, pollSignIn, startSignIn } from '../application/device-sign-in'
import type { Api } from '../infrastructure/api'
import { api } from '../infrastructure/api'
import type { DeviceKey } from '../infrastructure/device-key'
import { createKey, sign } from '../infrastructure/device-key'
import { pkce } from '../pkce'
import type { Kept } from './stored'
import { readKept, writeKept } from './stored'

const deviceSignIn = atom({ plugin: 'dev-null', key: 'deviceSignIn' } as const, null)
const deviceApproval = atom({ plugin: 'dev-null', key: 'deviceApproval' } as const, null)
const approvalDraft = atom({ plugin: 'dev-null', key: 'approvalDraft' } as const, '')
const deviceError = atom({ plugin: 'dev-null', key: 'deviceError' } as const, '')
const isDeviceStarting = atom({ plugin: 'dev-null', key: 'isDeviceStarting' } as const, false)
const isDeviceUserLoaded = atom({ plugin: 'dev-null', key: 'isDeviceUserLoaded' } as const, false)
const deviceUser = atom({ plugin: 'dev-null', key: 'deviceUser' } as const, '')

function random(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/** The key of the device, created once and kept for the next sessions: /dev/null knows the device by it. */
const keptKey: Kept<DeviceKey> = {
  key: 'deviceKey',
  version: 1,
  migrations: {},
  read: value => {
    const key = value as Partial<DeviceKey> | null

    return typeof key === 'object' &&
      key !== null &&
      isText(key.publicKey) &&
      isText(key.fingerprint) &&
      isText(key.privateKey)
      ? { publicKey: key.publicKey, fingerprint: key.fingerprint, privateKey: key.privateKey }
      : undefined
  },
}

/** The username of whoever approved the device, kept apart from the cookie's until the log reads the API. */
const keptUser: Kept<string> = {
  key: 'deviceUser',
  version: 1,
  migrations: {},
  read: value => (isText(value) ? value : undefined),
}

function script($: EngineInterface): string {
  return `${$.plugin.root}/hooks/device-key.sh`
}

/** The key of the device, created the first time it is needed. */
async function deviceKeyOf($: EngineInterface): Promise<DeviceKey> {
  const kept = await readKept($, keptKey)

  if (kept !== undefined) {
    return kept
  }

  const created = await createKey((argv, init) => $.process.run(argv, init), script($))
  await writeKept($, keptKey, created)

  return created
}

/** The API, through the host's network, each request signed with `key`. */
function apiOf($: EngineInterface, key: DeviceKey): Api {
  return api({
    http: (url, init) => $.http.fetch(url, init),
    sign: message => sign((argv, init) => $.process.run(argv, init), script($), key, message),
    now: () => $.clock.now(),
    random,
  })
}

/** The username of whoever approved the device, '' while no one did. */
export async function deviceSignedInAs($: EngineInterface): Promise<string> {
  if (await read($, isDeviceUserLoaded)) {
    return read($, deviceUser)
  }

  return (await readKept($, keptUser)) ?? ''
}

/** The sign-in of the device under way, if one is, and why the last one failed, '' when it did not. */
export async function deviceSignInForm($: EngineInterface): Promise<{
  pending: PendingSignIn | null
  /** The page to approve the device on as the app of /dev/null, while that approval is under way. */
  approvalUrl: string | null
  draft: string
  error: string
  isStarting: boolean
}> {
  return {
    pending: await read($, deviceSignIn),
    approvalUrl: (await read($, deviceApproval))?.url ?? null,
    draft: await read($, approvalDraft),
    error: await read($, deviceError),
    isStarting: await read($, isDeviceStarting),
  }
}

/** What the person types in place of the link dev-null.sh sends back, kept in the state only. */
export async function typeApprovalLink($: EngineInterface, value: string): Promise<void> {
  await update($, approvalDraft, () => value)
}

async function setDeviceUser($: EngineInterface, name: string): Promise<void> {
  await update($, deviceUser, () => name)
  await update($, isDeviceUserLoaded, () => true)
}

/**
 * The poll of the sign-in under way, kept in the module with the session it was started in: a /clear starts the state
 * over, and with it the sign-in, which the poll then leaves.
 */
let polling: { session: string; timer: Timer } | undefined

function stopPolling(): void {
  polling?.timer.cancel()
  polling = undefined
}

async function ended($: EngineInterface, error: string): Promise<void> {
  stopPolling()
  await update($, deviceSignIn, () => null)
  await update($, deviceApproval, () => null)
  await update($, approvalDraft, () => '')
  await update($, deviceError, () => error)
}

async function approved($: EngineInterface, username: string): Promise<void> {
  await ended($, '')
  await writeKept($, keptUser, username)
  await setDeviceUser($, username)
}

/** Asks again whether the device was approved, once the interval of `pending` has passed. */
async function pollLater($: EngineInterface, key: DeviceKey, pending: PendingSignIn): Promise<void> {
  const session = await $.session.id()
  stopPolling()
  polling = { session, timer: $.clock.after(pending.interval, () => poll($, key, session)) }
}

async function poll($: EngineInterface, key: DeviceKey, session: string): Promise<void> {
  const pending = await read($, deviceSignIn)

  if (polling?.session !== session || (await $.session.id()) !== session || pending === null) {
    return
  }

  const polled = await pollSignIn(apiOf($, key), pending, await $.clock.now())

  if (polling?.session !== session || (await read($, deviceSignIn))?.deviceCode !== pending.deviceCode) {
    return
  }

  if ('error' in polled) {
    await ended($, polled.error)
  } else if ('pending' in polled) {
    await update($, deviceSignIn, () => polled.pending)
    await pollLater($, key, polled.pending)
  } else {
    await approved($, polled.username)
  }
}

/**
 * Whether a sign-in is being started: kept in the module, not in the state, which a dispatch reads at the one moment it
 * started: a second press, quick enough, would not see the first, and would create a second key.
 */
let starting = false

/**
 * Starts signing in the device, once at a time, then asks whether it was approved until it was, or the sign-in ends.
 */
export async function signInDevice($: EngineInterface): Promise<void> {
  if (starting) {
    return
  }

  starting = true
  await update($, isDeviceStarting, () => true)

  try {
    await startDevice($)
  } finally {
    starting = false
    await update($, isDeviceStarting, () => false)
  }
}

async function startDevice($: EngineInterface): Promise<void> {
  stopPolling()
  await update($, deviceError, () => '')

  let key: DeviceKey
  try {
    key = await deviceKeyOf($)
  } catch (error) {
    await ended(
      $,
      `Could not create the key of the device (${error instanceof Error ? error.message : String(error)}).`,
    )

    return
  }

  const proof = await pkce(random, data => crypto.subtle.digest('SHA-256', data))
  const started = await startSignIn(apiOf($, key), await $.clock.now(), {
    fingerprint: key.fingerprint,
    pkce: proof,
  })

  if ('error' in started) {
    await ended($, started.error)
  } else if ('approval' in started) {
    await update($, deviceApproval, () => started.approval)
  } else {
    await update($, deviceSignIn, () => started.pending)
    await pollLater($, key, started.pending)
  }
}

/** Whether a link is being redeemed: kept in the module, as `starting` is, for a second press to redeem nothing. */
let approving = false

/**
 * Approves the device with the link dev-null.sh sent back, as pasted, for the approval under way, once at a time; the
 * answer for an approval cancelled meanwhile is left.
 */
export async function approveWithLink($: EngineInterface, pasted: string): Promise<void> {
  const approval = await read($, deviceApproval)

  if (approval === null || approving) {
    return
  }

  approving = true
  await update($, approvalDraft, () => pasted)

  try {
    const found = await approveDevice(apiOf($, await deviceKeyOf($)), approval, pasted)

    if ((await read($, deviceApproval))?.state !== approval.state) {
      return
    }

    if ('error' in found) {
      await update($, deviceError, () => found.error)
    } else {
      await approved($, found.username)
    }
  } catch (error) {
    await update(
      $,
      deviceError,
      () => `Could not check the approval (${error instanceof Error ? error.message : String(error)}).`,
    )
  } finally {
    approving = false
  }
}

/** Stops the sign-in under way. */
export async function cancelDeviceSignIn($: EngineInterface): Promise<void> {
  await ended($, '')
}

/** Forgets whoever approved the device; the key stays, for /dev/null to know the device by when it signs in again. */
export async function forgetDeviceUser($: EngineInterface): Promise<void> {
  await $.store.delete(keptUser.key)
  await setDeviceUser($, '')
}
