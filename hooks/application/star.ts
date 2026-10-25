import type { LogEntry } from '../../types'
import type { Api } from '../infrastructure/api'
import { ApiError } from '../infrastructure/api'
import { starCommit } from '../infrastructure/api-star'

/**
 * Stars the commit `commitId`, or takes its star back: the commit as /dev/null shows it since, or why it refused, in
 * its words.
 */
export async function star(
  api: Pick<Api, 'post' | 'delete'>,
  commitId: string,
  isStarred: boolean,
): Promise<{ entry: LogEntry } | { error: string }> {
  try {
    return { entry: await starCommit(api, commitId, isStarred) }
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) {
      return { error: error.message }
    }

    return { error: `Could not star (${error instanceof Error ? error.message : String(error)}).` }
  }
}
