import matter from "gray-matter";
import type { TaskItem } from "./types";
import { walkPlainDocs } from "./vault";

const TASK_RE = /^(\s*)-\s+\[([ xX])\]\s+(.+)$/;

export async function scanTasks(opts?: {
  status?: "open" | "done" | "all";
  folder?: string;
}): Promise<TaskItem[]> {
  const status = opts?.status || "all";
  const folder = opts?.folder?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  const tasks: TaskItem[] = [];

  await walkPlainDocs(async (rel, raw) => {
    if (folder && !rel.toLowerCase().startsWith(folder)) return;
    const { data, content } = matter(raw);
    const title = (data.title as string) || rel.replace(/\.md$/, "").split("/").pop() || rel;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(TASK_RE);
      if (!m) continue;
      const done = m[2].toLowerCase() === "x";
      if (status === "open" && done) continue;
      if (status === "done" && !done) continue;
      tasks.push({
        path: rel,
        title,
        line: i + 1,
        text: m[3].trim(),
        done,
      });
    }
  });

  return tasks.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}
