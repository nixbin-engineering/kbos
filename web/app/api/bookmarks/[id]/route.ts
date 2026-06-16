import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadBookmarks, saveBookmarks, visibleBookmarks } from "@/lib/bookmarks";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await req.json();
  const all = await loadBookmarks();
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

  const bm = all[idx];
  // Only owner or admin can edit
  if (bm.owner !== auth.user && auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  all[idx] = { ...bm, ...body, id, owner: bm.owner, createdAt: bm.createdAt };
  await saveBookmarks(all);
  return NextResponse.json({ bookmarks: visibleBookmarks(all, auth.user || "") });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const all = await loadBookmarks();
  const bm = all.find((b) => b.id === id);
  if (!bm) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (bm.owner !== auth.user && auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const filtered = all.filter((b) => b.id !== id);
  await saveBookmarks(filtered);
  return NextResponse.json({ bookmarks: visibleBookmarks(filtered, auth.user || "") });
}
