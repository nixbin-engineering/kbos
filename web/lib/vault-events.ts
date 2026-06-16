import EventEmitter from "events";
import fs from "fs";
import path from "path";
import { docsDir } from "./vault";

export type VaultEvent =
  | { type: "ping" }
  | { type: "tree" }
  | { type: "tags" }
  | { type: "doc"; path: string };

const bus = new EventEmitter();
bus.setMaxListeners(200);

let watching = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const pending = {
  tree: false,
  tags: false,
  docs: new Set<string>(),
};

function emit(event: VaultEvent) {
  bus.emit("vault", event);
}

function flushPending() {
  debounceTimer = null;
  if (pending.tree) emit({ type: "tree" });
  if (pending.tags) emit({ type: "tags" });
  for (const docPath of pending.docs) emit({ type: "doc", path: docPath });
  pending.tree = false;
  pending.tags = false;
  pending.docs.clear();
}

function scheduleFlush() {
  if (debounceTimer) return;
  debounceTimer = setTimeout(flushPending, 400);
}

function noteDocChange(rel: string) {
  pending.tree = true;
  pending.tags = true;
  pending.docs.add(rel);
  scheduleFlush();
}

function noteTreeChange() {
  pending.tree = true;
  scheduleFlush();
}

function normalizeDocRel(filename: string): string | null {
  const rel = filename.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  return rel;
}

function ensureWatcher() {
  if (watching) return;
  watching = true;

  const docs = docsDir();
  try {
    fs.watch(docs, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        noteTreeChange();
        return;
      }
      const rel = normalizeDocRel(String(filename));
      if (rel?.endsWith(".md")) {
        noteDocChange(rel);
      } else {
        noteTreeChange();
      }
    });
  } catch (err) {
    console.warn("[vault-events] recursive watch unavailable, using shallow watch:", err);
    try {
      fs.watch(docs, () => noteTreeChange());
    } catch (inner) {
      console.error("[vault-events] failed to watch vault:", inner);
    }
  }

  const configDir = path.join(path.dirname(docs), "config");
  try {
    fs.watch(configDir, () => {
      pending.tags = true;
      pending.tree = true;
      scheduleFlush();
    });
  } catch {
    /* config may not exist yet */
  }
}

export function subscribeVaultEvents(listener: (event: VaultEvent) => void): () => void {
  ensureWatcher();
  bus.on("vault", listener);
  return () => bus.off("vault", listener);
}
