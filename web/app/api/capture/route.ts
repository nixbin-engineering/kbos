import { NextRequest, NextResponse } from "next/server";
import { invalidateLinkIndex } from "@/lib/links";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadSettings } from "@/lib/settings";
import { createDoc, vaultReady } from "@/lib/vault";

function captureStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }

  const settings = await loadSettings();
  const folder = settings.ui.capture_folder || "inbox";
  const now = new Date();
  const relPath = `${folder}/capture-${captureStamp(now)}.md`;
  const heading = now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const body = await req.json().catch(() => ({}));
  const initial = typeof body.text === "string" && body.text.trim() ? `${body.text.trim()}\n` : "";

  try {
    const doc = await createDoc(
      relPath,
      `---\ntitle: Capture ${heading}\ncreated: ${now.toISOString()}\n---\n\n${initial}`
    );
    invalidateLinkIndex();
    return NextResponse.json({ path: doc.path, created: true }, { status: 201 });
  } catch (e) {
    const msg = String(e);
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
