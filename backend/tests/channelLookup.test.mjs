import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

test('channel links resolve only to matching Switch agent rooms', async () => {
  const server = createServer((req, res) => {
    const result = req.url.endsWith('/list_rooms')
      ? [{ room_id: 'room-1' }]
      : req.url.endsWith('/list_bridges') ? [{ id: 'bridge-1', type: 'discord' }]
      : { external_channel_id: '222', bridge_id: 'bridge-1' }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ result }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  process.env.SWITCH_AGENT_BRIDGE_URL = `http://127.0.0.1:${server.address().port}`
  process.env.SWITCH_AGENT_ID = 'test'
  process.env.SWITCH_AGENT_API_KEY = 'test'
  const { channelIdFromLink, findSwitchRoomByChannel } = await import('../utils/switchMessaging.ts')
  try {
    assert.equal(channelIdFromLink('discord', 'https://discord.com/channels/111/222'), '222')
    assert.equal(channelIdFromLink('discord', 'https://discord.com.evil.test/channels/111/222'), null)
    assert.equal(channelIdFromLink('slack', 'https://team.slack.com/archives/C123'), 'C123')
    assert.equal(await findSwitchRoomByChannel('discord', '222'), 'room-1')
    assert.equal(await findSwitchRoomByChannel('discord', '333'), null)
    assert.equal(await findSwitchRoomByChannel('slack', '222'), null)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
