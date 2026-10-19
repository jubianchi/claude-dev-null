import type { ProcessRunInit, ProcessRunResult } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { createKey, sign } from '../hooks/infrastructure/device-key'

const SCRIPT = '/plugin/hooks/device-key.sh'
const PUBLIC = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIZtH7X2lV6hO1Cm2rEHdA4nbXo2nOq0v2O3yXo6Zw1r dev-null'
const FINGERPRINT = 'SHA256:Q0pTMVuu8Nb2lb8ZQZp3mJqB8X2b0e3B1Gd6l7VY0rk'
const PRIVATE = [
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW',
  '-----END OPENSSH PRIVATE KEY-----',
].join('\n')
const KEY = { publicKey: PUBLIC, fingerprint: FINGERPRINT, privateKey: PRIVATE }
const MESSAGE = '1760534400\n3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b\nGET\n/api/v1/me\n'

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

describe('creating the key of the device', () => {
  test('reads the public key, the fingerprint and the private key the script prints', async () => {
    const { calls, run } = runs({ stdout: `${PUBLIC}\n${FINGERPRINT}\n${PRIVATE}\n` })

    expect(await createKey(run, SCRIPT)).toEqual(KEY)
    expect(calls.map(call => call.argv)).toEqual([[SCRIPT, 'create']])
  })

  test('says why the script could not create it', async () => {
    const { run } = runs({ exitCode: 1, stderr: 'ssh-keygen: command not found\n' })

    await expect(createKey(run, SCRIPT)).rejects.toThrow('ssh-keygen: command not found')
  })

  test('takes no key the script would print garbled', async () => {
    for (const stdout of [
      '',
      `${PUBLIC}\n${FINGERPRINT}\n`,
      `ssh-rsa AAAA dev-null\n${FINGERPRINT}\n${PRIVATE}\n`,
      `${PUBLIC}\nSHA256:short\n${PRIVATE}\n`,
      `${PUBLIC}\n${FINGERPRINT}\nnot a key\n`,
    ]) {
      const { run } = runs({ stdout })

      await expect(createKey(run, SCRIPT)).rejects.toThrow('no key')
    }
  })
})

describe('signing with the key of the device', () => {
  test('gives the signature the script prints', async () => {
    const { run } = runs({ stdout: 'U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTk=' })

    expect(await sign(run, SCRIPT, KEY, MESSAGE)).toBe('U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTk=')
  })

  test('hands the message on stdin and the private key in the environment, never as an argument', async () => {
    const { calls, run } = runs({ stdout: 'U1NIU0lH' })
    await sign(run, SCRIPT, KEY, MESSAGE)

    expect(calls).toHaveLength(1)
    expect(calls[0]?.argv).toEqual([SCRIPT, 'sign'])
    expect(calls[0]?.init?.stdin).toBe(MESSAGE)
    expect(calls[0]?.init?.env).toEqual({ DEVNULL_KEY: PRIVATE })
  })

  test('says why the script could not sign', async () => {
    const { run } = runs({ exitCode: 255, stderr: 'Load key "/tmp/dev-null-key.x": invalid format\nmore\n' })

    await expect(sign(run, SCRIPT, KEY, MESSAGE)).rejects.toThrow('Load key "/tmp/dev-null-key.x": invalid format')
  })

  test('takes no signature that is not base64', async () => {
    for (const stdout of ['', '-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\n-----END SSH SIGNATURE-----']) {
      const { run } = runs({ stdout })

      await expect(sign(run, SCRIPT, KEY, MESSAGE)).rejects.toThrow('no signature')
    }
  })
})
