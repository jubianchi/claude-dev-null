import type { Elements } from 'claude-code'

import type { Entry, Thread as LogThread } from '../log'
import EmptyLog from './empty-log'
import Loader from './loader'
import Thread from './thread'

export type LogProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Code' | 'Link' | 'Markdown' | 'Text'>
  threads: readonly LogThread[]
  errors: readonly string[]
  /** What the log says once loaded with nothing to show, if anything. */
  empty: string
  /** Whether the log loads with nothing shown yet: its loader shows in place of its threads. */
  isFirstLoad: boolean
  /** Whether the log loads its next page: More greys out, its loader beside it. */
  isLoadingMore: boolean
  now: number
  offset: number
  onReply: (entry: Entry) => Promise<unknown>
  /** Loads more of the log, when it goes on. */
  onMore?: () => Promise<unknown>
}

/**
 * A log: its errors, then its threads, with More at the end while it goes on, centered in a box as wide as the log,
 * the loader in that box while the next page loads; the loader in place of the threads until it shows some, and what
 * it says when loaded with none.
 */
export default function Log(props: LogProps) {
  const { ui, threads, errors, empty, isFirstLoad, isLoadingMore, now, offset, onReply, onMore } = props
  const { Box, Button, Text } = ui
  const hasMore = !isFirstLoad && onMore !== undefined

  return (
    <Box key="log-body" flexDirection="column" paddingX={1}>
      {errors.length > 0 && (
        <Box key="log-error" flexDirection="column">
          {errors.map(error => (
            <Text color="red">{error}</Text>
          ))}
        </Box>
      )}
      {isFirstLoad && <Loader ui={ui} id="log-loading" now={now} />}
      {!isFirstLoad && threads.length === 0 && empty !== '' && <EmptyLog ui={ui} text={empty} />}
      {threads.slice(offset).map(thread => (
        <Thread ui={ui} thread={thread} now={now} onReply={onReply} />
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
