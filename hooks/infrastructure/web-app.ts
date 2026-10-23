const ORIGIN = 'https://dev-null.sh'

export type Http = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ status: number; ok: boolean; headers: Record<string, string>; text: string }>

/** A page of the web app, as Inertia serves it. */
export type Page = { component: string; props: Record<string, unknown>; url: string; version: string }

export type Visit = {
  /** Asks the `component` page for these `props` only, as an Inertia partial reload does. */
  partial?: { component: string; props: readonly string[] }
}

export type WebApp = {
  /** Reads a page, as Inertia JSON. */
  visit: (path: string, visit?: Visit) => Promise<Page>
  /** Reads a route that answers plain JSON. */
  json: (path: string) => Promise<unknown>
}

/** The version of the web app's assets, as last read: null until then. */
export type Assets = { version: string | null }

export class WebAppError extends Error {}

/** The page is for people signed in, which the web app is read without. */
export class SignInRequired extends WebAppError {
  constructor() {
    super('Sign in to /dev/null to see this.')
  }
}

function header(headers: Record<string, string>, name: string): string | undefined {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]
}

function page(text: string): Page | null {
  try {
    const found: unknown = JSON.parse(text)

    if (typeof found !== 'object' || found === null) {
      return null
    }

    const { component, props, url, version } = found as Record<string, unknown>

    return typeof component === 'string' && typeof props === 'object' && props !== null && typeof version === 'string'
      ? { component, props: props as Record<string, unknown>, url: typeof url === 'string' ? url : '', version }
      : null
  } catch {
    return null
  }
}

/**
 * Reads the pages of /dev/null's web app as its Inertia front end does, as JSON: with the version of its assets, read
 * from a page the first time and again whenever the web app answers that it changed; signed in as no one. Web apps
 * given the same `assets` share their version.
 */
export function webApp(http: Http, { assets = { version: null } }: { assets?: Assets } = {}): WebApp {
  const ask = (url: string, { partial }: Visit) =>
    http(url, {
      headers: {
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        ...(assets.version === null ? {} : { 'X-Inertia-Version': assets.version }),
        ...(partial === undefined
          ? {}
          : { 'X-Inertia-Partial-Component': partial.component, 'X-Inertia-Partial-Data': partial.props.join(',') }),
      },
    })

  const readVersion = async (url: string): Promise<string> => {
    const response = await http(url, { headers: {} })

    if (!response.ok) {
      throw new WebAppError(`HTTP ${response.status}`)
    }

    const data = /<script[^>]*\bdata-page\b[^>]*>([\s\S]*?)<\/script>/.exec(response.text)?.[1]
    const found = data === undefined ? null : page(data)

    if (found === null) {
      throw new WebAppError('/dev/null sent a page without the version of its assets.')
    }

    return found.version
  }

  /** Whether a 409 asks to load the page again with new assets, rather than to go elsewhere. */
  const isOutdated = (url: string, headers: Record<string, string>): boolean => {
    const location = new URL(header(headers, 'X-Inertia-Location') ?? url, ORIGIN)

    if (location.href === url) {
      return true
    }

    throw location.origin === ORIGIN && location.pathname === '/login'
      ? new SignInRequired()
      : new WebAppError(`/dev/null sent elsewhere: ${location.href}`)
  }

  return {
    async visit(path, visit = {}) {
      const url = urlOf(path)
      let response = await ask(url, visit)

      if (response.status === 409 && isOutdated(url, response.headers)) {
        assets.version = await readVersion(url)
        response = await ask(url, visit)

        if (response.status === 409 && isOutdated(url, response.headers)) {
          throw new WebAppError('/dev/null keeps changing the version of its assets.')
        }
      }

      if (!response.ok) {
        throw new WebAppError(`HTTP ${response.status}`)
      }

      const found = page(response.text)

      if (found === null) {
        throw new WebAppError('/dev/null sent something that is not a page.')
      }

      assets.version = found.version

      return found
    },

    async json(path) {
      const response = await http(urlOf(path), {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })

      if (!response.ok) {
        throw new WebAppError(`HTTP ${response.status}`)
      }

      try {
        return JSON.parse(response.text) as unknown
      } catch {
        throw new WebAppError('/dev/null sent something that is not JSON.')
      }
    },
  }
}

/** The URL of a path of /dev/null, refusing anything that would go elsewhere. */
function urlOf(path: string): string {
  if (!/^\/(?!\/)/.test(path)) {
    throw new WebAppError(`Not a page of /dev/null: ${path}`)
  }

  return new URL(path, ORIGIN).href
}
