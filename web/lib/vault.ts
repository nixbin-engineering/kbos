import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { DocMeta, DocResponse, FolderIndex, FolderIndexEntry, SearchHit, TemplateEntry, TreeNode } from "./types";
import { kbDecryptToMemory } from "./kb-runner";
import { mergeTags } from "./tags";

const VAULT_PATH = process.env.VAULT_PATH || "/vault";

export function vaultRoot(): string {
  return path.resolve(VAULT_PATH);
}

export function isEncryptedNotePath(rel: string): boolean {
  return rel.endsWith(".md.enc");
}

export function encryptedNotePath(rel: string): string {
  if (isEncryptedNotePath(rel)) return rel;
  if (rel.endsWith(".md")) return `${rel}.enc`;
  return `${rel}.md.enc`;
}

export function plainNotePath(rel: string): string {
  if (isEncryptedNotePath(rel)) return rel.slice(0, -4);
  return rel;
}

export function docsDir(): string {
  return path.join(vaultRoot(), "docs");
}

export function safeDocPath(rel: string): string {
  // Strip null bytes, then resolve to an absolute path and verify it stays inside docsDir.
  // Using path.resolve (not path.join + regex) to correctly handle all traversal variants.
  const sanitized = rel.replace(/\0/g, "");
  const docs = docsDir();
  const full = path.resolve(docs, sanitized);
  if (full !== docs && !full.startsWith(docs + path.sep)) {
    throw new Error("path outside docs");
  }
  return full;
}

export function safeVaultPath(base: string, rel: string): string {
  const sanitized = rel.replace(/\0/g, "");
  const full = path.resolve(base, sanitized);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error("path outside vault");
  }
  return full;
}

export async function listTree(hideDir?: string): Promise<TreeNode> {
  return buildTree(docsDir(), "", hideDir);
}

async function buildTree(absDir: string, rel: string, hideDir?: string): Promise<TreeNode> {
  const name = rel ? path.basename(rel) : "docs";
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const children: TreeNode[] = [];

  const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));
  const fileNames = new Set(files.map((f) => f.name));

  for (const d of dirs) {
    if (hideDir && d.name === hideDir) continue;
    const childRel = rel ? `${rel}/${d.name}` : d.name;
    children.push(await buildTree(path.join(absDir, d.name), childRel, hideDir));
  }
  for (const f of files) {
    const childRel = rel ? `${rel}/${f.name}` : f.name;
    if (f.name.endsWith(".md.enc")) {
      const display = f.name.replace(/\.enc$/, "");
      children.push({ name: display, path: childRel, type: "file", encrypted: true });
      continue;
    }
    if (f.name.endsWith(".md") && !fileNames.has(`${f.name}.enc`)) {
      children.push({ name: f.name, path: childRel, type: "file", encrypted: false });
    }
  }

  return { name, path: rel || "", type: "dir", children };
}

export class EncryptedDocError extends Error {
  constructor() {
    super("encrypted");
    this.name = "EncryptedDocError";
  }
}

export async function readDoc(rel: string, passphrase?: string | null): Promise<DocResponse> {
  const plainRel = plainNotePath(rel).replace(/\\/g, "/");
  const encRel = encryptedNotePath(plainRel);

  let hasEnc = false;
  let hasPlain = false;
  try {
    await fs.access(safeDocPath(encRel));
    hasEnc = true;
  } catch {
    /* no enc */
  }
  try {
    await fs.access(safeDocPath(plainRel));
    hasPlain = true;
  } catch {
    /* no plain */
  }

  if (!hasEnc && !hasPlain) throw new Error("not found");

  let raw: string;
  let storedPath = plainRel;

  if (hasEnc) {
    if (!passphrase) throw new EncryptedDocError();
    raw = await kbDecryptToMemory(encRel, passphrase);
    storedPath = encRel;
  } else {
    raw = await fs.readFile(safeDocPath(plainRel), "utf8");
  }

  const { data, content } = matter(raw);
  const meta = data as DocMeta;
  let title = meta.title;
  if (!title) {
    const m = content.match(/^#\s+(.+)$/m);
    title = m ? m[1].trim() : path.basename(plainRel, ".md");
  }
  return {
    path: plainRel,
    meta: { ...meta, title, tags: mergeTags(meta.tags, content) },
    body: content,
    raw,
    encrypted: hasEnc,
  };
}

export async function writeDoc(rel: string, raw: string): Promise<void> {
  if (isEncryptedNotePath(rel)) {
    throw new Error("cannot edit encrypted note — decrypt first");
  }
  const enc = encryptedNotePath(rel);
  try {
    await fs.access(safeDocPath(enc));
    throw new Error("cannot edit encrypted note — decrypt first");
  } catch (e) {
    if (e instanceof Error && e.message.includes("decrypt first")) throw e;
  }
  const full = safeDocPath(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, raw, "utf8");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultNoteContent(title: string): string {
  const t = todayISO();
  return `---
title: ${title}
tags: []
status: draft
created: ${t}
updated: ${t}
---

# ${title}

`;
}

export function defaultIndexContent(title: string): string {
  const t = todayISO();
  return `---
title: ${title}
tags: []
status: active
created: ${t}
updated: ${t}
---

# ${title}

Folder index page. Child notes and subfolders appear in the **Contents** panel.

## Overview

Add a description of this folder here.

`;
}

export async function createDoc(rel: string, raw?: string): Promise<DocResponse> {
  let pathRel = rel.replace(/\\/g, "/").trim();
  if (!pathRel.endsWith(".md")) pathRel += ".md";
  safeDocPath(pathRel);
  const full = safeDocPath(pathRel);
  try {
    await fs.access(full);
    throw new Error("file already exists");
  } catch (e) {
    if (e instanceof Error && e.message === "file already exists") throw e;
  }
  const base = path.basename(pathRel, ".md");
  const content = raw ?? defaultNoteContent(base.replace(/-/g, " "));
  await writeDoc(pathRel, content);
  return readDoc(pathRel);
}

export async function createFolder(rel: string, withIndex = true): Promise<{ path: string; indexPath?: string }> {
  const folderRel = rel.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const dirPath = folderRel ? path.join(docsDir(), folderRel) : docsDir();
  if (!dirPath.startsWith(docsDir())) {
    throw new Error("path outside docs");
  }
  await fs.mkdir(dirPath, { recursive: true });
  let indexPath: string | undefined;
  if (withIndex) {
    const indexRel = folderRel ? `${folderRel}/index.md` : "index.md";
    const indexFull = path.join(docsDir(), indexRel);
    try {
      await fs.access(indexFull);
    } catch {
      const title = folderRel ? path.basename(folderRel) : "Index";
      await writeDoc(indexRel, defaultIndexContent(title));
      indexPath = indexRel;
    }
  }
  return { path: folderRel, indexPath };
}

function folderIndexPath(folderRel: string): string {
  return folderRel ? `${folderRel}/index.md` : "index.md";
}

export async function getFolderIndex(folderRel: string): Promise<FolderIndex> {
  const folder = folderRel.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const dirPath = folder ? path.join(docsDir(), folder) : docsDir();
  if (!dirPath.startsWith(docsDir())) {
    throw new Error("path outside docs");
  }

  const indexRel = folderIndexPath(folder);
  let indexDoc: DocResponse | null = null;
  try {
    await fs.access(safeDocPath(indexRel));
    indexDoc = await readDoc(indexRel);
  } catch {
    /* no index */
  }

  const entries = await listFolderEntries(dirPath, folder);
  const folderTitle = folder ? path.basename(folder) : "docs";

  return { folder, folderTitle, indexPath: indexDoc ? indexRel : null, indexDoc, entries };
}

async function listFolderEntries(dirPath: string, folderRel: string): Promise<FolderIndexEntry[]> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: FolderIndexEntry[] = [];
  const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "index.md")
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const d of dirs) {
    const childRel = folderRel ? `${folderRel}/${d.name}` : d.name;
    out.push({ path: childRel, name: d.name, title: d.name, type: "dir" });
  }

  for (const f of files) {
    const childRel = folderRel ? `${folderRel}/${f.name}` : f.name;
    let title = f.name.replace(/\.md$/, "");
    let snippet: string | undefined;
    try {
      const doc = await readDoc(childRel);
      title = doc.meta.title || title;
      snippet = doc.body.replace(/\s+/g, " ").trim().slice(0, 120);
    } catch {
      /* ignore */
    }
    out.push({ path: childRel, name: f.name, title, type: "file", snippet });
  }

  return out;
}

export function templatesDir(): string {
  return path.join(vaultRoot(), "templates");
}

function safeTemplatePath(rel: string): string {
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(templatesDir(), normalized);
  const root = templatesDir();
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error("path outside templates");
  }
  return full;
}

export async function listTemplates(): Promise<TemplateEntry[]> {
  const root = templatesDir();
  const out: TemplateEntry[] = [];
  try {
    await walkTemplates(root, "", out);
  } catch {
    /* missing dir */
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function walkTemplates(dir: string, rel: string, out: TemplateEntry[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walkTemplates(abs, childRel, out);
    else if (e.isFile() && e.name.endsWith(".md")) {
      out.push({ path: childRel.replace(/\\/g, "/"), name: e.name.replace(/\.md$/, ""), category: rel ? rel.split("/")[0] : "general" });
    }
  }
}

export function substituteTemplateVars(content: string, title: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const datetime = now.toISOString();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const week = String(getISOWeek(now)).padStart(2, "0");
  const uuid = crypto.randomUUID();

  return content
    .replaceAll("{{title}}", title)
    .replaceAll("{{date}}", date)
    .replaceAll("{{datetime}}", datetime)
    .replaceAll("{{year}}", year)
    .replaceAll("{{month}}", month)
    .replaceAll("{{week}}", week)
    .replaceAll("{{uuid}}", uuid)
    .replaceAll("{{cursor}}", "");
}

function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function readTemplate(rel: string): Promise<string> {
  return fs.readFile(safeTemplatePath(rel), "utf8");
}

export function drawingNoteContent(title: string): string {
  const t = todayISO();
  return `---
title: ${title}
tags:
  - drawing
status: draft
created: ${t}
updated: ${t}
---

# ${title}

\`\`\`mermaid
flowchart TB
  A[Start] --> B{Sketch idea}
  B --> C[Refine]
  C --> D[Done]
\`\`\`

`;
}

export async function createFromTemplate(parentRel: string, name: string, templateRel: string): Promise<DocResponse> {
  const title = name.replace(/-/g, " ");
  const tpl = await readTemplate(templateRel);
  const raw = substituteTemplateVars(tpl, title);
  const rel = parentRel ? `${parentRel}/${name}` : name;
  return createDoc(rel, raw);
}

export async function deleteDoc(rel: string): Promise<void> {
  const target = isEncryptedNotePath(rel) ? rel : rel;
  await fs.unlink(safeDocPath(target));
}

export async function deleteFolder(rel: string): Promise<void> {
  const folderRel = rel.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!folderRel) throw new Error("cannot delete docs root");
  const dirPath = path.join(docsDir(), folderRel);
  if (!dirPath.startsWith(docsDir() + path.sep)) throw new Error("path outside docs");
  await fs.rm(dirPath, { recursive: true, force: true });
}

export type TagCount = { tag: string; count: number };

export async function listAllTags(): Promise<TagCount[]> {
  const counts = new Map<string, number>();
  await walkMd(docsDir(), "", async (rel, raw) => {
    const { data, content } = matter(raw);
    for (const t of mergeTags(Array.isArray(data.tags) ? (data.tags as string[]) : undefined, content)) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  });
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function searchDocs(query: string, limit = 30): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  await walkMd(docsDir(), "", async (rel, raw) => {
    const { data, content } = matter(raw);
    const title = (data.title as string) || path.basename(rel, ".md");
    const tags = mergeTags(Array.isArray(data.tags) ? (data.tags as string[]) : undefined, content);
    const hay = `${title} ${tags.join(" ")} ${content}`.toLowerCase();

    const parsed = parseQuery(q);
    if (parsed.tag && !tags.includes(parsed.tag) && !hay.includes(parsed.tag)) return;
    if (parsed.folder && !rel.toLowerCase().startsWith(parsed.folder)) return;
    if (parsed.status && (data.status as string)?.toLowerCase() !== parsed.status) return;
    if (parsed.title && !title.toLowerCase().includes(parsed.title)) return;
    if (parsed.text && !hay.includes(parsed.text)) return;
    if (!parsed.tag && !parsed.folder && !parsed.status && !parsed.title && !parsed.text && !hay.includes(q)) return;

    const idx = content.toLowerCase().indexOf(parsed.text || q);
    let snippet = content.slice(0, 120).replace(/\n/g, " ");
    if (idx >= 0) snippet = content.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, " ");

    hits.push({ path: rel, title, snippet });
  });

  hits.sort((a, b) => a.title.localeCompare(b.title));
  return hits.slice(0, limit);
}

function parseQuery(q: string) {
  const parts = q.split(/\s+/);
  const out: Record<string, string> = { text: "" };
  const text: string[] = [];
  for (const p of parts) {
    if (p.startsWith("tag:")) out.tag = p.slice(4).toLowerCase();
    else if (p.startsWith("folder:")) out.folder = p.slice(7).toLowerCase();
    else if (p.startsWith("title:")) out.title = p.slice(6).toLowerCase();
    else if (p.startsWith("status:")) out.status = p.slice(7).toLowerCase();
    else text.push(p);
  }
  out.text = text.join(" ").toLowerCase();
  return out as { tag: string; folder: string; title: string; status: string; text: string };
}

async function walkMd(dir: string, rel: string, fn: (rel: string, raw: string) => Promise<void>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await walkMd(abs, childRel, fn);
    else if (e.isFile() && e.name.endsWith(".md") && !e.name.endsWith(".md.enc")) {
      await fn(childRel.replace(/\\/g, "/"), await fs.readFile(abs, "utf8"));
    }
  }
}

export async function walkPlainDocs(fn: (rel: string, raw: string) => Promise<void>): Promise<void> {
  await walkMd(docsDir(), "", fn);
}

/**
 * Attempt to decrypt an encrypted doc with the given passphrase.
 * Throws if the passphrase is wrong or the file doesn't exist.
 * Used to validate passphrases at unlock time without reading plaintext into the session.
 */
export async function readEncryptedDoc(rel: string, passphrase: string): Promise<void> {
  const encRel = encryptedNotePath(plainNotePath(rel));
  await kbDecryptToMemory(encRel, passphrase); // throws on wrong passphrase
}

export async function vaultReady(): Promise<{ ok: boolean; message: string }> {
  try {
    await fs.access(path.join(vaultRoot(), "config", "kb.yaml"));
    await fs.access(docsDir());
    return { ok: true, message: "vault ready" };
  } catch {
    return { ok: false, message: "vault not initialized — waiting for init service" };
  }
}
