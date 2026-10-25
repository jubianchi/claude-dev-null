import { describe, expect, test } from 'claude-code/testing'

import type { Api } from '../hooks/infrastructure/api'
import { ApiError } from '../hooks/infrastructure/api'
import { starCommit } from '../hooks/infrastructure/api-star'

const COMMIT = '01a14bab-0ec6-734a-91a3-8008640033a0'

/** The API answering `answer` to what it is sent, recorded. */
function sender(answer: unknown): Pick<Api, 'post' | 'delete'> & { sent: [string, string][] } {
  const sent: [string, string][] = []

  return {
    sent,
    post: async path => {
      sent.push(['POST', path])

      return answer
    },
    delete: async path => {
      sent.push(['DELETE', path])

      return answer
    },
  }
}

const starred = {
  data: {
    id: COMMIT,
    body: 'It was DNS.',
    stars_count: 2,
    starred: true,
    author: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 2 },
  },
}

describe('starring a commit through the API', () => {
  test('stars it, and reads the commit /dev/null answers with', async () => {
    const api = sender(starred)
    const entry = await starCommit(api, COMMIT, true)

    expect(api.sent).toEqual([['POST', `/api/v1/commits/${COMMIT}/star`]])
    expect(entry).toMatchObject({ id: COMMIT, stars: 2, starred: true })
  })

  test('takes its star back', async () => {
    const api = sender({ data: { ...starred.data, stars_count: 1, starred: false } })
    const entry = await starCommit(api, COMMIT, false)

    expect(api.sent).toEqual([['DELETE', `/api/v1/commits/${COMMIT}/star`]])
    expect(entry).toMatchObject({ stars: 1, starred: false })
  })

  test('names the commit in its path as it is written in no other way', async () => {
    const api = sender(starred)
    await starCommit(api, 'a/b', true)

    expect(api.sent).toEqual([['POST', '/api/v1/commits/a%2Fb/star']])
  })

  test('fails when /dev/null answers with no commit', async () => {
    await expect(starCommit(sender({}), COMMIT, true)).rejects.toThrow(ApiError)
  })
})
