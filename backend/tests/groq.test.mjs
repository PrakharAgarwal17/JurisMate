import test from 'node:test'
import assert from 'node:assert/strict'

test('Groq requests use the selected model and search or image input', async () => {
  process.env.GROQ_API_KEY = 'test'
  const { default: askGroq } = await import('../tools/groq.ts')
  const original = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions')
    requests.push(JSON.parse(options.body))
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
  }
  try {
    assert.equal(await askGroq([{ role: 'user', content: 'question' }], true), 'ok')
    assert.equal(requests[0].tools[0].type, 'browser_search')
    assert.equal(requests[0].tool_choice, 'required')
    assert.equal(await askGroq([{ role: 'user', content: 'image', images: [{ mimeType: 'image/png', data: 'abc' }] }]), 'ok')
    assert.equal(requests[1].model, 'qwen/qwen3.8-27b')
    assert.equal(requests[1].messages[0].content[1].image_url.url, 'data:image/png;base64,abc')
    assert.equal(requests[1].tools, undefined)
  } finally { globalThis.fetch = original }
})

test('Groq retries a short temporary rate limit', async () => {
  process.env.GROQ_API_KEY = 'test'
  const { default: askGroq } = await import('../tools/groq.ts')
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => ++calls === 1
    ? new Response('{}', { status: 429, headers: { 'retry-after': '0.001' } })
    : new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
  try {
    assert.equal(await askGroq([{ role: 'user', content: 'question' }]), 'ok')
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})
