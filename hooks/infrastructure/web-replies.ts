import type { LogEntry } from '../../types'
import type { WebApp } from './web-app'
import { commit } from './web-commit'

/** How many requests one read of replies makes at most, the rest waiting for the next one. */
export const MAX_REQUESTS = 10

type RepliesPage = { replies: LogEntry[]; next: string | null }

async function page(app: WebApp, id: string, cursor: string | null): Promise<RepliesPage> {
  const found = (await app.json(
    `/commits/${encodeURIComponent(id)}/replies${cursor === null ? '' : `?cursor=${encodeURIComponent(cursor)}`}`,
  )) as Record<string, unknown> | null

  return {
    replies: (Array.isArray(found?.data) ? found.data : []).flatMap(item => commit(item) ?? []),
    next: typeof found?.next_cursor === 'string' ? found.next_cursor : null,
  }
}

/**
 * Reads the replies of `commits` down their threads, in the order of the log, with `limit` requests at most: only
 * those of a commit with more replies than `known` (the replies the log already shows), and stopping at the first
 * request that fails. Answers the replies it read, `known` left out.
 */
export async function readReplies(
  app: WebApp,
  commits: readonly LogEntry[],
  known: readonly LogEntry[] = [],
  limit = MAX_REQUESTS,
): Promise<LogEntry[]> {
  const seen = new Set([...commits, ...known].map(found => found.id))
  const children = (id: string) => known.filter(found => found.parentId === id)
  const queue = [...commits]
  const read: LogEntry[] = []
  let requests = 0

  while (queue.length > 0) {
    const parent = queue.shift() as LogEntry
    queue.push(...children(parent.id).filter(found => found.replies > 0))

    if (parent.replies <= children(parent.id).length) {
      continue
    }

    let cursor: string | null = null
    do {
      if (requests >= limit) {
        return read
      }

      requests++
      let found: RepliesPage
      try {
        found = await page(app, parent.id, cursor)
      } catch {
        return read
      }

      for (const reply of found.replies.filter(candidate => !seen.has(candidate.id))) {
        seen.add(reply.id)
        read.push(reply)

        if (reply.replies > 0) {
          queue.push(reply)
        }
      }

      cursor = found.next
    } while (cursor !== null)
  }

  return read
}
