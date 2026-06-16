import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { generateId, generatePassword, listEntries, saveEntry } from "@/lib/passwords";
import { getUnlockSession, unlockSessionKey } from "@/lib/crypto-session";
import { sessionCookieName } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const user = auth.user || "anon";
  try {
    const entries = await listEntries(user);
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const token = req.cookies.get(sessionCookieName())?.value || "anon";
  const user = auth.user || "anon";

  const body = await req.json();
  const { action } = body;

  // Generate password doesn't need vault unlock
  if (action === "generate") {
    return NextResponse.json({ password: generatePassword(body.length ?? 20, body.symbols !== false) });
  }

  const passphrase = getUnlockSession(unlockSessionKey(user, token));
  if (!passphrase) {
    return NextResponse.json({ error: "vault locked — unlock first", locked: true }, { status: 423 });
  }

  const { title, username, password, url, totp_secret, notes, tags, shared_with } = body;
  if (!title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const entry = {
    id: generateId(),
    title: title.trim(),
    username: (username || "").trim(),
    password: password || "",
    url: url?.trim() || undefined,
    totp_secret: totp_secret?.trim() || undefined,
    notes: notes?.trim() || undefined,
    tags: Array.isArray(tags) ? tags : undefined,
    shared_with: Array.isArray(shared_with) ? shared_with : [],
    owner: user,
    created_at: now,
    updated_at: now,
  };

  try {
    await saveEntry(entry, passphrase);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  const { password: _p, totp_secret: _t, ...meta } = entry;
  return NextResponse.json({ entry: meta }, { status: 201 });
}
