import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import { vote } from '../application/poll-vote'
import { approvedApi } from './device'
import { replaceInThread } from './thread'
import { replaceEntry } from './web-logs'

const pollChoices = atom({ plugin: 'dev-null', key: 'pollChoices' } as const, {})
const votingPoll = atom({ plugin: 'dev-null', key: 'votingPoll' } as const, '')

const TOAST = { timeoutMs: 10_000 }

/** The option chosen in the poll of each commit, by the id of the commit. */
export async function pollChoicesOf($: EngineInterface): Promise<Record<string, string>> {
  return read($, pollChoices)
}

/** The commit whose poll is being voted in, '' while none is. */
export async function pollVoting($: EngineInterface): Promise<string> {
  return read($, votingPoll)
}

/** Chooses the option `optionId` in the poll of the commit `commitId`, which Vote then votes for. */
export async function choose($: EngineInterface, commitId: string, optionId: string): Promise<void> {
  await update($, pollChoices, choices => ({ ...choices, [commitId]: optionId }))
}

/**
 * Whether a vote is being cast: kept in the module, not in the state, which a dispatch reads at the one moment it
 * started: a second press, quick enough, would not see the first, and would vote again.
 */
let voting = false

/**
 * Votes for the option chosen in the poll of the commit `commitId`, as the device approved, once at a time: the commit
 * then shows as /dev/null shows it since, or a toast says why it refused, the option still chosen.
 */
export async function castVote($: EngineInterface, commitId: string): Promise<void> {
  const optionId = (await read($, pollChoices))[commitId]
  const api = await approvedApi($)

  if (voting || optionId === undefined || api === undefined) {
    return
  }

  voting = true
  await update($, votingPoll, () => commitId)

  try {
    const voted = await vote(api, commitId, optionId)

    if ('error' in voted) {
      $.ui.toast(voted.error, TOAST)

      return
    }

    await replaceEntry($, voted.entry)
    await replaceInThread($, voted.entry)
    await update($, pollChoices, choices => {
      const { [commitId]: _, ...others } = choices

      return others
    })
  } finally {
    voting = false
    await update($, votingPoll, () => '')
  }
}
