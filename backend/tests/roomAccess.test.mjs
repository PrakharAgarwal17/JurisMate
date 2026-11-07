import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'

test('room verification posts a private code and requires it before history is read', async () => {
  let received = ''
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => { received = JSON.parse(body).content; res.writeHead(200).end('{}') })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  process.env.SWITCH_AGENT_BRIDGE_URL = `http://127.0.0.1:${server.address().port}`
  process.env.SWITCH_AGENT_ID = 'test-agent'
  process.env.SWITCH_AGENT_API_KEY = 'test-key'
  process.env.ACCESS_SECRET_KEY = 'test-secret'
  const { default: chatModel } = await import('../models/chatModel.ts')
  const { startVerification, verifyRoom, roomHistory, sendRoomMessage } = await import('../controller/switchController.ts')
  const { default: storageModel } = await import('../models/userStorageModel.ts')
  const originalFindOne = chatModel.findOne
  const originalFindOneAndUpdate = chatModel.findOneAndUpdate
  const originalStorageFind = storageModel.find
  const id = '507f1f77bcf86cd799439011'
  const room = { _id: id, id, switchRoomId: 'test-room', switchVerified: false, async save() {} }
  const response = () => ({ statusCode: 200, payload: undefined, status(n) { this.statusCode = n; return this }, json(value) { this.payload = value; return this } })
  try {
    chatModel.findOne = async () => room
    const challenge = response()
    await startVerification({ params: { roomId: id }, userId: 'owner' }, challenge)
    const code = received.match(/\b\d{6}\b/)?.[0]
    assert.ok(code)
    assert.equal(JSON.stringify(challenge.payload).includes(code), false)
    assert.equal(room.verificationHash, createHmac('sha256', 'test-secret').update(`${id}:${code}`).digest('hex'))
    assert.ok(room.verificationExpiresAt > new Date())
    chatModel.findOneAndUpdate = async filter => filter.verificationHash === room.verificationHash && filter.ownerId === 'owner' ? room : null
    const wrong = response(); await verifyRoom({ params: { roomId: id }, userId: 'other', body: { code } }, wrong)
    assert.equal(wrong.statusCode, 400)
    const good = response(); await verifyRoom({ params: { roomId: id }, userId: 'owner', body: { code } }, good)
    assert.equal(good.statusCode, 200)
    chatModel.findOne = filter => ({ lean: async () => { assert.equal(filter.switchVerified, true); assert.equal(filter.$or[0].ownerId, 'other'); return null } })
    const denied = response(); await roomHistory({ params: { roomId: id }, userId: 'other' }, denied)
    assert.equal(denied.statusCode, 404)
    const key = 'f36c5c8f-a54f-47b5-b3e3-d4cccbde85c2'
    chatModel.findOne = () => ({ lean: async () => ({ ...room, ownerId: 'owner' }) })
    storageModel.find = filter => ({ select: () => ({ lean: async () => { assert.equal(filter.ownerId, 'owner'); assert.equal(filter.chatId, id); return [] } }) })
    const before = received
    const missing = response(); await sendRoomMessage({ params: { roomId: id }, userId: 'owner', body: { content: 'hello', storageKeys: [key] } }, missing)
    assert.equal(missing.statusCode, 400)
    assert.equal(received, before)
  } finally {
    chatModel.findOne = originalFindOne; chatModel.findOneAndUpdate = originalFindOneAndUpdate; storageModel.find = originalStorageFind
    await new Promise(resolve => server.close(resolve))
  }
})
