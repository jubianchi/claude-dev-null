import type { EngineInterface } from 'claude-code'

import type { Migrations } from '../versioned'
import { seal, unseal } from '../versioned'

/** How a value of the store is kept: its key, its version, the migrations to it and what it must be once read. */
export type Kept<T> = {
  key: string
  version: number
  migrations: Migrations
  read: (value: unknown) => T | undefined
}

/** The value `kept` holds in the store; undefined when it holds none, or one it cannot read, which it then forgets. */
export async function readKept<T>($: EngineInterface, kept: Kept<T>): Promise<T | undefined> {
  const stored = await $.store.get(kept.key)

  if (stored === undefined) {
    return undefined
  }

  const value = kept.read(unseal(stored, kept.version, kept.migrations))

  if (value === undefined) {
    await $.store.delete(kept.key)
  }

  return value
}

/**
 * Keeps `value` in the store, at the version of `kept`; a store that cannot hold it any more forgets what it held
 * there, which would no longer be what the state shows.
 */
export async function writeKept<T>($: EngineInterface, kept: Kept<T>, value: T): Promise<void> {
  try {
    await $.store.set(kept.key, seal(kept.version, value))
  } catch {
    await $.store.delete(kept.key)
  }
}
