import { describe, expect, test } from 'claude-code/testing'

import type { ApiHttp } from '../hooks/infrastructure/api'
import { ApiError, api, DeviceNotApproved, RateLimited } from '../hooks/infrastructure/api'

const NOW = Date.parse('2026-10-19T12:00:00.750Z')
const BYTES = Uint8Array.from({ length: 16 }, (_, at) => at)
const NONCE = '000102030405060708090a0b0c0d0e0f'

type Request = { url: string; init: Parameters<ApiHttp>[1] }
type Answer = { status?: number; headers?: Record<string, string>; text?: string }

/** /dev/null answering `answer` to each request, recorded: nothing is sent. */
function server(answer: Answer = {}): { requests: Request[]; http: ApiHttp } {
  const requests: Request[] = []

  return {
    requests,
    http: async (url, init) => {
      requests.push({ url, init })
      const status = answer.status ?? 200

      return { status, ok: status >= 200 && status < 300, headers: answer.headers ?? {}, text: answer.text ?? '{}' }
    },
  }
}

/** A signer that signs nothing, recording the messages: the signature tells which. */
function signer(): { messages: string[]; sign: (message: string) => Promise<string> } {
  const messages: string[] = []

  return {
    messages,
    sign: async message => {
      messages.push(message)

      return `c2lnbmF0dXJl${messages.length}`
    },
  }
}

function client(http: ApiHttp, sign: (message: string) => Promise<string>) {
  return api({ http, sign, now: async () => NOW, random: length => BYTES.slice(0, length) })
}

describe('reading the API of /dev/null', () => {
  test('reads the JSON at a path of the API, on dev-null.sh', async () => {
    const { requests, http } = server({ text: '{"data":[]}' })

    expect(await client(http, signer().sign).get('/api/v1/log/latest')).toEqual({ data: [] })
    expect(requests.map(request => [request.url, request.init.method])).toEqual([
      ['https://dev-null.sh/api/v1/log/latest', 'GET'],
    ])
    expect(requests[0]?.init.headers.Accept).toBe('application/json')
  })

  test('signs the request: its time in seconds, a nonce, the method and the path with its query', async () => {
    const { requests, http } = server()
    const { messages, sign } = signer()
    await client(http, sign).get('/api/v1/log/latest?cursor=eyJpZCI6IjAxIn0%3D')

    expect(messages).toEqual([`1792411200\n${NONCE}\nGET\n/api/v1/log/latest?cursor=eyJpZCI6IjAxIn0%3D\n`])
    expect(requests[0]?.init.headers).toMatchObject({
      'X-Devnull-Timestamp': '1792411200',
      'X-Devnull-Nonce': NONCE,
      'X-SSH-Signature': 'c2lnbmF0dXJl1',
    })
  })

  test('sends the address it signed, as it signed it', async () => {
    const { requests, http } = server()
    const { messages, sign } = signer()
    await client(http, sign).get('/api/v1/commits/01a14f01-2689-70be-a5f1-cd5195a4428d/replies?cursor=a%2Bb&newest=1')

    expect(new URL(requests[0]?.url ?? '').pathname + new URL(requests[0]?.url ?? '').search).toBe(
      messages[0]?.split('\n')[3],
    )
  })

  test('reads nothing but the API of dev-null.sh', async () => {
    const { requests, http } = server()
    const { messages, sign } = signer()

    for (const path of [
      '/log/latest',
      '/api/v2/me',
      '/api/v1',
      '//example.com/api/v1/me',
      'https://example.com/api/v1/me',
      '/api/v1/../log/following',
      '/api/v1/%2e%2e/log/following',
      '/api/v1/me#fragment',
      '/api/v1/me?a=b c',
    ]) {
      await expect(client(http, sign).get(path)).rejects.toThrow('Not a path of the API of /dev/null')
    }

    expect(requests).toEqual([])
    expect(messages).toEqual([])
  })

  test('says that the device is not approved, when /dev/null knows no device by its key', async () => {
    const { http } = server({
      status: 401,
      text: '{"message":"This device is not approved.","code":"device_not_approved"}',
    })

    await expect(client(http, signer().sign).get('/api/v1/me')).rejects.toBeInstanceOf(DeviceNotApproved)
  })

  test('says how long to wait, when /dev/null limits the requests', async () => {
    const { http } = server({
      status: 429,
      headers: { 'retry-after': '42' },
      text: '{"message":"Too many requests.","code":"rate_limited"}',
    })
    const error = await client(http, signer().sign)
      .get('/api/v1/me')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(RateLimited)
    expect((error as RateLimited).retryAfter).toBe(42)
  })

  test('says why /dev/null refused, with its code and status', async () => {
    const { http } = server({
      status: 401,
      text: '{"message":"Signature expired. Check that your clock is right.","code":"invalid_signature"}',
    })
    const error = await client(http, signer().sign)
      .get('/api/v1/me')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(DeviceNotApproved)
    expect((error as ApiError).message).toBe('Signature expired. Check that your clock is right.')
    expect((error as ApiError).code).toBe('invalid_signature')
    expect((error as ApiError).status).toBe(401)
  })

  test('says the status when /dev/null gives no reason', async () => {
    const { http } = server({ status: 500, text: '<html>Server Error</html>' })

    await expect(client(http, signer().sign).get('/api/v1/me')).rejects.toThrow('HTTP 500')
  })

  test('says when /dev/null sends something that is not JSON', async () => {
    const { http } = server({ text: '<html></html>' })

    await expect(client(http, signer().sign).get('/api/v1/me')).rejects.toThrow('not JSON')
  })

  test('sends JSON to sign in, the body signed as sent', async () => {
    const { requests, http } = server({ status: 201, text: '{"device_code":"abc"}' })
    const { messages, sign } = signer()

    expect(await client(http, sign).post('/api/v1/device-authorizations', { device_name: 'Claude Code' })).toEqual({
      device_code: 'abc',
    })
    expect(requests.map(request => [request.url, request.init.method, request.init.body])).toEqual([
      ['https://dev-null.sh/api/v1/device-authorizations', 'POST', '{"device_name":"Claude Code"}'],
    ])
    expect(requests[0]?.init.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-SSH-Signature': 'c2lnbmF0dXJl1',
    })
    expect(messages).toEqual([
      `1792411200\n${NONCE}\nPOST\n/api/v1/device-authorizations\n{"device_name":"Claude Code"}`,
    ])
  })

  test('sends nothing but the sign-in, though the API takes commits too', async () => {
    const { requests, http } = server()
    const { messages, sign } = signer()

    for (const path of ['/api/v1/commits', '/api/v1/users/nunomaduro/follow', '/api/v1/devices?x=1', '/log/latest']) {
      await expect(client(http, sign).post(path, {})).rejects.toThrow('Not a route of the API the plugin sends to')
    }

    expect(requests).toEqual([])
    expect(messages).toEqual([])
  })

  test('says why /dev/null refused what it was sent', async () => {
    const { http } = server({
      status: 400,
      text: '{"message":"Waiting for the device to be approved on the web.","code":"authorization_pending"}',
    })
    const error = await client(http, signer().sign)
      .post('/api/v1/devices', { device_code: 'abc' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('authorization_pending')
  })

  test('signs each request with a nonce of its own', async () => {
    const { requests, http } = server()
    let draw = 0
    const reader = api({
      http,
      sign: signer().sign,
      now: async () => NOW,
      random: length => Uint8Array.from({ length }, () => draw++),
    })
    await reader.get('/api/v1/me')
    await reader.get('/api/v1/me')

    expect(requests[0]?.init.headers['X-Devnull-Nonce']).not.toBe(requests[1]?.init.headers['X-Devnull-Nonce'])
  })
})
