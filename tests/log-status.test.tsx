import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { REJECTED, REVIEW } from '../hooks/components/status'
import { log, mountLog, SIGNED_IN, signedIn, surface, webCommit, webSite } from './support'

/** A commit of the person reading, as /dev/null says it to them. */
const own = (status: string) => webCommit('c1', { status }, SIGNED_IN)

async function latest($: Engine) {
  await log($)
  const pane = await mountLog($, 'terminal')
  await pane.press({ key: 'tab-latest' })

  return pane
}

describe('the status of a commit, as /dev/null says it to its author', () => {
  test('says a commit /dev/null still reviews is in review, in the header, before its hash', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: { '/log/latest': { data: [own('pending')] } } })
    const pane = await latest($)
    const badge = await pane.find({ key: 'status-c1' })

    expect(badge?.text).toBe('in review')
    expect((await pane.find({ type: 'Text', text: 'in review' }))?.props.color).toBe(REVIEW)
  })

  test('says a commit /dev/null rejected is rejected', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: { '/log/latest': { data: [own('rejected')] } } })
    const pane = await latest($)
    const badge = await pane.find({ key: 'status-c1' })

    expect(badge?.text).toBe('rejected')
    expect((await pane.find({ type: 'Text', text: 'rejected' }))?.props.color).toBe(REJECTED)
  })

  test('says nothing of a commit approved', async ($, on) => {
    signedIn(on)
    webSite(on, { pages: { '/log/latest': { data: [own('approved')] } } })
    const pane = await latest($)

    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
    expect(await pane.find({ key: 'status-c1' })).toBeUndefined()
  })

  test('says nothing while no one approved the device, /dev/null saying no status', async ($, on) => {
    surface(on)
    webSite(on, { pages: { '/log/latest': { data: [webCommit('c1')] } } })
    const pane = await latest($)

    expect(await pane.find({ key: 'commit-c1' })).toBeDefined()
    expect(await pane.find({ key: 'status-c1' })).toBeUndefined()
  })
})
