import { rememberCookie, signedInAs } from '../infrastructure/web-account'
import type { WebApp } from '../infrastructure/web-app'

export type SignedIn = { username: string; cookie: string }

/**
 * Signs in with the remember cookie in what the person pasted, once the web app, made with it by `appWith`, says who
 * it signs in; or says why it cannot.
 */
export async function signIn(
  appWith: (cookie: string) => WebApp,
  pasted: string,
): Promise<SignedIn | { error: string }> {
  const cookie = rememberCookie(pasted)

  if (cookie === null) {
    return { error: 'Paste the remember_web_… cookie of dev-null.sh, as name=value.' }
  }

  try {
    const username = await signedInAs(appWith(cookie))

    return username === null
      ? { error: 'This cookie signs no one in to /dev/null: it ends when you sign out there.' }
      : { username, cookie }
  } catch (error) {
    return { error: `Could not check the cookie (${error instanceof Error ? error.message : String(error)}).` }
  }
}
