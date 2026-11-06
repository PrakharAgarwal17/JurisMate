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
