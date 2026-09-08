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

export type Dashboard = {
  id: string;
  name: string;
  bookmarks: Bookmark[];
};

type BookmarksFile = {
  dashboards?: Dashboard[];
  bookmarks?: Bookmark[];
};

function bookmarksPath(): string {
  return path.join(vaultRoot(), "config", "bookmarks.yaml");
}

function migrateLegacy(parsed: BookmarksFile): Dashboard[] {
  if (parsed.dashboards?.length) return parsed.dashboards;
  const legacy = parsed.bookmarks ?? [];
  return [{ id: "main", name: "Dashboard", bookmarks: legacy }];
}

export async function loadDashboards(): Promise<Dashboard[]> {
  try {
    const raw = await fs.readFile(bookmarksPath(), "utf-8");
    const parsed = (yaml.parse(raw) as BookmarksFile) ?? {};
    return migrateLegacy(parsed);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [{ id: "main", name: "Dashboard", bookmarks: [] }];
    }
    throw err;
  }
}

export async function saveDashboards(dashboards: Dashboard[]): Promise<void> {
  const dir = path.dirname(bookmarksPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(bookmarksPath(), yaml.stringify({ dashboards }), "utf-8");
}

/** @deprecated use loadDashboards */
export async function loadBookmarks(): Promise<Bookmark[]> {
  const dashboards = await loadDashboards();
  return dashboards.flatMap((d) => d.bookmarks);
}

/** @deprecated use saveDashboards */
export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  const dashboards = await loadDashboards();
  if (dashboards.length === 0) {
    await saveDashboards([{ id: "main", name: "Dashboard", bookmarks }]);
    return;
  }
  dashboards[0] = { ...dashboards[0], bookmarks };
  await saveDashboards(dashboards);
}

export function visibleBookmarks(bookmarks: Bookmark[], user: string): Bookmark[] {
  return bookmarks.filter((b) => b.visibility === "team" || b.owner === user);
}

export function visibleDashboards(dashboards: Dashboard[], user: string): Dashboard[] {
  return dashboards.map((d) => ({
    ...d,
    bookmarks: visibleBookmarks(d.bookmarks, user),
  }));
}

export function findBookmark(
  dashboards: Dashboard[],
  bookmarkId: string
): { dashboard: Dashboard; bookmark: Bookmark; dashboardIdx: number; bookmarkIdx: number } | null {
  for (let di = 0; di < dashboards.length; di++) {
    const bi = dashboards[di].bookmarks.findIndex((b) => b.id === bookmarkId);
    if (bi !== -1) {
      return {
        dashboard: dashboards[di],
        bookmark: dashboards[di].bookmarks[bi],
        dashboardIdx: di,
        bookmarkIdx: bi,
      };
    }
  }
  return null;
}

export function flattenVisibleBookmarks(dashboards: Dashboard[]): Bookmark[] {
  return dashboards.flatMap((d) => d.bookmarks);
}
