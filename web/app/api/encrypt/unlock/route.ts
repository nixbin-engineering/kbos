import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";
import {
  clearFailedAttempts,
  clearUnlockSession,
  getAttemptStatus,
  getUnlockSession,
  recordFailedAttempt,
  setUnlockSession,
  unlockSessionKey,
} from "@/lib/crypto-session";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const user = auth.user || "anon";
  const settings = await loadSettings();
  const { max_unlock_attempts, unlock_lockout_minutes } = settings.security;

  // Check if user is currently locked out
  const status = getAttemptStatus(user, max_unlock_attempts);
  if (status.locked) {
    const until = new Date(status.lockedUntil!).toLocaleTimeString();
    return NextResponse.json(
      { error: `Too many failed attempts. Try again after ${until}.`, locked_until: status.lockedUntil },
      { status: 429 },
    );
  }

  const body = await req.json();
  const passphrase = String(body.passphrase ?? "");
  if (!passphrase) {
    return NextResponse.json({ error: "passphrase required" }, { status: 400 });
  }

  // If caller provides a doc path, validate passphrase by attempting decryption now
  const validatePath = typeof body.validate_path === "string" ? body.validate_path : null;
  if (validatePath) {
    const { readEncryptedDoc } = await import("@/lib/vault");
    try {
      await readEncryptedDoc(validatePath, passphrase);
    } catch {
      const result = recordFailedAttempt(user, max_unlock_attempts, unlock_lockout_minutes);
      if (result.locked) {
        const until = new Date(result.lockedUntil!).toLocaleTimeString();
        return NextResponse.json(
          { error: `Too many failed attempts. Locked until ${until}.`, locked_until: result.lockedUntil },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "Wrong passphrase", attempts_remaining: result.remaining },
        { status: 422 },
      );
    }
  }

  // Passphrase accepted — store in session and clear failed attempts
  const token = req.cookies.get(sessionCookieName())?.value || "anon";
  const key = unlockSessionKey(user, token);
  setUnlockSession(key, passphrase);
  clearFailedAttempts(user);

  return NextResponse.json({ ok: true, unlocked: true });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const user = auth.user || "anon";
  const token = req.cookies.get(sessionCookieName())?.value || "anon";
  const key = unlockSessionKey(user, token);
  const settings = await loadSettings();

  return NextResponse.json({
    unlocked: Boolean(getUnlockSession(key)),
    ...getAttemptStatus(user, settings.security.max_unlock_attempts),
    max_attempts: settings.security.max_unlock_attempts,
    lockout_minutes: settings.security.unlock_lockout_minutes,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const user = auth.user || "anon";
  const token = req.cookies.get(sessionCookieName())?.value || "anon";
  const key = unlockSessionKey(user, token);
  clearUnlockSession(key);
  return NextResponse.json({ ok: true, unlocked: false });
}
