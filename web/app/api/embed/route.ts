import { readDoc, vaultReady } from "@/lib/vault";
import { extractBlock, extractSection } from "@/lib/links-parse";
import { resolveWikiLink } from "@/lib/links";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req as import("next/server").NextRequest);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) return NextResponse.json({ error: ready.message }, { status: 503 });

  const url = new URL(req.url);
  const target = url.searchParams.get("target");
  const from = url.searchParams.get("from") || undefined;
  const section = url.searchParams.get("section") || undefined;
  const block = url.searchParams.get("block") || undefined;

  if (!target) return NextResponse.json({ error: "target required" }, { status: 400 });

  const resolved = await resolveWikiLink(target, from);
  if (resolved.broken || !resolved.path) {
    return NextResponse.json({ error: "not found", broken: true }, { status: 404 });
  }

  const doc = await readDoc(resolved.path);
  let body = doc.body;
  if (section) {
    const fragment = extractSection(body, section);
    if (!fragment) return NextResponse.json({ error: "section not found" }, { status: 404 });
    body = fragment;
  } else if (block) {
    const fragment = extractBlock(body, block);
    if (!fragment) return NextResponse.json({ error: "block not found" }, { status: 404 });
    body = fragment;
  }

  return NextResponse.json({
    path: resolved.path,
    title: doc.meta.title || resolved.title,
    body,
  });
}
