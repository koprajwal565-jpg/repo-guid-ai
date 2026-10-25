import test from 'node:test'
import assert from 'node:assert/strict'
import { generateGroundedText } from './ai.js'

const keys = ['AI_PROVIDER', 'GEMMA_API_KEY', 'GEMMA_MODEL', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL']
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
