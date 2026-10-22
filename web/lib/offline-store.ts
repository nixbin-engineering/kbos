/**
 * IndexedDB store for selective offline vault pins.
 * Stores: pins, cached docs, pending PUTs, and a tree snapshot.
 */

import type { DocResponse, TreeNode } from "./types";
import { isEncryptedNotePath } from "./utils";

const DB_NAME = "kbos-offline";
const DB_VERSION = 2;

/** Unconfirmed editor content. Cleared only after the server accepts the write. */
export type LocalDraft = {
  path: string;
  raw: string;
  expectedMtime: number | null;
  /** Content this draft was based on, so a later sync can merge instead of overwrite. */
  baseRaw?: string | null;
  updatedAt: number;
};

export type OfflinePin = {
  path: string;
  type: "file" | "dir";
  pinnedAt: number;
};

export type CachedDoc = {
  path: string;
  raw: string;
  mtimeMs: number | null;
  title?: string;
  encrypted?: boolean;
  updatedAt: number;
};

export type PendingSave = {
  id: string;
  path: string;
  raw: string;
  expectedMtime?: number | null;
  force?: boolean;
  queuedAt: number;
};

export type OfflineMeta = {
  key: string;
  tree: TreeNode | null;
  lastSyncAt: number | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("idb open failed"));
    };
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pins")) {
        db.createObjectStore("pins", { keyPath: "path" });
      }
      if (!db.objectStoreNames.contains("docs")) {
        db.createObjectStore("docs", { keyPath: "path" });
      }
      if (!db.objectStoreNames.contains("pending")) {
        const s = db.createObjectStore("pending", { keyPath: "id" });
        s.createIndex("byPath", "path", { unique: false });
        s.createIndex("byQueuedAt", "queuedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "path" });
      }
    };
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("idb tx aborted"));
  });
}

async function withStore<T>(
  store: "pins" | "docs" | "pending" | "meta" | "drafts",
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore, tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(store, mode);
  const s = tx.objectStore(store);
  const result = await fn(s, tx);
  await txDone(tx);
  return result;
}

export async function putDraft(draft: LocalDraft): Promise<void> {
  await withStore("drafts", "readwrite", (s) => {
    s.put(draft);
  });
}

export async function getDraft(path: string): Promise<LocalDraft | null> {
  return withStore("drafts", "readonly", async (s) => {
    const row = await reqToPromise(s.get(path));
    return (row as LocalDraft) ?? null;
  });
}

/** Drop a draft only after the server has accepted this exact content. */
export async function clearDraft(path: string): Promise<void> {
  await withStore("drafts", "readwrite", (s) => {
    s.delete(path);
  });
}

export async function listDrafts(): Promise<LocalDraft[]> {
  return withStore("drafts", "readonly", async (s) => {
    const all = (await reqToPromise(s.getAll())) as LocalDraft[];
    return all.sort((a, b) => a.updatedAt - b.updatedAt);
  });
}

export async function listPins(): Promise<OfflinePin[]> {
  return withStore("pins", "readonly", async (s) => {
    const all = await reqToPromise(s.getAll());
    return (all as OfflinePin[]).sort((a, b) => a.path.localeCompare(b.path));
  });
}

export async function getPin(path: string): Promise<OfflinePin | null> {
  return withStore("pins", "readonly", async (s) => {
    const row = await reqToPromise(s.get(path));
    return (row as OfflinePin) ?? null;
  });
}

export async function setPin(pin: OfflinePin): Promise<void> {
  await withStore("pins", "readwrite", (s) => {
    s.put(pin);
  });
}

export async function removePin(path: string): Promise<void> {
  await withStore("pins", "readwrite", (s) => {
    s.delete(path);
  });
}

export async function getCachedDoc(path: string): Promise<CachedDoc | null> {
  return withStore("docs", "readonly", async (s) => {
    const row = await reqToPromise(s.get(path));
    return (row as CachedDoc) ?? null;
  });
}

export async function putCachedDoc(doc: CachedDoc): Promise<void> {
  await withStore("docs", "readwrite", (s) => {
    s.put(doc);
  });
}

export async function putCachedDocs(docs: CachedDoc[]): Promise<void> {
  if (docs.length === 0) return;
  await withStore("docs", "readwrite", (s) => {
    for (const d of docs) s.put(d);
  });
}

export async function deleteCachedDoc(path: string): Promise<void> {
  await withStore("docs", "readwrite", (s) => {
    s.delete(path);
  });
}

export async function deleteCachedDocsUnder(prefix: string): Promise<void> {
  await withStore("docs", "readwrite", async (s) => {
    const all = (await reqToPromise(s.getAll())) as CachedDoc[];
    for (const d of all) {
      if (d.path === prefix || d.path.startsWith(`${prefix}/`)) {
        s.delete(d.path);
      }
    }
  });
}

export async function listCachedDocPaths(): Promise<string[]> {
  return withStore("docs", "readonly", async (s) => {
    const keys = await reqToPromise(s.getAllKeys());
    return keys.map(String);
  });
}

export async function enqueueSave(
  entry: Omit<PendingSave, "id" | "queuedAt"> & { id?: string; queuedAt?: number },
): Promise<PendingSave> {
  const row: PendingSave = {
    id: entry.id ?? `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path: entry.path,
    raw: entry.raw,
    expectedMtime: entry.expectedMtime,
    force: entry.force,
    queuedAt: entry.queuedAt ?? Date.now(),
  };
  await withStore("pending", "readwrite", async (s) => {
    // Coalesce: drop older pending for same path
    const idx = s.index("byPath");
    const existing = (await reqToPromise(idx.getAll(entry.path))) as PendingSave[];
    for (const e of existing) s.delete(e.id);
    s.put(row);
  });
  return row;
}

export async function listPending(): Promise<PendingSave[]> {
  return withStore("pending", "readonly", async (s) => {
    const all = (await reqToPromise(s.getAll())) as PendingSave[];
    return all.sort((a, b) => a.queuedAt - b.queuedAt);
  });
}

export async function removePending(id: string): Promise<void> {
  await withStore("pending", "readwrite", (s) => {
    s.delete(id);
  });
}

export async function clearPendingForPath(path: string): Promise<void> {
  await withStore("pending", "readwrite", async (s) => {
    const idx = s.index("byPath");
    const existing = (await reqToPromise(idx.getAll(path))) as PendingSave[];
    for (const e of existing) s.delete(e.id);
  });
}

export async function pendingCount(): Promise<number> {
  return withStore("pending", "readonly", async (s) => reqToPromise(s.count()));
}

export async function getTreeSnapshot(): Promise<TreeNode | null> {
  return withStore("meta", "readonly", async (s) => {
    const row = (await reqToPromise(s.get("tree"))) as OfflineMeta | undefined;
    return row?.tree ?? null;
  });
}

export async function setTreeSnapshot(tree: TreeNode | null): Promise<void> {
  await withStore("meta", "readwrite", (s) => {
    const row: OfflineMeta = { key: "tree", tree, lastSyncAt: Date.now() };
    s.put(row);
  });
}

export async function getLastSyncAt(): Promise<number | null> {
  return withStore("meta", "readonly", async (s) => {
    const row = (await reqToPromise(s.get("tree"))) as OfflineMeta | undefined;
    return row?.lastSyncAt ?? null;
  });
}

/** Collect file paths covered by a pin given the vault tree. */
export function expandPinToFilePaths(tree: TreeNode | null, pin: OfflinePin): string[] {
  if (!tree) return pin.type === "file" ? [pin.path] : [];
  if (pin.type === "file") return [pin.path];

  const out: string[] = [];
  const walk = (node: TreeNode) => {
    if (node.type === "file") {
      out.push(node.path);
      return;
    }
    for (const c of node.children ?? []) walk(c);
  };

  if (pin.path === "") {
    walk(tree);
    return out;
  }

  const find = (node: TreeNode): TreeNode | null => {
    if (node.path === pin.path && node.type === "dir") return node;
    for (const c of node.children ?? []) {
      const hit = find(c);
      if (hit) return hit;
    }
    return null;
  };
  const dir = find(tree);
  if (dir) walk(dir);
  return out;
}

/** True if path is covered by any pin (exact file pin or under a dir pin). */
export function pathCoveredByPins(path: string, pins: OfflinePin[]): boolean {
  for (const p of pins) {
    if (p.type === "file" && p.path === path) return true;
    if (p.type === "dir") {
      if (p.path === "") return true;
      if (path === p.path || path.startsWith(`${p.path}/`)) return true;
    }
  }
  return false;
}

/** True if this tree node itself is an explicit pin (not merely covered by ancestor). */
export function isExplicitPin(path: string, type: "file" | "dir", pins: OfflinePin[]): boolean {
  return pins.some((p) => p.path === path && p.type === type);
}

export function cachedDocToResponse(doc: CachedDoc): DocResponse {
  return {
    path: doc.path.endsWith(".md.enc") ? doc.path.replace(/\.enc$/, "") : doc.path,
    meta: { title: doc.title },
    body: "",
    raw: doc.raw,
    encrypted: doc.encrypted ?? isEncryptedNotePath(doc.path),
    mtimeMs: doc.mtimeMs ?? undefined,
  };
}

export function docResponseToCached(d: DocResponse, pathOverride?: string): CachedDoc {
  const path = pathOverride ?? d.path;
  return {
    path,
    raw: d.raw,
    mtimeMs: typeof d.mtimeMs === "number" ? d.mtimeMs : null,
    title: d.meta?.title,
    encrypted: d.encrypted,
    updatedAt: Date.now(),
  };
}

/** Normalize cache key to the path used by the editor / API (usually *.md). */
export function cacheKeyForDocPath(path: string): string {
  return path;
}
