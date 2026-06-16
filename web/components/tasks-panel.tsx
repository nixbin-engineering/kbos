"use client";

import { AlertTriangle, CheckSquare, Clock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TaskItem } from "@/lib/types";

type Props = {
  onOpenDoc: (path: string) => void;
  refreshKey?: number;
};

function dueBadge(task: TaskItem): { label: string; cls: string } | null {
  // TaskItem (from inline checkbox) doesn't have dueDate — skip
  return null;
}

// Fetch structured tasks from /api/tasks for due-date info
type ApiTask = { id: string; title: string; status: string; dueDate?: string; priority: string };

function getDueClass(dueDate: string): "due-overdue" | "due-today" | "due-soon" | null {
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.setHours(0,0,0,0)) / 86400000);
  if (diffDays < 0) return "due-overdue";
  if (diffDays === 0) return "due-today";
  if (diffDays <= 3) return "due-soon";
  return null;
}

function getDueLabel(dueDate: string): string {
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - new Date(now.toDateString()).getTime()) / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TasksPanel({ onOpenDoc, refreshKey = 0 }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [apiTasks, setApiTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/tasks?status=open"),
        fetch("/api/tasks"),
      ]);
      if (r1.ok) setTasks((await r1.json()).tasks || []);
      if (r2.ok) {
        const all: ApiTask[] = ((await r2.json()).tasks || []) as ApiTask[];
        setApiTasks(all.filter((t) => t.status !== "done" && t.dueDate));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const overdueCount = apiTasks.filter((t) => t.dueDate && getDueClass(t.dueDate) === "due-overdue").length;
  const todayCount   = apiTasks.filter((t) => t.dueDate && getDueClass(t.dueDate) === "due-today").length;
  const soonCount    = apiTasks.filter((t) => t.dueDate && getDueClass(t.dueDate) === "due-soon").length;
  const totalOpen    = tasks.length;

  return (
    <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <CheckSquare className="h-3 w-3" />
        Tasks
        <div className="ml-auto flex items-center gap-1">
          {overdueCount > 0 && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold due-overdue`}>
              <AlertTriangle className="h-2.5 w-2.5" />{overdueCount}
            </span>
          )}
          {todayCount > 0 && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold due-today`}>
              <Clock className="h-2.5 w-2.5" />{todayCount}
            </span>
          )}
          {soonCount > 0 && !overdueCount && !todayCount && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold due-soon`}>
              {soonCount}d
            </span>
          )}
          {totalOpen > 0 && (
            <span className="rounded-full bg-[var(--border)] px-1.5 py-0.5 text-[9px] font-normal normal-case">
              {totalOpen}
            </span>
          )}
        </div>
        <span className="ml-1 text-[var(--muted)]">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
          {loading && tasks.length === 0 && (
            <div className="space-y-1">
              {[1,2,3].map((i) => <div key={i} className="shimmer h-8 rounded-lg" />)}
            </div>
          )}
          {!loading && tasks.length === 0 && (
            <p className="text-[11px] text-[var(--muted)]">No open tasks</p>
          )}
          {tasks.map((t, i) => (
            <button
              key={`${t.path}:${t.line}:${i}`}
              type="button"
              onClick={() => onOpenDoc(t.path)}
              className="group flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-[var(--border)] transition-colors"
              title={t.path}
            >
              <span className="block truncate text-xs group-hover:text-[var(--accent)] transition-colors">{t.text}</span>
              <span className="text-[10px] text-[var(--muted)] truncate">{t.title}</span>
            </button>
          ))}
          {/* Due tasks from API */}
          {apiTasks.filter((t) => getDueClass(t.dueDate!) !== null).slice(0, 5).map((t) => {
            const cls = getDueClass(t.dueDate!);
            const label = getDueLabel(t.dueDate!);
            return (
              <div key={t.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[var(--border)]">
                <span className="flex-1 truncate text-xs">{t.title}</span>
                {cls && (
                  <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${cls}`}>
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
