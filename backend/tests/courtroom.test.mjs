import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

test('courtroom requires room access and runs advocates before judge', async () => {
  process.env.SWITCH_AGENT_BRIDGE_URL = 'http://localhost:1234'
  process.env.SWITCH_AGENT_ID = 'test'
  process.env.SWITCH_AGENT_API_KEY = 'test'
  process.env.GROQ_API_KEY = 'test'
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { courtroomTurn, saveCourtContext } = await import('../controller/courtroomController.ts')
  const original = { find: chat.findOne, update: chat.findOneAndUpdate, storage: storage.find, fetch: globalThis.fetch }
  const reply = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } })
  const req = { params: { roomId: '507f1f77bcf86cd799439011' }, userId: 'member', body: { message: 'Discuss the case', target: 'all' } }
  try {
    chat.findOne = () => ({ lean: async () => null })
    const denied = reply(); await courtroomTurn(req, denied); assert.equal(denied.statusCode, 404)
    chat.findOne = filter => ({ lean: async () => { assert.equal(filter.switchVerified, true); return { _id: req.params.roomId, ownerId: 'owner', switchRoomId: 'switch-room', courtroom: [], courtContext: 'Case facts', courtStorageKeys: [] } } })
    storage.find = filter => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => { assert.equal(filter.ownerId, 'owner'); assert.deepEqual(filter.storageKey.$in, []); return [] } }) }) }) })
    let modelCalls = 0
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions')
      const request = JSON.parse(options.body); assert.match(request.messages[1].content, /Case facts/); assert.doesNotMatch(request.messages[1].content, /Switch conversation/)
      assert.equal(request.tools, undefined)
      modelCalls++; if (modelCalls === 2) assert.match(request.messages[1].content, /response 1/)
      return new Response(JSON.stringify({ choices: [{ message: { content: `response ${modelCalls}` } }] }))
    }
    let transcript = []
    chat.findOneAndUpdate = (filter, update) => ({ select: () => ({ lean: async () => { assert.equal(filter.switchVerified, true); transcript.push(...update.$push.courtroom.$each); return { courtroom: [...transcript] } } }) })
    const ok = reply(); await courtroomTurn(req, ok)
    assert.deepEqual(ok.body.messages.map(item => item.role), ['user', 'claimant', 'respondent', 'judge'])
    assert.equal(modelCalls, 3)
    transcript = []
    const individual = reply()
    await courtroomTurn({ ...req, body: { message: 'Review this', target: 'judge' } }, individual)
    assert.deepEqual(individual.body.messages.map(item => item.role), ['user', 'judge'])
  } finally { chat.findOne = original.find; chat.findOneAndUpdate = original.update; storage.find = original.storage; globalThis.fetch = original.fetch }
})

test('court context rejects documents from another room', async () => {
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { saveCourtContext } = await import('../controller/courtroomController.ts')
  const oldFind = chat.findOne, oldStorage = storage.find
  const req = { params: { roomId: '507f1f77bcf86cd799439011' }, userId: 'member', body: { text: 'facts', storageKeys: ['f36c5c8f-a54f-47b5-b3e3-d4cccbde85c2'] } }
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } }
  try {
    chat.findOne = filter => ({ select: () => ({ lean: async () => { assert.equal(filter.switchVerified, true); return { _id: req.params.roomId, ownerId: 'owner' } } }) })
    storage.find = filter => ({ select: () => ({ lean: async () => { assert.equal(filter.ownerId, 'owner'); assert.equal(filter.chatId, req.params.roomId); return [] } }) })
    await saveCourtContext(req, res)
    assert.equal(res.statusCode, 400)
  } finally { chat.findOne = oldFind; storage.find = oldStorage }
})

test('unchanged case brief is reused without another model call', async () => {
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { prepareCourtBrief } = await import('../controller/courtroomController.ts')
  const oldFind = chat.findOne, oldStorage = storage.find, oldFetch = globalThis.fetch
  const id = '507f1f77bcf86cd799439011', text = 'Case facts'
  const fingerprint = createHash('sha256').update(JSON.stringify({ text, items: [] })).digest('hex')
  const req = { params: { roomId: id }, userId: 'member' }
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } }
  try {
    chat.findOne = () => ({ lean: async () => ({ _id: id, ownerId: 'owner', courtContext: text, courtStorageKeys: [], courtBrief: { fingerprint, summary: 'Summary', notes: 'Notes' } }) })
    storage.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) })
    globalThis.fetch = async () => { throw new Error('Cached brief must not call the model') }
    await prepareCourtBrief(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.cached, true)
    assert.equal(res.body.brief.summary, 'Summary')
  } finally { chat.findOne = oldFind; storage.find = oldStorage; globalThis.fetch = oldFetch }
})

test('an interrupted session keeps completed arguments', async () => {
  process.env.GROQ_API_KEY = 'test'
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { courtroomTurn } = await import('../controller/courtroomController.ts')
  const oldFind = chat.findOne, oldUpdate = chat.findOneAndUpdate, oldStorage = storage.find, oldFetch = globalThis.fetch
  const id = '507f1f77bcf86cd799439011', transcript = []
  const req = { params: { roomId: id }, userId: 'member', body: { message: 'Discuss', target: 'all' } }
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } }
  let calls = 0
  try {
    chat.findOne = () => ({ lean: async () => ({ _id: id, ownerId: 'owner', courtContext: '', courtStorageKeys: [], courtroom: [] }) })
    storage.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) })
    chat.findOneAndUpdate = (filter, update) => ({ select: () => ({ lean: async () => { transcript.push(...update.$push.courtroom.$each); return { courtroom: [...transcript] } } }) })
    globalThis.fetch = async () => ++calls === 1 ? new Response(JSON.stringify({ choices: [{ message: { content: 'First argument' } }] })) : new Response('{}', { status: 500 })
    await courtroomTurn(req, res)
    assert.equal(res.statusCode, 502)
    assert.deepEqual(transcript.map(item => item.role), ['user', 'claimant'])
  } finally { chat.findOne = oldFind; chat.findOneAndUpdate = oldUpdate; storage.find = oldStorage; globalThis.fetch = oldFetch }
})

test('preparing a brief uses selected room material and saves the result', async () => {
  process.env.GROQ_API_KEY = 'test'
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { prepareCourtBrief } = await import('../controller/courtroomController.ts')
  const oldFind = chat.findOne, oldUpdate = chat.findOneAndUpdate, oldStorage = storage.find, oldFetch = globalThis.fetch
  const id = '507f1f77bcf86cd799439011', key = 'f36c5c8f-a54f-47b5-b3e3-d4cccbde85c2'
  const room = { _id: id, ownerId: 'owner', courtContext: 'Case facts', courtStorageKeys: [key] }
  const req = { params: { roomId: id }, userId: 'member' }
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } }
  try {
    chat.findOne = filter => ({ lean: async () => { assert.equal(filter.switchVerified, true); return room } })
    storage.find = filter => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => { assert.equal(filter.chatId, id); assert.deepEqual(filter.storageKey.$in, [key]); return [{ storageKey: key, title: 'Exhibit A', contextText: 'Evidence' }] } }) }) }) })
    globalThis.fetch = async (url, options) => { const payload = JSON.parse(options.body); assert.match(payload.messages[1].content, /Exhibit A/); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'Summary', notes: 'Notes' }) } }] })) }
    chat.findOneAndUpdate = (filter, update) => ({ select: () => ({ lean: async () => { assert.equal(filter.courtContext, room.courtContext); return { courtBrief: update.$set.courtBrief } } }) })
    await prepareCourtBrief(req, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.cached, false)
    assert.equal(res.body.brief.notes, 'Notes')
  } finally { chat.findOne = oldFind; chat.findOneAndUpdate = oldUpdate; storage.find = oldStorage; globalThis.fetch = oldFetch }
})

test('court session alternates questions and answers between advocates', async () => {
  process.env.GROQ_API_KEY = 'test'
  const { default: chat } = await import('../models/chatModel.ts')
  const { default: storage } = await import('../models/userStorageModel.ts')
  const { stepCourtSession } = await import('../controller/courtroomController.ts')
  const oldUpdate = chat.findOneAndUpdate, oldStorage = storage.find, oldFetch = globalThis.fetch
  const id = '507f1f77bcf86cd799439011', transcript = []
  let turn = 0
  try {
    storage.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) })
    chat.findOneAndUpdate = (filter, update) => {
      if (update.$set?.['courtSession.lockedUntil']) return { lean: async () => ({ _id: id, ownerId: 'owner', courtContext: 'A dispute', courtStorageKeys: [], courtroom: [...transcript], courtSession: { turn, lockedUntil: update.$set['courtSession.lockedUntil'] } }) }
      return { select: () => ({ lean: async () => { transcript.push(...update.$push.courtroom.$each); turn++; return { courtroom: [...transcript], courtSession: { turn } } } }) }
    }
    globalThis.fetch = async (url, options) => {
      const messages = JSON.parse(options.body).messages
      if (turn > 0) assert.match(messages[1].content, new RegExp(`turn ${turn}`))
      return new Response(JSON.stringify({ choices: [{ message: { content: `turn ${turn + 1}` } }] }))
    }
    for (let i = 0; i < 4; i++) {
      const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(value) { this.body = value; return this } }
      await stepCourtSession({ params: { roomId: id }, userId: 'member' }, res)
      assert.equal(res.statusCode, 200)
    }
    assert.deepEqual(transcript.map(x => [x.role, x.phase]), [['claimant', 'question'], ['respondent', 'answer'], ['respondent', 'question'], ['claimant', 'answer']])
  } finally { chat.findOneAndUpdate = oldUpdate; storage.find = oldStorage; globalThis.fetch = oldFetch }
})
