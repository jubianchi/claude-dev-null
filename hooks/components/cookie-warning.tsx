import type { Elements } from 'claude-code'

export type CookieWarningProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Link' | 'Text'>
}

/** The pull request that lets an app sign in to /dev/null with a key of its own, approved once on the site. */
const SIGN_IN_PROPOSAL = 'https://github.com/nunomaduro/dev-null.sh/pull/130'

/**
 * That signing in with the cookie is a stopgap: /dev/null does not let an app sign in yet, and the cookie gives
 * whoever holds it the account.
 */
export default function CookieWarning(props: CookieWarningProps) {
  const { Box, Link, Text } = props.ui

  return (
    <Box
      key="cookie-warning"
      flexDirection="column"
      borderStyle="round"
      borderColor="warning"
      paddingY={1}
      paddingX={2}
      gap={1}
    >
      <Text color="warning" weight="bold">
        ⚠️ A stopgap
      </Text>
      <Text color="warning">
        /dev/null does not let an app sign in yet, so the plugin reads Following with the cookie your browser signs in
        with. Whoever holds it holds your account until you sign out on dev-null.sh: keep it to yourself.
      </Text>
      <Text dimColor>
        A sign-in that approves this plugin once, with a key of its own, is on its way:{' '}
        <Link href={SIGN_IN_PROPOSAL} label={SIGN_IN_PROPOSAL} />
      </Text>
    </Box>
  )
}
