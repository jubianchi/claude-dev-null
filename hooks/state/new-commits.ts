import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

const newCommits = atom({ plugin: 'dev-null', key: 'newCommits' } as const, {})

const arrivedEntries = atom({ plugin: 'dev-null', key: 'arrived' } as const, {})

/** The ids of the commits that arrived above the view `view` while it refreshed on its own, not seen yet. */
export async function newCommitsOf($: EngineInterface, view: string): Promise<string[]> {
  return (await read($, newCommits))[view] ?? []
}

/** Adds `ids`, the commits that arrived above the view `view`, on top of those not seen yet. */
export async function addNewCommits($: EngineInterface, view: string, ids: readonly string[]): Promise<void> {
  if (ids.length > 0) {
    await update($, newCommits, found => added(found, view, ids))
  }
}

/** Forgets the commits that arrived above the view `view`, seen once it shows its top. */
export async function forgetNewCommits($: EngineInterface, view: string): Promise<void> {
  await update($, newCommits, found => without(found, view))
}

/**
 * The ids of the commits and replies that arrived in the view `view` while it refreshed on its own, seen or not, until
 * it loads again from its top.
 */
export async function arrivedOf($: EngineInterface, view: string): Promise<string[]> {
  return (await read($, arrivedEntries))[view] ?? []
}

/** Adds `ids`, the commits and replies that arrived in the view `view`, to those that arrived before. */
export async function addArrived($: EngineInterface, view: string, ids: readonly string[]): Promise<void> {
  if (ids.length > 0) {
    await update($, arrivedEntries, found => added(found, view, ids))
  }
}

/** Forgets the commits and replies that arrived in the view `view`, loaded again from its top. */
export async function forgetArrived($: EngineInterface, view: string): Promise<void> {
  await update($, arrivedEntries, found => without(found, view))
}

function added(found: Record<string, string[]>, view: string, ids: readonly string[]): Record<string, string[]> {
  return { ...found, [view]: [...new Set([...ids, ...(found[view] ?? [])])] }
}

function without(found: Record<string, string[]>, view: string): Record<string, string[]> {
  const { [view]: _, ...others } = found

  return others
}
