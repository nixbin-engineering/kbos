"use client";

// The File System Access API isn't part of TypeScript's "dom" lib yet, so we
// declare the minimal surface we use ourselves rather than pull in a types package.
declare global {
  interface FileSystemFileHandle {
    readonly kind: "file";
    readonly name: string;
    getFile(): Promise<File>;
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
    queryPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  }
  interface FileSystemWritableFileStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
  interface Window {
    showOpenFilePicker?(options?: {
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(options?: {
      suggestedName?: string;
      excludeAcceptAllOption?: boolean;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }): Promise<FileSystemFileHandle>;
  }
}

const PICKER_TYPES = [
  {
    description: "Markdown / text",
    accept: { "text/markdown": [".md"], "text/plain": [".txt"] },
  },
];

export function isLocalFileSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

function assertSupported() {
  if (!isLocalFileSupported()) {
    throw new Error("This browser doesn't support opening local files (Chrome, Edge, or another Chromium-based browser is required).");
  }
}

/** Opens the native file picker and returns the chosen file's handle, or null if cancelled. */
export async function openLocalFile(): Promise<FileSystemFileHandle | null> {
  assertSupported();
  try {
    const [handle] = await window.showOpenFilePicker!({ types: PICKER_TYPES, multiple: false });
    return handle ?? null;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** Opens the native save picker to create a new file, returning its handle, or null if cancelled. */
export async function createLocalFile(suggestedName = "untitled.md"): Promise<FileSystemFileHandle | null> {
  assertSupported();
  try {
    return await window.showSaveFilePicker!({ suggestedName, types: PICKER_TYPES });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/** Ensures we hold (or can regain) permission to read/write the given handle. */
export async function verifyPermission(handle: FileSystemFileHandle, mode: "read" | "readwrite" = "readwrite"): Promise<boolean> {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

export async function readLocalFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeLocalFile(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

// --- Handle registry ---
// FileSystemFileHandle isn't JSON-serializable so it can't live in the tabs'
// React state, but it IS structured-cloneable, so IndexedDB can hold it across
// reloads (subject to the browser re-prompting for permission on reconnect).

const DB_NAME = "kbos-local-files";
const STORE = "handles";
const memoryCache = new Map<string, FileSystemFileHandle>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function newLocalFileId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function registerLocalFileHandle(id: string, handle: FileSystemFileHandle): Promise<void> {
  memoryCache.set(id, handle);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort persistence — the in-memory copy still works for this session.
  }
}

export async function getLocalFileHandle(id: string): Promise<FileSystemFileHandle | null> {
  const cached = memoryCache.get(id);
  if (cached) return cached;
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemFileHandle | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as FileSystemFileHandle | undefined);
      req.onerror = () => reject(req.error);
    });
    if (handle) memoryCache.set(id, handle);
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function forgetLocalFileHandle(id: string): Promise<void> {
  memoryCache.delete(id);
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
  } catch {
    // best-effort
  }
}
