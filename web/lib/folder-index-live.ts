import type { FolderIndex, FolderIndexEntry, TreeNode } from "./types";

export function findTreeNode(tree: TreeNode | null, relPath: string): TreeNode | null {
  if (!tree) return null;
  const target = relPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (target === "" || target === tree.path) return tree;
  if (!tree.children) return null;

  const walk = (nodes: TreeNode[]): TreeNode | null => {
    for (const node of nodes) {
      if (node.path === target) return node;
      if (node.type === "dir" && node.children && target.startsWith(`${node.path}/`)) {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(tree.children);
}

export function liveFolderEntries(
  tree: TreeNode | null,
  folderRel: string,
  cached: FolderIndex | null,
): FolderIndexEntry[] {
  const folderNode = findTreeNode(tree, folderRel);
  if (!folderNode?.children?.length) {
    return cached?.entries ?? [];
  }

  const cachedByPath = new Map((cached?.entries ?? []).map((e) => [e.path, e]));
  const dirs: FolderIndexEntry[] = [];
  const files: FolderIndexEntry[] = [];

  for (const child of folderNode.children) {
    if (child.type === "file" && child.name === "index.md") continue;
    const prev = cachedByPath.get(child.path);
    const entry: FolderIndexEntry = {
      path: child.path,
      name: child.name,
      title:
        prev?.title ??
        (child.type === "dir" ? child.name : child.name.replace(/\.md$/, "")),
      type: child.type,
      snippet: prev?.snippet,
    };
    if (child.type === "dir") dirs.push(entry);
    else files.push(entry);
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

export function mergeLiveFolderIndex(
  cached: FolderIndex | null,
  tree: TreeNode | null,
  folderRel: string,
): FolderIndex | null {
  if (!cached && !tree) return null;

  const folder = folderRel.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const entries = liveFolderEntries(tree, folder, cached);
  const folderTitle =
    cached?.folderTitle ?? (folder ? pathBasename(folder) : "docs");

  return {
    folder,
    folderTitle,
    indexPath: cached?.indexPath ?? null,
    indexDoc: cached?.indexDoc ?? null,
    entries,
  };
}

function pathBasename(p: string): string {
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}
