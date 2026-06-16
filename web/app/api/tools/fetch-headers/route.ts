import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });

    return NextResponse.json({ status: res.status, statusText: res.statusText, headers });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
