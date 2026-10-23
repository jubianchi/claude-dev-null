import type { Elements } from 'claude-code'

import type { PendingSignIn } from '../../types'
import ErrorBox from './error-box'

export type DeviceSignInProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Input' | 'Link' | 'Text'>
  /** The username of whoever approved the device, '' while no one did. */
  username: string
  pending: PendingSignIn | null
  /** The page to approve the device on as the app of /dev/null, while that approval is under way. */
  approvalUrl: string | null
  /** What is typed in place of the link dev-null.sh sends back. */
  draft: string
  error: string
  /** Whether the sign-in is being started, said in place of the button. */
  isStarting: boolean
  onStart: () => Promise<unknown>
  onCancel: () => Promise<unknown>
  onForget: () => Promise<unknown>
  onDraft: (value: string) => Promise<unknown>
  onApprove: (value: string) => Promise<unknown>
}

/** How to approve the device as the app of /dev/null, whose link back no terminal receives. */
const APPROVAL_STEPS = [
  'Open the page below, sign in if asked, and approve Claude Code.',
  'dev-null.sh then sends your browser to a devnull://authorize?code=… link it cannot open: copy it, from the Location of the answer to Approve in the network tab of its developer tools if it shows it nowhere else.',
  'Paste it below within 5 minutes.',
]

/** The sign-in that approves the plugin once on dev-null.sh, with a key of its own, which /dev/null does not offer yet. */
const SIGN_IN_PROPOSAL = 'nunomaduro/dev-null.sh#585'

export default function DeviceSignIn(props: DeviceSignInProps) {
  const {
    ui,
    username,
    pending,
    approvalUrl,
    draft,
    error,
    isStarting,
    onStart,
    onCancel,
    onForget,
    onDraft,
    onApprove,
  } = props
  const { Box, Button, Input, Link, Text } = ui

  if (username !== '') {
    return (
      <Box key="device-sign-in" flexDirection="column" paddingX={1} marginTop={1} gap={1}>
        <Text>This plugin is approved on /dev/null as @{username}.</Text>
        <Text dimColor>Revoke it among the devices of your account on dev-null.sh to end it there too.</Text>
        <Box>
          <Button key="device-forget" label="Forget the approval" variant="secondary" onPress={onForget} />
        </Box>
      </Box>
    )
  }

  if (pending !== null) {
    return (
      <Box key="device-sign-in" flexDirection="column" paddingX={1} marginTop={1} gap={1}>
        <Text>Type this code on dev-null.sh to approve this plugin:</Text>
        <Box key="device-code">
          <Text weight="bold">{pending.userCode}</Text>
        </Box>
        <Box>
          <Link href={pending.verificationUriComplete} label={pending.verificationUri} />
        </Box>
        <Text dimColor>Waiting for your approval…</Text>
        <Box>
          <Button key="device-cancel" label="Cancel" variant="secondary" onPress={onCancel} />
        </Box>
      </Box>
    )
  }

  if (approvalUrl !== null) {
    return (
      <Box key="device-sign-in" flexDirection="column" paddingX={1} marginTop={1} gap={1}>
        <Text>
          /dev/null does not let a terminal sign in yet ({SIGN_IN_PROPOSAL}): approve this plugin as its app is
          approved, a stopgap until it does.
        </Text>
        <Box flexDirection="column">
          {APPROVAL_STEPS.map((step, index) => (
            <Text>
              {index + 1}. {step}
            </Text>
          ))}
        </Box>
        <Box>
          <Link href={approvalUrl} label="Approve on dev-null.sh" />
        </Box>
        <Box borderStyle="single">
          <Input
            key="device-link"
            label="Link "
            value={draft}
            placeholder="devnull://authorize?code=…"
            onInput={onDraft}
            onSubmit={onApprove}
            submitLabel="approve"
          />
        </Box>
        {error !== '' && <ErrorBox ui={ui} id="device-error" messages={[error]} />}
        <Text dimColor>The link stays in the plugin for this sign-in only, and goes to dev-null.sh only.</Text>
        <Box>
          <Button key="device-cancel" label="Cancel" variant="secondary" onPress={onCancel} />
        </Box>
      </Box>
    )
  }

  return (
    <Box key="device-sign-in" flexDirection="column" paddingX={1} marginTop={1} gap={1}>
      <Text>Approve this plugin once on dev-null.sh, with a key of its own, to read the Following log as you:</Text>
      {isStarting ? (
        <Box key="device-starting">
          <Text dimColor>Starting…</Text>
        </Box>
      ) : (
        <Box>
          <Button key="device-start" label="Sign in with dev-null.sh" onPress={onStart} />
        </Box>
      )}
      {error !== '' && <ErrorBox ui={ui} id="device-error" messages={[error]} />}
    </Box>
  )
}
