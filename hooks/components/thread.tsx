import type { Thread as LogThread } from '../log'
import { laneColor, level, REPLY_INSET } from '../log'
import type { Actions, Pictures, Ui } from './commit'
import Commit from './commit'

export type ThreadProps = Actions &
  Pictures & {
    ui: Ui
    thread: LogThread
    /** The columns the thread takes. */
    columns: number
    now: number
    /** Where the thread starts showing, scrolled: its commit (0, the default) or its reply `from - 1`. */
    from?: number
  }

/**
 * A commit and its replies, each reply right under what it replies to, `∟` in the color of its author, one level
 * further right per level, down to the third: the replies come threaded, in that order, each with its depth. Scrolled
 * into, it starts at a reply, the lanes still those of the whole thread.
 */
export default function Thread(props: ThreadProps) {
  const { ui, thread, columns, now, from = 0, onReply, pictureOf } = props
  const { Box, Text } = ui
  const { commit, replies } = thread
  const authors = new Map([commit, ...replies].map(found => [found.id, found.author]))
  const shared = { onReply, now, ...(pictureOf === undefined ? {} : { pictureOf }) }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {from === 0 && (
        <Commit
          ui={ui}
          entry={commit}
          columns={columns}
          kind="commit"
          isOrphan={commit.parentId !== null}
          {...shared}
        />
      )}
      {replies.slice(Math.max(0, from - 1)).map(reply => (
        <Box key={`nest-${reply.id}`} paddingLeft={REPLY_INSET * (level(reply) - 1)}>
          <Box marginTop={1}>
            <Text color={laneColor(authors.get(reply.parentId ?? '') ?? commit.author)} weight="bold">
              ∟{' '}
            </Text>
          </Box>
          <Commit
            ui={ui}
            entry={reply}
            columns={columns - REPLY_INSET * level(reply)}
            kind="reply"
            isOrphan={false}
            {...shared}
          />
        </Box>
      ))}
    </Box>
  )
}
