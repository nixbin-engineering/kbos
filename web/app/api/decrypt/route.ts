import { NextRequest, NextResponse } from "next/server";
import { kbDecryptFolder, kbDecryptNote } from "@/lib/kb-runner";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const targetPath = String(body.path ?? "").trim();
  const kind = body.kind === "folder" ? "folder" : "file";
  const passphrase = String(body.passphrase ?? "");

  if (!passphrase) {
    return NextResponse.json({ error: "passphrase required" }, { status: 400 });
  }

  try {
    if (kind === "folder") {
      const count = await kbDecryptFolder(targetPath, passphrase);
      return NextResponse.json({ ok: true, kind, path: targetPath, count });
    }
    if (!targetPath) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }
    await kbDecryptNote(targetPath, passphrase);
    return NextResponse.json({ ok: true, kind, path: targetPath, count: 1 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
