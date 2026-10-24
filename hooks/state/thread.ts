import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { LogEntry, WebLog } from '../../types'
import { loadThread } from '../application/thread'
import { current } from '../application/web-logs'
import { approvedApi } from './device'
import { spinning } from './spinner'

const thread = atom({ plugin: 'dev-null', key: 'thread' } as const, null)
const threadLoading = atom({ plugin: 'dev-null', key: 'threadLoading' } as const, '')

/** The thread of the commit `id`, as a log; nothing until it is loaded. */
export async function threadOf($: EngineInterface, id: string): Promise<WebLog | undefined> {
  const found = await read($, thread)

  return found?.id === id ? current(found.log) : undefined
}

/** Shows `entry` in place of the commit or reply of its id in the thread loaded, as /dev/null shows it since. */
export async function replaceInThread($: EngineInterface, entry: LogEntry): Promise<void> {
  const replaced = (entries: readonly LogEntry[]) => entries.map(found => (found.id === entry.id ? entry : found))

  await update($, thread, found =>
    found === null
      ? found
      : { ...found, log: { ...found.log, commits: replaced(found.log.commits), replies: replaced(found.log.replies) } },
  )
}

/** Whether the thread of the commit `id` is loading. */
export async function isThreadLoading($: EngineInterface, id: string): Promise<boolean> {
  return (await read($, threadLoading)) === id
}

/**
 * The commit whose thread is loading, '' while none is: kept in the module, not in the state, which a dispatch reads
 * at the one moment it started: a second press, quick enough, would not see the first.
 */
let loading = ''

/**
 * Loads the thread of the commit `id` again, as the device approved, once at a time; when it cannot, shows what it
 * showed of it, with why. A load that ends once another started is left out.
 */
export async function refreshThread($: EngineInterface, id: string): Promise<void> {
  const api = await approvedApi($)

  if (api === undefined || loading === id) {
    return
  }

  loading = id
  await update($, threadLoading, () => id)

  try {
    const log = await spinning($, () => loadThread(api, id))
    const previous = await threadOf($, id)

    if (loading === id) {
      await update($, thread, () => ({
        id,
        log: log.error !== '' && previous ? { ...previous, error: log.error } : log,
      }))
    }
  } finally {
    if (loading === id) {
      loading = ''
      await update($, threadLoading, () => '')
    }
  }
}
