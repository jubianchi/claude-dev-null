import type { Elements, RenderElement } from 'claude-code'

import type { Refresh } from '../application/web-logs'
import type { Brand } from '../brand'
import type { Ui } from '../components/commit'
import type { Entry } from '../log'
import type { Route } from '../router'

/** The elements of the surface a view draws with. */
export type PaneUi = Ui & Pick<Elements['terminal'] | Elements['desktop'], 'Input'>

/** How the pane is drawn: the columns a view takes, inside its padding, and whether it draws pictures. */
export type Layout = { columns: number; drawsPictures: boolean }

/** The rows of each item a view lists, and the rows it draws above them (an error, …). */
export type List = { heights: number[]; aboveRows: number }

/** What the pane hands a view to draw with: its layout, where it is scrolled to, and how to reach the composer. */
export type ViewContext = Layout & {
  ui: PaneUi
  /** The colors of /dev/null in the theme of Claude Code. */
  brand: Brand
  /** The first item shown, scrolled. */
  offset: number
  heights: readonly number[]
  /** The rows the items are shown in. */
  visible: number
  now: number
  /**
   * The ids of the commits and replies that arrived while the view refreshed on its own, until it loads again from its
   * top.
   */
  arrived: readonly string[]
  /** Replies to `entry`, from the composer. */
  replyTo: (entry: Entry) => Promise<unknown>
  /** Whether the view `view` is available now. */
  isAvailable: (view: string) => boolean
  /** Shows the view `view`, showing `params`, over this one, which shows again, as it was scrolled, once back. */
  open: (view: string, params: Record<string, string>) => Promise<unknown>
}

/** The ids of the commits that arrived above what a view showed, and of the replies that arrived in it. */
export type Arrived = { commits: string[]; replies: string[] }

export const NOTHING_ARRIVED: Arrived = { commits: [], replies: [] }

/**
 * A view of the pane, made for the engine it reads and draws with: a tab, opened alone; a button of the toolbar,
 * opened over the view shown, and closed by a second press; or a view another opens over itself, which shows back in
 * place of the tabs. It reads the state, and draws it with the components. One without `refresh` is not refreshed,
 * nor one without `list` scrolled.
 */
export type View = {
  id: string
  label: string
  placement: 'tab' | 'toolbar' | 'detail'
  isAvailable: () => Promise<boolean>
  /** Loads it again, from its top or keeping what it showed (`how`); what arrived, when it tells it. */
  refresh?: (route: Route, how: Refresh) => Promise<Arrived>
  /** The ids of the commits and replies it lists, in their order, one an item. */
  items?: (route: Route) => Promise<string[]>
  list?: (route: Route, layout: Layout) => Promise<List>
  render: (route: Route, context: ViewContext) => Promise<RenderElement>
}
