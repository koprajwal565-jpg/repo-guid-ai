export function parseGitHubRepositoryUrl(input) {
  if (typeof input !== 'string' || input.length > 500) {
    throw new Error('Enter a valid public GitHub repository URL.')
  }

  let url
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Enter a valid public GitHub repository URL.')
  }

  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.hostname.toLowerCase() !== 'github.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Only repository URLs hosted on github.com are supported.')
  }

  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 2) {
    throw new Error('Use a repository URL in the format github.com/owner/repository.')
  }

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
    repo === '.' ||
    repo === '..'
  ) {
    throw new Error('The GitHub owner or repository name is invalid.')
  }

  return { owner, repo }
}
