import { NextRequest, NextResponse } from "next/server";
import {
  authRequired,
  createSessionToken,
  DEVICE_COOKIE,
  getSessionSecret,
  loadAuthStore,
  sessionCookieName,
  verifyDeviceToken,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, LOGIN_MAX, LOGIN_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const username = (body.username || "").trim();
  const password = body.password || "";
  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  const store = await loadAuthStore();
  const u = store.users[username];
  if (!u || !(await verifyPassword(u.password_hash, password))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const secret = store.session_secret || (await getSessionSecret());
  if (!secret) {
    return NextResponse.json({ error: "session not configured" }, { status: 500 });
  }

  const totpRequired = store.totp_required ?? false;
  const userHasTotp = u.totp_enabled && u.totp_secret;

  // If TOTP is enforced system-wide but user hasn't set it up yet → force enrollment
  if (totpRequired && !userHasTotp) {
    // Issue a short-lived pre-auth token so the enrollment endpoint knows who's enrolling
    const preToken = createSessionToken(username, u.role, secret);
    const res = NextResponse.json({ totp_setup_required: true, user: username });
    res.cookies.set("kbos_preauth", preToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60, // 10 minutes to complete enrollment
    });
    return res;
  }

  // If user has TOTP enabled, require verification — unless device is remembered
  if (userHasTotp) {
    const deviceToken = req.cookies.get(DEVICE_COOKIE)?.value;
    if (deviceToken) {
      const deviceUser = verifyDeviceToken(deviceToken, secret);
      if (deviceUser === username) {
        // Trusted device — skip TOTP
        return issueSession(username, u.role, secret);
      }
    }
    return NextResponse.json({ totp_required: true, user: username });
  }

  return issueSession(username, u.role, secret);
}

function issueSession(username: string, role: string, secret: string): NextResponse {
  const token = createSessionToken(username, role, secret);
  const res = NextResponse.json({ user: username, role });
  const isProduction = process.env.NODE_ENV === "production";
  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 14 * 86400,
  });
  return res;
}

export async function GET() {
  const required = await authRequired();
  return NextResponse.json({ required });
}
