import type { ImageSource, On, PaneOpenArgs, ProcessRunResult, RenderSurface } from 'claude-code'
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

/** The engine's band, and its store, holding `entries` and refusing to write the keys of `refusing`, as a full one. */
export function engineDrawsNothing(
  on: On,
  entries: Record<string, unknown> = {},
  refusing: ReadonlySet<string> = new Set(),
): Map<string, unknown> {
  const store = new Map(Object.entries(entries))

  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Text', props: {}, children: [ENGINE_BAND] }))
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => {
    if (refusing.has(e.key)) {
      throw new Error('The store is over 4 MiB.')
    }

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

export type Panes = {
  opened: PaneOpenArgs[]
  closed: string[]
  /**
   * The panes the host shows, by id: those opened and not closed since, and those a test adds, as the host keeps
   * showing a pane once a `/clear` started the state over.
   */
  shown: Map<string, string>
  store: Map<string, unknown>
  /** The keys the store refuses to write, as a full one. */
  refusing: Set<string>
  clock: MockClock
  /**
   * The id of the session, one of its own for each test, since the module and its timers outlive a test; a test
   * changes it as a `/clear` or a resume does.
   */
  session: string
  /**
   * What the terminal answers a blit with: taken, where it draws pictures; refused as an Image drawing its alt, as in
   * tmux, by default; refused otherwise; or an error.
   */
  blit: 'drawn' | 'alt' | 'unmounted' | 'throws'
  /** The keys of the Images blitted, in order, and their sources. */
  blitted: string[]
  blits: ImageSource[]
}

/** What the host answers a blit of an Image that draws its alt, word for word. */
export const DRAWS_ALT =
  'the Image draws its alt here: the terminal draws no placeholder images (env: inside tmux or screen)'

let sessions = 0

/**
 * The time the clock of `surface` reads, which never moves.
 */
export const NOW = Date.parse('2026-10-17T11:00:00Z')

/**
 * The engine's band, store, clock (at NOW, moved by the test) and panes: each pane opened or closed is recorded.
 */
export function surface(on: On, entries: Record<string, unknown> = {}): Panes {
  const refusing = new Set<string>()
  const store = engineDrawsNothing(on, entries, refusing)
  const panes: Panes = {
    opened: [],
    closed: [],
    shown: new Map(),
    store,
    refusing,
    clock: mock.clock(on, { now: NOW }),
    session: `session-${++sessions}`,
    blit: 'alt',
    blitted: [],
    blits: [],
  }
  on('session.id', () => ({ value: panes.session }))
  on('ui.blit', (_$, e) => {
    panes.blitted.push(e.key)

    if ('source' in e) {
      panes.blits.push(e.source)
    }

    if (panes.blit === 'throws') {
      throw new Error('the surface went away')
    }

    const answers = {
      drawn: {},
      alt: { deny: DRAWS_ALT },
      unmounted: { deny: 'nothing of this plugin is mounted there' },
    }

    return { value: answers[panes.blit] }
  })
  on('ui.open', (_$, e) => {
    panes.opened.push(e)
    panes.shown.set(e.id, e.title ?? '')

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    panes.closed.push(e.id)
    panes.shown.delete(e.id)

    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: [...panes.shown].map(([id, title]) => ({ id, title, isShown: true, isFocused: false, isPlaced: true })),
  }))

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

/** The folder the fake commands of pictureSite keep the pictures in. */
export const PICTURES_FOLDER = '/tmp/dev-null-pictures.test'

/**
 * Answers the commands the pictures of commits are loaded with, through `$.process.run`: their download, `curl`, with
 * the base64 of `pictures` by URL, 404 for the others, nothing ever for those `hanging`; the folder they are kept in,
 * PICTURES_FOLDER; the file their pixels are kept in, named after its count; and the removals, recorded in `removed`.
 * Records each URL downloaded. Nothing is sent, nothing is written.
 */
export function pictureSite(
  on: On,
  pictures: Record<string, string>,
  hanging: readonly string[] = [],
  removed: string[] = [],
): string[] {
  const downloads: string[] = []
  let files = 0

  on('process.run', async (_$, e) => {
    const result = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

    if (e.argv[0] === 'rm') {
      removed.push(e.argv.at(-1) ?? '')

      return { value: result }
    }

    if (e.argv[2]?.includes('mktemp -d')) {
      return { value: { ...result, stdout: PICTURES_FOLDER } }
    }

    if (e.argv[2]?.includes('base64 --decode')) {
      return { value: { ...result, stdout: `${e.argv[4]}/picture.${++files}` } }
    }

    const url = e.argv[4] ?? ''
    downloads.push(url)

    if (hanging.includes(url)) {
      await new Promise(() => undefined)
    }

    const base64 = pictures[url]

    return {
      value:
        base64 === undefined
          ? { ...result, exitCode: 56, stderr: 'curl: (56) The requested URL returned error: 404\n' }
          : { ...result, exitCode: 0, stdout: base64 },
    }
  })

  return downloads
}

/**
 * What a load waits for, until the test lets go of it: a test that holds a load MUST let go of it and wait for it
 * before it ends, or the spinner's timer, which the tests of a file share, outlives its engine.
 */
export function held(): { until: Promise<void>; release: () => void } {
  let release: () => void = () => undefined
  const until = new Promise<void>(resolve => {
    release = resolve
  })

  return { until, release }
}

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
