import { NextRequest, NextResponse } from "next/server";
import { probeAI, probeEmbedAI } from "@/lib/ai/provider";
import { aiRuntimeInfo, loadSettings } from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const settings = await loadSettings();
  const probe = settings.ai.enabled ? await probeAI(settings.ai) : { ok: false, message: "disabled" };
  const embedProbe = settings.ai.enabled ? await probeEmbedAI(settings.ai) : { ok: false, message: "disabled" };

  return NextResponse.json({
    enabled: settings.ai.enabled,
    provider: settings.ai.provider,
    model: settings.ai.model,
    base_url: settings.ai.base_url,
    embed_base_url: settings.ai.embed_base_url || settings.ai.base_url,
    has_api_key_env: aiRuntimeInfo().hasApiKey,
    connected: probe.ok,
    status_message: probe.message,
    embed_connected: embedProbe.ok,
    embed_status_message: embedProbe.message,
  });
}
