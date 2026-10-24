import type { LogEntry } from '../../types'
import type { Api } from './api'
import { ApiError } from './api'
import { apiCommit } from './api-commit'

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null
}

/** A commit, and the commits it replies to, from the one its thread starts from, as far as /dev/null shows them. */
export type ApiThread = { commit: LogEntry; ancestors: LogEntry[] }

/** Reads the commit `id` from the API, and the commits it replies to. */
export async function readApiThread(api: Pick<Api, 'get'>, id: string): Promise<ApiThread> {
  const found = record(await api.get(`/api/v1/commits/${encodeURIComponent(id)}`))
  const commit = apiCommit(found?.data)

  if (commit === null) {
    throw new ApiError(`/dev/null sent the commit ${id} without it.`, 200)
  }

  const ancestors = Array.isArray(found?.ancestors) ? found.ancestors : []

  return { commit, ancestors: ancestors.flatMap(item => apiCommit(item) ?? []) }
}
