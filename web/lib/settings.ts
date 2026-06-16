import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { sanitizeAttachmentsSubdir } from "./attachments-client";
import { vaultRoot } from "./vault";

export type UISettings = {
  autosave_seconds: number;
  attachments_subdir: string;
  start_page: string;
};

export type AISettings = {
  enabled: boolean;
  provider: "ollama" | "openai_compatible";
  base_url: string;
  model: string;
  // Optional: embedding model for semantic/vector search (leave blank to use keyword search only)
  embed_model?: string;
};

export type SecuritySettings = {
  max_unlock_attempts: number;   // wrong-passphrase attempts before lockout
  unlock_lockout_minutes: number; // how long the lockout lasts
};

export type VaultSettings = {
  ui: UISettings;
  ai: AISettings;
  security: SecuritySettings;
};

const defaults: VaultSettings = {
  ui: { autosave_seconds: 5, attachments_subdir: "attachments", start_page: "home.md" },
  security: { max_unlock_attempts: 5, unlock_lockout_minutes: 15 },
  ai: {
    enabled: false,
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
  const provider = ai.provider === "openai_compatible" ? "openai_compatible" : "ollama";

  const maxAttempts = security.max_unlock_attempts as number | undefined;
  const lockoutMinutes = security.unlock_lockout_minutes as number | undefined;

  return {
    ui: {
      autosave_seconds: typeof secs === "number" && secs > 0 ? secs : defaults.ui.autosave_seconds,
      attachments_subdir: attachmentsSubdir,
      start_page: typeof ui.start_page === "string" ? ui.start_page.trim() : defaults.ui.start_page,
    },
    security: {
      max_unlock_attempts: typeof maxAttempts === "number" && maxAttempts > 0 ? maxAttempts : defaults.security.max_unlock_attempts,
      unlock_lockout_minutes: typeof lockoutMinutes === "number" && lockoutMinutes > 0 ? lockoutMinutes : defaults.security.unlock_lockout_minutes,
    },
    ai: {
      enabled: Boolean(ai.enabled),
      provider,
      base_url:
        typeof ai.base_url === "string" && ai.base_url.trim()
          ? ai.base_url.trim()
          : defaults.ai.base_url,
      model:
        typeof ai.model === "string" && ai.model.trim() ? ai.model.trim() : defaults.ai.model,
      embed_model:
        typeof ai.embed_model === "string" && ai.embed_model.trim() ? ai.embed_model.trim() : undefined,
    },
  };
}

async function writeConfigDoc(mutator: (doc: Record<string, unknown>) => void): Promise<void> {
  const doc = await readConfigDoc();
  mutator(doc);
  await fs.writeFile(cfgPath(), yaml.stringify(doc), "utf8");
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
    };
  });
}

export async function saveAISettings(ai: AISettings): Promise<void> {
  await writeConfigDoc((doc) => {
    doc.ai = {
      enabled: Boolean(ai.enabled),
      provider: ai.provider === "openai_compatible" ? "openai_compatible" : "ollama",
      base_url: ai.base_url.trim() || defaults.ai.base_url,
      model: ai.model.trim() || defaults.ai.model,
      ...(ai.embed_model?.trim() ? { embed_model: ai.embed_model.trim() } : {}),
    };
  });
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
