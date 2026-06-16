"use client";

import { ChevronRight, FileText, Folder } from "lucide-react";
import type { FolderIndex, FolderIndexEntry } from "@/lib/types";

type Props = {
  index: FolderIndex;
  onOpenDoc: (path: string) => void;
  onOpenFolder: (folder: string) => void;
};

export function FolderContentsPanel({ index, onOpenDoc, onOpenFolder }: Props) {
  const dirs = index.entries.filter((e) => e.type === "dir");
  const files = index.entries.filter((e) => e.type === "file");

  return (
    <section className="mt-8 border-t border-[var(--border)] pt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Folder className="h-5 w-5 opacity-70" />
        Contents
      </h2>
      {index.entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">This folder is empty.</p>
      ) : (
        <div className="space-y-4">
          {dirs.length > 0 && (
            <EntryGroup title="Folders" entries={dirs} onOpenDoc={onOpenDoc} onOpenFolder={onOpenFolder} />
          )}
          {files.length > 0 && (
            <EntryGroup title="Notes" entries={files} onOpenDoc={onOpenDoc} onOpenFolder={onOpenFolder} />
          )}
        </div>
      )}
    </section>
  );
}

function EntryGroup({
  title,
  entries,
  onOpenDoc,
  onOpenFolder,
}: {
  title: string;
  entries: FolderIndexEntry[];
  onOpenDoc: (path: string) => void;
  onOpenFolder: (folder: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{title}</h3>
      <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        {entries.map((e) => (
          <li key={e.path}>
            <button
              type="button"
              onClick={() => (e.type === "dir" ? onOpenFolder(e.path) : onOpenDoc(e.path))}
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--border)]"
            >
              {e.type === "dir" ? (
                <Folder className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
              ) : (
                <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-medium">
                  {e.title}
                  {e.type === "dir" && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                </span>
                {e.snippet && (
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{e.snippet}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
