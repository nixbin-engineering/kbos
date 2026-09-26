import type { AISettings } from "../settings";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function resolveBaseUrl(settings: AISettings): string {
  const fromEnv = process.env.AI_BASE_URL?.trim();
  const base = (fromEnv || settings.base_url || "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  return base;
}

function resolveEmbedBaseUrl(settings: AISettings): string {
  const fromEnv = process.env.AI_EMBED_BASE_URL?.trim();
  const base = fromEnv || settings.embed_base_url?.trim();
  return base ? base.replace(/\/$/, "") : resolveBaseUrl(settings);
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

  const baseUrl = resolveEmbedBaseUrl(settings);
  const target = `${baseUrl}/embeddings`;
  let res: Response;
  try {
    res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolveApiKey()}`,
      },
      body: JSON.stringify({ model: embedModel, input: text }),
    });
  } catch (e) {
    throw new Error(
      `Cannot reach ${target} from the KBOS container (${String(e)}). ` +
        `Bind the embed server to 0.0.0.0 and use http://host.docker.internal:<port>/v1.`,
    );
  }

  const textBody = await res.text();
  if (!res.ok) {
    throw new Error(textBody.slice(0, 300) || `Embedding request failed (${res.status})`);
  }
  if (textBody.trim().startsWith("<!") || textBody.trim().startsWith("<html")) {
    throw new Error(`${target} returned HTML instead of JSON — wrong port/path for embeddings API.`);
  }
  let data: { data?: { embedding: number[] }[]; embedding?: number[] };
  try {
    data = JSON.parse(textBody) as { data?: { embedding: number[] }[]; embedding?: number[] };
  } catch {
    throw new Error(`Invalid JSON from ${target}: ${textBody.slice(0, 120)}`);
  }
  // OpenAI format: data[0].embedding; some providers return embedding directly
  const embedding = data.data?.[0]?.embedding ?? data.embedding;
  if (!Array.isArray(embedding)) throw new Error("Unexpected embedding response shape");
  return embedding;
}

export async function fetchModels(baseUrl: string): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "");
  const target = `${url}/models`;
  let res: Response;
  try {
    res = await fetch(target, {
      headers: { Authorization: `Bearer ${resolveApiKey()}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    throw new Error(
      `Cannot reach ${target} from the KBOS container (${String(e)}). ` +
        `If the LLM runs on the Mac host, it must listen on 0.0.0.0 (not only 127.0.0.1), ` +
        `and base URL should be http://host.docker.internal:<port>/v1.`,
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to fetch models (${res.status}) from ${target}: ${text.slice(0, 200)}`);
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
    throw new Error(
      `${target} returned HTML instead of JSON — that port is serving a web page, not an OpenAI-compatible /v1 API. ` +
        `Check the MLX/Ollama listen port and path (expected GET …/v1/models → JSON).`,
    );
  }
  let data: { data?: { id: string }[]; models?: { name: string }[] };
  try {
    data = JSON.parse(trimmed) as { data?: { id: string }[]; models?: { name: string }[] };
  } catch {
    throw new Error(`Invalid JSON from ${target}: ${trimmed.slice(0, 120)}`);
  }
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

export async function probeEmbedAI(settings: AISettings): Promise<{ ok: boolean; message: string }> {
  if (!settings.enabled) return { ok: false, message: "AI is disabled in settings" };
  if (!settings.embed_model?.trim()) return { ok: false, message: "No embedding model configured" };

  try {
    const embedding = await embedText(settings, "connection test");
    return { ok: true, message: `Connected · ${embedding.length}-dim vectors` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
