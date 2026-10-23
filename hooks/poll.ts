import type { LogPoll } from '../types'

// The rules of resources/js/components/commit-poll.tsx, on /dev/null.

function hasExpired(poll: LogPoll, now: number): boolean {
  return poll.isClosed || (poll.closesAt !== null && Date.parse(poll.closesAt) <= now)
}

function timeLeft(closesAt: string, now: number): string {
  const minutes = Math.ceil((Date.parse(closesAt) - now) / 60_000)

  if (minutes >= 1440) {
    return `${Math.floor(minutes / 1440)}d left`
  }

  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h left`
  }

  return `${Math.max(minutes, 1)}m left`
}

/** Where a poll is, as /dev/null says it: not open yet, how long is left, or closed, with its results or not. */
export function status(poll: LogPoll, now: number): string {
  if (poll.closesAt === null) {
    return 'Voting opens once approved'
  }

  if (hasExpired(poll, now)) {
    return poll.totalVotes === null ? 'Poll closed' : 'Final results'
  }

  return timeLeft(poll.closesAt, now)
}

/** Whether the person reading can still vote in a poll, on /dev/null: not in their own, nor once it closed. */
export function canVote(poll: LogPoll, now: number, { isOwn = false }: { isOwn?: boolean } = {}): boolean {
  return !isOwn && poll.closesAt !== null && !poll.hasVoted && !hasExpired(poll, now)
}

export function votesLabel(count: number): string {
  return `${count} ${count === 1 ? 'vote' : 'votes'}`
}

/** The share of `votes` among `total`, in percent, rounded. */
export function percentage(votes: number, total: number): number {
  return total === 0 ? 0 : Math.round((votes / total) * 100)
}

/** The columns the bar of an option's share takes. */
export const BAR_WIDTH = 30

/** The columns drawn before an option's label once its votes show: its bar, its share (up to `100%`) and spaces. */
export const VOTED_INSET = BAR_WIDTH + 7

/** The columns drawn before an option's label until its votes show: its mark and a space. */
export const UNVOTED_INSET = 2

/** A share, in percent, as a bar `width` columns wide. */
export function bar(percent: number, width: number = BAR_WIDTH): string {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}
