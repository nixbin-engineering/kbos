"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { LinkRef } from "@/lib/types";

type Props = {
  docPath: string | null;
  onOpenDoc: (path: string) => void;
};

export function BacklinksPanel({ docPath, onOpenDoc }: Props) {
  const [backlinks, setBacklinks] = useState<LinkRef[]>([]);
  const [outgoing, setOutgoing] = useState<LinkRef[]>([]);

  useEffect(() => {
    if (!docPath) {
      setBacklinks([]);
      setOutgoing([]);
      return;
    }
    fetch(`/api/links?path=${encodeURIComponent(docPath)}`)
      .then((r) => (r.ok ? r.json() : { backlinks: [], outgoing: [] }))
      .then((data) => {
        setBacklinks(data.backlinks || []);
        setOutgoing(data.outgoing || []);
      })
      .catch(() => {
        setBacklinks([]);
        setOutgoing([]);
      });
  }, [docPath]);

  return (
    <div className="space-y-4 text-sm">
      <section>
        <p className="mb-2 flex items-center gap-1.5 font-medium">
          <Link2 className="h-3.5 w-3.5" />
          Referenced by
          {backlinks.length > 0 && (
            <span className="ml-auto rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">
              {backlinks.length}
            </span>
          )}
        </p>
        {backlinks.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No backlinks</p>
        ) : (
          <ul className="space-y-0.5">
            {backlinks.map((l) => (
              <li key={l.path}>
                <button
                  type="button"
                  onClick={() => onOpenDoc(l.path)}
                  className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-[var(--accent)] transition-colors duration-150 hover:bg-[var(--border)]/60 hover:underline"
                  title={l.path}
                >
                  {l.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {outgoing.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 font-medium">
            Links
            <span className="ml-auto rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">
              {outgoing.length}
            </span>
          </p>
          <ul className="space-y-0.5">
            {outgoing.map((l) => (
              <li key={l.target}>
                {l.broken ? (
                  <span className="block px-1 py-0.5 text-xs text-[var(--muted)] line-through">{l.title}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => l.path && onOpenDoc(l.path)}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-[var(--accent)] transition-colors duration-150 hover:bg-[var(--border)]/60 hover:underline"
                  >
                    {l.title}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
