import type { Elements } from 'claude-code'

import { spinner } from '../spinner'

export type LoaderProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  /** Where it shows: in place of the log, or of More. */
  id: string
  now: number
}

/** That the log is loading: a turning spinner, centered in a box as wide as the log, its frame discreet. */
export default function Loader(props: LoaderProps) {
  const { ui, id, now } = props
  const { Box, Text } = ui

  return (
    <Box key={id} borderStyle="round" borderDimColor justifyContent="center" width="100%">
      <Text dimColor>{spinner(now)} Loading…</Text>
    </Box>
  )
}
