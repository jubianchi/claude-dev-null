import type { Elements } from 'claude-code'

import type { PendingSignIn } from '../../types'
import ErrorBox from './error-box'

export type DeviceSignInProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Link' | 'Text'>
  /** The username of whoever approved the device, '' while no one did. */
  username: string
  pending: PendingSignIn | null
  error: string
  /** Whether the sign-in is being started, said in place of the button. */
  isStarting: boolean
  onStart: () => Promise<unknown>
  onCancel: () => Promise<unknown>
  onForget: () => Promise<unknown>
}

/** The sign-in that approves the plugin once on dev-null.sh, with a key of its own, which /dev/null does not offer yet. */
const SIGN_IN_PROPOSAL = 'nunomaduro/dev-null.sh#585'

export default function DeviceSignIn(props: DeviceSignInProps) {
  const { ui, username, pending, error, isStarting, onStart, onCancel, onForget } = props
  const { Box, Button, Link, Text } = ui

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

  return (
    <Box key="device-sign-in" flexDirection="column" paddingX={1} marginTop={1} gap={1}>
      <Text>Or approve this plugin once on dev-null.sh, with a key of its own, once /dev/null offers it:</Text>
      <Text dimColor>{SIGN_IN_PROPOSAL}</Text>
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
