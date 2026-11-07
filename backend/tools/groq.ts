type ModelMessage = {
  role: "system" | "user";
  content: string;
  images?: Array<{ data: string; mimeType: string }>;
};

export default async function askGroq(messages: ModelMessage[], useSearch = false): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  if (!messages.some(message => message.role === "user")) throw new Error("A user message is required");
  const hasImages = messages.some(message => message.images?.length);
  if (hasImages && useSearch) throw new Error("Image search requests are not supported");
  const model = hasImages ? process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b" : process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const input = messages.map(message => ({
    role: message.role,
    content: message.images?.length
      ? [{ type: "text", text: message.content }, ...message.images.map(image => ({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } }))]
      : message.content,
  }));
  const body = JSON.stringify({ model, messages: input, ...(useSearch ? { tools: [{ type: "browser_search" }], tool_choice: "required" } : {}) });
  if (Buffer.byteLength(body, "utf8") >= 20_000_000) throw new Error("Groq inline request exceeds the 20 MB limit");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Groq request failed (${response.status})`);
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = result.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned no text response");
  return text;
}
