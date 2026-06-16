import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { loadTasks, saveTasks, visibleTasks, type TaskStatus, type TaskPriority } from "@/lib/tasks-store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    tags?: string[];
    dueDate?: string;
    visibility?: "private" | "team";
  };

  const all = await loadTasks();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const task = all[idx];
  if (task.owner !== auth.user && auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = {
    ...task,
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.priority !== undefined ? { priority: body.priority } : {}),
    ...(body.tags !== undefined ? { tags: body.tags } : {}),
    ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
    ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  await saveTasks(all);

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;
  const all = await loadTasks();
  const task = all.find((t) => t.id === id);
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  if (task.owner !== auth.user && auth.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const filtered = all.filter((t) => t.id !== id);
  await saveTasks(filtered);
  return NextResponse.json({ tasks: visibleTasks(filtered, auth.user || "") });
}
