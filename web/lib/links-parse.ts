export type TransclusionTarget = {
  target: string;
  section?: string;
  block?: string;
};

function stripRef(raw: string): string {
  let link = raw.trim();
  const hash = link.indexOf("#");
  if (hash >= 0) link = link.slice(0, hash);
  const caret = link.indexOf("^");
  if (caret >= 0) link = link.slice(0, caret);
  return link.trim();
}

export function parseTransclusionTarget(raw: string): TransclusionTarget {
  const trimmed = raw.trim();
  const hash = trimmed.indexOf("#");
  const caret = trimmed.indexOf("^");
  let target = trimmed;
  let section: string | undefined;
  let block: string | undefined;

  if (caret >= 0 && (hash < 0 || caret < hash)) {
    target = trimmed.slice(0, caret);
    block = trimmed.slice(caret + 1).trim() || undefined;
  } else if (hash >= 0) {
    target = trimmed.slice(0, hash);
    section = trimmed.slice(hash + 1).trim() || undefined;
  }

  return { target: target.trim(), section, block };
}

export function extractWikiLinks(body: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < body.length) {
    if (i + 1 < body.length && body[i] === "[" && body[i + 1] === "[") {
      if (i > 0 && body[i - 1] === "!") {
        const end = body.indexOf("]]", i + 2);
        if (end < 0) break;
        i = end + 2;
        continue;
      }
      const end = body.indexOf("]]", i + 2);
      if (end < 0) break;
      let inner = body.slice(i + 2, end);
      const pipe = inner.indexOf("|");
      if (pipe >= 0) inner = inner.slice(0, pipe);
      const link = stripRef(inner);
      if (link && !seen.has(link)) {
        seen.add(link);
        links.push(link);
      }
      i = end + 2;
      continue;
    }
    i++;
  }
  return links;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function preprocessWikiMarkdown(body: string, fromPath?: string): string {
  let out = body.replace(/!\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const parsed = parseTransclusionTarget(inner);
    const attrs = [
      `data-target="${escapeAttr(parsed.target)}"`,
      parsed.section ? `data-section="${escapeAttr(parsed.section)}"` : "",
      parsed.block ? `data-block="${escapeAttr(parsed.block)}"` : "",
      fromPath ? `data-from="${escapeAttr(fromPath)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `\n\n<div class="kbos-embed" ${attrs}></div>\n\n`;
  });

  out = out.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target: string, label: string) => {
    return `[${label.trim()}](kbos://wiki/${encodeURIComponent(target.trim())})`;
  });

  out = out.replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => {
    const t = target.trim();
    const pipe = t.indexOf("|");
    const linkTarget = pipe >= 0 ? t.slice(0, pipe).trim() : t;
    const label = pipe >= 0 ? t.slice(pipe + 1).trim() : t;
    return `[${label}](kbos://wiki/${encodeURIComponent(linkTarget)})`;
  });

  return out;
}

export function extractSection(body: string, section: string): string | null {
  const lines = body.split("\n");
  const target = section.toLowerCase();
  let start = -1;
  let level = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const heading = m[2].trim().toLowerCase();
    if (heading === target || heading.replace(/\s+/g, "-") === target.replace(/\s+/g, "-")) {
      start = i;
      level = m[1].length;
      break;
    }
  }
  if (start < 0) return null;

  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

export function extractBlock(body: string, blockId: string): string | null {
  const id = blockId.toLowerCase();
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(`^${id}`) || lines[i].toLowerCase().includes(`block-${id}`)) {
      const out = [lines[i]];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#{1,6}\s/)) break;
        if (lines[j].trim() === "") break;
        out.push(lines[j]);
      }
      return out.join("\n");
    }
  }
  return null;
}
