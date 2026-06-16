import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadTasks, saveTasks, visibleTasks, type TaskPriority } from "@/lib/tasks-store";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const all = await loadTasks();
  return NextResponse.json({ tasks: visibleTasks(all, auth.user || "") });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const { title, description, priority, tags, dueDate, visibility } = body as {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    tags?: string[];
    dueDate?: string;
    visibility?: "private" | "team";
  };

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    title: title.trim(),
    ...(description ? { description } : {}),
    status: "todo" as const,
    priority: (priority as TaskPriority) || "medium",
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(dueDate ? { dueDate } : {}),
    owner: auth.user || "",
    visibility: (visibility === "private" ? "private" : "team") as "private" | "team",
    createdAt: now,
    updatedAt: now,
  };

  const all = await loadTasks();
  all.push(task);
  await saveTasks(all);

  return NextResponse.json({ task }, { status: 201 });
}
