import type { Elements } from 'claude-code'

import type { LogPoll } from '../../types'
import { emojify } from '../emoji'
import { bar, canVote, percentage, status, votesLabel } from '../poll'
import Link from './link'

/** What the person reading can do with polls: whether they may vote here, and what they chose and are voting for. */
export type PollActions = {
  /** Whether a device is approved, which votes in the polls of the log. */
  isSignedIn: boolean
  /** The id of the option chosen in the poll of the commit `id`, '' while none is. */
  choiceOf: (id: string) => string
  /** The commit whose poll is being voted in, '' while none is. */
  votingId: string
  onChoose: (id: string, optionId: string) => Promise<unknown>
  onVote: (id: string) => Promise<unknown>
}

export type PollProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Link' | 'Text'>
  /** The commit the poll is of, for its address. */
  id: string
  poll: LogPoll
  /** The link to the commit, where the poll is voted in on /dev/null. */
  url: string
  /** The color of the commit's author, the bars are drawn in. */
  color: string
  /** The color of the link to vote on /dev/null, its primary. */
  linkColor: string
  now: number
  /** Whether the poll is that of the person reading, who sees its results instead of voting. */
  isOwn: boolean
  /** Whether the poll is drawn in a commit quoting it, which votes in nothing. */
  isStatic: boolean
  polls: PollActions
}

/**
 * A commit's poll, as /dev/null draws it: its options, with their share once it shows the votes, the one voted for
 * marked, and where it is; while it can be voted in, its options to choose from and Vote, once a device is approved,
 * or else a link to vote in it on /dev/null.
 */
export default function Poll(props: PollProps) {
  const { ui, id, poll, url, color, linkColor, now, isOwn, isStatic, polls } = props
  const { Box, Button, Text } = ui
  const total = poll.totalVotes ?? 0
  const isOpen = canVote(poll, now, { isOwn, isStatic })
  const isVotable = isOpen && polls.isSignedIn && poll.totalVotes === null
  const choice = polls.choiceOf(id)
  const isVoting = polls.votingId === id

  return (
    <Box key={`poll-${id}`} flexDirection="column" marginTop={1}>
      {poll.options.map(option =>
        option.votes === null ? (
          isVotable ? (
            <Button
              key={`poll-option-${id}-${option.id}`}
              label={`${choice === option.id ? '●' : '○'} ${emojify(option.label)}`}
              onPress={() => (isVoting ? Promise.resolve() : polls.onChoose(id, option.id))}
            />
          ) : (
            <Text>○ {emojify(option.label)}</Text>
          )
        ) : (
          <Text weight={option.isVoted ? 'bold' : 'regular'}>
            <Text color={color}>{bar(percentage(option.votes, total))}</Text> {percentage(option.votes, total)}%{' '}
            {emojify(option.label)}
            {option.isVoted ? ' ✓' : ''}
          </Text>
        ),
      )}
      <Box gap={1}>
        <Text dimColor>
          {status(poll, now)}
          {poll.totalVotes === null ? '' : ` · ${votesLabel(poll.totalVotes)}`}
          {(isVotable || (isOpen && !polls.isSignedIn)) && ' ·'}
        </Text>
        {isOpen && !polls.isSignedIn && <Link ui={ui} href={url} label="Vote on dev-null.sh" color={linkColor} />}
        {isVotable &&
          (isVoting ? (
            <Text dimColor>Voting…</Text>
          ) : choice === '' ? (
            <Text dimColor>Vote</Text>
          ) : (
            <Button key={`poll-vote-${id}`} label="Vote" onPress={() => polls.onVote(id)} />
          ))}
      </Box>
    </Box>
  )
}
