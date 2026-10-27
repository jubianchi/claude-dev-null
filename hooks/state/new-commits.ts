import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

const newCommits = atom({ plugin: 'dev-null', key: 'newCommits' } as const, {})

const arrivedCommits = atom({ plugin: 'dev-null', key: 'arrivedCommits' } as const, {})

/** The ids of the commits that arrived above the view `view` while it refreshed on its own, not seen yet. */
export async function newCommitsOf($: EngineInterface, view: string): Promise<string[]> {
  return (await read($, newCommits))[view] ?? []
}

/**
 * The ids of the commits that arrived in the view `view` while it refreshed on its own, seen or not, until it loads
 * again from its top.
 */
export async function arrivedCommitsOf($: EngineInterface, view: string): Promise<string[]> {
  return (await read($, arrivedCommits))[view] ?? []
}

/** Adds `ids`, the commits that arrived above the view `view`, on top of those not seen yet, and of those arrived. */
export async function addNewCommits($: EngineInterface, view: string, ids: readonly string[]): Promise<void> {
  if (ids.length > 0) {
    const added = (found: Record<string, string[]>) => ({
      ...found,
      [view]: [...new Set([...ids, ...(found[view] ?? [])])],
    })
    await update($, newCommits, added)
    await update($, arrivedCommits, added)
  }
}

/** Forgets the commits that arrived above the view `view`, seen once it shows its top. */
export async function forgetNewCommits($: EngineInterface, view: string): Promise<void> {
  await update($, newCommits, found => without(found, view))
}

/** Forgets the commits that arrived in the view `view`, loaded again from its top. */
export async function forgetArrivedCommits($: EngineInterface, view: string): Promise<void> {
  await update($, arrivedCommits, found => without(found, view))
}

function without(found: Record<string, string[]>, view: string): Record<string, string[]> {
  const { [view]: _, ...others } = found

  return others
}
