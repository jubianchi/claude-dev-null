import type { Elements } from 'claude-code'

import { check, MAX_IMAGES, MAX_LENGTH, thousands } from '../draft'
import Logo from './logo'

/** The background of the reply field once filled, for the commit to be seen as a reply: a color of the theme. */
export const REPLYING = 'diffAddedDimmed'

/**
 * The rows the composer takes with `images` images: its frame, the logo, the message, the image field while more
 * images fit, a row per image, and the reply.
 */
export function composerRows(images: number): number {
  return 9 + (images < MAX_IMAGES ? 1 : 0) + images
}

export type ComposerProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Input' | 'Text'>
  /** The draft: its message, the commit it replies to, the path typed in the image field and the images it carries. */
  draft: { message: string; reply: string; image: string; images: readonly string[] }
  cancelLabel: string
  onMessage: (value: string) => Promise<unknown>
  onReply: (value: string) => Promise<unknown>
  onImage: (value: string) => Promise<unknown>
  /** Adds the image at a path to the commit. */
  onAddImage: (path: string) => Promise<unknown>
  /** Takes the image at an index of the draft's images out of the commit. */
  onRemoveImage: (index: number) => Promise<unknown>
  onSend: () => Promise<unknown>
  onCancel: () => Promise<unknown>
}

export default function Composer(props: ComposerProps) {
  const { ui, draft, cancelLabel, onMessage, onReply, onImage, onAddImage, onRemoveImage, onSend, onCancel } = props
  const { Box, Button, Input, Text } = ui
  const { length, error } = check(draft.message, draft.reply, draft.images)

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Logo ui={ui} />
        <Box key="count">
          {error !== undefined ? (
            <Box key="error">
              <Text color="error">{error}</Text>
            </Box>
          ) : (
            <Text dimColor={length <= MAX_LENGTH}>
              {thousands(length)} / {thousands(MAX_LENGTH)}
            </Text>
          )}
        </Box>
      </Box>
      <Input
        key="message"
        rows={4}
        autoFocus
        value={draft.message}
        placeholder="What did you ship?"
        onInput={onMessage}
        onSubmit={async value => {
          await onMessage(value)
          await onSend()
        }}
        submitLabel="commit"
      />
      {draft.images.length < MAX_IMAGES && (
        <Input
          key="image"
          label="Image "
          value={draft.image}
          placeholder="path of a JPEG, PNG or WebP (optional)"
          onInput={onImage}
          onSubmit={onAddImage}
          submitLabel="add"
        />
      )}
      {draft.images.map((path, index) => (
        <Box key={`image-${index}`} gap={1} paddingLeft={2}>
          <Text dimColor>🖼</Text>
          <Box key={`image-path-${index}`} flexShrink={1}>
            <Text wrap="truncate-middle">{path}</Text>
          </Box>
          <Button key={`remove-image-${index}`} label="×" plain dimColor onPress={() => onRemoveImage(index)} />
        </Box>
      ))}
      <Box justifyContent="space-between">
        <Box key="reply-field" {...(draft.reply === '' ? {} : { backgroundColor: REPLYING })}>
          <Input
            key="reply"
            label="Reply to "
            value={draft.reply}
            placeholder="commit hash or link (optional)"
            onInput={onReply}
            onSubmit={async value => {
              await onReply(value)
              await onSend()
            }}
            submitLabel="commit"
          />
        </Box>
        <Box>
          {error === undefined && <Button key="commit" label="Commit" variant="primary" onPress={onSend} />}
          <Button key="cancel" label={cancelLabel} variant="secondary" onPress={onCancel} />
        </Box>
      </Box>
    </Box>
  )
}
