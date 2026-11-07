import test from 'node:test'
import assert from 'node:assert/strict'

test('courtroom requires room access and runs advocates before judge', async () => {
  process.env.SWITCH_AGENT_BRIDGE_URL = 'http://localhost:1234'
  process.env.SWITCH_AGENT_ID = 'test'
  process.env.SWITCH_AGENT_API_KEY = 'test'
  process.env.GROQ_API_KEY = 'test'
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { courtroomTurn } = await import('../controller/courtroomController.ts')
  const original = { find: chat.findOne, update: chat.findOneAndUpdate, storage: storage.find, fetch: globalThis.fetch }
  const reply = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } })
  const req = { params: { roomId: '507f1f77bcf86cd799439011' }, userId: 'member', body: { message: 'Discuss the case', target: 'all' } }
  try {
    chat.findOne = () => ({ lean: async () => null })
    const denied = reply(); await courtroomTurn(req, denied); assert.equal(denied.statusCode, 404)
    chat.findOne = filter => ({ lean: async () => { assert.equal(filter.switchVerified, true); return { _id: req.params.roomId, ownerId: 'owner', switchRoomId: 'switch-room', courtroom: [] } } })
    storage.find = filter => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => { assert.equal(filter.ownerId, 'owner'); return [] } }) }) }) })
    let modelCalls = 0
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('read_context')) return new Response(JSON.stringify({ result: { threads: [] } }))
      const request = JSON.parse(options.body); assert.equal(request.tools[0].type, 'browser_search')
      modelCalls++; if (modelCalls === 2) assert.match(request.messages[1].content, /response 1/)
      return new Response(JSON.stringify({ choices: [{ message: { content: `response ${modelCalls}` } }] }))
    }
    chat.findOneAndUpdate = (filter, update) => ({ select: () => ({ lean: async () => { assert.equal(filter.switchVerified, true); return { courtroom: update.$push.courtroom.$each } } }) })
    const ok = reply(); await courtroomTurn(req, ok)
    assert.deepEqual(ok.body.messages.map(item => item.role), ['user', 'claimant', 'respondent', 'judge'])
    assert.equal(modelCalls, 3)
  } finally { chat.findOne = original.find; chat.findOneAndUpdate = original.update; storage.find = original.storage; globalThis.fetch = original.fetch }
})
