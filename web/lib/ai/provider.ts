import type { AISettings } from "../settings";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function resolveBaseUrl(settings: AISettings): string {
  const fromEnv = process.env.AI_BASE_URL?.trim();
  const base = (fromEnv || settings.base_url || "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  return base;
}

function resolveApiKey(): string {
  return process.env.AI_API_KEY?.trim() || "ollama";
}

export async function streamChatCompletion(
  settings: AISettings,
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<void> {
  const baseUrl = resolveBaseUrl(settings);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolveApiKey()}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: true,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `LLM request failed (${res.status})`);
  }

  if (!res.body) throw new Error("LLM returned empty body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string; reasoning_content?: string } }[];
        };
        const delta = json.choices?.[0]?.delta;
        const token = delta?.content || delta?.reasoning_content;
        if (token) onToken(token);
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}

export async function embedText(settings: AISettings, text: string): Promise<number[]> {
  const embedModel = settings.embed_model?.trim();
  if (!embedModel) throw new Error("No embedding model configured");

  const baseUrl = resolveBaseUrl(settings);
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolveApiKey()}`,
    },
    body: JSON.stringify({ model: embedModel, input: text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `Embedding request failed (${res.status})`);
  }

  const data = await res.json() as { data?: { embedding: number[] }[]; embedding?: number[] };
  // OpenAI format: data[0].embedding; some providers return embedding directly
  const embedding = data.data?.[0]?.embedding ?? (data as { embedding?: number[] }).embedding;
  if (!Array.isArray(embedding)) throw new Error("Unexpected embedding response shape");
  return embedding;
}

export async function fetchModels(baseUrl: string): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${url}/models`, {
    headers: { Authorization: `Bearer ${resolveApiKey()}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`);
  const data = await res.json() as { data?: { id: string }[]; models?: { name: string }[] };
  // OpenAI format
  if (Array.isArray(data.data)) return data.data.map((m) => m.id).sort();
  // Ollama /api/tags format (some versions)
  if (Array.isArray(data.models)) return data.models.map((m) => m.name).sort();
  return [];
}

export async function probeAI(settings: AISettings): Promise<{ ok: boolean; message: string }> {
  if (!settings.enabled) return { ok: false, message: "AI is disabled in settings" };
  if (!settings.model.trim()) return { ok: false, message: "No model configured" };

  try {
    const baseUrl = resolveBaseUrl(settings);
    const models = await fetchModels(baseUrl);
    if (models.length > 0) return { ok: true, message: "Connected" };
    return { ok: false, message: "Connected but no models available" };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
