import { nonceOf, signedMessage } from './signed-request'

const ORIGIN = 'https://dev-null.sh'
const PREFIX = '/api/v1/'
const NONCE_BYTES = 16

/** The route that commits, which the plugin never sends to: commits go through the official script. */
const COMMITS = /^\/api\/v1\/commits\/?(\?|$)/

type Method = 'GET' | 'POST' | 'DELETE'

export type ApiHttp = (
  url: string,
  init: { method: Method; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; headers: Record<string, string>; text: string }>

export type Api = {
  /** Reads the JSON at a path of the API, its query included. */
  get: (path: string) => Promise<unknown>
  /** Sends `payload` as JSON to a route of the API, but the one that commits, and reads the JSON it answers. */
  post: (path: string, payload: Record<string, string>) => Promise<unknown>
  /** Deletes at a route of the API, and reads the JSON it answers, null when it answers none. */
  delete: (path: string) => Promise<unknown>
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message)
  }
}

/** /dev/null knows no device by the key the request is signed with: it is to be approved first. */
export class DeviceNotApproved extends ApiError {}

/** /dev/null takes no more requests for now: they may come again in `retryAfter` seconds, when it says. */
export class RateLimited extends ApiError {
  constructor(
    message: string,
    status: number,
    code: string | null,
    readonly retryAfter: number | null,
  ) {
    super(message, status, code)
  }
}

function header(headers: Record<string, string>, name: string): string | undefined {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
}

/** The reason /dev/null gives for refusing a request, as `{message, code}`, if it gives one. */
function reason(text: string): { message?: string; code?: string } {
  try {
    const found = JSON.parse(text) as { message?: unknown; code?: unknown } | null

    return {
      ...(typeof found?.message === 'string' ? { message: found.message } : {}),
      ...(typeof found?.code === 'string' ? { code: found.code } : {}),
    }
  } catch {
    return {}
  }
}

function failure(status: number, headers: Record<string, string>, text: string): ApiError {
  const { message = `HTTP ${status}`, code = null } = reason(text)

  if (code === 'device_not_approved') {
    return new DeviceNotApproved(message, status, code)
  }

  if (status === 429) {
    const retryAfter = Number.parseInt(header(headers, 'Retry-After') ?? '', 10)

    return new RateLimited(message, status, code, Number.isNaN(retryAfter) ? null : retryAfter)
  }

  return new ApiError(message, status, code)
}

/** `value` in a query, encoded as RFC 3986 says, which the URL keeps as it is, unlike `encodeURIComponent`'s. */
function encoded(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, found => `%${found.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** `path` with the parameters of `query` that are given, in the order given. */
export function pathOf(path: string, query: Record<string, string | undefined> = {}): string {
  const parameters = Object.entries(query).flatMap(([name, value]) =>
    value === undefined ? [] : [`${encoded(name)}=${encoded(value)}`],
  )

  return parameters.length === 0 ? path : `${path}?${parameters.join('&')}`
}

/**
 * The URL of a path of the API of /dev/null, refusing anything that would go elsewhere, or that the URL would not
 * keep as it is, since the path is signed as sent.
 */
function urlOf(path: string): URL {
  const url = URL.canParse(path, ORIGIN) ? new URL(path, ORIGIN) : null

  if (
    url === null ||
    url.origin !== ORIGIN ||
    !url.pathname.startsWith(PREFIX) ||
    url.pathname === PREFIX ||
    url.pathname + url.search !== path
  ) {
    throw new ApiError(`Not a path of the API of /dev/null: ${path}`, 0)
  }

  return url
}

/**
 * Reads the API of /dev/null, each request signed by `sign` with the time `now` gives, in milliseconds, and a nonce
 * drawn from `random`: as the device of the key `sign` signs with.
 */
export function api({
  http,
  sign,
  now,
  random,
}: {
  http: ApiHttp
  sign: (message: string) => Promise<string>
  now: () => Promise<number>
  random: (length: number) => Uint8Array
}): Api {
  async function send(method: Method, path: string, body?: string): Promise<unknown> {
    const url = urlOf(path)
    const timestamp = Math.floor((await now()) / 1000)
    const nonce = nonceOf(random(NONCE_BYTES))
    const signature = await sign(
      signedMessage({ timestamp, nonce, method, uri: path, ...(body === undefined ? {} : { body }) }),
    )
    const response = await http(url.href, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-Devnull-Timestamp': String(timestamp),
        'X-Devnull-Nonce': nonce,
        'X-SSH-Signature': signature,
      },
      ...(body === undefined ? {} : { body }),
    })

    if (!response.ok) {
      throw failure(response.status, response.headers, response.text)
    }

    if (response.text.trim() === '') {
      return null
    }

    try {
      return JSON.parse(response.text) as unknown
    } catch {
      throw new ApiError('/dev/null sent something that is not JSON.', response.status)
    }
  }

  return {
    get: path => send('GET', path),
    async post(path, payload) {
      if (COMMITS.test(path)) {
        throw new ApiError(`Commits go through the official script, not the API: ${path}`, 0)
      }

      return send('POST', path, JSON.stringify(payload))
    },
    delete: path => send('DELETE', path),
  }
}
