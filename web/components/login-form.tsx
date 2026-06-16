"use client";

import { BookOpen, Brain, Eye, EyeOff, Loader2, Shield, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Step = "password" | "totp_verify" | "totp_setup";

type Props = {
  onLoggedIn: () => void;
};

export function LoginForm({ onLoggedIn }: Props) {
  const [step, setStep] = useState<Step>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // TOTP setup state
  const [setupSecret, setSetupSecret] = useState("");
  const [setupQr, setSetupQr] = useState("");
  const [setupCode, setSetupCode] = useState("");

  const codeRef = useRef<HTMLInputElement>(null);
  const setupCodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "totp_verify") codeRef.current?.focus();
    if (step === "totp_setup") setupCodeRef.current?.focus();
  }, [step]);

  // Step 1 — password
  const submitPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);

      if (data.totp_setup_required) {
        // Admin has enforced TOTP, user hasn't enrolled yet — force setup
        await fetchTotpSetup();
        setStep("totp_setup");
        return;
      }
      if (data.totp_required) {
        setStep("totp_verify");
        return;
      }
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Step 2a — verify TOTP code
  const submitTotpVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code, remember }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  // Step 2b — fetch QR for forced enrollment
  const fetchTotpSetup = async () => {
    const r = await fetch("/api/auth/totp/setup");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setSetupSecret(data.secret);
    setSetupQr(data.qr);
  };

  // Step 2b — confirm enrollment code
  const submitTotpSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/totp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setupSecret, code: setupCode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSetupCode("");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none transition-all duration-150";

  const ringFocus = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)");
  const ringBlur = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.currentTarget.style.boxShadow = "none");

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Left branding panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #000) 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)" }} />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
            <BookOpen className="h-10 w-10 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">KBOS</h1>
          <p className="mb-10 text-lg font-medium text-white/80 max-w-xs leading-relaxed">Your team&apos;s knowledge,<br />beautifully organized.</p>
          <ul className="space-y-4 text-left">
            {[
              { icon: Zap, label: "Fast search", desc: "Find anything instantly with full-text and fuzzy search." },
              { icon: Brain, label: "AI assistant", desc: "Ask questions about your notes in natural language." },
              { icon: Shield, label: "Secure & self-hosted", desc: "Your data stays on your infrastructure, always." },
            ].map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-white/65 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl shadow-md" style={{ background: "var(--accent)" }}>
              <BookOpen className="h-7 w-7 text-[var(--accent-fg)]" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">KBOS</h1>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-xl">

            {/* ── Password step ── */}
            {step === "password" && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Welcome back</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Sign in to your knowledge base</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); submitPassword(); }} className="space-y-4">
                  <div>
                    <label htmlFor="kb-username" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Username</label>
                    <input id="kb-username" type="text" autoComplete="username" placeholder="your-username"
                      value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
                      className={inputClass} style={{ boxShadow: "none" }} onFocus={ringFocus} onBlur={ringBlur} />
                  </div>
                  <div>
                    <label htmlFor="kb-password" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Password</label>
                    <div className="relative">
                      <input id="kb-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-10`} style={{ boxShadow: "none" }} onFocus={ringFocus} onBlur={ringBlur} />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <ErrorBox message={error} />}
                  <button type="submit" disabled={busy || !username || !password}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: "var(--accent)" }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              </>
            )}

            {/* ── TOTP verify step ── */}
            {step === "totp_verify" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--accent-dim)" }}>
                    <ShieldCheck className="h-6 w-6 text-[var(--accent)]" />
                  </div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Two-factor verification</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Enter the 6-digit code from your authenticator app</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); submitTotpVerify(); }} className="space-y-4">
                  <input ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code"
                    placeholder="000 000" maxLength={6}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono`}
                    style={{ boxShadow: "none" }} onFocus={ringFocus} onBlur={ringBlur} />
                  <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-[var(--foreground)]">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded" />
                    Remember this device for 30 days
                  </label>
                  {error && <ErrorBox message={error} />}
                  <button type="submit" disabled={busy || code.length !== 6}
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
                    style={{ background: "var(--accent)" }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? "Verifying…" : "Verify"}
                  </button>
                  <button type="button" onClick={() => { setStep("password"); setCode(""); setError(null); }}
                    className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                    ← Back to sign in
                  </button>
                </form>
              </>
            )}

            {/* ── Forced TOTP setup step ── */}
            {step === "totp_setup" && (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--accent-dim)" }}>
                    <Smartphone className="h-6 w-6 text-[var(--accent)]" />
                  </div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Set up two-factor auth</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Your admin requires TOTP. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)</p>
                </div>
                <div className="space-y-4">
                  {setupQr && (
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={setupQr} alt="TOTP QR code" className="h-44 w-44 rounded-lg border border-[var(--border)]" />
                    </div>
                  )}
                  {setupSecret && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-center">
                      <p className="mb-1 text-xs text-[var(--muted)]">Manual entry key</p>
                      <code className="text-xs font-mono tracking-widest text-[var(--foreground)] break-all">{setupSecret}</code>
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); submitTotpSetup(); }} className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Confirm with a code</label>
                      <input ref={setupCodeRef} type="text" inputMode="numeric" autoComplete="one-time-code"
                        placeholder="000 000" maxLength={6}
                        value={setupCode} onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={`${inputClass} text-center text-xl tracking-[0.4em] font-mono`}
                        style={{ boxShadow: "none" }} onFocus={ringFocus} onBlur={ringBlur} />
                    </div>
                    {error && <ErrorBox message={error} />}
                    <button type="submit" disabled={busy || setupCode.length !== 6}
                      className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
                      style={{ background: "var(--accent)" }}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {busy ? "Activating…" : "Activate & sign in"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-[var(--muted)]">KBOS — self-hosted knowledge base</p>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 dark:border-red-800/50 dark:bg-red-950/30">
      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
      <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{message}</p>
    </div>
  );
}
