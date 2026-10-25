import test from 'node:test'
import assert from 'node:assert/strict'
import { generateGroundedText } from './ai.js'

const keys = ['AI_PROVIDER', 'GEMMA_API_KEY', 'GEMMA_MODEL', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'OLLAMA_BASE_URL', 'OLLAMA_MODEL']
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
const previousFetch = globalThis.fetch

test.afterEach(() => {
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  globalThis.fetch = previousFetch
})

test('reports missing Gemma credentials rather than returning a canned answer', async () => {
  process.env.AI_PROVIDER = 'google'
  delete process.env.GEMMA_API_KEY
  await assert.rejects(
    () => generateGroundedText({ instruction: 'Explain this project', context: 'verified repository data' }),
    (error) => error.status === 503 && error.code === 'AI_NOT_CONFIGURED',
  )
})

test('uses native Ollama chat with the configured Gemma model and returns its real response', async () => {
  process.env.AI_PROVIDER = 'ollama'
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/'
  process.env.OLLAMA_MODEL = 'gemma3:test'
  let requestUrl = ''
  let requestBody
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url)
    requestBody = JSON.parse(options.body)
    return Response.json({ message: { role: 'assistant', content: 'Ollama generated this grounded response.' }, done: true })
  }

  const result = await generateGroundedText({
    instruction: 'Explain the entry point',
    context: 'Verified file: src/main.ts',
    history: [{ role: 'user', content: 'What is this repository?' }, { role: 'assistant', content: 'It is a test repository.' }],
  })

  assert.equal(result, 'Ollama generated this grounded response.')
  assert.equal(requestUrl, 'http://127.0.0.1:11434/api/chat')
  assert.equal(requestBody.model, 'gemma3:test')
  assert.equal(requestBody.stream, false)
  assert.equal(requestBody.messages[0].role, 'system')
  assert.match(requestBody.messages[0].content, /Never invent repository details/)
  assert.equal(requestBody.messages[1].content, 'What is this repository?')
  assert.equal(requestBody.messages[2].content, 'It is a test repository.')
  assert.match(requestBody.messages[3].content, /Verified file: src\/main\.ts/)
})

test('explains how to install an Ollama model that is missing', async () => {
  process.env.AI_PROVIDER = 'ollama'
  process.env.OLLAMA_MODEL = 'gemma3:test'
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'model "gemma3:test" not found' }), { status: 404 })
  await assert.rejects(
    () => generateGroundedText({ instruction: 'Explain the project', context: 'repository evidence' }),
    (error) => error.status === 503 && error.code === 'OLLAMA_MODEL_MISSING' && error.message.includes('ollama pull gemma3:test'),
  )
})

test('reports when the configured Ollama service is unavailable', async () => {
  process.env.AI_PROVIDER = 'ollama'
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }
  await assert.rejects(
    () => generateGroundedText({ instruction: 'Explain the project', context: 'repository evidence' }),
    (error) => error.status === 503 && error.code === 'OLLAMA_UNAVAILABLE',
  )
})

test('reports hosted AI as unconfigured without attempting a provider call', async () => {
  process.env.AI_PROVIDER = 'disabled'
  globalThis.fetch = async () => {
    throw new Error('Disabled AI provider must not make a request')
  }
  await assert.rejects(
    () => generateGroundedText({ instruction: 'Explain the project', context: 'repository evidence' }),
    (error) => error.status === 503 && error.code === 'AI_NOT_CONFIGURED' && /not configured for this deployment/.test(error.message),
  )
})

test('calls the configured Google model and extracts its generated response', async () => {
  process.env.AI_PROVIDER = 'google'
  process.env.GEMMA_API_KEY = 'test-server-key'
  process.env.GEMMA_MODEL = 'gemma-test'
  let requestUrl = ''
  let requestBody
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url)
    requestBody = JSON.parse(options.body)
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Grounded answer.' }] } }] })
  }
  const result = await generateGroundedText({ instruction: 'Explain the entry point', context: 'Verified file: src/main.ts' })
  assert.equal(result, 'Grounded answer.')
  assert.match(requestUrl, /models\/gemma-test:generateContent/)
  assert.equal(new URL(requestUrl).searchParams.get('key'), 'test-server-key')
  assert.match(requestBody.contents[0].parts[0].text, /Verified file: src\/main\.ts/)
})
