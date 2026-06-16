"use client";

import { Columns2, FileText, Folder, Home, PanelLeftClose, Plus, X } from "lucide-react";
import type { Tab } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  tabs: Tab[];
  activeIdx: number;
  splitEnabled: boolean;
  onActivate: (idx: number) => void;
  onClose: (idx: number) => void;
  onNewTab: () => void;
  onToggleSplit: () => void;
};

function tabLabel(tab: Tab): string {
  if (tab.path) {
    const name = tab.path.split("/").pop() ?? tab.path;
    return name.replace(/\.md(\.enc)?$/, "");
  }
  if (tab.folderView !== null) {
    return tab.folderView ? tab.folderView.split("/").pop() ?? tab.folderView : "Root";
  }
  return "New tab";
}

export function TabBar({ tabs, activeIdx, splitEnabled, onActivate, onClose, onNewTab, onToggleSplit }: Props) {
  return (
    <div className="flex items-center border-b border-[var(--border)] bg-[var(--panel)]">
      <div className="flex min-w-0 flex-1 items-end overflow-x-auto">
        {tabs.map((tab, i) => {
          const active = i === activeIdx;
          return (
            <div
              key={tab.id}
              className={cn(
                "group flex shrink-0 items-center gap-1 border-r border-[var(--border)] px-3 py-1.5 text-sm cursor-pointer select-none",
                active
                  ? "bg-[var(--background)] text-[var(--foreground)] font-medium"
                  : "text-[var(--muted)] hover:bg-[var(--border)]/50 hover:text-[var(--foreground)]",
              )}
              onClick={() => onActivate(i)}
            >
              {tab.folderView !== null
                ? tab.folderView === ""
                  ? <Home className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  : <Folder className="h-3.5 w-3.5 shrink-0 opacity-60" />
                : <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
              }
              <span className="max-w-[120px] truncate">{tabLabel(tab)}</span>
              <button
                type="button"
                title="Close tab"
                onClick={(e) => { e.stopPropagation(); onClose(i); }}
                className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[var(--border)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          title="New tab"
          onClick={onNewTab}
          className="flex shrink-0 items-center gap-1 px-2 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]/50"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center border-l border-[var(--border)] px-1">
        <button
          type="button"
          title={splitEnabled ? "Close split view" : "Split view"}
          onClick={onToggleSplit}
          className={cn(
            "rounded p-1.5 transition-colors",
            splitEnabled
              ? "text-[var(--accent)] hover:bg-[var(--accent)]/10"
              : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]",
          )}
        >
          {splitEnabled ? <PanelLeftClose className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
