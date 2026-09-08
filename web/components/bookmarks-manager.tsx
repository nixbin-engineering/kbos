"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Trash2,
  ExternalLink,
  Tag,
  Search,
  Edit2,
  X,
  Check,
  Plus,
} from "lucide-react";

export const DASHBOARD_NAV_ID = "dashboard";
/** @deprecated use DASHBOARD_NAV_ID */
export const BOOKMARKS_NAV_ID = DASHBOARD_NAV_ID;

type Bookmark = {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  createdAt: string;
};

type Dashboard = {
  id: string;
  name: string;
  bookmarks: Bookmark[];
};

const ACTIVE_DASHBOARD_KEY = "kbos-active-dashboard-id";

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function BookmarksManager() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addTags, setAddTags] = useState("");
  const [adding, setAdding] = useState(false);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renamingDashboardId, setRenamingDashboardId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [creatingDashboard, setCreatingDashboard] = useState(false);

  const activeDashboard =
    dashboards.find((d) => d.id === activeDashboardId) ?? dashboards[0] ?? null;
  const bookmarks = activeDashboard?.bookmarks ?? [];

  const applyDashboards = useCallback((next: Dashboard[]) => {
    setDashboards(next);
    setActiveDashboardId((cur) => {
      if (cur && next.some((d) => d.id === cur)) return cur;
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_DASHBOARD_KEY) : null;
      if (stored && next.some((d) => d.id === stored)) return stored;
      return next[0]?.id ?? null;
    });
  }, []);

  const fetchDashboards = useCallback(async () => {
    try {
      const res = await fetch("/api/bookmarks");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [applyDashboards]);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  useEffect(() => {
    if (activeDashboardId) {
      localStorage.setItem(ACTIVE_DASHBOARD_KEY, activeDashboardId);
    }
  }, [activeDashboardId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl.trim() || !activeDashboard) return;
    const title = addTitle.trim() || getDomain(addUrl.trim());
    setAdding(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: addUrl.trim(),
          title,
          description: addDesc.trim() || undefined,
          tags: parseTags(addTags),
          dashboardId: activeDashboard.id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
      setAddUrl("");
      setAddTitle("");
      setAddDesc("");
      setAddTags("");
      setShowAddForm(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
      setConfirmDeleteId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function startEdit(b: Bookmark) {
    setEditingId(b.id);
    setEditTitle(b.title);
    setEditDesc(b.description ?? "");
    setEditTags((b.tags ?? []).join(", "));
  }

  async function handleSaveEdit(id: string) {
    try {
      const res = await fetch(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || undefined,
          tags: parseTags(editTags),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
      setEditingId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleCreateDashboard() {
    const name = window.prompt("Dashboard name", "New dashboard");
    if (!name?.trim()) return;
    setCreatingDashboard(true);
    try {
      const res = await fetch("/api/bookmarks/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
      const created = (data.dashboards as Dashboard[]).find((d) => d.name === name.trim());
      if (created) setActiveDashboardId(created.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreatingDashboard(false);
    }
  }

  async function handleRenameDashboard(id: string) {
    const name = renameDraft.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/bookmarks/dashboards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
      setRenamingDashboardId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteDashboard(id: string) {
    if (!window.confirm("Delete this dashboard and all its links?")) return;
    try {
      const res = await fetch(`/api/bookmarks/dashboards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      applyDashboards(data.dashboards ?? []);
    } catch (e) {
      setError(String(e));
    }
  }

  const allTags = Array.from(new Set(bookmarks.flatMap((b) => b.tags ?? []))).sort();

  const filtered = bookmarks.filter((b) => {
    if (activeTag && !(b.tags ?? []).includes(activeTag)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      (b.description ?? "").toLowerCase().includes(q) ||
      (b.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={22} style={{ color: "var(--accent)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              <Plus size={14} />
              Add link
            </button>
          )}
          <button
            type="button"
            onClick={handleCreateDashboard}
            disabled={creatingDashboard}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            title="New dashboard"
          >
            <Plus size={14} />
            Dashboard
          </button>
        </div>
      </div>

      {dashboards.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {dashboards.map((d) => {
            const active = d.id === (activeDashboard?.id ?? null);
            const isRenaming = renamingDashboardId === d.id;
            return (
              <div key={d.id} className="flex items-center gap-1">
                {isRenaming ? (
                  <>
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      className="rounded-md border px-2 py-1 text-sm"
                      style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRenameDashboard(d.id);
                        if (e.key === "Escape") setRenamingDashboardId(null);
                      }}
                    />
                    <button type="button" onClick={() => handleRenameDashboard(d.id)}>
                      <Check size={14} />
                    </button>
                    <button type="button" onClick={() => setRenamingDashboardId(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveDashboardId(d.id)}
                    onDoubleClick={() => {
                      setRenamingDashboardId(d.id);
                      setRenameDraft(d.name);
                    }}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                    style={
                      active
                        ? { background: "var(--accent)", color: "var(--accent-fg)" }
                        : { background: "var(--border)", color: "var(--foreground)" }
                    }
                    title="Double-click to rename"
                  >
                    {d.name}
                  </button>
                )}
                {active && dashboards.length > 1 && !isRenaming && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDashboard(d.id)}
                    className="rounded p-1 opacity-50 hover:opacity-100"
                    title="Delete dashboard"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div
          className="rounded-md px-4 py-2 text-sm"
          style={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          {error}
          <button className="ml-3 underline text-xs" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-lg p-4 flex flex-col gap-3"
          style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Add link
            </p>
            <button type="button" onClick={() => setShowAddForm(false)} className="opacity-60 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="URL *"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              required
              autoFocus
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
            />
            <input
              type="text"
              placeholder="Title (optional — uses domain if blank)"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Description (optional)"
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
            />
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={adding}
              className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      )}

      <div
        className="flex items-center gap-2 rounded-md border px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        <Search size={15} style={{ color: "var(--muted)" }} />
        <input
          type="text"
          placeholder="Search links…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--foreground)" }}
        />
        {search && (
          <button onClick={() => setSearch("")}>
            <X size={14} style={{ color: "var(--muted)" }} />
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Tag size={13} style={{ color: "var(--muted)" }} />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors"
              style={
                activeTag === tag
                  ? { background: "var(--accent)", color: "var(--accent-fg)" }
                  : { background: "var(--border)", color: "var(--foreground)" }
              }
            >
              {tag}
            </button>
          ))}
          {activeTag && (
            <button className="text-xs underline" style={{ color: "var(--muted)" }} onClick={() => setActiveTag(null)}>
              clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: "var(--muted)" }}>
          <LayoutDashboard size={40} />
          <p className="text-sm">
            {bookmarks.length === 0
              ? "No links yet. Click Add link to get started."
              : "No links match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => {
            const domain = getDomain(b.url);
            const isEditing = editingId === b.id;
            const isConfirmingDelete = confirmDeleteId === b.id;

            return (
              <div
                key={b.id}
                className="rounded-lg p-4 shadow-sm flex flex-col gap-2"
                style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
              >
                <div className="flex items-start gap-2">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt=""
                    width={16}
                    height={16}
                    className="mt-0.5 shrink-0"
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 rounded-md border px-2 py-1 text-sm"
                      style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
                    />
                  ) : (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm font-medium leading-snug hover:underline"
                      style={{ color: "var(--foreground)" }}
                    >
                      {b.title}
                      <ExternalLink size={11} className="inline ml-1 opacity-50" />
                    </a>
                  )}
                </div>

                <p className="text-xs truncate" style={{ color: "var(--muted)" }} title={b.url}>
                  {b.url}
                </p>

                {isEditing ? (
                  <input
                    type="text"
                    placeholder="Description"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
                  />
                ) : (
                  b.description && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      {b.description}
                    </p>
                  )
                )}

                {isEditing ? (
                  <input
                    type="text"
                    placeholder="Tags (comma separated)"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
                  />
                ) : (
                  (b.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(b.tags ?? []).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                          className="rounded-full px-2 py-0.5 text-[10px]"
                          style={
                            activeTag === tag
                              ? { background: "var(--accent)", color: "var(--accent-fg)" }
                              : { background: "var(--border)", color: "var(--foreground)" }
                          }
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )
                )}

                <div className="flex items-center gap-2 mt-auto pt-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(b.id)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                      >
                        <Check size={12} />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                        style={{ border: "1px solid var(--border)", color: "var(--foreground)", background: "transparent" }}
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </>
                  ) : isConfirmingDelete ? (
                    <>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        Delete?
                      </span>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md px-2 py-1 text-xs"
                        style={{ border: "1px solid var(--border)", color: "var(--foreground)", background: "transparent" }}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(b)}
                        className="flex items-center gap-1 text-xs rounded-md px-2 py-1"
                        style={{ border: "1px solid var(--border)", color: "var(--foreground)", background: "transparent" }}
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(b.id)}
                        className="flex items-center gap-1 text-xs rounded-md px-2 py-1 ml-auto"
                        style={{ border: "1px solid var(--border)", color: "var(--muted)", background: "transparent" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
