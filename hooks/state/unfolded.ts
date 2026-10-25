import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { WebLog } from '../../types'

const unfolded = atom({ plugin: 'dev-null', key: 'unfolded' } as const, [])

/** `log`, the commits whose Show more was pressed shown whole. */
export async function unfoldedIn($: EngineInterface, log: WebLog): Promise<WebLog> {
  const ids = new Set(await read($, unfolded))

  if (ids.size === 0) {
    return log
  }

  const whole = <T extends { id: string; preview: unknown }>(entry: T): T =>
    ids.has(entry.id) ? { ...entry, preview: null } : entry

  return { ...log, commits: log.commits.map(whole), replies: log.replies.map(whole) }
}

/** Shows the commit `id` whole, in place of its start. */
export async function unfold($: EngineInterface, id: string): Promise<void> {
  await update($, unfolded, ids => (ids.includes(id) ? ids : [...ids, id]))
}
