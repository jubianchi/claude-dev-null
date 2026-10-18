import type { Elements } from 'claude-code'

import { check, MAX_LENGTH, thousands } from '../draft'
import Logo from './logo'

export type ComposerProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Input' | 'Text'>
  draft: { message: string; reply: string }
  cancelLabel: string
  onMessage: (value: string) => Promise<unknown>
  onReply: (value: string) => Promise<unknown>
  onSend: () => Promise<unknown>
  onCancel: () => Promise<unknown>
}

export default function Composer(props: ComposerProps) {
  const { ui, draft, cancelLabel, onMessage, onReply, onSend, onCancel } = props
  const { Box, Button, Input, Text } = ui
  const { length, error } = check(draft.message, draft.reply)

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Logo ui={ui} />
        <Box key="count">
          {error !== undefined ? (
            <Box key="error">
              <Text color="red">{error}</Text>
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
      <Box justifyContent="space-between">
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
        <Box>
          {error === undefined && <Button key="commit" label="Commit" variant="primary" onPress={onSend} />}
          <Button key="cancel" label={cancelLabel} variant="secondary" onPress={onCancel} />
        </Box>
      </Box>
    </Box>
  )
}
