import { describe, expect, test } from 'claude-code/testing'

import { forgeLabel } from '../hooks/forge'

describe('a link to GitHub, as GitHub writes it', () => {
  test('names a profile or an organization', () => {
    expect(forgeLabel('https://github.com/nunomaduro')).toBe('nunomaduro')
    expect(forgeLabel('https://github.com/orgs/laravel')).toBe('laravel')
  })

  test('names a repository, an issue, a pull request or a discussion', () => {
    expect(forgeLabel('https://github.com/nunomaduro/dev-null.sh')).toBe('nunomaduro/dev-null.sh')
    expect(forgeLabel('https://www.github.com/a/b/issues/12')).toBe('a/b#12')
    expect(forgeLabel('https://github.com/a/b/pull/7')).toBe('a/b#7')
    expect(forgeLabel('https://github.com/a/b/discussions/3')).toBe('a/b#3')
  })

  test('names a comment or a review of theirs', () => {
    expect(forgeLabel('https://github.com/a/b/issues/12#issuecomment-5')).toBe('a/b#12 (comment)')
    expect(forgeLabel('https://github.com/a/b/pull/7#discussion_r9')).toBe('a/b#7 (comment)')
    expect(forgeLabel('https://github.com/a/b/pull/7#pullrequestreview-3')).toBe('a/b#7 (review)')
    expect(forgeLabel('https://github.com/a/b/discussions/3#discussioncomment-4')).toBe('a/b#3 (comment)')
    expect(forgeLabel('https://github.com/a/b/issues/12#pullrequestreview-3')).toBeNull()
  })

  test('names a commit, a release or a comparison, a commit shortened to seven characters', () => {
    expect(forgeLabel('https://github.com/a/b/commit/4fa008f0c2b8e1d7a9b3c4d5e6f708192a3b4c5d')).toBe('a/b@4fa008f')
    expect(forgeLabel('https://github.com/a/b/releases/tag/v1.2.0')).toBe('a/b@v1.2.0')
    expect(forgeLabel('https://github.com/a/b/compare/v1.0...v1.1')).toBe('a/b@v1.0...v1.1')
    expect(forgeLabel('https://github.com/a/b/compare/main..4fa008f0c2b8')).toBe('a/b@main..4fa008f')
  })

  test('names a file by its last name, maybe some of its lines, or a folder', () => {
    expect(forgeLabel('https://github.com/a/b/blob/main/src/The%20Algorithm.php')).toBe('a/b:The Algorithm.php')
    expect(forgeLabel('https://github.com/a/b/blob/main/README.md#L10')).toBe('a/b:README.md:10')
    expect(forgeLabel('https://github.com/a/b/blob/main/README.md#L10-L20')).toBe('a/b:README.md:10-20')
    expect(forgeLabel('https://github.com/a/b/tree/main/app/Services')).toBe('a/b:Services/')
    expect(forgeLabel('https://github.com/a/b/tree/main/app#L1')).toBeNull()
  })

  test('leaves the pages of GitHub itself, and what it does not know, to a plain link', () => {
    expect(forgeLabel('https://github.com/features/actions')).toBeNull()
    expect(forgeLabel('https://github.com/a/b/actions')).toBeNull()
    expect(forgeLabel('https://github.com/a/b?tab=readme')).toBeNull()
    expect(forgeLabel('https://github.com/a/b#readme')).toBeNull()
    expect(forgeLabel('https://github.com/a/b/issues/constructor')).toBeNull()
    expect(forgeLabel('https://example.com/a/b')).toBeNull()
  })
})

describe('a link to GitLab or Codeberg, as its forge writes it', () => {
  test('names a repository, an issue, and a merge or pull request', () => {
    expect(forgeLabel('https://gitlab.com/gitlab-org/gitlab')).toBe('gitlab-org/gitlab')
    expect(forgeLabel('https://gitlab.com/a.b/c/-/issues/2')).toBe('a.b/c#2')
    expect(forgeLabel('https://gitlab.com/a/b/-/merge_requests/4')).toBe('a/b!4')
    expect(forgeLabel('https://codeberg.org/forgejo/forgejo/issues/5')).toBe('forgejo/forgejo#5')
    expect(forgeLabel('https://codeberg.org/forgejo/forgejo/pulls/6')).toBe('forgejo/forgejo#6')
  })

  test('leaves their own pages, and a project of a subgroup, to a plain link', () => {
    expect(forgeLabel('https://gitlab.com/explore/projects')).toBeNull()
    expect(forgeLabel('https://gitlab.com/group/subgroup/project')).toBeNull()
    expect(forgeLabel('https://codeberg.org/explore/repos')).toBeNull()
    expect(forgeLabel('https://gitlab.com/a')).toBeNull()
  })
})
