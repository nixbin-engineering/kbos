"use client";

import {
  FilePlus,
  FolderPlus,
  LayoutTemplate,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CreateKind, TemplateEntry } from "@/lib/types";
import { ensureElementVisible } from "@/lib/ensure-visible";
import { cn } from "@/lib/utils";

type Props = {
  parentPath: string;
  itemPath?: string;
  itemType: "dir" | "file" | "root";
  itemName?: string;
  onCreated: (path: string) => void;
  onDeleted?: () => void;
  onTreeRefresh: () => void;
};

export function VaultItemActions({
  parentPath,
  itemPath,
  itemType,
  itemName,
  onCreated,
  onDeleted,
  onTreeRefresh,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<CreateKind | null>(null);
  const [name, setName] = useState("");
  const [withIndex, setWithIndex] = useState(true);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuFlip, setMenuFlip] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const folderPath = itemType === "dir" ? itemPath || "" : parentPath;

  const loadTemplates = useCallback(async () => {
    try {
      const r = await fetch("/api/templates");
      if (r.ok) {
        const data = await r.json();
        setTemplates(data.templates || []);
      }
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    loadTemplates();
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, loadTemplates]);

  useLayoutEffect(() => {
    if (!menuOpen || !dropdownRef.current) return;
    const flip = ensureElementVisible(dropdownRef.current, true);
    setMenuFlip(flip);
  }, [menuOpen, templates.length]);

  const openDialog = (kind: CreateKind, templatePath?: string) => {
    setMenuOpen(false);
    setDialog(kind);
    setName("");
    setError(null);
    setSelectedTemplate(templatePath ?? null);
    if (kind === "folder") setWithIndex(true);
  };

  const closeDialog = () => {
    setDialog(null);
    setSelectedTemplate(null);
    setError(null);
  };

  const submitCreate = async () => {
    if (!dialog) return;
    setBusy(true);
    setError(null);
    try {
      if (dialog === "folder") {
        const rel = folderPath ? `${folderPath}/${name.trim()}` : name.trim();
        const r = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: rel, index: withIndex }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || r.statusText);
        onTreeRefresh();
        if (data.indexPath) onCreated(data.indexPath);
        closeDialog();
        return;
      }

      const baseName = name.trim().replace(/\.md$/, "");
      const rel = folderPath ? `${folderPath}/${baseName}` : baseName;
      const body: Record<string, string> = { path: rel };
      if (dialog === "template" && selectedTemplate) body.template = selectedTemplate;
      if (dialog === "drawing") body.kind = "drawing";

      const r = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onTreeRefresh();
      onCreated(data.path);
      closeDialog();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!itemPath || itemType === "root") return;
    setBusy(true);
    setError(null);
    try {
      const url =
        itemType === "file"
          ? `/api/docs/${itemPath.split("/").map(encodeURIComponent).join("/")}`
          : `/api/folders/${itemPath.split("/").map(encodeURIComponent).join("/")}`;
      const r = await fetch(url, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onTreeRefresh();
      onDeleted?.();
      setConfirmDelete(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const showAdd = itemType === "dir" || itemType === "root";
  const showDelete = itemType === "file" || itemType === "dir";

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        {showAdd && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              title="Create in folder"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="rounded p-0.5 hover:bg-[var(--border)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div
                ref={dropdownRef}
                className={cn(
                  "absolute right-0 z-50 min-w-[11rem] max-h-[min(18rem,calc(100vh-6rem))] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg",
                  menuFlip ? "bottom-full mb-1" : "top-full mt-1",
                )}
              >
                <MenuItem icon={FilePlus} label="New note" onClick={() => openDialog("note")} />
                <MenuItem icon={FolderPlus} label="New folder" onClick={() => openDialog("folder")} />
                <MenuItem icon={PenLine} label="New drawing" onClick={() => openDialog("drawing")} />
                <div className="my-1 border-t border-[var(--border)]" />
                <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">From template</p>
                {templates.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-[var(--muted)]">No templates in vault/templates/</p>
                ) : (
                  templates.map((t) => (
                    <MenuItem
                      key={t.path}
                      icon={LayoutTemplate}
                      label={t.path}
                      onClick={() => openDialog("template", t.path)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
        {showDelete && itemPath && (
          <button
            type="button"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
              setError(null);
            }}
            className="rounded p-0.5 text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg">
            <h2 className="mb-3 font-semibold">
              {dialog === "note" && "New note"}
              {dialog === "folder" && "New folder"}
              {dialog === "template" && "New from template"}
              {dialog === "drawing" && "New drawing"}
            </h2>
            {dialog === "template" && selectedTemplate && (
              <p className="mb-2 text-xs text-[var(--muted)]">Template: {selectedTemplate}</p>
            )}
            {folderPath && (
              <p className="mb-2 text-xs text-[var(--muted)]">In: docs/{folderPath}</p>
            )}
            <label className="mb-3 block text-xs text-[var(--muted)]">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  dialog === "folder"
                    ? "folder-name"
                    : dialog === "drawing"
                      ? "sketch-name"
                      : "note-name"
                }
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submitCreate()}
              />
            </label>
            {dialog === "folder" && (
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={withIndex} onChange={(e) => setWithIndex(e.target.checked)} />
                Create index.md landing page
              </label>
            )}
            {error && <p className="mb-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeDialog} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={submitCreate}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-fg)] disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg">
            <h2 className="mb-2 font-semibold">Delete {itemType === "file" ? "note" : "folder"}?</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {itemType === "file" ? (
                <>
                  Permanently delete <strong>{itemName || itemPath}</strong>?
                </>
              ) : (
                <>
                  Permanently delete folder <strong>{itemName || itemPath}</strong> and everything inside?
                </>
              )}
            </p>
            {error && <p className="mb-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FilePlus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-[var(--border)]"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </button>
  );
}
