import type { On, PaneOpenArgs, ProcessRunResult, RenderSurface } from 'claude-code'
import type { Engine, MockClock } from 'claude-code/testing'
import { mock } from 'claude-code/testing'

export const PLUGIN = 'dev-null'

export const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { bodyRows: 19, offset: 0 },
    view: {},
  },
} as const

export const ENGINE_BAND = 'engine-band'

export function engineDrawsNothing(on: On, entries: Record<string, unknown> = {}): Map<string, unknown> {
  const store = new Map(Object.entries(entries))

  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Text', props: {}, children: [ENGINE_BAND] }))
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    store.delete(e.key)

    return { value: undefined }
  })

  return store
}

export type Run = { argv: readonly string[]; stdin?: string }

/**
 * Answers `commit.sh`'s run with `result`, or refuses it, and records each run and toast: nothing is sent.
 */
export function fakeCommitScript(on: On, result: Partial<ProcessRunResult> | { deny: string }) {
  const runs: Run[] = []
  const toasts: string[] = []

  on('process.run', (_$, e) => {
    runs.push({ argv: e.argv, stdin: e.init?.stdin })

    if ('deny' in result) {
      return result
    }

    return {
      value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...result },
    }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })

  return { runs, toasts }
}

export async function run($: Engine, command: string, args = ''): Promise<string | undefined> {
  const { text } = await $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })

  return text
}

export const LOG_PANE = 'dev-null-log'

export const LOG = {
  component: 'Pane',
  requestId: LOG_PANE,
  props: {
    title: '/dev/null',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { bodyRows: 30, offset: 0 },
    view: {},
  },
} as const

export type Panes = { opened: PaneOpenArgs[]; closed: string[]; store: Map<string, unknown>; clock: MockClock }

/**
 * The time the clock of `surface` reads, which never moves.
 */
export const NOW = Date.parse('2026-10-17T11:00:00Z')

/**
 * The engine's band, store, clock (at NOW, moved by the test) and panes: each pane opened or closed is recorded.
 */
export function surface(on: On, entries: Record<string, unknown> = {}): Panes {
  const store = engineDrawsNothing(on, entries)
  const panes: Panes = { opened: [], closed: [], store, clock: mock.clock(on, { now: NOW }) }
  on('ui.open', (_$, e) => {
    panes.opened.push(e)

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    panes.closed.push(e.id)

    return { value: undefined }
  })

  return panes
}

export type Raw = Record<string, unknown>

/** A commit as the web app's pages serve it, by `username`. */
export function webCommit(id: string, extra: Raw = {}, username = 'nunomaduro'): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-17T10:18:00.000000Z',
    parent_id: null,
    replies_count: 0,
    stars_count: 1,
    user: { username, name: `${username} name`, lane: 2 },
    reply_preview: { data: [], next_cursor: null, prev_cursor: null },
    link_preview: null,
    images: [],
    ...extra,
  }
}

/** The remember cookie the web app of `webSite` signs `SIGNED_IN` in with. */
export const COOKIE = 'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=eyJpdiI6secret'
export const SIGNED_IN = 'jubianchi'

export type Site = {
  /** The log pages, by path and query: Following answers only with COOKIE. */
  pages?: Record<string, { data: Raw[]; next?: string }>
  /** The replies of each commit, by its id. */
  replies?: Record<string, Raw[]>
  /** The paths answering 500. */
  failing?: string[]
  /** What the log pages wait for before answering, for a test to see the log while it loads. */
  until?: Promise<unknown>
}

export type WebRequest = { url: string; headers: Record<string, string> }

/**
 * Answers the web app as `site` says, at the moment of each request, so that a test can change it; records each
 * request. Nothing is sent.
 */
export function webSite(on: On, site: Site = {}): WebRequest[] {
  const requests: WebRequest[] = []

  on('http.fetch', async (_$, e) => {
    const headers = e.init?.headers ?? {}
    requests.push({ url: e.url, headers })
    const url = new URL(e.url)
    const path = `${url.pathname}${url.search}`
    const isSignedIn = headers.Cookie === COOKIE
    const answer = (status: number, body: unknown, extra: Record<string, string> = {}) => ({
      value: {
        status,
        ok: status === 200,
        headers: { 'content-type': 'application/json', ...extra },
        text: JSON.stringify(body),
      },
    })
    const page = (component: string, props: Raw) => answer(200, { component, props, url: url.pathname, version: 'v1' })

    if (site.failing?.includes(path)) {
      return answer(500, { message: 'Server Error' })
    }

    if (url.pathname === '/terms') {
      return page('terms/show', { auth: { user: isSignedIn ? { username: SIGNED_IN } : null } })
    }

    const [, kind, id] = url.pathname.split('/')

    if (kind === 'commits') {
      return answer(200, { data: site.replies?.[id ?? ''] ?? [], next_cursor: null })
    }

    if (url.pathname === '/log/following' && !isSignedIn) {
      return answer(409, {}, { 'x-inertia-location': 'https://dev-null.sh/login' })
    }

    const found = site.pages?.[path]
    await site.until

    return found === undefined
      ? answer(404, { message: 'Not Found' })
      : page('log/show', { commits: { data: found.data, next_cursor: found.next ?? null } })
  })

  return requests
}

export async function log($: Engine, args = ''): Promise<string | undefined> {
  return run($, 'dev-null:log', args)
}

export async function mountLog<S extends RenderSurface>($: Engine, surface: S) {
  return $.ui.mount({ plugin: PLUGIN, surface, ...LOG })
}

export async function mountBand($: Engine) {
  return $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...BAND })
}
