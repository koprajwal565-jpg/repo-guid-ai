export class ApiError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const configuredApi = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL?.replace(/\/+$/, '') ?? ''
    response = await fetch(`${configuredApi}${path.startsWith('/api') ? path : `/api${path}`}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('Could not reach RepoGuideAI. Check that the API server is running.', 0)
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(result.error?.message ?? 'The request could not be completed.', response.status, result.error?.code)
  }
  return result as T
}

export interface Repository {
  id: number
  name: string
  full_name: string
  owner: string
  description: string | null
  html_url: string
  default_branch: string
  license: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  updated_at: string
  topics: string[]
  archived: boolean
}

export interface Entry {
  name: string
  path: string
  type: 'file' | 'dir' | string
  size: number
  url: string
}

export interface Analysis {
  repository: Repository
  languages: Record<string, number>
  entries: Entry[]
  readme: { name: string; path: string; content: string } | null
}

export interface Issue {
  number: number
  title: string
  html_url: string
  body: string
  state: string
  comments: number
  created_at: string
  labels: string[]
  difficulty: string
  beginner: boolean
  documentation: boolean
}

export interface IssuePage {
  issues: Issue[]
  page: number
  hasMore: boolean
}
