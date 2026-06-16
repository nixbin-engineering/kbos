import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import yaml from "yaml";
import { vaultRoot } from "./vault";

export type AuthUser = {
  password_hash: string;
  role: string;
  created_at?: string;
  totp_secret?: string;
  totp_enabled?: boolean;
};

export type AuthStore = {
  mode: string;
  session_secret?: string;
  totp_required?: boolean;
  users: Record<string, AuthUser>;
};

const USERS_FILE = "users.yaml";

export function usersFilePath(): string {
  return path.join(vaultRoot(), "config", USERS_FILE);
}

export async function loadAuthStore(): Promise<AuthStore> {
  try {
    const raw = await fs.readFile(usersFilePath(), "utf8");
    const data = yaml.parse(raw) as AuthStore;
    return {
      mode: data.mode || "setup",
      session_secret: data.session_secret,
      users: data.users || {},
    };
  } catch {
    return { mode: "setup", users: {} };
  }
}

export async function saveAuthStore(store: AuthStore): Promise<void> {
  await fs.mkdir(path.join(vaultRoot(), "config"), { recursive: true });
  await fs.writeFile(usersFilePath(), yaml.stringify(store), { mode: 0o600 });
}

export async function needsSetup(): Promise<boolean> {
  const s = await loadAuthStore();
  return Object.keys(s.users).length === 0;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function randomSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export type SessionPayload = {
  user: string;
  role: string;
  exp: number;
};

const SESSION_COOKIE = "kbos_session";
const SESSION_DAYS = 14;

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(user: string, role: string, secret: string): string {
  const payload: SessionPayload = {
    user,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  };
  return signSession(payload, secret);
}

export async function completeSetup(username: string, password: string): Promise<void> {
  const store = await loadAuthStore();
  if (Object.keys(store.users).length > 0) {
    throw new Error("setup already completed");
  }
  store.users[username] = {
    password_hash: await hashPassword(password),
    role: "admin",
    created_at: new Date().toISOString(),
  };
  store.mode = "local";
  store.session_secret = store.session_secret || randomSecret();
  await saveAuthStore(store);
  await updateKBAuthMode("local");
}

async function updateKBAuthMode(mode: string): Promise<void> {
  const cfgPath = path.join(vaultRoot(), "config", "kb.yaml");
  const raw = await fs.readFile(cfgPath, "utf8");
  const doc = yaml.parse(raw) as Record<string, unknown>;
  const auth = (doc.auth as Record<string, string>) || {};
  auth.mode = mode;
  doc.auth = auth;
  await fs.writeFile(cfgPath, yaml.stringify(doc), "utf8");
}

export async function getSessionSecret(): Promise<string | null> {
  const store = await loadAuthStore();
  return store.session_secret || process.env.KBOS_SESSION_SECRET || null;
}

export const DEVICE_COOKIE = "kbos_device";
export const DEVICE_DAYS = 30;

export function signDeviceToken(username: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + DEVICE_DAYS * 86400;
  const body = Buffer.from(JSON.stringify({ user: username, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDeviceToken(token: string, secret: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { user: string; exp: number };
    if (payload.exp < Date.now() / 1000) return null;
    return payload.user;
  } catch { return null; }
}

export async function authRequired(): Promise<boolean> {
  const store = await loadAuthStore();
  return store.mode === "local" && Object.keys(store.users).length > 0;
}
