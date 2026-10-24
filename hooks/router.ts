/** A view of the pane, with what it shows (a commit, …), and how far it is scrolled down, in items. */
export type Route = { view: string; params: Record<string, string>; offset: number }

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

/** The routes once the one on top is scrolled to `offset`. */
export function scrolledTo(routes: readonly Route[], offset: number): Route[] {
  const last = routes.at(-1)

  return last === undefined ? [] : [...routes.slice(0, -1), { ...last, offset }]
}
