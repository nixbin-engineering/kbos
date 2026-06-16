"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen, Bookmark, CheckSquare, FilePlus, Search,
  BookMarked, Clock, Sparkles, ArrowRight, CalendarDays,
} from "lucide-react";
import type { TreeNode } from "@/lib/types";

type Task = { id: string; title: string; status: string; priority: string; dueDate?: string };
type BookmarkItem = { id: string; url: string; title: string; tags?: string[] };
type RecentFile = { path: string; name: string; folder: string };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function countFiles(nodes: TreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "file" && node.name.endsWith(".md")) n++;
    else if (node.type === "dir" && node.children) n += countFiles(node.children);
  }
  return n;
}

function collectRecent(nodes: TreeNode[], out: RecentFile[], folder = "", limit = 6) {
  for (const n of nodes) {
    if (out.length >= limit) return;
    if (n.type === "file" && n.path?.endsWith(".md") && !n.path.endsWith(".md.enc")) {
      out.push({ path: n.path, name: n.name.replace(/\.md$/, ""), folder });
    } else if (n.type === "dir" && n.children) {
      collectRecent(n.children, out, n.name, limit);
    }
  }
}

type Props = {
  tree: TreeNode | null;
  onOpenDoc: (path: string) => void;
  onOpenSearch: () => void;
  onNewNote: () => void;
  onOpenJournal: () => void;
  onOpenBookmarks: () => void;
  onOpenTasks: () => void;
};

export function DashboardView({
  tree, onOpenDoc, onOpenSearch, onNewNote, onOpenJournal, onOpenBookmarks, onOpenTasks,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const load = useCallback(async () => {
    setLoadingData(true);
    const [tr, br] = await Promise.all([
      fetch("/api/tasks").then((r) => r.ok ? r.json() : { tasks: [] }),
      fetch("/api/bookmarks").then((r) => r.ok ? r.json() : { bookmarks: [] }),
    ]).catch(() => [{ tasks: [] }, { bookmarks: [] }]);
    setTasks((tr?.tasks ?? []).filter((t: Task) => t.status !== "done").slice(0, 5));
    setBookmarks((br?.bookmarks ?? []).slice(0, 5));
    setLoadingData(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const recentFiles: RecentFile[] = [];
  if (tree?.children) collectRecent(tree.children, recentFiles);
  const totalNotes = tree?.children ? countFiles(tree.children) : 0;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm mb-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {today}
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] md:text-3xl">
            {greeting()} <Sparkles className="inline h-5 w-5 text-[var(--accent)] mb-1" />
          </h1>
          <p className="mt-1 text-[var(--muted)] text-sm">
            {totalNotes > 0 ? `${totalNotes} notes in your vault` : "Your vault is ready"}
          </p>
        </div>

        {/* Quick actions */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: FilePlus, label: "New note", color: "var(--accent)", action: onNewNote },
            { icon: Search, label: "Search", color: "var(--muted)", action: onOpenSearch },
            { icon: CalendarDays, label: "Journal", color: "var(--muted)", action: onOpenJournal },
            { icon: BookMarked, label: "Bookmarks", color: "var(--muted)", action: onOpenBookmarks },
          ].map(({ icon: Icon, label, color, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm font-medium transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--panel-elevated)] active:scale-95"
            >
              <Icon className="h-5 w-5" style={{ color }} />
              <span className="text-[var(--foreground)]">{label}</span>
            </button>
          ))}
        </div>

        {/* Two-column grid */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* Recent notes */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                Recent Notes
              </div>
            </div>
            {recentFiles.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-4 text-center">No notes yet</p>
            ) : (
              <ul className="space-y-1">
                {recentFiles.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc(f.path)}
                      className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--border)]/50"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <span className="min-w-0 flex-1 truncate text-[var(--foreground)] group-hover:text-[var(--accent)]">{f.name}</span>
                      {f.folder && (
                        <span className="shrink-0 rounded bg-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">{f.folder}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Open tasks */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
                Open Tasks
              </div>
              <button
                type="button"
                onClick={onOpenTasks}
                className="flex items-center gap-0.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
              >
                All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {loadingData ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">Loading…</p>
            ) : tasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">No open tasks</p>
            ) : (
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li key={t.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      t.priority === "high" ? "bg-red-500" :
                      t.priority === "medium" ? "bg-amber-500" : "bg-[var(--muted)]"
                    }`} />
                    <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{t.title}</span>
                    {t.dueDate && (
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">{t.dueDate}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Bookmarks */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 md:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                <Bookmark className="h-4 w-4 text-[var(--accent)]" />
                Bookmarks
              </div>
              <button
                type="button"
                onClick={onOpenBookmarks}
                className="flex items-center gap-0.5 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
              >
                All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {loadingData ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">Loading…</p>
            ) : bookmarks.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--muted)]">No bookmarks yet</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarks.map((b) => (
                  <li key={b.id}>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--panel-elevated)]"
                    >
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent)]">{b.title}</p>
                        <p className="truncate text-[11px] text-[var(--muted)]">{b.url.replace(/^https?:\/\//, "")}</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
