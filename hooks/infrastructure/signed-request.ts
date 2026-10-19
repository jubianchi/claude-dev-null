/** The bytes a nonce is drawn from: /dev/null takes 32 hexadecimal digits. */
const NONCE_BYTES = 16

/** A request to the API, as its signature covers it: the address is its path and query, as sent. */
export type SignedRequest = { timestamp: number; nonce: string; method: string; uri: string; body?: string }

/** What a request to the API of /dev/null is signed with: its parts one a line, the body last, empty when it has none. */
export function signedMessage({ timestamp, nonce, method, uri, body = '' }: SignedRequest): string {
  return [String(timestamp), nonce, method, uri, body].join('\n')
}

/** The nonce of a request, from the random bytes it is drawn from. */
export function nonceOf(bytes: Uint8Array): string {
  if (bytes.length !== NONCE_BYTES) {
    throw new Error(`a nonce is drawn from ${NONCE_BYTES} bytes`)
  }

  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
