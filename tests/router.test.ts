import { describe, expect, test } from 'claude-code/testing'

import type { Route } from '../hooks/router'
import { back, isSameRoute, opened, pushed, scrolledTo, shown } from '../hooks/router'

const latest: Route = { view: 'latest', params: {}, offset: 0 }
const following: Route = { view: 'following', params: {}, offset: 3 }
const thread: Route = { view: 'thread', params: { commit: 'c1' }, offset: 0 }

describe('the routes of the pane', () => {
  const all = () => true

  test('shows the route on top', () => {
    expect(shown([latest, thread], 'following', all, 'latest')).toEqual(thread)
  })

  test('shows the initial view, from its top, while no route is chosen', () => {
    expect(shown([], 'trending', all, 'latest')).toEqual({ view: 'trending', params: {}, offset: 0 })
  })

  test('shows the fallback, from its top, in place of a view that is not available', () => {
    const signedOut = (view: string) => view !== 'following'

    expect(shown([following], 'following', signedOut, 'latest')).toEqual(latest)
    expect(shown([], 'following', signedOut, 'latest')).toEqual(latest)
  })

  test('opening a view starts the routes over with it, from its top', () => {
    expect(opened('trending')).toEqual([{ view: 'trending', params: {}, offset: 0 }])
  })

  test('pushing a route keeps the one under it, where it was scrolled to', () => {
    expect(pushed([following], 'thread', { commit: 'c1' })).toEqual([following, thread])
  })

  test('going back shows the route under the one on top, where it was scrolled to', () => {
    expect(back([following, thread])).toEqual([following])
  })

  test('going back from the last route keeps it', () => {
    expect(back([following])).toEqual([following])
    expect(back([])).toEqual([])
  })

  test('scrolling moves the route on top only', () => {
    expect(scrolledTo([following, thread], thread, 5)).toEqual([following, { ...thread, offset: 5 }])
  })

  test('two routes are the same when they show the same view of the same things, wherever scrolled to', () => {
    expect(isSameRoute(thread, { ...thread, offset: 4 })).toBe(true)
    expect(isSameRoute(thread, { ...thread, params: { commit: 'c2' } })).toBe(false)
    expect(isSameRoute(thread, { ...thread, params: {} })).toBe(false)
    expect(isSameRoute(latest, following)).toBe(false)
  })

  test('scrolling a route shown in place of the routes, initial or fallback, starts them over with it', () => {
    expect(scrolledTo([], latest, 5)).toEqual([{ ...latest, offset: 5 }])
    expect(scrolledTo([following], latest, 5)).toEqual([{ ...latest, offset: 5 }])
  })
})
