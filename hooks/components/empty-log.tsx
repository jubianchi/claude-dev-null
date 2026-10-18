import type { Elements } from 'claude-code'

export type EmptyLogProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  /** What the log says it is empty of. */
  text: string
}

/** That the log, loaded, has no commits. */
export default function EmptyLog(props: EmptyLogProps) {
  const { ui, text } = props
  const { Box, Text } = ui

  return (
    <Box key="log-empty">
      <Text dimColor>{text}</Text>
    </Box>
  )
}
