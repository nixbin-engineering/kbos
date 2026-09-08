"use client";

import { HelpCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HelpTopic } from "@/lib/help-content";
import { HelpMarkdownBody } from "./help-markdown";

type Props = {
  topics: HelpTopic[];
};

export function HelpButton({ topics }: Props) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(topics[0]?.slug ?? "");
  const topic = topics.find((t) => t.slug === slug) ?? topics[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (topics.length === 0) return null;

  return (
    <>
      <button
        type="button"
        title="Help"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center">
              <div className="flex max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl border border-[var(--border-strong,var(--border))] bg-[var(--panel-elevated,var(--panel))] shadow-accent-glow animate-fade-in">
                <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] p-2">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                    KBOS Guide
                  </p>
                  {topics.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => setSlug(t.slug)}
                      className={`rounded-md px-2 py-1.5 text-left text-sm ${
                        t.slug === slug
                          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                          : "text-[var(--foreground)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </nav>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                    <h2 className="text-sm font-semibold">{topic?.title}</h2>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
                    {topic && <HelpMarkdownBody body={topic.body} />}
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
