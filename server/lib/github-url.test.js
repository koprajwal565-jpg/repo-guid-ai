import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGitHubRepositoryUrl } from './github-url.js'

test('parses HTTPS and .git GitHub repository URLs', () => {
  assert.deepEqual(parseGitHubRepositoryUrl('https://github.com/facebook/react'), {
    owner: 'facebook',
    repo: 'react',
  })
  assert.deepEqual(parseGitHubRepositoryUrl('https://github.com/org/repo.git/'), {
    owner: 'org',
    repo: 'repo',
  })
})

test('rejects non-GitHub hosts and non-repository paths', () => {
  assert.throws(() => parseGitHubRepositoryUrl('https://example.com/a/b'), /github.com/)
  assert.throws(() => parseGitHubRepositoryUrl('https://github.com/a/b/issues'), /format/)
  assert.throws(() => parseGitHubRepositoryUrl('https://github.com/a/b?x=1'), /github.com/)
})

test('rejects credentials and malformed repository names', () => {
  assert.throws(() => parseGitHubRepositoryUrl('https://user@github.com/a/b'), /github.com/)
  assert.throws(() => parseGitHubRepositoryUrl('https://github.com/../repo'), /format|invalid/)
})
