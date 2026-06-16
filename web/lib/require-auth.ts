import { NextRequest, NextResponse } from "next/server";
import {
  authRequired,
  getSessionSecret,
  sessionCookieName,
  verifySessionToken,
  type SessionPayload,
} from "./auth";

const PUBLIC_PREFIXES = ["/api/setup", "/api/auth/login", "/api/health"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const secret = await getSessionSecret();
  if (!secret) return null;
  const token = req.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  return verifySessionToken(token, secret);
}

/**
 * CSRF origin check: for state-mutating requests, verify Origin/Referer matches
 * the request host. This is defence-in-depth alongside sameSite:strict.
 */
function csrfSafe(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return true; // can't check — allow (reverse-proxy sets this)
  const check = origin || referer;
  if (!check) return true; // same-origin browser requests may omit origin on some methods
  try {
    const url = new URL(check);
    return url.host === host;
  } catch {
    return false;
  }
}

/** Returns 401/403 response if auth fails or CSRF check fails. */
export async function requireAuth(req: NextRequest): Promise<SessionPayload | NextResponse> {
  if (isPublicApi(req.nextUrl.pathname)) {
    return { user: "", role: "guest", exp: 0 };
  }

  if (!csrfSafe(req)) {
    return NextResponse.json({ error: "invalid origin" }, { status: 403 });
  }

  const required = await authRequired();
  if (!required) {
    return { user: "", role: "guest", exp: 0 };
  }
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  return session;
}

/** Requires admin role; returns 403 if not admin. */
export function requireAdmin(auth: SessionPayload): NextResponse | null {
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }
  return null;
}

export function isAuthError(v: SessionPayload | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
