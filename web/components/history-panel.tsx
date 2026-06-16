"use client";

import { ChevronDown, ChevronRight, Clock, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Commit = { hash: string; date: string; message: string; author: string };

type Props = {
  docPath: string | null;
  onRestore?: (content: string) => void;
};

export function HistoryPanel({ docPath, onRestore }: Props) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewHash, setPreviewHash] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    if (!docPath) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/history?path=${encodeURIComponent(docPath)}`);
      if (!r.ok) return;
      const data = await r.json();
      setGitAvailable(data.gitAvailable ?? false);
      setCommits(data.commits || []);
    } finally {
      setLoading(false);
    }
  }, [docPath]);

  useEffect(() => {
    if (!collapsed && docPath) load();
  }, [collapsed, docPath, load]);

  useEffect(() => {
    setCommits([]);
    setPreviewHash(null);
    setPreviewContent(null);
  }, [docPath]);

  const loadPreview = async (hash: string) => {
    if (previewHash === hash) { setPreviewHash(null); setPreviewContent(null); return; }
    setPreviewHash(hash);
    setPreviewLoading(true);
    try {
      const r = await fetch(`/api/history?path=${encodeURIComponent(docPath!)}&hash=${hash}`);
      if (r.ok) setPreviewContent((await r.json()).content ?? null);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!docPath) return null;

  return (
    <div className="border-t border-[var(--border)] pt-2">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mb-1 flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <Clock className="h-3.5 w-3.5" /> History
      </button>
      {!collapsed && (
        loading ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : gitAvailable === false ? (
          <p className="text-xs text-[var(--muted)]">Git not available in vault.</p>
        ) : commits.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No commits yet for this note.</p>
        ) : (
          <div className="space-y-1">
            {commits.slice(0, 20).map((c) => (
              <div key={c.hash}>
                <div className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => void loadPreview(c.hash)}
                    className="flex-1 text-left"
                  >
                    <p className="truncate text-xs text-[var(--foreground)]">{c.message || "no message"}</p>
                    <p className="text-[10px] text-[var(--muted)]">{new Date(c.date).toLocaleString()} · {c.author}</p>
                  </button>
                  {onRestore && previewHash === c.hash && previewContent !== null && (
                    <button
                      type="button"
                      onClick={() => onRestore(previewContent)}
                      title="Restore this version"
                      className="shrink-0 rounded p-0.5 text-[var(--accent)] hover:bg-[var(--accent)]/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {previewHash === c.hash && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded border border-[var(--border)] bg-[var(--background)] p-1.5 font-mono text-[10px] text-[var(--muted)]">
                    {previewLoading ? "Loading…" : previewContent ?? "Not found"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
