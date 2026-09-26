import { NextRequest, NextResponse } from "next/server";
import {
  loadSettings,
  parseAISettings,
  saveAISettings,
  saveSecuritySettings,
  saveUISettings,
  saveVaultName,
  setActiveAIProfile,
  slugifyProfileId,
  type AIProfile,
  type AIProvider,
} from "@/lib/settings";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  return NextResponse.json(await loadSettings());
}

function normalizeIncomingProfiles(ai: Record<string, unknown>): AIProfile[] {
  if (Array.isArray(ai.profiles) && ai.profiles.length > 0) {
    return parseAISettings({
      enabled: ai.enabled,
      active_profile: ai.active_profile,
      profiles: ai.profiles,
    }).profiles;
  }
  // Legacy / form-only save: wrap flat fields into active profile (or default)
  const provider: AIProvider = ai.provider === "openai_compatible" ? "openai_compatible" : "ollama";
  const id =
    typeof ai.active_profile === "string" && ai.active_profile.trim()
      ? ai.active_profile.trim()
      : "default";
  return [
    {
      id,
      name: id === "default" ? "Default" : id,
      provider,
      base_url: String(ai.base_url || "").trim(),
      model: String(ai.model || "").trim(),
      embed_model: String(ai.embed_model || "").trim() || undefined,
      embed_base_url: String(ai.embed_base_url || "").trim() || undefined,
    },
  ];
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();

  // Any authenticated user may switch the active AI profile (no other fields).
  if (
    body?.ai &&
    body.ai.active_profile !== undefined &&
    body.ai.profiles === undefined &&
    body.ai.base_url === undefined &&
    body.ai.enabled === undefined &&
    !body?.ui &&
    !body?.vault &&
    !body?.security
  ) {
    try {
      await setActiveAIProfile(String(body.ai.active_profile));
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return NextResponse.json(await loadSettings());
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  if (body?.vault?.name !== undefined) {
    try {
      await saveVaultName(String(body.vault.name));
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
  }

  if (
    body?.ui?.autosave_seconds !== undefined ||
    body?.ui?.attachments_subdir !== undefined ||
    body?.ui?.start_page !== undefined ||
    body?.ui?.open_daily_note !== undefined ||
    body?.ui?.capture_folder !== undefined
  ) {
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
      open_daily_note:
        body?.ui?.open_daily_note !== undefined
          ? Boolean(body.ui.open_daily_note)
          : current.ui.open_daily_note,
      capture_folder:
        body?.ui?.capture_folder !== undefined
          ? String(body.ui.capture_folder)
          : current.ui.capture_folder,
    });
  }

  if (body?.security) {
    await saveSecuritySettings({
      max_unlock_attempts: Number(body.security.max_unlock_attempts) || 5,
      unlock_lockout_minutes: Number(body.security.unlock_lockout_minutes) || 15,
    });
  }

  if (body?.ai) {
    const ai = body.ai as Record<string, unknown>;

    const current = await loadSettings();
    let profiles = normalizeIncomingProfiles(ai);

    // If client sent flat fields + existing profiles list, merge form into active profile
    if (Array.isArray(ai.profiles) && ai.profiles.length > 0 && ai.base_url !== undefined) {
      const activeId =
        typeof ai.active_profile === "string" && ai.active_profile.trim()
          ? ai.active_profile.trim()
          : current.ai.active_profile;
      const provider: AIProvider = ai.provider === "openai_compatible" ? "openai_compatible" : "ollama";
      profiles = profiles.map((p) =>
        p.id === activeId
          ? {
              ...p,
              name: typeof ai.profile_name === "string" && ai.profile_name.trim() ? ai.profile_name.trim() : p.name,
              provider,
              base_url: String(ai.base_url || "").trim() || p.base_url,
              model: String(ai.model || "").trim() || p.model,
              embed_model: String(ai.embed_model || "").trim() || undefined,
              embed_base_url: String(ai.embed_base_url || "").trim() || undefined,
            }
          : p,
      );
    }

    // Create new profile from form
    if (ai.new_profile === true) {
      const name =
        typeof ai.profile_name === "string" && ai.profile_name.trim()
          ? ai.profile_name.trim()
          : "New profile";
      let id = slugifyProfileId(name);
      if (profiles.some((p) => p.id === id)) id = `${id}-${Date.now().toString(36)}`;
      const provider: AIProvider = ai.provider === "openai_compatible" ? "openai_compatible" : "ollama";
      profiles = [
        ...profiles,
        {
          id,
          name,
          provider,
          base_url: String(ai.base_url || "").trim() || current.ai.base_url,
          model: String(ai.model || "").trim() || current.ai.model,
          embed_model: String(ai.embed_model || "").trim() || undefined,
          embed_base_url: String(ai.embed_base_url || "").trim() || undefined,
        },
      ];
      ai.active_profile = id;
    }

    // Delete profile
    if (typeof ai.delete_profile === "string" && ai.delete_profile.trim()) {
      const del = ai.delete_profile.trim();
      if (profiles.length <= 1) {
        return NextResponse.json({ error: "Cannot delete the last AI profile" }, { status: 400 });
      }
      profiles = profiles.filter((p) => p.id !== del);
      if (ai.active_profile === del || current.ai.active_profile === del) {
        ai.active_profile = profiles[0].id;
      }
    }

    const active =
      typeof ai.active_profile === "string" && ai.active_profile.trim()
        ? ai.active_profile.trim()
        : current.ai.active_profile;

    await saveAISettings({
      enabled: Boolean(ai.enabled),
      active_profile: active,
      profiles,
      provider: "ollama",
      base_url: "",
      model: "",
    });
  }

  return NextResponse.json(await loadSettings());
}
