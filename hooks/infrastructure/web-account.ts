import type { WebApp } from './web-app'

/** The cookie the web app signs people in again with, named after its guard and a hash. */
const REMEMBER = /^remember_web_[0-9a-f]+$/

/** What a cookie value may hold, by RFC 6265: no space, quote, comma, semicolon or backslash. */
const VALUE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/

/**
 * The remember cookie in what the person pasted, as `name=value`: the cookie alone, or out of a whole `Cookie`
 * header, the other cookies left out; null when there is none.
 */
export function rememberCookie(pasted: string): string | null {
  const cookies = pasted.trim().replace(/^cookie:/i, '')

  for (const cookie of cookies.split(';')) {
    const at = cookie.indexOf('=')
    const name = cookie.slice(0, Math.max(at, 0)).trim()
    const value = cookie.slice(at + 1).trim()

    if (at > 0 && REMEMBER.test(name)) {
      return VALUE.test(value) ? `${name}=${value}` : null
    }
  }

  return null
}

/**
 * The username of the person the web app signs in, null when no one is: read from a page that changes nothing for
 * them, as the log pages would change the log the web app opens on.
 */
export async function signedInAs(app: WebApp): Promise<string | null> {
  const { props } = await app.visit('/terms')
  const auth = props.auth as { user?: { username?: unknown } | null } | null | undefined
  const username = auth?.user?.username

  return typeof username === 'string' ? username : null
}
