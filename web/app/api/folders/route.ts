import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { createFolder, getFolderIndex, vaultReady } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  try {
    return NextResponse.json(await getFolderIndex(""));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const body = await req.json();
  if (typeof body.path !== "string") {
    return NextResponse.json({ error: "path required (use empty string for docs root)" }, { status: 400 });
  }
  try {
    const result = await createFolder(body.path, body.index !== false);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
