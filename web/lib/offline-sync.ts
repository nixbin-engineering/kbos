/**
 * Offline pin sync: download pinned notes, queue saves, drain on reconnect.
 */

import type { DocResponse, TreeNode } from "./types";
import {
  type CachedDoc,
  type OfflinePin,
  type PendingSave,
  cachedDocToResponse,
  clearDraft,
  clearPendingForPath,
  deleteCachedDoc,
  deleteCachedDocsUnder,
  docResponseToCached,
  enqueueSave,
  expandPinToFilePaths,
  getCachedDoc,
  getDraft,
  getPin,
  listDrafts,
  listPending,
  listPins,
  pathCoveredByPins,
  pendingCount,
  putCachedDoc,
  putCachedDocs,
  removePending,
  removePin,
  setPin,
  setTreeSnapshot,
  getTreeSnapshot,
} from "./offline-store";
import { isEncryptedNotePath } from "./utils";

export type SyncStatus = "online" | "offline" | "syncing" | "auth-required";

export type SyncState = {
  status: SyncStatus;
  pending: number;
  pinning: boolean;
  pinProgress: { done: number; total: number } | null;
  lastError: string | null;
  /** Path that hit a 409 during drain; client should show conflict UI. */
  conflict: { path: string; raw?: string; mtimeMs?: number } | null;
};

export type SyncListener = (state: SyncState) => void;

let listeners = new Set<SyncListener>();
let state: SyncState = {
  status: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  pending: 0,
  pinning: false,
  pinProgress: null,
  lastError: null,
  conflict: null,
};
let draining = false;
let started = false;

function emit() {
  for (const l of listeners) l(state);
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshPendingCount(): Promise<number> {
  const n = await pendingCount();
  setState({ pending: n });
  return n;
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

async function fetchTree(): Promise<TreeNode | null> {
  try {
    const r = await fetch("/api/tree");
    if (!r.ok) return null;
    return (await r.json()) as TreeNode;
  } catch {
    return null;
  }
}

async function fetchDoc(path: string): Promise<DocResponse | null> {
  const r = await fetch(`/api/docs/${encodePath(path)}`);
  if (r.status === 423) {
    return { path, meta: {}, body: "", raw: "", encrypted: true };
  }
  if (!r.ok) return null;
  return (await r.json()) as DocResponse;
}

/** Download all notes for a pin into the cache. */
export async function pinForOffline(
  pinPath: string,
  pinType: "file" | "dir",
  tree?: TreeNode | null,
): Promise<{ ok: boolean; count: number; error?: string }> {
  setState({ pinning: true, pinProgress: { done: 0, total: 0 }, lastError: null });
  try {
    let t = tree ?? (await fetchTree()) ?? (await getTreeSnapshot());
    if (!t && pinType === "dir") {
      throw new Error("Vault tree unavailable — go online to pin a folder");
    }
    if (t) await setTreeSnapshot(t);

    const pin: OfflinePin = { path: pinPath, type: pinType, pinnedAt: Date.now() };
    const paths = expandPinToFilePaths(t, pin).filter((p) => !isEncryptedNotePath(p));
    // Still pin encrypted paths as stubs so tree knows they exist
    const encPaths = expandPinToFilePaths(t, pin).filter((p) => isEncryptedNotePath(p));

    setState({ pinProgress: { done: 0, total: paths.length } });

    const batch: CachedDoc[] = [];
    let done = 0;
    for (const p of paths) {
      const doc = await fetchDoc(p);
      if (doc && !doc.encrypted) {
        batch.push(docResponseToCached(doc, p));
      } else if (doc?.encrypted) {
        batch.push({
          path: p,
          raw: "",
          mtimeMs: null,
          encrypted: true,
          updatedAt: Date.now(),
        });
      }
      done += 1;
      if (done % 3 === 0 || done === paths.length) {
        if (batch.length) {
          await putCachedDocs(batch.splice(0, batch.length));
        }
        setState({ pinProgress: { done, total: paths.length } });
      }
    }
    if (batch.length) await putCachedDocs(batch);

    for (const p of encPaths) {
      await putCachedDoc({
        path: p,
        raw: "",
        mtimeMs: null,
        encrypted: true,
        updatedAt: Date.now(),
      });
    }

    await setPin(pin);
    setState({ pinning: false, pinProgress: null });
    return { ok: true, count: paths.length + encPaths.length };
  } catch (e) {
    const msg = String(e).replace(/^Error:\s*/, "");
    setState({ pinning: false, pinProgress: null, lastError: msg });
    return { ok: false, count: 0, error: msg };
  }
}

/** Remove pin and purge cached docs that no other pin covers. */
export async function unpinOffline(pinPath: string): Promise<void> {
  const pin = await getPin(pinPath);
  await removePin(pinPath);
  const remaining = await listPins();
  if (!pin) return;

  const tree = await getTreeSnapshot();
  const paths = expandPinToFilePaths(tree, pin);
  for (const p of paths) {
    if (!pathCoveredByPins(p, remaining)) {
      await deleteCachedDoc(p);
    }
  }
  // If unpinning a folder, also clear any orphaned prefix leftovers
  if (pin.type === "dir" && pin.path) {
    const still = await listPins();
    if (!pathCoveredByPins(pin.path, still)) {
      await deleteCachedDocsUnder(pin.path);
    }
  }
}

export async function isPathOfflineAvailable(path: string): Promise<boolean> {
  const pins = await listPins();
  if (!pathCoveredByPins(path, pins)) return false;
  const cached = await getCachedDoc(path);
  return cached != null && !cached.encrypted;
}

export async function loadDocOffline(path: string): Promise<DocResponse | null> {
  const cached = await getCachedDoc(path);
  if (!cached) return null;
  if (cached.encrypted) {
    return { path, meta: {}, body: "", raw: "", encrypted: true };
  }
  return cachedDocToResponse(cached);
}

/** Keep cache warm after a successful online GET/PUT when path is pinned. */
export async function maybeCacheOnlineDoc(doc: DocResponse): Promise<void> {
  const pins = await listPins();
  const path = doc.path;
  if (!pathCoveredByPins(path, pins)) return;
  if (doc.encrypted) return;
  await putCachedDoc(docResponseToCached(doc));
}

/** Queue a save for offline sync; also updates local cache. */
export async function saveDocOffline(
  path: string,
  raw: string,
  expectedMtime?: number | null,
  force?: boolean,
): Promise<void> {
  await enqueueSave({ path, raw, expectedMtime, force });
  const prev = await getCachedDoc(path);
  await putCachedDoc({
    path,
    raw,
    mtimeMs: prev?.mtimeMs ?? null,
    title: prev?.title,
    encrypted: false,
    updatedAt: Date.now(),
  });
  await refreshPendingCount();
}

export type DrainResult = {
  flushed: number;
  conflict: SyncState["conflict"];
  authRequired: boolean;
  error?: string;
};

/** Flush pending saves. Stops on first conflict or auth failure. */
export async function drainPendingQueue(): Promise<DrainResult> {
  if (draining) return { flushed: 0, conflict: state.conflict, authRequired: false };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState({ status: "offline" });
    return { flushed: 0, conflict: null, authRequired: false };
  }

  draining = true;
  setState({ status: "syncing", lastError: null, conflict: null });
  let flushed = 0;

  try {
    const pending = await listPending();
    for (const item of pending) {
      const result = await putOne(item);
      if (result === "auth") {
        setState({ status: "auth-required", pending: await pendingCount() });
        return { flushed, conflict: null, authRequired: true };
      }
      if (result === "conflict") {
        const conflict = state.conflict;
        setState({ status: "online", pending: await pendingCount() });
        return { flushed, conflict, authRequired: false };
      }
      if (result === "error") {
        setState({ status: "online", pending: await pendingCount() });
        return { flushed, conflict: null, authRequired: false, error: state.lastError ?? undefined };
      }
      flushed += 1;
    }
    const n = await pendingCount();
    setState({ status: "online", pending: n });
    return { flushed, conflict: null, authRequired: false };
  } finally {
    draining = false;
  }
}

async function putOne(item: PendingSave): Promise<"ok" | "conflict" | "auth" | "error"> {
  try {
    const body: { raw: string; expectedMtime?: number; force?: boolean } = { raw: item.raw };
    if (item.force) body.force = true;
    else if (item.expectedMtime != null) body.expectedMtime = item.expectedMtime;

    const r = await fetch(`/api/docs/${encodePath(item.path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.status === 401 || r.status === 403) return "auth";

    if (r.status === 409) {
      const data = await r.json().catch(() => ({}));
      setState({
        conflict: {
          path: item.path,
          raw: typeof data.raw === "string" ? data.raw : undefined,
          mtimeMs: typeof data.mtimeMs === "number" ? data.mtimeMs : undefined,
        },
      });
      return "conflict";
    }

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setState({ lastError: data.error || r.statusText });
      return "error";
    }

    const doc = (await r.json()) as DocResponse;
    await putCachedDoc(docResponseToCached({ ...doc, path: item.path }));
    const draft = await getDraft(item.path);
    if (!draft || draft.raw === item.raw) await clearDraft(item.path);
    await removePending(item.id);
    await refreshPendingCount();
    return "ok";
  } catch (e) {
    setState({ lastError: String(e).replace(/^Error:\s*/, ""), status: "offline" });
    return "error";
  }
}

/** Resolve a sync conflict by force-pushing local or dropping pending and taking server. */
export async function resolveConflictKeepLocal(path: string, rawOverride?: string): Promise<boolean> {
  const pending = (await listPending()).filter((p) => p.path === path);
  const item = pending[pending.length - 1];
  const raw = rawOverride ?? item?.raw;
  if (!raw) {
    setState({ conflict: null });
    return false;
  }
  await clearPendingForPath(path);
  setState({ conflict: null });
  // Prefer an immediate force PUT when online
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const r = await fetch(`/api/docs/${encodePath(path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, force: true }),
      });
      if (r.status === 401 || r.status === 403) {
        await enqueueSave({ path, raw, force: true });
        setState({ status: "auth-required" });
        await refreshPendingCount();
        return false;
      }
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      const doc = (await r.json()) as DocResponse;
      await putCachedDoc(docResponseToCached(doc, path));
      const draft = await getDraft(path);
      if (!draft || draft.raw === raw) await clearDraft(path);
      await refreshPendingCount();
      return true;
    } catch {
      await enqueueSave({ path, raw, force: true });
      await refreshPendingCount();
      return false;
    }
  }
  await enqueueSave({ path, raw, force: true });
  await refreshPendingCount();
  return true;
}

export async function resolveConflictTakeServer(path: string): Promise<DocResponse | null> {
  await clearPendingForPath(path);
  await clearDraft(path);
  setState({ conflict: null });
  await refreshPendingCount();
  try {
    const doc = await fetchDoc(path);
    if (doc && !doc.encrypted) await putCachedDoc(docResponseToCached(doc));
    return doc;
  } catch {
    return null;
  }
}

/** Push unconfirmed local drafts. Never force-overwrites the server. */
export async function drainLocalDrafts(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const drafts = await listDrafts();
  for (const draft of drafts) {
    try {
      const body: { raw: string; expectedMtime?: number; baseRaw?: string } = { raw: draft.raw };
      if (draft.expectedMtime != null) body.expectedMtime = draft.expectedMtime;
      if (draft.baseRaw != null) body.baseRaw = draft.baseRaw;
      const r = await fetch(`/api/docs/${encodePath(draft.path)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const current = await getDraft(draft.path);
        if (!current || current.updatedAt <= draft.updatedAt) await clearDraft(draft.path);
        continue;
      }
      if (r.status === 409) {
        const data = await r.json().catch(() => ({}));
        if (typeof data.raw === "string" && data.raw === draft.raw) {
          await clearDraft(draft.path);
          continue;
        }
        setState({
          conflict: {
            path: draft.path,
            raw: typeof data.raw === "string" ? data.raw : undefined,
            mtimeMs: typeof data.mtimeMs === "number" ? data.mtimeMs : undefined,
          },
        });
      }
    } catch {
      return;
    }
  }
}

export function startOfflineSync(): () => void {
  if (started || typeof window === "undefined") return () => undefined;
  started = true;

  const onOnline = () => {
    setState({ status: "online" });
    void refreshPendingCount().then(() => drainPendingQueue()).then(() => drainLocalDrafts());
  };
  const onOffline = () => setState({ status: "offline" });

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  setState({ status: navigator.onLine ? "online" : "offline" });
  void refreshPendingCount().then(() => {
    if (navigator.onLine) void drainPendingQueue();
  });

  const tick = window.setInterval(() => {
    if (navigator.onLine && state.pending > 0 && state.status !== "auth-required") {
      void drainPendingQueue();
    }
  }, 15_000);

  return () => {
    started = false;
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    clearInterval(tick);
  };
}

export function isNavigatorOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
