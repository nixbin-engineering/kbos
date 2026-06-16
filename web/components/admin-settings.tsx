"use client";

import { Bot, BookOpen, Building2, ChevronDown, Database, Download, HardDrive, Loader2, Lock, Palette, RefreshCw, Settings, ShieldAlert, Sparkles, Trash2, UserPlus, Users, Users2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { AISettings } from "@/lib/types";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "./theme-provider";

type Props = {
  role: string;
  autosaveSeconds: number;
  onUpdated: (seconds: number) => void;
  iconOnly?: boolean;
};

type SettingsDoc = {
  ui: { autosave_seconds: number; attachments_subdir: string; start_page?: string };
  ai: AISettings;
  security?: { max_unlock_attempts: number; unlock_lockout_minutes: number };
};

type IndexProgress = {
  done: number;
  total: number;
  errors: number;
  lastPath?: string;
  finished?: boolean;
  docCount?: number;
  chunkCount?: number;
};

function ModelPicker({
  label,
  value,
  onChange,
  placeholder,
  baseUrl,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  baseUrl: string;
  hint?: string;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const fetchModels = async () => {
    if (!baseUrl.trim()) { setFetchError("Enter Base URL first"); return; }
    setFetching(true);
    setFetchError(null);
    try {
      const r = await fetch(`/api/ai/models?base_url=${encodeURIComponent(baseUrl)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      setModels(data.models || []);
      setShowList(true);
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="button"
          onClick={fetchModels}
          disabled={fetching}
          title="Fetch available models"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs hover:bg-[var(--border)] disabled:opacity-50"
        >
          {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
          Fetch
        </button>
      </div>
      {fetchError && <p className="mt-1 text-xs text-red-500">{fetchError}</p>}
      {showList && models.length > 0 && (
        <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--panel)] shadow">
          {models.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { onChange(m); setShowList(false); }}
              className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[var(--border)] ${value === m ? "font-semibold text-[var(--accent)]" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function AdminSettingsButton({ role, autosaveSeconds, onUpdated, iconOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [secs, setSecs] = useState(autosaveSeconds);
  const [attachmentsSubdir, setAttachmentsSubdir] = useState("attachments");
  const [startPage, setStartPage] = useState("home.md");
  const [ai, setAi] = useState<AISettings>({
    enabled: false,
    provider: "ollama",
    base_url: "",
    model: "",
    embed_model: "",
  });
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexStats, setIndexStats] = useState<{ docCount: number; chunkCount: number; sizeBytes: number } | null>(null);
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null);
  const [indexing, setIndexing] = useState(false);
  const indexAbortRef = useRef<AbortController | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [secMaxAttempts, setSecMaxAttempts] = useState(5);
  const [secLockoutMinutes, setSecLockoutMinutes] = useState(15);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpBusy, setTotpBusy] = useState(false);
  const [secBusy, setSecBusy] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSaved, setSecSaved] = useState(false);
  type UserEntry = { username: string; role: string };
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"editor" | "admin">("editor");
  const [userBusy, setUserBusy] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [editingPass, setEditingPass] = useState<string | null>(null);
  const [editPassValue, setEditPassValue] = useState("");

  type VaultAccess = { user: string; role: "admin" | "editor" | "reader" };
  type VaultItem = { id: string; name: string; description?: string; secure?: boolean; access: VaultAccess[] };
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [editingVault, setEditingVault] = useState<VaultItem | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  type GroupItem = { id: string; name: string; description?: string; members: string[]; type: "team" | "group" };
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupType, setNewGroupType] = useState<"team" | "group">("team");

  const loadGroups = useCallback(async () => {
    const r = await fetch("/api/admin/groups");
    if (r.ok) setGroups((await r.json()).groups || []);
  }, []);

  useEffect(() => setSecs(autosaveSeconds), [autosaveSeconds]);

  const loadVaults = useCallback(async () => {
    const r = await fetch("/api/vaults");
    if (r.ok) {
      const data = await r.json();
      // Fetch full ACL for each vault
      const full = await Promise.all(
        (data.vaults || []).map(async (v: { id: string }) => {
          const r2 = await fetch(`/api/vaults/${v.id}`);
          return r2.ok ? r2.json() : v;
        }),
      );
      setVaults(full);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/settings");
    if (r.ok) {
      const data = (await r.json()) as SettingsDoc;
      setAi({ embed_model: "", ...data.ai });
      setAttachmentsSubdir(data.ui.attachments_subdir || "attachments");
      if (data.ui.start_page) setStartPage(data.ui.start_page);
      if (data.security) {
        setSecMaxAttempts(data.security.max_unlock_attempts ?? 5);
        setSecLockoutMinutes(data.security.unlock_lockout_minutes ?? 15);
      }
    }
    const status = await fetch("/api/ai/status");
    if (status.ok) {
      const s = await status.json();
      setAiStatus(s.connected ? `Connected · ${s.model}` : s.status_message);
    }
    const totpPolicy = await fetch("/api/admin/totp");
    if (totpPolicy.ok) {
      const t = await totpPolicy.json();
      setTotpRequired(t.totp_required ?? false);
    }
    const stats = await fetch("/api/ai/index");
    if (stats.ok) setIndexStats(await stats.json());
    const usersResp = await fetch("/api/admin/users");
    if (usersResp.ok) setUsers((await usersResp.json()).users || []);
  }, []);

  useEffect(() => {
    if (open) { loadSettings(); void loadVaults(); void loadGroups(); }
  }, [open, loadSettings, loadVaults, loadGroups]);

  if (role !== "admin") return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ui: { autosave_seconds: secs, attachments_subdir: attachmentsSubdir, start_page: startPage },
          ai,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onUpdated(data.ui.autosave_seconds);
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setProbing(true);
    setAiStatus(null);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai }),
      });
      const r = await fetch("/api/ai/status");
      const s = await r.json();
      setAiStatus(s.connected ? `Connected · ${s.model}` : s.status_message);
    } catch (e) {
      setAiStatus(String(e));
    } finally {
      setProbing(false);
    }
  };

  const rebuildIndex = async () => {
    // Save settings first so the server uses the latest embed_model
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ui: { autosave_seconds: secs, attachments_subdir: attachmentsSubdir }, ai }),
    });

    setIndexing(true);
    setIndexProgress({ done: 0, total: 0, errors: 0 });
    const abort = new AbortController();
    indexAbortRef.current = abort;

    try {
      const res = await fetch("/api/ai/index", { method: "POST", signal: abort.signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || res.statusText);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5)) as Record<string, unknown>;
            if (evt.type === "start") {
              setIndexProgress({ done: 0, total: evt.total as number, errors: 0 });
            } else if (evt.type === "progress") {
              setIndexProgress((p) => ({
                done: evt.done as number,
                total: evt.total as number,
                errors: p?.errors ?? 0,
                lastPath: evt.path as string,
              }));
            } else if (evt.type === "error_doc") {
              setIndexProgress((p) => p ? { ...p, errors: p.errors + 1 } : p);
            } else if (evt.type === "done") {
              setIndexProgress({
                done: evt.done as number,
                total: evt.done as number,
                errors: evt.errors as number,
                finished: true,
                docCount: evt.docCount as number,
                chunkCount: evt.chunkCount as number,
              });
              setIndexStats({ docCount: evt.docCount as number, chunkCount: evt.chunkCount as number, sizeBytes: 0 });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setIndexProgress((p) => p ? { ...p, finished: true } : null);
        setError(`Index rebuild failed: ${String(e)}`);
      }
    } finally {
      setIndexing(false);
    }
  };

  const stopIndex = () => {
    indexAbortRef.current?.abort();
    setIndexing(false);
  };

  type SettingsTab = "general" | "appearance" | "ai" | "users" | "groups" | "vaults" | "security" | "system";
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "users", label: "Users", icon: Users },
    { id: "groups", label: "Groups", icon: Users2 },
    { id: "vaults", label: "Vaults", icon: BookOpen },
    { id: "security", label: "Security", icon: ShieldAlert },
    { id: "system", label: "System", icon: HardDrive },
  ];

  const { theme: currentTheme, setTheme } = useTheme();

  const THEME_ORDER: ThemeId[] = ["indigo", "dark", "midnight", "slate", "amber", "nord", "dracula", "solarized", "linux-terminal", "manjaro", "light", "auto", "ocean", "blue-white", "mono", "rose"];
  const THEME_PREVIEW: Record<ThemeId, { bg: string; panel: string; accent: string }> = {
    indigo:           { bg: "#07090f", panel: "#0d1120", accent: "#8b5cf6" },
    dark:             { bg: "#0f172a", panel: "#1e293b", accent: "#3b82f6" },
    light:            { bg: "#f5f6ff", panel: "#ffffff", accent: "#7c3aed" },
    auto:             { bg: "#f5f6ff", panel: "#ffffff", accent: "#7c3aed" },
    nord:             { bg: "#2e3440", panel: "#3b4252", accent: "#88c0d0" },
    dracula:          { bg: "#1e1f29", panel: "#282a36", accent: "#ff79c6" },
    solarized:        { bg: "#002b36", panel: "#073642", accent: "#268bd2" },
    "linux-terminal": { bg: "#0a0a0a", panel: "#111111", accent: "#00cc00" },
    manjaro:          { bg: "#2b2c2c", panel: "#2f343f", accent: "#16a085" },
    ocean:            { bg: "#f0f7ff", panel: "#ffffff", accent: "#1d6fa4" },
    midnight:         { bg: "#0d1b2a", panel: "#112236", accent: "#4da6e8" },
    mono:             { bg: "#ffffff", panel: "#f5f5f5", accent: "#111111" },
    rose:             { bg: "#fff5f7", panel: "#ffffff", accent: "#e0394f" },
    slate:            { bg: "#0f1317", panel: "#161c22", accent: "#7eb8d4" },
    amber:            { bg: "#16110a", panel: "#1e1608", accent: "#f5a623" },
    "blue-white":     { bg: "#ffffff", panel: "#e8f0fe", accent: "#1a73e8" },
  };

  return (
    <>
      <button
        type="button"
        title="Admin settings"
        onClick={() => setOpen(true)}
        className={iconOnly
          ? "flex items-center justify-center rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
          : "inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--border)]"}
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="font-semibold">Settings</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* Sidebar tabs */}
              <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-[var(--border)] p-2">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors text-left",
                      activeTab === id
                        ? "bg-[var(--accent)] text-[var(--accent-fg)] font-medium"
                        : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>

              {/* Tab content */}
              <div className="min-h-0 flex-1 overflow-y-auto p-5">

                {/* General tab */}
                {activeTab === "general" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="mb-4 text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Editor</h3>
                      <label className="mb-4 block text-sm">
                        Auto-save interval (seconds)
                        <input
                          type="number" min={1} max={300} value={secs}
                          onChange={(e) => setSecs(Number(e.target.value))}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        Image attachments folder
                        <input
                          value={attachmentsSubdir}
                          onChange={(e) => setAttachmentsSubdir(e.target.value)}
                          placeholder="attachments"
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                        />
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          Subfolder next to each note, e.g. docs/projects/attachments/
                        </span>
                      </label>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end">
                      <button type="button" disabled={busy} onClick={save}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Appearance tab */}
                {activeTab === "appearance" && (() => {
                  const confirmedTheme = currentTheme;
                  return (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Theme</h3>
                      <span className="text-xs text-[var(--muted)]">Hover to preview · click to apply</span>
                    </div>
                    <div
                      className="grid grid-cols-3 gap-2"
                      onMouseLeave={() => setTheme(confirmedTheme)}
                    >
                      {THEME_ORDER.map((id) => {
                        const preview = THEME_PREVIEW[id];
                        const active = confirmedTheme === id;
                        const lightBg = ["#ffffff", "#f5f6ff", "#fff5f7", "#f0f7ff"].includes(preview.bg);
                        return (
                          <button
                            key={id}
                            type="button"
                            onMouseEnter={() => setTheme(id)}
                            onClick={() => setTheme(id)}
                            className={`relative overflow-hidden rounded-lg border p-3 text-left transition-all ${
                              active
                                ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--background)]"
                                : "border-[var(--border)] hover:border-[var(--border-strong,var(--border))]"
                            }`}
                            style={{ background: preview.bg }}
                          >
                            <div className="mb-2 flex gap-1">
                              <div className="h-3 w-3 rounded-sm opacity-80" style={{ background: preview.panel }} />
                              <div className="h-3 flex-1 rounded-sm opacity-60" style={{ background: preview.panel }} />
                            </div>
                            <div className="h-1.5 w-8 rounded-full mb-1" style={{ background: preview.accent }} />
                            <div className="h-1 w-12 rounded-full opacity-40" style={{ background: preview.panel }} />
                            <p className="mt-2 text-[10px] font-medium truncate" style={{ color: lightBg ? "#1e1b4b" : "#e2e8f0" }}>
                              {THEMES[id].label}
                            </p>
                            {active && (
                              <div className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: preview.accent }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-[var(--border)] pt-5 space-y-3">
                      <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Start Page</h3>
                      <label className="block text-sm">
                        Document to open on load
                        <input
                          value={startPage}
                          onChange={(e) => setStartPage(e.target.value)}
                          placeholder="e.g. home.md — leave blank for dashboard"
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                        />
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          Path relative to the docs folder, e.g. <code>home.md</code> or <code>team/dashboard.md</code>. Leave blank to show the empty dashboard.
                        </span>
                      </label>
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      <div className="flex justify-end">
                        <button type="button" disabled={busy} onClick={save}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
                          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* AI tab */}
                {activeTab === "ai" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="mb-4 text-sm font-medium text-[var(--muted)] uppercase tracking-wide">AI Assistant</h3>
                      <label className="mb-4 flex items-center gap-3 text-sm cursor-pointer">
                        <input type="checkbox" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} className="h-4 w-4" />
                        Enable KB assistant (RAG chat)
                      </label>
                      <label className="mb-4 block text-sm">
                        Provider
                        <select value={ai.provider}
                          onChange={(e) => setAi({ ...ai, provider: e.target.value === "openai_compatible" ? "openai_compatible" : "ollama" })}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                          <option value="ollama">Ollama (local)</option>
                          <option value="openai_compatible">OpenAI-compatible API</option>
                        </select>
                      </label>
                      <label className="mb-4 block text-sm">
                        Base URL
                        <input value={ai.base_url} onChange={(e) => setAi({ ...ai, base_url: e.target.value })}
                          placeholder="http://host.docker.internal:11434/v1"
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs" />
                      </label>
                      <ModelPicker label="Chat model" value={ai.model} onChange={(v) => setAi({ ...ai, model: v })}
                        placeholder="llama3.2" baseUrl={ai.base_url} hint='Click "Fetch" to list models from your provider.' />
                      <ModelPicker label="Embedding model (semantic RAG)" value={ai.embed_model ?? ""}
                        onChange={(v) => setAi({ ...ai, embed_model: v })} placeholder="nomic-embed-text" baseUrl={ai.base_url}
                        hint="Leave blank for keyword-only search." />
                      <p className="mb-3 text-xs text-[var(--muted)]">
                        Set <code className="rounded bg-[var(--border)] px-1">AI_API_KEY</code> in <code className="rounded bg-[var(--border)] px-1">.env</code> for cloud providers.
                      </p>
                      <div className="flex items-center gap-3">
                        <button type="button" disabled={probing || !ai.enabled} onClick={testConnection}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)] disabled:opacity-50">
                          {probing ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Testing…</span> : "Test connection"}
                        </button>
                        {aiStatus && <span className="text-xs text-[var(--muted)]">{aiStatus}</span>}
                      </div>
                    </div>

                    <div className="border-t border-[var(--border)] pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="flex items-center gap-1.5 text-sm font-medium"><Bot className="h-3.5 w-3.5" /> Vector index (RAG)</h3>
                        {indexStats && <span className="text-xs text-[var(--muted)]">{indexStats.docCount} docs · {indexStats.chunkCount} chunks</span>}
                      </div>
                      <p className="mb-3 text-xs text-[var(--muted)]">Rebuild after changing embedding model or importing notes.</p>
                      {indexProgress && (
                        <div className="mb-3 rounded-lg border border-[var(--border)] p-3">
                          {!indexProgress.finished ? (
                            <>
                              <div className="mb-1.5 flex items-center justify-between text-xs">
                                <span>{indexProgress.done} / {indexProgress.total || "…"} docs
                                  {indexProgress.errors > 0 && <span className="ml-2 text-amber-500">{indexProgress.errors} errors</span>}
                                </span>
                                <button type="button" onClick={stopIndex} className="text-[var(--muted)] hover:text-red-500">Cancel</button>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                                <div className="h-full rounded-full bg-[var(--accent)] transition-all"
                                  style={{ width: indexProgress.total ? `${Math.round((indexProgress.done / indexProgress.total) * 100)}%` : "0%" }} />
                              </div>
                              {indexProgress.lastPath && <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{indexProgress.lastPath}</p>}
                            </>
                          ) : (
                            <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                              <Database className="h-3.5 w-3.5 text-[var(--accent)]" />
                              Done — {indexProgress.docCount} docs, {indexProgress.chunkCount} chunks
                              {indexProgress.errors > 0 && <span className="text-amber-500">({indexProgress.errors} errors)</span>}
                            </p>
                          )}
                        </div>
                      )}
                      <button type="button" disabled={indexing || !ai.embed_model?.trim()} onClick={rebuildIndex}
                        title={!ai.embed_model?.trim() ? "Configure an embedding model first" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--border)] disabled:opacity-50">
                        {indexing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Indexing…</> : <><RefreshCw className="h-3.5 w-3.5" /> Rebuild index</>}
                      </button>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end">
                      <button type="button" disabled={busy} onClick={save}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Users tab */}
                {activeTab === "users" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">User management</h3>
                    {userError && <p className="text-xs text-red-600">{userError}</p>}
                    <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                      {users.map((u) => (
                        <div key={u.username} className="flex items-center gap-3 px-4 py-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase"
                            style={u.role === "admin" ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--border)", color: "var(--muted)" }}>
                            {u.username[0]}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium">{u.username}</span>
                          <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium bg-[var(--border)] text-[var(--muted)] uppercase">{u.role}</span>
                          {editingPass === u.username ? (
                            <>
                              <input type="password" value={editPassValue} onChange={(e) => setEditPassValue(e.target.value)}
                                placeholder="New password" autoFocus
                                className="w-32 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs" />
                              <button type="button" disabled={userBusy || editPassValue.length < 6}
                                onClick={async () => {
                                  setUserBusy(true); setUserError(null);
                                  try {
                                    const r = await fetch(`/api/admin/users/${encodeURIComponent(u.username)}`,
                                      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: editPassValue }) });
                                    if (!r.ok) throw new Error((await r.json()).error);
                                    setEditingPass(null); setEditPassValue("");
                                  } catch (e) { setUserError(String(e)); }
                                  finally { setUserBusy(false); }
                                }}
                                className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs text-[var(--accent-fg)] disabled:opacity-50">Save</button>
                              <button type="button" onClick={() => { setEditingPass(null); setEditPassValue(""); }}
                                className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--border)]"><X className="h-3.5 w-3.5" /></button>
                            </>
                          ) : (
                            <button type="button" onClick={() => { setEditingPass(u.username); setEditPassValue(""); }}
                              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--border)]">Change password</button>
                          )}
                          <button type="button" disabled={userBusy} title="Delete user"
                            onClick={async () => {
                              if (!confirm(`Delete user "${u.username}"?`)) return;
                              setUserBusy(true); setUserError(null);
                              try {
                                const r = await fetch(`/api/admin/users/${encodeURIComponent(u.username)}`, { method: "DELETE" });
                                if (!r.ok) throw new Error((await r.json()).error);
                                setUsers((prev) => prev.filter((x) => x.username !== u.username));
                              } catch (e) { setUserError(String(e)); }
                              finally { setUserBusy(false); }
                            }}
                            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-4">
                      <h4 className="mb-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Add user</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Username"
                          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Password (min 6 chars)"
                          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                        <select value={newRole} onChange={(e) => setNewRole(e.target.value as "editor" | "admin")}
                          className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm">
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="button" disabled={userBusy || !newUsername.trim() || newPassword.length < 6}
                          onClick={async () => {
                            setUserBusy(true); setUserError(null);
                            try {
                              const r = await fetch("/api/admin/users", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
                              });
                              const d = await r.json();
                              if (!r.ok) throw new Error(d.error);
                              setUsers((prev) => [...prev, { username: newUsername, role: newRole }]);
                              setNewUsername(""); setNewPassword(""); setNewRole("editor");
                            } catch (e) { setUserError(String(e)); }
                            finally { setUserBusy(false); }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
                          <UserPlus className="h-3.5 w-3.5" /> Add user
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Groups tab */}
                {activeTab === "groups" && (() => {
                  const teams = groups.filter((g) => g.type === "team");
                  const grps  = groups.filter((g) => g.type === "group");

                  const renderEntry = (g: GroupItem) => (
                    <div key={g.id} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="mb-1 flex items-center gap-2">
                        {g.type === "team"
                          ? <Building2 className="h-4 w-4 text-[var(--accent)]" />
                          : <Users2 className="h-4 w-4 text-[var(--accent)]" />}
                        <span className="flex-1 font-medium text-sm">{g.name}</span>
                        <span className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--border)] text-[var(--muted)] font-mono">@{g.id}</span>
                        <button type="button"
                          onClick={() => setEditingGroup(editingGroup?.id === g.id ? null : { ...g, members: [...g.members] })}
                          className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--border)]">
                          {editingGroup?.id === g.id ? "Cancel" : "Edit"}
                        </button>
                        <button type="button" disabled={groupBusy} title={`Delete ${g.type}`}
                          onClick={async () => {
                            if (!confirm(`Delete ${g.type} "${g.name}"?`)) return;
                            setGroupBusy(true); setGroupError(null);
                            try {
                              const r = await fetch(`/api/admin/groups/${g.id}`, { method: "DELETE" });
                              if (!r.ok) throw new Error((await r.json()).error);
                              await loadGroups();
                            } catch (e) { setGroupError(String(e)); }
                            finally { setGroupBusy(false); }
                          }}
                          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {g.description && <p className="mb-1 text-xs text-[var(--muted)]">{g.description}</p>}
                      {editingGroup?.id !== g.id ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {g.members.length === 0 && <span className="text-xs text-[var(--muted)]">No members</span>}
                          {g.members.map((m) => (
                            <span key={m} className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs">{m}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs font-medium text-[var(--muted)]">Members (one per line)</p>
                          <textarea
                            value={editingGroup.members.join("\n")}
                            onChange={(e) => setEditingGroup({ ...editingGroup, members: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                            rows={4}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                          />
                          <div className="flex justify-end">
                            <button type="button" disabled={groupBusy}
                              onClick={async () => {
                                setGroupBusy(true); setGroupError(null);
                                try {
                                  const r = await fetch(`/api/admin/groups/${g.id}`, {
                                    method: "PUT", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ members: editingGroup.members }),
                                  });
                                  if (!r.ok) throw new Error((await r.json()).error);
                                  await loadGroups();
                                  setEditingGroup(null);
                                } catch (e) { setGroupError(String(e)); }
                                finally { setGroupBusy(false); }
                              }}
                              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50">
                              {groupBusy ? "Saving…" : "Save members"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );

                  return (
                    <div className="space-y-5">
                      {groupError && <p className="text-xs text-red-600">{groupError}</p>}

                      {/* Teams section */}
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-[var(--accent)]" />
                          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Teams</h3>
                          <span className="text-xs text-[var(--muted)]">— org-level units (Engineering, Marketing…)</span>
                        </div>
                        <div className="space-y-2">
                          {teams.length === 0 && <p className="text-sm text-[var(--muted)] pl-1">No teams yet.</p>}
                          {teams.map(renderEntry)}
                        </div>
                      </div>

                      {/* Groups section */}
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <Users2 className="h-4 w-4 text-[var(--accent)]" />
                          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Groups</h3>
                          <span className="text-xs text-[var(--muted)]">— cross-cutting (On-call, Project Phoenix…)</span>
                        </div>
                        <div className="space-y-2">
                          {grps.length === 0 && <p className="text-sm text-[var(--muted)] pl-1">No groups yet.</p>}
                          {grps.map(renderEntry)}
                        </div>
                      </div>

                      {/* Create form */}
                      <div className="rounded-lg border border-[var(--border)] p-4">
                        <h4 className="mb-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Create new</h4>
                        <div className="space-y-2">
                          {/* Type toggle */}
                          <div className="flex rounded-md border border-[var(--border)] p-0.5 w-fit">
                            {(["team", "group"] as const).map((t) => (
                              <button key={t} type="button" onClick={() => setNewGroupType(t)}
                                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                                  newGroupType === t
                                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                                }`}>
                                {t === "team" ? <Building2 className="h-3.5 w-3.5" /> : <Users2 className="h-3.5 w-3.5" />}
                                {t}
                              </button>
                            ))}
                          </div>
                          <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder={newGroupType === "team" ? "Team name (e.g. Engineering)" : "Group name (e.g. On-call Rotation)"}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                          <input type="text" value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)}
                            placeholder="Description (optional)"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                          <button type="button" disabled={groupBusy || !newGroupName.trim()}
                            onClick={async () => {
                              setGroupBusy(true); setGroupError(null);
                              try {
                                const r = await fetch("/api/admin/groups", {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: newGroupName, description: newGroupDesc, members: [], type: newGroupType }),
                                });
                                if (!r.ok) throw new Error((await r.json()).error);
                                setNewGroupName(""); setNewGroupDesc("");
                                await loadGroups();
                              } catch (e) { setGroupError(String(e)); }
                              finally { setGroupBusy(false); }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
                            {newGroupType === "team" ? <Building2 className="h-3.5 w-3.5" /> : <Users2 className="h-3.5 w-3.5" />}
                            Create {newGroupType}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[var(--muted)]">
                        Reference any team or group as <code className="rounded bg-[var(--border)] px-1">@id</code> in vault ACLs and password sharing.
                      </p>
                    </div>
                  );
                })()}

                {/* Vaults tab */}
                {activeTab === "vaults" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Vault registry</h3>
                    {vaultError && <p className="text-xs text-red-600">{vaultError}</p>}
                    <div className="space-y-2">
                      {vaults.map((v) => (
                        <div key={v.id} className="rounded-lg border border-[var(--border)] p-3">
                          <div className="mb-2 flex items-center gap-2">
                            {v.secure ? <Lock className="h-4 w-4 text-amber-500" /> : <BookOpen className="h-4 w-4 text-[var(--accent)]" />}
                            <span className="flex-1 font-medium text-sm">{v.name}</span>
                            <span className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--border)] text-[var(--muted)] font-mono">{v.id}</span>
                            <button type="button" onClick={() => setEditingVault(editingVault?.id === v.id ? null : { ...v })}
                              className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs hover:bg-[var(--border)]">
                              {editingVault?.id === v.id ? "Cancel" : "Edit ACL"}
                            </button>
                          </div>
                          <p className="mb-2 font-mono text-[11px] text-[var(--muted)]">{v.id === "main" ? process.env.VAULT_PATH || "/vault" : v.description || "—"}</p>
                          {/* ACL table */}
                          {editingVault?.id !== v.id && (
                            <div className="flex flex-wrap gap-1.5">
                              {v.access.map((a, i) => (
                                <span key={i} className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px]">
                                  <span className="font-medium">{a.user === "*" ? "everyone" : a.user}</span>
                                  <span className="text-[var(--muted)]">·</span>
                                  <span className="text-[var(--accent)]">{a.role}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {editingVault?.id === v.id && (
                            <div className="mt-2 space-y-2">
                              <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                                {editingVault.access.map((a, i) => (
                                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                                    <input value={a.user} onChange={(e) => {
                                      const next = [...editingVault.access];
                                      next[i] = { ...a, user: e.target.value };
                                      setEditingVault({ ...editingVault, access: next });
                                    }} placeholder="username or *" className="w-32 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-mono" />
                                    <select value={a.role} onChange={(e) => {
                                      const next = [...editingVault.access];
                                      next[i] = { ...a, role: e.target.value as VaultAccess["role"] };
                                      setEditingVault({ ...editingVault, access: next });
                                    }} className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs">
                                      <option value="reader">reader</option>
                                      <option value="editor">editor</option>
                                      <option value="admin">admin</option>
                                    </select>
                                    <button type="button" onClick={() => setEditingVault({ ...editingVault, access: editingVault.access.filter((_, j) => j !== i) })}
                                      className="ml-auto text-[var(--muted)] hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button type="button"
                                  onClick={() => setEditingVault({ ...editingVault, access: [...editingVault.access, { user: "", role: "editor" }] })}
                                  className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--border)]">
                                  <UserPlus className="h-3 w-3" /> Add rule
                                </button>
                                <button type="button" disabled={vaultBusy}
                                  onClick={async () => {
                                    setVaultBusy(true); setVaultError(null);
                                    try {
                                      const r = await fetch(`/api/vaults/${v.id}`, {
                                        method: "PUT", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ access: editingVault.access }),
                                      });
                                      if (!r.ok) throw new Error((await r.json()).error);
                                      await loadVaults();
                                      setEditingVault(null);
                                    } catch (e) { setVaultError(String(e)); }
                                    finally { setVaultBusy(false); }
                                  }}
                                  className="ml-auto rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50">
                                  {vaultBusy ? "Saving…" : "Save ACL"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      Use the vault switcher in the toolbar to add new vaults. <code className="rounded bg-[var(--border)] px-1">*</code> means all authenticated users.
                    </p>
                  </div>
                )}

                {/* Security tab */}
                {activeTab === "security" && (
                  <div className="space-y-5">
                    <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Encryption unlock</h3>
                    <p className="text-sm text-[var(--muted)]">
                      Limits how many wrong passphrases a user can enter before being temporarily locked out.
                      Applies to both encrypted note unlocking and the password vault.
                    </p>
                    {secError && <p className="text-xs text-red-600">{secError}</p>}
                    {secSaved && <p className="text-xs text-emerald-600">Saved.</p>}
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block text-sm">
                        Max failed attempts
                        <input
                          type="number" min={1} max={20} value={secMaxAttempts}
                          onChange={(e) => setSecMaxAttempts(Number(e.target.value))}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        />
                        <span className="mt-1 block text-xs text-[var(--muted)]">1–20 attempts</span>
                      </label>
                      <label className="block text-sm">
                        Lockout duration (minutes)
                        <input
                          type="number" min={1} max={1440} value={secLockoutMinutes}
                          onChange={(e) => setSecLockoutMinutes(Number(e.target.value))}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        />
                        <span className="mt-1 block text-xs text-[var(--muted)]">1–1440 min (1 day max)</span>
                      </label>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-[var(--muted)]">
                      <p className="font-medium text-[var(--foreground)] mb-1">Current policy</p>
                      <p>After <strong>{secMaxAttempts}</strong> failed attempts, the user is locked out for <strong>{secLockoutMinutes} minute{secLockoutMinutes !== 1 ? "s" : ""}</strong>. Successful unlock resets the counter.</p>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" disabled={secBusy}
                        onClick={async () => {
                          setSecBusy(true); setSecError(null); setSecSaved(false);
                          try {
                            const r = await fetch("/api/settings", {
                              method: "PUT", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ security: { max_unlock_attempts: secMaxAttempts, unlock_lockout_minutes: secLockoutMinutes } }),
                            });
                            if (!r.ok) throw new Error((await r.json()).error);
                            setSecSaved(true);
                            setTimeout(() => setSecSaved(false), 3000);
                          } catch (e) { setSecError(String(e)); }
                          finally { setSecBusy(false); }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
                        {secBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save policy
                      </button>
                    </div>

                    {/* TOTP enforcement */}
                    <div className="border-t border-[var(--border)] pt-5 space-y-3">
                      <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Two-factor authentication (TOTP)</h3>
                      <p className="text-sm text-[var(--muted)]">
                        When enabled, all users must set up an authenticator app before they can access the vault.
                        Users without TOTP configured will be forced through enrollment on their next login.
                      </p>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={async () => {
                            setTotpBusy(true);
                            try {
                              const next = !totpRequired;
                              const r = await fetch("/api/admin/totp", {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ totp_required: next }),
                              });
                              if (!r.ok) throw new Error((await r.json()).error);
                              setTotpRequired(next);
                            } catch (e) { setSecError(String(e)); }
                            finally { setTotpBusy(false); }
                          }}
                          className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${totpRequired ? "bg-[var(--accent)]" : "bg-[var(--border)]"} ${totpBusy ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${totpRequired ? "translate-x-6" : "translate-x-1"}`} />
                        </div>
                        <span className="text-sm font-medium">
                          {totpRequired ? "Required for all users" : "Optional (per user)"}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* System tab */}
                {activeTab === "system" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="mb-4 text-sm font-medium text-[var(--muted)] uppercase tracking-wide">Backup</h3>
                      <p className="mb-3 text-sm text-[var(--muted)]">
                        Download a compressed archive of your vault (docs + config, excludes search cache).
                      </p>
                      {lastBackup && <p className="mb-3 text-xs text-[var(--muted)]">Last download: {lastBackup}</p>}
                      <button type="button" disabled={backingUp}
                        onClick={async () => {
                          setBackingUp(true);
                          try {
                            const r = await fetch("/api/backup");
                            if (!r.ok) throw new Error((await r.json()).error || r.statusText);
                            const blob = await r.blob();
                            const cd = r.headers.get("Content-Disposition") ?? "";
                            const fnMatch = cd.match(/filename="([^"]+)"/);
                            const filename = fnMatch?.[1] ?? "kbos-backup.tar.gz";
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = filename; a.click();
                            URL.revokeObjectURL(url);
                            setLastBackup(new Date().toLocaleString());
                          } catch (e) { setError(String(e)); }
                          finally { setBackingUp(false); }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--border)] disabled:opacity-50">
                        {backingUp ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating archive…</> : <><Download className="h-3.5 w-3.5" /> Download backup</>}
                      </button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </div>
                )}

              </div>
            </div>
          </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
