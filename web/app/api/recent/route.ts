import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { listRecentDocs, vaultReady } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 12));
  const recent = await listRecentDocs(limit);
  return NextResponse.json({ recent });
}
