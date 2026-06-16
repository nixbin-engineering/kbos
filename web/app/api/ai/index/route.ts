import { NextRequest, NextResponse } from "next/server";
import matter from "gray-matter";
import path from "path";
import { embedText } from "@/lib/ai/provider";
import { chunkText, removeDocVectors, saveVectorIndex, upsertDocVectors, vectorIndexStats } from "@/lib/ai/vector-store";
import { loadSettings } from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { readDoc, walkPlainDocs } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — return current index stats */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const stats = await vectorIndexStats();
  return NextResponse.json(stats);
}

/** POST — rebuild the entire vector index (streaming progress) */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const settings = await loadSettings();
  if (!settings.ai.enabled) {
    return NextResponse.json({ error: "AI is disabled" }, { status: 503 });
  }
  if (!settings.ai.embed_model?.trim()) {
    return NextResponse.json({ error: "No embedding model configured" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // Collect all doc paths first
        const docs: { rel: string; raw: string }[] = [];
        await walkPlainDocs(async (rel, raw) => {
          docs.push({ rel, raw });
        });

        send({ type: "start", total: docs.length });

        // Reset the index
        await saveVectorIndex({ version: 1, entries: [] });

        let done = 0;
        let errors = 0;

        for (const { rel, raw } of docs) {
          try {
            const { data, content } = matter(raw);
            const title = (data.title as string) || path.basename(rel, ".md");
            const chunks = chunkText(content);

            const embedded: { text: string; embedding: number[] }[] = [];
            for (const chunk of chunks) {
              const embedding = await embedText(settings.ai, `${title}\n\n${chunk}`);
              embedded.push({ text: chunk, embedding });
            }

            await upsertDocVectors(rel, title, embedded);
            done++;
            send({ type: "progress", done, total: docs.length, path: rel });
          } catch (e) {
            errors++;
            send({ type: "error_doc", path: rel, message: String(e) });
          }
        }

        const stats = await vectorIndexStats();
        send({ type: "done", done, errors, ...stats });
      } catch (e) {
        send({ type: "fatal", message: String(e) });
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

/** PUT — index or re-index a single document */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const settings = await loadSettings();
  if (!settings.ai.embed_model?.trim()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no embed model" });
  }

  const body = await req.json().catch(() => ({})) as { path?: string };
  if (!body.path) return NextResponse.json({ error: "path required" }, { status: 400 });

  try {
    const doc = await readDoc(body.path);
    const chunks = chunkText(doc.body);
    const embedded: { text: string; embedding: number[] }[] = [];
    for (const chunk of chunks) {
      const embedding = await embedText(settings.ai, `${doc.meta.title}\n\n${chunk}`);
      embedded.push({ text: chunk, embedding });
    }
    await upsertDocVectors(body.path, doc.meta.title || body.path, embedded);
    return NextResponse.json({ ok: true, path: body.path, chunks: chunks.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** DELETE — remove a document from the vector index */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json().catch(() => ({})) as { path?: string };
  if (!body.path) return NextResponse.json({ error: "path required" }, { status: 400 });

  await removeDocVectors(body.path);
  return NextResponse.json({ ok: true });
}
