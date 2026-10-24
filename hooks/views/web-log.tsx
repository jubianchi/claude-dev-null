import type { EngineInterface } from 'claude-code'

import type { LogName } from '../../types'
import Log from '../components/log'
import type { PollActions } from '../components/poll'
import type { Thread } from '../log'
import { entries, heights, located, threadsOf } from '../log'
import { deviceSignedInAs } from '../state/device'
import { isLoaded, loadPictures, pictureOf } from '../state/pictures'
import { castVote, choose, pollChoicesOf, pollVoting } from '../state/polls'
import { isWebLogLoaded, loadMoreOfWebLog, refreshWebLog, webLog, webLogLoading } from '../state/web-logs'
import type { View } from './view'

/** Whether `name` loads with nothing shown yet, or is not loaded yet: its loader shows in place of its threads. */
async function isFirstLoad($: EngineInterface, name: LogName): Promise<boolean> {
  if (!(await isWebLogLoaded($, name))) {
    return true
  }

  return (await webLogLoading($, name)) !== '' && (await webLog($, name)).commits.length === 0
}

/** What the log lets the person reading do with the polls it shows: vote in them, once the device is approved. */
async function pollActions($: EngineInterface): Promise<PollActions> {
  const choices = await pollChoicesOf($)

  return {
    isSignedIn: (await deviceSignedInAs($)) !== '',
    choiceOf: id => choices[id] ?? '',
    votingId: await pollVoting($),
    onChoose: (id, optionId) => choose($, id, optionId),
    onVote: id => castVote($, id),
  }
}

/** The URLs of the images of the commits and replies from `offset` on, down to twice the rows the list shows. */
function nearImages(threads: readonly Thread[], heights: readonly number[], offset: number, visible: number): string[] {
  const items = entries(threads)
  const urls: string[] = []
  let rows = 0

  for (let index = offset; index < items.length && rows < visible * 2; index++) {
    rows += heights[index] ?? 0
    urls.push(...(items[index]?.images.map(image => image.url) ?? []))
  }

  return urls
}

/** The view of the log `name`, a tab labelled `label`, shown while `isAvailable` says so. */
export function webLogView(
  $: EngineInterface,
  name: LogName,
  label: string,
  isAvailable: () => Promise<boolean> = async () => true,
): View {
  return {
    id: name,
    label,
    placement: 'tab',
    isAvailable,
    refresh: () => refreshWebLog($, name),
    isRefreshing: async () => (await webLogLoading($, name)) === 'refresh',
    async list(_route, { columns, drawsPictures }) {
      const shown = await webLog($, name)

      return {
        heights: heights(
          threadsOf(shown.commits, shown.replies),
          columns,
          shown.next !== null || (await isFirstLoad($, name)),
          url => drawsPictures && isLoaded(url),
        ),
        aboveRows: shown.error === '' ? 0 : 1,
      }
    },
    async render(_route, { ui, columns, drawsPictures, offset, heights, visible, now, replyTo }) {
      const { commits, replies, next, error } = await webLog($, name)
      const threads = threadsOf(commits, replies)
      const errors = error === '' ? [] : [error]

      if (drawsPictures) {
        await loadPictures($, nearImages(threads, heights, offset, visible))
      }

      return (
        <Log
          ui={ui}
          threads={threads}
          errors={errors}
          empty={errors.length === 0 ? 'No commits yet.' : ''}
          isFirstLoad={await isFirstLoad($, name)}
          isLoadingMore={(await webLogLoading($, name)) === 'more'}
          {...(next === null ? {} : { onMore: () => loadMoreOfWebLog($, name) })}
          columns={columns}
          {...(drawsPictures ? { pictureOf } : {})}
          now={now}
          viewer={await deviceSignedInAs($)}
          polls={await pollActions($)}
          start={located(threads, offset)}
          onReply={replyTo}
        />
      )
    },
  }
}
