import { SHORTCODES as EMOJI } from './emoji-shortcodes'

const SHORTCODE = new RegExp(
  `:(${Object.keys(EMOJI)
    .sort((a, b) => b.length - a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')}):`,
  'g',
)

/** `text` with each `:shortcode:` drawn as the emoji it names, as /dev/null draws it. */
export function emojify(text: string): string {
  return text.replace(SHORTCODE, (shortcode, name: string) => EMOJI[name] ?? shortcode)
}
