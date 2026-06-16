import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { getGroupsForUser } from "./groups";

export type VaultAccess = {
  user: string;  // "*" = everyone
  role: "admin" | "editor" | "reader";
};

export type VaultEntry = {
  id: string;
  name: string;
  path: string;       // absolute path on disk
  description?: string;
  secure?: boolean;   // all docs encrypted at rest
  access: VaultAccess[];
};

export type VaultRegistry = {
  vaults: VaultEntry[];
};

const REGISTRY_PATH = process.env.VAULT_REGISTRY_PATH ||
  path.join(process.env.VAULT_PATH || "/vault", "registry.yaml");

/** Root directory where new vaults are created as subdirectories. */
export function vaultsBase(): string {
  return process.env.VAULTS_BASE || path.dirname(process.env.VAULT_PATH || "/vault");
}

export async function loadRegistry(): Promise<VaultRegistry> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, "utf8");
    const data = yaml.parse(raw) as VaultRegistry;
    return { vaults: data.vaults || [] };
  } catch {
    // No registry yet — synthesize one from the single VAULT_PATH
    const defaultVault: VaultEntry = {
      id: "main",
      name: "Main",
      path: process.env.VAULT_PATH || "/vault",
      access: [{ user: "*", role: "editor" }],
    };
    return { vaults: [defaultVault] };
  }
}

export async function saveRegistry(registry: VaultRegistry): Promise<void> {
  await fs.writeFile(REGISTRY_PATH, yaml.stringify(registry), { mode: 0o600 });
}

export async function vaultAccessRole(
  vault: VaultEntry,
  user: string,
): Promise<"admin" | "editor" | "reader" | null> {
  // Most-specific rule wins: exact user > group > wildcard
  let groupRole: VaultAccess["role"] | null = null;
  let wildcardRole: VaultAccess["role"] | null = null;
  const userGroups = await getGroupsForUser(user);

  for (const a of vault.access) {
    if (a.user === user) return a.role;
    if (a.user.startsWith("@")) {
      const gid = a.user.slice(1);
      if (userGroups.includes(gid)) groupRole = a.role;
    } else if (a.user === "*") {
      wildcardRole = a.role;
    }
  }
  return groupRole ?? wildcardRole;
}

export async function canRead(vault: VaultEntry, user: string): Promise<boolean> {
  return (await vaultAccessRole(vault, user)) !== null;
}

export async function canWrite(vault: VaultEntry, user: string): Promise<boolean> {
  const r = await vaultAccessRole(vault, user);
  return r === "admin" || r === "editor";
}

export async function isVaultAdmin(vault: VaultEntry, user: string): Promise<boolean> {
  return (await vaultAccessRole(vault, user)) === "admin";
}

/** Returns only the vaults a user can read. */
export async function accessibleVaults(registry: VaultRegistry, user: string): Promise<VaultEntry[]> {
  const results: VaultEntry[] = [];
  for (const v of registry.vaults) {
    if (await canRead(v, user)) results.push(v);
  }
  return results;
}
