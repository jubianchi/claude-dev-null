import type { Elements } from 'claude-code'

export type LoaderProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  /** Where it shows: in place of the log, beside More, or beside refresh. */
  id: string
}

/** That something of the log is loading. */
export default function Loader(props: LoaderProps) {
  const { ui, id } = props
  const { Box, Text } = ui

  return (
    <Box key={id}>
      <Text dimColor>⋯ Loading…</Text>
    </Box>
  )
}
