import type { LogSegment } from '../types'
import { emojify } from './emoji'
import { shortHash } from './hash'
import { profileUrl } from './profile'

/**
 * A part of a commit's text, as /dev/null draws it: plain text, a link, a link to a commit (drawn as its author and
 * short hash), a mention of someone, or /dev/null itself (drawn as its wordmark).
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'link' | 'commit' | 'mention'; text: string; href: string }
  | { type: 'wordmark'; text: string }

// The rules of resources/js/components/linkified-text.tsx and resources/js/lib/urls.ts, on /dev/null.

/** The top-level domains a bare domain may end with: an allowlist, since most file extensions are also TLDs. */
const TOP_LEVEL_DOMAINS = [
  'com org net edu gov mil info biz io dev app co ai me xyz tech gg tv fm ly to is blog cloud site online design',
  'studio tools software codes wiki news website club ninja rocks academy guide social digital agency fyi lol live',
  'uk de fr nl es it pt br ca au jp ch se no dk fi be at ie nz us eu cz sk hu ro bg gr hr si ee lv lt ru ua tr il za',
  'mx ar kr cn tw hk sg vn th',
]
  .join(' ')
  .split(' ')

const URL_PATTERN = new RegExp(
  String.raw`\b[Hh][Tt][Tt][Pp][Ss]?:\/\/[^\s<>]+` +
    String.raw`|(?<![\p{L}\p{N}_.\/@-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+` +
    `(?:${[...TOP_LEVEL_DOMAINS, ...TOP_LEVEL_DOMAINS.map(domain => domain.toUpperCase())].join('|')})` +
    String.raw`(?![\p{L}\p{N}_(-]|\.[A-Za-z0-9])(?:[\/?#][^\s<>]*)?`,
  'gu',
)

const MENTION_PATTERN =
  /(?<![\p{L}\p{N}_./@-])@([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})(?![A-Za-z0-9_@/-]|\.[A-Za-z0-9])/gu

const COMMIT_LINK_PATTERN =
  /^https?:\/\/(?:www\.)?dev-null\.sh\/@([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/commits\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

const WORDMARK_PATTERN = /(?<![\p{L}\p{M}\p{N}_./-])(\/dev\/null)(?![\p{L}\p{M}\p{N}_/-])/gu

const MAX_URL_LENGTH = 2048
const MAX_SHORTENED_PATH = 20

function count(text: string, character: string): number {
  return text.split(character).length - 1
}

function withoutTrailingPunctuation(candidate: string): string {
  let url = candidate
  let previous: string

  do {
    previous = url
    url = url.replace(/[.,;:!?'"]+$/u, '')

    for (const [open, close] of [
      ['(', ')'],
      ['[', ']'],
    ] as const) {
      if (url.endsWith(close) && count(url, open) < count(url, close)) {
        url = url.slice(0, -1)
      }
    }
  } while (url !== previous)

  return url
}

function hrefFor(text: string): string | null {
  const href = /^https?:\/\//i.test(text) ? text : `https://${text}`

  return href.endsWith('://') || [...href].length > MAX_URL_LENGTH ? null : href
}

/** A link as /dev/null shows it: without its scheme or www, its whole host, and 20 characters of its path at most. */
export function shortenUrl(url: string): string {
  const hidden = /^(?:https?:\/\/)?(?:www\.(?=[^/?#]*\.))?/i.exec(url)?.[0] ?? ''
  const rest = url.slice(hidden.length)
  const host = rest.replace(/[/?#][\s\S]*$/u, '')
  const path = [...rest.slice(host.length)]

  if (path.length <= MAX_SHORTENED_PATH) {
    return rest
  }

  return `${host}${path
    .slice(0, MAX_SHORTENED_PATH - 1)
    .join('')
    .replace(/%[0-9A-Fa-f]?$/, '')}…`
}

/** What a match draws as, and how many characters of the text it takes; null when it draws as nothing. */
type Found = { part: Inline; length: number } | null

/** Splits `text` at each match of `pattern`, the matches drawn by `found`, the text between them by `between`. */
function split(
  text: string,
  pattern: RegExp,
  found: (match: RegExpMatchArray) => Found,
  between: (text: string) => Inline[],
): Inline[] {
  const parts: Inline[] = []
  let position = 0

  for (const match of text.matchAll(pattern)) {
    const drawn = found(match)
    const index = match.index ?? 0

    if (drawn !== null && index >= position) {
      parts.push(...between(text.slice(position, index)), drawn.part)
      position = index + drawn.length
    }
  }

  return [...parts, ...between(text.slice(position))]
}

function plain(text: string): Inline[] {
  return text === '' ? [] : [{ type: 'text', text }]
}

function wordmarks(text: string): Inline[] {
  return split(
    text,
    WORDMARK_PATTERN,
    match => ({ part: { type: 'wordmark', text: match[0] }, length: match[0].length }),
    plain,
  )
}

function mentions(text: string): Inline[] {
  return split(
    text,
    MENTION_PATTERN,
    match => ({
      part: { type: 'mention', text: match[0], href: profileUrl(match[1] ?? '') },
      length: match[0].length,
    }),
    wordmarks,
  )
}

function link(match: RegExpMatchArray): Found {
  const text = withoutTrailingPunctuation(match[0])
  const href = hrefFor(text)

  if (href === null) {
    return null
  }

  const commit = COMMIT_LINK_PATTERN.exec(text)

  return {
    part:
      commit === null
        ? { type: 'link', text: shortenUrl(text), href }
        : { type: 'commit', text: `${commit[1]}/${shortHash(commit[2] ?? '')}`, href: text },
    length: text.length,
  }
}

/** Merges the plain texts next to each other. */
function merged(parts: readonly Inline[]): Inline[] {
  const result: Inline[] = []

  for (const part of parts) {
    const last = result.at(-1)

    if (part.type === 'text' && last?.type === 'text') {
      result[result.length - 1] = { type: 'text', text: last.text + part.text }
    } else {
      result.push(part)
    }
  }

  return result
}

/** The parts of a commit's text, as /dev/null draws them. */
export function inline(text: string): Inline[] {
  return merged(split(text, URL_PATTERN, link, mentions))
}

/** The words of a commit drawn as text: its text and its code, without its blocks of code. */
export type Prose = Exclude<LogSegment, { type: 'block' }>

/** A part of a commit's words, drawn on its own from the segment at `index`: text and code together, or a block. */
export type Part = { index: number } & (
  | { type: 'prose'; prose: Prose[] }
  | { type: 'block'; language: string | null; code: string }
)

/** The text and code next to each other, together, and each block of code on its own. */
export function parts(segments: readonly LogSegment[]): Part[] {
  const found: Part[] = []

  segments.forEach((segment, index) => {
    const last = found.at(-1)

    if (segment.type === 'block') {
      found.push({ index, type: 'block', language: segment.language, code: segment.code })
    } else if (last?.type === 'prose') {
      last.prose.push(segment)
    } else {
      found.push({ index, type: 'prose', prose: [segment] })
    }
  })

  return found
}

/** A part of a commit's text and code, as drawn: one of the parts of its text, or its code. */
export type Drawn = Inline | { type: 'code'; text: string }

/** `prose` without the lines it starts or ends with, which a block of code next to it stands for. */
function trimmed(prose: readonly Prose[]): Prose[] {
  return prose.map((found, index) => {
    if (found.type === 'code') {
      return found
    }

    const isFirst = index === 0
    const isLast = index === prose.length - 1
    const start = isFirst ? found.text.replace(/^\n+/, '') : found.text

    return { type: 'text', text: isLast ? start.replace(/\n+$/, '') : start }
  })
}

/**
 * The parts of a commit's text and code, as /dev/null draws them: its shortcodes drawn as emoji first, as it does,
 * outside of its code, and the rest as the author wrote it.
 */
export function drawn(prose: readonly Prose[]): Drawn[] {
  return trimmed(prose).flatMap((found): Drawn[] =>
    found.type === 'code' ? [{ type: 'code', text: found.code }] : inline(emojify(found.text)),
  )
}

/** What a commit's text and code show, its links as they are drawn: to measure the rows they take. */
export function shownText(prose: readonly Prose[]): string {
  return drawn(prose)
    .map(shown => shown.text)
    .join('')
}
