import type { Elements } from 'claude-code'

import { shortHash } from '../hash'
import type { Entry } from '../log'
import { laneColor, quoteNotice, wordsWidth } from '../log'
import type { KeptPicture } from '../picture'
import Author from './author'
import Body from './body'
import Images from './images'
import LinkCard from './link-card'
import type { PollActions } from './poll'
import Poll from './poll'
import Quote from './quote'

export type Ui = Pick<
  Elements['terminal'] | Elements['desktop'],
  'Box' | 'Button' | 'Code' | 'Link' | 'Markdown' | 'Text'
> &
  Partial<Pick<Elements['terminal'], 'Image'>>

/**
 * What a person can do with a commit: reply to it, from its count of replies, and open its thread, when given; its
 * hash links to it.
 */
export type Actions = {
  onReply: (entry: Entry) => Promise<unknown>
  onThread?: (entry: Entry) => Promise<unknown>
  /** Stars a commit, or takes its star back, when given: one's own commits are not starred. */
  onStar?: (entry: Entry) => Promise<unknown>
}

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
    polls: PollActions
    /** A commit a thread starts from, or one of its replies. */
    kind: 'commit' | 'reply'
    /** Whether it replies to a commit the log does not show. */
    isOrphan: boolean
  }

export default function Commit(props: CommitProps) {
  const { ui, entry, columns, now, viewer, polls, kind, isOrphan, onReply, onThread, onStar, pictureOf } = props
  const isOwn = viewer !== '' && entry.author?.username.toLowerCase() === viewer.toLowerCase()
  const notice = quoteNotice(entry, kind === 'reply')
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
            isOwn={isOwn}
            isStatic={false}
            polls={polls}
          />
        )}
        {notice !== null ? (
          <Box key={`quote-${id}`} borderStyle="round" borderDimColor paddingX={1}>
            <Text dimColor>{notice}</Text>
          </Box>
        ) : (
          entry.quote !== null && <Quote ui={ui} id={id} quote={entry.quote} now={now} polls={polls} />
        )}
        {linkPreview !== null && <LinkCard ui={ui} id={id} preview={linkPreview} />}
        <Box key={`counts-${id}`} gap={2} marginTop={1}>
          {entry.deletedAt === null &&
            (onStar !== undefined && entry.starred !== undefined && !isOwn ? (
              <Button
                key={`star-${id}`}
                dimColor
                label={`${entry.starred ? '⭐️' : '☆'} ${entry.stars}`}
                onPress={() => onStar(entry)}
              />
            ) : (
              <Text dimColor>⭐️ {entry.stars}</Text>
            ))}
          {entry.deletedAt === null ? (
            <Button key={`reply-to-${id}`} dimColor label={`💬 ${entry.replies}`} onPress={() => onReply(entry)} />
          ) : (
            <Text dimColor>💬 {entry.replies}</Text>
          )}
          {entry.deletedAt === null && onThread !== undefined && (
            <Button key={`thread-${id}`} dimColor label="🧵" onPress={() => onThread(entry)} />
          )}
          {entry.preview !== null && <Link href={entry.url} label="Show more" />}
          {entry.continuationId !== null && <Link href={entry.url} label="Show thread" />}
        </Box>
      </Box>
    </Box>
  )
}
