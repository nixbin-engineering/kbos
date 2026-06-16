"use client";

import { BookOpen, Check, ChevronDown, Lock, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type VaultItem = {
  id: string;
  name: string;
  description?: string;
  secure?: boolean;
  active: boolean;
};

type Props = {
  onSwitch: () => void;     // called after vault switch so shell reloads tree
  isAdmin: boolean;
};

export function VaultSwitcher({ onSwitch, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [vaultsBase, setVaultsBase] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const active = vaults.find((v) => v.active);

  const load = useCallback(async () => {
    const r = await fetch("/api/vaults");
    if (r.ok) {
      const data = await r.json();
      setVaults(data.vaults || []);
      if (data.vaultsBase) setVaultsBase(data.vaultsBase);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const switchVault = async (id: string) => {
    if (switching || id === active?.id) return;
    setSwitching(id);
    try {
      const r = await fetch("/api/vaults/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) {
        await load();
        setOpen(false);
        onSwitch();
      }
    } finally {
      setSwitching(null);
    }
  };

  const addVault = async () => {
    if (!addName.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const r = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, description: addDesc }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      await load();
      setShowAdd(false);
      setAddName(""); setAddDesc("");
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--border)]"
      >
        {active?.secure && <Lock className="h-3 w-3 text-amber-500" />}
        <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="max-w-[120px] truncate font-medium">{active?.name ?? "Vaults"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--muted)] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[60] mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--panel)] py-1.5 shadow-xl">
          <p className="mb-1 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Vaults
          </p>
          {vaults.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={switching !== null}
              onClick={() => switchVault(v.id)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                v.active ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "hover:bg-[var(--border)]",
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--border)]">
                {v.secure ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <BookOpen className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{v.name}</p>
                {v.description && <p className="truncate text-[11px] text-[var(--muted)] leading-tight">{v.description}</p>}
              </div>
              {v.active && <Check className="h-3.5 w-3.5 shrink-0" />}
              {v.secure && !v.active && <Lock className="h-3 w-3 shrink-0 text-amber-500 opacity-60" />}
            </button>
          ))}

          {isAdmin && (
            <>
              <div className="my-1.5 border-t border-[var(--border)]" />
              {showAdd ? (
                <div className="px-3 pb-2 pt-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium">New vault</span>
                    <button type="button" onClick={() => setShowAdd(false)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input value={addName} onChange={(e) => setAddName(e.target.value)}
                    placeholder="Vault name" autoFocus
                    onKeyDown={(e) => e.key === "Enter" && void addVault()}
                    className="mb-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs" />
                  <input value={addDesc} onChange={(e) => setAddDesc(e.target.value)}
                    placeholder="Description (optional)"
                    onKeyDown={(e) => e.key === "Enter" && void addVault()}
                    className="mb-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs" />
                  {vaultsBase && (
                    <p className="mb-2 font-mono text-[10px] text-[var(--muted)]">
                      {vaultsBase}/{addName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "<slug>"}
                    </p>
                  )}
                  {addError && <p className="mb-1 text-[10px] text-red-600">{addError}</p>}
                  <button type="button" disabled={addBusy || !addName.trim()} onClick={addVault}
                    className="w-full rounded-lg bg-[var(--accent)] py-1.5 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50">
                    {addBusy ? "Creating…" : "Create vault"}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowAdd(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]">
                  <Plus className="h-3.5 w-3.5" /> Add vault
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
