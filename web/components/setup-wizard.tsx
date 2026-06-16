"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

type Props = {
  onComplete: () => void;
};

export function SetupWizard({ onComplete }: Props) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirm }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onComplete();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-lg">
        <h1 className="mb-1 text-xl font-bold">Welcome to KBOS</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          First-run setup — create your admin account and enable local sign-in.
        </p>

        <label className="mb-3 block text-sm">
          Admin username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
            autoFocus
          />
        </label>
        <label className="mb-3 block text-sm">
          Password (8+ characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="mb-4 block text-sm">
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

        <button
          type="button"
          disabled={busy || password.length < 8}
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Complete setup
        </button>

        <p className="mt-4 text-xs text-[var(--muted)]">
          Or via CLI: <code className="rounded bg-[var(--border)] px-1">./manage.sh kb setup</code>
        </p>
      </div>
    </div>
  );
}
