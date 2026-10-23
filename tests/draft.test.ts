import { describe, expect, test } from 'claude-code/testing'

import { check } from '../hooks/draft'

const LONG_LINK = `https://example.com/${'a'.repeat(1000)}`

describe('checking the length of a draft, as /dev/null counts it', () => {
  test('takes a commit of one character', () => {
    expect(check('a', '')).toEqual({ length: 1 })
  })

  test('counts the message as /dev/null keeps it: trimmed, with blank lines run together', () => {
    expect(check('  It was DNS.  ', '').length).toBe(11)
    expect(check(`a${'\n'.repeat(5)}b`, '').length).toBe(4)
    expect(check('a\r\n\r\n\r\nb', '').length).toBe(4)
  })

  test('keeps the blank lines of code as written', () => {
    expect(check(`\`\`\`\na${'\n'.repeat(5)}b\n\`\`\``, '').length).toBe(15)
  })

  test('counts a link of the text as 23 characters at most', () => {
    expect(check(`See ${LONG_LINK}`, '').length).toBe(27)
    expect(check('See https://dev-null.sh.', '').length).toBe(24)
    expect(check(`${'x'.repeat(3970)} ${LONG_LINK}`, '')).toEqual({ length: 3994 })
  })

  test('counts each link of the text', () => {
    expect(check(`${LONG_LINK} and ${LONG_LINK}`, '').length).toBe(51)
  })

  test('counts a link written in code as it is', () => {
    expect(check(`\`${LONG_LINK}\``, '').length).toBe(1022)
  })

  test('counts as it is a link too long to be one', () => {
    const tooLong = `https://example.com/${'a'.repeat(2100)}`

    expect(check(tooLong, '').length).toBe([...tooLong].length)
  })

  test('refuses past 4,000 characters, as counted', () => {
    expect(check(`${'x'.repeat(3990)} ${LONG_LINK}`, '').error).toBe('Too long by 14 characters: shorten it yourself.')
  })
})
