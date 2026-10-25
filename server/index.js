import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HttpError } from './lib/errors.js'
import { analyzeRepository, getFile, getIssues, getRepository, getTree, parseGitHubRepositoryUrl } from './services/github.js'
import { generateGroundedText } from './services/ai.js'
import { SavedRepository, User, UserProgress } from './models.js'

const app = express()
const port = Number(process.env.PORT) || 4000
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
const tokenSecret = process.env.JWT_SECRET

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: clientUrl, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
app.use('/api', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/ai', rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }))

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false })
const parseRepoParams = (owner, repo) => parseGitHubRepositoryUrl(`https://github.com/${owner}/${repo}`)
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const dbReady = () => mongoose.connection.readyState === 1

function requireDatabase() {
  if (!dbReady()) throw new HttpError(503, 'Account storage is unavailable. Configure MONGODB_URI on the server and restart it.', 'DATABASE_UNAVAILABLE')
}

function requireAuthConfiguration() {
  if (!tokenSecret || tokenSecret.length < 32) {
    throw new HttpError(503, 'Authentication is not configured. Set a JWT_SECRET of at least 32 characters on the server.', 'AUTH_NOT_CONFIGURED')
  }
}

function issueToken(user) {
  requireAuthConfiguration()
  return jwt.sign({ sub: user.id }, tokenSecret, { expiresIn: '7d' })
}

function writeSession(res, token) {
  res.cookie('rg_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

const requireAuth = asyncRoute(async (req, _res, next) => {
  requireDatabase()
  if (!tokenSecret || tokenSecret.length < 32) throw new HttpError(503, 'Authentication is not configured on the server.', 'AUTH_NOT_CONFIGURED')
  const token = req.cookies.rg_session
  if (!token) throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED')
  let payload
  try {
    payload = jwt.verify(token, tokenSecret)
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.', 'INVALID_SESSION')
  }
  const user = await User.findById(payload.sub)
  if (!user) throw new HttpError(401, 'Your account could not be found. Please sign in again.', 'INVALID_SESSION')
  req.user = user
  next()
})

const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
  name: z.string().trim().min(1).max(80).optional(),
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: dbReady() ? 'connected' : 'not-configured-or-disconnected' })
})

app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
  requireDatabase()
  requireAuthConfiguration()
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email and a password with at least 10 characters.', 'VALIDATION_ERROR')
  if (!parsed.data.name) throw new HttpError(400, 'Enter your name to create an account.', 'VALIDATION_ERROR')
  const existing = await User.findOne({ email: parsed.data.email })
  if (existing) throw new HttpError(409, 'An account with that email already exists.', 'EMAIL_EXISTS')
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await User.create({ email: parsed.data.email, name: parsed.data.name, passwordHash })
  writeSession(res, issueToken(user))
  res.status(201).json({ user: publicUser(user) })
}))

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  requireDatabase()
  requireAuthConfiguration()
  const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a valid email and password.', 'VALIDATION_ERROR')
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS')
  }
  writeSession(res, issueToken(user))
  res.json({ user: publicUser(user) })
}))

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('rg_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' })
  res.json({ ok: true })
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

app.put('/api/users/me', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({
    experience: z.enum(['beginner', 'intermediate', 'advanced']),
    languages: z.array(z.string().trim().min(1).max(40)).max(12),
    interests: z.array(z.string().trim().min(1).max(80)).max(12),
    weeklyHours: z.number().int().min(1).max(80),
  }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Check your profile fields and try again.', 'VALIDATION_ERROR')
  req.user.profile = parsed.data
  await req.user.save()
  res.json({ user: publicUser(req.user) })
}))

app.delete('/api/auth/account', requireAuth, asyncRoute(async (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(128) }).parse(req.body)
  const user = await User.findById(req.user.id).select('+passwordHash')
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Password is incorrect.', 'INVALID_CREDENTIALS')
  await Promise.all([
    SavedRepository.deleteMany({ user: user.id }),
    UserProgress.deleteMany({ user: user.id }),
    User.deleteOne({ _id: user.id }),
  ])
  res.clearCookie('rg_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' })
  res.json({ ok: true })
}))

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, profile: user.profile }
}

app.post('/api/repositories/analyze', asyncRoute(async (req, res) => {
  const parsed = z.object({ url: z.string().min(1).max(500) }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a GitHub repository URL.', 'VALIDATION_ERROR')
  res.json(await analyzeRepository(parsed.data.url))
}))

app.get('/api/repositories/:owner/:repo/tree', asyncRoute(async (req, res) => {
  const { owner, repo } = parseRepoParams(req.params.owner, req.params.repo)
  const path = typeof req.query.path === 'string' ? req.query.path : ''
  res.json({ entries: await getTree(owner, repo, path) })
}))

app.get('/api/repositories/:owner/:repo/file', asyncRoute(async (req, res) => {
  const { owner, repo } = parseRepoParams(req.params.owner, req.params.repo)
  const filePath = typeof req.query.path === 'string' ? req.query.path : ''
  res.json(await getFile(owner, repo, filePath))
}))

app.get('/api/repositories/:owner/:repo/issues', asyncRoute(async (req, res) => {
  const { owner, repo } = parseRepoParams(req.params.owner, req.params.repo)
  const requestedPage = Number(req.query.page ?? 1)
  if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 100) {
    throw new HttpError(400, 'Issue page must be between 1 and 100.', 'VALIDATION_ERROR')
  }
  res.json(await getIssues(owner, repo, requestedPage))
}))

app.post('/api/ai/chat', asyncRoute(async (req, res) => {
  const parsed = z.object({
    owner: z.string().min(1).max(39),
    repo: z.string().min(1).max(100),
    question: z.string().trim().min(1).max(4000),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(3000) })).max(8).optional(),
    filePath: z.string().max(500).optional(),
  }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Provide a repository and a question (maximum 4,000 characters).', 'VALIDATION_ERROR')
  const { owner, repo } = parseRepoParams(parsed.data.owner, parsed.data.repo)
  const [analysis, issueResult] = await Promise.all([getRepository(owner, repo), getIssues(owner, repo)])
  const issues = issueResult.issues
  let fileContext = ''
  if (parsed.data.filePath) {
    const file = await getFile(owner, repo, parsed.data.filePath)
    fileContext = `\n\nRetrieved file ${file.path}:\n${file.content.slice(0, 12_000)}`
  }
  const context = [
    `Repository: ${analysis.repository.full_name}`,
    `Description: ${analysis.repository.description ?? 'Not provided by GitHub.'}`,
    `Default branch: ${analysis.repository.default_branch}`,
    `Languages: ${Object.keys(analysis.languages).join(', ') || 'Not reported.'}`,
    `README excerpt:\n${analysis.readme?.content.slice(0, 12_000) ?? 'No README was available.'}`,
    `Open issues (actual GitHub data):\n${issues.slice(0, 20).map((issue) => `#${issue.number} ${issue.title} — ${issue.html_url}`).join('\n') || 'No open issues retrieved.'}`,
    fileContext,
  ].join('\n\n')
  const answer = await generateGroundedText({ instruction: parsed.data.question, context, history: parsed.data.history })
  res.json({ answer })
}))

app.post('/api/ai/contribution-plan', asyncRoute(async (req, res) => {
  const parsed = z.object({
    owner: z.string().min(1).max(39),
    repo: z.string().min(1).max(100),
    experience: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    languages: z.array(z.string().max(40)).max(12).default([]),
    interests: z.array(z.string().max(80)).max(12).default([]),
    issueNumber: z.number().int().positive().optional(),
  }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Provide a valid repository and learning profile.', 'VALIDATION_ERROR')
  const { owner, repo } = parseRepoParams(parsed.data.owner, parsed.data.repo)
  const [analysis, issueResult] = await Promise.all([getRepository(owner, repo), getIssues(owner, repo)])
  const issues = issueResult.issues
  const issue = parsed.data.issueNumber ? issues.find((item) => item.number === parsed.data.issueNumber) : issues.find((item) => item.beginner)
  const context = `Repository: ${analysis.repository.full_name}\nDescription: ${analysis.repository.description ?? 'Not provided.'}\nDefault branch: ${analysis.repository.default_branch}\nLanguages: ${Object.keys(analysis.languages).join(', ') || 'Not available'}\nREADME setup and contribution instructions: ${analysis.readme?.content.slice(0, 14_000) ?? 'No README available.'}\nSelected issue: ${issue ? `#${issue.number} ${issue.title} (${issue.html_url})\n${issue.body}` : 'No issue selected or no matching open issue retrieved.'}`
  const instruction = `Create a practical contribution roadmap for a ${parsed.data.experience} contributor. Their languages: ${parsed.data.languages.join(', ') || 'not specified'}. Interests: ${parsed.data.interests.join(', ') || 'not specified'}. Use 6-9 numbered steps, actionable, and tailor commands only to setup instructions present in the supplied README. If a command is unknown, say to inspect project documentation instead of guessing. Mention selected issue only if verified.`
  res.json({ plan: await generateGroundedText({ instruction, context }), issue: issue ?? null })
}))

app.get('/api/users/me/repositories', requireAuth, asyncRoute(async (req, res) => {
  const repositories = await SavedRepository.find({ user: req.user.id }).sort({ updatedAt: -1 }).limit(100).lean()
  res.json({ repositories })
}))

app.post('/api/users/me/repositories', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ url: z.string().min(1).max(500) }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Enter a valid GitHub repository URL.', 'VALIDATION_ERROR')
  const { owner, repo } = parseGitHubRepositoryUrl(parsed.data.url)
  const analysis = await getRepository(owner, repo)
  const saved = await SavedRepository.findOneAndUpdate(
    { user: req.user.id, owner, repo },
    { $set: { fullName: analysis.repository.full_name } },
    { upsert: true, new: true, runValidators: true },
  )
  res.status(201).json({ repository: saved })
}))

app.delete('/api/users/me/repositories/:id', requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid saved repository id.')
  const deleted = await SavedRepository.findOneAndDelete({ _id: req.params.id, user: req.user.id })
  if (!deleted) throw new HttpError(404, 'Saved repository not found.')
  res.json({ ok: true })
}))

app.get('/api/users/me/progress/:owner/:repo', requireAuth, asyncRoute(async (req, res) => {
  const { owner, repo } = parseRepoParams(req.params.owner, req.params.repo)
  const progress = await UserProgress.findOne({ user: req.user.id, owner, repo }).lean()
  res.json({ progress: progress?.steps ?? [] })
}))

app.put('/api/users/me/progress/:owner/:repo', requireAuth, asyncRoute(async (req, res) => {
  const { owner, repo } = parseRepoParams(req.params.owner, req.params.repo)
  const parsed = z.object({
    steps: z.array(z.object({ id: z.string().min(1).max(50), title: z.string().min(1).max(150), done: z.boolean() })).max(30),
  }).safeParse(req.body)
  if (!parsed.success) throw new HttpError(400, 'Progress steps are invalid.', 'VALIDATION_ERROR')
  const progress = await UserProgress.findOneAndUpdate(
    { user: req.user.id, owner, repo },
    { $set: { steps: parsed.data.steps } },
    { new: true, upsert: true, runValidators: true },
  )
  res.json({ progress: progress.steps })
}))

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(currentDir, '../dist')
app.use(express.static(distDir))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next(new HttpError(404, 'The requested endpoint was not found.', 'NOT_FOUND'))
  res.sendFile(path.join(distDir, 'index.html'), (error) => error && next())
})
app.use((req, _res, next) => next(new HttpError(404, 'The requested endpoint was not found.', 'NOT_FOUND')))
app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) ? error.status : error instanceof z.ZodError ? 400 : 500
  const message = status >= 500 && !error.code ? 'An unexpected server error occurred. Please try again.' : error.message
  if (status >= 500) console.error(`[api] ${error.code ?? 'INTERNAL_ERROR'}: ${error.message}`)
  res.status(status).json({ error: { message, code: error.code ?? 'REQUEST_FAILED' } })
})

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 7000 })
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error(`MongoDB unavailable; public repository analysis remains enabled: ${error.message}`))
}

app.listen(port, () => console.log(`RepoGuideAI API listening on port ${port}`))
