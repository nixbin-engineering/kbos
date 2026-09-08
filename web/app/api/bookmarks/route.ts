import { NextRequest, NextResponse } from "next/server";
import {
  flattenVisibleBookmarks,
  loadDashboards,
  saveDashboards,
  visibleDashboards,
} from "@/lib/bookmarks";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const all = await loadDashboards();
  const dashboards = visibleDashboards(all, auth.user || "");
  return NextResponse.json({
    dashboards,
    bookmarks: flattenVisibleBookmarks(dashboards),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const { url, title, description, tags, visibility, dashboardId } = body as {
    url: string;
    title: string;
    description?: string;
    tags?: string[];
    visibility?: "private" | "team";
    dashboardId?: string;
  };

  if (!url || !title) {
    return NextResponse.json({ error: "url and title are required" }, { status: 400 });
  }

  const all = await loadDashboards();
  const idx = dashboardId ? all.findIndex((d) => d.id === dashboardId) : 0;
  if (idx === -1) {
    return NextResponse.json({ error: "dashboard not found" }, { status: 404 });
  }

  all[idx].bookmarks.push({
    id: crypto.randomUUID(),
    url,
    title,
    description,
    tags,
    owner: auth.user || "",
    visibility: visibility === "private" ? "private" : "team",
    createdAt: new Date().toISOString(),
  });
  await saveDashboards(all);

  const dashboards = visibleDashboards(all, auth.user || "");
  return NextResponse.json(
    { dashboards, bookmarks: flattenVisibleBookmarks(dashboards) },
    { status: 201 }
  );
}
