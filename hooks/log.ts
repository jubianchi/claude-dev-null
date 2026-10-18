import type { LogEntry } from '../types'
import { parts, shownText } from './body'
import { UNVOTED_INSET, VOTED_INSET } from './poll'

export type Entry = LogEntry

/** A reply of a thread, `depth` levels under the commit the thread starts from. */
export type Reply = Entry & { depth: number }

export type Thread = { commit: Entry; replies: Reply[] }

/** How many levels replies go right, the deeper ones staying on the last. */
export const MAX_DEPTH = 3

/** The six lanes of /dev/null, in its dark theme. */
export const LANES = ['#ff8a4c', '#51cf66', '#da77f2', '#3bc9db', '#f06595', '#fcc419'] as const

/** A lane for a developer whose lane is not known, always the same. */
export function lane(username: string): string {
  let hash = 0
  for (const character of username.toLowerCase()) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  }

  return LANES[hash % LANES.length] as string
}

/** The color a developer's commits are drawn in: the lane they picked on /dev/null, or one of the lanes. */
export function laneColor(author: Pick<Entry['author'], 'username' | 'lane'>): string {
  const { username, lane: picked } = author

  if (typeof picked === 'string') {
    return picked
  }

  return typeof picked === 'number' ? (LANES[picked] ?? lane(username)) : lane(username)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * How long before `now` (in milliseconds) a commit was made, as /dev/null says it: `now`, `42m`, `5h`, `3d`, then the
 * date, with its year when not this year's.
 */
export function ago(now: number, createdAt: string): string {
  const time = Date.parse(createdAt)

  if (Number.isNaN(time)) {
    return ''
  }

  const minutes = Math.floor((now - time) / 60_000)

  if (minutes < 1) {
    return 'now'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  if (minutes < 24 * 60) {
    return `${Math.floor(minutes / 60)}h`
  }

  if (minutes < 7 * 24 * 60) {
    return `${Math.floor(minutes / (24 * 60))}d`
  }

  const date = new Date(time)
  const day = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`

  return date.getUTCFullYear() === new Date(now).getUTCFullYear() ? day : `${day}, ${date.getUTCFullYear()}`
}

/**
 * The first item a list shows once the person scrolled it `by` rows from `offset`, the items being `heights` rows
 * tall and the list `visible` rows high: a wheel tick or an arrow moves one item, a move of rows the items those rows
 * hold, and the list stops once its end shows.
 */
export function scrolled(offset: number, by: number, heights: readonly number[], visible: number): number {
  let last = heights.length
  let fitting = 0
  while (last > 0 && fitting + (heights[last - 1] ?? 0) <= visible) {
    fitting += heights[last - 1] ?? 0
    last--
  }

  const max = Math.max(0, Math.min(last, heights.length - 1))
  let first = Math.min(Math.max(offset, 0), max)
  let moved = 0

  while (by > 0 && moved < by && first < max) {
    moved += heights[first] ?? 0
    first++
  }

  while (by < 0 && moved < -by && first > 0) {
    first--
    moved += heights[first] ?? 0
  }

  return first
}

/** The columns a commit's lane and padding take, left of its words. */
const COMMIT_INSET = 4
/** The columns `∟ ` takes left of a reply, at each level. */
export const REPLY_INSET = 2
/** The columns a link card's frame and padding take. */
const CARD_INSET = 4

function lines(words: string, width: number): number {
  return words
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil([...line].length / Math.max(1, width))), 0)
}

/** The rows a commit's words take `width` columns wide: its text as drawn, and each block of code in its frame. */
function bodyRows(segments: Entry['segments'], width: number): number {
  return parts(segments).reduce(
    (total, part) =>
      total +
      (part.type === 'prose'
        ? lines(shownText(part.prose), width)
        : 2 + (part.language === null ? 0 : 1) + lines(part.code, width - CARD_INSET)),
    0,
  )
}

/** The rows a poll takes `width` columns wide: a row above it, its options, and where it is. */
function pollRows(poll: Entry['poll'], width: number): number {
  if (poll === null) {
    return 0
  }

  return (
    1 +
    poll.options.reduce(
      (total, option) =>
        total + lines(' '.repeat(option.votes === null ? UNVOTED_INSET : VOTED_INSET) + option.label, width),
      0,
    ) +
    1
  )
}

function commitRows(entry: Entry, columns: number, isOrphan: boolean): number {
  const width = columns - COMMIT_INSET
  const card = entry.linkPreview
  const cardRows =
    card === null
      ? 0
      : 2 +
        (card.site === null ? 0 : 1) +
        lines(card.title ?? card.url, width - CARD_INSET) +
        (card.description === null ? 0 : lines(card.description, width - CARD_INSET))

  const quote = entry.quote
  const quoteRows =
    quote === null
      ? 0
      : 2 +
        1 +
        bodyRows(quote.segments, width - CARD_INSET) +
        pollRows(quote.poll, width - CARD_INSET) +
        (quote.images.length > 0 ? 1 : 0)

  return (
    1 +
    (isOrphan ? 1 : 0) +
    bodyRows(entry.segments, width) +
    pollRows(entry.poll, width) +
    quoteRows +
    cardRows +
    (entry.images.length > 0 ? 1 : 0) +
    1 +
    1 +
    1
  )
}

export function level(reply: Reply): number {
  return Math.min(reply.depth, MAX_DEPTH)
}

/**
 * How many rows a thread takes in a log `columns` wide, as Thread draws it: each commit's header, lines, link card,
 * images, a row, its counts and the row its frame leaves, its replies narrower at each level, and a row below.
 */
export function rows(thread: Thread, columns: number): number {
  return (
    commitRows(thread.commit, columns, thread.commit.parentId !== null) +
    thread.replies.reduce((total, reply) => total + commitRows(reply, columns - REPLY_INSET * level(reply), false), 0) +
    1
  )
}

/** The rows of each item of a list of threads `columns` wide, and of the More button when the log goes on. */
export function heights(list: readonly Thread[], columns: number, hasMore: boolean): number[] {
  return [...list.map(thread => rows(thread, columns)), ...(hasMore ? [1] : [])]
}

const newestFirst = (a: Entry, b: Entry): number => b.createdAt.localeCompare(a.createdAt)

/**
 * Threads a commit with `replies`, each right under what it replies to, one level deeper, newest first; what `seen`
 * holds is left out, and what is threaded added to it.
 */
function threading(replies: readonly Entry[]): (commit: Entry, seen: Set<string>) => Thread {
  const children = new Map<string, Entry[]>()

  for (const found of [...replies].sort(newestFirst)) {
    if (found.parentId !== null) {
      children.set(found.parentId, [...(children.get(found.parentId) ?? []), found])
    }
  }

  return (commit, seen) => {
    const threaded: Reply[] = []
    const visit = (parent: Entry, depth: number): void => {
      for (const child of children.get(parent.id) ?? []) {
        if (!seen.has(child.id)) {
          seen.add(child.id)
          threaded.push({ ...child, depth })
          visit(child, depth + 1)
        }
      }
    }

    seen.add(commit.id)
    visit(commit, 1)

    return { commit, replies: threaded }
  }
}

/** Threads the commits of a log, in its order, each with its `replies`; a reply to none of them is left out. */
export function threadsOf(commits: readonly Entry[], replies: readonly Entry[]): Thread[] {
  const thread = threading(replies)
  const seen = new Set<string>()
  const log: Thread[] = []

  for (const commit of commits) {
    if (!seen.has(commit.id)) {
      log.push(thread(commit, seen))
    }
  }

  return log
}
