import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { vaultRoot } from "@/lib/vault";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags?: string[];
  dueDate?: string; // ISO date string YYYY-MM-DD
  owner: string;
  visibility: "private" | "team";
  createdAt: string;
  updatedAt: string;
};

function tasksPath(): string {
  return path.join(vaultRoot(), "config", "tasks.yaml");
}

export async function loadTasks(): Promise<Task[]> {
  try {
    const raw = await fs.readFile(tasksPath(), "utf8");
    const parsed = yaml.parse(raw);
    if (!parsed || !Array.isArray(parsed.tasks)) return [];
    return parsed.tasks as Task[];
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  const dir = path.dirname(tasksPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tasksPath(), yaml.stringify({ tasks }), "utf8");
}

/** Filter tasks visible to `user`: team items + own private items. */
export function visibleTasks(tasks: Task[], user: string): Task[] {
  return tasks.filter((t) => t.visibility === "team" || t.owner === user);
}
