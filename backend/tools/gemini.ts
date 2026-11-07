type ModelMessage = {
  role: "system" | "user";
  content: string;
  images?: Array<{ data: string; mimeType: string }>;
};

export default async function askGemini(messages: ModelMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const system = messages.filter((message) => message.role === "system").map((message) => ({ text: message.content }));
  const contents = messages.filter((message) => message.role === "user").map((message) => ({
    role: "user",
    parts: [{ text: message.content }, ...(message.images ?? []).map((image) => ({ inlineData: image }))],
  }));
  if (!contents.length) throw new Error("A user message is required");

  const body = JSON.stringify({ contents, ...(system.length ? { systemInstruction: { parts: system } } : {}) });
  if (Buffer.byteLength(body, "utf8") >= 20_000_000) throw new Error("Gemini inline request exceeds the 20 MB limit");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body,
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text response");
  return text;
}
