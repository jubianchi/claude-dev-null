import { describe, expect, test } from 'claude-code/testing'

import { nonceOf, signedMessage } from '../hooks/infrastructure/signed-request'

describe('the message a request to the API of /dev/null is signed with', () => {
  test('joins the timestamp, the nonce, the method, the address and the body, one a line', () => {
    expect(
      signedMessage({
        timestamp: 1760534400,
        nonce: '3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b',
        method: 'POST',
        uri: '/api/v1/devices',
        body: '{"device_code":"abc"}',
      }),
    ).toBe('1760534400\n3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b\nPOST\n/api/v1/devices\n{"device_code":"abc"}')
  })

  test('ends with an empty line when the request has no body', () => {
    expect(
      signedMessage({
        timestamp: 1760534400,
        nonce: '3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b',
        method: 'GET',
        uri: '/api/v1/me',
      }),
    ).toBe('1760534400\n3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b\nGET\n/api/v1/me\n')
  })

  test('keeps the query of the address as it is sent', () => {
    expect(
      signedMessage({
        timestamp: 1760534400,
        nonce: '3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b',
        method: 'GET',
        uri: '/api/v1/log/latest?cursor=eyJpZCI6IjAxIn0%3D',
      }),
    ).toContain('\n/api/v1/log/latest?cursor=eyJpZCI6IjAxIn0%3D\n')
  })
})

describe('the nonce of a request', () => {
  test('is the 16 random bytes it is drawn from, in lowercase hexadecimal', () => {
    expect(nonceOf(Uint8Array.from([0, 1, 15, 16, 127, 128, 254, 255, 0, 1, 15, 16, 127, 128, 254, 255]))).toBe(
      '00010f107f80feff00010f107f80feff',
    )
  })

  test('takes 16 bytes, no more, no less', () => {
    expect(() => nonceOf(new Uint8Array(15))).toThrow('16 bytes')
    expect(() => nonceOf(new Uint8Array(17))).toThrow('16 bytes')
  })
})
