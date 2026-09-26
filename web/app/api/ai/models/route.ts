import { NextRequest, NextResponse } from "next/server";
import { fetchModels } from "@/lib/ai/provider";
import { loadSettings } from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";

function decodeBaseUrl(body: {
  base_url?: string;
  base_url_b64?: string;
}): string {
  if (body.base_url_b64?.trim()) {
    try {
      return Buffer.from(body.base_url_b64.trim(), "base64").toString("utf8").trim();
    } catch {
      return "";
    }
  }
  const raw = String(body.base_url || "").trim();
  // Allow scheme-less values so proxies that flag "http://" in JSON still work
  if (raw && !/^https?:\/\//i.test(raw)) return `http://${raw}`;
  return raw;
}

/**
 * List models for the vault's saved AI base_url (no URL in the query string —
 * reverse-proxy WAFs often block ?base_url=http://… with an HTML 403/404).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const settings = await loadSettings();
  const baseUrl = settings.ai.base_url?.trim();
  if (!baseUrl) return NextResponse.json({ error: "No AI base_url configured — save settings first" }, { status: 400 });

  try {
    const models = await fetchModels(baseUrl);
    return NextResponse.json({ models, base_url: baseUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

/**
 * List models for an arbitrary base URL.
 * Prefer base_url_b64 so Nginx/ModSecurity does not see a raw http:// URL in the body.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json().catch(() => ({})) as { base_url?: string; base_url_b64?: string };
  const baseUrl = decodeBaseUrl(body);
  if (!baseUrl) return NextResponse.json({ error: "base_url required" }, { status: 400 });

  try {
    const models = await fetchModels(baseUrl);
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
