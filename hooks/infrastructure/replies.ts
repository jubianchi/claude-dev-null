import type { LogEntry } from '../../types'

/** How many requests one read of replies makes at most, the rest waiting for the next one. */
export const MAX_REQUESTS = 10

/** A page of the replies of a commit, and the cursor of the next one. */
export type RepliesPage = { replies: LogEntry[]; next: string | null }

/** Reads the page of the replies of the commit `id` at `cursor`, the first one when null. */
export type ReadRepliesPage = (id: string, cursor: string | null) => Promise<RepliesPage>

/**
 * Reads the replies of `commits` down their threads with `page`, in the order of the log, with `limit` requests at
 * most: only those of a commit with more replies than `known` (the replies the log already shows), and stopping at
 * the first request that fails. Answers the replies it read, `known` left out.
 */
export async function readThreads(
  page: ReadRepliesPage,
  commits: readonly LogEntry[],
  known: readonly LogEntry[] = [],
  limit = MAX_REQUESTS,
): Promise<LogEntry[]> {
  const seen = new Set([...commits, ...known].map(found => found.id))
  const children = (id: string) => known.filter(found => found.parentId === id || found.quotedId === id)
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
        found = await page(parent.id, cursor)
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
