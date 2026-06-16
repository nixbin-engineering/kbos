import fs from "fs/promises";
import path from "path";
import type { GraphData, GraphEdge, GraphNode } from "./types";
import { buildLinkIndex, resolveWikiLink } from "./links";
import { vaultRoot } from "./vault";

function graphCachePath(): string {
  return path.join(vaultRoot(), ".kb", "graph", "links.json");
}

export async function loadGraphCache(): Promise<GraphData | null> {
  try {
    const raw = await fs.readFile(graphCachePath(), "utf8");
    return JSON.parse(raw) as GraphData;
  } catch {
    return null;
  }
}

export async function saveGraphCache(data: GraphData): Promise<void> {
  const p = graphCachePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data), "utf8");
}

export async function buildGraph(): Promise<GraphData> {
  const idx = await buildLinkIndex();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  for (const [docPath, doc] of idx.docs) {
    nodeIds.add(docPath);
    nodes.push({
      id: docPath,
      title: doc.title,
      folder: doc.folder,
      tags: [],
    });
  }

  const seenEdges = new Set<string>();
  const addEdge = (from: string, to: string) => {
    const key = [from, to].sort().join("\0");
    if (!seenEdges.has(key)) { seenEdges.add(key); edges.push({ from, to }); }
  };

  for (const [fromPath, doc] of idx.docs) {
    for (const target of doc.wikiLinks) {
      const resolved = await resolveWikiLink(target, fromPath);
      if (resolved.path && !resolved.broken) addEdge(fromPath, resolved.path);
    }
  }

  // Add folder-co-location edges for notes without wikilinks (max 3 per note)
  const byFolder = new Map<string, string[]>();
  for (const node of nodes) {
    const f = node.folder || "__root__";
    const arr = byFolder.get(f) ?? [];
    arr.push(node.id);
    byFolder.set(f, arr);
  }
  for (const [, members] of byFolder) {
    if (members.length < 2 || members.length > 30) continue;
    for (let a = 0; a < members.length; a++) {
      for (let b = a + 1; b < members.length && b <= a + 3; b++) {
        addEdge(members[a], members[b]);
      }
    }
  }

  const data = { nodes, edges };
  await saveGraphCache(data);
  return data;
}

export async function getGraph(rebuild = false): Promise<GraphData> {
  if (!rebuild) {
    const cached = await loadGraphCache();
    if (cached) return cached;
  }
  return buildGraph();
}

export function neighborhood(data: GraphData, centerPath: string | null, limit = 200): GraphData {
  if (!centerPath) {
    return {
      nodes: data.nodes.slice(0, limit),
      edges: data.edges.filter(
        (e) =>
          data.nodes.slice(0, limit).some((n) => n.id === e.from) &&
          data.nodes.slice(0, limit).some((n) => n.id === e.to),
      ),
    };
  }

  const related = new Set<string>([centerPath]);
  for (const e of data.edges) {
    if (e.from === centerPath) related.add(e.to);
    if (e.to === centerPath) related.add(e.from);
  }
  for (const e of data.edges) {
    if (related.has(e.from)) related.add(e.to);
    if (related.has(e.to)) related.add(e.from);
  }

  const ids = [...related].slice(0, limit);
  const idSet = new Set(ids);
  return {
    nodes: data.nodes.filter((n) => idSet.has(n.id)),
    edges: data.edges.filter((e) => idSet.has(e.from) && idSet.has(e.to)),
  };
}
