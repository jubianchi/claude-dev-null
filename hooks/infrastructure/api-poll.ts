import type { LogEntry } from '../../types'
import type { Api } from './api'
import { ApiError } from './api'
import { apiCommit } from './api-commit'

/** Votes for the option `optionId` in the poll of the commit `commitId`; the commit, as /dev/null shows it since. */
export async function votePoll(api: Pick<Api, 'post'>, commitId: string, optionId: string): Promise<LogEntry> {
  const answer = await api.post(`/api/v1/commits/${commitId}/poll/votes`, { option: optionId })
  const data = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>).data : undefined
  const entry = apiCommit(data)

  if (entry === null) {
    throw new ApiError('/dev/null sent no commit once voted.', 200)
  }

  return entry
}
