"use client";

import { Columns2, Lock, Pencil, SquarePlus, Trash2, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ContextTarget = {
  itemType: "file" | "dir" | "root";
  itemPath: string;
  itemName: string;
  encrypted?: boolean;
  parentPath: string;
};

type Props = {
  target: ContextTarget | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onTreeRefresh: () => void;
  onDeleted: (path: string) => void;
  onOpenDoc?: (path: string) => void;
  onOpenDocNewTab?: (path: string) => void;
  onOpenDocInSplit?: (path: string) => void;
};

export function VaultContextMenu({
  target,
  position,
  onClose,
  onTreeRefresh,
  onDeleted,
  onOpenDoc,
  onOpenDocNewTab,
  onOpenDocInSplit,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<"encrypt" | "decrypt" | "delete" | "rename" | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setDialog(null);
    setPassphrase("");
    setConfirm("");
    setError(null);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onDoc = (e: MouseEvent) => {
      // Don't close if a dialog is open — the dialog modal covers the screen
      if (dialog) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dialog) setDialog(null);
        else onClose();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [target, dialog, onClose]);

  if (!target || !position) return null;

  const isFolder = target.itemType === "dir" || target.itemType === "root";
  const canEncrypt = isFolder || !target.encrypted;
  const canDecrypt = isFolder || target.encrypted;

  const runEncrypt = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: target.itemPath,
          kind: isFolder ? "folder" : "file",
          passphrase,
          confirm,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      // Store passphrase in session so note opens immediately without re-prompting
      await fetch("/api/encrypt/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!isFolder) {
        onDeleted(target.itemPath);
        const encPath = target.itemPath.endsWith(".md")
          ? target.itemPath + ".enc"
          : target.itemPath + ".md.enc";
        onTreeRefresh();
        onOpenDoc?.(encPath);
      } else {
        onTreeRefresh();
      }
      setDialog(null);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runDecrypt = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: target.itemPath,
          kind: isFolder ? "folder" : "file",
          passphrase,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      if (!isFolder) {
        onDeleted(target.itemPath);
        // Navigate to the decrypted file (.md.enc → .md)
        const plainPath = target.itemPath.replace(/\.enc$/, "");
        onTreeRefresh();
        onOpenDoc?.(plainPath);
      } else {
        onTreeRefresh();
      }
      setDialog(null);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    if (target.itemType === "root") return;
    setBusy(true);
    setError(null);
    try {
      const url =
        target.itemType === "file"
          ? `/api/docs/${target.itemPath.split("/").map(encodeURIComponent).join("/")}`
          : `/api/folders/${target.itemPath.split("/").map(encodeURIComponent).join("/")}`;
      const r = await fetch(url, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onTreeRefresh();
      onDeleted(target.itemPath);
      setDialog(null);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runRename = async () => {
    if (!renameTo.trim() || target.itemType === "root") return;
    setBusy(true);
    setError(null);
    try {
      const isFile = target.itemType === "file";
      const url = isFile
        ? `/api/docs/${target.itemPath.split("/").map(encodeURIComponent).join("/")}`
        : `/api/folders/${target.itemPath.split("/").map(encodeURIComponent).join("/")}`;
      // Build new path: keep parent dir, replace name
      const parent = target.itemPath.includes("/")
        ? target.itemPath.slice(0, target.itemPath.lastIndexOf("/"))
        : "";
      const newName = renameTo.trim().replace(/\.md$/, "");
      const newPath = parent ? `${parent}/${newName}` : newName;
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPath: isFile ? newPath : newPath }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      onDeleted(target.itemPath);
      onTreeRefresh();
      if (isFile) onOpenDoc?.(`${newPath}.md`);
      setDialog(null);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const menuStyle = {
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 240),
  };

  return (
    <>
      <div
        ref={ref}
        style={menuStyle}
        className="fixed z-[80] min-w-[11rem] rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg"
      >
        {!isFolder && onOpenDocNewTab && (
          <MenuBtn
            icon={SquarePlus}
            label="Open in new tab"
            onClick={() => { onOpenDocNewTab(target.itemPath); onClose(); }}
          />
        )}
        {!isFolder && onOpenDocInSplit && (
          <MenuBtn
            icon={Columns2}
            label="Open in split view"
            onClick={() => { onOpenDocInSplit(target.itemPath); onClose(); }}
          />
        )}
        {(!isFolder && (onOpenDocNewTab || onOpenDocInSplit)) && (
          <div className="my-1 border-t border-[var(--border)]" />
        )}
        {canEncrypt && (
          <MenuBtn
            icon={Lock}
            label={isFolder ? "Encrypt folder…" : "Encrypt note…"}
            onClick={() => {
              setDialog("encrypt");
              setError(null);
            }}
          />
        )}
        {canDecrypt && (
          <MenuBtn
            icon={Unlock}
            label={isFolder ? "Decrypt folder…" : "Decrypt note…"}
            onClick={() => {
              setDialog("decrypt");
              setError(null);
            }}
          />
        )}
        {target.itemType !== "root" && (
          <>
            <div className="my-1 border-t border-[var(--border)]" />
            <MenuBtn
              icon={Pencil}
              label="Rename…"
              onClick={() => {
                const name = target.itemName.replace(/\.md(\.enc)?$/, "");
                setRenameTo(name);
                setDialog("rename");
                setError(null);
              }}
            />
            <MenuBtn
              icon={Trash2}
              label="Delete…"
              danger
              onClick={() => {
                setDialog("delete");
                setError(null);
              }}
            />
          </>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="mb-2 font-semibold">
              {dialog === "encrypt" && (isFolder ? "Encrypt folder" : "Encrypt note")}
              {dialog === "decrypt" && (isFolder ? "Decrypt folder" : "Decrypt note")}
              {dialog === "rename" && `Rename ${target.itemType === "file" ? "note" : "folder"}`}
              {dialog === "delete" && `Delete ${target.itemType === "file" ? "note" : "folder"}`}
            </h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {target.itemPath ? `docs/${target.itemPath}` : "docs/"}
            </p>
            {dialog === "encrypt" && (
              <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>The plaintext file is replaced with an AES-256-GCM encrypted <code>.md.enc</code> file. It can only be read after entering the passphrase — never stored in plaintext on disk again.</span>
              </div>
            )}
            {(dialog === "encrypt" || dialog === "decrypt") && (
              <>
                <label className="mb-2 block text-sm">
                  Passphrase
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); if (dialog === "decrypt") void runEncrypt(); }
                      if (e.key === "Escape") { e.preventDefault(); setDialog(null); }
                    }}
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    autoFocus
                  />
                </label>
                {dialog === "encrypt" && (
                  <label className="mb-3 block text-sm">
                    Confirm passphrase
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); void runEncrypt(); }
                        if (e.key === "Escape") { e.preventDefault(); setDialog(null); }
                      }}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </label>
                )}
              </>
            )}
            {dialog === "rename" && (
              <label className="mb-3 block text-sm">
                New name
                <input
                  type="text"
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runRename()}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
                  autoFocus
                />
              </label>
            )}
            {dialog === "delete" && (
              <p className="mb-3 text-sm">
                This cannot be undone. Delete <strong>{target.itemName}</strong>?
              </p>
            )}
            {error && <p className="mb-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || (dialog === "rename" ? !renameTo.trim() : dialog !== "delete" && !passphrase)}
                onClick={() => {
                  if (dialog === "encrypt") void runEncrypt();
                  else if (dialog === "decrypt") void runDecrypt();
                  else if (dialog === "rename") void runRename();
                  else void runDelete();
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm disabled:opacity-50",
                  dialog === "delete"
                    ? "bg-red-600 text-white"
                    : "bg-[var(--accent)] text-[var(--accent-fg)]",
                )}
              >
                {busy ? "Working…" : dialog === "delete" ? "Delete" : dialog === "encrypt" ? "Encrypt" : dialog === "rename" ? "Rename" : "Decrypt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Lock;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--border)]",
        danger && "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {label}
    </button>
  );
}
