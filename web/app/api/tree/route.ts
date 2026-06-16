import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { listTree, vaultReady } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  try {
    const settings = await loadSettings();
    return NextResponse.json(await listTree(settings.ui.attachments_subdir));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
