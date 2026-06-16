import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { vaultRoot } from "./vault";

export type Group = {
  id: string;
  name: string;
  description?: string;
  members: string[];
  type: "team" | "group";
};

type GroupsFile = { groups: Group[] };

function groupsFilePath(): string {
  return path.join(vaultRoot(), "config", "groups.yaml");
}

export async function loadGroups(): Promise<Group[]> {
  try {
    const raw = await fs.readFile(groupsFilePath(), "utf8");
    const data = yaml.parse(raw) as GroupsFile;
    return (data.groups || []).map((g) => ({ ...g, members: g.members || [], type: g.type === "team" ? "team" : "group" }));
  } catch {
    return [];
  }
}

export async function saveGroups(groups: Group[]): Promise<void> {
  const dir = path.dirname(groupsFilePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(groupsFilePath(), yaml.stringify({ groups }), { mode: 0o600 });
}

export async function getGroupsForUser(user: string): Promise<string[]> {
  const groups = await loadGroups();
  return groups.filter((g) => g.members.includes(user)).map((g) => g.id);
}

/**
 * Resolve a list of principal tokens to a flat set of usernames.
 * Tokens: "*" | "@groupId" | "username"
 */
export async function resolvePrincipals(tokens: string[]): Promise<Set<string>> {
  if (tokens.includes("*")) return new Set(["*"]); // wildcard — caller handles separately
  const groups = await loadGroups();
  const users = new Set<string>();
  for (const t of tokens) {
    if (t.startsWith("@")) {
      const g = groups.find((g) => g.id === t.slice(1));
      if (g) g.members.forEach((m) => users.add(m));
    } else {
      users.add(t);
    }
  }
  return users;
}

/**
 * Check whether a user can access a resource whose shared_with list uses
 * the token syntax: "*" | "@groupId" | "username"
 */
export async function canAccessShared(sharedWith: string[], user: string): Promise<boolean> {
  if (!sharedWith || sharedWith.length === 0) return false;
  if (sharedWith.includes("*")) return true;
  if (sharedWith.includes(user)) return true;
  const userGroups = await getGroupsForUser(user);
  return userGroups.some((gid) => sharedWith.includes(`@${gid}`));
}
