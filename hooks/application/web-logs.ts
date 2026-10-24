import type { LogEntry, LogName, WebLog } from '../../types'
import type { Api } from '../infrastructure/api'
import { DeviceNotApproved } from '../infrastructure/api'
import { readApiLog } from '../infrastructure/api-log'
import { readApiReplies } from '../infrastructure/api-replies'
import type { WebApp } from '../infrastructure/web-app'
import { SignInRequired } from '../infrastructure/web-app'
import type { LogPage } from '../infrastructure/web-log'
import { readLog } from '../infrastructure/web-log'
import { readReplies } from '../infrastructure/web-replies'
import { threadsOf } from '../log'

export const EMPTY: WebLog = { commits: [], replies: [], next: null, error: '' }

function isEntry(value: unknown): value is LogEntry {
  const entry = value as Partial<LogEntry> | null

  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.id === 'string' &&
    Array.isArray(entry.segments) &&
    entry.preview !== undefined &&
    entry.poll !== undefined &&
    (entry.poll === null || entry.poll.options.every(option => typeof option.id === 'string')) &&
    entry.quote !== undefined &&
    entry.quotedId !== undefined &&
    entry.continuationId !== undefined &&
    entry.deletedAt !== undefined &&
    typeof entry.mentions === 'object' &&
    (entry.quote === null || isEntry(entry.quote))
  )
}

/**
 * A log kept from an earlier load, if it has the shape this load draws: the session keeps its state across a reload
 * of the module, whose entries may have changed since. Undefined, it is to be loaded again.
 */
export function current(value: unknown): WebLog | undefined {
  const log = value as Partial<WebLog> | null | undefined

  return typeof log === 'object' &&
    log !== null &&
    Array.isArray(log.commits) &&
    Array.isArray(log.replies) &&
    log.commits.every(isEntry) &&
    log.replies.every(isEntry) &&
    (log.next === null || typeof log.next === 'string') &&
    typeof log.error === 'string'
    ? (log as WebLog)
    : undefined
}

function unique(entries: readonly LogEntry[]): LogEntry[] {
  return [...new Map(entries.map(found => [found.id, found])).values()]
}

/** The replies of `replies` that thread under `commits`, the others left out. */
function threaded(commits: readonly LogEntry[], replies: readonly LogEntry[]): LogEntry[] {
  const kept = new Set(threadsOf(commits, replies).flatMap(thread => thread.replies.map(reply => reply.id)))

  return unique(replies).filter(found => kept.has(found.id))
}

function bytes(log: WebLog): number {
  return new TextEncoder().encode(JSON.stringify(log)).length
}

/**
 * `log`, in `budget` bytes of JSON at most: its last commits left out, with their replies, until it fits, and the
 * pages after them, which its next cursor would skip; nothing when even its first commit does not fit.
 */
export function within(log: WebLog, budget: number): WebLog | undefined {
  if (bytes(log) <= budget) {
    return log
  }

  for (let count = log.commits.length - 1; count > 0; count--) {
    const commits = log.commits.slice(0, count)
    const kept = { ...log, commits, replies: threaded(commits, log.replies), next: null }

    if (bytes(kept) <= budget) {
      return kept
    }
  }

  return undefined
}

function failure(name: LogName, error: unknown): string {
  if (error instanceof DeviceNotApproved || error instanceof SignInRequired) {
    return 'Sign in again from the Account tab: /dev/null no longer knows this device.'
  }

  return `Could not load the ${name} log (${error instanceof Error ? error.message : String(error)}).`
}

/** Where a log is read from: a page of it, and the replies of its commits down their threads, `known` left out. */
export type LogReader = {
  page: (name: LogName, cursor?: string) => Promise<LogPage>
  replies: (commits: readonly LogEntry[], known: readonly LogEntry[]) => Promise<LogEntry[]>
}

/** The logs as the pages of the web app serve them. */
export function webReader(app: WebApp): LogReader {
  return {
    page: (name, cursor) => readLog(app, name, cursor === undefined ? {} : { cursor }),
    replies: (commits, known) => readReplies(app, commits, known),
  }
}

/** The logs as the API serves them to the device it knows by the key `api` signs with. */
export function apiReader(api: Pick<Api, 'get'>): LogReader {
  return {
    page: (name, cursor) => readApiLog(api, name, cursor === undefined ? {} : { cursor }),
    replies: (commits, known) => readApiReplies(api, commits, known),
  }
}

/** Loads a page of `name` with the replies of its commits, those of `known` read again only when they grew. */
async function load(
  reader: LogReader,
  name: LogName,
  cursor: string | undefined,
  known: readonly LogEntry[],
): Promise<{ commits: LogEntry[]; replies: LogEntry[]; next: string | null }> {
  const page = await reader.page(name, cursor)
  const shown = unique([...page.replies, ...known])
  const read = await reader.replies(page.commits, shown)

  return { commits: page.commits, replies: [...shown, ...read], next: page.next }
}

/**
 * Loads the first page of `name` again, keeping the replies `previous` read for the commits still there; when it
 * cannot, keeps what `previous` showed and says why.
 */
export async function refresh(reader: LogReader, name: LogName, previous: WebLog = EMPTY): Promise<WebLog> {
  try {
    const { commits, replies, next } = await load(reader, name, undefined, previous.replies)

    return { commits, replies: threaded(commits, replies), next, error: '' }
  } catch (error) {
    return { ...previous, error: failure(name, error) }
  }
}

/** Adds the next page of `name` to what `current` shows, if the log goes on; when it cannot, says why. */
export async function more(reader: LogReader, name: LogName, current: WebLog): Promise<WebLog> {
  if (current.next === null) {
    return current
  }

  try {
    const page = await load(reader, name, current.next, [])
    const commits = unique([...current.commits, ...page.commits])

    return { commits, replies: threaded(commits, [...current.replies, ...page.replies]), next: page.next, error: '' }
  } catch (error) {
    return { ...current, error: failure(name, error) }
  }
}
