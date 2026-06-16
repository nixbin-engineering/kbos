import { NextRequest, NextResponse } from "next/server";
import { hashPassword, loadAuthStore, saveAuthStore } from "@/lib/auth";
import { isAuthError, requireAuth } from "@/lib/require-auth";

async function requireAdmin(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return { error: auth };
  if (auth.role !== "admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { auth };
}

// GET — list users (no password hashes)
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  const store = await loadAuthStore();
  const users = Object.entries(store.users).map(([username, u]) => ({
    username,
    role: u.role,
  }));
  return NextResponse.json({ users });
}

// POST — create user: { username, password, role }
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  const body = await req.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : "editor";
  if (!username || username.length < 2) return NextResponse.json({ error: "username must be at least 2 characters" }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: "password must be at least 6 characters" }, { status: 400 });
  const store = await loadAuthStore();
  if (store.users[username]) return NextResponse.json({ error: "user already exists" }, { status: 409 });
  store.users[username] = { password_hash: await hashPassword(password), role };
  await saveAuthStore(store);
  return NextResponse.json({ ok: true, username, role });
}
