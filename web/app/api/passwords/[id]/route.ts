import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { deleteEntry, getEntry, saveEntry } from "@/lib/passwords";
import { canAccessShared } from "@/lib/groups";
import { getUnlockSession, unlockSessionKey } from "@/lib/crypto-session";
import { sessionCookieName } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

function getPassphrase(req: NextRequest, user: string): string | null {
  const token = req.cookies.get(sessionCookieName())?.value || "anon";
  return getUnlockSession(unlockSessionKey(user, token));
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  const user = auth.user || "anon";
  const passphrase = getPassphrase(req, user);
  if (!passphrase) {
    return NextResponse.json({ error: "vault locked — unlock first", locked: true }, { status: 423 });
  }

  try {
    const entry = await getEntry(id, passphrase);
    const owned = entry.owner === user;
    const accessible = owned || await canAccessShared(entry.shared_with ?? [], user);
    if (!accessible) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ entry });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("Unsupported state") || msg.includes("bad decrypt")) {
      return NextResponse.json({ error: "wrong passphrase" }, { status: 422 });
    }
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  const user = auth.user || "anon";
  const passphrase = getPassphrase(req, user);
  if (!passphrase) {
    return NextResponse.json({ error: "vault locked", locked: true }, { status: 423 });
  }

  // Fetch existing to verify ownership
  const existing = await getEntry(id, passphrase).catch(() => null);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const existingOwned = existing.owner === user;
  const existingAccessible = existingOwned || await canAccessShared(existing.shared_with ?? [], user);
  if (!existingAccessible) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const updated = {
    ...existing,
    title: body.title ?? existing.title,
    username: body.username ?? existing.username,
    password: body.password ?? existing.password,
    url: body.url ?? existing.url,
    totp_secret: body.totp_secret ?? existing.totp_secret,
    notes: body.notes ?? existing.notes,
    tags: body.tags ?? existing.tags,
    shared_with: body.shared_with ?? existing.shared_with ?? [],
    updated_at: new Date().toISOString(),
  };

  await saveEntry(updated, passphrase);
  const { password: _p, totp_secret: _t, ...meta } = updated;
  return NextResponse.json({ entry: meta });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { id } = await params;
  const user = auth.user || "anon";
  const passphrase = getPassphrase(req, user);
  if (!passphrase) {
    return NextResponse.json({ error: "vault locked", locked: true }, { status: 423 });
  }

  const existing = await getEntry(id, passphrase).catch(() => null);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const delOwned = existing.owner === user;
  const delAccessible = delOwned || await canAccessShared(existing.shared_with ?? [], user);
  if (!delAccessible) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await deleteEntry(id);
  return NextResponse.json({ ok: true });
}
