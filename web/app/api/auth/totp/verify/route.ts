import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import {
  createSessionToken,
  DEVICE_COOKIE,
  DEVICE_DAYS,
  getSessionSecret,
  loadAuthStore,
  sessionCookieName,
  signDeviceToken,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`totp:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json();
  const { username, code, remember } = body;
  if (!username || !code) {
    return NextResponse.json({ error: "username and code required" }, { status: 400 });
  }

  const store = await loadAuthStore();
  const u = store.users[username];
  if (!u || !u.totp_enabled || !u.totp_secret) {
    return NextResponse.json({ error: "TOTP not configured" }, { status: 400 });
  }

  if (!authenticator.verify({ token: String(code), secret: u.totp_secret })) {
    return NextResponse.json({ error: "invalid code" }, { status: 401 });
  }

  const secret = store.session_secret || (await getSessionSecret());
  if (!secret) return NextResponse.json({ error: "session not configured" }, { status: 500 });

  const token = createSessionToken(username, u.role, secret);
  const res = NextResponse.json({ user: username, role: u.role });
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 14 * 86400,
  });

  if (remember) {
    const deviceToken = signDeviceToken(username, secret);
    res.cookies.set(DEVICE_COOKIE, deviceToken, {
      httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: DEVICE_DAYS * 86400,
    });
  }

  return res;
}
