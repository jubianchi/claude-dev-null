import type { EngineInterface, RenderElement } from 'claude-code'

import type { LogName, WebLog } from '../../types'
import Log from '../components/log'
import type { PollActions } from '../components/poll'
import type { Thread } from '../log'
import { arrived, arrivedReplies, entries, heights, limited, located, threadsOf } from '../log'
import { deviceSignedInAs } from '../state/device'
import { isLoaded, loadPictures, pictureOf } from '../state/pictures'
import { castVote, choose, pollChoicesOf, pollVoting } from '../state/polls'
import { perPage, showMoreReplies, shownRepliesOf } from '../state/replies'
import { toggleStar } from '../state/stars'
import { unfold, unfoldedIn } from '../state/unfolded'
import { isWebLogLoaded, loadMoreOfWebLog, refreshWebLog, webLog, webLogLoading } from '../state/web-logs'
import type { Layout, List, View, ViewContext } from './view'
import { NOTHING_ARRIVED } from './view'

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

/** The rows of each item of `shown`, which ends with More, or a loader, when `hasMore`, and the row of its error. */
export async function listOf(
  $: EngineInterface,
  shown: WebLog,
  hasMore: boolean,
  { columns, drawsPictures }: Layout,
): Promise<List> {
  return {
    heights: heights(await threadsShown($, shown), columns, hasMore, url => drawsPictures && isLoaded(url)),
    aboveRows: shown.error === '' ? 0 : 1,
  }
}

/**
 * The threads of `shown`, the commits whose Show more was pressed shown whole, each with the replies shown under its
 * commit and each reply, before Show more.
 */
async function threadsShown($: EngineInterface, shown: WebLog): Promise<Thread[]> {
  const whole = await unfoldedIn($, shown)
  const count = await perPage($)
  const asked = await shownRepliesOf($)

  return threadsOf(whole.commits, whole.replies).map(thread => limited(thread, count, asked))
}

/** The ids of the commits and replies `shown` lists, in their order, one an item. */
export async function itemsOf($: EngineInterface, shown: WebLog): Promise<string[]> {
  return entries(await threadsShown($, shown)).map(found => found.id)
}

/** How a log is drawn: whether it loads, what it says when empty, and how to load more of it. */
export type Drawn = { isFirstLoad: boolean; isLoadingMore: boolean; empty: string; onMore?: () => Promise<unknown> }

/** Draws `shown` as a log, from where it is scrolled to, the pictures near it loaded, each thread opening. */
export async function drawLog(
  $: EngineInterface,
  shown: WebLog,
  { isFirstLoad, isLoadingMore, empty, onMore }: Drawn,
  context: ViewContext,
): Promise<RenderElement> {
  const { ui, brand, columns, drawsPictures, offset, heights, visible, now, replyTo, isAvailable, open, arrived } =
    context
  const threads = await threadsShown($, shown)
  const errors = shown.error === '' ? [] : [shown.error]

  if (drawsPictures) {
    await loadPictures($, nearImages(threads, heights, offset, visible))
  }

  return (
    <Log
      ui={ui}
      brand={brand}
      threads={threads}
      errors={errors}
      empty={errors.length === 0 ? empty : ''}
      isFirstLoad={isFirstLoad}
      isLoadingMore={isLoadingMore}
      {...(onMore === undefined ? {} : { onMore })}
      columns={columns}
      {...(drawsPictures ? { pictureOf } : {})}
      now={now}
      viewer={await deviceSignedInAs($)}
      polls={await pollActions($)}
      start={located(threads, offset)}
      arrived={arrived}
      onReply={replyTo}
      {...((await deviceSignedInAs($)) === '' ? {} : { onStar: entry => toggleStar($, entry) })}
      onShowMore={id => unfold($, id)}
      onMoreReplies={id => showMoreReplies($, id)}
      {...(isAvailable('thread') ? { onThread: entry => open('thread', { commit: entry.id }) } : {})}
    />
  )
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
    async refresh(_route, how) {
      const before = await webLog($, name)
      await refreshWebLog($, name, how)
      const after = await webLog($, name)

      return how === 'kept' && name !== 'trending'
        ? { commits: arrived(before.commits, after.commits), replies: arrivedReplies(before.replies, after.replies) }
        : NOTHING_ARRIVED
    },
    items: async () => itemsOf($, await webLog($, name)),
    async list(_route, layout) {
      const shown = await webLog($, name)

      return listOf($, shown, shown.next !== null || (await isFirstLoad($, name)), layout)
    },
    async render(_route, context) {
      const shown = await webLog($, name)

      return drawLog(
        $,
        shown,
        {
          isFirstLoad: await isFirstLoad($, name),
          isLoadingMore: (await webLogLoading($, name)) === 'more',
          empty: 'No commits yet.',
          ...(shown.next === null ? {} : { onMore: () => loadMoreOfWebLog($, name) }),
        },
        context,
      )
    },
  }
}
