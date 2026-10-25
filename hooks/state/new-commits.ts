import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

const newCommits = atom({ plugin: 'dev-null', key: 'newCommits' } as const, {})

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
  await update($, newCommits, found => {
    const { [view]: _, ...others } = found

    return others
  })
}
