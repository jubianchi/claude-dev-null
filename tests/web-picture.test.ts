import type { ProcessRunInit, ProcessRunResult } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { downloadPicture } from '../hooks/infrastructure/web-picture'

const URL = 'https://dev-null.sh/commit-images/01a14f01-2689-70be-a5f1-cd5195a4428d'
/** The folder of the pictures, the download is written into while it lasts. */
const FOLDER = '/tmp/dev-null-pictures.abc123'

type Call = { argv: readonly string[]; init?: ProcessRunInit }

/** A command that answers `result`, recording each run: nothing runs. */
function runs(result: Partial<ProcessRunResult>): {
  calls: Call[]
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
} {
  const calls: Call[] = []

  return {
    calls,
    run: async (argv, init) => {
      calls.push({ argv, init })

      return { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...result }
    },
  }
}

describe('downloading a picture of /dev/null', () => {
  test('reads its bytes, which the command prints as base64, lines wrapped or not', async () => {
    const { run } = runs({ stdout: 'UklGRgAA\nAABXRUJQ\n' })

    expect([...(await downloadPicture(run, FOLDER, URL))]).toEqual([...Uint8Array.fromBase64('UklGRgAAAABXRUJQ')])
  })

  test('hands the address to curl as an argument of its own, never as words of the command, in the folder of the pictures', async () => {
    const { calls, run } = runs({ stdout: 'UklGRgAAAABXRUJQ' })
    await downloadPicture(run, FOLDER, URL)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.argv.slice(0, 2)).toEqual(['sh', '-c'])
    expect(calls[0]?.argv[2]).toContain('curl')
    expect(calls[0]?.argv[2]).not.toContain(URL)
    expect(calls[0]?.argv.slice(3)).toEqual(['sh', URL, FOLDER])
    expect(calls[0]?.argv[2]).toContain('mktemp "$2/download.XXXXXX"')
  })

  test('says why it could not download it', async () => {
    const { run } = runs({ exitCode: 22, stderr: 'curl: (22) The requested URL returned error: 404\n' })

    await expect(downloadPicture(run, FOLDER, URL)).rejects.toThrow('curl: (22) The requested URL returned error: 404')
  })

  test('downloads nothing when there is nothing to read', async () => {
    const { run } = runs({ stdout: '' })

    await expect(downloadPicture(run, FOLDER, URL)).rejects.toThrow('no picture')
  })

  test('downloads the pictures of /dev/null only', async () => {
    const { calls, run } = runs({ stdout: 'UklGRgAAAABXRUJQ' })

    for (const address of [
      'https://example.com/commit-images/x',
      'http://dev-null.sh/commit-images/x',
      'https://dev-null.sh/log/latest',
      'https://dev-null.sh.example.com/commit-images/x',
      'https://dev-null.sh/commit-images/../log/following',
      'https://dev-null.sh/commit-images/%2e%2e/log/following',
      'https://user@dev-null.sh/commit-images/x',
      'not an address',
    ]) {
      await expect(downloadPicture(run, FOLDER, address)).rejects.toThrow('not a picture of /dev/null')
    }

    expect(calls).toEqual([])
  })

  test('reads no curl configuration of the person, which could follow redirects or send cookies', async () => {
    const { calls, run } = runs({ stdout: 'UklGRgAAAABXRUJQ' })
    await downloadPicture(run, FOLDER, URL)

    expect(calls[0]?.argv[2]).toMatch(/curl -q /)
  })
})
