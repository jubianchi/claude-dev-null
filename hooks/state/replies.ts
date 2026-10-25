import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { Kept } from './stored'
import { readKept, writeKept } from './stored'

/** How many replies /dev/null offers to show under a commit and each reply, before Show more. */
export const REPLIES_PER_PAGE = [1, 3, 5, 10, 15, 20, 25] as const

/** How many /dev/null shows by default. */
const DEFAULT = 3

const repliesPerPage = atom({ plugin: 'dev-null', key: 'repliesPerPage' } as const, 0)
const shownReplies = atom({ plugin: 'dev-null', key: 'shownReplies' } as const, {})

/** How many replies show under a commit and each reply, kept in the store for the next sessions. */
const kept: Kept<number> = {
  key: 'repliesPerPage',
  version: 1,
  migrations: {},
  read: value => (REPLIES_PER_PAGE.some(count => count === value) ? (value as number) : undefined),
}

/** How many replies show under a commit and each reply, before Show more. */
export async function perPage($: EngineInterface): Promise<number> {
  const count = await read($, repliesPerPage)

  return count === 0 ? ((await readKept($, kept)) ?? DEFAULT) : count
}

/** Shows `count` replies under a commit and each reply, for the next sessions too. */
export async function setPerPage($: EngineInterface, count: number): Promise<void> {
  await writeKept($, kept, count)
  await update($, repliesPerPage, () => count)
  await update($, shownReplies, () => ({}))
}

/** How many replies show under the commits and replies whose Show more was pressed, by their id. */
export async function shownRepliesOf($: EngineInterface): Promise<Record<string, number>> {
  return read($, shownReplies)
}

/** Shows as many more replies of the commit or reply `id` as show under each. */
export async function showMoreReplies($: EngineInterface, id: string): Promise<void> {
  const more = await perPage($)
  await update($, shownReplies, shown => ({ ...shown, [id]: (shown[id] ?? more) + more }))
}
