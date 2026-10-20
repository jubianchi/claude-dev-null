import type { LogEntry } from '../../types'
import type { RepliesPage } from './replies'
import { MAX_REQUESTS, readThreads } from './replies'
import type { WebApp } from './web-app'
import { commit } from './web-commit'

async function page(app: WebApp, id: string, cursor: string | null, except: string | null): Promise<RepliesPage> {
  const query = new URLSearchParams([
    ...(except === null ? [] : [['except', except]]),
    ...(cursor === null ? [] : [['cursor', cursor]]),
  ]).toString()
  const found = (await app.json(
    `/commits/${encodeURIComponent(id)}/replies${query === '' ? '' : `?${query}`}`,
  )) as Record<string, unknown> | null

  return {
    replies: (Array.isArray(found?.data) ? found.data : []).flatMap(item => commit(item) ?? []),
    next: typeof found?.next_cursor === 'string' ? found.next_cursor : null,
  }
}

/** Reads the replies of `commits` down their threads from the web app, as `readThreads` says. */
export async function readReplies(
  app: WebApp,
  commits: readonly LogEntry[],
  known: readonly LogEntry[] = [],
  limit = MAX_REQUESTS,
): Promise<LogEntry[]> {
  return readThreads((id, cursor, except) => page(app, id, cursor, except), commits, known, limit)
}
