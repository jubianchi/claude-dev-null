import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

const newCommits = atom({ plugin: 'dev-null', key: 'newCommits' } as const, {})

const arrivedEntries = atom({ plugin: 'dev-null', key: 'arrived' } as const, {})

/** How long a commit or reply that arrived keeps showing as such, once it first showed. */
export const ARRIVED_FOR = 60_000

/** The ids of the commits that arrived above the view `view` while it refreshed on its own, not seen yet. */
export async function newCommitsOf($: EngineInterface, view: string): Promise<string[]> {
  return (await read($, newCommits))[view] ?? []
}

/** Adds `ids`, the commits that arrived above the view `view`, on top of those not seen yet. */
export async function addNewCommits($: EngineInterface, view: string, ids: readonly string[]): Promise<void> {
  if (ids.length > 0) {
    await update($, newCommits, found => ({ ...found, [view]: [...new Set([...ids, ...(found[view] ?? [])])] }))
  }
}

/** Forgets the commits that arrived above the view `view`, seen once it shows its top. */
export async function forgetNewCommits($: EngineInterface, view: string): Promise<void> {
  await update($, newCommits, found => without(found, view))
}

/**
 * The ids of the commits and replies that arrived in the view `view` while it refreshed on its own, at `now`: those
 * not shown yet, and those that first showed less than ARRIVED_FOR ago.
 */
export async function arrivedOf($: EngineInterface, view: string, now: number): Promise<string[]> {
  return Object.entries((await read($, arrivedEntries))[view] ?? {})
    .filter(([, shownAt]) => !hasFaded(shownAt, now))
    .map(([id]) => id)
}

/** Adds `ids`, the commits and replies that arrived in the view `view`, not shown yet, to those that arrived before. */
export async function addArrived($: EngineInterface, view: string, ids: readonly string[]): Promise<void> {
  if (ids.length > 0) {
    await update($, arrivedEntries, found => ({
      ...found,
      [view]: { ...Object.fromEntries(ids.map(id => [id, null])), ...found[view] },
    }))
  }
}

/**
 * Notes that `ids`, which the view `view` shows, showed at `now`, those that arrived and had not shown yet, and forgets
 * those that showed ARRIVED_FOR ago.
 */
export async function showArrived(
  $: EngineInterface,
  view: string,
  ids: readonly string[],
  now: number,
): Promise<void> {
  const arrived = (await read($, arrivedEntries))[view]

  if (arrived === undefined) {
    return
  }

  const kept = Object.entries(arrived)
    .filter(([, shownAt]) => !hasFaded(shownAt, now))
    .map(([id, shownAt]) => [id, shownAt === null && ids.includes(id) ? now : shownAt] as const)

  if (kept.length !== Object.keys(arrived).length || kept.some(([id, shownAt]) => arrived[id] !== shownAt)) {
    await update($, arrivedEntries, found => ({ ...found, [view]: Object.fromEntries(kept) }))
  }
}

/** Forgets the commits and replies that arrived in the view `view`, loaded again from its top. */
export async function forgetArrived($: EngineInterface, view: string): Promise<void> {
  await update($, arrivedEntries, found => without(found, view))
}

function hasFaded(shownAt: number | null, now: number): boolean {
  return shownAt !== null && now - shownAt >= ARRIVED_FOR
}

function without<T>(found: Record<string, T>, view: string): Record<string, T> {
  const { [view]: _, ...others } = found

  return others
}
