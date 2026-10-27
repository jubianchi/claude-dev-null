import type { Elements } from 'claude-code'

import type { LogSegment } from '../../types'
import type { Drawn } from '../body'
import { drawn, parts } from '../body'
import type { Brand } from '../brand'
import CodeBlock from './code-block'

export type BodyProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Code' | 'Link' | 'Text'>
  /** The colors of /dev/null in the theme of Claude Code: the slash of its wordmark in its accent, links in its primary. */
  brand: Brand
  /** The commit the words are of, for the address of each part. */
  id: string
  segments: readonly LogSegment[]
  /** The ids of the developers the commit mentions, by their handle in small letters: those linked. */
  mentions: Readonly<Record<string, string>>
  /** Whether nothing is linked, as in a commit quoted, its links shown as written. */
  isStatic?: boolean
}

/** A commit's words as /dev/null draws them: its text, with its links, mentions and code, and its blocks of code. */
export default function Body(props: BodyProps) {
  const { ui, brand, id, segments, mentions, isStatic = false } = props
  const { Box, Link, Text } = ui

  const inline = (part: Drawn) => {
    switch (part.type) {
      case 'text':
        return part.text
      case 'code':
        return <Text mono>{part.text}</Text>
      case 'wordmark':
        return (
          <Text weight="bold">
            /dev<Text color={brand.accent}>/</Text>null
          </Text>
        )
      default:
        return (
          <Link href={part.href}>
            <Text color={brand.primary}>{part.text}</Text>
          </Link>
        )
    }
  }

  return (
    <>
      {parts(segments).map(part =>
        part.type === 'block' ? (
          <CodeBlock ui={ui} id={`block-${id}-${part.index}`} language={part.language} code={part.code} />
        ) : (
          <Box key={`body-${id}-${part.index}`}>
            <Text>{drawn(part.prose, mentions, { isStatic }).map(inline)}</Text>
          </Box>
        ),
      )}
    </>
  )
}
