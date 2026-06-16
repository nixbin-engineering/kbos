"use client";

import { BookMarked, Loader2 } from "lucide-react";
import { useState } from "react";

type Props = {
  onOpenDoc: (path: string) => void;
  iconOnly?: boolean;
};

const PERIODS = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This week" },
  { id: "monthly", label: "This month" },
  { id: "yearly", label: "This year" },
] as const;

export function JournalMenu({ onOpenDoc, iconOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const openJournal = async (period: string) => {
    setBusy(period);
    try {
      const r = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await r.json();
      if (r.ok && data.path) {
        onOpenDoc(data.path);
        setOpen(false);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        title="Journal"
        onClick={() => setOpen((v) => !v)}
        className={iconOnly
          ? "flex items-center justify-center rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]"
          : "inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--border)]"}
      >
        <BookMarked className="h-4 w-4" />
        {!iconOnly && <span>Journal</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy !== null}
                onClick={() => openJournal(p.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--border)] disabled:opacity-50"
              >
                {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
