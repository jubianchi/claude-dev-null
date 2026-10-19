import type { ProcessRunInit, ProcessRunResult } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { makeFolder, removeFolder, removePixels, savePixels } from '../hooks/infrastructure/picture-file'

type Call = { argv: readonly string[]; init?: ProcessRunInit }

/** A command that answers `result`, recording each run: nothing runs. */
function runs(result: Partial<ProcessRunResult>) {
  const calls: Call[] = []
  const run = async (argv: readonly string[], init?: ProcessRunInit): Promise<ProcessRunResult> => {
    calls.push({ argv, init })

    return { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...result }
  }

  return { calls, run }
}

const FOLDER = '/tmp/dev-null-pictures.abc123'

describe('keeping the pixels of pictures in files', () => {
  test('makes a folder of its own for them, in the temporary directory, and gives its path', async () => {
    const { calls, run } = runs({ stdout: FOLDER })

    expect(await makeFolder(run)).toBe(FOLDER)
    expect(calls[0]?.argv.slice(0, 2)).toEqual(['sh', '-c'])
    expect(calls[0]?.argv[2]).toContain('mktemp -d')
    expect(calls[0]?.argv[2]).toContain('dev-null-pictures.XXXXXX')
  })

  test('writes pixels, given as base64 on the standard input, into a file of its own in the folder', async () => {
    const { calls, run } = runs({ stdout: `${FOLDER}/picture.def456` })

    expect(await savePixels(run, FOLDER, 'AAEC/w==')).toBe(`${FOLDER}/picture.def456`)
    expect(calls[0]?.argv.slice(0, 2)).toEqual(['sh', '-c'])
    expect(calls[0]?.argv[2]).not.toContain(FOLDER)
    expect(calls[0]?.argv.slice(3)).toEqual(['sh', FOLDER])
    expect(calls[0]?.init?.stdin).toBe('AAEC/w==')
  })

  test('says why it could not make the folder or write the pixels', async () => {
    const { run } = runs({ exitCode: 1, stderr: 'mktemp: mkstemp failed: No space left on device\n' })

    await expect(makeFolder(run)).rejects.toThrow('mktemp: mkstemp failed: No space left on device')
    await expect(savePixels(run, FOLDER, 'AAEC/w==')).rejects.toThrow('mktemp: mkstemp failed: No space left on device')
  })

  test('removes a file it wrote, or its folder, given as an argument of their own', async () => {
    const { calls, run } = runs({})
    await removePixels(run, `${FOLDER}/picture.def456`)
    await removeFolder(run, FOLDER)

    expect(calls.map(call => call.argv)).toEqual([
      ['rm', '-f', '--', `${FOLDER}/picture.def456`],
      ['rm', '-rf', '--', FOLDER],
    ])
  })

  test('removes only the files and folders it makes', async () => {
    const { calls, run } = runs({})

    for (const path of ['/home/me/.ssh/id_ed25519', `${FOLDER}/../../home/me`, '/tmp/dev-null-pictures.x/../..', '/']) {
      await removePixels(run, path)
      await removeFolder(run, path)
    }

    expect(calls).toEqual([])
  })
})
