import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { vaultRoot } from "@/lib/vault";

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  description?: string;
  tags?: string[];
  owner: string;
  visibility: "private" | "team";
  createdAt: string;
};

function bookmarksPath(): string {
  return path.join(vaultRoot(), "config", "bookmarks.yaml");
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  try {
    const raw = await fs.readFile(bookmarksPath(), "utf-8");
    const parsed = yaml.parse(raw);
    return (parsed?.bookmarks as Bookmark[]) ?? [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  const dir = path.dirname(bookmarksPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(bookmarksPath(), yaml.stringify({ bookmarks }), "utf-8");
}

/** Filter bookmarks visible to `user`: team items + own private items. */
export function visibleBookmarks(bookmarks: Bookmark[], user: string): Bookmark[] {
  return bookmarks.filter((b) => b.visibility === "team" || b.owner === user);
}
