import { describe, expect, test } from 'claude-code/testing'

import { signIn } from '../hooks/application/account'
import type { Page, WebApp } from '../hooks/infrastructure/web-app'
import { WebAppError } from '../hooks/infrastructure/web-app'

const COOKIE = 'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=value'

/** Web apps signing in `username` with COOKIE, no one with another; records the cookies they were made with. */
function apps(username: string | Error) {
  const cookies: string[] = []
  const appWith = (cookie: string): WebApp => {
    cookies.push(cookie)

    return {
      visit: async (path: string): Promise<Page> => {
        if (username instanceof Error) {
          throw username
        }

        const user = cookie === COOKIE ? { username } : null

        return { component: 'terms/show', props: { auth: { user } }, url: path, version: 'v1' }
      },
      json: async () => Promise.reject(new Error('not JSON')),
    }
  }

  return { appWith, cookies }
}

describe('signing in to /dev/null', () => {
  test('keeps the cookie pasted, once it signs someone in', async () => {
    const { appWith, cookies } = apps('jubianchi')

    expect(await signIn(appWith, `Cookie: XSRF-TOKEN=abc; ${COOKIE}`)).toEqual({
      username: 'jubianchi',
      cookie: COOKIE,
    })
    expect(cookies).toEqual([COOKIE])
  })

  test('says what to paste when it is not the remember cookie', async () => {
    const { appWith, cookies } = apps('jubianchi')

    expect(await signIn(appWith, 'devnull-session=xyz')).toEqual({
      error: 'Paste the remember_web_… cookie of dev-null.sh, as name=value.',
    })
    expect(cookies).toEqual([])
  })

  test('says when the cookie signs no one in', async () => {
    const { appWith } = apps('jubianchi')

    expect(await signIn(appWith, 'remember_web_0123abcd=ended')).toEqual({
      error: 'This cookie signs no one in to /dev/null: it ends when you sign out there.',
    })
  })

  test('says why the cookie could not be checked', async () => {
    const { appWith } = apps(new WebAppError('HTTP 500'))

    expect(await signIn(appWith, COOKIE)).toEqual({ error: 'Could not check the cookie (HTTP 500).' })
  })
})
