import type { Elements } from 'claude-code'

import type { Brand } from '../brand'

export type LogoProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  /** The colors of /dev/null in the theme of Claude Code. */
  brand: Brand
}

export default function Logo(props: LogoProps) {
  const { ui, brand } = props
  const { Box, Text } = ui

  return (
    <Box flexDirection="row" gap={1} key="logo">
      <Box>
        <Text weight="bold">/</Text>
        <Text weight="bold" color={brand.accent}>
          /
        </Text>
      </Box>
      <Box>
        <Text weight="bold">/dev</Text>
        <Text weight="bold" color={brand.accent}>
          /
        </Text>
        <Text weight="bold">null</Text>
        <Text color="inactive"> • a social network for devs</Text>
      </Box>
    </Box>
  )
}
