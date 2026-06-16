import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { safeDocPath } from "@/lib/vault";
import { readFile } from "fs/promises";
import matter from "gray-matter";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Minimal Markdown → HTML (enough for readable standalone export)
function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inFence = false;
  let fenceLang = "";
  let fenceLines: string[] = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  const flushList = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  const flushBq = () => {
    if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; }
  };

  const inline = (s: string): string => {
    // code spans
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);
    // bold+italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    // bold
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // italic
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/_(.+?)_/g, "<em>$1</em>");
    // strikethrough
    s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
    // links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // wikilinks
    s = s.replace(/\[\[([^\]]+)\]\]/g, "<strong>$1</strong>");
    // images
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
    return s;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inFence) {
        flushList(); flushBq();
        inFence = true;
        fenceLang = line.slice(3).trim();
        fenceLines = [];
      } else {
        out.push(`<pre><code${fenceLang ? ` class="language-${escapeHtml(fenceLang)}"` : ""}>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
        inFence = false;
        fenceLines = [];
        fenceLang = "";
      }
      continue;
    }
    if (inFence) { fenceLines.push(line); continue; }

    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList(); flushBq();
      out.push("<hr />");
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      flushList(); flushBq();
      const level = hm[1].length;
      const id = hm[2].toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      out.push(`<h${level} id="${escapeHtml(id)}">${inline(escapeHtml(hm[2]))}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      if (!inBlockquote) { out.push("<blockquote>"); inBlockquote = true; }
      out.push(`<p>${inline(escapeHtml(line.slice(2)))}</p>`);
      continue;
    }
    flushBq();

    // Unordered list
    const ulm = line.match(/^[-*+]\s+(.*)/);
    if (ulm) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(escapeHtml(ulm[1]))}</li>`);
      continue;
    }

    // Ordered list
    const olm = line.match(/^\d+\.\s+(.*)/);
    if (olm) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(escapeHtml(olm[1]))}</li>`);
      continue;
    }

    flushList();

    // Blank line
    if (line.trim() === "") {
      out.push("");
      continue;
    }

    out.push(`<p>${inline(escapeHtml(line))}</p>`);
  }

  if (inFence) out.push(`<pre><code>${escapeHtml(fenceLines.join("\n"))}</code></pre>`);
  flushList();
  flushBq();

  return out.join("\n");
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1a1a1a; }
  h1,h2,h3,h4,h5,h6 { font-weight: 600; margin: 1.5em 0 0.4em; line-height: 1.3; }
  h1 { font-size: 2em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
  p { margin: 0.6em 0; }
  a { color: #2563eb; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 0.875em; background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; }
  pre { background: #1e1e2e; color: #cdd6f4; padding: 1em 1.25em; border-radius: 6px; overflow-x: auto; margin: 1em 0; }
  pre code { background: none; padding: 0; color: inherit; font-size: 0.85em; }
  blockquote { border-left: 4px solid #e5e7eb; margin: 1em 0; padding-left: 1em; color: #6b7280; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.2em 0; }
  del { opacity: 0.6; }
  @media print {
    body { max-width: none; margin: 0; padding: 24px; }
    a { color: inherit; }
    pre { white-space: pre-wrap; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const docPath = url.searchParams.get("path");
  const format = url.searchParams.get("format") ?? "md";

  if (!docPath) return NextResponse.json({ error: "path required" }, { status: 400 });
  if (!["md", "html"].includes(format)) return NextResponse.json({ error: "invalid format" }, { status: 400 });

  try {
    const absPath = safeDocPath(docPath);
    const raw = await readFile(absPath, "utf8");
    const { content: body, data } = matter(raw);
    const title = (data.title as string | undefined) ?? docPath.split("/").pop()?.replace(/\.md(\.enc)?$/, "") ?? docPath;
    const safeFilename = title.replace(/[^\w\s.-]/g, "_");

    if (format === "md") {
      return new Response(raw, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeFilename}.md"`,
        },
      });
    }

    const bodyHtml = mdToHtml(body);
    const fullHtml = wrapHtml(title, bodyHtml);
    return new Response(fullHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}.html"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
