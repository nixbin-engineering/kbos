/**
 * Offline password vault: AES-GCM encrypted blob in IndexedDB,
 * unlocked locally with the vault passphrase; mutations queue until online.
 */

export type OfflinePasswordEntry = {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  totp_secret?: string;
  notes?: string;
  tags?: string[];
  shared_with: string[];
  owner?: string;
  created_at: string;
  updated_at: string;
};

export type PwdPendingOp = {
  id: string;
  op: "create" | "update" | "delete";
  entryId: string;
  entry?: OfflinePasswordEntry;
  queuedAt: number;
};

type VaultBlob = {
  key: "vault";
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  enabled: boolean;
  updatedAt: number;
};

const DB_NAME = "kbos-offline-passwords";
const DB_VERSION = 1;

/** In-memory session after local unlock (never persisted). */
let sessionKey: CryptoKey | null = null;
let sessionEntries: OfflinePasswordEntry[] | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("idb open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("vault")) {
        db.createObjectStore("vault", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pending")) {
        const s = db.createObjectStore("pending", { keyPath: "id" });
        s.createIndex("byQueuedAt", "queuedAt", { unique: false });
      }
    };
  });
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

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 210_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptEntries(entries: OfflinePasswordEntry[], passphrase: string): Promise<Omit<VaultBlob, "key" | "enabled" | "updatedAt">> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plain = new TextEncoder().encode(JSON.stringify(entries));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { salt: b64encode(salt), iv: b64encode(iv), ciphertext: b64encode(cipher) };
}

async function decryptEntries(blob: VaultBlob, passphrase: string): Promise<{ key: CryptoKey; entries: OfflinePasswordEntry[] }> {
  const salt = b64decode(blob.salt);
  const iv = b64decode(blob.iv);
  const key = await deriveKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    b64decode(blob.ciphertext) as BufferSource,
  );
  const entries = JSON.parse(new TextDecoder().decode(plain)) as OfflinePasswordEntry[];
  return { key, entries };
}

async function getVaultBlob(): Promise<VaultBlob | null> {
  const db = await openDb();
  try {
    const tx = db.transaction("vault", "readonly");
    const row = (await reqToPromise(tx.objectStore("vault").get("vault"))) as VaultBlob | undefined;
    await txDone(tx);
    return row ?? null;
  } finally {
    db.close();
  }
}

async function putVaultBlob(blob: VaultBlob): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("vault", "readwrite");
    tx.objectStore("vault").put(blob);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function persistSessionEntries(passphrase: string): Promise<void> {
  if (!sessionEntries) return;
  const enc = await encryptEntries(sessionEntries, passphrase);
  const prev = await getVaultBlob();
  await putVaultBlob({
    key: "vault",
    ...enc,
    enabled: prev?.enabled ?? true,
    updatedAt: Date.now(),
  });
}

export async function isPasswordOfflineEnabled(): Promise<boolean> {
  const blob = await getVaultBlob();
  return !!blob?.enabled && !!blob.ciphertext;
}

export async function hasPasswordOfflineVault(): Promise<boolean> {
  const blob = await getVaultBlob();
  return !!blob?.ciphertext;
}

export function isPasswordSessionUnlocked(): boolean {
  return sessionKey != null && sessionEntries != null;
}

export function getPasswordSessionEntries(): OfflinePasswordEntry[] {
  return sessionEntries ? [...sessionEntries] : [];
}

export function lockPasswordOfflineSession(): void {
  sessionKey = null;
  sessionEntries = null;
}

/** Enable offline vault: encrypt current entries with passphrase. */
export async function enablePasswordOffline(
  passphrase: string,
  entries: OfflinePasswordEntry[],
): Promise<void> {
  const enc = await encryptEntries(entries, passphrase);
  await putVaultBlob({
    key: "vault",
    ...enc,
    enabled: true,
    updatedAt: Date.now(),
  });
  const { key } = await decryptEntries(
    { key: "vault", ...enc, enabled: true, updatedAt: Date.now() },
    passphrase,
  );
  sessionKey = key;
  sessionEntries = entries.map((e) => ({ ...e }));
}

export async function disablePasswordOffline(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(["vault", "pending"], "readwrite");
    tx.objectStore("vault").delete("vault");
    const pending = tx.objectStore("pending");
    const all = (await reqToPromise(pending.getAll())) as PwdPendingOp[];
    for (const p of all) pending.delete(p.id);
    await txDone(tx);
  } finally {
    db.close();
  }
  lockPasswordOfflineSession();
}

/** Unlock offline vault with passphrase (no network). */
export async function unlockPasswordOffline(passphrase: string): Promise<OfflinePasswordEntry[]> {
  const blob = await getVaultBlob();
  if (!blob?.ciphertext || !blob.enabled) throw new Error("No offline password vault — enable while online");
  try {
    const { key, entries } = await decryptEntries(blob, passphrase);
    sessionKey = key;
    sessionEntries = entries;
    // Keep passphrase only long enough to re-persist; store in closure via sessionStorage for sync writes
    sessionStorage.setItem("kbos-pwd-offline-pp", passphrase);
    return entries;
  } catch {
    throw new Error("Wrong passphrase or corrupt offline vault");
  }
}

function takePassphrase(): string | null {
  try {
    return sessionStorage.getItem("kbos-pwd-offline-pp");
  } catch {
    return null;
  }
}

export function clearStoredPassphrase(): void {
  try {
    sessionStorage.removeItem("kbos-pwd-offline-pp");
  } catch {
    /* ignore */
  }
}

/** Refresh offline cache from online-fetched entries (must be unlocked online with passphrase). */
export async function refreshPasswordOfflineCache(
  passphrase: string,
  entries: OfflinePasswordEntry[],
): Promise<void> {
  await enablePasswordOffline(passphrase, entries);
}

export async function getOfflineEntry(id: string): Promise<OfflinePasswordEntry | null> {
  if (!sessionEntries) return null;
  return sessionEntries.find((e) => e.id === id) ?? null;
}

async function enqueueOp(op: Omit<PwdPendingOp, "id" | "queuedAt"> & { id?: string }): Promise<void> {
  const row: PwdPendingOp = {
    id: op.id ?? `pwd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    op: op.op,
    entryId: op.entryId,
    entry: op.entry,
    queuedAt: Date.now(),
  };
  const db = await openDb();
  try {
    const tx = db.transaction("pending", "readwrite");
    const store = tx.objectStore("pending");
    // Coalesce updates/deletes for same entry
    const all = (await reqToPromise(store.getAll())) as PwdPendingOp[];
    for (const p of all) {
      if (p.entryId === row.entryId) store.delete(p.id);
    }
    store.put(row);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function listPwdPending(): Promise<PwdPendingOp[]> {
  const db = await openDb();
  try {
    const tx = db.transaction("pending", "readonly");
    const all = (await reqToPromise(tx.objectStore("pending").getAll())) as PwdPendingOp[];
    await txDone(tx);
    return all.sort((a, b) => a.queuedAt - b.queuedAt);
  } finally {
    db.close();
  }
}

export async function pwdPendingCount(): Promise<number> {
  return (await listPwdPending()).length;
}

async function removePwdPending(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function rewriteVault(): Promise<void> {
  const pp = takePassphrase();
  if (!pp || !sessionEntries) return;
  await persistSessionEntries(pp);
}

export async function saveEntryOffline(
  entry: OfflinePasswordEntry,
  mode: "create" | "update",
): Promise<void> {
  if (!sessionEntries) throw new Error("Password vault locked");
  const idx = sessionEntries.findIndex((e) => e.id === entry.id);
  if (mode === "create" || idx < 0) sessionEntries.push({ ...entry });
  else sessionEntries[idx] = { ...entry };
  await rewriteVault();
  await enqueueOp({ op: mode, entryId: entry.id, entry: { ...entry } });
}

export async function deleteEntryOffline(id: string): Promise<void> {
  if (!sessionEntries) throw new Error("Password vault locked");
  sessionEntries = sessionEntries.filter((e) => e.id !== id);
  await rewriteVault();
  await enqueueOp({ op: "delete", entryId: id });
}

export type PwdDrainResult = {
  flushed: number;
  authRequired: boolean;
  locked: boolean;
  error?: string;
};

/** Flush pending password mutations when online + server unlocked. */
export async function drainPasswordPending(): Promise<PwdDrainResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { flushed: 0, authRequired: false, locked: false };
  }
  const pending = await listPwdPending();
  let flushed = 0;
  for (const item of pending) {
    try {
      if (item.op === "delete") {
        const r = await fetch(`/api/passwords/${encodeURIComponent(item.entryId)}`, { method: "DELETE" });
        if (r.status === 401 || r.status === 403) return { flushed, authRequired: true, locked: false };
        if (r.status === 423) return { flushed, authRequired: false, locked: true };
        if (!r.ok && r.status !== 404) {
          const d = await r.json().catch(() => ({}));
          return { flushed, authRequired: false, locked: false, error: d.error || r.statusText };
        }
      } else if (item.op === "create") {
        if (!item.entry) continue;
        const r = await fetch("/api/passwords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.entry.title,
            username: item.entry.username,
            password: item.entry.password,
            url: item.entry.url,
            notes: item.entry.notes,
            totp_secret: item.entry.totp_secret,
            shared_with: item.entry.shared_with,
            // Prefer keeping the offline-generated id if server accepts it — otherwise create new
            id: item.entry.id,
          }),
        });
        if (r.status === 401 || r.status === 403) return { flushed, authRequired: true, locked: false };
        if (r.status === 423) return { flushed, authRequired: false, locked: true };
        if (!r.ok) {
          // Fallback without id if server rejects custom id
          const r2 = await fetch("/api/passwords", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: item.entry.title,
              username: item.entry.username,
              password: item.entry.password,
              url: item.entry.url,
              notes: item.entry.notes,
              totp_secret: item.entry.totp_secret,
              shared_with: item.entry.shared_with,
            }),
          });
          if (r2.status === 423) return { flushed, authRequired: false, locked: true };
          if (!r2.ok) {
            const d = await r2.json().catch(() => ({}));
            return { flushed, authRequired: false, locked: false, error: d.error || r2.statusText };
          }
        }
      } else if (item.op === "update" && item.entry) {
        const r = await fetch(`/api/passwords/${encodeURIComponent(item.entryId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.entry.title,
            username: item.entry.username,
            password: item.entry.password,
            url: item.entry.url,
            notes: item.entry.notes,
            totp_secret: item.entry.totp_secret,
            shared_with: item.entry.shared_with,
          }),
        });
        if (r.status === 401 || r.status === 403) return { flushed, authRequired: true, locked: false };
        if (r.status === 423) return { flushed, authRequired: false, locked: true };
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          return { flushed, authRequired: false, locked: false, error: d.error || r.statusText };
        }
      }
      await removePwdPending(item.id);
      flushed += 1;
    } catch (e) {
      return { flushed, authRequired: false, locked: false, error: String(e).replace(/^Error:\s*/, "") };
    }
  }
  return { flushed, authRequired: false, locked: false };
}

/** Fetch all secrets online and write offline vault. */
export async function downloadPasswordsForOffline(passphrase: string): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const listR = await fetch("/api/passwords");
    if (!listR.ok) throw new Error("Failed to list passwords");
    const { entries: meta } = (await listR.json()) as { entries: { id: string }[] };
    const full: OfflinePasswordEntry[] = [];
    for (const m of meta || []) {
      const r = await fetch(`/api/passwords/${encodeURIComponent(m.id)}`);
      if (r.status === 423) throw new Error("Vault locked — unlock first");
      if (!r.ok) continue;
      const data = await r.json();
      if (data.entry) full.push(data.entry as OfflinePasswordEntry);
    }
    await enablePasswordOffline(passphrase, full);
    return { ok: true, count: full.length };
  } catch (e) {
    return { ok: false, count: 0, error: String(e).replace(/^Error:\s*/, "") };
  }
}

export function newOfflinePasswordId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
