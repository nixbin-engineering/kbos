"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckSquare,
  Circle,
  Clock,
  Flag,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Tag,
  Search,
  AlertCircle,
} from "lucide-react";

export const TASKS_NAV_ID = "tasks";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";
type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags?: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: "bg-red-500/15 text-red-600",
  medium: "bg-amber-500/15 text-amber-600",
  low: "bg-blue-500/15 text-blue-600",
};

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isDoneToday(task: Task): boolean {
  if (task.status !== "done") return false;
  const today = new Date().toDateString();
  return new Date(task.updatedAt).toDateString() === today;
}

// ──────────────────────────────────────────────
// Add Task Form (modal overlay)
// ──────────────────────────────────────────────
function AddTaskModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task");
      onAdd(data.task);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">New Task</h2>
        {error && (
          <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Title *</label>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Description</label>
            <textarea
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Priority</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Due Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Tags (comma-separated)</label>
            <input
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. frontend, bug, urgent"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add Task"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// Inline edit panel (expanded below card)
// ──────────────────────────────────────────────
function TaskEditPanel({
  task,
  onSave,
  onClose,
}: {
  task: Task;
  onSave: (updated: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [tags, setTags] = useState((task.tags || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!title.trim()) { setError("Title required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSave(data.task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--panel)] p-3 text-sm">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="space-y-2">
        <input
          className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />
        <div className="flex gap-2">
          <select
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <input
          className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"
        />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Task Card
// ──────────────────────────────────────────────
function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onUpdate: (updated: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [moving, setMoving] = useState(false);

  const statusIdx = STATUS_ORDER.indexOf(task.status);
  const canMoveForward = statusIdx < STATUS_ORDER.length - 1;
  const canMoveBack = statusIdx > 0;
  const overdue = isOverdue(task.dueDate) && task.status !== "done";

  async function moveStatus(direction: 1 | -1) {
    const newStatus = STATUS_ORDER[statusIdx + direction];
    if (!newStatus) return;
    setMoving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) onUpdate(data.task);
    } finally {
      setMoving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) onDelete(task.id);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 mb-2 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <button
          className="flex-1 text-left text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)] leading-snug"
          onClick={() => setExpanded((v) => !v)}
        >
          {task.title}
        </button>
        <button
          onClick={handleDelete}
          className="shrink-0 text-[var(--muted)] hover:text-red-500 transition-colors"
          title="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Description snippet */}
      {task.description && !expanded && (
        <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{task.description}</p>
      )}

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {/* Priority badge */}
        <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]}`}>
          <Flag size={10} />
          {task.priority}
        </span>

        {/* Due date */}
        {task.dueDate && (
          <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-red-600 font-medium" : "text-[var(--muted)]"}`}>
            {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
            {task.dueDate}
          </span>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-[var(--panel)] border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
            <Tag size={9} />
            {tag}
          </span>
        ))}
      </div>

      {/* Move buttons */}
      <div className="mt-2 flex gap-1">
        {canMoveBack && (
          <button
            onClick={() => moveStatus(-1)}
            disabled={moving}
            className="inline-flex items-center gap-0.5 rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            <ChevronLeft size={11} /> Move back
          </button>
        )}
        {canMoveForward && (
          <button
            onClick={() => moveStatus(1)}
            disabled={moving}
            className="inline-flex items-center gap-0.5 rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            Move <ChevronRight size={11} />
          </button>
        )}
      </div>

      {/* Inline edit panel */}
      {expanded && (
        <TaskEditPanel
          task={task}
          onSave={(updated) => { onUpdate(updated); setExpanded(false); }}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Kanban Column
// ──────────────────────────────────────────────
function KanbanColumn({
  status,
  tasks,
  onUpdate,
  onDelete,
}: {
  status: TaskStatus;
  tasks: Task[];
  onUpdate: (updated: Task) => void;
  onDelete: (id: string) => void;
}) {
  const icon =
    status === "todo" ? <Circle size={14} /> :
    status === "in_progress" ? <Clock size={14} /> :
    <CheckSquare size={14} />;

  return (
    <div className="flex-1 min-w-0 rounded-xl bg-[var(--panel)] border border-[var(--border)] p-3 flex flex-col">
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
          {icon}
          {STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tasks.length === 0 && (
          <p className="py-6 text-center text-xs text-[var(--muted)]">No tasks</p>
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export function TasksManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "">( "");
  const [filterTag, setFilterTag] = useState("");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tasks");
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  function handleUpdate(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleAdd(task: Task) {
    setTasks((prev) => [...prev, task]);
  }

  // Stats
  const totalTasks = tasks.length;
  const overdueCount = tasks.filter((t) => isOverdue(t.dueDate) && t.status !== "done").length;
  const doneTodayCount = tasks.filter(isDoneToday).length;

  // All unique tags for filter dropdown
  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags || [])));

  // Filtered tasks
  const filtered = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !(t.description || "").toLowerCase().includes(q)
      ) return false;
    }
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterTag && !(t.tags || []).includes(filterTag)) return false;
    return true;
  });

  const byStatus = (status: TaskStatus) =>
    filtered
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const po: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        return po[a.priority] - po[b.priority];
      });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
        Loading tasks…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchTasks}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--muted)]">
          <CheckSquare size={13} />
          <span><strong className="text-[var(--foreground)]">{totalTasks}</strong> total</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--muted)]">
          <AlertCircle size={13} className={overdueCount > 0 ? "text-red-500" : ""} />
          <span className={overdueCount > 0 ? "text-red-600 font-medium" : ""}>
            <strong>{overdueCount}</strong> overdue
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--muted)]">
          <CheckSquare size={13} className="text-green-600" />
          <span><strong className="text-[var(--foreground)]">{doneTodayCount}</strong> done today</span>
        </span>
        <div className="ml-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
          >
            <Plus size={13} /> Add Task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] pl-7 pr-3 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "")}
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {allTags.length > 0 && (
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        )}
        {(search || filterPriority || filterTag) && (
          <button
            onClick={() => { setSearch(""); setFilterPriority(""); setFilterTag(""); }}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div className="flex flex-1 gap-3 overflow-hidden min-h-0">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={byStatus(status)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add task modal */}
      {showAdd && (
        <AddTaskModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}
