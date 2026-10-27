import { describe, expect, test } from 'claude-code/testing'

import type { Api } from '../hooks/infrastructure/api'
import { ApiError } from '../hooks/infrastructure/api'
import { approvalUrl, codeIn, pollDevice, redeemCode, startDeviceSignIn } from '../hooks/infrastructure/api-device'

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
    const api = sender({ data: { id: '01', handle: 'octocat', name: 'The Octocat' } })

    expect(await pollDevice(api, 'b4c0d3')).toEqual({ status: 'approved', handle: 'octocat' })
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
    await expect(pollDevice(sender({ data: { username: 'octocat' } }), 'b4c0d3')).rejects.toThrow(
      '/dev/null named no one',
    )
  })
})

describe('approving the device as the app of /dev/null', () => {
  const FINGERPRINT = 'SHA256:Q0pTMVuu8Nb2lb8ZQZp3mJqB8X2b0e3B1Gd6l7VY0rk'
  const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

  test('asks dev-null.sh to approve the key, under the name of the device, for its app', () => {
    const url = new URL(
      approvalUrl({ fingerprint: FINGERPRINT, deviceName: 'Claude Code', challenge: CHALLENGE, state: 's7' }),
    )

    expect(url.origin + url.pathname).toBe('https://dev-null.sh/mobile/authorize')
    const names = ['fingerprint', 'device_name', 'code_challenge', 'code_challenge_method', 'state', 'redirect_uri']

    expect(Object.fromEntries(names.map(name => [name, url.searchParams.get(name)]))).toEqual({
      fingerprint: FINGERPRINT,
      device_name: 'Claude Code',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 's7',
      redirect_uri: 'devnull://authorize',
    })
  })

  test('reads the code of the link dev-null.sh sends back, for this sign-in only', () => {
    expect(codeIn('devnull://authorize?code=c0de&state=s7', 's7')).toEqual({ code: 'c0de' })
    expect(codeIn('  devnull://authorize?state=s7&code=c0de\n', 's7')).toEqual({ code: 'c0de' })
    expect(codeIn('devnull://authorize?code=c0de&state=other', 's7')).toEqual({
      error: 'This link answers another sign-in: approve the plugin again from here.',
    })
    expect(codeIn('devnull://authorize?error=access_denied&state=s7', 's7')).toEqual({
      error: 'The device was denied on dev-null.sh. Sign in again if that was a mistake.',
    })
    for (const pasted of ['', 'https://dev-null.sh/authorize?code=c0de&state=s7', 'not a link']) {
      expect(codeIn(pasted, 's7')).toEqual({
        error: 'Paste the devnull://authorize?code=… link dev-null.sh sends back once you approve.',
      })
    }
  })

  test('redeems the code with the verifier of its challenge, and says who approved the device', async () => {
    const api = sender({ data: { handle: 'octocat' } })

    expect(await redeemCode(api, 'c0de', 'v3r1f13r')).toEqual({ handle: 'octocat' })
    expect(api.sent).toEqual([['/api/v1/devices', { code: 'c0de', code_verifier: 'v3r1f13r' }]])
  })
})
