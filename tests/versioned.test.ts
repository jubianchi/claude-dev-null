import { describe, expect, test } from 'claude-code/testing'

import { seal, unseal } from '../hooks/versioned'

describe('versioned values of the store', () => {
  const migrations = {
    1: (value: unknown) => ({ from1: value }),
    2: (value: unknown) => ({ from2: value }),
  }

  test('seals a value with its version', () => {
    expect(seal(3, { a: 1 })).toEqual({ version: 3, value: { a: 1 } })
  })

  test('unseals a value of the current version as it is', () => {
    expect(unseal(seal(3, 'x'), 3, migrations)).toBe('x')
  })

  test('migrates an older value one version at a time', () => {
    expect(unseal(seal(1, 'x'), 3, migrations)).toEqual({ from2: { from1: 'x' } })
  })

  test('resets a value no migration leads from', () => {
    expect(unseal(seal(0, 'x'), 3, migrations)).toBeUndefined()
  })

  test('resets a value of a newer version', () => {
    expect(unseal(seal(4, 'x'), 3, migrations)).toBeUndefined()
  })

  test('resets what is not a sealed value', () => {
    expect(unseal(undefined, 3, migrations)).toBeUndefined()
    expect(unseal(null, 3, migrations)).toBeUndefined()
    expect(unseal('x', 3, migrations)).toBeUndefined()
    expect(unseal({ version: '3', value: 'x' }, 3, migrations)).toBeUndefined()
    expect(unseal({ version: 2.5, value: 'x' }, 3, migrations)).toBeUndefined()
    expect(unseal({ version: 3 }, 3, migrations)).toBeUndefined()
  })

  test('resets a value a migration fails on', () => {
    const failing = {
      2: () => {
        throw new Error('broken')
      },
    }

    expect(unseal(seal(2, 'x'), 3, failing)).toBeUndefined()
  })
})
