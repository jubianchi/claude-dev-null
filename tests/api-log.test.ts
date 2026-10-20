import { describe, expect, test } from 'claude-code/testing'

import type { Api } from '../hooks/infrastructure/api'
import { ApiError, api } from '../hooks/infrastructure/api'
import { readApiLog } from '../hooks/infrastructure/api-log'

type Raw = Record<string, unknown>

function raw(id: string, extra: Raw = {}): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-19T10:00:00Z',
    parent_id: null,
    author: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
    reply_preview: { data: [], next_cursor: null },
    ...extra,
  }
}

/** A page of the API, as Laravel paginates it with a cursor. */
function page(data: unknown[], next: string | null = null): Raw {
  return {
    data,
    links: {
      first: null,
      last: null,
      prev: null,
      next: next === null ? null : `https://dev-null.sh/api?cursor=${next}`,
    },
    meta: { path: 'https://dev-null.sh/api/v1/log/latest', per_page: 20, next_cursor: next, prev_cursor: null },
    is_ranked: false,
  }
}

/** The API answering every request with `answer`, recording each path in `paths`. */
function reader(answer: unknown): Api & { paths: string[] } {
  const paths: string[] = []

  return {
    paths,
    get: async path => {
      paths.push(path)

      return answer
    },
  }
}

describe('reading a log of the API', () => {
  test('reads the log by its name', async () => {
    const found = reader(page([]))
    await readApiLog(found, 'following')

    expect(found.paths).toEqual(['/api/v1/log/following'])
  })

  test('reads the commits after a cursor', async () => {
    const found = reader(page([]))
    await readApiLog(found, 'latest', { cursor: "eyJ+/='()*!" })

    expect(found.paths).toEqual(['/api/v1/log/latest?cursor=eyJ%2B%2F%3D%27%28%29%2A%21'])
  })

  test('reads the commits after any cursor through a signed request, which keeps the path as it is', async () => {
    const urls: string[] = []
    const signed = api({
      http: async url => {
        urls.push(url)

        return { status: 200, ok: true, headers: {}, text: JSON.stringify(page([])) }
      },
      sign: async () => 'U1NIU0lH',
      now: async () => 0,
      random: length => new Uint8Array(length),
    })
    await readApiLog(signed, 'latest', { cursor: "a b+/=?&#'()*!é" })

    expect(urls).toHaveLength(1)
  })

  test('reads the commits in the order of the log, and where it goes on', async () => {
    const log = await readApiLog(reader(page([raw('c2'), raw('c1'), raw('c3')], 'next')), 'trending')

    expect(log.commits.map(found => found.id)).toEqual(['c2', 'c1', 'c3'])
    expect(log.next).toBe('next')
  })

  test('says when the log ends', async () => {
    expect((await readApiLog(reader(page([raw('c1')])), 'latest')).next).toBeNull()
  })

  test('reads the replies the log shows under its commits', async () => {
    const log = await readApiLog(
      reader(
        page([
          raw('c1', { replies_count: 1, reply_preview: { data: [raw('r1', { parent_id: 'c1' })], next_cursor: null } }),
          raw('c2'),
        ]),
      ),
      'latest',
    )

    expect(log.commits.map(found => found.id)).toEqual(['c1', 'c2'])
    expect(log.replies.map(found => [found.id, found.parentId])).toEqual([['r1', 'c1']])
  })

  test('leaves out what is not a commit', async () => {
    const log = await readApiLog(reader(page([raw('c1'), { id: 'gone' }])), 'latest')

    expect(log.commits.map(found => found.id)).toEqual(['c1'])
  })

  test('says when /dev/null sends no commits', async () => {
    await expect(readApiLog(reader({ message: 'Server Error' }), 'following')).rejects.toBeInstanceOf(ApiError)
    await expect(readApiLog(reader({ message: 'Server Error' }), 'following')).rejects.toThrow(
      'the following log without its commits',
    )
  })
})
