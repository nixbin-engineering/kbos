import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { searchDocs, vaultReady } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const q = req.nextUrl.searchParams.get("q") || "";
  const limit = Number(req.nextUrl.searchParams.get("limit") || "30");
  const hits = await searchDocs(q, limit);
  return NextResponse.json({ hits });
}
