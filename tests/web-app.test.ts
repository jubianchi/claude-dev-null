import { describe, expect, test } from 'claude-code/testing'

import type { Http } from '../hooks/infrastructure/web-app'
import { SignInRequired, WebAppError, webApp } from '../hooks/infrastructure/web-app'

const ORIGIN = 'https://dev-null.sh'

type Request = { url: string; headers: Record<string, string> }
type Answer = { status: number; headers?: Record<string, string>; text?: string }

/** Answers each request with `answer`, and records it in `requests`. */
function server(answer: (request: Request) => Answer): Http & { requests: Request[] } {
  const requests: Request[] = []
  const http: Http = async (url, init) => {
    const request = { url, headers: init?.headers ?? {} }
    requests.push(request)
    const { status, headers = {}, text = '' } = answer(request)

    return { status, ok: status >= 200 && status < 300, headers, text }
  }

  return Object.assign(http, { requests })
}

function json(page: Record<string, unknown>): Answer {
  return {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-inertia': 'true' },
    text: JSON.stringify(page),
  }
}

function html(version: string): Answer {
  const page = JSON.stringify({ component: 'log/show', props: {}, url: '/log/latest', version })

  return {
    status: 200,
    headers: { 'content-type': 'text/html' },
    text: `<!DOCTYPE html><html><body><script data-page="app" type="application/json">${page}</script></body></html>`,
  }
}

function outdated(location: string): Answer {
  return { status: 409, headers: { 'x-inertia-location': location } }
}

/** A /dev/null whose assets are at `version`, serving `props` for every page. */
function devNull(version: string, props: Record<string, unknown> = {}) {
  return server(request => {
    if (request.headers['X-Inertia'] !== 'true') {
      return html(version)
    }

    return request.headers['X-Inertia-Version'] === version
      ? json({ component: 'log/show', props, url: new URL(request.url).pathname, version })
      : outdated(request.url)
  })
}

describe('visiting the web app', () => {
  test('asks for a page as Inertia does, and answers what it shows', async () => {
    const http = devNull('v1', { log: 'latest' })
    const page = await webApp(http).visit('/log/latest')

    expect(page).toEqual({ component: 'log/show', props: { log: 'latest' }, url: '/log/latest', version: 'v1' })
    expect(http.requests.at(-1)).toEqual({
      url: `${ORIGIN}/log/latest`,
      headers: { 'X-Inertia': 'true', 'X-Requested-With': 'XMLHttpRequest', 'X-Inertia-Version': 'v1' },
    })
  })

  test('reads the version of the assets from the page itself, then asks again', async () => {
    const http = devNull('v1')
    await webApp(http).visit('/log/latest')

    expect(http.requests.map(request => [request.url, request.headers['X-Inertia'] ?? 'html'])).toEqual([
      [`${ORIGIN}/log/latest`, 'true'],
      [`${ORIGIN}/log/latest`, 'html'],
      [`${ORIGIN}/log/latest`, 'true'],
    ])
  })

  test('keeps the version for the next visits', async () => {
    const http = devNull('v1')
    const app = webApp(http)
    await app.visit('/log/latest')
    await app.visit('/log/trending')

    expect(http.requests).toHaveLength(4)
  })

  test('shares the version with the web apps given the same assets', async () => {
    const http = devNull('v1')
    const assets = { version: null }
    await webApp(http, { assets }).visit('/log/latest')
    await webApp(http, { assets }).visit('/log/trending')

    expect(assets.version).toBe('v1')
    expect(http.requests).toHaveLength(4)
  })

  test('follows a new version of the assets', async () => {
    let version = 'v1'
    const http = server(request =>
      request.headers['X-Inertia'] !== 'true'
        ? html(version)
        : request.headers['X-Inertia-Version'] === version
          ? json({ component: 'log/show', props: {}, url: '/log/latest', version })
          : outdated(request.url),
    )
    const app = webApp(http)
    await app.visit('/log/latest')
    version = 'v2'

    expect((await app.visit('/log/latest')).version).toBe('v2')
  })

  test('asks for some of the props only', async () => {
    const http = devNull('v1', { commits: [] })
    await webApp(http).visit('/log/latest', { partial: { component: 'log/show', props: ['commits', 'isRanked'] } })

    expect(http.requests.at(-1)?.headers).toMatchObject({
      'X-Inertia-Partial-Component': 'log/show',
      'X-Inertia-Partial-Data': 'commits,isRanked',
    })
  })

  test('keeps the query of the path', async () => {
    const http = devNull('v1')
    await webApp(http).visit('/log/latest?cursor=abc')

    expect(http.requests.every(request => request.url === `${ORIGIN}/log/latest?cursor=abc`)).toBe(true)
  })
})

describe('signing in to the web app', () => {
  test('sends no cookie without one', async () => {
    const http = devNull('v1')
    await webApp(http).visit('/log/latest')

    expect(http.requests.some(request => 'Cookie' in request.headers)).toBe(false)
  })

  test('says when the page asks to sign in', async () => {
    const http = server(request =>
      request.headers['X-Inertia'] === 'true' && request.headers['X-Inertia-Version'] === 'v1'
        ? outdated(`${ORIGIN}/login`)
        : request.headers['X-Inertia'] === 'true'
          ? outdated(request.url)
          : html('v1'),
    )

    await expect(webApp(http).visit('/log/following')).rejects.toBeInstanceOf(SignInRequired)
  })
})

describe('failing to visit the web app', () => {
  test('says what status /dev/null answered', async () => {
    const http = server(() => ({ status: 429, text: 'Too Many Requests' }))
    const visit = webApp(http).visit('/log/latest')

    await expect(visit).rejects.toBeInstanceOf(WebAppError)
    await expect(visit).rejects.toThrow('HTTP 429')
  })

  test('gives up when the page has no version to read', async () => {
    const http = server(request =>
      request.headers['X-Inertia'] === 'true' ? outdated(request.url) : { status: 200, text: '<html></html>' },
    )

    await expect(webApp(http).visit('/log/latest')).rejects.toBeInstanceOf(WebAppError)
  })

  test('reads the version once per visit, not over and over', async () => {
    const http = server(request => (request.headers['X-Inertia'] === 'true' ? outdated(request.url) : html('v1')))

    await expect(webApp(http).visit('/log/latest')).rejects.toBeInstanceOf(WebAppError)
    expect(http.requests.length).toBeLessThanOrEqual(3)
  })

  test('says so when an answer is not a page', async () => {
    const http = server(request =>
      request.headers['X-Inertia'] === 'true' ? { status: 200, text: 'not json' } : html('v1'),
    )

    await expect(webApp(http).visit('/log/latest')).rejects.toBeInstanceOf(WebAppError)
  })

  test('only visits /dev/null', async () => {
    const http = devNull('v1')
    const app = webApp(http)

    for (const path of ['https://example.com/log', '//example.com/log', 'log/latest']) {
      await expect(app.visit(path)).rejects.toBeInstanceOf(WebAppError)
    }
    expect(http.requests).toHaveLength(0)
  })
})

describe('reading the JSON of the web app', () => {
  test('asks for JSON, and answers it', async () => {
    const http = server(() => ({ status: 200, text: JSON.stringify({ data: [1, 2] }) }))

    expect(await webApp(http).json('/commits/c1/replies?cursor=abc')).toEqual({ data: [1, 2] })
    expect(http.requests).toEqual([
      {
        url: `${ORIGIN}/commits/c1/replies?cursor=abc`,
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      },
    ])
  })

  test('sends no cookie', async () => {
    const http = server(() => ({ status: 200, text: '{}' }))
    await webApp(http).json('/commits/c1/replies')

    expect(http.requests[0]?.headers.Cookie).toBeUndefined()
  })

  test('says what status /dev/null answered', async () => {
    const http = server(() => ({ status: 404, text: '{}' }))

    await expect(webApp(http).json('/commits/c1/replies')).rejects.toThrow('HTTP 404')
  })

  test('says so when the answer is not JSON', async () => {
    const http = server(() => ({ status: 200, text: '<html></html>' }))

    await expect(webApp(http).json('/commits/c1/replies')).rejects.toBeInstanceOf(WebAppError)
  })

  test('only reads /dev/null', async () => {
    const http = server(() => ({ status: 200, text: '{}' }))

    await expect(webApp(http).json('https://example.com/x')).rejects.toBeInstanceOf(WebAppError)
    expect(http.requests).toHaveLength(0)
  })
})
