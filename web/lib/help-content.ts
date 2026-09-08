// Built-in KBOS product documentation, rendered by the in-app Help panel.
//
// Source files live in web/content/help/ — NOT in the vault. Use :::example
// blocks in those files for side-by-side Markdown / Preview cards in the guide.
// App chrome (the manual), not user notes: not indexed, not searchable, not
// editable/deletable through the vault UI.

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export type HelpTopic = {
  slug: string;
  title: string;
  body: string;
};

const TOPIC_ORDER = ["getting-started", "callout-blocks", "document-embeds"];

function helpDir(): string {
  return path.join(process.cwd(), "content", "help");
}

export async function loadHelpTopics(): Promise<HelpTopic[]> {
  const dir = helpDir();
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  const topics: HelpTopic[] = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = await fs.readFile(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    topics.push({
      slug,
      title: (typeof data.title === "string" && data.title.trim()) || slug,
      body: content.trim(),
    });
  }

  topics.sort((a, b) => {
    const ai = TOPIC_ORDER.indexOf(a.slug);
    const bi = TOPIC_ORDER.indexOf(b.slug);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.slug.localeCompare(b.slug);
  });

  return topics;
}
