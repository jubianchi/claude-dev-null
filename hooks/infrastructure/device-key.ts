import type { Run } from './web-picture'

/** The key the plugin signs its requests to the API with, which /dev/null knows a device by, from its fingerprint. */
export type DeviceKey = { publicKey: string; fingerprint: string; privateKey: string }

const PUBLIC_KEY = /^ssh-ed25519 [A-Za-z0-9+/]+=* /
const FINGERPRINT = /^SHA256:[A-Za-z0-9+/]{43}$/
const PRIVATE_KEY = /^-----BEGIN OPENSSH PRIVATE KEY-----\n[\s\S]+\n-----END OPENSSH PRIVATE KEY-----$/
const SIGNATURE = /^[A-Za-z0-9+/]+=*$/

/** What the command `argv` printed, or why it failed. */
async function printed(
  run: Run,
  argv: readonly string[],
  init: { stdin?: string; env?: Record<string, string> } = {},
): Promise<string> {
  const { exitCode, stdout, stderr } = await run(argv, { timeoutMs: 30_000, ...init })

  if (exitCode !== 0) {
    throw new Error(stderr.trim().split('\n')[0] || `${argv.join(' ')} failed (exit ${exitCode})`)
  }

  return stdout.trim()
}

/** A new key for the device, created by `script` (hooks/device-key.sh). */
export async function createKey(run: Run, script: string): Promise<DeviceKey> {
  const [publicKey = '', fingerprint = '', ...rest] = (await printed(run, [script, 'create'])).split('\n')
  const privateKey = rest.join('\n')

  if (!PUBLIC_KEY.test(publicKey) || !FINGERPRINT.test(fingerprint) || !PRIVATE_KEY.test(privateKey)) {
    throw new Error(`${script} printed no key`)
  }

  return { publicKey, fingerprint, privateKey }
}

/** The signature of `message` by `key`, as base64, made by `script` (hooks/device-key.sh). */
export async function sign(run: Run, script: string, key: DeviceKey, message: string): Promise<string> {
  const signature = await printed(run, [script, 'sign'], { stdin: message, env: { DEVNULL_KEY: key.privateKey } })

  if (!SIGNATURE.test(signature)) {
    throw new Error(`${script} printed no signature`)
  }

  return signature
}
