import type { LogEntry, LogName } from '../../types'
import type { Api } from './api'
import { ApiError, pathOf } from './api'
import { apiCommit } from './api-commit'
import type { LogPage } from './web-log'

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null
}

function commits(value: unknown): LogEntry[] {
  return (Array.isArray(value) ? value : []).flatMap(item => apiCommit(item) ?? [])
}

/** Reads a page of `log` from the API, the first one or the one at `cursor`. */
export async function readApiLog(
  api: Pick<Api, 'get'>,
  log: LogName,
  { cursor }: { cursor?: string } = {},
): Promise<LogPage> {
  const path = log === 'starred' ? '/api/v1/starred' : `/api/v1/log/${log}`
  const page = record(await api.get(pathOf(path, { cursor })))

  if (page === null || !Array.isArray(page.data)) {
    throw new ApiError(`/dev/null sent the ${log} log without its commits.`, 200)
  }

  const next = record(page.meta)?.next_cursor

  return {
    commits: commits(page.data),
    replies: page.data.flatMap(item => commits(record(record(item)?.reply_preview)?.data)),
    next: typeof next === 'string' ? next : null,
  }
}
