import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { switchAgentConfig } from "../config/switchAgent.js";
import { runSwitchAgentMessage } from "./agentRuntime.js";
import { postToSwitchRoom } from "../utils/switchMessaging.js";

type Frame = {
  event?: string;
  id?: number;
  data?: { code?: string; room_id?: string; payload?: { addressed?: boolean; body?: string; sender_kind?: string; sender_id?: string; sender_agent_id?: string } };
};

export function startSwitchListener(): void {
  const { bridgeUrl, agentId, apiKey } = switchAgentConfig;
  if (!bridgeUrl || !agentId || !apiKey) {
    console.warn("Switch listener disabled: agent settings are missing");
    return;
  }

  const connectionId = randomUUID();
  // shortcut: the cursor survives reconnects within this process only; persist it before running multiple instances.
  let cursor: number | undefined;
  let queue = Promise.resolve();

  function connect(): void {
    let stopped = false;
    let failed = false;
    const url = new URL(`/agents/${encodeURIComponent(agentId!)}/connection/ws`, bridgeUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("connection_id", connectionId);
    url.searchParams.set("scope", "all");
    url.searchParams.set("filter", "addressed");
    if (cursor !== undefined) url.searchParams.set("start_from", String(cursor));
    const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });

    socket.on("open", () => console.log("Switch agent connected"));
    socket.on("message", (raw) => {
      let frame: Frame;
      try { frame = JSON.parse(raw.toString()) as Frame; }
      catch { console.error("Switch sent an invalid frame"); return; }
      if (frame.event === "ping") {
        socket.send(JSON.stringify({ type: "pong", ...(cursor === undefined ? {} : { cursor }) }));
        return;
      }
      if (frame.event === "refused" || frame.event === "evicted") {
        console.error(`Switch connection ${frame.event}`);
        if (frame.event === "evicted" && frame.data?.code === "taken_over") stopped = true;
        return;
      }
      if (frame.event !== "message") return;
      queue = queue.then(async () => {
        if (failed) return;
        const { room_id: roomId, payload } = frame.data ?? {};
        if (typeof frame.id === "number" && cursor !== undefined && frame.id <= cursor) return;
        const ownMessage = payload?.sender_id === agentId || payload?.sender_agent_id === agentId;
        if (roomId && payload?.addressed && !ownMessage && payload.sender_kind !== "platform" && payload.body?.trim()) {
          let reply: string;
          try {
            reply = await runSwitchAgentMessage(roomId, payload.body);
          } catch (error) {
            console.error("JurisMate agent request failed", error);
            reply = "JurisMate ka AI agent abhi available nahi hai. Please try again later.";
          }
          await postToSwitchRoom(roomId, reply);
        }
        if (typeof frame.id === "number") cursor = frame.id;
      }).catch((error: unknown) => {
        failed = true;
        console.error("Switch message handling failed", error);
        socket.close();
      });
    });
    socket.on("error", (error) => console.error("Switch connection error", error.message));
    socket.on("close", () => {
      if (!stopped) void queue.finally(() => setTimeout(connect, 5000));
    });
  }

  connect();
}
