import type { ProcessRunInit, ProcessRunResult } from 'claude-code'

/** Runs a command on the host, as `$.process.run` does. */
export type Run = (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>

/**
 * Downloads the picture at $1 into a file of its own, in the folder $2 of the pictures, which goes with it should the
 * command be cut short, and prints it as base64, since a command's output is text; the file goes, whatever happens.
 * The address stays an argument, never words of the command; curl reads no configuration of the person (-q, first),
 * which could follow redirects or send cookies.
 */
const DOWNLOAD =
  'f="$(mktemp "$2/download.XXXXXX")" && ' +
  'curl -q -sS --fail --max-time 20 --max-filesize 5242880 -o "$f" -- "$1" && base64 < "$f"; ' +
  's=$?; rm -f "$f"; exit $s'

/**
 * `url` as curl would request it, if it is a picture of a commit of /dev/null: on https://dev-null.sh, under
 * /commit-images/ once its dots are resolved, with no one signed in.
 */
function pictureAddress(url: string): string | undefined {
  try {
    const address = new URL(url)

    return address.origin === 'https://dev-null.sh' &&
      address.username === '' &&
      address.password === '' &&
      address.pathname.startsWith('/commit-images/')
      ? address.href
      : undefined
  } catch {
    return undefined
  }
}

/**
 * The bytes of a picture of a commit of /dev/null, at `url`, read with `run`: the host's network has text answers
 * only, which would garble them.
 */
export async function downloadPicture(run: Run, folder: string, url: string): Promise<Uint8Array> {
  const address = pictureAddress(url)

  if (address === undefined) {
    throw new Error(`${url} is not a picture of /dev/null`)
  }

  const { exitCode, stdout, stderr } = await run(['sh', '-c', DOWNLOAD, 'sh', address, folder], {
    timeoutMs: 30_000,
  })

  if (exitCode !== 0) {
    throw new Error(stderr.trim().split('\n')[0] || `could not download ${url} (exit ${exitCode})`)
  }

  const base64 = stdout.replace(/\s/g, '')

  if (base64 === '') {
    throw new Error(`no picture at ${url}`)
  }

  return Uint8Array.fromBase64(base64)
}
