import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { sanitizeAttachmentsSubdir } from "./attachments-client";
import { vaultRoot } from "./vault";

export type UISettings = {
  autosave_seconds: number;
  attachments_subdir: string;
  start_page: string;
  open_daily_note: boolean;
  capture_folder: string;
};

export type AIProvider = "ollama" | "openai_compatible";

/** One saved provider configuration (Local MLX, remote OpenAI, etc.). */
export type AIProfile = {
  id: string;
  name: string;
  provider: AIProvider;
  base_url: string;
  model: string;
  embed_model?: string;
  embed_base_url?: string;
};

/**
 * AI settings exposed to the app.
 * `provider` / `base_url` / `model` / embed_* are always the **active** profile
 * so existing callers (chat, RAG, probes) stay unchanged.
 */
export type AISettings = {
  enabled: boolean;
  active_profile: string;
  profiles: AIProfile[];
  provider: AIProvider;
  base_url: string;
  model: string;
  embed_model?: string;
  embed_base_url?: string;
};

export type SecuritySettings = {
  max_unlock_attempts: number;
  unlock_lockout_minutes: number;
};

export type VaultSettings = {
  vault_name: string;
  ui: UISettings;
  ai: AISettings;
  security: SecuritySettings;
};

const defaults: VaultSettings = {
  vault_name: "Vault",
  ui: {
    autosave_seconds: 5,
    attachments_subdir: "attachments",
    start_page: "home.md",
    open_daily_note: false,
    capture_folder: "inbox",
  },
  security: { max_unlock_attempts: 5, unlock_lockout_minutes: 15 },
  ai: {
    enabled: false,
    active_profile: "default",
    profiles: [
      {
        id: "default",
        name: "Default",
        provider: "ollama",
        base_url: process.env.AI_BASE_URL?.trim() || "http://host.docker.internal:11434/v1",
        model: process.env.AI_MODEL?.trim() || "llama3.2",
      },
    ],
    provider: "ollama",
    base_url: process.env.AI_BASE_URL?.trim() || "http://host.docker.internal:11434/v1",
    model: process.env.AI_MODEL?.trim() || "llama3.2",
  },
};

function cfgPath(): string {
  return path.join(vaultRoot(), "config", "kb.yaml");
}

async function readConfigDoc(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(cfgPath(), "utf8");
    return (yaml.parse(raw) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

function parseProvider(v: unknown): AIProvider {
  return v === "openai_compatible" ? "openai_compatible" : "ollama";
}

function normalizeProfile(raw: Record<string, unknown>, fallbackId: string): AIProfile {
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : fallbackId;
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : id === "default"
        ? "Default"
        : id;
  return {
    id,
    name,
    provider: parseProvider(raw.provider),
    base_url:
      typeof raw.base_url === "string" && raw.base_url.trim()
        ? raw.base_url.trim()
        : defaults.ai.base_url,
    model:
      typeof raw.model === "string" && raw.model.trim()
        ? raw.model.trim()
        : defaults.ai.model,
    ...(typeof raw.embed_model === "string" && raw.embed_model.trim()
      ? { embed_model: raw.embed_model.trim() }
      : {}),
    ...(typeof raw.embed_base_url === "string" && raw.embed_base_url.trim()
      ? { embed_base_url: raw.embed_base_url.trim() }
      : {}),
  };
}

/** Build profiles from yaml `ai` — migrates legacy flat config into one "default" profile. */
export function parseAISettings(ai: Record<string, unknown>): AISettings {
  const enabled = Boolean(ai.enabled);
  let profiles: AIProfile[] = [];

  if (Array.isArray(ai.profiles) && ai.profiles.length > 0) {
    profiles = ai.profiles.map((p, i) =>
      normalizeProfile((p && typeof p === "object" ? p : {}) as Record<string, unknown>, `profile-${i + 1}`),
    );
  } else {
    // Legacy flat fields → single profile
    profiles = [
      normalizeProfile(
        {
          id: "default",
          name: "Default",
          provider: ai.provider,
          base_url: ai.base_url,
          model: ai.model,
          embed_model: ai.embed_model,
          embed_base_url: ai.embed_base_url,
        },
        "default",
      ),
    ];
  }

  // Dedupe ids
  const seen = new Set<string>();
  profiles = profiles.map((p, i) => {
    let id = p.id;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    return { ...p, id };
  });

  let active =
    typeof ai.active_profile === "string" && ai.active_profile.trim()
      ? ai.active_profile.trim()
      : profiles[0].id;
  if (!profiles.some((p) => p.id === active)) active = profiles[0].id;

  const current = profiles.find((p) => p.id === active) ?? profiles[0];

  return {
    enabled,
    active_profile: active,
    profiles,
    provider: current.provider,
    base_url: current.base_url,
    model: current.model,
    embed_model: current.embed_model,
    embed_base_url: current.embed_base_url,
  };
}

function profileToYaml(p: AIProfile): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    base_url: p.base_url,
    model: p.model,
    ...(p.embed_model?.trim() ? { embed_model: p.embed_model.trim() } : {}),
    ...(p.embed_base_url?.trim() ? { embed_base_url: p.embed_base_url.trim() } : {}),
  };
}

export function slugifyProfileId(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `profile-${Date.now().toString(36)}`;
}

export async function loadSettings(): Promise<VaultSettings> {
  const doc = await readConfigDoc();
  const ui = (doc.ui as Record<string, unknown>) || {};
  const ai = (doc.ai as Record<string, unknown>) || {};
  const security = (doc.security as Record<string, unknown>) || {};
  const secs = ui.autosave_seconds as number | undefined;
  const attachmentsSubdir =
    typeof ui.attachments_subdir === "string" && ui.attachments_subdir.trim()
      ? ui.attachments_subdir.trim()
      : defaults.ui.attachments_subdir;

  const maxAttempts = security.max_unlock_attempts as number | undefined;
  const lockoutMinutes = security.unlock_lockout_minutes as number | undefined;
  const vault = (doc.vault as Record<string, unknown>) || {};
  const vaultName = typeof vault.name === "string" && vault.name.trim() ? vault.name.trim() : defaults.vault_name;

  return {
    vault_name: vaultName,
    ui: {
      autosave_seconds: typeof secs === "number" && secs > 0 ? secs : defaults.ui.autosave_seconds,
      attachments_subdir: attachmentsSubdir,
      start_page: typeof ui.start_page === "string" ? ui.start_page.trim() : defaults.ui.start_page,
      open_daily_note: Boolean(ui.open_daily_note),
      capture_folder:
        typeof ui.capture_folder === "string" && ui.capture_folder.trim()
          ? ui.capture_folder.trim().replace(/^\/+|\/+$/g, "")
          : defaults.ui.capture_folder,
    },
    security: {
      max_unlock_attempts: typeof maxAttempts === "number" && maxAttempts > 0 ? maxAttempts : defaults.security.max_unlock_attempts,
      unlock_lockout_minutes: typeof lockoutMinutes === "number" && lockoutMinutes > 0 ? lockoutMinutes : defaults.security.unlock_lockout_minutes,
    },
    ai: parseAISettings(ai),
  };
}

async function writeConfigDoc(mutator: (doc: Record<string, unknown>) => void): Promise<void> {
  const doc = await readConfigDoc();
  mutator(doc);
  await fs.writeFile(cfgPath(), yaml.stringify(doc), "utf8");
}

export async function saveVaultName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("vault name required");
  if (trimmed.length > 80) throw new Error("vault name too long");
  await writeConfigDoc((doc) => {
    const vault = (doc.vault as Record<string, unknown>) || {};
    doc.vault = { ...vault, name: trimmed };
  });
}

export async function saveUISettings(ui: Partial<UISettings> & Pick<UISettings, "autosave_seconds">): Promise<void> {
  const current = await loadSettings();
  await writeConfigDoc((doc) => {
    doc.ui = {
      autosave_seconds: Math.max(1, Math.min(300, ui.autosave_seconds)),
      attachments_subdir:
        ui.attachments_subdir !== undefined
          ? sanitizeAttachmentsSubdir(ui.attachments_subdir)
          : current.ui.attachments_subdir,
      start_page: ui.start_page !== undefined ? ui.start_page.trim() : current.ui.start_page,
      open_daily_note: ui.open_daily_note !== undefined ? Boolean(ui.open_daily_note) : current.ui.open_daily_note,
      capture_folder:
        ui.capture_folder !== undefined
          ? ui.capture_folder.trim().replace(/^\/+|\/+$/g, "") || defaults.ui.capture_folder
          : current.ui.capture_folder,
    };
  });
}

export async function saveAISettings(ai: AISettings): Promise<void> {
  const parsed = parseAISettings({
    enabled: ai.enabled,
    active_profile: ai.active_profile,
    profiles: ai.profiles,
  });
  await writeConfigDoc((doc) => {
    doc.ai = {
      enabled: parsed.enabled,
      active_profile: parsed.active_profile,
      profiles: parsed.profiles.map(profileToYaml),
    };
  });
}

/** Switch active profile without rewriting profile bodies. */
export async function setActiveAIProfile(profileId: string): Promise<AISettings> {
  const current = await loadSettings();
  if (!current.ai.profiles.some((p) => p.id === profileId)) {
    throw new Error(`Unknown AI profile: ${profileId}`);
  }
  await saveAISettings({ ...current.ai, active_profile: profileId });
  return (await loadSettings()).ai;
}

export async function saveSecuritySettings(sec: SecuritySettings): Promise<void> {
  await writeConfigDoc((doc) => {
    doc.security = {
      max_unlock_attempts: Math.max(1, Math.min(20, Math.round(sec.max_unlock_attempts))),
      unlock_lockout_minutes: Math.max(1, Math.min(1440, Math.round(sec.unlock_lockout_minutes))),
    };
  });
}

export async function loadPins(): Promise<string[]> {
  const doc = await readConfigDoc();
  const pins = doc.pins;
  return Array.isArray(pins) ? (pins as string[]) : [];
}

export async function savePins(pins: string[]): Promise<void> {
  await writeConfigDoc((doc) => {
    doc.pins = pins;
  });
}

/** Server-side only — includes whether API key env is set. */
export function aiRuntimeInfo(): { hasApiKey: boolean } {
  return { hasApiKey: Boolean(process.env.AI_API_KEY?.trim()) };
}
