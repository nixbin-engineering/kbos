"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Circle, Columns2, Download, Eye, FilePenLine, FileText, ImagePlus, Link2, Loader2, Lock, Save } from "lucide-react";
import matter from "gray-matter";
import type { DocResponse, FolderIndex, TreeNode } from "@/lib/types";
import { mergeLiveFolderIndex } from "@/lib/folder-index-live";
import { mergeTags } from "@/lib/tags";
import { extractToc, findHeadingLine } from "@/lib/toc";
import { cn } from "@/lib/utils";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from "./codemirror-editor";
import { FolderContentsPanel } from "./folder-contents";
import { MarkdownBody, scrollToHeading } from "./markdown-body";
import { ResizableSplit } from "./resizable-split";
import { DocSidebarPanel } from "./doc-sidebar-panel";

type ViewMode = "edit" | "preview" | "split";

type Props = {
  path: string | null;
  tree?: TreeNode | null;
  autosaveSeconds?: number;
  docRemoteRev?: { path: string; nonce: number } | null;
  onOpenDoc: (path: string) => void;
  onOpenFolder: (folder: string) => void;
  onSaved?: () => void;
  onLiveTagsChange?: (tags: string[]) => void;
  onAskAi?: (prompt?: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterSave?: (save: (() => Promise<boolean>) | null) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function isFolderIndexPath(p: string): boolean {
  return p === "index.md" || p.endsWith("/index.md");
}

function folderFromIndexPath(p: string): string {
  if (p === "index.md") return "";
  return p.slice(0, -"/index.md".length);
}

function bodyFromRaw(raw: string): string {
  return matter(raw).content;
}

function DocEmptyState({
  onOpenDoc,
}: {
  tree?: TreeNode | null;
  onOpenDoc: (path: string) => void;
}) {
  const [recentFiles, setRecentFiles] = useState<{ path: string; title: string; folder: string }[]>([]);

  useEffect(() => {
    fetch("/api/recent?limit=8")
      .then((r) => (r.ok ? r.json() : { recent: [] }))
      .then((d) => setRecentFiles(d.recent ?? []))
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center p-8 overflow-y-auto">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-full bg-[var(--accent)]/10 p-4">
            <BookOpen className="h-8 w-8 text-[var(--accent)] opacity-60" />
          </div>
          <h2 className="text-lg font-semibold">Your knowledge base</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Select a note from the sidebar, or use the quick actions below.
          </p>
        </div>

        {recentFiles.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Recent notes</p>
            <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
              {recentFiles.map((f) => (
                <button
                  key={f.path}
                  onClick={() => onOpenDoc(f.path)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--border)] transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                  <span className="truncate font-medium">{f.title}</span>
                  {f.folder && (
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--muted)]">{f.folder}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Quick actions</p>
          <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)] text-sm">
            <div className="flex items-center gap-3 px-3 py-2 text-[var(--muted)]">
              <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">⌘K</kbd>
              <span>Open command palette</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-[var(--muted)]">
              <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px]">⌘⇧A</kbd>
              <span>Ask AI assistant</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-[var(--muted)]">
              <span className="text-xs">Hover a folder in the sidebar →</span>
              <span className="font-mono text-[10px] bg-[var(--border)] px-1 rounded">+</span>
              <span className="text-xs">to create a note</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TASK_MARKER_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/gm;

// Flips the `taskIndex`-th (0-based, document order) `- [ ]`/`- [x]` marker in
// `body` to `checked`, then splices the result back into `raw` at the same
// offset — `raw` also carries the YAML frontmatter that `body` excludes.
function toggleTaskInRaw(raw: string, body: string, taskIndex: number, checked: boolean): string {
  const start = raw.indexOf(body);
  if (start === -1) return raw;
  let count = -1;
  const newBody = body.replace(TASK_MARKER_RE, (match, prefix: string) => {
    count += 1;
    return count === taskIndex ? `${prefix}[${checked ? "x" : " "}]` : match;
  });
  return raw.slice(0, start) + newBody + raw.slice(start + body.length);
}

function fmTagsFromRaw(raw: string): string[] {
  const t = matter(raw).data.tags;
  return Array.isArray(t) ? (t as string[]) : [];
}

type DiffLine = { kind: "same" | "add" | "del"; text: string };

function computeDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  // DP LCS table
  const m = aLines.length;
  const n = bLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aLines[i] === bLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && aLines[i] === bLines[j]) {
      result.push({ kind: "same", text: aLines[i++] });
      j++;
    } else if (j < n && (i >= m || dp[i + 1][j] <= dp[i][j + 1])) {
      result.push({ kind: "add", text: bLines[j++] });
    } else {
      result.push({ kind: "del", text: aLines[i++] });
    }
  }
  return result;
}

export function DocWorkspace({
  path,
  tree = null,
  autosaveSeconds = 5,
  docRemoteRev = null,
  onOpenDoc,
  onOpenFolder,
  onSaved,
  onLiveTagsChange,
  onAskAi,
  onDirtyChange,
  onRegisterSave,
  scrollRef,
}: Props) {
  const [doc, setDoc] = useState<DocResponse | null>(null);
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<ViewMode>("split");
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [diskChanged, setDiskChanged] = useState(false);
  const [diskContent, setDiskContent] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [folderIndex, setFolderIndex] = useState<FolderIndex | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [unlockPass, setUnlockPass] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockAttemptsRemaining, setUnlockAttemptsRemaining] = useState<number | null>(null);
  const [unlockLockedUntil, setUnlockLockedUntil] = useState<number | null>(null);
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const setPreviewRef = useCallback((el: HTMLDivElement | null) => {
    (previewRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (scrollRef) (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [scrollRef]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<() => Promise<boolean>>(undefined);
  const pathRef = useRef(path);
  const rawRef = useRef(raw);
  const dirtyRef = useRef(dirty);
  const encryptedRef = useRef(!!doc?.encrypted);
  const onSavedRef = useRef(onSaved);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  pathRef.current = path;
  rawRef.current = raw;
  dirtyRef.current = dirty;
  encryptedRef.current = !!doc?.encrypted;
  onSavedRef.current = onSaved;

  const wikilinkSuggestions = useMemo(() => {
    if (!tree?.children) return [];
    const paths: string[] = [];
    const walk = (nodes: typeof tree.children) => {
      for (const n of nodes ?? []) {
        if (n.type === "file") paths.push(n.path);
        else if (n.children) walk(n.children);
      }
    };
    walk(tree.children);
    return paths;
  }, [tree]);

  const body = useMemo(() => bodyFromRaw(raw), [raw]);
  const toc = useMemo(() => extractToc(body), [body]);
  const liveTags = useMemo(() => mergeTags(fmTagsFromRaw(raw), body), [raw, body]);
  const isIndexPage = path ? isFolderIndexPath(path) : false;
  const liveFolderIndex = useMemo(() => {
    if (!isIndexPage || !path) return null;
    return mergeLiveFolderIndex(folderIndex, tree, folderFromIndexPath(path));
  }, [isIndexPage, path, folderIndex, tree]);

  useEffect(() => {
    onLiveTagsChange?.(path ? liveTags : []);
  }, [path, liveTags, onLiveTagsChange]);

  const loadDoc = useCallback(async (docPath: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    setNeedsUnlock(false);
    try {
      const r = await fetch(`/api/docs/${docPath.split("/").map(encodeURIComponent).join("/")}`);
      if (r.status === 423) {
        setNeedsUnlock(true);
        setDoc(null);
        setRaw("");
        return;
      }
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const d = (await r.json()) as DocResponse;
      setDoc(d);
      setRaw(d.raw);
      setDirty(false);
      setDiskChanged(false);
      setDiskContent(null);
      setShowDiff(false);
      setSaveState("idle");
    } catch (e) {
      setError(String(e));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const unlockAndLoad = useCallback(async () => {
    if (!path || !unlockPass) return;
    setUnlockBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/encrypt/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass the doc path so the server validates the passphrase by decryption
        body: JSON.stringify({ passphrase: unlockPass, validate_path: path }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 422) {
        // Wrong passphrase — stay on unlock screen, show remaining attempts
        setUnlockAttemptsRemaining(data.attempts_remaining ?? null);
        throw new Error(data.error || "Wrong passphrase");
      }
      if (r.status === 429) {
        // Locked out
        setUnlockLockedUntil(data.locked_until ?? null);
        throw new Error(data.error || "Too many attempts");
      }
      if (!r.ok) throw new Error(data.error || r.statusText);
      // Passphrase verified — now load the doc (will succeed)
      setUnlockPass("");
      setUnlockAttemptsRemaining(null);
      setUnlockLockedUntil(null);
      setNeedsUnlock(false);
      await loadDoc(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setUnlockBusy(false);
    }
  }, [path, unlockPass, loadDoc]);

  const loadFolderIndex = useCallback(async () => {
    if (!path || !isFolderIndexPath(path)) {
      setFolderIndex(null);
      return;
    }
    const folder = folderFromIndexPath(path);
    const url =
      folder === ""
        ? "/api/folders"
        : `/api/folders/${folder.split("/").map(encodeURIComponent).join("/")}`;
    const r = await fetch(url);
    if (r.ok) setFolderIndex(await r.json());
  }, [path]);

  useEffect(() => {
    const trackedPath = path;

    if (!trackedPath) {
      setDoc(null);
      setRaw("");
      setFolderIndex(null);
      setDiskChanged(false);
      setDirty(false);
      dirtyRef.current = false;
      return;
    }

    // Clear dirty flag for the new path so autosave can't write the previous
    // buffer here before loadDoc finishes (leave-flush already ran in cleanup).
    setDirty(false);
    dirtyRef.current = false;

    void loadDoc(trackedPath);

    return () => {
      // Flush pending edits for this path before leaving (navigate / unmount).
      if (!dirtyRef.current || encryptedRef.current) return;
      const content = rawRef.current;
      dirtyRef.current = false;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      void fetch(`/api/docs/${trackedPath.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: content }),
        keepalive: true,
      }).then((r) => {
        if (r.ok) onSavedRef.current?.();
      }).catch(() => undefined);
    };
  }, [path, loadDoc]);

  useEffect(() => {
    if (!path || !docRemoteRev || docRemoteRev.path !== path) return;
    if (dirty) {
      setDiskChanged(true);
      // Pre-fetch disk version for diff
      fetch(`/api/docs/${path.split("/").map(encodeURIComponent).join("/")}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d?.raw != null && setDiskContent(d.raw))
        .catch(() => undefined);
      return;
    }
    void loadDoc(path, { silent: true });
  }, [docRemoteRev, path, dirty, loadDoc]);

  useEffect(() => {
    if (isIndexPage) loadFolderIndex();
  }, [tree, isIndexPage, loadFolderIndex]);

  const putDoc = useCallback(async (docPath: string, content: string, opts?: { keepalive?: boolean }) => {
    const r = await fetch(`/api/docs/${docPath.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: content }),
      keepalive: opts?.keepalive,
    });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    if (opts?.keepalive) return null;
    return (await r.json()) as DocResponse;
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!path || !dirty || doc?.encrypted) return true;
    setSaving(true);
    setError(null);
    try {
      const d = await putDoc(path, raw);
      if (!d) return false;
      setDoc(d);
      setRaw(d.raw);
      setDirty(false);
      dirtyRef.current = false;
      setSaveState("saved");
      onSaved?.();
      if (isIndexPage) loadFolderIndex();
      return true;
    } catch (e) {
      setError(String(e));
      setSaveState("idle");
      return false;
    } finally {
      setSaving(false);
    }
  }, [path, raw, dirty, doc?.encrypted, onSaved, isIndexPage, loadFolderIndex, putDoc]);

  saveRef.current = save;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Keep parent dirty flag in sync immediately on edits (don't wait for effect).
  const markDirty = useCallback(() => {
    setDirty(true);
    dirtyRef.current = true;
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  useEffect(() => {
    onRegisterSave?.(save);
    return () => onRegisterSave?.(null);
  }, [save, onRegisterSave]);

  /** Keepalive write for unload — does not clear dirty (so beforeunload can still warn). */
  const keepaliveSave = useCallback(() => {
    const docPath = pathRef.current;
    if (!docPath || !dirtyRef.current || encryptedRef.current) return;
    const content = rawRef.current;
    void fetch(`/api/docs/${docPath.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: content }),
      keepalive: true,
    }).then((r) => {
      if (r.ok) onSavedRef.current?.();
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // dirtyRef may already be false if a path-leave flush just ran — don't
    // schedule an autosave of the previous buffer into the new path.
    if (!dirty || !path || !dirtyRef.current) return;
    setSaveState("pending");
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void saveRef.current?.();
    }, autosaveSeconds * 1000);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [raw, dirty, path, autosaveSeconds]);

  useEffect(() => {
    const onVisibility = () => {
      // Tab switch: normal save (clears dirty when done). Do not clear dirty
      // synchronously — that would suppress the beforeunload dialog on close.
      if (document.visibilityState === "hidden") void saveRef.current?.();
    };
    const onPageHide = () => keepaliveSave();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || !pathRef.current || encryptedRef.current) return;
      keepaliveSave();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [keepaliveSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) void saveRef.current?.();
      }
      // View mode shortcuts: Ctrl+E = edit, Ctrl+Shift+P = preview, Ctrl+\ = split
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "e") {
        e.preventDefault();
        setMode("edit");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setMode("preview");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setMode("split");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty]);

  const navigateToc = useCallback(
    (id: string) => {
      if (mode === "preview" || mode === "split") {
        scrollToHeading(id);
      }
      if (mode === "edit" || mode === "split") {
        const line = findHeadingLine(body, id);
        editorRef.current?.scrollToLine(line);
      }
    },
    [mode, body],
  );

  const toggleTask = useCallback(
    (index: number, checked: boolean) => {
      setRaw((prev) => toggleTaskInRaw(prev, bodyFromRaw(prev), index, checked));
      markDirty();
      setDiskChanged(false);
      setSaveState("pending");
    },
    [markDirty],
  );

  const uploadImage = useCallback(
    async (file: File) => {
      if (!path) return;
      setUploading(true);
      setUploadError(null);
      const cursor = editorRef.current?.getCursorOffset() ?? raw.length;
      try {
        const form = new FormData();
        form.append("docPath", path);
        form.append("file", file);
        const r = await fetch("/api/files", { method: "POST", body: form });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || r.statusText);
        const snippet = `\n${data.markdown}\n`;
        editorRef.current?.insertAt(cursor, snippet);
        markDirty();
        setDiskChanged(false);
        setSaveState("pending");
        requestAnimationFrame(() => editorRef.current?.focus());
      } catch (e) {
        setUploadError(String(e));
      } finally {
        setUploading(false);
      }
    },
    [path, raw, markDirty],
  );

  const onEditorPaste = useCallback(
    (e: ClipboardEvent): boolean | void => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void uploadImage(file);
          return true;
        }
      }
    },
    [uploadImage],
  );

  const onEditorDrop = useCallback(
    (e: DragEvent): boolean | void => {
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith("image/")) {
        e.preventDefault();
        void uploadImage(file);
        return true;
      }
    },
    [uploadImage],
  );

  const editor = (
    <div className="relative h-full min-h-0">
      <CodeMirrorEditor
        ref={editorRef}
        value={raw}
        onChange={(val) => {
          setRaw(val);
          markDirty();
          setDiskChanged(false);
          setSaveState("pending");
        }}
        onPaste={onEditorPaste}
        onDrop={onEditorDrop}
        readOnly={doc?.encrypted}
        wikilinkSuggestions={wikilinkSuggestions}
        className="h-full"
      />
      {uploading && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--panel)] px-2 py-1 text-xs shadow">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading image…
          </span>
        </div>
      )}
    </div>
  );

  const preview = (
    <article ref={setPreviewRef} className="markdown-preview h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10">
        <MarkdownBody
          body={body}
          docPath={path ?? undefined}
          onOpenDoc={onOpenDoc}
          onToggleTask={doc?.encrypted ? undefined : toggleTask}
        />
        {isIndexPage && liveFolderIndex && (
          <FolderContentsPanel index={liveFolderIndex} onOpenDoc={onOpenDoc} onOpenFolder={onOpenFolder} />
        )}
      </div>
    </article>
  );

  if (!path) {
    return <DocEmptyState tree={tree} onOpenDoc={onOpenDoc} />;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[var(--muted)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (needsUnlock) {
    const noteName = path?.split("/").pop()?.replace(/\.md\.enc$/, "") ?? path ?? "note";
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--background)] p-6">
        <div className="w-full max-w-sm">
          {/* Lock icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-400/40 bg-amber-400/10 shadow-lg shadow-amber-400/10">
              <Lock className="h-9 w-9 text-amber-500" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                🔒
              </span>
            </div>
          </div>

          <h2 className="mb-1 text-center text-lg font-semibold">Encrypted note</h2>
          <p className="mb-1 text-center text-sm font-medium text-[var(--foreground)]">{noteName}</p>
          <p className="mb-5 text-center text-xs text-[var(--muted)]">
            Decrypted in memory only — plaintext is never written to disk.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
            {unlockLockedUntil && unlockLockedUntil > Date.now() ? (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <Lock className="h-8 w-8 text-red-500" />
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Account locked</p>
                <p className="text-xs text-[var(--muted)]">
                  Too many failed attempts. Try again after{" "}
                  {new Date(unlockLockedUntil).toLocaleTimeString()}.
                </p>
              </div>
            ) : (
              <>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Passphrase</label>
                <input
                  type="password"
                  value={unlockPass}
                  onChange={(e) => { setUnlockPass(e.target.value); setError(null); }}
                  placeholder="Enter passphrase…"
                  autoFocus
                  className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  onKeyDown={(e) => e.key === "Enter" && !unlockBusy && unlockPass && void unlockAndLoad()}
                />
                {error && (
                  <div className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                    <p className="flex items-center gap-1.5">
                      <Lock className="h-3 w-3 shrink-0" /> {error.replace(/^Error:\s*/, "")}
                    </p>
                    {unlockAttemptsRemaining !== null && (
                      <p className="mt-1 text-[10px] opacity-80">
                        {unlockAttemptsRemaining} attempt{unlockAttemptsRemaining !== 1 ? "s" : ""} remaining before lockout
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  disabled={unlockBusy || !unlockPass}
                  onClick={() => void unlockAndLoad()}
                  className="w-full rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {unlockBusy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                    </span>
                  ) : (
                    "Unlock"
                  )}
                </button>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-[10px] text-[var(--muted)]">
            Session expires after 30 minutes of inactivity.
            Right-click the note to permanently decrypt to disk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <div className="min-w-0">
          <BreadcrumbNav path={path} onOpenDoc={onOpenDoc} onOpenFolder={onOpenFolder} rootLabel={tree?.name} />
          <h1 className="truncate text-base font-semibold leading-tight">
            {doc?.meta.title || path?.split("/").pop()?.replace(/\.md(\.enc)?$/, "") || path}
            {doc?.encrypted && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" /> encrypted
              </span>
            )}
          </h1>
          {liveTags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {liveTags.map((t) => (
                <span key={t} className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px]">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save state */}
          {saving && <span title="Saving…"><Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted)]" /></span>}
          {!saving && dirty && <span title="Unsaved changes"><Circle className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /></span>}
          {!saving && !dirty && saveState === "saved" && <span title="Saved"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /></span>}
          {path && (
            <button
              type="button"
              title="Copy shareable link"
              onClick={() => {
                const url = `${window.location.origin}/?doc=${encodeURIComponent(path)}`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs border border-[var(--border)] transition-colors",
                linkCopied ? "text-emerald-500 border-emerald-500/30" : "text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{linkCopied ? "Copied!" : "Copy link"}</span>
            </button>
          )}
          <div className="flex rounded-md border border-[var(--border)] p-0.5">
            {(
              [
                ["edit", FilePenLine, "Edit", "Ctrl+E"],
                ["split", Columns2, "Split", "Ctrl+\\"],
                ["preview", Eye, "Preview", "Ctrl+Shift+P"],
              ] as const
            ).map(([m, Icon, label, shortcut]) => (
              <button
                key={m}
                type="button"
                title={`${label} (${shortcut})`}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-xs",
                  mode === m && "bg-[var(--accent)] text-[var(--accent-fg)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadImage(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            title="Insert image (paste or drag-drop also works)"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center rounded-md border border-[var(--border)] p-1.5 hover:bg-[var(--border)] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
          {/* Export dropdown */}
          <div className="relative">
            <button
              type="button"
              title="Export note"
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center justify-center rounded-md border border-[var(--border)] p-1.5 hover:bg-[var(--border)]"
            >
              <Download className="h-4 w-4" />
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg">
                  <a
                    href={`/api/export?path=${encodeURIComponent(path)}&format=md`}
                    download
                    onClick={() => setExportOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--border)]"
                  >
                    <FileText className="h-4 w-4 opacity-60" /> Markdown (.md)
                  </a>
                  <a
                    href={`/api/export?path=${encodeURIComponent(path)}&format=html`}
                    download
                    onClick={() => setExportOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--border)]"
                  >
                    <FileText className="h-4 w-4 opacity-60" /> HTML (.html)
                  </a>
                  <button
                    type="button"
                    onClick={() => { setExportOpen(false); window.print(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--border)]"
                  >
                    <Download className="h-4 w-4 opacity-60" /> Print / PDF
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={!dirty || saving || doc?.encrypted}
            onClick={() => save()}
            title={doc?.encrypted ? "Decrypt note to edit on disk" : undefined}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-fg)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </header>

      {error && <p className="bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {uploadError && (
        <p className="bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">{uploadError}</p>
      )}
      {diskChanged && (
        <>
          <div className="flex items-center justify-between gap-2 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
            <span>This file changed on disk while you have unsaved edits.</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {diskContent != null && (
                <button
                  type="button"
                  onClick={() => setShowDiff((v) => !v)}
                  className="rounded-md border border-amber-600/40 px-2 py-1 text-xs hover:bg-amber-500/20"
                >
                  {showDiff ? "Hide diff" : "Show diff"}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowDiff(false); path && void loadDoc(path); }}
                className="rounded-md border border-amber-600/40 bg-amber-500/20 px-2 py-1 text-xs hover:bg-amber-500/30"
              >
                Reload from disk
              </button>
              <button
                type="button"
                onClick={() => { setDiskChanged(false); setDiskContent(null); setShowDiff(false); }}
                className="rounded-md border border-amber-600/40 px-2 py-1 text-xs hover:bg-amber-500/20"
              >
                Keep my edits
              </button>
            </div>
          </div>
          {showDiff && diskContent != null && (
            <div className="max-h-64 overflow-y-auto border-b border-amber-500/30 bg-[var(--background)] font-mono text-xs">
              <div className="flex gap-0 border-b border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[10px] text-amber-700 dark:text-amber-300">
                <span className="mr-4 text-red-600 dark:text-red-400">— your edits</span>
                <span className="text-green-600 dark:text-green-400">+ disk version</span>
              </div>
              {computeDiff(raw, diskContent).map((line, i) => (
                <div
                  key={i}
                  className={
                    line.kind === "add"
                      ? "bg-green-500/10 text-green-700 dark:text-green-300"
                      : line.kind === "del"
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : "text-[var(--muted)]"
                  }
                >
                  <span className="select-none px-2 opacity-60">
                    {line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{line.text || " "}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {mode === "edit" && editor}
            {mode === "preview" && preview}
            {mode === "split" && (
              <ResizableSplit
                left={editor}
                right={preview}
                defaultRatio={0.5}
              />
            )}
          </div>
          <DocSidebarPanel
            docPath={path}
            entries={toc}
            onNavigate={navigateToc}
            onOpenDoc={onOpenDoc}
            onRestore={(content) => {
              setRaw(content);
              markDirty();
              setSaveState("pending");
            }}
          />
        </div>
        {/* Status bar */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--panel)] px-4 py-1 text-[11px] text-[var(--muted)]">
          <div className="flex items-center gap-3">
            <span>{wordCount(body)} words</span>
            <span>{body.length} chars</span>
            {doc?.meta.title && <span className="hidden sm:inline truncate max-w-[200px]">{path}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {saving && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>}
            {!saving && dirty && <span className="text-amber-500">Unsaved changes</span>}
            {!saving && !dirty && saveState === "saved" && <span className="text-emerald-600 dark:text-emerald-400">Saved</span>}
            {doc?.encrypted && <span className="text-amber-600 dark:text-amber-400">· encrypted</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
