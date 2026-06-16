import { NextRequest, NextResponse } from "next/server";
import { fetchModels } from "@/lib/ai/provider";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const baseUrl = req.nextUrl.searchParams.get("base_url");
  if (!baseUrl) return NextResponse.json({ error: "base_url required" }, { status: 400 });

  try {
    const models = await fetchModels(baseUrl);
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
