import { describe, expect, test } from 'claude-code/testing'
import type { PendingSignIn } from '../hooks/application/device-sign-in'
import { pollSignIn, startSignIn } from '../hooks/application/device-sign-in'
import type { Api } from '../hooks/infrastructure/api'
import { ApiError } from '../hooks/infrastructure/api'

const NOW = Date.parse('2026-10-19T12:00:00Z')

const STARTED = {
  device_code: 'b4c0d3',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://dev-null.sh/activate',
  verification_uri_complete: 'https://dev-null.sh/activate?user_code=WDJB-MJHT',
  expires_in: 900,
  interval: 5,
}

const PENDING: PendingSignIn = {
  deviceCode: 'b4c0d3',
  userCode: 'WDJB-MJHT',
  verificationUri: 'https://dev-null.sh/activate',
  verificationUriComplete: 'https://dev-null.sh/activate?user_code=WDJB-MJHT',
  expiresAt: NOW + 900_000,
  interval: 5_000,
}

/** The API answering each path with `answers`, values or errors, and recording what it is sent. */
function sender(answers: Record<string, unknown>): Pick<Api, 'post'> & { sent: string[] } {
  const sent: string[] = []

  return {
    sent,
    post: async path => {
      sent.push(path)
      const answer = answers[path]

      if (answer instanceof Error) {
        throw answer
      }

      return answer
    },
  }
}

function refusal(code: string, status = 400): ApiError {
  return new ApiError(`refused: ${code}`, status, code)
}

describe('starting to sign in the device', () => {
  test('gives the code to type, where, until when, and how often to ask', async () => {
    const api = sender({ '/api/v1/device-authorizations': STARTED })

    expect(await startSignIn(api, NOW)).toEqual({ pending: PENDING })
  })

  test('says when /dev/null does not offer this sign-in yet', async () => {
    const api = sender({ '/api/v1/device-authorizations': new ApiError('Not Found', 404) })

    expect(await startSignIn(api, NOW)).toEqual({
      error: '/dev/null does not offer this sign-in yet (nunomaduro/dev-null.sh#585).',
    })
  })

  test('says why it could not start', async () => {
    const api = sender({ '/api/v1/device-authorizations': refusal('rate_limited', 429) })

    expect(await startSignIn(api, NOW)).toEqual({ error: 'Could not start signing in (refused: rate_limited).' })
  })
})

describe('asking whether the device was approved', () => {
  test('says who approved it', async () => {
    const api = sender({ '/api/v1/devices': { data: { username: 'octocat' } } })

    expect(await pollSignIn(api, PENDING, NOW + 5_000)).toEqual({ username: 'octocat' })
  })

  test('waits as long again while no one decided', async () => {
    const api = sender({ '/api/v1/devices': refusal('authorization_pending') })

    expect(await pollSignIn(api, PENDING, NOW + 5_000)).toEqual({ pending: PENDING })
  })

  test('waits 5 seconds more when asked to slow down', async () => {
    const api = sender({ '/api/v1/devices': refusal('slow_down') })

    expect(await pollSignIn(api, PENDING, NOW + 5_000)).toEqual({ pending: { ...PENDING, interval: 10_000 } })
  })

  test('says when the device was denied', async () => {
    const api = sender({ '/api/v1/devices': refusal('access_denied') })

    expect(await pollSignIn(api, PENDING, NOW + 5_000)).toEqual({
      error: 'The device was denied on dev-null.sh. Sign in again if that was a mistake.',
    })
  })

  test('says when the sign-in expired, without asking once it is past', async () => {
    const expired = { error: 'The sign-in expired before the device was approved. Sign in again.' }
    const api = sender({ '/api/v1/devices': refusal('invalid_grant') })

    expect(await pollSignIn(api, PENDING, NOW + 5_000)).toEqual(expired)
    expect(await pollSignIn(api, PENDING, PENDING.expiresAt)).toEqual(expired)
    expect(api.sent).toEqual(['/api/v1/devices'])
  })

  test('says why it could not ask', async () => {
    const api = sender({ '/api/v1/devices': refusal('invalid_signature', 401) })

    expect(await pollSignIn(api, PENDING, NOW + 5_000)).toEqual({
      error: 'Could not check the sign-in (refused: invalid_signature).',
    })
  })
})
