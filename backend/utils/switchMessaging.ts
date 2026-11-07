import { switchAgentConfig } from "../config/switchAgent.js";

export type ChatPlatform = "discord" | "slack";

export function channelIdFromLink(platform: ChatPlatform, input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return null;
    if (platform === "discord" && url.hostname === "discord.com") return url.pathname.match(/^\/channels\/\d+\/(\d+)\/?$/)?.[1] ?? null;
    if (platform === "slack" && url.hostname.endsWith(".slack.com")) return url.pathname.match(/^\/archives\/([A-Z0-9]+)\/?$/)?.[1] ?? null;
  } catch { return null; }
  return null;
}

export async function findSwitchRoomByChannel(platform: ChatPlatform, channelId: string): Promise<string | null> {
  const { bridgeUrl, agentId, apiKey } = switchAgentConfig;
  if (!bridgeUrl || !agentId || !apiKey) throw new Error("Switch integration is not configured");
  async function operation(name: string, body: object): Promise<unknown> {
    const response = await fetch(`${bridgeUrl!.replace(/\/$/, "")}/agents/${encodeURIComponent(agentId!)}/ops/${name}`, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Switch room lookup failed (${response.status})`);
    return ((await response.json()) as { result: unknown }).result;
  }
  const rooms = await operation("list_rooms", {});
  if (!Array.isArray(rooms)) throw new Error("Invalid Switch room list");
  const bridges = await operation("list_bridges", {});
  if (!Array.isArray(bridges)) throw new Error("Invalid Switch bridge list");
  for (const room of rooms) {
    if (typeof room?.room_id !== "string") continue;
    const detail = await operation("get_room_detail", { room_id: room.room_id }) as { external_channel_id?: string; bridge_id?: string };
    if (detail.external_channel_id === channelId && bridges.some(bridge => bridge.id === detail.bridge_id && bridge.type === platform)) return room.room_id;
  }
  return null;
}

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
