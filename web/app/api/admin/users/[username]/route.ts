import { NextRequest, NextResponse } from "next/server";
import { hashPassword, loadAuthStore, saveAuthStore } from "@/lib/auth";
import { isAuthError, requireAuth } from "@/lib/require-auth";

type Params = { params: Promise<{ username: string }> };

async function requireAdmin(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return { error: auth };
  if (auth.role !== "admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { auth };
}

// PATCH — update password or role: { password?, role? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  const { username } = await params;
  const body = await req.json();
  const store = await loadAuthStore();
  if (!store.users[username]) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (body.password) {
    if (String(body.password).length < 6) return NextResponse.json({ error: "password must be at least 6 characters" }, { status: 400 });
    store.users[username].password_hash = await hashPassword(String(body.password));
  }
  if (body.role === "admin" || body.role === "editor") {
    store.users[username].role = body.role;
  }
  await saveAuthStore(store);
  return NextResponse.json({ ok: true, username, role: store.users[username].role });
}

// DELETE — remove user
export async function DELETE(req: NextRequest, { params }: Params) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;
  const { username } = await params;
  const currentUser = check.auth!.user;
  if (username === currentUser) return NextResponse.json({ error: "cannot delete your own account" }, { status: 400 });
  const store = await loadAuthStore();
  if (!store.users[username]) return NextResponse.json({ error: "user not found" }, { status: 404 });
  // Prevent deleting last admin
  const admins = Object.entries(store.users).filter(([, u]) => u.role === "admin");
  if (store.users[username].role === "admin" && admins.length <= 1) {
    return NextResponse.json({ error: "cannot delete the last admin" }, { status: 400 });
  }
  delete store.users[username];
  await saveAuthStore(store);
  return NextResponse.json({ ok: true });
}
