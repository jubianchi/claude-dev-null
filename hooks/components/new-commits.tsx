import type { Elements } from 'claude-code'

import type { Brand } from '../brand'

export type NewCommitsProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Text'>
  /** The colors of /dev/null in the theme of Claude Code: the badge in its primary, its words in its shell. */
  brand: Brand
  /** How many commits arrived above the log, not seen yet. */
  count: number
  onPress: () => Promise<unknown>
}

/**
 * The commits that arrived above the log, in a badge drawn over its top, centered, as the web app draws it: it takes
 * no row of the log.
 */
export default function NewCommits(props: NewCommitsProps) {
  const { ui, brand, count, onPress } = props
  const { Box, Button, Text } = ui

  return (
    <Box key="new-commits-badge" position="absolute" top={0} left={0} right={0} justifyContent="center">
      <Box key="new-commits-pill" backgroundColor={brand.primary}>
        <Button key="new-commits" plain onPress={onPress}>
          <Text color={brand.shell} weight="bold">
            {` ↑ ${count} new commit${count === 1 ? '' : 's'} `}
          </Text>
        </Button>
      </Box>
    </Box>
  )
}
