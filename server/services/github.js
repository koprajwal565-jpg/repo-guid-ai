import { HttpError } from '../lib/errors.js'
import { parseGitHubRepositoryUrl } from '../lib/github-url.js'

const API = 'https://api.github.com'
const MAX_TEXT_BYTES = 250_000

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RepoGuideAI',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  }
}

async function githubFetch(path) {
  let response
  try {
    response = await fetch(`${API}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(12_000),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new HttpError(504, 'GitHub took too long to respond. Please try again.', 'GITHUB_TIMEOUT')
    }
    throw new HttpError(502, 'Could not reach GitHub. Check your connection and try again.', 'GITHUB_UNAVAILABLE')
  }

  if (response.status === 404) throw new HttpError(404, 'Repository or file not found. It may be private or unavailable.')
  if (response.status === 403 || response.status === 429) {
    const reset = response.headers.get('x-ratelimit-reset')
    const resetText = reset ? ` Try again after ${new Date(Number(reset) * 1000).toLocaleTimeString()}.` : ''
    throw new HttpError(429, `GitHub API rate limit reached.${resetText}`, 'GITHUB_RATE_LIMIT')
  }
  if (!response.ok) {
    throw new HttpError(502, `GitHub returned an error (${response.status}). Please try again.`, 'GITHUB_ERROR')
  }
  return response.json()
}

function decodeContent(content, encoding) {
  if (!content || encoding !== 'base64') return ''
  return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8')
}

function safeText(text) {
  return Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES
    ? `${Buffer.from(text, 'utf8').subarray(0, MAX_TEXT_BYTES).toString('utf8')}\n\n[File excerpt truncated at 250 KB.]`
    : text
}

export async function getRepository(owner, repo) {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const [repository, languages, root, readme] = await Promise.all([
    githubFetch(path),
    githubFetch(`${path}/languages`).catch(() => ({})),
    githubFetch(`${path}/contents`).catch(() => []),
    githubFetch(`${path}/readme`).catch((error) => {
      if (error.status === 404) return null
      throw error
    }),
  ])

  const entries = Array.isArray(root)
    ? root.map(({ name, path: filePath, type, size, html_url }) => ({ name, path: filePath, type, size, url: html_url }))
    : []

  return {
    repository: {
      id: repository.id,
      name: repository.name,
      full_name: repository.full_name,
      owner: repository.owner.login,
      description: repository.description,
      html_url: repository.html_url,
      default_branch: repository.default_branch,
      license: repository.license?.spdx_id ?? null,
      stargazers_count: repository.stargazers_count,
      forks_count: repository.forks_count,
      open_issues_count: repository.open_issues_count,
      updated_at: repository.updated_at,
      topics: repository.topics ?? [],
      archived: repository.archived,
    },
    languages,
    entries,
    readme: readme
      ? { name: readme.name, path: readme.path, content: safeText(decodeContent(readme.content, readme.encoding)) }
      : null,
  }
}

export async function analyzeRepository(url) {
  const { owner, repo } = parseGitHubRepositoryUrl(url)
  const analysis = await getRepository(owner, repo)
  return analysis
}

export async function getTree(owner, repo, path = '') {
  const cleanPath = path.split('/').filter(Boolean).map((part) => {
    if (part === '.' || part === '..' || /[?#]/.test(part)) {
      throw new HttpError(400, 'Invalid repository path.')
    }
    return encodeURIComponent(part)
  }).join('/')
  const result = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${cleanPath ? `/${cleanPath}` : ''}`)
  if (!Array.isArray(result)) throw new HttpError(400, 'The requested path is a file, not a folder.')
  return result.map(({ name, path: itemPath, type, size, html_url }) => ({
    name,
    path: itemPath,
    type,
    size,
    url: html_url,
  }))
}

export async function getFile(owner, repo, filePath) {
  if (typeof filePath !== 'string' || !filePath.trim() || filePath.length > 500) {
    throw new HttpError(400, 'Choose a valid repository file.')
  }
  const parts = filePath.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..' || /[?#]/.test(part))) {
    throw new HttpError(400, 'Invalid repository file path.')
  }
  const encoded = parts.map(encodeURIComponent).join('/')
  const file = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encoded}`)
  if (file.type !== 'file') throw new HttpError(400, 'Choose a file, not a folder.')
  if (file.size > MAX_TEXT_BYTES) throw new HttpError(413, 'This file is too large to preview (250 KB maximum).')
  if (file.encoding !== 'base64') throw new HttpError(415, 'This file format cannot be previewed as text.')
  const content = decodeContent(file.content, file.encoding)
  if (content.includes('\u0000')) throw new HttpError(415, 'Binary files cannot be previewed.')
  return {
    name: file.name,
    path: file.path,
    size: file.size,
    url: file.html_url,
    content: safeText(content),
  }
}

export async function getIssues(owner, repo, page = 1) {
  const requestedPage = Number.isInteger(page) && page > 0 && page <= 100 ? page : 1
  const results = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=31&page=${requestedPage}&sort=created&direction=desc`)
  const hasMore = results.length > 30
  const issues = results.slice(0, 30).filter((issue) => !issue.pull_request).map((issue) => {
    const labelNames = issue.labels.map((label) => label.name)
    const beginner = labelNames.some((label) => /good first issue|beginner|easy|help wanted/i.test(label))
    const documentation = labelNames.some((label) => /documentation|docs/i.test(label))
    return {
      number: issue.number,
      title: issue.title,
      html_url: issue.html_url,
      body: (issue.body ?? '').slice(0, 5000),
      state: issue.state,
      comments: issue.comments,
      created_at: issue.created_at,
      labels: labelNames,
      difficulty: beginner || documentation ? 'Beginner (estimate)' : 'Unassessed',
      beginner,
      documentation,
    }
  })
  return { issues, page: requestedPage, hasMore }
}

export { parseGitHubRepositoryUrl }
