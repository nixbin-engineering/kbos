"use client";

import type { TocEntry } from "@/lib/toc";
import { BacklinksPanel } from "./backlinks-panel";
import { HistoryPanel } from "./history-panel";
import { TableOfContents } from "./table-of-contents";

type Props = {
  docPath: string | null;
  entries: TocEntry[];
  onNavigate?: (id: string) => void;
  onOpenDoc: (path: string) => void;
  onRestore?: (content: string) => void;
};

export function DocSidebarPanel({ docPath, entries, onNavigate, onOpenDoc, onRestore }: Props) {
  return (
    <div className="flex h-full w-52 shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--border)] bg-[var(--panel)] p-4">
      <TableOfContents entries={entries} onNavigate={onNavigate} />
      <BacklinksPanel docPath={docPath} onOpenDoc={onOpenDoc} />
      <HistoryPanel docPath={docPath} onRestore={onRestore} />
    </div>
  );
}
