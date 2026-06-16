import matter from "gray-matter";
import path from "path";
import { extractWikiLinks } from "./links-parse";
import type { LinkRef } from "./types";
import { walkPlainDocs } from "./vault";

export type DocIndexEntry = {
  path: string;
  title: string;
  aliases: string[];
  folder: string;
  body: string;
  wikiLinks: string[];
};

export type LinkIndex = {
  docs: Map<string, DocIndexEntry>;
  byBasename: Map<string, string[]>;
  byAlias: Map<string, string>;
  backlinks: Map<string, Set<string>>;
};

let cache: LinkIndex | null = null;

function stripRef(raw: string): string {
  let link = raw.trim();
  const hash = link.indexOf("#");
  if (hash >= 0) link = link.slice(0, hash);
  const caret = link.indexOf("^");
  if (caret >= 0) link = link.slice(0, caret);
  return link.trim();
}

function titleFromBody(body: string, filename: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return path.basename(filename, ".md").replace(/-/g, " ");
}

export async function buildLinkIndex(): Promise<LinkIndex> {
  const docs = new Map<string, DocIndexEntry>();
  const byBasename = new Map<string, string[]>();
  const byAlias = new Map<string, string>();

  await walkPlainDocs(async (rel, raw) => {
    const { data, content } = matter(raw);
    const aliases = Array.isArray(data.aliases) ? (data.aliases as string[]) : [];
    const title = (data.title as string) || titleFromBody(content, rel);
    const folder = path.dirname(rel).replace(/\\/g, "/");
    const entry: DocIndexEntry = {
      path: rel,
      title,
      aliases,
      folder: folder === "." ? "" : folder,
      body: content,
      wikiLinks: extractWikiLinks(content),
    };
    docs.set(rel, entry);

    const base = path.basename(rel, ".md").toLowerCase();
    const list = byBasename.get(base) || [];
    list.push(rel);
    byBasename.set(base, list);

    for (const alias of aliases) {
      byAlias.set(alias.toLowerCase(), rel);
    }
    byAlias.set(title.toLowerCase(), rel);
  });

  const backlinks = new Map<string, Set<string>>();
  for (const [fromPath, doc] of docs) {
    for (const target of doc.wikiLinks) {
      const resolved = resolveWikiLinkInIndex(target, fromPath, docs, byBasename, byAlias);
      if (!resolved.broken && resolved.path) {
        const set = backlinks.get(resolved.path) || new Set();
        set.add(fromPath);
        backlinks.set(resolved.path, set);
      }
    }
  }

  cache = { docs, byBasename, byAlias, backlinks };
  return cache;
}

export async function getLinkIndex(): Promise<LinkIndex> {
  if (cache) return cache;
  return buildLinkIndex();
}

export function invalidateLinkIndex() {
  cache = null;
}

function resolveWikiLinkInIndex(
  target: string,
  fromPath: string,
  docs: Map<string, DocIndexEntry>,
  byBasename: Map<string, string[]>,
  byAlias: Map<string, string>,
): { path: string | null; title: string; broken: boolean } {
  const t = stripRef(target);
  if (!t) return { path: null, title: target, broken: true };

  const withExt = t.endsWith(".md") ? t : `${t}.md`;
  const fromDir = path.dirname(fromPath).replace(/\\/g, "/");

  const candidates: string[] = [];
  if (fromDir && fromDir !== ".") {
    candidates.push(path.posix.normalize(`${fromDir}/${withExt}`));
  }
  candidates.push(withExt);
  candidates.push(path.posix.normalize(withExt));

  for (const c of candidates) {
    const norm = c.replace(/^\.\//, "");
    if (docs.has(norm)) {
      return { path: norm, title: docs.get(norm)!.title, broken: false };
    }
  }

  const base = path.basename(withExt, ".md").toLowerCase();
  const paths = byBasename.get(base);
  if (paths?.length === 1) {
    return { path: paths[0], title: docs.get(paths[0])!.title, broken: false };
  }

  const aliasPath = byAlias.get(t.toLowerCase());
  if (aliasPath && docs.has(aliasPath)) {
    return { path: aliasPath, title: docs.get(aliasPath)!.title, broken: false };
  }

  return { path: null, title: t, broken: true };
}

export async function resolveWikiLink(
  target: string,
  fromPath?: string,
): Promise<{ path: string | null; title: string; broken: boolean }> {
  const idx = await getLinkIndex();
  return resolveWikiLinkInIndex(target, fromPath || "", idx.docs, idx.byBasename, idx.byAlias);
}

export async function getLinksForDoc(docPath: string): Promise<{ outgoing: LinkRef[]; backlinks: LinkRef[] }> {
  const idx = await getLinkIndex();
  const doc = idx.docs.get(docPath);
  const outgoing: LinkRef[] = [];

  if (doc) {
    for (const target of doc.wikiLinks) {
      const resolved = resolveWikiLinkInIndex(target, docPath, idx.docs, idx.byBasename, idx.byAlias);
      outgoing.push({
        target,
        path: resolved.path || "",
        title: resolved.title,
        broken: resolved.broken,
      });
    }
  }

  const backPaths = idx.backlinks.get(docPath) || new Set();
  const backlinks: LinkRef[] = [...backPaths].map((p) => ({
    target: p,
    path: p,
    title: idx.docs.get(p)?.title || path.basename(p, ".md"),
  }));

  return { outgoing, backlinks };
}
