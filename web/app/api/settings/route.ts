import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveAISettings, saveSecuritySettings, saveUISettings } from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  return NextResponse.json(await loadSettings());
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  const body = await req.json();

  if (body?.ui?.autosave_seconds !== undefined || body?.ui?.attachments_subdir !== undefined || body?.ui?.start_page !== undefined) {
    const current = await loadSettings();
    const secs =
      body?.ui?.autosave_seconds !== undefined ? Number(body.ui.autosave_seconds) : current.ui.autosave_seconds;
    if (!Number.isFinite(secs) || secs < 1 || secs > 300) {
      return NextResponse.json({ error: "autosave_seconds must be 1–300" }, { status: 400 });
    }
    await saveUISettings({
      autosave_seconds: secs,
      attachments_subdir:
        body?.ui?.attachments_subdir !== undefined
          ? String(body.ui.attachments_subdir)
          : current.ui.attachments_subdir,
      start_page:
        body?.ui?.start_page !== undefined
          ? String(body.ui.start_page)
          : current.ui.start_page,
    });
  }

  if (body?.security) {
    await saveSecuritySettings({
      max_unlock_attempts: Number(body.security.max_unlock_attempts) || 5,
      unlock_lockout_minutes: Number(body.security.unlock_lockout_minutes) || 15,
    });
  }

  if (body?.ai) {
    const ai = body.ai;
    const provider = ai.provider === "openai_compatible" ? "openai_compatible" : "ollama";
    await saveAISettings({
      enabled: Boolean(ai.enabled),
      provider,
      base_url: String(ai.base_url || "").trim(),
      model: String(ai.model || "").trim(),
      embed_model: String(ai.embed_model || "").trim() || undefined,
    });
  }

  return NextResponse.json(await loadSettings());
}
