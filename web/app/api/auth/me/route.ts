import { NextRequest, NextResponse } from "next/server";
import { authRequired, loadAuthStore } from "@/lib/auth";
import { getSession } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const required = await authRequired();
  if (!required) {
    return NextResponse.json({ user: null, required: false });
  }
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ user: null, required: true });
  }
  const store = await loadAuthStore();
  const u = store.users[session.user];
  return NextResponse.json({
    user: session.user,
    role: session.role,
    required: true,
    totp_enabled: u?.totp_enabled ?? false,
  });
}
