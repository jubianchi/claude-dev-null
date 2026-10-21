import type { Elements } from 'claude-code'

import type { LogPoll } from '../../types'
import { emojify } from '../emoji'
import { bar, canVote, percentage, status, votesLabel } from '../poll'

export type PollProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Link' | 'Text'>
  /** The commit the poll is of, for its address. */
  id: string
  poll: LogPoll
  /** The link to the commit, where the poll is voted in. */
  url: string
  /** The color of the commit's author, the bars are drawn in. */
  color: string
  now: number
  /** Whether the poll may be voted in from here: not that of the person reading, nor of a commit quoted. */
  isVotable: boolean
}

/**
 * A commit's poll, read only: its options, with their share once /dev/null shows the votes, the one voted for marked,
 * where it is, and a link to vote in it on /dev/null while it can be.
 */
export default function Poll(props: PollProps) {
  const { ui, id, poll, url, color, now, isVotable } = props
  const isOpen = canVote(poll, now, { isOwn: !isVotable })
  const { Box, Link, Text } = ui
  const total = poll.totalVotes ?? 0

  return (
    <Box key={`poll-${id}`} flexDirection="column" marginTop={1}>
      {poll.options.map(option =>
        option.votes === null ? (
          <Text>○ {emojify(option.label)}</Text>
        ) : (
          <Text weight={option.isVoted ? 'bold' : 'regular'}>
            <Text color={color}>{bar(percentage(option.votes, total))}</Text> {percentage(option.votes, total)}%{' '}
            {emojify(option.label)}
            {option.isVoted ? ' ✓' : ''}
          </Text>
        ),
      )}
      <Text dimColor>
        {status(poll, now)}
        {poll.totalVotes === null ? '' : ` · ${votesLabel(poll.totalVotes)}`}
        {isOpen && ' · '}
        {isOpen && <Link href={url} label="Vote on dev-null.sh" />}
      </Text>
    </Box>
  )
}
