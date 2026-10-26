/** The themes /dev/null draws itself in. */
export type Theme = 'light' | 'dark'

/** The colors of /dev/null in a theme, as its brand gives them (https://dev-null.sh/brand). */
export type Brand = {
  ink: string
  shell: string
  /** The outlined slash of its logo. */
  accent: string
  primary: string
  /** Its six lanes, which a developer picks one of. */
  lanes: readonly string[]
}

export const BRANDS: Readonly<Record<Theme, Brand>> = {
  light: {
    ink: '#121417',
    shell: '#f6f7f8',
    accent: '#d9480f',
    primary: '#3b6fe0',
    lanes: ['#d9480f', '#2f9e44', '#9c36b5', '#0c8599', '#c2255c', '#b7791f'],
  },
  dark: {
    ink: '#ececec',
    shell: '#111112',
    accent: '#ff8a4c',
    primary: '#7aa2f7',
    lanes: ['#ff8a4c', '#51cf66', '#da77f2', '#3bc9db', '#f06595', '#fcc419'],
  },
}

/** The theme of /dev/null for `value`, the theme of Claude Code: light for its light ones, dark otherwise. */
export function themeOf(value: unknown): Theme {
  return typeof value === 'string' && value.startsWith('light') ? 'light' : 'dark'
}
