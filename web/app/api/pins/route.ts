import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadPins, savePins } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  return NextResponse.json({ pins: await loadPins() });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { pins } = await req.json() as { pins: unknown };
  if (!Array.isArray(pins) || !pins.every((p) => typeof p === "string")) {
    return NextResponse.json({ error: "pins must be string[]" }, { status: 400 });
  }

  await savePins(pins as string[]);
  return NextResponse.json({ pins });
}
