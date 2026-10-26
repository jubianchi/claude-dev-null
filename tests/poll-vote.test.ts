import { describe, expect, test } from 'claude-code/testing'

import { vote } from '../hooks/application/poll-vote'
import type { Api } from '../hooks/infrastructure/api'
import { ApiError } from '../hooks/infrastructure/api'

const COMMIT = '01a14bab-0ec6-734a-91a3-8008640033a0'
const OPTION = '01a14bab-0ec6-734a-91a3-8008640033a1'

function answering(answer: unknown): Pick<Api, 'post'> {
  return {
    post: async () => {
      if (answer instanceof Error) {
        throw answer
      }

      return answer
    },
  }
}

describe('voting in a poll', () => {
  test('gives the commit with its poll as /dev/null now shows it', async () => {
    const data = {
      id: COMMIT,
      author: { handle: 'nunomaduro', name: 'Nuno Maduro' },
      poll: { closes_at: null, is_closed: false, has_voted: true, total_votes: 1, options: [] },
    }
    const found = await vote(answering({ data }), COMMIT, OPTION)

    expect('entry' in found && found.entry.poll?.hasVoted).toBe(true)
  })

  test('says why /dev/null refused the vote, in its own words', async () => {
    const refused = new ApiError('This poll is closed.', 422)

    expect(await vote(answering(refused), COMMIT, OPTION)).toEqual({ error: 'This poll is closed.' })
  })

  test('says why it could not vote otherwise', async () => {
    expect(await vote(answering(new Error('socket hang up')), COMMIT, OPTION)).toEqual({
      error: 'Could not vote (socket hang up).',
    })
  })
})
