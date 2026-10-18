import type { EngineInterface } from 'claude-code'

import type { Assets, WebApp } from '../infrastructure/web-app'
import { webApp } from '../infrastructure/web-app'

/** The version of the web app's assets, shared by every request; a reload of the module reads it again. */
const assets: Assets = { version: null }

/** The web app, through the host's network, signed in with `cookie` when given. */
export function webAppOf($: EngineInterface, cookie?: string): WebApp {
  return webApp((url, init) => $.http.fetch(url, init), cookie === undefined ? { assets } : { cookie, assets })
}
