import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { LogLoading, LogName, WebLog, WebLogLoad } from '../../types'
import { current, EMPTY, more, refresh } from '../application/web-logs'
import { spinning } from './spinner'
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

/** How long a load is waited for before another may start: one that does not answer does not hold the log. */
export const LOAD_TIMEOUT = 30_000

/** The load of `name` under way, if any: one older than LOAD_TIMEOUT, or of another shape, is none. */
async function under($: EngineInterface, name: LogName): Promise<WebLogLoad | undefined> {
  const found: unknown = (await read($, loadingLogs))[name]
  const load = found as Partial<WebLogLoad> | null | undefined

  return typeof load === 'object' &&
    load !== null &&
    (load.kind === 'refresh' || load.kind === 'more') &&
    typeof load.since === 'number' &&
    (await $.clock.now()) - load.since < LOAD_TIMEOUT
    ? (load as WebLogLoad)
    : undefined
}

/** What `name` is loading: nothing, its first page again, or its next one. */
export async function webLogLoading($: EngineInterface, name: LogName): Promise<LogLoading> {
  return (await under($, name))?.kind ?? ''
}

/**
 * Forgets the loads under way: a load of an earlier module, or of an earlier session, never ends in this one, and
 * would hold its log loading.
 */
export async function forgetLoadings($: EngineInterface): Promise<void> {
  await update($, loadingLogs, () => ({}))
}

/**
 * Keeps what `load` loads of `name`, saying what `name` is loading meanwhile; nothing while `name` loads already, so
 * that a second press loads nothing more. A load that ends once another started is left out.
 */
async function loading(
  $: EngineInterface,
  name: LogName,
  kind: WebLogLoad['kind'],
  load: () => Promise<WebLog>,
): Promise<void> {
  if ((await under($, name)) !== undefined) {
    return
  }

  const since = await $.clock.now()
  const isCurrent = async () => (await read($, loadingLogs))[name]?.since === since
  await update($, loadingLogs, logs => ({ ...logs, [name]: { kind, since } }))

  try {
    const log = await spinning($, load)

    if (await isCurrent()) {
      await update($, webLogs, logs => ({ ...logs, [name]: log }))
    }
  } finally {
    if (await isCurrent()) {
      await update($, loadingLogs, logs => {
        const { [name]: _, ...others } = logs

        return others
      })
    }
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
