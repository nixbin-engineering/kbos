"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownBody } from "./markdown-body";

type Props = {
  target: string;
  section?: string;
  block?: string;
  fromPath?: string;
  onOpenDoc?: (path: string) => void;
};

type EmbedData = {
  path: string;
  title: string;
  body: string;
};

export function MarkdownEmbed({ target, section, block, fromPath, onOpenDoc }: Props) {
  const [data, setData] = useState<EmbedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ target });
    if (section) params.set("section", section);
    if (block) params.set("block", block);
    if (fromPath) params.set("from", fromPath);

    fetch(`/api/embed?${params}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || r.statusText);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [target, section, block, fromPath]);

  if (loading) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading embed…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="my-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--muted)]">
        Embed not found: {target}
        {section ? `#${section}` : ""}
        {block ? `^${block}` : ""}
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="truncate text-xs font-medium">{data.title}</span>
        {onOpenDoc && (
          <button
            type="button"
            onClick={() => onOpenDoc(data.path)}
            className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            Open <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="px-3 py-2">
        <MarkdownBody body={data.body} docPath={data.path} onOpenDoc={onOpenDoc} embedDepth={1} />
      </div>
    </div>
  );
}
