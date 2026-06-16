"use client";

import { ChevronDown, ChevronRight, Hash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type TagCount = { tag: string; count: number };

type Props = {
  onSelectTag: (tag: string) => void;
  refreshKey?: number;
  liveDocTags?: string[];
};

/** Stable color index for a tag name — deterministic, not random */
function tagColorIdx(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
  return Math.abs(h) % 10;
}

export function TagExplorer({ onSelectTag, refreshKey = 0, liveDocTags }: Props) {
  const [tags, setTags] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("kbos-tags-collapsed") === "1"); } catch { /**/ }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("kbos-tags-collapsed", next ? "1" : "0"); } catch { /**/ }
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/tags");
      if (r.ok) setTags(((await r.json()).tags || []) as TagCount[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="mb-2 flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <Hash className="h-3 w-3" />
        Tags
        {!collapsed && tags.length > 0 && (
          <span className="ml-auto rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[9px] font-normal normal-case">
            {tags.length}
          </span>
        )}
      </button>

      {!collapsed && (
        loading && tags.length === 0 ? (
          <div className="flex gap-1.5">
            {[60, 45, 70].map((w, i) => (
              <div key={i} className="shimmer h-5 rounded-full" style={{ width: w }} />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-[11px] text-[var(--muted)]">Use #tag in notes or <code>tags:</code> in frontmatter</p>
        ) : (
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {liveDocTags?.map((t) => (
              <span
                key={`live-${t}`}
                className={`tag-chip tag-color-${tagColorIdx(t)} opacity-60`}
                style={{ borderStyle: "dashed" }}
                title="In current note (unsaved)"
              >
                #{t}
              </span>
            ))}
            {tags.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => onSelectTag(t.tag)}
                title={`${t.count} note${t.count !== 1 ? "s" : ""}`}
                className={`tag-chip tag-color-${tagColorIdx(t.tag)}`}
              >
                #{t.tag}
                <span className="opacity-60 text-[9px]">{t.count}</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
