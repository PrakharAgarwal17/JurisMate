export type GroqTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type GroqMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: GroqToolCall[];
  images?: Array<{ data: string; mimeType: string }>;
};

async function requestGroq(body: object, signal?: AbortSignal): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, "utf8") >= 20_000_000) throw new Error("Groq inline request exceeds the 20 MB limit");
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: serialized,
      signal: signal ?? AbortSignal.timeout(180_000),
    });
    if (response.status !== 429 || attempt >= 2) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000;
    if (delay > 15000) break;
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return; }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
      function abort() { clearTimeout(timer); reject(signal?.reason); }
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  if (!response.ok) {
    if (response.status === 429) {
      const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (/tokens per day|requests per day/i.test(data?.error?.message ?? "")) throw new Error("Groq daily quota exhausted");
    }
    throw new Error(`Groq request failed (${response.status})`);
  }
  return response.json();
}

export default async function askGroq(messages: GroqMessage[], useSearch = false, signal?: AbortSignal): Promise<string> {
  if (!messages.some(message => message.role === "user")) throw new Error("A user message is required");
  const hasImages = messages.some(message => message.images?.length);
  if (hasImages && useSearch) throw new Error("Image search requests are not supported");
  const model = hasImages ? process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b" : process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const input = messages.map(message => ({
    ...message,
    content: message.images?.length
      ? [{ type: "text", text: message.content ?? "" }, ...message.images.map(image => ({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } }))]
      : message.content,
  }));
  const result = await requestGroq({ model, messages: input, max_completion_tokens: 1024, ...(useSearch ? { tools: [{ type: "browser_search" }], tool_choice: "required" } : {}) }, signal) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = result.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned no text response");
  return text;
}

export async function askGroqWithTools(messages: GroqMessage[], tools: GroqTool[], useSearch = false): Promise<GroqMessage> {
  if (!messages.some(message => message.role === "user")) throw new Error("A user message is required");
  const result = await requestGroq({
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    messages,
    tools: [...tools, ...(useSearch ? [{ type: "browser_search" }] : [])],
    tool_choice: "auto",
    parallel_tool_calls: false,
    max_completion_tokens: 2048,
  }) as { choices?: Array<{ message?: GroqMessage }> };
  const message = result.choices?.[0]?.message;
  if (!message || (typeof message.content !== "string" && !message.tool_calls?.length)) {
    throw new Error("Groq returned no usable agent response");
  }
  return { role: "assistant", content: message.content ?? "", ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) };
}
