import { mkdir, rename } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { invalidateLinkIndex } from "@/lib/links";
import { deleteFolder, docsDir, getFolderIndex, vaultReady } from "@/lib/vault";

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
  try {
    return NextResponse.json(await getFolderIndex(relFromSegments(segments)));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — rename/move folder: body { newPath: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) return NextResponse.json({ error: ready.message }, { status: 503 });

  const { path: segments } = await params;
  const rel = relFromSegments(segments);
  const body = await req.json();
  const newRel: string = String(body.newPath ?? "").trim().replace(/\/+$/, "");

  try {
    const docs = docsDir();
    const srcAbs = path.join(docs, rel);
    const dstAbs = path.join(docs, newRel);
    if (!srcAbs.startsWith(docs) || !dstAbs.startsWith(docs)) {
      return NextResponse.json({ error: "path outside vault" }, { status: 400 });
    }
    if (srcAbs === dstAbs) return NextResponse.json({ error: "same path" }, { status: 400 });
    await mkdir(path.dirname(dstAbs), { recursive: true });
    await rename(srcAbs, dstAbs);
    invalidateLinkIndex();
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
  try {
    await deleteFolder(relFromSegments(segments));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
