import test from 'node:test'
import assert from 'node:assert/strict'
import { getIssues, getRepository } from './github.js'

const previousFetch = globalThis.fetch

test.afterEach(() => {
  globalThis.fetch = previousFetch
})

test('retrieves repository metadata, languages, root entries, and README from GitHub', async () => {
  globalThis.fetch = async (url) => {
    const endpoint = String(url)
    if (endpoint.endsWith('/languages')) return Response.json({ TypeScript: 1200 })
    if (endpoint.endsWith('/contents')) return Response.json([{ name: 'src', path: 'src', type: 'dir', size: 0, html_url: 'https://github.com/a/b/tree/main/src' }])
    if (endpoint.endsWith('/readme')) return Response.json({ name: 'README.md', path: 'README.md', encoding: 'base64', content: Buffer.from('# Hello').toString('base64') })
    return Response.json({
      id: 123,
      name: 'b',
      full_name: 'a/b',
      owner: { login: 'a' },
      description: 'A real test project',
      html_url: 'https://github.com/a/b',
      default_branch: 'main',
      license: { spdx_id: 'MIT' },
      stargazers_count: 8,
      forks_count: 2,
      open_issues_count: 3,
      updated_at: '2026-01-01T00:00:00Z',
      topics: [],
      archived: false,
    })
  }
  const result = await getRepository('a', 'b')
  assert.equal(result.repository.full_name, 'a/b')
  assert.equal(result.repository.license, 'MIT')
  assert.deepEqual(result.languages, { TypeScript: 1200 })
  assert.equal(result.entries[0].path, 'src')
  assert.equal(result.readme.content, '# Hello')
})

test('returns only genuine issues and indicates more GitHub pages', async () => {
  const returned = Array.from({ length: 31 }, (_, index) => ({
    number: index + 1,
    title: `Issue ${index + 1}`,
    html_url: `https://github.com/a/b/issues/${index + 1}`,
    body: '',
    state: 'open',
    comments: 0,
    created_at: '2026-01-01T00:00:00Z',
    labels: [{ name: index === 0 ? 'good first issue' : 'bug' }],
    ...(index === 1 ? { pull_request: { url: 'https://api.github.com/pulls/2' } } : {}),
  }))
  globalThis.fetch = async () => Response.json(returned)
  const page = await getIssues('a', 'b', 1)
  assert.equal(page.page, 1)
  assert.equal(page.hasMore, true)
  assert.equal(page.issues.length, 29)
  assert.equal(page.issues[0].beginner, true)
  assert.equal(page.issues.some((issue) => issue.number === 2), false)
})

test('translates GitHub rate-limit responses into a readable API error', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-reset': '0' } })
  await assert.rejects(() => getRepository('a', 'b'), (error) => error.status === 429 && /rate limit/i.test(error.message))
})

test('translates GitHub not-found responses', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 404 })
  await assert.rejects(() => getRepository('a', 'b'), (error) => error.status === 404 && /not found/i.test(error.message))
})
