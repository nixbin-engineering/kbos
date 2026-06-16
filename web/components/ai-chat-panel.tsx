"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, FileText, FolderOpen, Globe, Loader2, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatScope = "vault" | "folder" | "document";

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  sources?: { path: string; title: string }[];
};

type AiStatus = {
  enabled: boolean;
  connected: boolean;
  model: string;
  status_message: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenDoc: (path: string) => void;
  selectedDoc: string | null;
  folderView: string | null;
  initialScope?: ChatScope;
  initialPrompt?: string;
};

const SUGGESTIONS = [
  "What topics does my vault cover?",
  "Summarize the key points in my notes",
  "Find notes related to my current topic",
  "What am I missing — suggest tags or links",
];

function scopeLabel(scope: ChatScope, selectedDoc: string | null, folderView: string | null): string {
  if (scope === "document" && selectedDoc) return selectedDoc;
  if (scope === "folder") return folderView !== null ? `docs/${folderView || ""}` : "docs/";
  return "Entire vault";
}

function renderInlineMarkdown(text: string, onOpenDoc: (path: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = linkRe.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const path = m[2].replace(/^\.\//, "");
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={() => onOpenDoc(path)}
        className="text-[var(--accent)] underline hover:opacity-80"
      >
        {m[1]}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function AiChatPanel({
  open,
  onClose,
  onOpenDoc,
  selectedDoc,
  folderView,
  initialScope,
  initialPrompt,
}: Props) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [scope, setScope] = useState<ChatScope>("vault");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(384); // 384 = w-96
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/status");
      if (r.ok) setStatus(await r.json());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (open) loadStatus();
  }, [open, loadStatus]);

  useEffect(() => {
    if (!open) return;
    if (initialScope) {
      setScope(initialScope);
    } else if (selectedDoc) {
      setScope("document");
    } else if (folderView !== null) {
      setScope("folder");
    } else {
      setScope("vault");
    }
  }, [open, initialScope, selectedDoc, folderView]);

  useEffect(() => {
    if (open && initialPrompt) {
      setInput(initialPrompt);
      inputRef.current?.focus();
    }
  }, [open, initialPrompt]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const scopePath =
    scope === "document"
      ? selectedDoc
      : scope === "folder"
        ? folderView !== null
          ? folderView
          : selectedDoc?.includes("/")
            ? selectedDoc.slice(0, selectedDoc.lastIndexOf("/"))
            : ""
        : null;

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    if (!status?.enabled) {
      setError("AI is disabled. Enable it in admin settings (gear icon).");
      return;
    }

    setError(null);
    setInput("");
    const userMsg: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, scope, scopePath, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Chat request failed");
      }

      if (!res.body) throw new Error("Empty response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim()) as {
              type: string;
              content?: string;
              message?: string;
              citations?: string[];
              sources?: { path: string; title: string }[];
            };
            if (evt.type === "token" && evt.content) {
              assistant += evt.content;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: assistant };
                }
                return next;
              });
            } else if (evt.type === "done") {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: assistant,
                    citations: evt.citations,
                    sources: evt.sources,
                  };
                }
                return next;
              });
            } else if (evt.type === "error") {
              throw new Error(evt.message || "Stream error");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      setError(String(e));
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setStreaming(false);
    }
  };

  if (!open) return null;

  const scopeDisabled = scope === "document" && !selectedDoc;

  return (
    <aside
      className="relative flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--panel)]"
      style={{ width: panelWidth }}
    >
      {/* Drag handle */}
      <div
        className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]/60"
        onMouseDown={(e) => {
          dragRef.current = { startX: e.clientX, startW: panelWidth };
          const onMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = dragRef.current.startX - ev.clientX;
            setPanelWidth(Math.max(280, Math.min(700, dragRef.current.startW + delta)));
          };
          const onUp = () => {
            dragRef.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Bot className="h-5 w-5 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-none">KB Assistant</p>
          <p className="truncate text-[10px] text-[var(--muted)]">
            {status?.enabled
              ? status.connected
                ? `Connected · ${status.model}`
                : status.status_message
              : "Disabled — enable in admin settings"}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--border)]" title="Close">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-[var(--border)] px-3 py-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">Search scope</p>
        <div className="flex gap-1">
          {(
            [
              ["vault", Globe, "Vault"],
              ["folder", FolderOpen, "Folder"],
              ["document", FileText, "Note"],
            ] as const
          ).map(([s, Icon, label]) => (
            <button
              key={s}
              type="button"
              disabled={s === "document" && !selectedDoc}
              onClick={() => setScope(s)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs",
                scope === s
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] hover:bg-[var(--border)]",
                s === "document" && !selectedDoc && "cursor-not-allowed opacity-40",
              )}
              title={s === "document" && !selectedDoc ? "Open a note first" : label}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{scopeLabel(scope, selectedDoc, folderView)}</p>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Ask questions about your knowledge base. Answers cite source notes from{" "}
              {scope === "vault" ? "across the vault" : scope === "folder" ? "this folder" : "the open note"}.
            </p>
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                <Sparkles className="h-3 w-3" /> Try asking
              </p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!status?.enabled || streaming}
                  onClick={() => send(s)}
                  className="block w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-left text-xs hover:bg-[var(--border)] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("mb-3", m.role === "user" ? "ml-6 text-right" : "mr-2")}
          >
            <div
              className={cn(
                "inline-block max-w-full rounded-lg px-3 py-2 text-sm text-left whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--border)]/50",
              )}
            >
              {m.role === "assistant" ? renderInlineMarkdown(m.content, onOpenDoc) : m.content}
              {m.role === "assistant" && streaming && i === messages.length - 1 && !m.content && (
                <Loader2 className="inline h-4 w-4 animate-spin opacity-60" />
              )}
            </div>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.sources.map((s) => (
                  <button
                    key={s.path}
                    type="button"
                    onClick={() => onOpenDoc(s.path)}
                    className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--border)]"
                    title={s.path}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mx-3 mb-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-600 dark:text-red-300">{error}</p>
      )}

      <form
        className="border-t border-[var(--border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            disabled={streaming || !status?.enabled || scopeDisabled}
            placeholder={
              !status?.enabled
                ? "Enable AI in admin settings…"
                : scopeDisabled
                  ? "Select a note or folder for this scope…"
                  : "Ask about your notes…"
            }
            className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim() || !status?.enabled || scopeDisabled}
            className="self-end rounded-md bg-[var(--accent)] p-2 text-[var(--accent-fg)] disabled:opacity-50"
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[var(--muted)]">Enter to send · Shift+Enter for newline</p>
      </form>
    </aside>
  );
}
