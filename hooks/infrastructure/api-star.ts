import type { LogEntry } from '../../types'
import type { Api } from './api'
import { ApiError } from './api'
import { apiCommit } from './api-commit'

/** Stars the commit `commitId`, or takes its star back; the commit, as /dev/null shows it since. */
export async function starCommit(
  api: Pick<Api, 'post' | 'delete'>,
  commitId: string,
  isStarred: boolean,
): Promise<LogEntry> {
  const path = `/api/v1/commits/${encodeURIComponent(commitId)}/star`
  const answer = isStarred ? await api.post(path, {}) : await api.delete(path)
  const data = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>).data : undefined
  const entry = apiCommit(data)

  if (entry === null) {
    throw new ApiError('/dev/null sent no commit once starred.', 200)
  }

  return entry
}
