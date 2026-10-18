import type { LogEntry, LogName } from '../../types'
import type { WebApp } from './web-app'
import { WebAppError } from './web-app'
import { commit } from './web-commit'

/** One page of a log: its commits in its order, the replies it shows under them, and the cursor of the next page. */
export type LogPage = { commits: LogEntry[]; replies: LogEntry[]; next: string | null }

function commits(value: unknown): LogEntry[] {
  return (Array.isArray(value) ? value : []).flatMap(item => commit(item) ?? [])
}

/** Reads a page of `log` from the web app, the first one or the one at `cursor`. */
export async function readLog(app: WebApp, log: LogName, { cursor }: { cursor?: string } = {}): Promise<LogPage> {
  const path = `/log/${log}${cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`}`
  const { props } = await app.visit(path, { partial: { component: 'log/show', props: ['commits'] } })
  const page = props.commits as Record<string, unknown> | null | undefined

  if (typeof page !== 'object' || page === null || !Array.isArray(page.data)) {
    throw new WebAppError(`/dev/null sent the ${log} log without its commits.`)
  }

  const items = page.data as unknown[]

  return {
    commits: commits(items),
    replies: items.flatMap(item => {
      const preview = (item as Record<string, unknown> | null)?.reply_preview as Record<string, unknown> | undefined

      return commits(preview?.data)
    }),
    next: typeof page.next_cursor === 'string' ? page.next_cursor : null,
  }
}
