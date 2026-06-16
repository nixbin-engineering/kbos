"use client";

import { ListTree } from "lucide-react";
import type { TocEntry } from "@/lib/toc";
import { cn } from "@/lib/utils";

type Props = {
  entries: TocEntry[];
  onNavigate?: (id: string) => void;
  className?: string;
};

export function TableOfContents({ entries, onNavigate, className }: Props) {
  if (entries.length === 0) {
    return (
      <aside className={cn("text-sm text-[var(--muted)]", className)}>
        <p className="mb-2 font-medium text-[var(--foreground)]">On this page</p>
        <p className="text-xs">No headings yet</p>
      </aside>
    );
  }

  return (
    <aside className={cn("text-sm", className)}>
      <p className="mb-2 font-medium">On this page</p>
      <ul className="space-y-0.5 border-l border-[var(--border)] pl-3">
        {entries.map((e) => (
          <li key={e.id} style={{ paddingLeft: `${(e.level - 1) * 10}px` }}>
            <button
              type="button"
              onClick={() => onNavigate?.(e.id)}
              title={e.text}
              className={cn(
                "block w-full cursor-pointer truncate text-left transition-colors duration-150 hover:text-[var(--accent)]",
                e.level === 1 && "text-xs font-semibold text-[var(--foreground)]",
                e.level === 2 && "text-xs font-medium text-[var(--foreground)] opacity-90",
                e.level >= 3 && "text-[11px] text-[var(--muted)]",
              )}
            >
              {e.text}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function TableOfContentsPanel(props: Props) {
  return (
    <div className="flex h-full w-52 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--panel)] p-4">
      <TableOfContents {...props} />
    </div>
  );
}

export function FolderContentsIcon() {
  return <ListTree className="h-3.5 w-3.5" />;
}
