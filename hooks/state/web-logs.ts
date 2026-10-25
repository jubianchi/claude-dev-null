import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { LogEntry, LogLoading, LogName, WebLog, WebLogLoad } from '../../types'
import type { LogReader } from '../application/web-logs'
import { apiReader, current, EMPTY, more, refresh, webReader, within } from '../application/web-logs'
import { approvedApi } from './device'
import { spinning } from './spinner'
import type { Kept } from './stored'
import { readKept, writeKept } from './stored'
import { webAppOf as app } from './web-app'

const webLogs = atom({ plugin: 'dev-null', key: 'webLogs' } as const, {})

/**
 * What `name` loaded, kept in the store for a /clear, which starts the state over, to show it still; each log under a
 * key of its own, so that a log written never reads, nor overwrites, another.
 */
function keptLog(name: LogName): Kept<WebLog> {
  return { key: `webLog.${name}`, version: 7, migrations: {}, read: current }
}

/** What `name` shows: what it loaded, or else what the store kept of it; nothing until it is loaded. */
async function shown($: EngineInterface, name: LogName): Promise<WebLog | undefined> {
  return current((await read($, webLogs))[name]) ?? (await readKept($, keptLog(name)))
}

/**
 * The bytes a log may take in the store: the first page of the busiest log, with the replies of its commits, takes
 * two thirds of it; the four take three of the 4 MiB of the store, the rest left to the others.
 */
export const KEPT_LOG_BUDGET = 768 * 1024

/**
 * Keeps `log` in the store as what `name` shows, within KEPT_LOG_BUDGET, or forgets what it showed there when there
 * is none, or none fits.
 */
async function keep($: EngineInterface, name: LogName, log?: WebLog): Promise<void> {
  const fitting = log === undefined ? undefined : within(log, KEPT_LOG_BUDGET)

  if (fitting === undefined) {
    await $.store.delete(keptLog(name).key)
  } else {
    await writeKept($, keptLog(name), fitting)
  }
}

/** What `name` shows, nothing until it is loaded. */
export async function webLog($: EngineInterface, name: LogName): Promise<WebLog> {
  return (await shown($, name)) ?? EMPTY
}

/** Whether `name` is loaded, in the shape this load draws. */
export async function isWebLogLoaded($: EngineInterface, name: LogName): Promise<boolean> {
  return (await shown($, name)) !== undefined
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
 * would hold its log loading. A load of this module goes on: what it brings still holds, and a load started after it
 * leaves it out.
 */
export async function forgetLoadings($: EngineInterface): Promise<void> {
  await update($, loadingLogs, () => ({}))
}

/**
 * How many times each log was loaded or forgotten: a load of a log loaded again, or forgotten, since it started is
 * left out. Kept in the module, not in the state, which a dispatch reads at the one moment it started: a load would
 * never see another dispatch change it.
 */
const generations = new Map<LogName, number>()

/** Starts a new generation of `name`, and tells whether it is still the current one. */
function nextGeneration(name: LogName): () => boolean {
  const generation = (generations.get(name) ?? 0) + 1
  generations.set(name, generation)

  return () => generations.get(name) === generation
}

/**
 * Keeps what `load` loads of `name`, saying what `name` is loading meanwhile; nothing while `name` loads already, so
 * that a second press loads nothing more. A load that ends once another started, or once `name` was forgotten, is
 * left out. The store keeps the first page a refresh loaded last: neither the pages after it nor a refresh that
 * failed, which shows what the log showed before, with its error.
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
  const isCurrent = nextGeneration(name)
  await update($, loadingLogs, logs => ({ ...logs, [name]: { kind, since } }))

  try {
    const log = await spinning($, load)

    if (isCurrent()) {
      await update($, webLogs, logs => ({ ...logs, [name]: log }))
    }

    if (isCurrent() && kind === 'refresh' && log.error === '') {
      await keep($, name, log)
    }
  } finally {
    if (isCurrent()) {
      await update($, loadingLogs, logs => {
        const { [name]: _, ...others } = logs

        return others
      })
    }
  }
}

/** The logs the API alone serves, to the device approved: the web app serves them to whoever signed in only. */
const API_ONLY: readonly LogName[] = ['following', 'starred']

/**
 * Where `name` is read from: the API, as the device approved, once someone approved it; until then the web app, as
 * no one, for any log but those the API alone serves.
 */
async function readerOf($: EngineInterface, name: LogName): Promise<LogReader | undefined> {
  const api = await approvedApi($)

  if (api !== undefined) {
    return apiReader(api)
  }

  return API_ONLY.includes(name) ? undefined : webReader(app($))
}

/** Loads `name` again, unless the API alone serves it and no one approved the device. */
export async function refreshWebLog($: EngineInterface, name: LogName): Promise<void> {
  const reader = await readerOf($, name)

  if (reader !== undefined) {
    await loading($, name, 'refresh', async () => refresh(reader, name, await webLog($, name)))
  }
}

/** Loads more of `name`, unless the API alone serves it and no one approved the device. */
export async function loadMoreOfWebLog($: EngineInterface, name: LogName): Promise<void> {
  const reader = await readerOf($, name)

  if (reader !== undefined) {
    await loading($, name, 'more', async () => more(reader, name, await webLog($, name)))
  }
}

/** Shows `entry` in place of the commit or reply of its id, in every log that shows it, as /dev/null shows it since. */
export async function replaceEntry($: EngineInterface, entry: LogEntry): Promise<void> {
  const replaced = (entries: readonly LogEntry[]) => entries.map(found => (found.id === entry.id ? entry : found))

  await update($, webLogs, logs =>
    Object.fromEntries(
      Object.entries(logs).map(([name, log]) => [
        name,
        log === undefined ? log : { ...log, commits: replaced(log.commits), replies: replaced(log.replies) },
      ]),
    ),
  )
}

/**
 * Forgets what `name` shows, for it to be loaded again the next time it is shown, and the load of it under way, which
 * would show it again once it ends.
 */
export async function forgetWebLog($: EngineInterface, name: LogName): Promise<void> {
  nextGeneration(name)
  await update($, loadingLogs, logs => {
    const { [name]: _, ...others } = logs

    return others
  })
  await update($, webLogs, logs => {
    const { [name]: _, ...others } = logs

    return others
  })
  await keep($, name)
}
