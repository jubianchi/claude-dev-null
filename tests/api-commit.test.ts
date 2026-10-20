import { describe, expect, test } from 'claude-code/testing'

import { apiCommit } from '../hooks/infrastructure/api-commit'

type Raw = Record<string, unknown>

/** A commit as the API serves it to a signed request, from a page of dev-null.sh. */
function raw(extra: Raw = {}): Raw {
  return {
    id: '01a154e6-acbc-724a-9427-68928c0830ce',
    short_hash: 'c0830ce',
    body: 'what features you want here?',
    parent_id: null,
    html_url: 'https://dev-null.sh/@nunomaduro/commits/01a154e6-acbc-724a-9427-68928c0830ce',
    created_at: '2026-10-19T16:02:46Z',
    stars_count: 13,
    replies_count: 25,
    link_preview: null,
    images: [],
    author: {
      id: '01a13fa8-6cd4-70ef-b8e5-f46a3ca70ca8',
      username: 'nunomaduro',
      name: 'Nuno Maduro',
      avatar_url: 'https://avatars.githubusercontent.com/u/5457236?v=4',
      html_url: 'https://dev-null.sh/@nunomaduro',
      created_at: '2026-10-15T13:02:44Z',
      lane: 2,
    },
    body_segments: [{ type: 'text', text: 'what features you want here?' }],
    preview_segments: null,
    mentions: [],
    status: 'approved',
    is_pinned: false,
    starred: false,
    is_saved: false,
    deleted_at: null,
    quoted_commit_id: null,
    quoted_commit: null,
    poll: null,
    reply_preview: { data: [], next_cursor: null },
    ...extra,
  }
}

describe('reading a commit of the API', () => {
  test('reads what a commit shows, its author included', () => {
    expect(apiCommit(raw())).toEqual({
      id: '01a154e6-acbc-724a-9427-68928c0830ce',
      shortHash: 'c0830ce',
      body: 'what features you want here?',
      parentId: null,
      url: 'https://dev-null.sh/@nunomaduro/commits/01a154e6-acbc-724a-9427-68928c0830ce',
      createdAt: '2026-10-19T16:02:46Z',
      stars: 13,
      replies: 25,
      author: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 2 },
      linkPreview: null,
      images: [],
      segments: [{ type: 'text', text: 'what features you want here?' }],
      quote: null,
      quotedId: null,
      continuationId: null,
      poll: null,
    })
  })

  test('reads the commit it quotes, and its author', () => {
    const quoted = raw({
      id: '01a14bab-0ec6-734a-91a3-8008640033a0',
      body: 'It was DNS.',
      body_segments: [{ type: 'text', text: 'It was DNS.' }],
      author: { username: 'jubianchi', name: 'Julien Bianchi' },
    })
    const found = apiCommit(raw({ quoted_commit_id: quoted.id, quoted_commit: quoted }))

    expect(found?.quote?.id).toBe('01a14bab-0ec6-734a-91a3-8008640033a0')
    expect(found?.quote?.author).toEqual({ username: 'jubianchi', name: 'Julien Bianchi', lane: null })
    expect(found?.quote?.quote).toBeNull()
  })

  test('reads its poll and its pictures', () => {
    const found = apiCommit(
      raw({
        images: [{ id: 'i1', url: 'https://dev-null.sh/commit-images/i1', width: 640, height: 480, description: null }],
        poll: {
          id: 'p1',
          closes_at: '2026-10-20T16:02:46Z',
          is_closed: false,
          has_voted: true,
          total_votes: 3,
          options: [{ id: 'o1', label: 'Tabs', votes_count: 3, voted: true, percentage: 100 }],
        },
      }),
    )

    expect(found?.images).toEqual([
      { url: 'https://dev-null.sh/commit-images/i1', width: 640, height: 480, description: null },
    ])
    expect(found?.poll).toEqual({
      closesAt: '2026-10-20T16:02:46Z',
      isClosed: false,
      hasVoted: true,
      totalVotes: 3,
      options: [{ label: 'Tabs', votes: 3, isVoted: true }],
    })
  })

  test('reads no commit that was deleted, which has no author', () => {
    expect(
      apiCommit({
        id: '01a154e6-acbc-724a-9427-68928c0830ce',
        parent_id: null,
        deleted_at: '2026-10-19T16:05:00Z',
        replies_count: 2,
      }),
    ).toBeNull()
  })

  test('reads nothing that is not a commit', () => {
    for (const value of [null, 'commit', [], { id: 'x' }, { id: 'x', author: null }, raw({ author: { name: 'x' } })]) {
      expect(apiCommit(value)).toBeNull()
    }
  })
})
