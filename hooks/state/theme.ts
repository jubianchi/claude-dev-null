import type { EngineInterface } from 'claude-code'

import type { Brand } from '../brand'
import { BRANDS, themeOf } from '../brand'

/** The colors of /dev/null in the theme of Claude Code, as its `/config` menu lists it; dark when it says none. */
export async function brandOf($: EngineInterface): Promise<Brand> {
  try {
    const rows = await $.config.list()

    return BRANDS[themeOf(rows.find(row => row.key === 'theme')?.value)]
  } catch {
    return BRANDS.dark
  }
}
