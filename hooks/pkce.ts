/** The proof a sign-in redeems its code with (RFC 7636): a verifier, its challenge, and the state it is sent with. */
export type Pkce = { verifier: string; challenge: string; state: string }

/** The bytes a verifier is drawn from: 64 characters once in base64url. */
const VERIFIER_BYTES = 48

/** The bytes a state is drawn from: 32 hexadecimal digits. */
const STATE_BYTES = 16

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

/** The challenge of `verifier`: its SHA-256, by `sha256`, in base64url, as the S256 method says. */
export async function challengeOf(
  verifier: string,
  sha256: (data: Uint8Array) => Promise<ArrayBuffer>,
): Promise<string> {
  return base64url(new Uint8Array(await sha256(new TextEncoder().encode(verifier))))
}

/** A verifier and a state drawn from `random`, and the challenge of the verifier. */
export async function pkce(
  random: (length: number) => Uint8Array,
  sha256: (data: Uint8Array) => Promise<ArrayBuffer>,
): Promise<Pkce> {
  const verifier = base64url(random(VERIFIER_BYTES))

  return {
    verifier,
    challenge: await challengeOf(verifier, sha256),
    state: [...random(STATE_BYTES)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
  }
}
