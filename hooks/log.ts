import type { LogAuthor, LogEntry, LogImage } from '../types'
import type { Drawing } from './body'
import { parts, shownText } from './body'
import { shown } from './picture'
import { UNVOTED_INSET, VOTED_INSET } from './poll'

export type Entry = LogEntry

/** The replies of the commit or reply `id` left out, `count` of them, which would show `depth` levels down. */
export type More = { id: string; count: number; depth: number }

/**
 * A reply of a thread, `depth` levels under the commit the thread starts from, and the replies left out of those it
 * ends, the deepest first, whose Show more it is followed by.
 */
export type Reply = Entry & { depth: number; more?: More[] }

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

/** The color of the rails of /dev/null, in its dark theme, which a deleted commit is drawn in. */
export const RAIL = '#36363a'

/**
 * The color a developer's commits are drawn in: the lane they picked on /dev/null, or one of the lanes; that of the
 * rails for a commit deleted, which has no author.
 */
export function laneColor(author: Pick<LogAuthor, 'username' | 'lane'> | null): string {
  if (author === null) {
    return RAIL
  }

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
function bodyRows(segments: Entry['segments'], width: number, drawing: Drawing = {}): number {
  return parts(segments).reduce(
    (total, part) =>
      total +
      (part.type === 'prose'
        ? lines(shownText(part.prose, drawing), width)
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

/** Whether the picture at a URL is drawn in the log, rather than linked. */
export type IsDrawn = (url: string) => boolean

const NONE_DRAWN: IsDrawn = () => false

/** The columns a commit's words take in a log `columns` wide, right of its lane and padding. */
export function wordsWidth(columns: number): number {
  return columns - COMMIT_INSET
}

/** The rows images take `width` columns wide: each picture drawn, its box and its link; the others, a row of links. */
export function imageRows(images: readonly LogImage[], width: number, isDrawn: IsDrawn): number {
  const drawn = images.filter(image => isDrawn(image.url))

  return (
    drawn.reduce((total, image) => total + shown(image, width).rows + 1, 0) + (drawn.length < images.length ? 1 : 0)
  )
}

/** The rows the card of a link takes `width` wide: its frame, its site, its title and its description; none without a title. */
function cardRows(card: Entry['linkPreview'], width: number): number {
  return card === null || card.title === null
    ? 0
    : 2 + 1 + lines(card.title, width) + (card.description === null ? 0 : lines(card.description, width))
}

/** What /dev/null says in place of a commit quoted that was deleted. */
export const DELETED_QUOTE = '[deleted] This commit was deleted.'

/** What /dev/null says in place of a commit quoted out of sight: it comes without it. */
export const UNAVAILABLE_QUOTE = "[unavailable] This commit isn't available."

/**
 * What a commit says in place of the one it quotes, if anything: that it was deleted, or, under a commit a thread
 * starts from, that it is out of sight; replies come without the commits they quote, which a thread does not draw.
 */
export function quoteNotice(entry: Entry, isReply: boolean): string | null {
  if (entry.quote !== null) {
    return entry.quote.deletedAt === null ? null : DELETED_QUOTE
  }

  return entry.quotedId === null || isReply ? null : UNAVAILABLE_QUOTE
}

function commitRows(entry: Entry, columns: number, isOrphan: boolean, isDrawn: IsDrawn, isReply = false): number {
  const width = wordsWidth(columns)
  const quote = entry.quote
  const notice = quoteNotice(entry, isReply)
  const quoteRows =
    notice !== null
      ? 2 + lines(notice, width - CARD_INSET)
      : quote === null
        ? 0
        : 2 +
          1 +
          bodyRows(quote.preview ?? quote.segments, width - CARD_INSET, { isStatic: true }) +
          (quote.images.length > 0 ? 1 : 0) +
          pollRows(quote.poll, width - CARD_INSET) +
          cardRows(quote.linkPreview, width - CARD_INSET * 2)

  return (
    1 +
    (isOrphan ? 1 : 0) +
    bodyRows(entry.preview ?? entry.segments, width) +
    pollRows(entry.poll, width) +
    quoteRows +
    cardRows(entry.linkPreview, width - CARD_INSET) +
    imageRows(entry.images, width, isDrawn) +
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
 * images, the pictures `isDrawn` says are drawn, a row, its counts and the row its frame leaves, its replies narrower
 * at each level, and a row below.
 */
export function rows(thread: Thread, columns: number, isDrawn: IsDrawn = NONE_DRAWN): number {
  return entryRows(thread, columns, isDrawn).reduce((total, height) => total + height, 0)
}

/** The rows of a thread's commit, then of each of its replies, the row below the thread on the last of them. */
function entryRows(thread: Thread, columns: number, isDrawn: IsDrawn): number[] {
  const each = [
    commitRows(thread.commit, columns, thread.commit.parentId !== null, isDrawn),
    ...thread.replies.map(
      reply =>
        commitRows(reply, columns - REPLY_INSET * level(reply), false, isDrawn, true) + (reply.more?.length ?? 0),
    ),
  ]
  each[each.length - 1] = (each.at(-1) ?? 0) + 1

  return each
}

/**
 * The rows of each item of a list of threads `columns` wide, each commit and each reply an item of its own, and of
 * the More button when the log goes on.
 */
export function heights(
  list: readonly Thread[],
  columns: number,
  hasMore: boolean,
  isDrawn: IsDrawn = NONE_DRAWN,
): number[] {
  return [...list.flatMap(thread => entryRows(thread, columns, isDrawn)), ...(hasMore ? [MORE_ROWS] : [])]
}

/** The commits and replies of a list of threads, in the order of its items. */
export function entries(list: readonly Thread[]): Entry[] {
  return list.flatMap(thread => [thread.commit, ...thread.replies])
}

/** Where a list of threads starts: the thread, and in it the commit (`from` 0) or its reply `from - 1`. */
export type Start = { thread: number; from: number }

/** The id of the commit or reply a list of threads shows first once scrolled `offset` items down, if any. */
export function anchorAt(list: readonly Thread[], offset: number): string | undefined {
  return entries(list)[offset]?.id
}

/** How many items down a list of threads shows the commit or reply `id`, if it shows it. */
export function offsetOf(list: readonly Thread[], id: string): number | undefined {
  const index = entries(list).findIndex(found => found.id === id)

  return index === -1 ? undefined : index
}

/**
 * The ids of the commits that arrived on top of a log, from `previous` to `next`: those above the first commit of
 * `previous` that `next` still shows; none when they share none.
 */
export function arrived(previous: readonly Entry[], next: readonly Entry[]): string[] {
  const ids = next.map(found => found.id)
  const first = previous.map(found => ids.indexOf(found.id)).find(index => index !== -1)

  return first === undefined ? [] : ids.slice(0, first)
}

/** Where a list of threads starts once scrolled `offset` items down, each commit and each reply an item. */
export function located(list: readonly Thread[], offset: number): Start {
  let left = Math.max(0, offset)

  for (const [thread, { replies }] of list.entries()) {
    if (left <= replies.length) {
      return { thread, from: left }
    }
    left -= replies.length + 1
  }

  return { thread: list.length, from: 0 }
}

/** The rows the box of More, or of the loader, takes: its frame and a row. */
const MORE_ROWS = 3

const newestFirst = (a: Entry, b: Entry): number => b.createdAt.localeCompare(a.createdAt)

/**
 * Threads a commit with `replies`, each right under what it replies to or quotes, one level deeper, newest first; what `seen`
 * holds is left out, and what is threaded added to it.
 */
function threading(replies: readonly Entry[]): (commit: Entry, seen: Set<string>) => Thread {
  const children = new Map<string, Entry[]>()

  for (const found of [...replies].sort(newestFirst)) {
    for (const parent of new Set([found.parentId, found.quotedId])) {
      if (parent !== null) {
        children.set(parent, [...(children.get(parent) ?? []), found])
      }
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

/**
 * `thread` with the newest `perParent` replies of its commit and of each reply, or as many as `shown` asks for it,
 * the replies of a reply left out with it; the last reply shown under a commit or reply says how many are left.
 */
export function limited(thread: Thread, perParent: number, shown: Readonly<Record<string, number>> = {}): Thread {
  const limit = (id: string) => shown[id] ?? perParent
  const depths = new Map([[thread.commit.id, 0]])
  const counts = new Map<string, number>()
  const hidden = new Set<string>()
  const kept: { reply: Reply; ancestors: string[] }[] = []
  const path = [thread.commit.id]

  for (const reply of thread.replies) {
    path.length = reply.depth
    const parent = path.at(-1) ?? thread.commit.id
    const index = counts.get(parent) ?? 0
    counts.set(parent, index + 1)
    depths.set(reply.id, reply.depth)

    if (hidden.has(parent) || index >= limit(parent)) {
      hidden.add(reply.id)
    } else {
      kept.push({ reply: { ...reply, more: [] }, ancestors: [...path] })
    }

    path.push(reply.id)
  }

  for (const [parent, count] of [...counts].sort(([a], [b]) => (depths.get(b) ?? 0) - (depths.get(a) ?? 0))) {
    const last = kept.findLast(found => found.ancestors.includes(parent))

    if (!hidden.has(parent) && count > limit(parent) && last !== undefined) {
      last.reply.more?.push({ id: parent, count: count - limit(parent), depth: (depths.get(parent) ?? 0) + 1 })
    }
  }

  return { commit: thread.commit, replies: kept.map(found => found.reply) }
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
