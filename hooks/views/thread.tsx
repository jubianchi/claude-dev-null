import type { EngineInterface } from 'claude-code'

import { EMPTY } from '../application/web-logs'
import type { Route } from '../router'
import { isThreadLoading, refreshThread, threadOf } from '../state/thread'
import type { View } from './view'
import { drawLog, itemsOf, listOf } from './web-log'

/** The commit whose thread `route` shows. */
function commitOf(route: Route): string {
  return route.params.commit ?? ''
}

/** Whether the thread `route` shows is not loaded yet, or loads with nothing shown yet. */
async function isFirstLoad($: EngineInterface, route: Route): Promise<boolean> {
  const shown = await threadOf($, commitOf(route))

  return shown === undefined || ((await isThreadLoading($, commitOf(route))) && shown.commits.length === 0)
}

/** The view of the thread of a commit, opened from it, while `isAvailable` says so: the API alone serves it. */
export function threadView($: EngineInterface, isAvailable: () => Promise<boolean>): View {
  return {
    id: 'thread',
    label: 'Thread',
    placement: 'detail',
    isAvailable,
    async refresh(route) {
      await refreshThread($, commitOf(route))

      return []
    },
    items: async route => itemsOf($, (await threadOf($, commitOf(route))) ?? EMPTY),
    async list(route, layout) {
      return listOf($, (await threadOf($, commitOf(route))) ?? EMPTY, await isFirstLoad($, route), layout)
    },
    async render(route, context) {
      return drawLog(
        $,
        (await threadOf($, commitOf(route))) ?? EMPTY,
        { isFirstLoad: await isFirstLoad($, route), isLoadingMore: false, empty: '' },
        context,
      )
    },
  }
}
