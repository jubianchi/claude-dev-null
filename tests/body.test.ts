import { describe, expect, test } from 'claude-code/testing'

import { drawn, inline, shortenUrl, shownText } from '../hooks/body'

describe('finding the links of a text', () => {
  test('finds a link with its scheme, and a bare domain', () => {
    expect(inline('See https://github.com/nunomaduro and nativephp.com!')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', text: 'github.com/nunomaduro', href: 'https://github.com/nunomaduro' },
      { type: 'text', text: ' and ' },
      { type: 'link', text: 'nativephp.com', href: 'https://nativephp.com' },
      { type: 'text', text: '!' },
    ])
  })

  test('leaves out the punctuation after a link, and an unmatched bracket', () => {
    expect(inline('(see https://example.com/a_(b)).')).toEqual([
      { type: 'text', text: '(see ' },
      { type: 'link', text: 'example.com/a_(b)', href: 'https://example.com/a_(b)' },
      { type: 'text', text: ').' },
    ])
  })

  test('does not take a file or a property for a domain', () => {
    expect(inline('Open app.php, read user.name and run deploy.sh')).toEqual([
      { type: 'text', text: 'Open app.php, read user.name and run deploy.sh' },
    ])
  })

  test('shows a long link without its scheme, www and the end of its path', () => {
    expect(shortenUrl('https://www.example.com/a/very/long/path/that/goes/on')).toBe('example.com/a/very/long/path/t…')
    expect(shortenUrl('http://example.com/short')).toBe('example.com/short')
  })
})

describe('finding the commits a text links to', () => {
  test('shows a link to a commit of /dev/null as its author and short hash', () => {
    const url = 'https://dev-null.sh/@mstfydmr/commits/01a149ee-996a-7064-9809-00953cff3d89'

    expect(inline(`29% on Codex (${url}), let's do it!`)).toEqual([
      { type: 'text', text: '29% on Codex (' },
      { type: 'commit', text: 'mstfydmr/cff3d89', href: url },
      { type: 'text', text: "), let's do it!" },
    ])
  })

  test('leaves out an ellipsis and the curly quotes after a link, as /dev/null does', () => {
    expect(inline('“see https://example.com/a…” and ‘example.org’')).toEqual([
      { type: 'text', text: '“see ' },
      { type: 'link', text: 'example.com/a', href: 'https://example.com/a' },
      { type: 'text', text: '…” and ‘' },
      { type: 'link', text: 'example.org', href: 'https://example.org' },
      { type: 'text', text: '’' },
    ])
  })

  test('takes no link with its scheme right after a letter or a digit, of any script', () => {
    expect(inline('éhttps://example.com and 1https://example.org')).toEqual([
      { type: 'text', text: 'éhttps://example.com and 1https://example.org' },
    ])
  })

  test('shows the hash of a commit linked in capitals as /dev/null does, in small letters', () => {
    const url = 'https://dev-null.sh/@mstfydmr/commits/01A149EE-996A-7064-9809-00953CFF3D89'

    expect(inline(url)).toEqual([{ type: 'commit', text: 'mstfydmr/cff3d89', href: url }])
  })

  test('keeps a link to anything else of /dev/null a link', () => {
    expect(inline('https://dev-null.sh/@mstfydmr')).toEqual([
      { type: 'link', text: 'dev-null.sh/@mstfydmr', href: 'https://dev-null.sh/@mstfydmr' },
    ])
  })
})

describe('finding the mentions of a text', () => {
  test('finds a GitHub username after an @', () => {
    expect(inline('lets see what @brendt and @paulinevos think')).toEqual([
      { type: 'text', text: 'lets see what ' },
      { type: 'mention', text: '@brendt', href: 'https://dev-null.sh/@brendt' },
      { type: 'text', text: ' and ' },
      { type: 'mention', text: '@paulinevos', href: 'https://dev-null.sh/@paulinevos' },
      { type: 'text', text: ' think' },
    ])
  })

  test('does not take an email, a package or a domain for a mention', () => {
    expect(inline('mail me@example.org, add @inertiajs/react, try @vue.js')).toEqual([
      { type: 'text', text: 'mail me@example.org, add @inertiajs/react, try @vue.js' },
    ])
  })
})

describe('finding /dev/null in a text', () => {
  test('finds /dev/null on its own', () => {
    expect(inline("You'll always have /dev/null at hand!")).toEqual([
      { type: 'text', text: "You'll always have " },
      { type: 'wordmark', text: '/dev/null' },
      { type: 'text', text: ' at hand!' },
    ])
  })

  test('leaves a path alone', () => {
    expect(inline('> /dev/nullable and src/dev/null and /dev/null/x')).toEqual([
      { type: 'text', text: '> /dev/nullable and src/dev/null and /dev/null/x' },
    ])
  })

  test('finds nothing in an empty text', () => {
    expect(inline('')).toEqual([])
  })
})

describe('drawing the text and code of a commit', () => {
  const text = (value: string) => ({ type: 'text' as const, text: value })

  test('keeps what the author wrote as written', () => {
    expect(drawn([text("y'all *b* #d [e](f) \\i: 1. j!")])).toEqual([
      { type: 'text', text: "y'all *b* #d [e](f) \\i: 1. j!" },
    ])
  })

  test('leaves out the lines it starts or ends with, next to a block of code', () => {
    expect(drawn([text('\nrunning this:\n')])).toEqual([{ type: 'text', text: 'running this:' }])
    expect(shownText([text('\nrunning this:\n')])).toBe('running this:')
  })

  test('links its links, the commits it links to and the people it mentions, and finds /dev/null', () => {
    const url = 'https://dev-null.sh/@mstfydmr/commits/01a149ee-996a-7064-9809-00953cff3d89'

    expect(drawn([text(`See ${url} with @brendt on /dev/null`)])).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'commit', text: 'mstfydmr/cff3d89', href: url },
      { type: 'text', text: ' with ' },
      { type: 'mention', text: '@brendt', href: 'https://dev-null.sh/@brendt' },
      { type: 'text', text: ' on ' },
      { type: 'wordmark', text: '/dev/null' },
    ])
  })

  test('draws the emoji its shortcodes name, as /dev/null does', () => {
    expect(drawn([text('ok :+1: :smile::tada: :not_an_emoji:')])).toEqual([
      { type: 'text', text: 'ok 👍 😄🎉 :not_an_emoji:' },
    ])
    expect(shownText([text(':+1:')])).toBe('👍')
  })

  test('draws its code as code, its shortcodes left alone', () => {
    expect(drawn([text('run '), { type: 'code', code: ':+1:' }, text(' now')])).toEqual([
      { type: 'text', text: 'run ' },
      { type: 'code', text: ':+1:' },
      { type: 'text', text: ' now' },
    ])
  })

  test('says what it shows, to measure it', () => {
    const url = 'https://dev-null.sh/@mstfydmr/commits/01a149ee-996a-7064-9809-00953cff3d89'

    expect(shownText([text(`See ${url} on /dev/null `), { type: 'code', code: 'ls' }])).toBe(
      'See mstfydmr/cff3d89 on /dev/null ls',
    )
  })
})
