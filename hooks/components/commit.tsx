import type { Elements } from 'claude-code'

import { shortHash } from '../hash'
import type { Entry } from '../log'
import { laneColor } from '../log'
import Author from './author'
import Body from './body'
import Images from './images'
import Poll from './poll'
import Quote from './quote'

export type Ui = Pick<
  Elements['terminal'] | Elements['desktop'],
  'Box' | 'Button' | 'Code' | 'Link' | 'Markdown' | 'Text'
>

/** What a person can do with a commit: reply to it, from its count of replies; its hash links to it. */
export type Actions = { onReply: (entry: Entry) => Promise<unknown> }

export type CommitProps = Actions & {
  ui: Ui
  entry: Entry
  now: number
  /** A commit a thread starts from, or one of its replies. */
  kind: 'commit' | 'reply'
  /** Whether it replies to a commit the log does not show. */
  isOrphan: boolean
}

export default function Commit(props: CommitProps) {
  const { ui, entry, now, kind, isOrphan, onReply } = props
  const { Box, Button, Link, Text } = ui
  const { id, author, linkPreview, images } = entry

  return (
    <Box
      key={`${kind}-${id}`}
      flexDirection="column"
      borderStyle="quote"
      borderColor={laneColor(author)}
      marginBottom={-1}
      flexGrow={1}
    >
      <Box justifyContent="space-between">
        <Author ui={ui} author={author} createdAt={entry.createdAt} now={now} />
        <Link href={entry.url} label={entry.shortHash} />
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {isOrphan && entry.parentId !== null && <Text dimColor>↳ reply to {shortHash(entry.parentId)}</Text>}
        <Body ui={ui} id={id} segments={entry.segments} />
        {entry.poll !== null && (
          <Poll ui={ui} id={id} poll={entry.poll} url={entry.url} color={laneColor(author)} now={now} />
        )}
        {entry.quote !== null && <Quote ui={ui} id={id} quote={entry.quote} now={now} />}
        {linkPreview !== null && (
          <Box key={`preview-${id}`} flexDirection="column" borderStyle="round" paddingX={1}>
            {linkPreview.site !== null && <Text dimColor>{linkPreview.site}</Text>}
            <Text weight="bold">{linkPreview.title ?? linkPreview.url}</Text>
            {linkPreview.description !== null && <Text>{linkPreview.description}</Text>}
          </Box>
        )}
        <Images ui={ui} id={id} images={images} />
        <Box gap={2} marginTop={1}>
          <Text dimColor>⭐️ {entry.stars}</Text>
          <Button key={`reply-to-${id}`} dimColor label={`💬 ${entry.replies}`} onPress={() => onReply(entry)} />
        </Box>
      </Box>
    </Box>
  )
}
