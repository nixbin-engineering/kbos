/** Extract #tags from markdown body (not headings, not code fences). */
export function extractInlineTags(body: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  let inFence = false;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // ATX heading — not a tag
    if (/^#{1,6}\s/.test(trimmed)) continue;

    const re = /(?:^|[\s([{>])#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const tag = m[1].toLowerCase();
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }
  }
  return tags;
}

export function mergeTags(frontmatter: string[] | undefined, body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of frontmatter || []) {
    const n = t.toLowerCase().trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  for (const t of extractInlineTags(body)) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
