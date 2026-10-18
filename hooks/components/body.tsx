import type { Elements } from 'claude-code'

import type { LogSegment } from '../../types'
import type { Drawn } from '../body'
import { drawn, parts } from '../body'
import CodeBlock from './code-block'

/** The color /dev/null draws the slash of its wordmark in, as on its dark theme. */
export const WORDMARK = '#ff8a4c'

export type BodyProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Code' | 'Link' | 'Text'>
  /** The commit the words are of, for the address of each part. */
  id: string
  segments: readonly LogSegment[]
}

/** A commit's words as /dev/null draws them: its text, with its links, mentions and code, and its blocks of code. */
export default function Body(props: BodyProps) {
  const { ui, id, segments } = props
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
            /dev<Text color={WORDMARK}>/</Text>null
          </Text>
        )
      default:
        return <Link href={part.href} label={part.text} />
    }
  }

  return (
    <>
      {parts(segments).map(part =>
        part.type === 'block' ? (
          <CodeBlock ui={ui} id={`block-${id}-${part.index}`} language={part.language} code={part.code} />
        ) : (
          <Box key={`body-${id}-${part.index}`}>
            <Text>{drawn(part.prose).map(inline)}</Text>
          </Box>
        ),
      )}
    </>
  )
}
