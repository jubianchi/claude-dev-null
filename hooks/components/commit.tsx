import type { Elements } from 'claude-code'

import { shortHash } from '../hash'
import type { Entry } from '../log'
import { laneColor, wordsWidth } from '../log'
import type { KeptPicture } from '../picture'
import Author from './author'
import Body from './body'
import Images from './images'
import LinkCard from './link-card'
import Poll from './poll'
import Quote from './quote'

export type Ui = Pick<
  Elements['terminal'] | Elements['desktop'],
  'Box' | 'Button' | 'Code' | 'Link' | 'Markdown' | 'Text'
> &
  Partial<Pick<Elements['terminal'], 'Image'>>

/** What a person can do with a commit: reply to it, from its count of replies; its hash links to it. */
export type Actions = { onReply: (entry: Entry) => Promise<unknown> }

/** The pictures a log draws: the picture loaded for an image, if any. */
export type Pictures = { pictureOf?: (url: string) => KeptPicture | undefined }

export type CommitProps = Actions &
  Pictures & {
    ui: Ui
    entry: Entry
    /** The columns the commit takes, with its lane. */
    columns: number
    now: number
    /** The username of the person reading, signed in; '' when no one is. */
    viewer: string
    /** A commit a thread starts from, or one of its replies. */
    kind: 'commit' | 'reply'
    /** Whether it replies to a commit the log does not show. */
    isOrphan: boolean
  }

export default function Commit(props: CommitProps) {
  const { ui, entry, columns, now, viewer, kind, isOrphan, onReply, pictureOf } = props
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
        {entry.deletedAt === null && <Link href={entry.url} label={entry.shortHash} />}
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {isOrphan && entry.parentId !== null && <Text dimColor>↳ reply to {shortHash(entry.parentId)}</Text>}
        <Body ui={ui} id={id} segments={entry.preview ?? entry.segments} mentions={entry.mentions} />
        <Images
          ui={ui}
          id={id}
          images={images}
          width={wordsWidth(columns)}
          {...(pictureOf === undefined ? {} : { pictureOf })}
        />
        {entry.poll !== null && (
          <Poll
            ui={ui}
            id={id}
            poll={entry.poll}
            url={entry.url}
            color={laneColor(author)}
            now={now}
            isVotable={viewer === '' || author?.username.toLowerCase() !== viewer.toLowerCase()}
          />
        )}
        {entry.quote !== null && <Quote ui={ui} id={id} quote={entry.quote} now={now} />}
        {linkPreview !== null && <LinkCard ui={ui} id={id} preview={linkPreview} />}
        <Box gap={2} marginTop={1}>
          {entry.deletedAt === null ? (
            <>
              <Text dimColor>⭐️ {entry.stars}</Text>
              <Button key={`reply-to-${id}`} dimColor label={`💬 ${entry.replies}`} onPress={() => onReply(entry)} />
            </>
          ) : (
            <Text dimColor>💬 {entry.replies}</Text>
          )}
          {entry.preview !== null && <Link href={entry.url} label="Show more" />}
          {entry.continuationId !== null && <Link href={entry.url} label="Show thread" />}
        </Box>
      </Box>
    </Box>
  )
}
