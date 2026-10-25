import type { EngineInterface } from 'claude-code'

import type { LogEntry } from '../../types'
import { star } from '../application/star'
import { approvedApi } from './device'
import { replaceInThread } from './thread'
import { replaceEntry } from './web-logs'

const TOAST = { timeoutMs: 10_000 }

/**
 * Whether a star is being sent: kept in the module, not in the state, which a dispatch reads at the one moment it
 * started: a second press, quick enough, would not see the first, and would send it again.
 */
let sending = false

/**
 * Stars `entry`, or takes its star back, as the device approved, once at a time: the commit then shows as /dev/null
 * shows it since, in the logs and the thread, or a toast says why it refused.
 */
export async function toggleStar($: EngineInterface, entry: LogEntry): Promise<void> {
  const api = await approvedApi($)

  if (sending || api === undefined || entry.starred === undefined) {
    return
  }

  sending = true

  try {
    const starred = await star(api, entry.id, !entry.starred)

    if ('error' in starred) {
      $.ui.toast(starred.error, TOAST)

      return
    }

    await replaceEntry($, starred.entry)
    await replaceInThread($, starred.entry)
  } finally {
    sending = false
  }
}
