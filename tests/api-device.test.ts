import { describe, expect, test } from 'claude-code/testing'

import type { Api } from '../hooks/infrastructure/api'
import { ApiError } from '../hooks/infrastructure/api'
import { pollDevice, startDeviceSignIn } from '../hooks/infrastructure/api-device'

const STARTED = {
  device_code: 'b4c0d3',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://dev-null.sh/activate',
  verification_uri_complete: 'https://dev-null.sh/activate?user_code=WDJB-MJHT',
  expires_in: 900,
  interval: 5,
}

/** The API answering `answer` to what it is sent, recorded, or refusing it with `answer` when it is an error. */
function sender(answer: unknown): Pick<Api, 'post'> & { sent: [string, Record<string, string>][] } {
  const sent: [string, Record<string, string>][] = []

  return {
    sent,
    post: async (path, payload) => {
      sent.push([path, payload])

      if (answer instanceof Error) {
        throw answer
      }

      return answer
    },
  }
}

function refusal(code: string): ApiError {
  return new ApiError(`refused: ${code}`, 400, code)
}

describe('starting the sign-in of the device', () => {
  test('asks /dev/null for a code, under the name of the device', async () => {
    const api = sender(STARTED)

    expect(await startDeviceSignIn(api, 'Claude Code')).toEqual({
      deviceCode: 'b4c0d3',
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://dev-null.sh/activate',
      verificationUriComplete: 'https://dev-null.sh/activate?user_code=WDJB-MJHT',
      expiresIn: 900,
      interval: 5,
    })
    expect(api.sent).toEqual([['/api/v1/device-authorizations', { device_name: 'Claude Code' }]])
  })

  test('shows no page to type the code on but those of dev-null.sh', async () => {
    for (const uri of ['https://example.com/activate', 'http://dev-null.sh/activate', 'javascript:alert(1)']) {
      await expect(
        startDeviceSignIn(sender({ ...STARTED, verification_uri_complete: uri }), 'Claude Code'),
      ).rejects.toThrow('/dev/null sent no sign-in')
    }
  })

  test('says when /dev/null sends no sign-in', async () => {
    for (const answer of [{}, { ...STARTED, device_code: 1 }, { ...STARTED, interval: '5' }, null, []]) {
      await expect(startDeviceSignIn(sender(answer), 'Claude Code')).rejects.toThrow('/dev/null sent no sign-in')
    }
  })
})

describe('polling for the approval of the device', () => {
  test('says who approved it, once they did', async () => {
    const api = sender({ data: { id: '01', username: 'octocat', name: 'The Octocat' } })

    expect(await pollDevice(api, 'b4c0d3')).toEqual({ status: 'approved', username: 'octocat' })
    expect(api.sent).toEqual([['/api/v1/devices', { device_code: 'b4c0d3' }]])
  })

  test('says what /dev/null still waits for, or why it ended', async () => {
    expect(await pollDevice(sender(refusal('authorization_pending')), 'b4c0d3')).toEqual({ status: 'pending' })
    expect(await pollDevice(sender(refusal('slow_down')), 'b4c0d3')).toEqual({ status: 'slow_down' })
    expect(await pollDevice(sender(refusal('access_denied')), 'b4c0d3')).toEqual({ status: 'denied' })
    expect(await pollDevice(sender(refusal('invalid_grant')), 'b4c0d3')).toEqual({ status: 'expired' })
  })

  test('lets through any other refusal', async () => {
    for (const code of ['invalid_signature', 'constructor']) {
      await expect(pollDevice(sender(refusal(code)), 'b4c0d3')).rejects.toThrow(`refused: ${code}`)
    }
  })

  test('says when /dev/null names no one', async () => {
    await expect(pollDevice(sender({ data: {} }), 'b4c0d3')).rejects.toThrow('/dev/null named no one')
  })
})
