"use client";

import { ChevronDown, ChevronRight, FileText, Folder, Lock, Pin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/types";
import { VaultItemActions } from "./vault-item-actions";
import { VaultContextMenu, type ContextTarget } from "./vault-context-menu";

type Props = {
  tree: TreeNode | null;
  selected: string | null;
  folderView: string | null;
  onSelect: (path: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onCreated: (path: string) => void;
  onDeleted: (path: string) => void;
  onTreeRefresh: () => void;
  onOpenDoc?: (path: string) => void;
  onOpenDocNewTab?: (path: string) => void;
  onOpenDocInSplit?: (path: string) => void;
};

export function VaultTree({
  tree,
  selected,
  folderView,
  onSelect,
  onSelectFolder,
  onCreated,
  onDeleted,
  onTreeRefresh,
  onOpenDoc,
  onOpenDocNewTab,
  onOpenDocInSplit,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    target: ContextTarget;
    position: { x: number; y: number };
  } | null>(null);
  const [pins, setPins] = useState<string[]>([]);

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

  if (!tree) {
    return <p className="min-h-0 flex-1 p-3 text-sm text-[var(--muted)]">Loading vault…</p>;
  }
  const rootActive = folderView === "" && !selected;
  return (
    <>
      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 text-sm">
        {pins.length > 0 && (
          <div className="mb-2">
            <p className="mb-0.5 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Pin className="h-3 w-3" /> Pinned
            </p>
            {pins.map((pinPath) => {
              const label = pinPath.split("/").pop()?.replace(/\.md(\.enc)?$/, "") ?? pinPath;
              const active = selected === pinPath;
              return (
                <div
                  key={pinPath}
                  className={cn(
                    "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
                    active && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)]",
                  )}
                  style={{ paddingLeft: "8px" }}
                >
                  <button type="button" onClick={() => onSelect(pinPath)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left">
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
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
        <div
          className={cn(
            "group mb-1 flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[var(--border)]",
            rootActive && "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]",
          )}
          onContextMenu={(e) =>
            openContext(e, { itemType: "root", itemPath: "", itemName: "docs", parentPath: "" })
          }
        >
          <button
            type="button"
            onClick={() => onSelectFolder("")}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate font-medium">docs</span>
            {tree && (
              <span className="ml-1 shrink-0 rounded px-1 text-[10px] text-[var(--muted)] opacity-60">
                {countFiles(tree)}
              </span>
            )}
          </button>
          <VaultItemActions
            parentPath=""
            itemType="root"
            onCreated={onCreated}
            onTreeRefresh={onTreeRefresh}
          />
        </div>
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
              depth={0}
              pins={pins}
              onTogglePin={togglePin}
            />
          ))}
        </div>
      </nav>
      <VaultContextMenu
        target={contextMenu?.target ?? null}
        position={contextMenu?.position ?? null}
        onClose={() => setContextMenu(null)}
        onTreeRefresh={onTreeRefresh}
        onDeleted={onDeleted}
        onOpenDoc={onOpenDoc}
        onOpenDocNewTab={onOpenDocNewTab}
        onOpenDocInSplit={onOpenDocInSplit}
      />
    </>
  );
}

function countFiles(node: TreeNode): number {
  if (node.type === "file") return 1;
  return (node.children ?? []).reduce((s, c) => s + countFiles(c), 0);
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
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "file") {
    const active = selected === node.path;
    const parentPath = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "";
    const isIndex = node.name === "index.md";
    const isPinned = pins.includes(node.path);
    return (
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
          active && "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)]",
          node.encrypted && !active && "text-amber-600 dark:text-amber-400",
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
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          {node.encrypted ? (
            <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" />
          ) : (
            <FileText className={cn("h-3.5 w-3.5 shrink-0 opacity-70", isIndex && "text-[var(--accent)]")} />
          )}
          <span className={cn("truncate", isIndex && !node.encrypted && "italic")}>
            {isIndex ? "index" : node.name.replace(/\.md\.enc$/, "").replace(/\.md$/, "")}
          </span>
        </button>
        <button
          type="button"
          title={isPinned ? "Unpin" : "Pin to top"}
          onClick={() => onTogglePin(node.path)}
          className={cn(
            "mr-0.5 rounded p-0.5 hover:text-[var(--foreground)]",
            isPinned ? "flex text-[var(--accent)]" : "hidden text-[var(--muted)] group-hover:flex",
          )}
        >
          <Pin className={cn("h-3 w-3", isPinned && "fill-current")} />
        </button>
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
    );
  }

  const folderActive = folderView === node.path && !selected;
  const hasIndex = (node.children || []).some((c) => c.type === "file" && (c.name === "index.md" || c.name === "index.md.enc"));
  const fileCount = countFiles(node);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-md hover:bg-[var(--border)]",
          folderActive && "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onContextMenu={(e) =>
          onContextMenu(e, {
            itemType: "dir",
            itemPath: node.path,
            itemName: node.name,
            parentPath: node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : "",
          })
        }
      >
        <button type="button" onClick={() => setOpen(!open)} className="flex shrink-0 items-center py-1">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onSelectFolder(node.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          <Folder className={cn("h-3.5 w-3.5 shrink-0", hasIndex ? "fill-[var(--accent)]/30 text-[var(--accent)] opacity-80" : "opacity-70")} />
          <span className="truncate font-medium">{node.name}</span>
          {fileCount > 0 && (
            <span className="ml-1 shrink-0 rounded px-1 text-[10px] text-[var(--muted)] opacity-60">
              {fileCount}
            </span>
          )}
        </button>
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
          />
        ))}
    </div>
  );
}
