import type { Elements } from 'claude-code'

export type LogoProps = { ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'> }

export default function Logo(props: LogoProps) {
  const { Box, Text } = props.ui

  return (
    <Box flexDirection="row" gap={1} key="logo">
      <Box>
        <Text weight="bold">/</Text>
        <Text weight="bold" color="#d9480f">
          /
        </Text>
      </Box>
      <Box>
        <Text weight="bold">/dev</Text>
        <Text weight="bold" color="#d9480f">
          /
        </Text>
        <Text weight="bold">null</Text>
        <Text color="inactive"> • a social network for devs</Text>
      </Box>
    </Box>
  )
}
