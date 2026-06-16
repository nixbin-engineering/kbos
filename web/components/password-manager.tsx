"use client";

import {
  Check, ChevronRight, Copy, Eye, EyeOff, Globe, KeyRound, Lock, Pencil, Plus, RefreshCw, Share2, ShieldCheck, Trash2, Unlock, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type EntryMeta = {
  id: string;
  title: string;
  username: string;
  url?: string;
  notes?: string;
  tags?: string[];
  shared_with: string[];
  owner?: string;
  created_at: string;
  updated_at: string;
};

type EntryFull = EntryMeta & {
  password: string;
  totp_secret?: string;
};

type FormState = {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  totp_secret: string;
  shared_with: string[];
};

function emptyForm(): FormState {
  return { title: "", username: "", password: "", url: "", notes: "", totp_secret: "", shared_with: [] };
}

function formFromEntry(e: EntryFull): FormState {
  return {
    title: e.title,
    username: e.username,
    password: e.password,
    url: e.url || "",
    notes: e.notes || "",
    totp_secret: e.totp_secret || "",
    shared_with: e.shared_with ?? [],
  };
}

// Client-side password generator — no server round-trip needed
function clientGeneratePassword(length: number, symbols: boolean): string {
  const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const syms = "!@#$%^&*-=_+";
  const charset = alpha + digits + (symbols ? syms : "");
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("")
    .slice(0, length);
}

// TOTP generation (RFC 6238)
async function generateTotp(secret: string): Promise<string> {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const c of clean) {
    const idx = base32Chars.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const key = await crypto.subtle.importKey("raw", new Uint8Array(bytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setUint32(4, counter, false);
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  const arr = new Uint8Array(sig);
  const offset = arr[19] & 0xf;
  const code = (((arr[offset] & 0x7f) << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try { await navigator.clipboard.writeText(""); } catch { /* ignore */ }
        setCopied(false);
      }, 30_000);
    } catch { /* ignore */ }
  };

  return (
    <button type="button" onClick={copy} title={copied ? "Copied! Clears in 30s" : "Copy"}
      className={cn("flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-[var(--border)]", className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />}
    </button>
  );
}

function TotpDisplay({ secret }: { secret: string }) {
  const [code, setCode] = useState("");
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    const refresh = async () => {
      try { setCode(await generateTotp(secret)); } catch { setCode("Error"); }
      setRemaining(30 - (Math.floor(Date.now() / 1000) % 30));
    };
    void refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-lg font-bold tracking-widest text-[var(--accent)]">{code}</span>
      <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
        <div className="h-2 w-2 rounded-full" style={{ background: remaining < 10 ? "var(--destructive, #ef4444)" : "var(--accent)" }} />
        {remaining}s
      </div>
      <CopyButton text={code} />
    </div>
  );
}

function UnlockScreen({ onUnlocked, inline }: { onUnlocked: () => void; inline?: boolean }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    if (!pass) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/encrypt/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: pass }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      setPass("");
      onUnlocked();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (inline) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/20">
        <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void unlock()}
          placeholder="Enter passphrase to unlock"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-amber-400"
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
        <button type="button" disabled={busy || !pass} onClick={unlock}
          className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
          <Unlock className="h-3 w-3" /> {busy ? "…" : "Unlock"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]/10">
        <Lock className="h-8 w-8 text-[var(--accent)]" />
      </div>
      <div className="text-center">
        <h2 className="mb-1 font-semibold">Password vault locked</h2>
        <p className="text-sm text-[var(--muted)]">Enter your vault passphrase to unlock and access stored credentials</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void unlock()}
          placeholder="Vault passphrase"
          autoFocus
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <button type="button" disabled={busy || !pass} onClick={unlock}
          className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
          {busy ? "Unlocking…" : "Unlock vault"}
        </button>
        <p className="text-center text-xs text-[var(--muted)]">
          This is your note encryption passphrase — set when you first enabled encryption.
        </p>
      </div>
    </div>
  );
}

export function PasswordManager() {
  const [locked, setLocked] = useState(true);
  const [checkingLock, setCheckingLock] = useState(true);
  const [entries, setEntries] = useState<EntryMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullEntry, setFullEntry] = useState<EntryFull | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [genLength, setGenLength] = useState(20);
  const [genSymbols, setGenSymbols] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  type GroupItem = { id: string; name: string };
  const [availableGroups, setAvailableGroups] = useState<GroupItem[]>([]);

  // Check lock status via the unlock status endpoint (not the password list)
  const checkLockStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/encrypt/unlock");
      if (r.ok) {
        const { unlocked } = await r.json();
        return unlocked as boolean;
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  const loadEntries = useCallback(async () => {
    const r = await fetch("/api/passwords");
    if (r.ok) {
      const data = await r.json();
      setEntries(data.entries || []);
    }
  }, []);

  // On mount: check if already unlocked (e.g. after page refresh with active session)
  useEffect(() => {
    (async () => {
      setCheckingLock(true);
      const unlocked = await checkLockStatus();
      setLocked(!unlocked);
      if (unlocked) await loadEntries();
      setCheckingLock(false);
    })();
  }, [checkLockStatus, loadEntries]);

  useEffect(() => {
    fetch("/api/admin/groups").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.groups) setAvailableGroups(d.groups);
    }).catch(() => {});
  }, []);

  const handleUnlocked = useCallback(async () => {
    setLocked(false);
    setSessionExpired(false);
    await loadEntries();
  }, [loadEntries]);

  const openEntry = async (id: string) => {
    setSelectedId(id);
    setFullEntry(null);
    setEditing(false);
    setShowPassword(false);
    const r = await fetch(`/api/passwords/${id}`);
    if (r.status === 423) { setSessionExpired(true); return; }
    if (r.ok) setFullEntry((await r.json()).entry);
  };

  const saveEntry = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        username: form.username.trim(),
        password: form.password,
        url: form.url.trim() || undefined,
        notes: form.notes.trim() || undefined,
        totp_secret: form.totp_secret.trim() || undefined,
        shared_with: form.shared_with,
      };

      if (creating) {
        const r = await fetch("/api/passwords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.status === 423) { setSessionExpired(true); return; }
        if (!r.ok) {
          const text = await r.text();
          let msg = `HTTP ${r.status}`;
          try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
          throw new Error(msg);
        }
        const newEntry = (await r.json()).entry;
        await loadEntries();
        setCreating(false);
        setSelectedId(newEntry.id);
        void openEntry(newEntry.id);
      } else if (selectedId) {
        const r = await fetch(`/api/passwords/${selectedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.status === 423) { setSessionExpired(true); return; }
        if (!r.ok) {
          const text = await r.text();
          let msg = `HTTP ${r.status}`;
          try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
          throw new Error(msg);
        }
        await loadEntries();
        setEditing(false);
        void openEntry(selectedId);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    const r = await fetch(`/api/passwords/${id}`, { method: "DELETE" });
    if (r.status === 423) { setSessionExpired(true); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) { setSelectedId(null); setFullEntry(null); }
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(false);
    setSelectedId(null);
    setFullEntry(null);
    setError(null);
    setForm({ ...emptyForm(), password: clientGeneratePassword(genLength, genSymbols) });
  };

  const filtered = entries.filter(
    (e) =>
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase()) ||
      (e.url || "").toLowerCase().includes(search.toLowerCase()),
  );

  if (checkingLock) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  if (locked) {
    return <UnlockScreen onUnlocked={handleUnlocked} />;
  }

  const showForm = editing || creating;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search passwords…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
          <button type="button" onClick={startCreate} title="New password"
            className="flex items-center justify-center rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 && !creating && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <KeyRound className="h-8 w-8 text-[var(--border)]" />
              <p className="text-sm text-[var(--muted)]">
                {entries.length === 0 ? "No saved passwords yet" : "No results"}
              </p>
              {entries.length === 0 && (
                <button type="button" onClick={startCreate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)]">
                  <Plus className="h-3.5 w-3.5" /> Add first password
                </button>
              )}
            </div>
          )}
          {filtered.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => { if (!creating && !editing) void openEntry(e.id); }}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--border)]/50",
                selectedId === e.id && !creating && "bg-[var(--accent)]/10",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-xs font-bold uppercase text-[var(--accent)]">
                {e.title[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{e.title}</p>
                <p className="truncate text-xs text-[var(--muted)] leading-tight">{e.username || e.url || "—"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {(e.shared_with?.length > 0) && <Share2 className="h-3 w-3 text-[var(--muted)] opacity-60" />}
                <ChevronRight className="h-3 w-3 text-[var(--muted)] opacity-40" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail / form pane */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Session-expired inline unlock */}
        {sessionExpired && (
          <div className="p-3">
            <UnlockScreen onUnlocked={handleUnlocked} inline />
          </div>
        )}

        {!selectedId && !creating && !sessionExpired && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <KeyRound className="h-10 w-10 text-[var(--border)]" />
            <p className="text-sm text-[var(--muted)]">Select an entry or create a new one</p>
            <button type="button" onClick={startCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)]">
              <Plus className="h-4 w-4" /> New password
            </button>
          </div>
        )}

        {(selectedId || creating) && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Action bar */}
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
              <span className="flex-1 truncate font-medium text-sm">
                {creating ? "New password entry" : fullEntry?.title ?? "Loading…"}
              </span>
              {!showForm && fullEntry && !sessionExpired && (
                <>
                  <button type="button" onClick={() => { setEditing(true); setError(null); setForm(formFromEntry(fullEntry)); }}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--border)]">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => void deleteEntry(selectedId!)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </>
              )}
              {showForm && (
                <>
                  <button type="button" onClick={() => { setEditing(false); setCreating(false); setError(null); }}
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--border)]">
                    Cancel
                  </button>
                  <button type="button" disabled={busy || !form.title.trim() || !form.password} onClick={saveEntry}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50">
                    {busy ? "Saving…" : "Save"}
                  </button>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* View mode */}
              {!showForm && fullEntry && !sessionExpired && (
                <div className="space-y-4">
                  {fullEntry.url && (
                    <Field label="Website">
                      <a href={fullEntry.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        {fullEntry.url}
                      </a>
                    </Field>
                  )}
                  <Field label="Username">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 font-mono text-sm">{fullEntry.username || "—"}</span>
                      {fullEntry.username && <CopyButton text={fullEntry.username} />}
                    </div>
                  </Field>
                  <Field label="Password">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 font-mono text-sm tracking-widest">
                        {showPassword ? fullEntry.password : "•".repeat(Math.min(fullEntry.password.length, 20))}
                      </span>
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="rounded-md p-1.5 hover:bg-[var(--border)]">
                        {showPassword ? <EyeOff className="h-3.5 w-3.5 text-[var(--muted)]" /> : <Eye className="h-3.5 w-3.5 text-[var(--muted)]" />}
                      </button>
                      <CopyButton text={fullEntry.password} />
                    </div>
                  </Field>
                  {fullEntry.totp_secret && (
                    <Field label="One-time code (TOTP)">
                      <TotpDisplay secret={fullEntry.totp_secret} />
                    </Field>
                  )}
                  {fullEntry.notes && (
                    <Field label="Notes">
                      <p className="whitespace-pre-wrap text-sm">{fullEntry.notes}</p>
                    </Field>
                  )}
                  <Field label="Sharing">
                    {(!fullEntry.shared_with || fullEntry.shared_with.length === 0) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                        <Lock className="h-3 w-3" /> Private (only you)
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {fullEntry.shared_with.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                            <Share2 className="h-3 w-3" />
                            {t === "*" ? "Everyone" : t.startsWith("@") ? `Group: ${t.slice(1)}` : t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>
                  <p className="text-[11px] text-[var(--muted)]">
                    Created {new Date(fullEntry.created_at).toLocaleString()} · Updated {new Date(fullEntry.updated_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Edit / create form */}
              {showForm && (
                <div className="space-y-4 pb-4">
                  <FormField label="Title *">
                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. GitHub" autoFocus
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                  </FormField>
                  <FormField label="Website URL">
                    <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                      placeholder="https://…"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                  </FormField>
                  <FormField label="Username / Email">
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                  </FormField>
                  <FormField label="Password *">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pr-9 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                      <span className="shrink-0 text-xs text-[var(--muted)]">Length:</span>
                      <input type="range" min={8} max={64} value={genLength} onChange={(e) => setGenLength(Number(e.target.value))}
                        className="flex-1 accent-[var(--accent)]" />
                      <span className="w-6 shrink-0 text-center text-xs font-mono text-[var(--muted)]">{genLength}</span>
                      <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-[var(--muted)]">
                        <input type="checkbox" checked={genSymbols} onChange={(e) => setGenSymbols(e.target.checked)} className="h-3 w-3" />
                        Symbols
                      </label>
                      <button type="button"
                        onClick={() => setForm((f) => ({ ...f, password: clientGeneratePassword(genLength, genSymbols) }))}
                        className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--border)]">
                        <RefreshCw className="h-3 w-3" /> Generate
                      </button>
                    </div>
                  </FormField>
                  <FormField label="TOTP secret (optional)">
                    <input value={form.totp_secret} onChange={(e) => setForm({ ...form, totp_secret: e.target.value })}
                      placeholder="Base32 secret from authenticator app"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                    {form.totp_secret && (
                      <div className="mt-2"><TotpDisplay secret={form.totp_secret} /></div>
                    )}
                  </FormField>
                  <FormField label="Notes">
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3} placeholder="Any additional notes…"
                      className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                  </FormField>
                  <FormField label="Sharing">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { token: "*", label: "Everyone" },
                          ...availableGroups.map((g) => ({ token: `@${g.id}`, label: g.name })),
                        ].map(({ token, label }) => {
                          const active = form.shared_with.includes(token);
                          return (
                            <button key={token} type="button"
                              onClick={() => setForm((f) => ({
                                ...f,
                                shared_with: active
                                  ? f.shared_with.filter((t) => t !== token)
                                  : [...f.shared_with, token],
                              }))}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                active
                                  ? "border-[var(--accent)] bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
                                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]",
                              )}>
                              {active ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          placeholder="username or @groupId — press Enter to add"
                          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-[var(--accent)]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val && !form.shared_with.includes(val)) {
                                setForm((f) => ({ ...f, shared_with: [...f.shared_with, val] }));
                              }
                              (e.target as HTMLInputElement).value = "";
                              e.preventDefault();
                            }
                          }}
                        />
                      </div>
                      {form.shared_with.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {form.shared_with.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs text-[var(--accent)]">
                              {t === "*" ? "Everyone" : t.startsWith("@") ? `Group: ${t.slice(1)}` : t}
                              <button type="button" onClick={() => setForm((f) => ({ ...f, shared_with: f.shared_with.filter((x) => x !== t) }))}
                                className="ml-0.5 hover:text-red-400"><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">Private — only you can see this entry</p>
                      )}
                    </div>
                  </FormField>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
