import { describe, expect, test } from 'claude-code/testing'

import { loadThread } from '../hooks/application/thread'
import type { Api } from '../hooks/infrastructure/api'
import { DeviceNotApproved } from '../hooks/infrastructure/api'
import { threadsOf } from '../hooks/log'

type Raw = Record<string, unknown>

function raw(id: string, parentId: string | null = null, replies = 0): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-19T10:00:00Z',
    parent_id: parentId,
    replies_count: replies,
    author: { handle: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
  }
}

/** The API answering each path with what `answers` holds for it, failing on the others. */
function reader(answers: Record<string, unknown>): Pick<Api, 'get'> {
  return {
    get: async path => {
      const found = answers[path]

      if (found === undefined) {
        throw new Error(`nothing at ${path}`)
      }

      if (found instanceof Error) {
        throw found
      }

      return found
    },
  }
}

const page = (data: Raw[]) => ({ data, meta: { next_cursor: null } })

describe('loading the thread of a commit', () => {
  test('shows the commit under those it replies to, from the one they start from, its replies under it', async () => {
    const thread = await loadThread(
      reader({
        '/api/v1/commits/c3': { data: raw('c3', 'c2', 1), ancestors: [raw('c1'), raw('c2', 'c1')] },
        '/api/v1/commits/c3/replies': page([raw('r1', 'c3')]),
      }),
      'c3',
    )
    const [shown] = threadsOf(thread.commits, thread.replies)

    expect(thread.error).toBe('')
    expect(thread.next).toBeNull()
    expect(shown?.commit.id).toBe('c1')
    expect(shown?.replies.map(reply => [reply.id, reply.depth])).toEqual([
      ['c2', 1],
      ['c3', 2],
      ['r1', 3],
    ])
  })

  test('shows a commit that replies to none on top', async () => {
    const thread = await loadThread(reader({ '/api/v1/commits/c1': { data: raw('c1'), ancestors: [] } }), 'c1')

    expect(thread.commits.map(entry => entry.id)).toEqual(['c1'])
    expect(thread.replies).toEqual([])
  })

  test('says why it could not load the thread', async () => {
    const thread = await loadThread(reader({}), 'c1')

    expect(thread.commits).toEqual([])
    expect(thread.error).toBe('Could not load the thread (nothing at /api/v1/commits/c1).')
  })

  test('says to sign in again once /dev/null no longer knows the device', async () => {
    const thread = await loadThread(
      reader({ '/api/v1/commits/c1': new DeviceNotApproved('This device is not approved.', 401) }),
      'c1',
    )

    expect(thread.error).toBe('Sign in again from the settings (⚙): /dev/null no longer knows this device.')
  })
})
