import type { Entry, Thread as LogThread, Start } from '../log'
import type { Pictures, Ui } from './commit'
import EmptyLog from './empty-log'
import ErrorBox from './error-box'
import Loader from './loader'
import type { PollActions } from './poll'
import Thread from './thread'

export type LogProps = Pictures & {
  ui: Ui
  threads: readonly LogThread[]
  /** The columns the threads take, inside the log's padding. */
  columns: number
  errors: readonly string[]
  /** What the log says once loaded with nothing to show, if anything. */
  empty: string
  /** Whether the log loads with nothing shown yet: its loader shows in place of its threads. */
  isFirstLoad: boolean
  /** Whether the log loads its next page: More greys out, its loader beside it. */
  isLoadingMore: boolean
  now: number
  /** The username of the person reading, signed in; '' when no one is. */
  viewer: string
  polls: PollActions
  /** Where the log starts showing, scrolled: a thread, and in it its commit or one of its replies. */
  start: Start
  onReply: (entry: Entry) => Promise<unknown>
  /** Shows the commit `id` whole, in place of its start. */
  onShowMore?: (id: string) => Promise<unknown>
  /** Opens the thread of a commit, when it can be. */
  onThread?: (entry: Entry) => Promise<unknown>
  /** Loads more of the log, when it goes on. */
  onMore?: () => Promise<unknown>
}

/**
 * A log: its errors, then its threads, with More at the end while it goes on, centered in a box as wide as the log,
 * the loader in that box while the next page loads; the loader in place of the threads until it shows some, and what
 * it says when loaded with none.
 */
export default function Log(props: LogProps) {
  const {
    ui,
    threads,
    columns,
    errors,
    empty,
    isFirstLoad,
    isLoadingMore,
    now,
    viewer,
    polls,
    start,
    onReply,
    onThread,
    onShowMore,
    onMore,
    pictureOf,
  } = props
  const { Box, Button } = ui
  const hasMore = !isFirstLoad && onMore !== undefined

  return (
    <Box key="log-body" flexDirection="column" paddingX={1}>
      {errors.length > 0 && <ErrorBox ui={ui} id="log-error" messages={errors} />}
      {isFirstLoad && <Loader ui={ui} id="log-loading" now={now} />}
      {!isFirstLoad && threads.length === 0 && empty !== '' && <EmptyLog ui={ui} text={empty} />}
      {threads.slice(start.thread).map((thread, index) => (
        <Thread
          ui={ui}
          thread={thread}
          columns={columns}
          now={now}
          viewer={viewer}
          polls={polls}
          from={index === 0 ? start.from : 0}
          onReply={onReply}
          {...(onThread === undefined ? {} : { onThread })}
          {...(onShowMore === undefined ? {} : { onShowMore })}
          {...(pictureOf === undefined ? {} : { pictureOf })}
        />
      ))}
      {hasMore && isLoadingMore && <Loader ui={ui} id="more-box" now={now} />}
      {hasMore && !isLoadingMore && (
        <Box
          key="more-box"
          borderStyle="round"
          borderDimColor
          justifyContent="center"
          width="100%"
          hover={{ borderDimColor: false }}
        >
          <Button key="more" label=" More " dimColor={true} plain onPress={onMore} hover={{ dimColor: false }} />
        </Box>
      )}
    </Box>
  )
}
