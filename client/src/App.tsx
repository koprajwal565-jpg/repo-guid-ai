import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  ArrowDown, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight,
  Code2, ExternalLink, FileCode2, GitBranch, Github, GitPullRequest, LoaderCircle,
  LockKeyhole, Menu, MessageSquareText, Moon, Search, Send, ShieldCheck, Sparkles,
  Star, Sun, Terminal, X, Zap,
} from 'lucide-react'
import { api, ApiError } from './api'
import type { Analysis, Entry, Issue, IssuePage } from './api'
import { useAuth } from './auth'
import type { User } from './auth'

type Tab = 'overview' | 'codebase' | 'issues' | 'assistant' | 'plan'

function Brand({ onClick }: { onClick?: () => void }) {
  return <Link to="/" className="brand" onClick={onClick} aria-label="RepoGuideAI home">
    <span className="brand-mark"><GitBranch size={17} strokeWidth={1.8} /></span>
    <span>repo<span className="brand-guide">guide</span><span className="brand-ai">ai</span></span>
  </Link>
}

function Header() {
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('rg-theme') === 'dark')
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('rg-theme', dark ? 'dark' : 'light')
  }, [dark])

  async function handleSignOut() {
    await signOut()
    navigate('/')
    setOpen(false)
  }

  return <header className="site-header">
    <div className="nav-inner">
      <Brand onClick={() => setOpen(false)} />
      <button className="mobile-menu icon-button" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      <nav className={open ? 'nav-links is-open' : 'nav-links'} aria-label="Main navigation">
        <a href="/#product" onClick={() => setOpen(false)}>Product</a>
        <a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a>
        <a href="/#features" onClick={() => setOpen(false)}>Features</a>
        <a href="/#open-source" onClick={() => setOpen(false)}>Open source</a>
      </nav>
      <div className={open ? 'nav-actions is-open' : 'nav-actions'}>
        <button className="icon-button theme-toggle" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        {user
          ? <><Link className="nav-signin" to="/dashboard" onClick={() => setOpen(false)}>My dashboard</Link><button className="nav-signin signout" onClick={handleSignOut}>Sign out</button></>
          : <Link className="nav-signin" to="/signin" onClick={() => setOpen(false)}>Sign in</Link>}
        {!user && <Link className="button button-dark button-small" to="/signin?mode=register" onClick={() => setOpen(false)}>Get started <ArrowRight size={14} /></Link>}
      </div>
      <p className="stats-note">*GitHub’s open-items total includes pull requests; the Issues tab lists issues separately.</p>
    </div>
  </header>
}

function RepoForm({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    let parsed: URL
    try { parsed = new URL(url.trim()) } catch { setError('Enter a complete GitHub repository URL.'); return }
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.hostname !== 'github.com' || parts.length !== 2) {
      setError('Use a public repository URL, such as https://github.com/owner/repository.')
      return
    }
    setLoading(true)
    try {
      const result = await api<Analysis>('/repositories/analyze', { method: 'POST', body: JSON.stringify({ url: url.trim() }) })
      navigate(`/analyze/${encodeURIComponent(result.repository.owner)}/${encodeURIComponent(result.repository.name)}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Repository analysis failed.')
    } finally { setLoading(false) }
  }

  return <form className={compact ? 'repo-form repo-form-compact' : 'repo-form'} onSubmit={submit} noValidate>
    <label className="sr-only" htmlFor={compact ? 'repo-url-small' : 'repo-url'}>GitHub repository URL</label>
    <Github className="repo-form-icon" size={19} />
    <input id={compact ? 'repo-url-small' : 'repo-url'} type="url" value={url} onChange={(event) => { setUrl(event.target.value); setError('') }} placeholder="https://github.com/owner/repository" aria-describedby={error ? 'repo-error' : undefined} aria-invalid={Boolean(error)} disabled={loading} />
    <button className="button button-dark repo-submit" type="submit" disabled={loading || !url.trim()}>{loading ? <><LoaderCircle className="spin" size={16} /> Analyzing</> : <>Analyze repository <ArrowRight size={15} /></>}</button>
    {error && <p className="form-error" id="repo-error" role="alert">{error}</p>}
  </form>
}

function Landing() {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR OPEN-SOURCE COPILOT</div>
        <h1>Open source.<br /><span>Without the</span><br />guesswork.</h1>
        <p className="hero-description">Understand any repository. Find your first issue. Make your next contribution with AI.</p>
        <RepoForm />
        <div className="hero-note"><ShieldCheck size={15} /> Public repositories. No account needed to explore.</div>
      </div>
      <div className="hero-visual" aria-label="Illustrative repository workspace preview">
        <div className="preview-topbar"><span className="preview-dots"><i /><i /><i /></span><span>REPOSITORY WORKSPACE</span><span className="preview-live"><span /> LIVE DATA</span></div>
        <div className="preview-repo"><div className="preview-avatar"><Github size={20} /></div><div><span className="preview-caption">YOUR NEXT CONTRIBUTION STARTS HERE</span><h2>Repository, understood.</h2><p>Structure, issues, and next steps — in one place.</p></div></div>
        <div className="preview-divider" />
        <div className="preview-grid">
          <div className="preview-tree"><span className="preview-label">PROJECT FILES</span><div className="tree-row tree-active"><ChevronDown size={13} /> <span className="folder-dot" /> src</div><div className="tree-row tree-child"><FileCode2 size={13} /> app.tsx</div><div className="tree-row tree-child"><FileCode2 size={13} /> index.ts</div><div className="tree-row"><ChevronRight size={13} /> <span className="folder-dot" /> tests</div><div className="tree-row"><BookOpen size={13} /> README.md</div></div>
          <div className="preview-insight"><span className="preview-label"><Sparkles size={12} /> REPOGUIDE INSIGHT</span><p>Start with the README, then trace the app entry point. A good first step is understanding how the project is organized.</p><span className="preview-link">Explore your repository <ArrowRight size={13} /></span></div>
        </div>
        <div className="preview-footer"><span><span className="live-dot" /> CONNECTED TO GITHUB</span><span>Repository facts, not guesses.</span></div>
      </div>
      <span className="hero-index">01 / START HERE</span>
    </section>

    <section className="trust-strip"><span>BUILT FOR YOUR FIRST CONTRIBUTION</span><div><span><Code2 size={15} /> Real codebase context</span><span><GitPullRequest size={15} /> Actionable next steps</span><span><ShieldCheck size={15} /> Grounded in GitHub data</span></div></section>
    <section className="section how-section" id="how-it-works">
      <div className="section-intro"><div className="eyebrow">A CLEARER WAY IN</div><h2>From curious to<br /><em>contributor.</em></h2></div>
      <div className="steps-grid">
        {[['01', 'Bring a repository', 'Paste any public GitHub URL. We retrieve its actual README, languages, files, and open issues.'], ['02', 'Get oriented', 'Explore the structure, understand how the project fits together, and ask questions grounded in its code.'], ['03', 'Make a contribution', 'Choose an issue and follow a practical roadmap, from local setup through your first pull request.']].map(([n, title, text]) => <article className="step-card" key={n}><span className="step-number">{n}</span><h3>{title}</h3><p>{text}</p><ArrowDown size={18} className="step-arrow" /></article>)}
      </div>
    </section>
    <section className="feature-band" id="product"><div><span className="eyebrow">THE WORKSPACE</span><h2>Everything you need<br />to make sense of<br /><em>what's next.</em></h2><p>Less time lost to unfamiliar folders. More confidence in your first meaningful change.</p><Link className="text-link" to="/#analyze">Try a repository <ArrowRight size={15} /></Link></div><div className="feature-list" id="features">
      {[[<Code2 size={19} />, 'A codebase you can navigate', 'Browse real files and inspect source without leaving your workspace.'], [<MessageSquareText size={19} />, 'An assistant with context', 'Ask about the repository. Answers use retrieved project details, not made-up facts.'], [<Zap size={19} />, 'A path that fits you', 'Turn your experience and interests into a practical contribution plan.']].map(([icon, title, text]) => <div className="feature-row" key={String(title)}><span className="feature-icon">{icon}</span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={16} /></div>)}
    </div></section>
    <section className="cta-section" id="open-source"><div className="eyebrow">YOUR NEXT STEP IS SMALLER THAN YOU THINK</div><h2>Start with a repo.<br /><em>Find your way in.</em></h2><div className="cta-form" id="analyze"><RepoForm compact /></div><span className="cta-footnote">Read-only public GitHub data. Your first analysis is free.</span></section>
    <Footer />
  </>
}

function Footer() {
  return <footer className="site-footer"><Brand /><span className="footer-copy">Open source, without the guesswork.</span><div className="footer-links"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ExternalLink size={12} /></a></div><span className="copyright">© {new Date().getFullYear()} RepoGuideAI</span></footer>
}

function LoadingPage({ label = 'Retrieving repository information' }: { label?: string }) {
  return <main className="loading-page"><LoaderCircle className="spin" size={23} /><span>{label}…</span></main>
}

function PageError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-panel"><span className="error-mark">!</span><div><h3>We couldn't load this.</h3><p>{message}</p>{retry && <button className="button button-outline button-small" onClick={retry}>Try again <ArrowRight size={14} /></button>}</div></div>
}

function RepositoryPage() {
  const { owner = '', repo = '' } = useParams()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [issuePage, setIssuePage] = useState(1)
  const [hasMoreIssues, setHasMoreIssues] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedIssue, setSelectedIssue] = useState<number | undefined>()
  const { user } = useAuth()

  const loadRepository = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api<Analysis>('/repositories/analyze', { method: 'POST', body: JSON.stringify({ url: `https://github.com/${owner}/${repo}` }) })
      setAnalysis(result)
      const issueResult = await api<IssuePage>(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`)
      setIssues(issueResult.issues)
      setIssuePage(issueResult.page)
      setHasMoreIssues(issueResult.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Repository analysis failed.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadRepository() }, [owner, repo])
  if (loading) return <LoadingPage />
  if (error || !analysis) return <><Header /><main className="dashboard-page narrow"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to home</Link><PageError message={error || 'Repository analysis is unavailable.'} retry={() => void loadRepository()} /></main><Footer /></>

  return <><Header /><main className="dashboard-page">
    <Link className="back-link" to="/"><ArrowLeft size={15} /> Analyze another repository</Link>
    <div className="repo-heading">
      <div className="repo-ident"><span className="repo-ident-icon"><Github size={22} /></span><div><div className="repo-breadcrumb">{analysis.repository.owner} <span>/</span> {analysis.repository.name}</div><h1>{analysis.repository.name}</h1></div></div>
      <a className="button button-outline button-small" href={analysis.repository.html_url} target="_blank" rel="noreferrer">View on GitHub <ExternalLink size={14} /></a>
    </div>
    <p className="repo-description">{analysis.repository.description || 'No description provided on GitHub.'}</p>
    <div className="repo-stats">
    <span><Star size={15} /> {analysis.repository.stargazers_count.toLocaleString()} stars</span><span><GitBranch size={15} /> {analysis.repository.forks_count.toLocaleString()} forks</span><span title="GitHub's open-issues count includes pull requests"><MessageSquareText size={15} /> {analysis.repository.open_issues_count.toLocaleString()} open items*</span><span><Code2 size={15} /> {analysis.repository.license || 'License not specified'}</span>
      <button className="save-repo" disabled={!user} title={user ? 'Save repository' : 'Sign in to save repositories'} onClick={async () => {
        try { await api('/users/me/repositories', { method: 'POST', body: JSON.stringify({ url: analysis.repository.html_url }) }); window.alert('Repository saved to your dashboard.') }
        catch (saveError) { window.alert(saveError instanceof Error ? saveError.message : 'Could not save repository.') }
      }}>{user ? 'Save repository' : <><LockKeyhole size={13} /> Sign in to save</>}</button>
    </div>
    <div className="analysis-layout">
      <nav className="analysis-tabs" aria-label="Repository sections">{([
        ['overview', <BookOpen size={16} />, 'Overview'],
        ['codebase', <Code2 size={16} />, 'Codebase'],
        ['issues', <GitPullRequest size={16} />, `Issues (${issues.length})`],
        ['assistant', <MessageSquareText size={16} />, 'AI assistant'],
        ['plan', <Check size={16} />, 'Contribution plan'],
      ] as [Tab, ReactNode, string][]).map(([key, icon, title]) => <button key={key} className={tab === key ? 'tab-button is-active' : 'tab-button'} onClick={() => setTab(key)}>{icon}{title}</button>)}</nav>
      <div className="analysis-content">
        {tab === 'overview' && <Overview analysis={analysis} issues={issues} changeTab={setTab} />}
        {tab === 'codebase' && <Codebase analysis={analysis} owner={owner} repo={repo} />}
        {tab === 'issues' && <IssueList issues={issues} page={issuePage} hasMore={hasMoreIssues} onPageChange={async (page) => {
          try {
            const result = await api<IssuePage>(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?page=${page}`)
            setIssues(result.issues)
            setIssuePage(result.page)
            setHasMoreIssues(result.hasMore)
          } catch (pageError) { setError(pageError instanceof Error ? pageError.message : 'Could not load issues.') }
        }} onBuildPlan={(number) => { setSelectedIssue(number); setTab('plan') }} />}
        {tab === 'assistant' && <Assistant analysis={analysis} />}
        {tab === 'plan' && <ContributionPlan analysis={analysis} issues={issues} suggestedIssue={selectedIssue} />}
      </div>
    </div>
  </main><Footer /></>
}

function Overview({ analysis, issues, changeTab }: { analysis: Analysis; issues: Issue[]; changeTab: (tab: Tab) => void }) {
  const [readmeOpen, setReadmeOpen] = useState(false)
  const languages = Object.keys(analysis.languages)
  const beginnerCount = issues.filter((issue) => issue.beginner).length
  return <div className="overview-grid">
    <div className="overview-main">
      <section className="content-card">
        <div className="card-heading"><div><span className="eyebrow">PROJECT OVERVIEW</span><h2>Get your bearings.</h2></div><span className="verified-label"><span /> FROM GITHUB</span></div>
        <p className="overview-description">{analysis.repository.description || 'This repository has no public description. Explore its README and source tree to learn more.'}</p>
        <div className="meta-grid"><Meta label="Default branch" value={analysis.repository.default_branch || 'Not reported'} /><Meta label="License" value={analysis.repository.license || 'Not specified'} /><Meta label="Last updated" value={analysis.repository.updated_at ? new Date(analysis.repository.updated_at).toLocaleDateString() : 'Not reported'} /><Meta label="Repository status" value={analysis.repository.archived ? 'Archived' : 'Active'} /></div>
      </section>
      <section className="content-card">
        <div className="card-heading"><div><span className="eyebrow">TECHNOLOGY</span><h2>Languages in this repo.</h2></div></div>
        {languages.length ? <div className="language-list">{languages.map((language) => <span className="language-pill" key={language}><i />{language}</span>)}</div> : <p className="muted-copy">GitHub has not reported language statistics for this repository.</p>}
      </section>
      <section className="content-card readme-card">
        <div className="card-heading"><div><span className="eyebrow">PROJECT DOCUMENTATION</span><h2>README</h2></div>{analysis.readme && <button className="text-button" onClick={() => setReadmeOpen(!readmeOpen)}>{readmeOpen ? 'Collapse' : 'Read project docs'} <ChevronDown size={14} /></button>}</div>
        {analysis.readme ? readmeOpen ? <div className="markdown-body"><ReactMarkdown>{analysis.readme.content}</ReactMarkdown></div> : <p className="muted-copy readme-preview">{analysis.readme.content.slice(0, 320).replace(/[#*`]/g, '') || 'README content is empty.'}</p> : <p className="muted-copy">No README was available through GitHub.</p>}
      </section>
    </div>
    <aside className="overview-side">
      <section className="side-card">
        <div className="eyebrow">YOUR WAY IN</div><h3>Make the first move.</h3><p>Browse the project structure, find an issue, or ask a question grounded in repository data.</p>
        <button className="side-action" onClick={() => changeTab('codebase')}><Code2 size={15} /> Explore the code <ArrowRight size={14} /></button>
        <button className="side-action" onClick={() => changeTab('assistant')}><Sparkles size={15} /> Ask the assistant <ArrowRight size={14} /></button>
      </section>
      <section className="side-card issue-callout"><div className="eyebrow">OPEN ISSUES · FIRST PAGE</div><div className="issue-count">{issues.length.toLocaleString()}</div><p>{beginnerCount ? `${beginnerCount} issue${beginnerCount === 1 ? '' : 's'} here have beginner-friendly labels.` : 'Review the open issues and choose a challenge that fits.'}</p><button className="text-link" onClick={() => changeTab('issues')}>Browse open issues <ArrowRight size={14} /></button></section>
      <section className="side-card"><div className="eyebrow">REPOSITORY STRUCTURE</div><div className="root-files">{analysis.entries.slice(0, 8).map((entry) => <span key={entry.path}>{entry.type === 'dir' ? <ChevronRight size={13} /> : <FileCode2 size={13} />}{entry.name}</span>)}{analysis.entries.length > 8 && <span className="muted-copy">+ {analysis.entries.length - 8} more</span>}{!analysis.entries.length && <span className="muted-copy">No public files retrieved.</span>}</div></section>
    </aside>
  </div>
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="meta-item"><span>{label}</span><strong>{value}</strong></div>
}

function Codebase({ analysis, owner, repo }: { analysis: Analysis; owner: string; repo: string }) {
  const [folders, setFolders] = useState<Record<string, Entry[]>>({})
  const [expanded, setExpanded] = useState<string[]>([])
  const [selected, setSelected] = useState<{ name: string; path: string; content: string; url: string } | null>(null)
  const [loadingPath, setLoadingPath] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [fileSearch, setFileSearch] = useState('')
  const [explanation, setExplanation] = useState('')
  const [explainError, setExplainError] = useState('')
  const [explaining, setExplaining] = useState(false)
  const root: Entry[] = analysis.entries
  const visible = useMemo(() => root.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [root, search])

  async function toggleFolder(path: string) {
    if (expanded.includes(path)) { setExpanded(expanded.filter((item) => item !== path)); return }
    if (!folders[path]) {
      setLoadingPath(path)
      try {
        const result = await api<{ entries: Entry[] }>(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree?path=${encodeURIComponent(path)}`)
        setFolders((current) => ({ ...current, [path]: result.entries }))
      } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not retrieve folder contents.') }
      finally { setLoadingPath('') }
    }
    setExpanded((current) => [...current, path])
  }

  async function openFile(entry: Entry) {
    setError('')
    setExplanation('')
    setExplainError('')
    setFileSearch('')
    setLoadingPath(entry.path)
    try {
      const file = await api<{ name: string; path: string; content: string; url: string }>(`/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file?path=${encodeURIComponent(entry.path)}`)
      setSelected(file)
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not retrieve this file.') }
    finally { setLoadingPath('') }
  }

  async function explainFile() {
    if (!selected || explaining) return
    setExplaining(true)
    setExplainError('')
    try {
      const result = await api<{ answer: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          owner,
          repo,
          filePath: selected.path,
          question: `Explain the purpose and structure of this file for a ${'beginner'} contributor. Mention only functions or classes you can verify in the retrieved file.`,
        }),
      })
      setExplanation(result.answer)
    } catch (requestError) {
      setExplainError(requestError instanceof Error ? requestError.message : 'Could not explain this file.')
    } finally { setExplaining(false) }
  }

  const fileMatches = selected && fileSearch.trim()
    ? selected.content.split(new RegExp(`(${fileSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    : null
  const matchCount = fileMatches && selected
    ? (selected.content.match(new RegExp(fileSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'))?.length ?? 0)
    : 0

  function renderEntries(entries: Entry[], depth = 0) {
    return entries.map((entry) => {
      const isOpen = expanded.includes(entry.path)
      return <div key={entry.path}>
        <button className={`file-row ${selected?.path === entry.path ? 'selected' : ''}`} style={{ paddingLeft: `${13 + depth * 15}px` }} onClick={() => entry.type === 'dir' ? void toggleFolder(entry.path) : void openFile(entry)} title={entry.path}>
          {entry.type === 'dir' ? isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <FileCode2 size={14} />}
          <span>{entry.name}</span>{loadingPath === entry.path && <LoaderCircle className="spin file-loader" size={12} />}
        </button>
        {entry.type === 'dir' && isOpen && folders[entry.path] && renderEntries(folders[entry.path], depth + 1)}
      </div>
    })
  }

  return <section className="content-card codebase-card">
    <div className="card-heading"><div><span className="eyebrow">CODEBASE EXPLORER</span><h2>Find your way around.</h2></div></div>
    <p className="muted-copy">Files are retrieved on demand from GitHub. Select one to inspect its actual contents.</p>
    <div className="explorer">
      <div className="file-tree"><label className="tree-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter root files" /></label><div className="tree-repo-name"><Github size={14} /> {owner}/{repo}</div><div className="tree-items">{renderEntries(visible)}{!visible.length && <span className="tree-empty">No matching files.</span>}</div></div>
      <div className="code-viewer">{selected ? <><div className="code-header"><span><FileCode2 size={14} /> {selected.path}</span><a href={selected.url} target="_blank" rel="noreferrer" aria-label="Open file on GitHub"><ExternalLink size={14} /></a></div><div className="file-search-row"><label><Search size={13} /><input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="Search in this file" /></label>{fileSearch && <span>{matchCount} match{matchCount === 1 ? '' : 'es'}</span>}<button className="text-button" onClick={() => void explainFile()} disabled={explaining}>{explaining ? <><LoaderCircle className="spin" size={12} /> Explaining</> : <><Sparkles size={12} /> Explain file</>}</button></div><pre><code>{fileMatches ? fileMatches.map((part, index) => part.toLowerCase() === fileSearch.toLowerCase() ? <mark key={index}>{part}</mark> : part) : selected.content}</code></pre>{explaining && <div className="file-explanation muted-copy">Asking the configured AI provider to explain this retrieved file…</div>}{explainError && <p className="inline-error file-explanation" role="alert">{explainError}</p>}{explanation && <div className="file-explanation markdown-body"><span className="eyebrow">AI EXPLANATION · {selected.path}</span><ReactMarkdown>{explanation}</ReactMarkdown></div>}</> : <div className="code-placeholder"><Code2 size={25} /><strong>Select a file to inspect it</strong><span>File contents are fetched only when requested.</span></div>}</div>
    </div>{error && <p role="alert" className="inline-error">{error}</p>}
  </section>
}

function IssueList({ issues, page, hasMore, onPageChange, onBuildPlan }: { issues: Issue[]; page: number; hasMore: boolean; onPageChange: (page: number) => void; onBuildPlan: (number: number) => void }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const filtered = issues.filter((issue) => {
    const matchesQuery = `${issue.title} ${issue.body} ${issue.labels.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'beginner' && issue.beginner) || (filter === 'docs' && issue.documentation) || (filter === 'bug' && issue.labels.some((label) => /bug/i.test(label))) || (filter === 'feature' && issue.labels.some((label) => /feature|enhancement/i.test(label)))
    return matchesQuery && matchesFilter
  })
  return <section className="content-card issues-card">
    <div className="card-heading"><div><span className="eyebrow">LIVE FROM GITHUB</span><h2>Find a place to start.</h2></div><span className="issue-total">{issues.length} loaded · page {page}</span></div>
    <p className="muted-copy">Issue difficulty is an estimate based on public labels. It is not an official classification.</p>
    <label className="issue-search"><Search size={15} /><input placeholder="Search titles, descriptions, labels" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="filter-row" aria-label="Filter issues">{[['all', 'All issues'], ['beginner', 'Beginner-friendly'], ['docs', 'Documentation'], ['bug', 'Bugs'], ['feature', 'Features']].map(([value, label]) => <button key={value} className={filter === value ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="issue-list">{filtered.map((issue) => <article className="issue-card" key={issue.number}><div className="issue-card-title"><span className="issue-open-mark" /><div><a href={issue.html_url} target="_blank" rel="noreferrer">#{issue.number} {issue.title} <ExternalLink size={12} /></a><span className="issue-meta">{issue.comments} comments · opened {new Date(issue.created_at).toLocaleDateString()}</span></div><span className={issue.beginner ? 'difficulty easy' : 'difficulty'}>{issue.difficulty}</span></div><p>{issue.body?.trim() ? issue.body.slice(0, 240).replace(/[#*`]/g, '') : 'No description provided.'}{issue.body?.length > 240 ? '…' : ''}</p><div className="issue-bottom">{issue.labels.length ? issue.labels.map((label) => <span className="issue-label" key={label}>{label}</span>) : <span className="issue-label muted-label">No labels</span>}<button className="issue-next" onClick={() => onBuildPlan(issue.number)}>Build a plan <ArrowRight size={13} /></button></div></article>)}
      {!filtered.length && <div className="empty-state"><GitPullRequest size={22} /><strong>{issues.length ? 'No issues match those filters.' : 'No open issues were found.'}</strong><span>{issues.length ? 'Try another filter or search term.' : 'This repository currently has no retrievable open issues.'}</span></div>}
      {(page > 1 || hasMore) && <div className="issue-pagination"><button className="button button-outline button-small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ArrowLeft size={13} /> Newer issues</button><span>Page {page}</span><button className="button button-outline button-small" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>Older issues <ArrowRight size={13} /></button></div>}
    </div>
  </section>
}

function Assistant({ analysis }: { analysis: Analysis }) {
  const prompts = ['Explain this repository like I’m a beginner.', 'How do I run this project locally?', 'Which files should I understand first?', 'What should I learn before contributing?']
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage(value = input) {
    const question = value.trim()
    if (!question || loading) return
    const history = messages.slice(-8)
    const updated = [...messages, { role: 'user' as const, content: question }]
    setMessages(updated)
    setInput('')
    setError('')
    setLoading(true)
    try {
      const response = await api<{ answer: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ owner: analysis.repository.owner, repo: analysis.repository.name, question, history }) })
      setMessages((current) => [...current, { role: 'assistant', content: response.answer }])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The assistant could not answer. Please retry.')
      setMessages(updated)
    } finally { setLoading(false) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage() }
  return <section className="content-card assistant-card">
    <div className="card-heading"><div><span className="eyebrow">REPOSITORY-GROUNDED AI</span><h2>Ask about this project.</h2></div><Sparkles size={18} /></div>
    <p className="muted-copy">Answers use information retrieved from {analysis.repository.full_name}. Configure a model key on the server to enable AI.</p>
    <div className="chat-panel">
      <div className="chat-messages" aria-live="polite">{!messages.length && <div className="chat-welcome"><div className="assistant-icon"><Sparkles size={17} /></div><h3>A better first question.</h3><p>Ask about the project, its setup, or where to start. Responses are grounded in retrieved repository evidence.</p><div className="prompt-chips">{prompts.map((prompt) => <button key={prompt} onClick={() => void sendMessage(prompt)} disabled={loading}>{prompt}</button>)}</div></div>}
        {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><span className="chat-role">{message.role === 'user' ? 'YOU' : 'REPOGUIDEAI'}</span><div className="markdown-body"><ReactMarkdown>{message.content}</ReactMarkdown></div></div>)}
        {loading && <div className="chat-message assistant"><span className="chat-role">REPOGUIDEAI</span><div className="typing-indicator"><i /><i /><i /></div></div>}
        {error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => { const last = messages.filter((message) => message.role === 'user').slice(-1)[0]; if (last) void sendMessage(last.content) }}>Retry</button></div>}
      </div>
      <form className="chat-input-row" onSubmit={submit}><textarea aria-label="Ask RepoGuideAI" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} placeholder="Ask something about this repository…" rows={2} maxLength={4000} /><button className="button button-dark send-button" aria-label="Send message" disabled={!input.trim() || loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form>
      <div className="chat-footnote">Enter to send · Shift + Enter for a new line</div>
    </div>
  </section>
}

const PLAN_STEP_TITLES = ['Read the project overview', 'Set up your local environment', 'Run the project and tests', 'Choose an issue that fits', 'Trace the relevant files', 'Make a focused change', 'Verify your change', 'Open a pull request']

function ContributionPlan({ analysis, issues, suggestedIssue }: { analysis: Analysis; issues: Issue[]; suggestedIssue?: number }) {
  const { user } = useAuth()
  const [selectedIssue, setSelectedIssue] = useState(suggestedIssue ? String(suggestedIssue) : '')
  const [plan, setPlan] = useState('')
  const [planError, setPlanError] = useState('')
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState(() => PLAN_STEP_TITLES.map((title, index) => ({ id: String(index + 1), title, done: false })))
  const [progressReady, setProgressReady] = useState(false)
  const key = `rg-progress:${analysis.repository.owner}/${analysis.repository.name}`
  const complete = steps.filter((step) => step.done).length

  useEffect(() => {
    if (suggestedIssue) setSelectedIssue(String(suggestedIssue))
  }, [suggestedIssue])

  useEffect(() => {
    let active = true
    if (user) {
      api<{ progress: typeof steps }>(`/users/me/progress/${encodeURIComponent(analysis.repository.owner)}/${encodeURIComponent(analysis.repository.name)}`)
        .then((result) => { if (active && result.progress.length) setSteps(result.progress) })
        .catch((loadError) => { if (active) setPlanError(loadError instanceof Error ? loadError.message : 'Could not load saved progress.') })
        .finally(() => { if (active) setProgressReady(true) })
    } else {
      try {
        const saved = localStorage.getItem(key)
        if (saved) setSteps(JSON.parse(saved) as typeof steps)
      } catch { localStorage.removeItem(key) }
      setProgressReady(true)
    }
    return () => { active = false }
  }, [analysis.repository.owner, analysis.repository.name, user, key])

  async function saveProgress(next: typeof steps) {
    setSteps(next)
    if (!user) { localStorage.setItem(key, JSON.stringify(next)); return }
    try {
      await api(`/users/me/progress/${encodeURIComponent(analysis.repository.owner)}/${encodeURIComponent(analysis.repository.name)}`, { method: 'PUT', body: JSON.stringify({ steps: next }) })
      setPlanError('')
    } catch (saveError) { setPlanError(saveError instanceof Error ? saveError.message : 'Could not save your progress.') }
  }

  async function createPlan() {
    setBusy(true)
    setPlanError('')
    try {
      const result = await api<{ plan: string }>('/ai/contribution-plan', { method: 'POST', body: JSON.stringify({
        owner: analysis.repository.owner,
        repo: analysis.repository.name,
        experience: user?.profile.experience || 'beginner',
        languages: user?.profile.languages || [],
        interests: user?.profile.interests || [],
        ...(selectedIssue ? { issueNumber: Number(selectedIssue) } : {}),
      }) })
      setPlan(result.plan)
    } catch (requestError) { setPlanError(requestError instanceof Error ? requestError.message : 'Could not generate a plan.') }
    finally { setBusy(false) }
  }

  return <div className="plan-layout">
    <section className="content-card plan-card">
      <div className="card-heading"><div><span className="eyebrow">YOUR CONTRIBUTION ROADMAP</span><h2>A next step, not a leap.</h2></div><GitPullRequest size={19} /></div>
      <p className="muted-copy">Your checklist is saved {user ? 'to your account' : 'in this browser'}. Commands below are templates—nothing is run automatically.</p>
      <div className="progress-head"><span>{complete} of {steps.length} steps complete</span><strong>{Math.round((complete / steps.length) * 100)}%</strong></div>
      <div className="progress-track"><span style={{ width: `${(complete / steps.length) * 100}%` }} /></div>
      <div className="checklist">{steps.map((step, index) => <label className={`checklist-item ${step.done ? 'done' : ''}`} key={step.id}><input type="checkbox" checked={step.done} disabled={!progressReady} onChange={(event) => void saveProgress(steps.map((item) => item.id === step.id ? { ...item, done: event.target.checked } : item))} /><span className="check-box">{step.done && <Check size={13} />}</span><span className="check-index">{String(index + 1).padStart(2, '0')}</span><span className="check-title">{step.title}</span></label>)}</div>
      {planError && <p className="inline-error" role="alert">{planError}</p>}
      {!user && <p className="signin-hint"><LockKeyhole size={13} /><Link to="/signin">Sign in</Link> to sync this checklist across devices.</p>}
    </section>
    <aside className="plan-side">
      <section className="side-card"><span className="eyebrow">AI-GUIDED PLAN</span><h3>Make it yours.</h3><p>Get tailored steps for your experience level and this repository’s actual setup notes.</p>
        <label className="select-label" htmlFor="issue-select">Issue to work on <span>(optional)</span></label>
        <select id="issue-select" value={selectedIssue} onChange={(event) => setSelectedIssue(event.target.value)}><option value="">Let me choose later</option>{issues.map((issue) => <option value={issue.number} key={issue.number}>#{issue.number} {issue.title}</option>)}</select>
        <button className="button button-dark full-button" onClick={() => void createPlan()} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={15} /> Building your plan</> : <><Sparkles size={15} /> Generate with AI</>}</button>
        {plan && <div className="markdown-body generated-plan"><ReactMarkdown>{plan}</ReactMarkdown></div>}
      </section>
      <section className="side-card command-card"><span className="eyebrow"><Terminal size={13} /> STARTING POINT</span><h3>Clone the repository.</h3><p>These Git commands use the repository’s real GitHub URL. Review its contribution guide before making changes.</p><pre><code>git clone {analysis.repository.html_url}.git{'\n'}cd {analysis.repository.name}{'\n'}git switch -c my-contribution</code></pre><span className="command-note">Commands are suggestions, not executed actions.</span></section>
    </aside>
  </div>
}

function SignIn() {
  const params = new URLSearchParams(window.location.search)
  const [register, setRegister] = useState(params.get('mode') === 'register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await api<{ user: User }>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(register ? { name } : {}) }),
      })
      setUser(response.user)
      navigate('/dashboard')
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Authentication failed.') }
    finally { setBusy(false) }
  }

  return <><Header /><main className="auth-page"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to home</Link><section className="auth-card"><span className="eyebrow">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span><h1>{register ? 'Make room to contribute.' : 'Pick up where you left off.'}</h1><p className="muted-copy">Save repositories, keep your contribution progress, and build a learning profile.</p>
    <form onSubmit={submit} className="auth-form">{register && <label>Your name<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label>}<label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} /></label><label>Password<input type="password" required autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={register ? 10 : 1} maxLength={128} />{register && <span className="field-hint">At least 10 characters.</span>}</label>
      {error && <p className="inline-error" role="alert">{error}</p>}<button className="button button-dark full-button" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={15} /> Please wait</> : <>{register ? 'Create account' : 'Sign in'} <ArrowRight size={15} /></>}</button>
    </form><p className="auth-switch">{register ? 'Already have an account?' : 'New to RepoGuideAI?'} <button onClick={() => { setRegister(!register); setError('') }}>{register ? 'Sign in' : 'Create an account'}</button></p><span className="auth-privacy"><LockKeyhole size={13} /> Your password is hashed and never exposed to the browser.</span>
  </section><div className="auth-config-note"><ShieldCheck size={15} /> Account features require MongoDB and server authentication configuration. You can still analyze public repositories without signing in.</div></main><Footer /></>
}

function Dashboard() {
  const { user } = useAuth()
  const [repositories, setRepositories] = useState<{ _id: string; fullName: string; owner: string; repo: string; updatedAt: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState('')

  async function load() {
    setLoading(true)
    try { const result = await api<{ repositories: typeof repositories }>('/users/me/repositories'); setRepositories(result.repositories); setError('') }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load your dashboard.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  if (!user) return <Navigate to="/signin" replace />

  async function remove(id: string) {
    setDeleting(id)
    try { await api(`/users/me/repositories/${encodeURIComponent(id)}`, { method: 'DELETE' }); setRepositories((current) => current.filter((item) => item._id !== id)) }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'Could not remove this repository.') }
    finally { setDeleting('') }
  }

  return <><Header /><main className="dashboard-page dashboard-home"><div className="dashboard-top"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Welcome back, {user.name.split(' ')[0]}.</h1><p className="muted-copy">Your repositories and saved contribution paths, all in one place.</p></div><Link to="/" className="button button-dark button-small">Analyze a repository <ArrowRight size={14} /></Link></div>
    <section className="dashboard-section"><div className="card-heading"><div><span className="eyebrow">SAVED REPOSITORIES</span><h2>Keep exploring.</h2></div><span className="issue-total">{repositories.length} saved</span></div>
      {loading ? <LoadingPage label="Loading your repositories" /> : error ? <PageError message={error} retry={() => void load()} /> : repositories.length ? <div className="saved-repo-grid">{repositories.map((item) => <article className="saved-repo-card" key={item._id}><Github size={19} /><span className="saved-repo-name">{item.fullName}</span><span className="saved-repo-date">Saved {new Date(item.updatedAt).toLocaleDateString()}</span><div><Link to={`/analyze/${encodeURIComponent(item.owner)}/${encodeURIComponent(item.repo)}`} className="text-link">Open workspace <ArrowRight size={14} /></Link><button className="text-button remove-button" disabled={deleting === item._id} onClick={() => void remove(item._id)}>{deleting === item._id ? 'Removing…' : 'Remove'}</button></div></article>)}</div> : <div className="empty-state dashboard-empty"><BookOpen size={25} /><strong>Your workspace is ready.</strong><span>Analyze a public repository, then save it here to revisit your next steps.</span><Link className="button button-outline button-small" to="/">Analyze a repository <ArrowRight size={14} /></Link></div>}
    </section><section className="dashboard-section profile-section"><div><span className="eyebrow">LEARNING PROFILE</span><h2>Your experience, your pace.</h2><p className="muted-copy">Your profile helps tailor AI-generated contribution plans.</p></div><div className="profile-summary"><span><strong>Experience</strong>{user.profile?.experience || 'Beginner'}</span><span><strong>Languages</strong>{user.profile?.languages?.join(', ') || 'Not added yet'}</span><span><strong>Time available</strong>{user.profile?.weeklyHours ?? 3} hours / week</span></div><Link className="text-link" to="/profile">Edit profile <ArrowRight size={14} /></Link></section>
  </main><Footer /></>
}

function Profile() {
  const { user, setUser } = useAuth()
  const [experience, setExperience] = useState(user?.profile.experience || 'beginner')
  const [languages, setLanguages] = useState(user?.profile.languages.join(', ') || '')
  const [interests, setInterests] = useState(user?.profile.interests.join(', ') || '')
  const [weeklyHours, setWeeklyHours] = useState(user?.profile.weeklyHours || 3)
  const [message, setMessage] = useState('')
  if (!user) return <Navigate to="/signin" replace />

  async function save(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    try {
      const result = await api<{ user: User }>('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          experience,
          languages: languages.split(',').map((item) => item.trim()).filter(Boolean),
          interests: interests.split(',').map((item) => item.trim()).filter(Boolean),
          weeklyHours,
        }),
      })
      setUser(result.user)
      setMessage('Your learning profile has been saved.')
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save your profile.')
    }
  }
  return <><Header /><main className="auth-page"><Link className="back-link" to="/dashboard"><ArrowLeft size={15} /> Back to dashboard</Link><section className="auth-card"><span className="eyebrow">YOUR LEARNING PROFILE</span><h1>Set your pace.</h1><p className="muted-copy">These preferences are used to tailor contribution guidance.</p><form className="auth-form" onSubmit={save}><label>Experience level<select value={experience} onChange={(event) => setExperience(event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label>Languages<input value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="JavaScript, Python" /></label><label>Areas of interest<input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Documentation, accessibility" /></label><label>Hours available per week<input type="number" min={1} max={80} value={weeklyHours} onChange={(event) => setWeeklyHours(Number(event.target.value))} /></label><button className="button button-dark full-button">Save profile <ArrowRight size={15} /></button>{message && <p role="status" className="inline-error">{message}</p>}</form></section></main><Footer /></>
}

function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  const privacy = type === 'privacy'
  return <><Header /><main className="legal-page"><Link to="/" className="back-link"><ArrowLeft size={15} /> Home</Link><span className="eyebrow">REPOGUIDEAI / {privacy ? 'PRIVACY' : 'TERMS'}</span><h1>{privacy ? 'Privacy, plainly stated.' : 'A few ground rules.'}</h1><p>Last updated October 2026</p>{privacy ? <><h2>Public repositories</h2><p>When you analyze a repository, RepoGuideAI requests public repository information from the GitHub REST API. Repository data is sent to the configured AI provider only when you request an AI response. Do not submit secrets or private code.</p><h2>Accounts and saved data</h2><p>If MongoDB is configured and you create an account, we store your email, display name, password hash, saved repository references, and checklist progress. Passwords are hashed. You may request account deletion through the account API or by contacting the site operator.</p><h2>Third-party services</h2><p>GitHub and the configured AI provider process requests under their own policies. The server never sends provider credentials to the browser. Anonymous GitHub requests are subject to GitHub rate limits.</p><h2>Contact</h2><p>This self-hosted demonstration does not have a central operator. Contact the person who deployed this instance with privacy questions.</p></> : <><h2>Guidance, not guarantees</h2><p>RepoGuideAI provides educational guidance based on retrieved repository data and model responses. Verify commands, recommendations, and generated code before using them.</p><h2>Repository content</h2><p>RepoGuideAI only reads public GitHub repository information. It does not run repository code, create issues, assign issues, push commits, or open pull requests.</p><h2>Availability</h2><p>Service availability depends on the host, GitHub API, database, and configured model provider. AI and account functionality require separate configuration.</p></>}<Link className="text-link legal-back" to="/">Return to RepoGuideAI <ArrowRight size={15} /></Link></main><Footer /></>
}

function App() {
  return <Routes><Route path="/" element={<><Header /><Landing /></>} /><Route path="/analyze/:owner/:repo" element={<RepositoryPage />} /><Route path="/signin" element={<SignIn />} /><Route path="/dashboard" element={<Dashboard />} /><Route path="/profile" element={<Profile />} /><Route path="/privacy" element={<LegalPage type="privacy" />} /><Route path="/terms" element={<LegalPage type="terms" />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>
}

export default App
