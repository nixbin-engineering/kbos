"use client";

import { BookOpen, ChevronDown, ChevronRight, CloudOff, FileText, Folder, Lock, Pin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, isEncryptedNotePath } from "@/lib/utils";
import type { TreeNode } from "@/lib/types";
import { isExplicitPin, pathCoveredByPins, type OfflinePin } from "@/lib/offline-store";
import { VaultItemActions } from "./vault-item-actions";
import { VaultContextMenu, type ContextTarget } from "./vault-context-menu";

const DRAG_MIME = "application/x-kbos-vault-item";

type DragPayload = {
  itemType: "file" | "dir";
  itemPath: string;
};

type Props = {
  tree: TreeNode | null;
  selected: string | null;
  folderView: string | null;
  onSelect: (path: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onCreated: (path: string) => void;
  onDeleted: (path: string) => void;
  onMoved?: (oldPath: string, newPath: string) => void;
  /** Flush open editor + suppress leave-flush before path remap. */
  onBeforeMove?: (movingPath: string) => Promise<void>;
  onTreeRefresh: () => void;
  onOpenDoc?: (path: string) => void;
  onOpenDocNewTab?: (path: string) => void;
  onOpenDocInSplit?: (path: string) => void;
  isAdmin?: boolean;
  offlinePins?: OfflinePin[];
  onOfflinePin?: (path: string, type: "file" | "dir") => Promise<void>;
  onOfflineUnpin?: (path: string) => Promise<void>;
  networkOffline?: boolean;
  structuralOpsDisabled?: boolean;
};

function pathBasename(p: string): string {
  return p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;
}

function pathParent(p: string): string {
  return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
}

function encodeVaultPath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function remappedPath(oldPath: string, newPath: string, current: string): string {
  if (current === oldPath) return newPath;
  if (current.startsWith(`${oldPath}/`)) return `${newPath}${current.slice(oldPath.length)}`;
  return current;
}

function canDropOn(payload: DragPayload, destFolder: string): boolean {
  if (payload.itemType === "file") {
    return pathParent(payload.itemPath) !== destFolder;
  }
  // Folder: reject self, current parent (no-op), and any descendant destination
  if (payload.itemPath === destFolder) return false;
  if (destFolder.startsWith(`${payload.itemPath}/`)) return false;
  if (pathParent(payload.itemPath) === destFolder) return false;
  return true;
}

async function moveVaultItem(
  payload: DragPayload,
  destFolder: string,
): Promise<{ oldPath: string; newPath: string }> {
  const base = pathBasename(payload.itemPath);
  if (payload.itemType === "file") {
    const newPath = destFolder ? `${destFolder}/${base}` : base;
    const r = await fetch(`/api/docs/${encodeVaultPath(payload.itemPath)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPath }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    return { oldPath: data.oldPath ?? payload.itemPath, newPath: data.newPath ?? newPath };
  }
  const newPath = destFolder ? `${destFolder}/${base}` : base;
  const r = await fetch(`/api/folders/${encodeVaultPath(payload.itemPath)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPath }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.statusText);
  return { oldPath: data.oldPath ?? payload.itemPath, newPath: data.newPath ?? newPath };
}

export function VaultTree({
  tree,
  selected,
  folderView,
  onSelect,
  onSelectFolder,
  onCreated,
  onDeleted,
  onMoved,
  onBeforeMove,
  onTreeRefresh,
  onOpenDoc,
  onOpenDocNewTab,
  onOpenDocInSplit,
  isAdmin = false,
  offlinePins = [],
  onOfflinePin,
  onOfflineUnpin,
  networkOffline = false,
  structuralOpsDisabled = false,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    target: ContextTarget;
    position: { x: number; y: number };
  } | null>(null);
  const [pins, setPins] = useState<string[]>([]);
  const [rootOpen, setRootOpen] = useState(true);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const draggingRef = useRef<DragPayload | null>(null);
  const blockStructural = structuralOpsDisabled || networkOffline;

  const contextOfflinePinned = useMemo(() => {
    if (!contextMenu) return false;
    const t = contextMenu.target;
    if (t.itemType !== "file" && t.itemType !== "dir") return false;
    return isExplicitPin(t.itemPath, t.itemType, offlinePins);
  }, [contextMenu, offlinePins]);

  useEffect(() => {
    fetch("/api/pins").then((r) => r.ok ? r.json() : { pins: [] }).then((d) => setPins(d.pins ?? [])).catch(() => {});
  }, []);

  const togglePin = useCallback(async (path: string) => {
    const next = pins.includes(path) ? pins.filter((p) => p !== path) : [...pins, path];
    setPins(next);
    await fetch("/api/pins", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pins: next }) });
  }, [pins]);

  const openContext = useCallback((e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ target, position: { x: e.clientX, y: e.clientY } });
  }, []);

  const clearDrag = useCallback(() => {
    draggingRef.current = null;
    setDragging(null);
    setDropTarget(null);
  }, []);

  const handleDropOnFolder = useCallback(
    async (destFolder: string, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const raw = e.dataTransfer.getData(DRAG_MIME);
      clearDrag();
      if (!raw) return;
      let payload: DragPayload;
      try {
        payload = JSON.parse(raw) as DragPayload;
      } catch {
        return;
      }
      if (!payload?.itemPath || (payload.itemType !== "file" && payload.itemType !== "dir")) return;
      if (!canDropOn(payload, destFolder)) return;
      if (blockStructural) {
        setMoveError("Unavailable while offline");
        return;
      }

      setMoveError(null);
      try {
        await onBeforeMove?.(payload.itemPath);
        const { oldPath, newPath } = await moveVaultItem(payload, destFolder);
        // Remap pins that lived under the moved path
        setPins((prev) => {
          const next = prev.map((p) => remappedPath(oldPath, newPath, p));
          if (next.some((p, i) => p !== prev[i])) {
            void fetch("/api/pins", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pins: next }),
            });
          }
          return next;
        });
        if (onMoved) onMoved(oldPath, newPath);
        else onDeleted(oldPath);
        onTreeRefresh();
      } catch (err) {
        setMoveError(String(err).replace(/^Error:\s*/, ""));
      }
    },
    [blockStructural, clearDrag, onBeforeMove, onDeleted, onMoved, onTreeRefresh],
  );

  const folderDropHandlers = useCallback(
    (destFolder: string) => ({
      onDragOver: (e: React.DragEvent) => {
        if (![...e.dataTransfer.types].includes(DRAG_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        const payload = draggingRef.current;
        if (payload && canDropOn(payload, destFolder)) {
          e.dataTransfer.dropEffect = "move";
          setDropTarget(destFolder);
        } else {
          e.dataTransfer.dropEffect = "none";
          setDropTarget((cur) => (cur === destFolder ? null : cur));
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        // Only clear when leaving this row for a non-child (relatedTarget outside)
        const related = e.relatedTarget as Node | null;
        if (related && (e.currentTarget as HTMLElement).contains(related)) return;
        setDropTarget((cur) => (cur === destFolder ? null : cur));
      },
      onDrop: (e: React.DragEvent) => void handleDropOnFolder(destFolder, e),
    }),
    [handleDropOnFolder],
  );

  const onItemDragStart = useCallback((payload: DragPayload, e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    draggingRef.current = payload;
    setDragging(payload);
    setMoveError(null);
  }, []);

  if (!tree) {
    return <p className="min-h-0 flex-1 p-3 text-sm text-[var(--muted)]">Loading vault…</p>;
  }
  const rootActive = folderView === "" && !selected;
  const rootHasEncrypted = treeHasEncrypted(tree);
  const rootDropping = dropTarget === "" && dragging != null && canDropOn(dragging, "");

  return (
    <>
      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 text-sm">
        {moveError && (
          <p className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-600 dark:text-red-400">
            {moveError}
          </p>
        )}
        {pins.length > 0 && (
          <div className="mb-2">
            <p className="mb-0.5 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Pin className="h-3 w-3" /> Pinned
            </p>
            {pins.map((pinPath) => {
              const label = pinPath.split("/").pop()?.replace(/\.md(\.enc)?$/, "") ?? pinPath;
              const active = selected === pinPath;
              const encrypted = isEncryptedNotePath(pinPath);
              return (
                <div
                  key={pinPath}
                  className={cn(
                    "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
                    active && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)]",
                    encrypted && !active && "text-amber-600 dark:text-amber-400",
                  )}
                  style={{ paddingLeft: "8px" }}
                >
                  <button type="button" onClick={() => onSelect(pinPath)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left">
                    {encrypted ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Encrypted note" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                  <button
                    type="button"
                    title="Unpin"
                    onClick={() => void togglePin(pinPath)}
                    className="mr-1 hidden rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] group-hover:flex"
                  >
                    <Pin className="h-3 w-3 fill-current" />
                  </button>
                </div>
              );
            })}
            <div className="mt-2 border-t border-[var(--border)]" />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
              rootActive && "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]",
              rootDropping && "bg-[var(--accent)]/25 ring-2 ring-[var(--accent)]",
            )}
            style={{ paddingLeft: "4px" }}
            onContextMenu={(e) =>
              openContext(e, { itemType: "root", itemPath: "", itemName: tree.name, parentPath: "" })
            }
            {...folderDropHandlers("")}
          >
            <button type="button" onClick={() => setRootOpen(!rootOpen)} className="flex shrink-0 items-center py-1">
              {rootOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onSelectFolder("")}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] opacity-90" />
              <span className="truncate font-medium">{tree.name}</span>
              {rootHasEncrypted && (
                <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Contains encrypted notes" />
              )}
              <span className="ml-1 shrink-0 rounded px-1 text-[10px] text-[var(--muted)] opacity-60">
                {countFiles(tree)}
              </span>
            </button>
            {!blockStructural && (
              <VaultItemActions
                parentPath=""
                itemType="root"
                onCreated={onCreated}
                onTreeRefresh={onTreeRefresh}
              />
            )}
          </div>
          {rootOpen && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {(tree.children || []).map((node) => (
                <TreeBranch
                  key={node.path || node.name}
                  node={node}
                  selected={selected}
                  folderView={folderView}
                  onSelect={onSelect}
                  onSelectFolder={onSelectFolder}
                  onCreated={onCreated}
                  onDeleted={onDeleted}
                  onTreeRefresh={onTreeRefresh}
                  onContextMenu={openContext}
                  onOpenDocNewTab={onOpenDocNewTab}
                  depth={1}
                  pins={pins}
                  onTogglePin={togglePin}
                  dragging={dragging}
                  dropTarget={dropTarget}
                  onItemDragStart={onItemDragStart}
                  onItemDragEnd={clearDrag}
                  folderDropHandlers={folderDropHandlers}
                  offlinePins={offlinePins}
                  blockStructural={blockStructural}
                />
              ))}
            </div>
          )}
        </div>
      </nav>
      <VaultContextMenu
        target={contextMenu?.target ?? null}
        position={contextMenu?.position ?? null}
        onClose={() => setContextMenu(null)}
        onTreeRefresh={onTreeRefresh}
        onDeleted={onDeleted}
        onMoved={onMoved}
        onBeforeMove={blockStructural ? undefined : onBeforeMove}
        onOpenDoc={onOpenDoc}
        onOpenDocNewTab={onOpenDocNewTab}
        onOpenDocInSplit={onOpenDocInSplit}
        isAdmin={isAdmin}
        isOfflinePinned={contextOfflinePinned}
        onOfflinePin={onOfflinePin}
        onOfflineUnpin={onOfflineUnpin}
        networkOffline={networkOffline}
      />
    </>
  );
}

function countFiles(node: TreeNode): number {
  if (node.type === "file") return 1;
  return (node.children ?? []).reduce((s, c) => s + countFiles(c), 0);
}

function treeHasEncrypted(node: TreeNode): boolean {
  if (node.encrypted || node.hasEncrypted) return true;
  return (node.children ?? []).some(treeHasEncrypted);
}

function TreeBranch({
  node,
  selected,
  folderView,
  onSelect,
  onSelectFolder,
  onCreated,
  onDeleted,
  onTreeRefresh,
  onContextMenu,
  onOpenDocNewTab,
  depth,
  pins,
  onTogglePin,
  dragging,
  dropTarget,
  onItemDragStart,
  onItemDragEnd,
  folderDropHandlers,
  offlinePins,
  blockStructural,
}: {
  node: TreeNode;
  selected: string | null;
  folderView: string | null;
  onSelect: (path: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onCreated: (path: string) => void;
  onDeleted: (path: string) => void;
  onTreeRefresh: () => void;
  onContextMenu: (e: React.MouseEvent, target: ContextTarget) => void;
  onOpenDocNewTab?: (path: string) => void;
  depth: number;
  pins: string[];
  onTogglePin: (path: string) => void;
  dragging: DragPayload | null;
  dropTarget: string | null;
  onItemDragStart: (payload: DragPayload, e: React.DragEvent) => void;
  onItemDragEnd: () => void;
  folderDropHandlers: (destFolder: string) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  offlinePins: OfflinePin[];
  blockStructural: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (expandTimer.current) clearTimeout(expandTimer.current);
    };
  }, []);

  // Auto-expand closed folders while hovering a valid drop
  useEffect(() => {
    if (node.type !== "dir") return;
    if (dropTarget === node.path && dragging && canDropOn(dragging, node.path) && !open) {
      expandTimer.current = setTimeout(() => setOpen(true), 450);
      return () => {
        if (expandTimer.current) clearTimeout(expandTimer.current);
      };
    }
    return undefined;
  }, [dropTarget, dragging, node.path, node.type, open]);

  if (node.type === "file") {
    const active = selected === node.path;
    const parentPath = pathParent(node.path);
    const isIndex = node.name === "index.md";
    const isPinned = pins.includes(node.path);
    const isDragging = dragging?.itemPath === node.path;
    const offlineAvail = pathCoveredByPins(node.path, offlinePins);
    return (
      <div
        draggable={!blockStructural}
        onDragStart={(e) => {
          if (blockStructural) {
            e.preventDefault();
            return;
          }
          if ((e.target as HTMLElement).closest("[data-no-drag]")) {
            e.preventDefault();
            return;
          }
          onItemDragStart({ itemType: "file", itemPath: node.path }, e);
        }}
        onDragEnd={onItemDragEnd}
        className={cn(
          "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
          active && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)]",
          node.encrypted && !active && "text-amber-600 dark:text-amber-400",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onContextMenu={(e) =>
          onContextMenu(e, {
            itemType: "file",
            itemPath: node.path,
            itemName: node.name,
            encrypted: node.encrypted,
            parentPath,
          })
        }
      >
        <button
          type="button"
          onClick={(e) => {
            if ((e.ctrlKey || e.metaKey) && onOpenDocNewTab) onOpenDocNewTab(node.path);
            else onSelect(node.path);
          }}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 py-1 text-left active:cursor-grabbing"
        >
          {node.encrypted ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Encrypted note" />
          ) : (
            <FileText className={cn("h-3.5 w-3.5 shrink-0 opacity-70", isIndex && "text-[var(--accent)]")} />
          )}
          <span className={cn("truncate", isIndex && !node.encrypted && "italic")}>
            {isIndex ? "index" : node.name.replace(/\.md\.enc$/, "").replace(/\.md$/, "")}
          </span>
          {offlineAvail && (
            <CloudOff className="h-3 w-3 shrink-0 text-[var(--muted)] opacity-70" aria-label="Available offline" />
          )}
        </button>
        <button
          type="button"
          data-no-drag
          title={isPinned ? "Unpin" : "Pin to top"}
          onClick={() => onTogglePin(node.path)}
          className={cn(
            "mr-0.5 rounded p-0.5 hover:text-[var(--foreground)]",
            isPinned ? "flex text-[var(--accent)]" : "hidden text-[var(--muted)] group-hover:flex",
          )}
        >
          <Pin className={cn("h-3 w-3", isPinned && "fill-current")} />
        </button>
        {!blockStructural && (
          <div data-no-drag>
            <VaultItemActions
              parentPath={parentPath}
              itemPath={node.path}
              itemType="file"
              itemName={node.name}
              onCreated={onCreated}
              onDeleted={() => onDeleted(node.path)}
              onTreeRefresh={onTreeRefresh}
            />
          </div>
        )}
      </div>
    );
  }

  const folderActive = folderView === node.path && !selected;
  const hasIndex = (node.children || []).some((c) => c.type === "file" && (c.name === "index.md" || c.name === "index.md.enc"));
  const fileCount = countFiles(node);
  const hasEncrypted = node.hasEncrypted;
  const isDragging = dragging?.itemPath === node.path;
  const isDropTarget =
    dropTarget === node.path && dragging != null && canDropOn(dragging, node.path);
  const dropHandlers = folderDropHandlers(node.path);
  const folderOffline = pathCoveredByPins(node.path, offlinePins);

  return (
    <div>
      <div
        draggable={!blockStructural}
        onDragStart={(e) => {
          if (blockStructural) {
            e.preventDefault();
            return;
          }
          if ((e.target as HTMLElement).closest("[data-no-drag]")) {
            e.preventDefault();
            return;
          }
          onItemDragStart({ itemType: "dir", itemPath: node.path }, e);
        }}
        onDragEnd={onItemDragEnd}
        className={cn(
          "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
          folderActive && "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]",
          isDropTarget && "bg-[var(--accent)]/25 ring-2 ring-[var(--accent)]",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onContextMenu={(e) =>
          onContextMenu(e, {
            itemType: "dir",
            itemPath: node.path,
            itemName: node.name,
            parentPath: pathParent(node.path),
          })
        }
        onDragOver={dropHandlers.onDragOver}
        onDragLeave={dropHandlers.onDragLeave}
        onDrop={dropHandlers.onDrop}
      >
        <button
          type="button"
          data-no-drag
          onClick={() => setOpen(!open)}
          className="flex shrink-0 items-center py-1"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onSelectFolder(node.path)}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 py-1 text-left active:cursor-grabbing"
        >
          <Folder className={cn("h-3.5 w-3.5 shrink-0", hasIndex ? "fill-[var(--accent)]/30 text-[var(--accent)] opacity-80" : "opacity-70")} />
          <span className="truncate font-medium">{node.name}</span>
          {folderOffline && (
            <CloudOff className="h-3 w-3 shrink-0 text-[var(--muted)] opacity-70" aria-label="Available offline" />
          )}
          {hasEncrypted && (
            <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Contains encrypted notes" />
          )}
          {fileCount > 0 && (
            <span className="ml-1 shrink-0 rounded px-1 text-[10px] text-[var(--muted)] opacity-60">
              {fileCount}
            </span>
          )}
        </button>
        {!blockStructural && (
          <div data-no-drag>
            <VaultItemActions
              parentPath={node.path}
              itemPath={node.path}
              itemType="dir"
              itemName={node.name}
              onCreated={onCreated}
              onDeleted={() => onDeleted(node.path)}
              onTreeRefresh={onTreeRefresh}
            />
          </div>
        )}
      </div>
      {open &&
        (node.children || []).map((child) => (
          <TreeBranch
            key={child.path || child.name}
            node={child}
            selected={selected}
            folderView={folderView}
            onSelect={onSelect}
            onSelectFolder={onSelectFolder}
            onCreated={onCreated}
            onDeleted={onDeleted}
            onTreeRefresh={onTreeRefresh}
            onContextMenu={onContextMenu}
            onOpenDocNewTab={onOpenDocNewTab}
            depth={depth + 1}
            pins={pins}
            onTogglePin={onTogglePin}
            dragging={dragging}
            dropTarget={dropTarget}
            onItemDragStart={onItemDragStart}
            onItemDragEnd={onItemDragEnd}
            folderDropHandlers={folderDropHandlers}
            offlinePins={offlinePins}
            blockStructural={blockStructural}
          />
        ))}
    </div>
  );
}
