import type { Route } from '../types'

export type { Route }

function top(view: string, params: Record<string, string> = {}): Route {
  return { view, params, offset: 0 }
}

/**
 * The route the pane shows: the one on top of `routes`, or `initial` while none is chosen; `fallback`, from its top,
 * in place of a view that is not available.
 */
export function shown(
  routes: readonly Route[],
  initial: string,
  isAvailable: (view: string) => boolean,
  fallback: string,
): Route {
  const route = routes.at(-1) ?? top(initial)

  return isAvailable(route.view) ? route : top(fallback)
}

/** The routes once `view` is opened: it alone, from its top. */
export function opened(view: string): Route[] {
  return [top(view)]
}

/** The routes once `view` is pushed over the one shown, which is shown again, as it was scrolled, once back. */
export function pushed(routes: readonly Route[], view: string, params: Record<string, string> = {}): Route[] {
  return [...routes, top(view, params)]
}

/** The routes once back from the one on top: the one under it, if any. */
export function back(routes: readonly Route[]): Route[] {
  return routes.length > 1 ? routes.slice(0, -1) : [...routes]
}

/**
 * The routes once `shown` is scrolled to `offset`: the one on top, when it is `shown`; else `shown` alone, which the
 * pane showed in place of the routes, initial or fallback.
 */
export function scrolledTo(routes: readonly Route[], shown: Route, offset: number): Route[] {
  const last = routes.at(-1)

  return last !== undefined && isSameRoute(last, shown)
    ? [...routes.slice(0, -1), { ...last, offset }]
    : [{ ...shown, offset }]
}

/** Whether `one` and `other` show the same view of the same things, wherever they are scrolled to. */
export function isSameRoute(one: Route, other: Route): boolean {
  const keys = Object.keys(one.params)

  return (
    one.view === other.view &&
    keys.length === Object.keys(other.params).length &&
    keys.every(key => one.params[key] === other.params[key])
  )
}
