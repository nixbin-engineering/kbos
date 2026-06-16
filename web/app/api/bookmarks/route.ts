import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadBookmarks, saveBookmarks, visibleBookmarks } from "@/lib/bookmarks";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const all = await loadBookmarks();
  return NextResponse.json({ bookmarks: visibleBookmarks(all, auth.user || "") });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const { url, title, description, tags, visibility } = body as {
    url: string;
    title: string;
    description?: string;
    tags?: string[];
    visibility?: "private" | "team";
  };

  if (!url || !title) {
    return NextResponse.json({ error: "url and title are required" }, { status: 400 });
  }

  const all = await loadBookmarks();
  all.push({
    id: crypto.randomUUID(),
    url,
    title,
    description,
    tags,
    owner: auth.user || "",
    visibility: visibility === "private" ? "private" : "team",
    createdAt: new Date().toISOString(),
  });
  await saveBookmarks(all);
  return NextResponse.json({ bookmarks: visibleBookmarks(all, auth.user || "") }, { status: 201 });
}
