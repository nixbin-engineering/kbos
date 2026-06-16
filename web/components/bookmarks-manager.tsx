"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookmarkPlus,
  Trash2,
  ExternalLink,
  Tag,
  Search,
  Edit2,
  X,
  Check,
} from "lucide-react";

export const BOOKMARKS_NAV_ID = "bookmarks";

type Bookmark = {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  createdAt: string;
};

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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [addUrl, setAddUrl] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addTags, setAddTags] = useState("");
  const [adding, setAdding] = useState(false);

  // Search / filter
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Edit state: id -> draft fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch("/api/bookmarks");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBookmarks(data.bookmarks ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl.trim()) return;
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
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBookmarks(data.bookmarks);
      setAddUrl("");
      setAddTitle("");
      setAddDesc("");
      setAddTags("");
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
      setBookmarks(data.bookmarks);
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
      setBookmarks(data.bookmarks);
      setEditingId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  // Unique tags across all bookmarks
  const allTags = Array.from(
    new Set(bookmarks.flatMap((b) => b.tags ?? []))
  ).sort();

  // Filtered bookmarks
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookmarkPlus size={22} style={{ color: "var(--accent)" }} />
        <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
          Bookmarks
        </h1>
      </div>

      {/* Error */}
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

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="rounded-lg p-4 flex flex-col gap-3"
        style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Add Bookmark
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            placeholder="URL *"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            required
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--foreground)",
            }}
          />
          <input
            type="text"
            placeholder="Title (optional — uses domain if blank)"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--foreground)",
            }}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Description (optional)"
            value={addDesc}
            onChange={(e) => setAddDesc(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--foreground)",
            }}
          />
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={addTags}
            onChange={(e) => setAddTags(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--foreground)",
            }}
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

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-md border px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        <Search size={15} style={{ color: "var(--muted)" }} />
        <input
          type="text"
          placeholder="Search bookmarks…"
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

      {/* Tag filter chips */}
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
            <button
              className="text-xs underline"
              style={{ color: "var(--muted)" }}
              onClick={() => setActiveTag(null)}
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: "var(--muted)" }}>
          <BookmarkPlus size={40} />
          <p className="text-sm">
            {bookmarks.length === 0
              ? "No bookmarks yet. Add one above!"
              : "No bookmarks match your search."}
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
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                }}
              >
                {/* Title row */}
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
                      style={{
                        borderColor: "var(--border)",
                        background: "transparent",
                        color: "var(--foreground)",
                      }}
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

                {/* URL */}
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--muted)" }}
                  title={b.url}
                >
                  {b.url}
                </p>

                {/* Description */}
                {isEditing ? (
                  <input
                    type="text"
                    placeholder="Description"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      background: "transparent",
                      color: "var(--foreground)",
                    }}
                  />
                ) : (
                  b.description && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                      {b.description}
                    </p>
                  )
                )}

                {/* Tags */}
                {isEditing ? (
                  <input
                    type="text"
                    placeholder="Tags (comma separated)"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{
                      borderColor: "var(--border)",
                      background: "transparent",
                      color: "var(--foreground)",
                    }}
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

                {/* Actions */}
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
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                          background: "transparent",
                        }}
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
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                          background: "transparent",
                        }}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(b)}
                        className="flex items-center gap-1 text-xs rounded-md px-2 py-1"
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                          background: "transparent",
                        }}
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(b.id)}
                        className="flex items-center gap-1 text-xs rounded-md px-2 py-1 ml-auto"
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--muted)",
                          background: "transparent",
                        }}
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
