import type { WebLog } from '../../types'
import type { Api } from '../infrastructure/api'
import { readApiReplies } from '../infrastructure/api-replies'
import { readApiThread } from '../infrastructure/api-thread'
import { EMPTY, failure } from './web-logs'

/**
 * Loads the thread of the commit `id` as a log: the commit its thread starts from, then the commits down to `id`, and
 * the replies of `id` down their threads; when it cannot, says why.
 */
export async function loadThread(api: Pick<Api, 'get'>, id: string): Promise<WebLog> {
  try {
    const { commit, ancestors } = await readApiThread(api, id)
    const [first = commit, ...between] = ancestors
    const replies = await readApiReplies(api, [commit])

    return {
      commits: [first],
      replies: [...between, ...(first === commit ? [] : [commit]), ...replies],
      next: null,
      error: '',
    }
  } catch (error) {
    return { ...EMPTY, error: failure('the thread', error) }
  }
}
