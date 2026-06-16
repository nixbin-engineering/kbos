import { rename } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";
import { getUnlockSession, unlockSessionKey } from "@/lib/crypto-session";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { invalidateLinkIndex } from "@/lib/links";
import { EncryptedDocError, readDoc, safeDocPath, vaultReady, writeDoc, deleteDoc, docsDir } from "@/lib/vault";
import { removeDocVectors } from "@/lib/ai/vector-store";

type Params = { params: Promise<{ path: string[] }> };

function relFromSegments(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const { path: segments } = await params;
  const rel = relFromSegments(segments);
  try {
    safeDocPath(rel);
    const token = req.cookies.get(sessionCookieName())?.value || "anon";
    const pass = getUnlockSession(unlockSessionKey(auth.user || "anon", token));
    return NextResponse.json(await readDoc(rel, pass));
  } catch (e) {
    if (e instanceof EncryptedDocError) {
      return NextResponse.json({ error: "encrypted", encrypted: true }, { status: 423 });
    }
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const { path: segments } = await params;
  const rel = relFromSegments(segments);
  const body = await req.json();
  if (typeof body.raw !== "string") {
    return NextResponse.json({ error: "raw string required" }, { status: 400 });
  }
  try {
    safeDocPath(rel);
    await writeDoc(rel, body.raw);
    invalidateLinkIndex();
    const doc = await readDoc(rel);
    // Fire-and-forget incremental vector index update (no embed model = no-op inside)
    void fetch(new URL("/api/ai/index", req.url).toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
      body: JSON.stringify({ path: rel }),
    }).catch(() => undefined);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

// PATCH /api/docs/[...path] — rename or move: body { newPath: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) return NextResponse.json({ error: ready.message }, { status: 503 });

  const { path: segments } = await params;
  const rel = relFromSegments(segments);
  const body = await req.json();
  const newRel: string = String(body.newPath ?? "").trim().replace(/\.md$/, "") + ".md";

  try {
    const srcAbs = safeDocPath(rel);
    const dstAbs = safeDocPath(newRel);
    if (srcAbs === dstAbs) return NextResponse.json({ error: "same path" }, { status: 400 });
    // Ensure destination directory exists
    const { mkdir } = await import("fs/promises");
    await mkdir(path.dirname(dstAbs), { recursive: true });
    await rename(srcAbs, dstAbs);
    invalidateLinkIndex();
    void removeDocVectors(rel).catch(() => undefined);
    return NextResponse.json({ ok: true, oldPath: rel, newPath: newRel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const { path: segments } = await params;
  const rel = relFromSegments(segments);
  try {
    safeDocPath(rel);
    await deleteDoc(rel);
    invalidateLinkIndex();
    void removeDocVectors(rel).catch(() => undefined);
    return NextResponse.json({ ok: true, path: rel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
