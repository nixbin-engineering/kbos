import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import {
  getSessionSecret,
  loadAuthStore,
  saveAuthStore,
  sessionCookieName,
  verifySessionToken,
} from "@/lib/auth";

const APP_NAME = "KBOS";

// Resolve who's calling: full session OR pre-auth cookie (during forced enrollment)
async function resolveUser(req: NextRequest): Promise<{ username: string; role: string } | null> {
  const secret = await getSessionSecret();
  if (!secret) return null;

  // Full session
  const session = req.cookies.get(sessionCookieName())?.value;
  if (session) {
    const p = verifySessionToken(session, secret);
    if (p) return { username: p.user, role: p.role };
  }

  // Pre-auth cookie (password verified, forced enrollment in progress)
  const preauth = req.cookies.get("kbos_preauth")?.value;
  if (preauth) {
    const p = verifySessionToken(preauth, secret);
    if (p) return { username: p.user, role: p.role };
  }

  return null;
}

// GET — generate a new TOTP secret and return QR code data URL
export async function GET(req: NextRequest) {
  const caller = await resolveUser(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(caller.username, APP_NAME, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ secret, qr: qrDataUrl, otpauth_url: otpauthUrl });
}

// POST — confirm a TOTP code to finalize enrollment
export async function POST(req: NextRequest) {
  const caller = await resolveUser(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { secret, code } = body;
  if (!secret || !code) return NextResponse.json({ error: "secret and code required" }, { status: 400 });

  if (!authenticator.verify({ token: String(code), secret })) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  const store = await loadAuthStore();
  const u = store.users[caller.username];
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });

  u.totp_secret = secret;
  u.totp_enabled = true;
  await saveAuthStore(store);

  // If they were in forced-enrollment flow, clear pre-auth and issue full session
  const sessionSecret = await getSessionSecret();
  if (!sessionSecret) return NextResponse.json({ error: "session not configured" }, { status: 500 });

  const { createSessionToken, sessionCookieName: cookieName } = await import("@/lib/auth");
  const token = createSessionToken(caller.username, caller.role, sessionSecret);
  const res = NextResponse.json({ ok: true, enrolled: true });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(cookieName(), token, {
    httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 14 * 86400,
  });
  res.cookies.delete("kbos_preauth");
  return res;
}

// DELETE — disable TOTP for self (or admin disabling for any user)
export async function DELETE(req: NextRequest) {
  const caller = await resolveUser(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target = caller.role === "admin" && body.username ? body.username : caller.username;

  const store = await loadAuthStore();
  const u = store.users[target];
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });

  u.totp_enabled = false;
  delete u.totp_secret;
  await saveAuthStore(store);

  return NextResponse.json({ ok: true });
}
