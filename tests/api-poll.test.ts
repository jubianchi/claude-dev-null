import { describe, expect, test } from 'claude-code/testing'

import type { Api } from '../hooks/infrastructure/api'
import { votePoll } from '../hooks/infrastructure/api-poll'

const COMMIT = '01a14bab-0ec6-734a-91a3-8008640033a0'
const OPTION = '01a14bab-0ec6-734a-91a3-8008640033a1'

/** The API answering `answer` to what it is sent, recorded. */
function sender(answer: unknown): Pick<Api, 'post'> & { sent: [string, Record<string, string>][] } {
  const sent: [string, Record<string, string>][] = []

  return {
    sent,
    post: async (path, payload) => {
      sent.push([path, payload])

      return answer
    },
  }
}

const voted = {
  data: {
    id: COMMIT,
    body: 'Tabs or spaces?',
    author: { handle: 'nunomaduro', name: 'Nuno Maduro', lane: 2 },
    poll: {
      closes_at: '2026-10-25T10:00:00Z',
      is_closed: false,
      has_voted: true,
      total_votes: 2,
      options: [
        { id: OPTION, label: 'Tabs', votes_count: 2, voted: true },
        { id: 'o2', label: 'Spaces', votes_count: 0, voted: false },
      ],
    },
  },
}

describe('voting in the poll of a commit through the API', () => {
  test('sends the option voted for, and reads the commit /dev/null answers with', async () => {
    const api = sender(voted)
    const entry = await votePoll(api, COMMIT, OPTION)

    expect(api.sent).toEqual([[`/api/v1/commits/${COMMIT}/poll/votes`, { option: OPTION }]])
    expect(entry.id).toBe(COMMIT)
    expect(entry.poll?.hasVoted).toBe(true)
    expect(entry.poll?.options.map(option => [option.id, option.votes, option.isVoted])).toEqual([
      [OPTION, 2, true],
      ['o2', 0, false],
    ])
  })

  test('says when /dev/null answers with no commit', async () => {
    await expect(votePoll(sender({ data: {} }), COMMIT, OPTION)).rejects.toThrow('/dev/null sent no commit')
  })
})
