import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAdmin, requireAuth } from "@/lib/require-auth";
import { aboutInfo } from "@/lib/version";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const denied = requireAdmin(auth);
  if (denied) return denied;
  return NextResponse.json(await aboutInfo());
}
