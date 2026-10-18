import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { LogLoading, LogName, WebLog } from '../../types'
import { current, EMPTY, more, refresh } from '../application/web-logs'
import { webAppOf as app } from './web-app'

const webLogs = atom({ plugin: 'dev-null', key: 'webLogs' } as const, {})

/** What `name` shows, nothing until it is loaded. */
export async function webLog($: EngineInterface, name: LogName): Promise<WebLog> {
  return current((await read($, webLogs))[name]) ?? EMPTY
}

/** Whether `name` is loaded, in the shape this load draws. */
export async function isWebLogLoaded($: EngineInterface, name: LogName): Promise<boolean> {
  return current((await read($, webLogs))[name]) !== undefined
}

const loadingLogs = atom({ plugin: 'dev-null', key: 'loadingLogs' } as const, {})

/** What `name` is loading: nothing, its first page again, or its next one. */
export async function webLogLoading($: EngineInterface, name: LogName): Promise<LogLoading> {
  return (await read($, loadingLogs))[name] ?? ''
}

/**
 * Keeps what `load` loads of `name`, saying what `name` is loading meanwhile; nothing while `name` loads already, so
 * that a second press loads nothing more.
 */
async function loading(
  $: EngineInterface,
  name: LogName,
  kind: Exclude<LogLoading, ''>,
  load: () => Promise<WebLog>,
): Promise<void> {
  if ((await webLogLoading($, name)) !== '') {
    return
  }

  await update($, loadingLogs, logs => ({ ...logs, [name]: kind }))

  try {
    const log = await load()
    await update($, webLogs, logs => ({ ...logs, [name]: log }))
  } finally {
    await update($, loadingLogs, logs => ({ ...logs, [name]: '' }))
  }
}

/** Loads `name` again, signed in with `cookie` when given. */
export async function refreshWebLog($: EngineInterface, name: LogName, cookie?: string): Promise<void> {
  await loading($, name, 'refresh', async () => refresh(app($, cookie), name, await webLog($, name)))
}

/** Loads more of `name`, signed in with `cookie` when given. */
export async function loadMoreOfWebLog($: EngineInterface, name: LogName, cookie?: string): Promise<void> {
  await loading($, name, 'more', async () => more(app($, cookie), name, await webLog($, name)))
}

/** Forgets what `name` shows, for it to be loaded again the next time it is shown. */
export async function forgetWebLog($: EngineInterface, name: LogName): Promise<void> {
  await update($, webLogs, logs => {
    const { [name]: _, ...others } = logs

    return others
  })
}
