import { NextRequest, NextResponse } from "next/server";
import {
  flattenVisibleBookmarks,
  loadDashboards,
  saveDashboards,
  visibleDashboards,
} from "@/lib/bookmarks";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const all = await loadDashboards();
  all.push({
    id: crypto.randomUUID(),
    name,
    bookmarks: [],
  });
  await saveDashboards(all);

  const dashboards = visibleDashboards(all, auth.user || "");
  return NextResponse.json(
    { dashboards, bookmarks: flattenVisibleBookmarks(dashboards) },
    { status: 201 }
  );
}
