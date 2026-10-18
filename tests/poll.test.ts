import { describe, expect, test } from 'claude-code/testing'

import { bar, canVote, percentage, status, votesLabel } from '../hooks/poll'
import type { LogPoll } from '../types'

const NOW = Date.parse('2026-10-17T11:00:00Z')

function poll(extra: Partial<LogPoll> = {}): LogPoll {
  return {
    closesAt: '2026-10-19T11:00:00Z',
    isClosed: false,
    hasVoted: false,
    totalVotes: null,
    options: [{ label: 'Yes', votes: null, isVoted: false }],
    ...extra,
  }
}

describe('saying where a poll is', () => {
  test('says how long is left to vote, as /dev/null does', () => {
    expect(status(poll(), NOW)).toBe('2d left')
    expect(status(poll({ closesAt: '2026-10-17T16:30:00Z' }), NOW)).toBe('5h left')
    expect(status(poll({ closesAt: '2026-10-17T11:20:30Z' }), NOW)).toBe('21m left')
    expect(status(poll({ closesAt: '2026-10-17T11:00:10Z' }), NOW)).toBe('1m left')
  })

  test('says when voting has not opened yet', () => {
    expect(status(poll({ closesAt: null }), NOW)).toBe('Voting opens once approved')
  })

  test('says when it closed, with or without its results', () => {
    expect(status(poll({ closesAt: '2026-10-16T11:00:00Z', totalVotes: 4 }), NOW)).toBe('Final results')
    expect(status(poll({ isClosed: true }), NOW)).toBe('Poll closed')
  })

  test('says whether it can still be voted in', () => {
    expect(canVote(poll(), NOW)).toBe(true)
    expect(canVote(poll({ hasVoted: true }), NOW)).toBe(false)
    expect(canVote(poll({ closesAt: null }), NOW)).toBe(false)
    expect(canVote(poll({ closesAt: '2026-10-16T11:00:00Z' }), NOW)).toBe(false)
    expect(canVote(poll({ isClosed: true }), NOW)).toBe(false)
  })
})

describe('drawing the votes of a poll', () => {
  test('counts its votes', () => {
    expect(votesLabel(1)).toBe('1 vote')
    expect(votesLabel(0)).toBe('0 votes')
    expect(votesLabel(12)).toBe('12 votes')
  })

  test('gives the share of an option, rounded', () => {
    expect(percentage(1, 3)).toBe(33)
    expect(percentage(2, 3)).toBe(67)
    expect(percentage(0, 0)).toBe(0)
  })

  test('draws a share as a bar', () => {
    expect(bar(50, 10)).toBe('█████░░░░░')
    expect(bar(0, 4)).toBe('░░░░')
    expect(bar(100, 4)).toBe('████')
    expect(bar(33, 10)).toBe('███░░░░░░░')
  })
})
