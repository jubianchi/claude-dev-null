import type { Elements } from 'claude-code'

export type LinkProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Link' | 'Text'>
  href: string
  label: string
  /** The color its words are drawn in, the primary of /dev/null for a link; muted when not given, as a handle or a hash. */
  color?: string
}

/**
 * A link as /dev/null draws it, its words in a color of their own, which a hyperlink of the terminal does not give
 * them: the primary of its theme, or muted.
 */
export default function Link(props: LinkProps) {
  const { ui, href, label, color } = props
  const { Link: Hyperlink, Text } = ui

  return (
    <Hyperlink href={href}>
      {color === undefined ? <Text dimColor>{label}</Text> : <Text color={color}>{label}</Text>}
    </Hyperlink>
  )
}
