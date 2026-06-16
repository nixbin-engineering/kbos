import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAdmin, requireAuth } from "@/lib/require-auth";
import { loadAuthStore, saveAuthStore } from "@/lib/auth";

// GET — return current TOTP enforcement policy
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const deny = requireAdmin(auth);
  if (deny) return deny;

  const store = await loadAuthStore();
  const users = Object.entries(store.users).map(([username, u]) => ({
    username,
    totp_enabled: u.totp_enabled ?? false,
  }));
  return NextResponse.json({ totp_required: store.totp_required ?? false, users });
}

// PUT — toggle system-wide TOTP enforcement
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const deny = requireAdmin(auth);
  if (deny) return deny;

  const body = await req.json();
  if (typeof body.totp_required !== "boolean") {
    return NextResponse.json({ error: "totp_required (boolean) required" }, { status: 400 });
  }

  const store = await loadAuthStore();
  store.totp_required = body.totp_required;
  await saveAuthStore(store);

  return NextResponse.json({ totp_required: store.totp_required });
}
