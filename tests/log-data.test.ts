import { describe, expect, test } from 'claude-code/testing'
import { BRANDS } from '../hooks/brand'
import type { Entry } from '../hooks/log'
import {
  ago,
  entries,
  heights,
  lane,
  laneColor,
  located,
  RAIL,
  rows,
  scrolled,
  shownItems,
  threadsOf,
} from '../hooks/log'

function entry(id: string, createdAt: string, parentId: string | null = null): Entry {
  return {
    id,
    shortHash: id,
    body: id,
    parentId,
    url: `https://dev-null.sh/commits/${id}`,
    createdAt,
    stars: 0,
    replies: 0,
    author: { handle: 'me', name: 'Me' },
    linkPreview: null,
    images: [],
    segments: [{ type: 'text', text: id }],
    quote: null,
    quotedId: null,
    continuationId: null,
    deletedAt: null,
    mentions: {},
    preview: null,
    poll: null,
  }
}

describe('threading the log', () => {
  test('puts each reply under its commit, newest reply first', () => {
    const log = threadsOf(
      [entry('c2', '2026-10-17T11:00:00Z'), entry('c1', '2026-10-17T09:00:00Z')],
      [entry('r1', '2026-10-17T10:00:00Z', 'c1'), entry('r2', '2026-10-17T12:00:00Z', 'c1')],
    )

    expect(log.map(thread => [thread.commit.id, thread.replies.map(reply => reply.id)])).toEqual([
      ['c2', []],
      ['c1', ['r2', 'r1']],
    ])
  })

  test('puts a quote under the commit it quotes, as /dev/null does', () => {
    const quote = { ...entry('q1', '2026-10-17T10:00:00Z'), quotedId: 'c1' }
    const log = threadsOf([entry('c1', '2026-10-17T09:00:00Z')], [quote, entry('r1', '2026-10-17T11:00:00Z', 'q1')])

    expect(log.map(thread => [thread.commit.id, thread.replies.map(reply => [reply.id, reply.depth])])).toEqual([
      [
        'c1',
        [
          ['q1', 1],
          ['r1', 2],
        ],
      ],
    ])
  })

  test('puts a quote that replies under the commit it replies to, once', () => {
    const quote = { ...entry('q1', '2026-10-17T10:00:00Z', 'c1'), quotedId: 'c2' }
    const log = threadsOf([entry('c1', '2026-10-17T09:00:00Z'), entry('c2', '2026-10-17T08:00:00Z')], [quote])

    expect(log.map(thread => [thread.commit.id, thread.replies.map(reply => reply.id)])).toEqual([
      ['c1', ['q1']],
      ['c2', []],
    ])
  })

  test('puts a reply to a reply under the commit of its thread', () => {
    const log = threadsOf(
      [entry('c1', '2026-10-17T09:00:00Z')],
      [entry('r2', '2026-10-17T12:00:00Z', 'r1'), entry('r1', '2026-10-17T10:00:00Z', 'c1')],
    )

    expect(log.map(thread => [thread.commit.id, thread.replies.map(reply => reply.id)])).toEqual([['c1', ['r1', 'r2']]])
  })

  test('keeps the commits of a log in its order, each with its replies', () => {
    const log = threadsOf(
      [entry('c2', '2026-10-17T09:00:00Z'), entry('c1', '2026-10-17T11:00:00Z'), entry('c3', '2026-10-17T10:00:00Z')],
      [
        entry('r3', '2026-10-17T13:00:00Z', 'r1'),
        entry('r2', '2026-10-17T12:00:00Z', 'c2'),
        entry('r1', '2026-10-17T11:30:00Z', 'c2'),
      ],
    )

    expect(log.map(thread => [thread.commit.id, thread.replies.map(reply => [reply.id, reply.depth])])).toEqual([
      [
        'c2',
        [
          ['r2', 1],
          ['r1', 1],
          ['r3', 2],
        ],
      ],
      ['c1', []],
      ['c3', []],
    ])
  })

  test('leaves out a reply to nothing the log shows, and a commit listed twice', () => {
    const log = threadsOf(
      [entry('c1', '2026-10-17T09:00:00Z'), entry('c1', '2026-10-17T09:00:00Z')],
      [entry('r1', '2026-10-17T10:00:00Z', 'elsewhere')],
    )

    expect(log.map(thread => [thread.commit.id, thread.replies.length])).toEqual([['c1', 0]])
  })

  test('puts each reply right under what it replies to, one level deeper', () => {
    const log = threadsOf(
      [entry('c1', '2026-10-17T09:00:00Z')],
      [
        entry('r4', '2026-10-17T14:00:00Z', 'r3'),
        entry('r3', '2026-10-17T13:00:00Z', 'r1'),
        entry('r2', '2026-10-17T12:00:00Z', 'c1'),
        entry('r1', '2026-10-17T10:00:00Z', 'c1'),
      ],
    )

    expect(log.map(thread => thread.replies.map(reply => [reply.id, reply.depth]))).toEqual([
      [
        ['r2', 1],
        ['r1', 1],
        ['r3', 2],
        ['r4', 3],
      ],
    ])
  })
})

describe('drawing the log', () => {
  const now = Date.parse('2026-10-17T11:00:00Z')

  test('says how long ago a commit was', () => {
    expect(ago(now, '2026-10-17T10:59:30Z')).toBe('now')
    expect(ago(now, '2026-10-17T10:18:00Z')).toBe('42m')
    expect(ago(now, '2026-10-17T06:00:00Z')).toBe('5h')
    expect(ago(now, '2026-10-14T11:00:00Z')).toBe('3d')
    expect(ago(now, '2026-10-01T11:00:00Z')).toBe('Oct 1')
    expect(ago(now, '2025-10-01T11:00:00Z')).toBe('Oct 1, 2025')
    expect(ago(now, 'not a date')).toBe('')
  })

  test('draws a developer in the lane they picked on /dev/null, in the dark theme unless told', () => {
    expect(laneColor({ handle: 'nunomaduro', lane: 2 })).toBe('#da77f2')
    expect(laneColor({ handle: 'nunomaduro', lane: '#0000ff' })).toBe('#0000ff')
  })

  test('draws a developer in the lane they picked in the colors of the theme', () => {
    expect(laneColor({ handle: 'nunomaduro', lane: 2 }, BRANDS.light.lanes)).toBe('#9c36b5')
    expect(laneColor(null, BRANDS.light.lanes)).toBe(RAIL)
  })

  test('draws a developer whose lane is not known in one of the lanes, always the same', () => {
    expect(laneColor({ handle: 'nunomaduro', lane: null })).toBe(lane('nunomaduro'))
    expect(laneColor({ handle: 'nunomaduro' })).toBe(lane('nunomaduro'))
    expect(laneColor({ handle: 'nunomaduro' }, BRANDS.light.lanes)).toBe(lane('nunomaduro', BRANDS.light.lanes))
  })

  test('gives each developer one of the lanes, always the same', () => {
    expect(BRANDS.dark.lanes).toContain(lane('nunomaduro'))
    expect(BRANDS.light.lanes.indexOf(lane('nunomaduro', BRANDS.light.lanes))).toBe(
      BRANDS.dark.lanes.indexOf(lane('nunomaduro')),
    )
    expect(lane('nunomaduro')).toBe(lane('nunomaduro'))
    expect(
      new Set(['nunomaduro', 'brendt', 'solaxes', 'zaydm', 'hacksore', 'gummipunkt'].map(name => lane(name))).size,
    ).toBeGreaterThan(1)
  })
})

describe('scrolling the log', () => {
  const tenOfFive = Array.from({ length: 10 }, () => 5)

  test('shows the items from where it is scrolled to whose top fits in its rows', () => {
    expect(shownItems(tenOfFive, 0, 20)).toEqual([0, 1, 2, 3])
    expect(shownItems(tenOfFive, 2, 12)).toEqual([2, 3, 4])
    expect(shownItems(tenOfFive, 8, 20)).toEqual([8, 9])
    expect(shownItems([30, 5], 0, 10)).toEqual([0])
    expect(shownItems(tenOfFive, 0, 0)).toEqual([])
  })

  test('a wheel tick or an arrow moves one item', () => {
    expect(scrolled(0, 1, tenOfFive, 20)).toBe(1)
    expect(scrolled(5, -1, tenOfFive, 20)).toBe(4)
  })

  test('a move of rows moves the items those rows hold', () => {
    expect(scrolled(0, 10, tenOfFive, 20)).toBe(2)
    expect(scrolled(0, 11, tenOfFive, 20)).toBe(3)
    expect(scrolled(5, -10, tenOfFive, 20)).toBe(3)
    expect(scrolled(0, 10, [2, 2, 2, 8, 8, 8, 8], 10)).toBe(4)
  })

  test('stops once the end of the list shows', () => {
    expect(scrolled(0, 10_000, tenOfFive, 20)).toBe(6)
    expect(scrolled(6, 1, tenOfFive, 20)).toBe(6)
    expect(scrolled(0, 10_000, [3, 3, 9, 4, 4], 10)).toBe(3)
  })

  test('can still show an item taller than the rows', () => {
    expect(scrolled(0, 10_000, [3, 30], 10)).toBe(1)
  })

  test('does not move a list that fits', () => {
    expect(scrolled(0, 5, [3, 3, 3], 20)).toBe(0)
  })

  test('never goes above the first item', () => {
    expect(scrolled(0, -1, tenOfFive, 20)).toBe(0)
    expect(scrolled(3, -10_000, tenOfFive, 20)).toBe(0)
  })

  test('stays at the top of an empty list', () => {
    expect(scrolled(0, 1, [], 20)).toBe(0)
    expect(scrolled(4, -1, [], 20)).toBe(0)
  })

  test('brings back an offset past the end', () => {
    expect(scrolled(9, 0, tenOfFive, 20)).toBe(6)
  })

  describe('finding where the list starts', () => {
    const at = '2026-10-17T10:00:00Z'
    const list = [
      {
        commit: entry('c1', at),
        replies: [
          { ...entry('r1', at, 'c1'), depth: 1 },
          { ...entry('r2', at, 'c1'), depth: 1 },
        ],
      },
      { commit: entry('c2', at), replies: [] },
    ]

    test('starts at the commit of the first thread', () => {
      expect(located(list, 0)).toEqual({ thread: 0, from: 0 })
    })

    test('starts at a reply, its commit and the replies above it left out', () => {
      expect(located(list, 1)).toEqual({ thread: 0, from: 1 })
      expect(located(list, 2)).toEqual({ thread: 0, from: 2 })
    })

    test('starts at the commit of the next thread once a thread is past', () => {
      expect(located(list, 3)).toEqual({ thread: 1, from: 0 })
    })

    test('starts past the threads on More', () => {
      expect(located(list, 4)).toEqual({ thread: 2, from: 0 })
      expect(located([], 0)).toEqual({ thread: 0, from: 0 })
    })

    test('gives the commits and replies of the list in the order of its items', () => {
      expect(entries(list).map(found => found.id)).toEqual(['c1', 'r1', 'r2', 'c2'])
      expect(entries(list)).toHaveLength(heights(list, 80, false).length)
    })

    test('a wheel tick moves from a commit to its first reply', () => {
      expect(located(list, scrolled(0, 1, heights(list, 80, false), 10))).toEqual({ thread: 0, from: 1 })
    })
  })
})

describe('measuring the log', () => {
  const commit = (body: string, extra: Partial<Entry> = {}): Entry => ({
    id: 'c1',
    shortHash: 'c1',
    body,
    parentId: null,
    url: '',
    createdAt: '2026-10-17T10:00:00Z',
    stars: 0,
    replies: 0,
    author: { handle: 'me', name: 'Me' },
    linkPreview: null,
    images: [],
    segments: [{ type: 'text', text: body }],
    quote: null,
    quotedId: null,
    continuationId: null,
    deletedAt: null,
    mentions: {},
    preview: null,
    poll: null,
    ...extra,
  })

  const reply = (body: string, depth: number) => ({ ...commit(body), depth })

  test('a commit of one line takes its header, its line, its counts and the rows around them', () => {
    expect(rows({ commit: commit('It was DNS.'), replies: [] }, 80)).toBe(5)
  })

  test('a long line wraps at the width left by the lane and the padding', () => {
    expect(rows({ commit: commit('x'.repeat(76)), replies: [] }, 80)).toBe(5)
    expect(rows({ commit: commit('x'.repeat(77)), replies: [] }, 80)).toBe(6)
  })

  test('each line of a commit counts', () => {
    expect(rows({ commit: commit('one\ntwo\n\nfour'), replies: [] }, 80)).toBe(8)
  })

  test('a link card takes its frame and its lines', () => {
    const linkPreview = { url: 'https://example.com', title: 'Title', description: 'Description', site: 'Site' }

    expect(rows({ commit: commit('x', { linkPreview }), replies: [] }, 80)).toBe(5 + 5)
  })

  test('a link card without a title takes no row, as /dev/null draws none', () => {
    const linkPreview = { url: 'https://example.com', title: null, description: 'Description', site: 'Site' }

    expect(rows({ commit: commit('x', { linkPreview }), replies: [] }, 80)).toBe(5)
  })

  test('a link card always takes the row of its site, named after its host when it has no name', () => {
    const linkPreview = { url: 'https://example.com', title: 'Title', description: null, site: null }

    expect(rows({ commit: commit('x', { linkPreview }), replies: [] }, 80)).toBe(5 + 4)
  })

  test('the link card of a quoted commit takes its rows in the quote', () => {
    const linkPreview = { url: 'https://example.com', title: 'Title', description: null, site: null }

    expect(rows({ commit: commit('x', { quote: commit('one', { linkPreview }) }), replies: [] }, 80)).toBe(
      5 + 2 + 1 + 1 + 4,
    )
  })

  test('images take a row', () => {
    const images = [{ url: 'https://example.com/i', width: 1, height: 1, description: null }]

    expect(rows({ commit: commit('x', { images }), replies: [] }, 80)).toBe(6)
  })

  test('a picture drawn takes its box and the row of its link; the images left as links, their row', () => {
    const drawn = { url: 'https://dev-null.sh/commit-images/a', width: 1600, height: 800, description: null }
    const linked = { url: 'https://dev-null.sh/commit-images/b', width: 1600, height: 800, description: null }
    const isDrawn = (url: string) => url === drawn.url

    expect(rows({ commit: commit('x', { images: [drawn, linked] }), replies: [] }, 80, isDrawn)).toBe(5 + 15 + 1 + 1)
    expect(rows({ commit: commit('x', { images: [drawn] }), replies: [] }, 80, isDrawn)).toBe(5 + 15 + 1)
    expect(heights([{ commit: commit('x', { images: [drawn] }), replies: [] }], 80, false, isDrawn)).toEqual([21])
  })

  test('a picture is as wide as the words of its commit, its rows following', () => {
    const images = [{ url: 'https://dev-null.sh/commit-images/a', width: 1600, height: 800, description: null }]

    expect(rows({ commit: commit('x', { images }), replies: [] }, 40, () => true)).toBe(5 + 9 + 1)
  })

  test('the pictures of a quoted commit stay links', () => {
    const images = [{ url: 'https://dev-null.sh/commit-images/a', width: 1600, height: 800, description: null }]

    expect(rows({ commit: commit('x', { quote: commit('one', { images }) }), replies: [] }, 80, () => true)).toBe(
      5 + 2 + 1 + 1 + 1,
    )
  })

  test('a reply takes its own rows, narrower', () => {
    expect(rows({ commit: commit('x'), replies: [reply('y', 1), reply('x'.repeat(74), 1)] }, 80)).toBe(5 + 5 + 5)
  })

  test('a link takes the columns it is drawn in, not those of its URL', () => {
    const url = `https://dev-null.sh/@mstfydmr/commits/01a149ee-996a-7064-9809-00953cff3d89 ${'x'.repeat(50)}`

    expect(rows({ commit: commit(url), replies: [] }, 80)).toBe(5)
  })

  test('a block of code takes its frame, the name of its language and its lines', () => {
    const segments = [
      { type: 'text' as const, text: 'run:' },
      { type: 'block' as const, language: 'shell', code: 'one\ntwo' },
    ]

    expect(rows({ commit: commit('', { segments }), replies: [] }, 80)).toBe(5 + 2 + 1 + 2)
    expect(
      rows({ commit: commit('', { segments: [{ type: 'block', language: null, code: 'one' }] }), replies: [] }, 80),
    ).toBe(4 + 2 + 1)
  })

  test('a quoted commit deleted or out of sight takes the frame of the line that says so, under a commit only', () => {
    const deleted = { ...commit(''), author: null, deletedAt: '2026-10-18T09:00:00Z' }

    expect(rows({ commit: commit('x', { quote: deleted }), replies: [] }, 80)).toBe(5 + 3)
    expect(rows({ commit: commit('x', { quotedId: 'q1' }), replies: [] }, 80)).toBe(5 + 3)
    expect(rows({ commit: commit('x'), replies: [{ ...commit('y', { quotedId: 'q1' }), depth: 1 }] }, 80)).toBe(5 + 5)
  })

  test('a quoted commit takes its frame, its header and its words', () => {
    expect(rows({ commit: commit('x', { quote: commit('one\ntwo') }), replies: [] }, 80)).toBe(5 + 2 + 1 + 2)

    const images = [{ url: 'https://example.com/i', width: 1, height: 1, description: null }]

    expect(rows({ commit: commit('x', { quote: commit('one', { images }) }), replies: [] }, 80)).toBe(5 + 2 + 1 + 1 + 1)
  })

  test('a long commit takes the rows of the start /dev/null shows of it', () => {
    const preview = [{ type: 'text' as const, text: 'one…' }]

    expect(rows({ commit: commit('one\ntwo\nthree\nfour', { preview }), replies: [] }, 80)).toBe(5)
  })

  test('a quoted commit takes the rows of its start, its links as written', () => {
    const long = `https://example.com/${'a'.repeat(70)}`

    expect(rows({ commit: commit('x', { quote: commit(long) }), replies: [] }, 80)).toBe(5 + 2 + 1 + 2)
    expect(
      rows(
        {
          commit: commit('x', { quote: commit('one\ntwo', { preview: [{ type: 'text', text: 'one…' }] }) }),
          replies: [],
        },
        80,
      ),
    ).toBe(5 + 2 + 1 + 1)
  })

  test('a poll takes a row and its options, and a row per option', () => {
    const poll = {
      closesAt: null,
      isClosed: false,
      hasVoted: false,
      totalVotes: null,
      options: [
        { id: 'o1', label: 'Yes', votes: null, isVoted: false },
        { id: 'o2', label: 'No', votes: null, isVoted: false },
      ],
    }

    expect(rows({ commit: commit('x', { poll }), replies: [] }, 80)).toBe(5 + 1 + 2 + 1)
  })

  test('an option with its votes takes its bar, its share and its label', () => {
    const option = (label: string) => ({ id: 'o1', label, votes: 1, isVoted: false })
    const poll = { closesAt: null, isClosed: false, hasVoted: true, totalVotes: 1, options: [] }

    expect(
      rows({ commit: commit('x', { poll: { ...poll, options: [option('x'.repeat(39))] } }), replies: [] }, 80),
    ).toBe(5 + 1 + 1 + 1)
    expect(
      rows({ commit: commit('x', { poll: { ...poll, options: [option('x'.repeat(40))] } }), replies: [] }, 80),
    ).toBe(5 + 1 + 2 + 1)
  })

  test('a list of threads takes their rows, and the box of More, or of the loader, its frame and a row', () => {
    const list = [{ commit: commit('x'), replies: [] }]

    expect(heights(list, 80, false)).toEqual([5])
    expect(heights(list, 80, true)).toEqual([5, 3])
  })

  test('a list of threads takes the rows of each commit and each reply', () => {
    const thread = { commit: commit('x'), replies: [reply('y', 1), reply('x'.repeat(74), 1)] }
    const list = [thread, { commit: commit('x'), replies: [] }]

    expect(heights(list, 80, true)).toEqual([5, 5, 5, 5, 3])
    expect(
      heights(list, 80, true)
        .slice(0, 3)
        .reduce((total, height) => total + height),
    ).toBe(rows(thread, 80))
  })

  test('a reply is narrower at each level in the list too', () => {
    expect(heights([{ commit: commit('x'), replies: [reply('x'.repeat(73), 2)] }], 80, false)).toEqual([5, 6])
  })

  test('a reply is narrower at each level, down to the fourth', () => {
    expect(rows({ commit: commit('x'), replies: [reply('x'.repeat(72), 2)] }, 80)).toBe(5 + 5)
    expect(rows({ commit: commit('x'), replies: [reply('x'.repeat(73), 2)] }, 80)).toBe(5 + 6)
    expect(rows({ commit: commit('x'), replies: [reply('x'.repeat(68), 5)] }, 80)).toBe(5 + 5)
    expect(rows({ commit: commit('x'), replies: [reply('x'.repeat(69), 5)] }, 80)).toBe(5 + 6)
  })
})
