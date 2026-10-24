import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { Route } from '../router'
import { back, opened, pushed, scrolledTo } from '../router'
import type { Kept } from './stored'
import { readKept, writeKept } from './stored'

const routes = atom({ plugin: 'dev-null', key: 'routes' } as const, [])

/** The view opened last, of `views`, kept in the store for a /clear, which starts the state over, to show it still. */
function keptView(views: readonly string[]): Kept<string> {
  return {
    key: 'logTab',
    version: 1,
    migrations: {},
    read: value => (typeof value === 'string' && views.includes(value) ? value : undefined),
  }
}

/** The routes of the pane, the one shown on top; none until a view is chosen. */
export async function readRoutes($: EngineInterface): Promise<Route[]> {
  return read($, routes)
}

/** The view the store kept, if it is one of `views`. */
export async function readKeptView($: EngineInterface, views: readonly string[]): Promise<string | undefined> {
  return readKept($, keptView(views))
}

/** Opens `view`, one of `views`, alone, from its top, and keeps it in the store. */
export async function openView($: EngineInterface, view: string, views: readonly string[]): Promise<void> {
  await update($, routes, () => opened(view))
  await writeKept($, keptView(views), view)
}

/** Shows `view` over `shown`, the route the pane shows, which shows again, as it was scrolled, once back. */
export async function pushView(
  $: EngineInterface,
  shown: Route,
  view: string,
  params: Record<string, string> = {},
): Promise<void> {
  await update($, routes, found => pushed(found, shown, view, params))
}

/** Shows the route under the one shown again. */
export async function goBack($: EngineInterface): Promise<void> {
  await update($, routes, back)
}

/** Scrolls `shown`, the route the pane shows, to `offset`. */
export async function scrollRoute($: EngineInterface, shown: Route, offset: number): Promise<void> {
  await update($, routes, found => scrolledTo(found, shown, offset))
}
