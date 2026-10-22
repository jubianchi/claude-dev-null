import type { LogEntry, LogImage, LogLane, LogLinkPreview, LogPoll, LogSegment } from '../../types'
import { shortHash } from '../hash'

const ORIGIN = 'https://dev-null.sh'

/** How many lanes /dev/null offers to pick from. */
const LANES = 6

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function count(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function lane(value: unknown): LogLane | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < LANES ? value : null
  }

  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null
}

function linkPreview(value: unknown): LogLinkPreview | null {
  const preview = record(value)
  const url = text(preview?.url)

  return preview === null || url === null || preview.is_pending === true
    ? null
    : { url, title: text(preview.title), description: text(preview.description), site: text(preview.site_name) }
}

function votes(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function poll(value: unknown): LogPoll | null {
  const found = record(value)

  if (found === null || !Array.isArray(found.options)) {
    return null
  }

  return {
    closesAt: text(found.closes_at),
    isClosed: found.is_closed === true,
    hasVoted: found.has_voted === true,
    totalVotes: votes(found.total_votes),
    options: found.options.flatMap(item => {
      const option = record(item)
      const label = text(option?.label)

      return option === null || label === null
        ? []
        : [{ label, votes: votes(option.votes_count), isVoted: option.voted === true }]
    }),
  }
}

function images(value: unknown): LogImage[] {
  return (Array.isArray(value) ? value : []).flatMap(item => {
    const image = record(item)
    const url = text(image?.url)

    return image === null || url === null
      ? []
      : [{ url, width: count(image.width), height: count(image.height), description: text(image.description) }]
  })
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** The code a block of code shows, out of the HTML /dev/null highlights it in. */
function code(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#')) {
      const point = name[1]?.toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))

      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
    }

    return ENTITIES[name.toLowerCase()] ?? entity
  })
}

function segment(value: unknown): LogSegment[] {
  const found = record(value)

  if (found?.type === 'text' && typeof found.text === 'string') {
    return [{ type: 'text', text: found.text }]
  }

  if (found?.type === 'code' && typeof found.code === 'string') {
    return [{ type: 'code', code: found.code }]
  }

  if (found?.type === 'block' && typeof found.html === 'string') {
    return [{ type: 'block', language: text(found.language), code: code(found.html) }]
  }

  return []
}

function segments(raw: Raw, body: string): LogSegment[] {
  if (Array.isArray(raw.body_segments)) {
    return raw.body_segments.flatMap(segment)
  }

  return body === '' ? [] : [{ type: 'text', text: body }]
}

/** Reads a commit as the web app's pages serve it, or null when it is not one. */
export function commit(value: unknown): LogEntry | null {
  const found = entry(value)
  const quoted = entry(record(value)?.quoted_commit)

  return found === null
    ? null
    : {
        ...found,
        quote: quoted === null ? null : { ...quoted, quote: null },
        quotedId: found.quotedId ?? quoted?.id ?? null,
      }
}

/** A deleted commit, as /dev/null keeps it in its thread while it has replies: its id, parent and replies only. */
function tombstone(raw: Raw, id: string, deletedAt: string): LogEntry {
  return {
    id,
    shortHash: shortHash(id),
    body: '',
    parentId: text(raw.parent_id),
    url: '',
    createdAt: '',
    stars: 0,
    replies: count(raw.replies_count),
    author: null,
    deletedAt,
    linkPreview: null,
    images: [],
    segments: [],
    quote: null,
    quotedId: null,
    continuationId: null,
    poll: null,
  }
}

function entry(value: unknown): LogEntry | null {
  const raw = record(value)
  const deletedAt = text(raw?.deleted_at)

  if (raw !== null && typeof raw.id === 'string' && deletedAt !== null) {
    return tombstone(raw, raw.id, deletedAt)
  }

  const user = record(raw?.user)
  const id = text(raw?.id)
  const username = text(user?.username)

  if (raw === null || user === null || id === null || username === null) {
    return null
  }

  const body = text(raw.body) ?? ''

  return {
    id,
    shortHash: shortHash(id),
    body,
    parentId: text(raw.parent_id),
    url: `${ORIGIN}/@${encodeURIComponent(username)}/commits/${encodeURIComponent(id)}`,
    createdAt: text(raw.created_at) ?? '',
    stars: count(raw.stars_count),
    replies: count(raw.replies_count),
    author: { username, name: text(user.name) ?? username, lane: lane(user.lane) },
    deletedAt: null,
    linkPreview: linkPreview(raw.link_preview),
    images: images(raw.images),
    segments: segments(raw, body),
    quote: null,
    quotedId: text(raw.quoted_commit_id),
    continuationId: text(raw.continuation_id),
    poll: poll(raw.poll),
  }
}
