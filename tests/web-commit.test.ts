import { describe, expect, test } from 'claude-code/testing'

import { commit } from '../hooks/infrastructure/web-commit'

type Raw = Record<string, unknown>

/** A commit as the web app's log pages serve it. */
function raw(extra: Raw = {}): Raw {
  return {
    id: '01a14bab-0ec6-734a-91a3-8008640033a0',
    user_id: '01a14535-59d3-7213-ad31-e1ace0adc640',
    body: 'It was DNS.',
    created_at: '2026-10-17T21:01:04.000000Z',
    updated_at: '2026-10-17T21:01:06.000000Z',
    status: 'approved',
    parent_id: null,
    deleted_at: null,
    root_id: null,
    hot_score: 1.5,
    pasteis_count: 0,
    replies_count: 2,
    is_saved: false,
    stars_count: 3,
    starred: false,
    reply_preview: { data: [], next_cursor: null, prev_cursor: null },
    user: { id: '01a14535', username: 'nunomaduro', name: 'Nuno Maduro', lane: 2 },
    link_preview: null,
    images: [],
    quoted_commit: null,
    poll: null,
    body_segments: [{ type: 'text', text: 'It was DNS.' }],
    preview_segments: null,
    ...extra,
  }
}

describe('reading a commit of the web app', () => {
  test('reads what a commit shows', () => {
    expect(commit(raw())).toEqual({
      id: '01a14bab-0ec6-734a-91a3-8008640033a0',
      shortHash: '40033a0',
      body: 'It was DNS.',
      parentId: null,
      url: 'https://dev-null.sh/@nunomaduro/commits/01a14bab-0ec6-734a-91a3-8008640033a0',
      createdAt: '2026-10-17T21:01:04.000000Z',
      stars: 3,
      starred: false,
      replies: 2,
      author: { username: 'nunomaduro', name: 'Nuno Maduro', lane: 2 },
      linkPreview: null,
      images: [],
      segments: [{ type: 'text', text: 'It was DNS.' }],
      quote: null,
      quotedId: null,
      continuationId: null,
      deletedAt: null,
      mentions: {},
      preview: null,
      poll: null,
    })
  })

  test('reads the text, the code and the blocks of code of a commit', () => {
    const body_segments = [
      { type: 'text', text: 'tia running this:\n' },
      { type: 'code', code: 'php artisan test' },
      {
        type: 'block',
        language: 'shell',
        html: '  Tests:    <span class="hl-number">2194</span> passed &amp; &lt;ok&gt; &quot;fine&quot; &#039;yes&#039; &#x1F600;',
      },
      { type: 'block', language: null, html: 'plain' },
    ]

    expect(commit(raw({ body_segments }))?.segments).toEqual([
      { type: 'text', text: 'tia running this:\n' },
      { type: 'code', code: 'php artisan test' },
      { type: 'block', language: 'shell', code: `  Tests:    2194 passed & <ok> "fine" 'yes' 😀` },
      { type: 'block', language: null, code: 'plain' },
    ])
  })

  test('reads the body as text when it has no segments', () => {
    expect(commit(raw({ body_segments: null }))?.segments).toEqual([{ type: 'text', text: 'It was DNS.' }])
    expect(commit(raw({ body: '', body_segments: null }))?.segments).toEqual([])
  })

  test('leaves out the segments it does not know', () => {
    const body_segments = [{ type: 'poll' }, { type: 'text', text: 'ok' }, { type: 'code' }, null]

    expect(commit(raw({ body_segments }))?.segments).toEqual([{ type: 'text', text: 'ok' }])
  })

  test('reads the commit it quotes, without the one that quotes', () => {
    const quoted_commit = raw({
      id: 'q1',
      body: 'Had Claude cook up some stats',
      user: { username: 'camilleislasse', name: 'Camille Islasse', lane: 1 },
      quoted_commit: raw({ id: 'q2' }),
    })
    const quote = commit(raw({ quoted_commit }))?.quote

    expect(quote?.id).toBe('q1')
    expect(quote?.author).toEqual({ username: 'camilleislasse', name: 'Camille Islasse', lane: 1 })
    expect(quote?.url).toBe('https://dev-null.sh/@camilleislasse/commits/q1')
    expect(quote?.quote).toBeNull()
  })

  test('reads the start /dev/null shows of a long commit, as it splits it', () => {
    const preview_segments = [{ type: 'text', text: 'The start…' }]

    expect(commit(raw({ preview_segments }))?.preview).toEqual([{ type: 'text', text: 'The start…' }])
    expect(commit(raw({ preview_segments: null }))?.preview).toBeNull()
  })

  test('reads whom it mentions, by their username in small letters', () => {
    expect(commit(raw({ mentions: { brendt: '01a1-brendt', 42: 7, bad: null } }))?.mentions).toEqual({
      brendt: '01a1-brendt',
    })
    expect(commit(raw({ mentions: [] }))?.mentions).toEqual({})
    expect(commit(raw({}))?.mentions).toEqual({})
  })

  test('reads the reply its author continues it with', () => {
    expect(commit(raw({ continuation_id: 'r9' }))?.continuationId).toBe('r9')
    expect(commit(raw({}))?.continuationId).toBeNull()
  })

  test('reads which commit it quotes, even when it comes without it', () => {
    expect(commit(raw({ quoted_commit_id: 'q1' }))?.quotedId).toBe('q1')
    expect(commit(raw({ quoted_commit: raw({ id: 'q2' }) }))?.quotedId).toBe('q2')
    expect(commit(raw({}))?.quotedId).toBeNull()
  })

  test('reads its poll, its options and their votes', () => {
    const poll = {
      id: 'p1',
      closes_at: '2026-10-19T10:00:00.000000Z',
      is_closed: false,
      has_voted: true,
      total_votes: 3,
      options: [
        { id: 'o1', label: 'Rust :crab:', votes_count: 2, voted: true },
        { id: 'o2', label: 'Go', votes_count: 1, voted: false },
        { id: 'o3' },
        { label: 'No id' },
      ],
    }

    expect(commit(raw({ poll }))?.poll).toEqual({
      closesAt: '2026-10-19T10:00:00.000000Z',
      isClosed: false,
      hasVoted: true,
      totalVotes: 3,
      options: [
        { id: 'o1', label: 'Rust :crab:', votes: 2, isVoted: true },
        { id: 'o2', label: 'Go', votes: 1, isVoted: false },
      ],
    })
  })

  test('reads a poll whose votes are not shown yet', () => {
    const poll = {
      closes_at: null,
      is_closed: false,
      has_voted: false,
      total_votes: null,
      options: [{ id: 'o1', label: 'Yes', votes_count: null, voted: false }],
    }

    expect(commit(raw({ poll }))?.poll).toEqual({
      closesAt: null,
      isClosed: false,
      hasVoted: false,
      totalVotes: null,
      options: [{ id: 'o1', label: 'Yes', votes: null, isVoted: false }],
    })
    expect(commit(raw({ poll: { options: 'none' } }))?.poll).toBeNull()
    expect(commit(raw())?.poll).toBeNull()
  })

  test('reads what a reply replies to', () => {
    expect(commit(raw({ parent_id: 'p1', root_id: 'r1' }))?.parentId).toBe('p1')
  })

  test('keeps the lane its author picked, a lane or a color', () => {
    expect(commit(raw({ user: { username: 'brendt', name: 'Brent', lane: '#0000ff' } }))?.author?.lane).toBe('#0000ff')
    expect(commit(raw({ user: { username: 'brendt', name: 'Brent', lane: null } }))?.author?.lane).toBeNull()
    expect(commit(raw({ user: { username: 'brendt', name: 'Brent', lane: 9 } }))?.author?.lane).toBeNull()
  })

  test('names the author by their username when they have no name', () => {
    expect(commit(raw({ user: { username: 'brendt', name: null, lane: 0 } }))?.author?.name).toBe('brendt')
  })

  test('reads the card of a link', () => {
    const link_preview = {
      url: 'https://github.com/nunomaduro/dev-null.sh/pull/338',
      title: 'feat: add remotes',
      description: 'One-to-one direct messages.',
      image_url: null,
      site_name: 'GitHub',
      is_pending: false,
      embed: null,
    }

    expect(commit(raw({ link_preview }))?.linkPreview).toEqual({
      url: 'https://github.com/nunomaduro/dev-null.sh/pull/338',
      title: 'feat: add remotes',
      description: 'One-to-one direct messages.',
      site: 'GitHub',
    })
  })

  test('leaves out the card of a link still being read', () => {
    const link_preview = {
      url: 'https://example.com',
      title: null,
      description: null,
      site_name: null,
      is_pending: true,
    }

    expect(commit(raw({ link_preview }))?.linkPreview).toBeNull()
  })

  test('reads the images', () => {
    const images = [
      { id: 'i1', width: 800, height: 600, description: 'A cat', url: 'https://dev-null.sh/commit-images/i1' },
      { id: 'i2', width: 10, height: 10, description: null },
    ]

    expect(commit(raw({ images }))?.images).toEqual([
      { url: 'https://dev-null.sh/commit-images/i1', width: 800, height: 600, description: 'A cat' },
    ])
  })

  test('reads a deleted commit as /dev/null keeps it in its thread: its id, what it replies to and its replies', () => {
    const deleted = {
      id: '01a14bab-0ec6-734a-91a3-8008640033a0',
      parent_id: 'c0',
      deleted_at: '2026-10-18T09:00:00.000000Z',
      replies_count: 2,
    }

    expect(commit(deleted)).toEqual({
      id: '01a14bab-0ec6-734a-91a3-8008640033a0',
      shortHash: '40033a0',
      body: '',
      parentId: 'c0',
      url: '',
      createdAt: '',
      stars: 0,
      replies: 2,
      author: null,
      deletedAt: '2026-10-18T09:00:00.000000Z',
      mentions: {},
      preview: null,
      linkPreview: null,
      images: [],
      segments: [],
      quote: null,
      quotedId: null,
      continuationId: null,
      poll: null,
    })
  })

  test('reads a quoted commit that was deleted', () => {
    const quote = commit(
      raw({ quoted_commit: { id: 'q1', parent_id: null, deleted_at: '2026-10-18T09:00:00Z' } }),
    )?.quote

    expect(quote?.deletedAt).toBe('2026-10-18T09:00:00Z')
    expect(quote?.author).toBeNull()
  })

  test('reads nothing that is not a commit', () => {
    expect(commit(null)).toBeNull()
    expect(commit('a commit')).toBeNull()
    expect(commit(raw({ id: 42 }))).toBeNull()
    expect(commit(raw({ user: null }))).toBeNull()
    expect(commit(raw({ user: { name: 'No username' } }))).toBeNull()
  })

  test('reads what is missing as nothing', () => {
    const found = commit({ id: 'c1', user: { username: 'zaydm' } })

    expect(found).toEqual({
      id: 'c1',
      shortHash: 'c1',
      body: '',
      parentId: null,
      url: 'https://dev-null.sh/@zaydm/commits/c1',
      createdAt: '',
      stars: 0,
      replies: 0,
      author: { username: 'zaydm', name: 'zaydm', lane: null },
      linkPreview: null,
      images: [],
      segments: [],
      quote: null,
      quotedId: null,
      continuationId: null,
      deletedAt: null,
      mentions: {},
      preview: null,
      poll: null,
    })
  })
})
