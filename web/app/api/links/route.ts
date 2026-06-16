import { getLinksForDoc, invalidateLinkIndex } from "@/lib/links";
import { vaultReady } from "@/lib/vault";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req as import("next/server").NextRequest);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) return NextResponse.json({ error: ready.message }, { status: 503 });

  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  const target = url.searchParams.get("target");
  const from = url.searchParams.get("from") || undefined;

  if (target) {
    const { resolveWikiLink } = await import("@/lib/links");
    const resolved = await resolveWikiLink(target, from);
    return NextResponse.json(resolved);
  }

  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const links = await getLinksForDoc(path);
  return NextResponse.json(links);
}

export async function POST() {
  invalidateLinkIndex();
  return NextResponse.json({ ok: true });
}
