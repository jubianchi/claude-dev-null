import { describe, expect, test } from 'claude-code/testing'

import { BRANDS, themeOf } from '../hooks/brand'

describe('the colors of /dev/null', () => {
  test('are those of its brand, in its light theme', () => {
    expect(BRANDS.light).toEqual({
      ink: '#121417',
      shell: '#f6f7f8',
      accent: '#d9480f',
      primary: '#3b6fe0',
      lanes: ['#d9480f', '#2f9e44', '#9c36b5', '#0c8599', '#c2255c', '#b7791f'],
    })
  })

  test('are those of its brand, in its dark theme', () => {
    expect(BRANDS.dark).toEqual({
      ink: '#ececec',
      shell: '#111112',
      accent: '#ff8a4c',
      primary: '#7aa2f7',
      lanes: ['#ff8a4c', '#51cf66', '#da77f2', '#3bc9db', '#f06595', '#fcc419'],
    })
  })

  test('follow the theme of Claude Code, light ones and their variants light', () => {
    expect(themeOf('light')).toBe('light')
    expect(themeOf('light-daltonized')).toBe('light')
    expect(themeOf('light-ansi')).toBe('light')
  })

  test('are dark for every other theme, or none known', () => {
    expect(themeOf('dark')).toBe('dark')
    expect(themeOf('dark-ansi')).toBe('dark')
    expect(themeOf(undefined)).toBe('dark')
    expect(themeOf(3)).toBe('dark')
  })
})
