import type { Brand } from '../brand'
import type { Thread as LogThread } from '../log'
import { laneColor, level, MAX_DEPTH, REPLY_INSET } from '../log'
import type { Actions, Pictures, Ui } from './commit'
import Commit from './commit'
import type { PollActions } from './poll'

export type ThreadProps = Actions &
  Pictures & {
    ui: Ui
    /** The colors of /dev/null in the theme of Claude Code. */
    brand: Brand
    thread: LogThread
    /** Shows more replies of the commit or reply `id`. */
    onMoreReplies: (id: string) => Promise<unknown>
    /** The columns the thread takes. */
    columns: number
    now: number
    /** The handle of the person reading, signed in; '' when no one is. */
    viewer: string
    polls: PollActions
    /** Where the thread starts showing, scrolled: its commit (0, the default) or its reply `from - 1`. */
    from?: number
    /** The ids of the commits and replies that arrived while the log refreshed on its own. */
    arrived?: readonly string[]
  }

/**
 * A commit and its replies, each reply right under what it replies to, `∟` in the color of its author, one level
 * further right per level, down to the fourth: the replies come threaded, in that order, each with its depth. Scrolled
 * into, it starts at a reply, the lanes still those of the whole thread.
 */
export default function Thread(props: ThreadProps) {
  const {
    ui,
    brand,
    thread,
    columns,
    now,
    viewer,
    polls,
    from = 0,
    arrived = [],
    onReply,
    onThread,
    onStar,
    onShowMore,
    onMoreReplies,
    pictureOf,
  } = props
  const { Box, Button, Text } = ui
  const { commit, replies } = thread
  const authors = new Map([commit, ...replies].map(found => [found.id, found.author]))
  const parentLane = (reply: (typeof replies)[number]) =>
    laneColor(authors.get(reply.parentId ?? '') ?? commit.author, brand.lanes)
  const shared = {
    brand,
    onReply,
    now,
    viewer,
    polls,
    ...(onThread === undefined ? {} : { onThread }),
    ...(onStar === undefined ? {} : { onStar }),
    ...(onShowMore === undefined ? {} : { onShowMore }),
    ...(pictureOf === undefined ? {} : { pictureOf }),
  }

  return (
    <Box flexDirection="column">
      {from === 0 && (
        <Commit
          ui={ui}
          entry={commit}
          columns={columns}
          kind="commit"
          isOrphan={commit.parentId !== null}
          isNew={arrived.includes(commit.id)}
          {...shared}
        />
      )}
      {replies.slice(Math.max(0, from - 1)).map(reply => [
        <Box key={`nest-${reply.id}`} paddingLeft={REPLY_INSET * (level(reply) - 1)}>
          <Box flexDirection="column">
            <Text color={parentLane(reply)}>▎</Text>
            <Text color={parentLane(reply)} weight="bold">
              ∟{' '}
            </Text>
          </Box>
          <Commit
            ui={ui}
            entry={reply}
            columns={columns - REPLY_INSET * level(reply)}
            kind="reply"
            isOrphan={false}
            isNew={arrived.includes(reply.id)}
            {...shared}
          />
        </Box>,
        ...(reply.more ?? []).map(more => (
          <Box
            key={`more-replies-box-${more.id}`}
            marginTop={1}
            paddingLeft={REPLY_INSET * Math.min(more.depth, MAX_DEPTH)}
          >
            <Button
              key={`more-replies-${more.id}`}
              dimColor
              label={`Show ${more.count} more`}
              onPress={() => onMoreReplies(more.id)}
            />
          </Box>
        )),
      ])}
    </Box>
  )
}
