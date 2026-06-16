export type TocEntry = {
  level: number;
  text: string;
  id: string;
};

/** Slug for heading anchor (GitHub-style). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Extract headings from markdown body (after frontmatter). */
export function extractToc(body: string): TocEntry[] {
  const lines = body.split("\n");
  const counts = new Map<string, number>();
  const entries: TocEntry[] = [];

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/\s+#*\s*$/, "").trim();
    if (!text) continue;

    let base = slugifyHeading(text);
    if (!base) base = "section";
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;

    entries.push({ level, text, id });
  }
  return entries;
}

/** Line index in body for a TOC entry (for editor scroll). */
export function findHeadingLine(body: string, targetId: string): number {
  const lines = body.split("\n");
  const counts = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i].trim());
    if (!m) continue;
    const text = m[2].replace(/\s+#*\s*$/, "").trim();
    if (!text) continue;
    let base = slugifyHeading(text);
    if (!base) base = "section";
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;
    if (id === targetId) return i;
  }
  return -1;
}

export function scrollTextareaToLine(textarea: HTMLTextAreaElement, lineIndex: number) {
  if (lineIndex < 0) return;
  const lines = textarea.value.split("\n");
  let pos = 0;
  for (let i = 0; i < lineIndex; i++) pos += lines[i].length + 1;
  const lineLen = lines[lineIndex]?.length ?? 0;
  textarea.focus();
  textarea.setSelectionRange(pos, pos + lineLen);
  const style = getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  textarea.scrollTop = Math.max(0, lineIndex * lineHeight - textarea.clientHeight / 3);
}
