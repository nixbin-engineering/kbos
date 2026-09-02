"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Eye, FilePenLine, HardDrive, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLocalFileHandle,
  readLocalFile,
  verifyPermission,
  writeLocalFile,
} from "@/lib/local-file";
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from "./codemirror-editor";
import { MarkdownBody } from "./markdown-body";
import { ResizableSplit } from "./resizable-split";

type ViewMode = "edit" | "preview" | "split";

type Props = {
  fileId: string;
  autosaveSeconds?: number;
};

export function LocalFileWorkspace({ fileId, autosaveSeconds = 5 }: Props) {
  const [mode, setMode] = useState<ViewMode>("split");
  const [fileName, setFileName] = useState<string>("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const saveRef = useRef<() => Promise<void>>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const handle = await getLocalFileHandle(fileId);
      if (!handle) {
        throw new Error("This file is no longer available in this tab — close it and open it again.");
      }
      handleRef.current = handle;
      setFileName(handle.name);
      const granted = await verifyPermission(handle, "readwrite");
      if (!granted) {
        throw new Error("Permission to read/write this file was denied.");
      }
      const text = await readLocalFile(handle);
      setContent(text);
      setDirty(false);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await writeLocalFile(handle, content);
      setDirty(false);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }, [content, dirty]);

  saveRef.current = save;

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveRef.current?.(), autosaveSeconds * 1000);
    return () => clearTimeout(t);
  }, [content, dirty, autosaveSeconds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) saveRef.current?.();
      }
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[var(--muted)]">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (error && !fileName) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-red-600 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const editor = (
    <CodeMirrorEditor
      ref={editorRef}
      value={content}
      onChange={(val) => {
        setContent(val);
        setDirty(true);
      }}
      className="h-full"
    />
  );

  const preview = (
    <article className="markdown-preview h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10">
        <MarkdownBody body={content} />
      </div>
    </article>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-base font-semibold leading-tight">{fileName}</h1>
          <span
            title="This file lives on this device, not the server vault"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
          >
            <HardDrive className="h-3 w-3" /> This device
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span title="Saving…"><Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted)]" /></span>}
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
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-fg)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </header>

      {error && <p className="bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {mode === "edit" && editor}
          {mode === "preview" && preview}
          {mode === "split" && <ResizableSplit left={editor} right={preview} defaultRatio={0.5} />}
        </div>
      </div>
    </div>
  );
}
