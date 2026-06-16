"use client";

import { LogOut, Palette, ShieldCheck, ShieldOff, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "./theme-provider";

type Props = {
  user: string | null;
  onLogout: () => void;
};

export function UserMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [totpPanelOpen, setTotpPanelOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  // TOTP setup state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpStep, setTotpStep] = useState<"idle" | "setup" | "done">("idle");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openTotpPanel = async () => {
    setTotpPanelOpen(true);
    setOpen(false);
    setTotpError(null);
    setTotpBusy(true);
    try {
      // Check current status via /api/auth/me or settings
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setTotpEnabled(me.totp_enabled ?? false);
      if (!me.totp_enabled) {
        const r = await fetch("/api/auth/totp/setup");
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setSecret(data.secret);
        setQr(data.qr);
        setTotpStep("setup");
      } else {
        setTotpStep("idle");
      }
    } catch (e) {
      setTotpError(String(e));
    } finally {
      setTotpBusy(false);
    }
  };

  const confirmSetup = async () => {
    setTotpBusy(true);
    setTotpError(null);
    try {
      const r = await fetch("/api/auth/totp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setTotpEnabled(true);
      setTotpStep("done");
      setCode("");
    } catch (e) {
      setTotpError(String(e));
      setCode("");
    } finally {
      setTotpBusy(false);
    }
  };

  const disableTotp = async () => {
    if (!confirm("Disable two-factor authentication? Your account will be less secure.")) return;
    setTotpBusy(true);
    setTotpError(null);
    try {
      const r = await fetch("/api/auth/totp/setup", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok) throw new Error((await r.json()).error);
      setTotpEnabled(false);
      setTotpStep("idle");
      setQr("");
      setSecret("");
    } catch (e) {
      setTotpError(String(e));
    } finally {
      setTotpBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={user ?? "User menu"}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--border)]"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[var(--accent-fg)]">
          {user?.[0]?.toUpperCase() ?? "?"}
        </span>
        {user && <span className="max-w-[8rem] truncate">{user}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-[var(--border)] bg-[var(--panel)] py-1 shadow-xl">
          {user && (
            <div className="border-b border-[var(--border)] px-3 py-2">
              <p className="text-xs font-medium">{user}</p>
            </div>
          )}
          <button type="button" onClick={() => { setThemePanelOpen(true); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--border)]">
            <Palette className="h-4 w-4 opacity-60" /> Theme
          </button>
          {user && (
            <button type="button" onClick={openTotpPanel}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--border)]">
              <Smartphone className="h-4 w-4 opacity-60" /> Two-factor auth
            </button>
          )}
          {user && (
            <button type="button" onClick={() => { onLogout(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-[var(--border)]">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>
      )}

      {/* Theme panel */}
      {themePanelOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Theme</h2>
              <button type="button" onClick={() => setThemePanelOpen(false)} className="rounded p-1 hover:bg-[var(--border)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                <button key={id} type="button" onClick={() => { setTheme(id); setThemePanelOpen(false); }}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${theme === id ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--border)]"}`}>
                  {THEMES[id].label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOTP panel */}
      {totpPanelOpen && createPortal(
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/40">
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[var(--accent)]" /> Two-factor authentication
              </h2>
              <button type="button" onClick={() => { setTotpPanelOpen(false); setTotpStep("idle"); setCode(""); setTotpError(null); }}
                className="rounded p-1 hover:bg-[var(--border)]"><X className="h-4 w-4" /></button>
            </div>

            {totpBusy && totpStep === "idle" && <p className="text-sm text-[var(--muted)]">Loading…</p>}

            {/* Already enabled */}
            {!totpBusy && totpEnabled && totpStep !== "setup" && totpStep !== "done" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-medium">TOTP is active on your account</span>
                </div>
                <p className="text-xs text-[var(--muted)]">Your account is protected with an authenticator app.</p>
                <button type="button" disabled={totpBusy} onClick={disableTotp}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10">
                  <ShieldOff className="h-3.5 w-3.5" /> Disable TOTP
                </button>
              </div>
            )}

            {/* Setup flow */}
            {totpStep === "setup" && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted)]">Scan with Google Authenticator, Authy, or any TOTP app, then enter a code to confirm.</p>
                {qr && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt="TOTP QR" className="h-44 w-44 rounded-lg border border-[var(--border)]" />
                  </div>
                )}
                {secret && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-center">
                    <p className="mb-0.5 text-[10px] text-[var(--muted)]">Manual key</p>
                    <code className="text-xs font-mono break-all">{secret}</code>
                  </div>
                )}
                <input type="text" inputMode="numeric" placeholder="000 000" maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-xl font-mono tracking-[0.4em]" />
                {totpError && <p className="text-xs text-red-500">{totpError}</p>}
                <button type="button" disabled={totpBusy || code.length !== 6} onClick={confirmSetup}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
                  style={{ background: "var(--accent)" }}>
                  Activate TOTP
                </button>
              </div>
            )}

            {/* Done */}
            {totpStep === "done" && (
              <div className="space-y-3 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="font-medium">Two-factor auth is now active!</p>
                <p className="text-xs text-[var(--muted)]">You&apos;ll be asked for a code on your next login from a new device.</p>
                <button type="button" onClick={() => setTotpPanelOpen(false)}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)]">Done</button>
              </div>
            )}
          </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
