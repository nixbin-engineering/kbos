import matter from "gray-matter";
import path from "path";
import type { AISettings } from "../settings";
import { readDoc, searchDocs, walkPlainDocs } from "../vault";
import { embedText } from "./provider";
import { queryVectors } from "./vector-store";

export type ChatScope = "vault" | "folder" | "document";

export type RetrievedChunk = {
  path: string;
  title: string;
  excerpt: string;
};

const MAX_CONTEXT_CHARS = 14000;
const EXCERPT_LEN = 2400;

// Common words that add no retrieval value
const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "i","my","me","we","our","you","your","it","its","this","that","these","those",
  "what","which","who","whom","where","when","why","how","all","any","both",
  "each","few","more","most","other","some","such","no","nor","not","only",
  "own","same","so","than","too","very","just","about","about","across","after",
  "and","as","at","by","for","from","in","into","of","on","or","over","per",
  "to","up","with","within","without","please","tell","show","find","list","give",
  "make","get","let","does","vault","note","notes","folder","file","kb","kbos",
]);

/** Extract meaningful keywords from a natural-language query. */
function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function inFolder(docPath: string, folderRel: string): boolean {
  if (folderRel === "") return true;
  return docPath === folderRel || docPath.startsWith(`${folderRel}/`);
}

function excerptAroundQuery(body: string, query: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const idx = flat.toLowerCase().indexOf(query.toLowerCase().slice(0, 80));
  if (idx < 0) return flat.slice(0, EXCERPT_LEN);
  const start = Math.max(0, idx - 400);
  return flat.slice(start, start + EXCERPT_LEN);
}

/** Score a doc body against a set of keywords (higher = more relevant). */
function scoreDoc(title: string, body: string, keywords: string[]): number {
  const hay = `${title} ${body}`.toLowerCase();
  return keywords.reduce((sum, kw) => {
    const re = new RegExp(`\\b${kw}\\b`, "g");
    const matches = (hay.match(re) || []).length;
    return sum + matches;
  }, 0);
}

export async function retrieveContext(
  query: string,
  scope: ChatScope,
  scopePath: string | null,
  aiSettings?: AISettings | null,
  limit = 10,
): Promise<RetrievedChunk[]> {
  const q = query.trim();
  if (!q) return [];

  const folder = scopePath?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") ?? "";
  const keywords = extractKeywords(q);
  const paths = new Set<string>();
  const chunks: RetrievedChunk[] = [];

  const addDoc = async (rel: string, preferText?: string) => {
    if (paths.has(rel)) return;
    paths.add(rel);
    try {
      const doc = await readDoc(rel);
      const title = doc.meta.title || path.basename(rel, ".md");
      const excerpt = preferText
        ? excerptAroundQuery(doc.body, preferText)
        : doc.body.replace(/\s+/g, " ").trim().slice(0, EXCERPT_LEN);
      chunks.push({ path: rel, title, excerpt });
    } catch {
      /* skip missing */
    }
  };

  // --- Document scope: just the open note ---
  if (scope === "document" && scopePath) {
    await addDoc(scopePath, q);
    return chunks;
  }

  // --- Vector (semantic) retrieval when embed model is configured ---
  const hasEmbedModel = Boolean(aiSettings?.embed_model?.trim());
  if (hasEmbedModel && aiSettings) {
    try {
      const queryEmbedding = await embedText(aiSettings, q);
      const folderFilter = scope === "folder" ? folder : undefined;
      const vectorHits = await queryVectors(queryEmbedding, limit, folderFilter);

      for (const hit of vectorHits) {
        if (paths.has(hit.path)) continue;
        paths.add(hit.path);
        // Use the matched chunk text as the excerpt (it's already the relevant part)
        chunks.push({ path: hit.path, title: hit.title, excerpt: hit.text });
        if (chunks.length >= limit) break;
      }
    } catch (e) {
      // Vector retrieval failed (index not built, network error, etc.)
      // Fall through to keyword search
      console.warn("Vector retrieval failed, falling back to keyword search:", e);
    }
  }

  // --- Keyword search: fill remaining slots ---
  if (chunks.length < limit) {
    const searchQueries = [q, ...keywords.slice(0, 4)];
    const hitPaths = new Set<string>();
    for (const sq of searchQueries) {
      if (!sq) continue;
      const hits = await searchDocs(sq, limit * 4);
      for (const hit of hits) {
        if (scope === "folder" && !inFolder(hit.path, folder)) continue;
        if (!paths.has(hit.path)) hitPaths.add(hit.path);
      }
      if (hitPaths.size >= (limit - chunks.length) * 2) break;
    }
    for (const p of hitPaths) {
      await addDoc(p, q);
      if (chunks.length >= limit) break;
    }
  }

  // --- Filesystem fallback: when both vector + keyword search yield too few results ---
  if (chunks.length < Math.min(limit, 4)) {
    type Candidate = { rel: string; score: number };
    const candidates: Candidate[] = [];

    await walkPlainDocs(async (rel, raw) => {
      if (paths.has(rel)) return;
      if (scope === "folder" && !inFolder(rel, folder)) return;
      const { data, content } = matter(raw);
      const title = (data.title as string) || path.basename(rel, ".md");
      const score = keywords.length > 0 ? scoreDoc(title, content, keywords) : 1;
      if (score > 0 || chunks.length === 0) candidates.push({ rel, score });
    });

    candidates.sort((a, b) => b.score - a.score);
    for (const { rel } of candidates.slice(0, limit - chunks.length)) {
      await addDoc(rel, q);
    }
  }

  // Always include folder index page for folder scope
  if (scope === "folder") {
    const indexPath = folder ? `${folder}/index.md` : "index.md";
    if (!paths.has(indexPath)) await addDoc(indexPath, q);
  }

  // Trim to context budget
  let total = 0;
  return chunks.filter((c) => {
    const len = c.excerpt.length + c.title.length + c.path.length;
    if (total + len > MAX_CONTEXT_CHARS) return false;
    total += len;
    return true;
  });
}

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(No matching notes in knowledge base.)";
  return chunks
    .map(
      (c, i) =>
        `## Source ${i + 1}: ${c.title}\nPath: ${c.path}\n\n${c.excerpt}`,
    )
    .join("\n\n---\n\n");
}

export function extractCitationPaths(text: string): string[] {
  const paths = new Set<string>();
  const linkRe = /\]\(([^)]+\.md)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text))) {
    paths.add(m[1].replace(/^\.\//, ""));
  }
  return [...paths];
}
