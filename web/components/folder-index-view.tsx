"use client";

import { FilePlus, FolderOpen, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { mergeLiveFolderIndex } from "@/lib/folder-index-live";
import type { FolderIndex, TreeNode } from "@/lib/types";
import { FolderContentsPanel } from "./folder-contents";
import { MarkdownBody, scrollToHeading } from "./markdown-body";
import { TableOfContentsPanel } from "./table-of-contents";
import { extractToc } from "@/lib/toc";

type Props = {
  folderPath: string;
  tree?: TreeNode | null;
  onOpenDoc: (path: string) => void;
  onOpenFolder: (folder: string) => void;
  onCreateIndex?: () => void;
  refreshKey?: number;
  onAskAi?: () => void;
};

export function FolderIndexView({
  folderPath,
  tree = null,
  onOpenDoc,
  onOpenFolder,
  onCreateIndex,
  refreshKey = 0,
  onAskAi,
}: Props) {
  const [data, setData] = useState<FolderIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url =
      folderPath === ""
        ? "/api/folders"
        : `/api/folders/${folderPath.split("/").map(encodeURIComponent).join("/")}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || r.statusText);
        return r.json() as Promise<FolderIndex>;
      })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [folderPath, refreshKey]);

  const displayIndex = useMemo(
    () => mergeLiveFolderIndex(data, tree, folderPath) ?? data,
    [data, tree, folderPath],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[var(--muted)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading folder…
      </div>
    );
  }

  if (error || !displayIndex) {
    return (
      <div className="flex flex-1 items-center justify-center text-red-600 dark:text-red-300">
        {error || "Failed to load folder"}
      </div>
    );
  }

  const body = displayIndex.indexDoc?.body || "";
  const toc = extractToc(body);

  return (
    <div className="flex min-h-0 flex-1">
      <article className="markdown-preview min-w-0 flex-1 overflow-y-auto p-6">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">docs/{displayIndex.folder || ""}</p>
              <h1 className="text-2xl font-bold">{displayIndex.indexDoc?.meta.title || displayIndex.folderTitle}</h1>
            </div>
            {onAskAi && (
              <button
                type="button"
                onClick={onAskAi}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm hover:bg-[var(--border)]"
              >
                <MessageSquare className="h-4 w-4" /> Ask AI
              </button>
            )}
          </div>
        </header>

        {displayIndex.indexDoc ? (
          <MarkdownBody body={body} docPath={displayIndex.indexDoc?.path} onOpenDoc={onOpenDoc} />
        ) : (
          <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center">
            <FolderOpen className="mx-auto mb-2 h-8 w-8 text-[var(--muted)]" />
            <p className="mb-3 text-sm text-[var(--muted)]">No index.md in this folder yet.</p>
            {onCreateIndex && (
              <button
                type="button"
                onClick={onCreateIndex}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-fg)]"
              >
                <FilePlus className="h-4 w-4" /> Create index.md
              </button>
            )}
          </div>
        )}

        <FolderContentsPanel index={displayIndex} onOpenDoc={onOpenDoc} onOpenFolder={onOpenFolder} />
      </article>
      {(displayIndex.indexDoc && toc.length > 0) && (
        <TableOfContentsPanel entries={toc} onNavigate={scrollToHeading} />
      )}
    </div>
  );
}
