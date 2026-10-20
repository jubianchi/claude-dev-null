import type { LogEntry } from '../../types'
import type { Api } from './api'
import { pathOf } from './api'
import { apiCommit } from './api-commit'
import type { RepliesPage } from './replies'
import { MAX_REQUESTS, readThreads } from './replies'

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null
}

async function page(api: Api, id: string, cursor: string | null): Promise<RepliesPage> {
  const found = record(
    await api.get(pathOf(`/api/v1/commits/${encodeURIComponent(id)}/replies`, { cursor: cursor ?? undefined })),
  )
  const next = record(found?.meta)?.next_cursor

  return {
    replies: (Array.isArray(found?.data) ? found.data : []).flatMap(item => apiCommit(item) ?? []),
    next: typeof next === 'string' ? next : null,
  }
}

/** Reads the replies of `commits` down their threads from the API, as `readThreads` says. */
export async function readApiReplies(
  api: Api,
  commits: readonly LogEntry[],
  known: readonly LogEntry[] = [],
  limit = MAX_REQUESTS,
): Promise<LogEntry[]> {
  return readThreads((id, cursor) => page(api, id, cursor), commits, known, limit)
}
