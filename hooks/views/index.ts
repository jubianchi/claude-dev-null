import type { EngineInterface } from 'claude-code'

import type { Route } from '../router'
import { shown } from '../router'
import { deviceSignedInAs } from '../state/device'
import { readKeptView, readRoutes } from '../state/router'
import { settingsView } from './settings'
import { threadView } from './thread'
import type { View } from './view'
import { webLogView } from './web-log'

async function isSignedIn($: EngineInterface): Promise<boolean> {
  return (await deviceSignedInAs($)) !== ''
}

/** The views of the pane, its tabs and the buttons of its toolbar in their order, made for `$`. */
export function viewsOf($: EngineInterface): View[] {
  return [
    webLogView($, 'following', 'Following', () => isSignedIn($)),
    webLogView($, 'latest', 'Latest'),
    webLogView($, 'trending', 'Trending'),
    webLogView($, 'starred', 'Starred', () => isSignedIn($)),
    settingsView($),
    threadView($, () => isSignedIn($)),
  ]
}

/** The view the pane opens on, unless the store kept another, and the one shown in place of one not available. */
const INITIAL = 'following'
const FALLBACK = 'latest'

/** The ids of the views a tab opens, which the store keeps. */
export function tabsOf(views: readonly View[]): string[] {
  return views.filter(view => view.placement === 'tab').map(view => view.id)
}

/** The view of `id`, of `views`; the fallback for one there is none of. */
export function viewOf(views: readonly View[], id: string): View {
  return views.find(view => view.id === id) ?? viewOf(views, FALLBACK)
}

/** The view of `id`, made for `$`; the fallback for one there is none of. */
export function viewFor($: EngineInterface, id: string): View {
  return viewOf(viewsOf($), id)
}

/** Those of `views` available now, in their order. */
export async function availableOf(views: readonly View[]): Promise<View[]> {
  const available: View[] = []

  for (const view of views) {
    if (await view.isAvailable()) {
      available.push(view)
    }
  }

  return available
}

/** The route the pane shows: the one chosen last, or the view the store kept, or else Following; Latest in their place. */
export async function shownRoute($: EngineInterface): Promise<Route> {
  const views = viewsOf($)
  const available = (await availableOf(views)).map(view => view.id)
  const routes = await readRoutes($)
  const initial = routes.length === 0 ? ((await readKeptView($, tabsOf(views))) ?? INITIAL) : INITIAL

  return shown(routes, initial, view => available.includes(view), FALLBACK)
}
