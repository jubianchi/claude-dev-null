import type { LogEntry } from '../../types'
import type { Api } from '../infrastructure/api'
import { ApiError } from '../infrastructure/api'
import { votePoll } from '../infrastructure/api-poll'

/**
 * Votes for the option `optionId` in the poll of the commit `commitId`: the commit as /dev/null shows it since, or why
 * it refused, in its words, as the site says it.
 */
export async function vote(
  api: Pick<Api, 'post'>,
  commitId: string,
  optionId: string,
): Promise<{ entry: LogEntry } | { error: string }> {
  try {
    return { entry: await votePoll(api, commitId, optionId) }
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) {
      return { error: error.message }
    }

    return { error: `Could not vote (${error instanceof Error ? error.message : String(error)}).` }
  }
}
