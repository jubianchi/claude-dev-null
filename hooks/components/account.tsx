import type { Elements } from 'claude-code'

import CookieWarning from './cookie-warning'

export type AccountProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Input' | 'Link' | 'Text'>
  /** The username of the person signed in, '' when no one is. */
  username: string
  draft: string
  error: string
  onDraft: (value: string) => Promise<unknown>
  onSignIn: (value: string) => Promise<unknown>
  onSignOut: () => Promise<unknown>
}

const STEPS = [
  'Sign in on https://dev-null.sh, in your browser.',
  'Open its developer tools, then the cookies of https://dev-null.sh (Application in Chrome, Storage in Firefox and Safari).',
  'Copy the cookie whose name starts with remember_web_, and paste it below as name=value.',
]

export default function Account(props: AccountProps) {
  const { ui, username, draft, error, onDraft, onSignIn, onSignOut } = props
  const { Box, Button, Input, Link, Text } = ui

  if (username !== '') {
    return (
      <Box key="account-body" flexDirection="column" paddingX={1} marginTop={1} gap={1}>
        <Text>Signed in to /dev/null as @{username}.</Text>
        <Text dimColor>Signing out on dev-null.sh ends the cookie too.</Text>
        <Box>
          <Button key="sign-out" label="Forget the cookie" variant="secondary" onPress={onSignOut} />
        </Box>
        <CookieWarning ui={ui} />
      </Box>
    )
  }

  return (
    <Box key="account-body" flexDirection="column" paddingX={1} marginTop={1}>
      <Box marginBottom={1}>
        <CookieWarning ui={ui} />
      </Box>
      <Text>Sign in to see the Following log, with the cookie /dev/null signs you in with:</Text>
      <Box flexDirection="column" marginY={1}>
        {STEPS.map((step, index) => (
          <Text>
            {index + 1}. {step}
          </Text>
        ))}
      </Box>
      <Box marginBottom={1}>
        <Link href="https://dev-null.sh" label="Open dev-null.sh" />
      </Box>
      <Box borderStyle="single">
        <Input
          key="cookie"
          label="Cookie "
          value={draft}
          placeholder="remember_web_…=…"
          onInput={onDraft}
          onSubmit={onSignIn}
          submitLabel="sign in"
        />
      </Box>
      {error !== '' && (
        <Box key="account-error">
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Text dimColor>It stays on this machine, in the plugin's store, and goes to dev-null.sh only.</Text>
    </Box>
  )
}
