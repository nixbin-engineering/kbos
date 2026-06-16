"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Folder, Hash, LayoutTemplate, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHit, TemplateEntry, TreeNode } from "@/lib/types";

type Action = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tree: TreeNode | null;
  onOpenDoc: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onOpenGraph: () => void;
  onOpenAiChat: () => void;
  onOpenJournal: () => void;
  onNewFromTemplate?: (templatePath: string) => void;
};

function flattenTree(node: TreeNode | null): TreeNode[] {
  if (!node?.children) return [];
  const out: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(node.children);
  return out;
}

function labelForPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md(\.enc)?$/, "");
}

export function CommandPalette({
  open,
  onClose,
  tree,
  onOpenDoc,
  onOpenFolder,
  onOpenGraph,
  onOpenAiChat,
  onOpenJournal,
  onNewFromTemplate,
}: Props) {
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : { templates: [] })
      .then((d) => setTemplates(d.templates || []))
      .catch(() => undefined);
  }, [open]);

  const staticActions: Action[] = [
    {
      id: "graph",
      label: "Open knowledge graph",
      icon: <Zap className="h-4 w-4" />,
      onSelect: () => { onOpenGraph(); onClose(); },
    },
    {
      id: "ai",
      label: "Ask AI assistant",
      description: "Ctrl+Shift+A",
      icon: <Search className="h-4 w-4" />,
      onSelect: () => { onOpenAiChat(); onClose(); },
    },
    {
      id: "journal",
      label: "Open today's journal",
      icon: <FileText className="h-4 w-4" />,
      onSelect: () => { onOpenJournal(); onClose(); },
    },
  ];

  const allNodes = flattenTree(tree);

  const fileItems: Action[] = allNodes
    .filter((n) => n.type === "file")
    .map((n) => ({
      id: `file:${n.path}`,
      label: labelForPath(n.path),
      description: n.path,
      icon: <FileText className="h-4 w-4 opacity-60" />,
      onSelect: () => { onOpenDoc(n.path); onClose(); },
    }));

  const folderItems: Action[] = allNodes
    .filter((n) => n.type === "dir")
    .map((n) => ({
      id: `dir:${n.path}`,
      label: n.name,
      description: n.path + "/",
      icon: <Folder className="h-4 w-4 opacity-60" />,
      onSelect: () => { onOpenFolder(n.path); onClose(); },
    }));

  const q = query.trim().toLowerCase();

  const templateItems: Action[] = onNewFromTemplate
    ? templates.map((t) => ({
        id: `tpl:${t.path}`,
        label: `New from template: ${t.name}`,
        description: t.category ? `Template · ${t.category}` : "Template",
        icon: <LayoutTemplate className="h-4 w-4 opacity-60" />,
        onSelect: () => { onNewFromTemplate(t.path); onClose(); },
      }))
    : [];

  // If query looks like a search (>2 chars without a prefix) use full-text hits,
  // otherwise filter file/folder/action items locally.
  const isFullTextMode = q.length > 2 && !q.startsWith("@");

  const localMatches: Action[] = q
    ? [
        ...staticActions.filter(
          (a) => a.label.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
        ),
        ...templateItems.filter(
          (a) => a.label.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
        ),
        ...fileItems.filter(
          (a) => a.label.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
        ),
        ...folderItems.filter(
          (a) => a.label.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q),
        ),
      ]
    : [...staticActions, ...templateItems, ...fileItems.slice(0, 20)];

  const fullTextActions: Action[] = searchHits.map((h) => ({
    id: `hit:${h.path}`,
    label: h.title,
    description: h.snippet ? `${h.path} — ${h.snippet}` : h.path,
    icon: <Hash className="h-4 w-4 opacity-60" />,
    onSelect: () => { onOpenDoc(h.path); onClose(); },
  }));

  const items = isFullTextMode && searchHits.length > 0 ? fullTextActions : localMatches;

  useEffect(() => {
    setActiveIdx(0);
  }, [query, searchHits]);

  useEffect(() => {
    if (!isFullTextMode) { setSearchHits([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setSearchHits(data.hits || []);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, isFullTextMode]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSearchHits([]);
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const confirm = useCallback(
    (idx: number) => {
      items[idx]?.onSelect();
    },
    [items],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirm(activeIdx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, activeIdx, confirm, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go to file, folder, or search notes…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
          />
          {searching && (
            <span className="text-xs text-[var(--muted)]">searching…</span>
          )}
          <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
            esc
          </kbd>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Search className="mx-auto mb-2 h-8 w-8 opacity-20" />
            <p className="text-sm text-[var(--muted)]">
              {query.trim() ? "No results found" : "Type to search notes, folders, or templates"}
            </p>
            {!query.trim() && (
              <p className="mt-1 text-xs text-[var(--muted)] opacity-60">
                Tip: type more than 2 characters to full-text search
              </p>
            )}
          </div>
        ) : (
          <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {items.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => confirm(i)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-150",
                    i === activeIdx
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "hover:bg-[var(--border)]/50",
                  )}
                >
                  <span className={cn("shrink-0", i === activeIdx ? "text-[var(--accent-fg)]" : "text-[var(--muted)]")}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.label}</span>
                    {item.description && (
                      <span
                        className={cn(
                          "block truncate text-xs",
                          i === activeIdx ? "opacity-70" : "text-[var(--muted)]",
                        )}
                      >
                        {item.description}
                      </span>
                    )}
                  </span>
                  {i === activeIdx && (
                    <kbd className="ml-2 shrink-0 rounded border border-current px-1.5 py-0.5 text-[10px] opacity-60">
                      ↵
                    </kbd>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-[var(--muted)]">
          <span className="mr-3">↑↓ navigate</span>
          <span className="mr-3">↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
