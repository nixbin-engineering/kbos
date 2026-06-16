import { NextRequest, NextResponse } from "next/server";
import { listAllTags, vaultReady } from "@/lib/vault";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const tags = await listAllTags();
  return NextResponse.json({ tags });
}
