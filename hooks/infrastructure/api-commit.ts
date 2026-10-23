import type { LogEntry } from '../../types'
import { commit } from './web-commit'

type Raw = Record<string, unknown>

function record(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : null
}

/** A commit of the API as the web app's pages serve it, which name its author `user`; the commit it quotes as well. */
function asWeb(value: unknown): unknown {
  const raw = record(value)

  return raw === null ? value : { ...raw, user: raw.author, quoted_commit: asWeb(raw.quoted_commit) }
}

/** Reads a commit as the API serves it to a signed request, a deleted one as its tombstone, or null when it is not one. */
export function apiCommit(value: unknown): LogEntry | null {
  return commit(asWeb(value))
}
