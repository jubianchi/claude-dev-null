import type { Elements } from 'claude-code'

import type { LogLinkPreview } from '../../types'
import { siteOf } from '../body'

export type LinkCardProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  /** The commit the card is of. */
  id: string
  preview: LogLinkPreview
}

/** The card of a link, as /dev/null draws it: none without a title, its site named after its host when it has no name. */
export default function LinkCard(props: LinkCardProps) {
  const { ui, id, preview } = props
  const { Box, Text } = ui

  if (preview.title === null) {
    return null
  }

  return (
    <Box key={`preview-${id}`} flexDirection="column" borderStyle="round" paddingX={1}>
      <Text dimColor>{siteOf(preview)}</Text>
      <Text weight="bold">{preview.title}</Text>
      {preview.description !== null && <Text>{preview.description}</Text>}
    </Box>
  )
}
