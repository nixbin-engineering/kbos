import fs from "fs/promises";
import path from "path";
import { vaultRoot } from "../vault";

export type VectorEntry = {
  path: string;       // doc relative path
  title: string;
  chunkIdx: number;
  text: string;       // chunk text used for context
  embedding: number[];
  updatedAt: string;
};

type VectorIndex = {
  version: number;
  entries: VectorEntry[];
};

function indexPath(): string {
  return path.join(vaultRoot(), ".kb", "vectors", "index.json");
}

let cache: VectorIndex | null = null;

export async function loadVectorIndex(): Promise<VectorIndex> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(indexPath(), "utf8");
    cache = JSON.parse(raw) as VectorIndex;
    return cache;
  } catch {
    return { version: 1, entries: [] };
  }
}

export async function saveVectorIndex(idx: VectorIndex): Promise<void> {
  const dir = path.dirname(indexPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(indexPath(), JSON.stringify(idx), "utf8");
  cache = idx;
}

export function invalidateVectorCache(): void {
  cache = null;
}

/** Remove all chunks for a given doc path. */
export async function removeDocVectors(docPath: string): Promise<void> {
  const idx = await loadVectorIndex();
  idx.entries = idx.entries.filter((e) => e.path !== docPath);
  await saveVectorIndex(idx);
}

/** Replace all chunks for a given doc with new embeddings. */
export async function upsertDocVectors(
  docPath: string,
  title: string,
  chunks: { text: string; embedding: number[] }[],
): Promise<void> {
  const idx = await loadVectorIndex();
  // Remove old entries for this doc
  idx.entries = idx.entries.filter((e) => e.path !== docPath);
  const updatedAt = new Date().toISOString();
  for (let i = 0; i < chunks.length; i++) {
    idx.entries.push({
      path: docPath,
      title,
      chunkIdx: i,
      text: chunks[i].text,
      embedding: chunks[i].embedding,
      updatedAt,
    });
  }
  await saveVectorIndex(idx);
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export type VectorHit = {
  path: string;
  title: string;
  text: string;       // best-matching chunk text
  score: number;
};

/**
 * Find top-k most similar document chunks to the query embedding.
 * Returns one hit per unique path (highest-scoring chunk).
 */
export async function queryVectors(
  queryEmbedding: number[],
  topK = 10,
  folderFilter?: string,
): Promise<VectorHit[]> {
  const idx = await loadVectorIndex();
  if (idx.entries.length === 0) return [];

  // Score every chunk
  const scored = idx.entries
    .filter((e) => {
      if (!folderFilter) return true;
      if (folderFilter === "") return true;
      return e.path === folderFilter || e.path.startsWith(`${folderFilter}/`);
    })
    .map((e) => ({ entry: e, score: cosine(queryEmbedding, e.embedding) }));

  // Keep only best chunk per path
  const bestByPath = new Map<string, { entry: VectorEntry; score: number }>();
  for (const s of scored) {
    const existing = bestByPath.get(s.entry.path);
    if (!existing || s.score > existing.score) {
      bestByPath.set(s.entry.path, s);
    }
  }

  return [...bestByPath.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ entry, score }) => ({
      path: entry.path,
      title: entry.title,
      text: entry.text,
      score,
    }));
}

export async function vectorIndexStats(): Promise<{ docCount: number; chunkCount: number; sizeBytes: number }> {
  const idx = await loadVectorIndex();
  const paths = new Set(idx.entries.map((e) => e.path));
  let sizeBytes = 0;
  try {
    const stat = await fs.stat(indexPath());
    sizeBytes = stat.size;
  } catch { /* ignore */ }
  return { docCount: paths.size, chunkCount: idx.entries.length, sizeBytes };
}

/** Split a doc body into overlapping text chunks for embedding. */
export function chunkText(body: string, maxChars = 1600, overlapChars = 200): string[] {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      // Carry overlap from end of current chunk
      const words = current.split(/\s+/);
      let overlap = "";
      for (let i = words.length - 1; i >= 0 && overlap.length < overlapChars; i--) {
        overlap = words[i] + (overlap ? " " + overlap : "");
      }
      current = overlap + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim().length > 40) chunks.push(current.trim());

  // Fallback for docs with no paragraph breaks
  if (chunks.length === 0 && body.trim().length > 0) {
    let pos = 0;
    while (pos < body.length) {
      chunks.push(body.slice(pos, pos + maxChars).trim());
      pos += maxChars - overlapChars;
    }
  }

  return chunks.filter((c) => c.length > 40);
}
