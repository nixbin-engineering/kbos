import { NextRequest, NextResponse } from "next/server";
import {
  flattenVisibleBookmarks,
  loadDashboards,
  saveDashboards,
  visibleDashboards,
} from "@/lib/bookmarks";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await req.json();
  const all = await loadDashboards();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.name === "string" && body.name.trim()) {
    all[idx] = { ...all[idx], name: body.name.trim() };
  }
  await saveDashboards(all);

  const dashboards = visibleDashboards(all, auth.user || "");
  return NextResponse.json({ dashboards, bookmarks: flattenVisibleBookmarks(dashboards) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const all = await loadDashboards();
  if (all.length <= 1) {
    return NextResponse.json({ error: "cannot delete the last dashboard" }, { status: 400 });
  }

  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

  all.splice(idx, 1);
  await saveDashboards(all);

  const dashboards = visibleDashboards(all, auth.user || "");
  return NextResponse.json({ dashboards, bookmarks: flattenVisibleBookmarks(dashboards) });
}
