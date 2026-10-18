import type { Thread as LogThread } from '../log'
import { laneColor, level, REPLY_INSET } from '../log'
import type { Actions, Ui } from './commit'
import Commit from './commit'

export type ThreadProps = Actions & { ui: Ui; thread: LogThread; now: number }

/**
 * A commit and its replies, each reply right under what it replies to, `∟` in the color of its author, one level
 * further right per level, down to the third: the replies come threaded, in that order, each with its depth.
 */
export default function Thread(props: ThreadProps) {
  const { ui, thread, now, onReply } = props
  const { Box, Text } = ui
  const { commit, replies } = thread
  const authors = new Map([commit, ...replies].map(found => [found.id, found.author]))
  const actions = { onReply }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Commit ui={ui} entry={commit} now={now} kind="commit" isOrphan={commit.parentId !== null} {...actions} />
      {replies.map(reply => (
        <Box key={`nest-${reply.id}`} paddingLeft={REPLY_INSET * (level(reply) - 1)}>
          <Box marginTop={1}>
            <Text color={laneColor(authors.get(reply.parentId ?? '') ?? commit.author)} weight="bold">
              ∟{' '}
            </Text>
          </Box>
          <Commit ui={ui} entry={reply} now={now} kind="reply" isOrphan={false} {...actions} />
        </Box>
      ))}
    </Box>
  )
}
