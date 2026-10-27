import { describe, expect, test } from 'claude-code/testing'

import type { Api } from '../hooks/infrastructure/api'
import { ApiError } from '../hooks/infrastructure/api'
import { readApiThread } from '../hooks/infrastructure/api-thread'

type Raw = Record<string, unknown>

function raw(id: string, parentId: string | null = null): Raw {
  return {
    id,
    body: `body of ${id}`,
    created_at: '2026-10-19T10:00:00Z',
    parent_id: parentId,
    author: { handle: 'nunomaduro', name: 'Nuno Maduro', lane: 0 },
  }
}

/** The API answering every request with `answer`, recording each path in `paths`. */
function reader(answer: unknown): Pick<Api, 'get'> & { paths: string[] } {
  const paths: string[] = []

  return {
    paths,
    get: async path => {
      paths.push(path)

      return answer
    },
  }
}

describe('reading the thread of a commit from the API', () => {
  test('reads the commit by its id', async () => {
    const found = reader({ data: raw('c/1'), ancestors: [] })
    await readApiThread(found, 'c/1')

    expect(found.paths).toEqual(['/api/v1/commits/c%2F1'])
  })

  test('reads the commit, and the commits it replies to, from the one it starts from', async () => {
    const thread = await readApiThread(reader({ data: raw('c3', 'c2'), ancestors: [raw('c1'), raw('c2', 'c1')] }), 'c3')

    expect(thread.commit.id).toBe('c3')
    expect(thread.ancestors.map(entry => entry.id)).toEqual(['c1', 'c2'])
  })

  test('reads a commit without the commits it replies to, when /dev/null sends none', async () => {
    const thread = await readApiThread(reader({ data: raw('c1') }), 'c1')

    expect(thread.ancestors).toEqual([])
  })

  test('leaves out what is not a commit among those it replies to', async () => {
    const thread = await readApiThread(reader({ data: raw('c2', 'c1'), ancestors: [raw('c1'), 'nope'] }), 'c2')

    expect(thread.ancestors.map(entry => entry.id)).toEqual(['c1'])
  })

  test('fails when /dev/null sends no commit', async () => {
    await expect(readApiThread(reader({ data: null }), 'c1')).rejects.toThrow(ApiError)
  })
})
