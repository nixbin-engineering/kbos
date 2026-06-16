import { NextRequest } from "next/server";
import { streamChatCompletion, type ChatMessage } from "@/lib/ai/provider";
import {
  buildContextBlock,
  extractCitationPaths,
  retrieveContext,
  type ChatScope,
} from "@/lib/ai/retrieval";
import { loadSettings } from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatRequest = {
  message: string;
  scope?: ChatScope;
  scopePath?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
};

const SYSTEM = `You are KBOS, a knowledge base assistant. Answer using ONLY the provided note excerpts.
Rules:
- Be concise and practical.
- When stating facts from notes, cite the source as a markdown link: [Note Title](relative/path.md)
- If the excerpts do not contain enough information, say what is missing and suggest which folders or tags to explore.
- Do not invent note contents or paths.`;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const settings = await loadSettings();
  if (!settings.ai.enabled) {
    return Response.json({ error: "AI is disabled. Enable it in admin settings." }, { status: 503 });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const scope: ChatScope = body.scope || "vault";
  const scopePath = body.scopePath ?? null;
  const history = (body.history || []).slice(-8);

  const chunks = await retrieveContext(message, scope, scopePath, settings.ai);
  const context = buildContextBlock(chunks);
  const citationPaths = chunks.map((c) => c.path);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "system",
      content: `Knowledge base excerpts (scope: ${scope}${scopePath ? ` → ${scopePath}` : ""}):\n\n${context}`,
    },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        await streamChatCompletion(settings.ai, messages, (token) => {
          full += token;
          send({ type: "token", content: token });
        });
        const cited = [...new Set([...citationPaths, ...extractCitationPaths(full)])];
        send({ type: "done", citations: cited, sources: chunks.map((c) => ({ path: c.path, title: c.title })) });
      } catch (e) {
        send({ type: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
