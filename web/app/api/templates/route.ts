import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { listTemplates, vaultReady } from "@/lib/vault";

export async function GET(req: Request) {
  const auth = await requireAuth(req as import("next/server").NextRequest);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  return NextResponse.json({ templates: await listTemplates() });
}
