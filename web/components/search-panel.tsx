"use client";

import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/lib/types";

type Props = {
  onOpen: (path: string) => void;
  tagQuery?: string | null;
  onTagQueryHandled?: () => void;
  searchInputId?: string;
};

export function SearchPanel({ onOpen, tagQuery, onTagQueryHandled, searchInputId }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (query: string) => {
    const text = query.trim();
    if (!text) { setHits([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
      const data = await r.json();
      setHits(data.hits || []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced live search
  const handleChange = (value: string) => {
    // Convert #tag shorthand to tag: prefix
    const normalized = value.replace(/^#(\S+)/, "tag:$1");
    setQ(normalized);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(normalized), 300);
  };

  const clear = () => { setQ(""); setHits([]); };

  useEffect(() => {
    if (!tagQuery) return;
    setQ(tagQuery);
    void run(tagQuery);
    onTagQueryHandled?.();
  }, [tagQuery, run, onTagQueryHandled]);

  return (
    <div className="shrink-0 border-b border-[var(--border)] p-2.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
        <input
          id={searchInputId}
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && clear()}
          placeholder="Search… or #tag, tag:docker, folder:…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5 pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--muted)]" />
        )}
        {!loading && q && (
          <button type="button" onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] divide-y divide-[var(--border)]">
          {hits.map((h) => (
            <li key={h.path}>
              <button
                type="button"
                onClick={() => { onOpen(h.path); clear(); }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--border)]/50 transition-colors"
              >
                <span className="block truncate text-sm font-medium leading-snug">{h.title}</span>
                <span className="block truncate text-[10px] text-[var(--muted)]">{h.path}</span>
                {h.snippet && (
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)] opacity-80">
                    {h.snippet}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && !loading && hits.length === 0 && (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">No results for "{q}"</p>
      )}
    </div>
  );
}
