import { NextRequest, NextResponse } from "next/server";
import { completeSetup, needsSetup } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await needsSetup())) {
    return NextResponse.json({ error: "setup already completed" }, { status: 409 });
  }
  const body = await req.json();
  const username = (body.username || "admin").trim();
  const password = body.password || "";
  if (!username || password.length < 8) {
    return NextResponse.json({ error: "username and password (8+ chars) required" }, { status: 400 });
  }
  if (password !== body.confirm) {
    return NextResponse.json({ error: "passwords do not match" }, { status: 400 });
  }
  try {
    await completeSetup(username, password);
    return NextResponse.json({ ok: true, username });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
