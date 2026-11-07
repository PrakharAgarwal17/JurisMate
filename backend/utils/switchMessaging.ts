import { switchAgentConfig } from "../config/switchAgent.js";

export type ChatPlatform = "discord" | "slack";

export async function postToSwitchRoom(roomId: string, content: string): Promise<void> {
  const { bridgeUrl, agentId, apiKey } = switchAgentConfig;
  if (!roomId || !bridgeUrl || !agentId || !apiKey) {
    throw new Error("Switch integration is not configured");
  }
  if (!content.trim()) throw new Error("Message content is required");

  const response = await fetch(
    `${bridgeUrl.replace(/\/$/, "")}/agents/${encodeURIComponent(agentId)}/message`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room_id: roomId, content }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Switch Agent Bridge rejected the message (${response.status})`);
  }
}

export async function readSwitchRoom(roomId: string): Promise<unknown> {
  const { bridgeUrl, agentId, apiKey } = switchAgentConfig;
  if (!bridgeUrl || !agentId || !apiKey) throw new Error("Switch integration is not configured");
  const response = await fetch(`${bridgeUrl.replace(/\/$/, "")}/agents/${encodeURIComponent(agentId)}/ops/read_context`, {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ room_id: roomId, limit: 50 }), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Switch room read failed (${response.status})`);
  const data = await response.json() as { result?: unknown };
  return data.result;
}
