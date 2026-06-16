import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { vaultRoot } from "./vault";
import { canAccessShared } from "./groups";

export type PasswordEntry = {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  totp_secret?: string;
  notes?: string;
  tags?: string[];
  /**
   * Who can access this entry besides the owner.
   * Tokens: "*" (everyone), "@groupId" (group), "username" (specific user)
   * Empty array = private (owner only)
   */
  shared_with: string[];
  owner?: string;
  created_at: string;
  updated_at: string;
};

type EntryFile = {
  meta: Omit<PasswordEntry, "password" | "totp_secret">;
  // AES-256-GCM encrypted JSON of { password, totp_secret }
  // Format: base64(salt(32) + iv(12) + tag(16) + ciphertext)
  encrypted_payload: string;
  kdf: "scrypt";
  N: number; r: number; p: number;
};

function passwordsDir(): string {
  return path.join(vaultRoot(), ".kb", "passwords");
}

function entryPath(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) throw new Error("invalid id");
  return path.join(passwordsDir(), `${sanitized}.pwd.enc`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(passwordsDir(), { recursive: true });
  // Lock down the directory
  await fs.chmod(passwordsDir(), 0o700).catch(() => {});
}

// Derive a 32-byte key from passphrase + salt using scrypt.
async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(passphrase, salt, 32, { N: 32768, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}

function encryptSecrets(secrets: { password: string; totp_secret?: string }, passphrase: string): Promise<{ payload: string; N: number; r: number; p: number }> {
  return new Promise(async (resolve, reject) => {
    try {
      const salt = crypto.randomBytes(32);
      const key = await deriveKey(passphrase, salt);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const plaintext = Buffer.from(JSON.stringify(secrets));
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      const combined = Buffer.concat([salt, iv, tag, encrypted]);
      resolve({ payload: combined.toString("base64"), N: 32768, r: 8, p: 1 });
    } catch (e) { reject(e); }
  });
}

async function decryptSecrets(payload: string, passphrase: string): Promise<{ password: string; totp_secret?: string }> {
  const combined = Buffer.from(payload, "base64");
  const salt = combined.subarray(0, 32);
  const iv = combined.subarray(32, 44);
  const tag = combined.subarray(44, 60);
  const ciphertext = combined.subarray(60);
  const key = await deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plain.toString()) as { password: string; totp_secret?: string };
}

export async function listEntries(user: string): Promise<Omit<PasswordEntry, "password" | "totp_secret">[]> {
  await ensureDir();
  let files: string[];
  try {
    files = (await fs.readdir(passwordsDir())).filter((f) => f.endsWith(".pwd.enc"));
  } catch { return []; }

  const results: Omit<PasswordEntry, "password" | "totp_secret">[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(passwordsDir(), f), "utf8");
      const entry = JSON.parse(raw) as EntryFile;
      const meta = entry.meta;
      // Migrate old boolean `shared` field
      const sharedWith: string[] = (meta as { shared_with?: string[]; shared?: boolean }).shared_with
        ?? ((meta as { shared?: boolean }).shared ? ["*"] : []);
      const normalized = { ...meta, shared_with: sharedWith };
      const owned = normalized.owner === user;
      const accessible = owned || await canAccessShared(sharedWith, user);
      if (accessible) results.push(normalized);
    } catch { /* skip corrupt */ }
  }
  return results.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getEntry(id: string, passphrase: string): Promise<PasswordEntry> {
  const raw = await fs.readFile(entryPath(id), "utf8");
  const file = JSON.parse(raw) as EntryFile;
  const secrets = await decryptSecrets(file.encrypted_payload, passphrase);
  return { ...file.meta, ...secrets };
}

export async function saveEntry(entry: PasswordEntry, passphrase: string): Promise<void> {
  await ensureDir();
  const { password, totp_secret, ...meta } = entry;
  const { payload, N, r, p } = await encryptSecrets({ password, totp_secret }, passphrase);
  const file: EntryFile = { meta, encrypted_payload: payload, kdf: "scrypt", N, r, p };
  await fs.writeFile(entryPath(entry.id), JSON.stringify(file), { mode: 0o600 });
}

export async function deleteEntry(id: string): Promise<void> {
  await fs.unlink(entryPath(id));
}

export function generateId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function generatePassword(length = 20, symbols = true): string {
  const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const syms = "!@#$%^&*-=_+";
  const charset = alpha + digits + (symbols ? syms : "");
  const bytes = crypto.randomBytes(length * 2); // over-sample for modulo bias
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("")
    .slice(0, length);
}
