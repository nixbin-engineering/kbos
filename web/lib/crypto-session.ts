type Entry = { passphrase: string; exp: number };
type AttemptEntry = { count: number; lockedUntil: number };

const store = new Map<string, Entry>();
const attempts = new Map<string, AttemptEntry>();

const TTL_MS = 30 * 60 * 1000;

export function setUnlockSession(key: string, passphrase: string): void {
  store.set(key, { passphrase, exp: Date.now() + TTL_MS });
}

export function getUnlockSession(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.exp < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.passphrase;
}

export function clearUnlockSession(key: string): void {
  store.delete(key);
}

export function unlockSessionKey(user: string, token: string): string {
  return `${user}:${token.slice(0, 16)}`;
}

/** Attempt tracking for unlock rate limiting. */

export function recordFailedAttempt(user: string, maxAttempts: number, lockoutMinutes: number): {
  locked: boolean;
  lockedUntil: number | null;
  remaining: number;
} {
  const now = Date.now();
  const entry = attempts.get(user) ?? { count: 0, lockedUntil: 0 };

  // If currently locked, check if lockout has expired
  if (entry.lockedUntil > now) {
    return { locked: true, lockedUntil: entry.lockedUntil, remaining: 0 };
  }

  entry.count += 1;

  if (entry.count >= maxAttempts) {
    entry.lockedUntil = now + lockoutMinutes * 60 * 1000;
    entry.count = 0;
    attempts.set(user, entry);
    return { locked: true, lockedUntil: entry.lockedUntil, remaining: 0 };
  }

  attempts.set(user, entry);
  return { locked: false, lockedUntil: null, remaining: maxAttempts - entry.count };
}

export function clearFailedAttempts(user: string): void {
  attempts.delete(user);
}

export function getAttemptStatus(user: string, maxAttempts: number): {
  locked: boolean;
  lockedUntil: number | null;
  remaining: number;
} {
  const now = Date.now();
  const entry = attempts.get(user);
  if (!entry) return { locked: false, lockedUntil: null, remaining: maxAttempts };
  if (entry.lockedUntil > now) return { locked: true, lockedUntil: entry.lockedUntil, remaining: 0 };
  return { locked: false, lockedUntil: null, remaining: maxAttempts - entry.count };
}
