import fs from "fs/promises";
import path from "path";
import {
  attachmentDirRel,
  fileApiUrl,
  sanitizeAttachmentsSubdir,
} from "./attachments-client";
import { loadSettings } from "./settings";
import { docsDir } from "./vault";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export { sanitizeAttachmentsSubdir, attachmentDirRel, fileApiUrl } from "./attachments-client";

export function safeDocsFilePath(rel: string): string {
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "").replace(/\\/g, "/");
  const full = path.join(docsDir(), normalized);
  const docs = docsDir();
  if (!full.startsWith(docs + path.sep) && full !== docs) {
    throw new Error("path outside docs");
  }
  return full;
}

export function isAllowedImage(filename: string): boolean {
  return ALLOWED_EXT.has(path.extname(filename).toLowerCase());
}

export function mimeForFile(filename: string): string {
  return MIME[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return (base || "image") + ext;
}

async function uniqueFilename(dirAbs: string, filename: string): Promise<string> {
  const clean = sanitizeFilename(filename);
  const ext = path.extname(clean);
  const stem = path.basename(clean, ext);
  let candidate = clean;
  let n = 1;
  while (true) {
    try {
      await fs.access(path.join(dirAbs, candidate));
      n += 1;
      candidate = `${stem}-${n}${ext}`;
    } catch {
      return candidate;
    }
  }
}

export type UploadResult = {
  path: string;
  filename: string;
  markdown: string;
  url: string;
};

export async function saveAttachmentForDoc(
  docPath: string,
  filename: string,
  data: Buffer,
): Promise<UploadResult> {
  if (data.length > MAX_BYTES) {
    throw new Error(`file too large (max ${MAX_BYTES / 1024 / 1024}MB)`);
  }
  if (!isAllowedImage(filename)) {
    throw new Error("unsupported image type (use jpg, png, gif, webp, or svg)");
  }

  const settings = await loadSettings();
  const subdir = settings.ui.attachments_subdir;
  const dirRel = attachmentDirRel(docPath, subdir);
  const dirAbs = safeDocsFilePath(dirRel);
  await fs.mkdir(dirAbs, { recursive: true });

  const unique = await uniqueFilename(dirAbs, filename);
  const fileRel = `${dirRel}/${unique}`.replace(/\\/g, "/");
  await fs.writeFile(safeDocsFilePath(fileRel), data);

  const markdownRel = `${subdir}/${unique}`;
  return {
    path: fileRel,
    filename: unique,
    markdown: `![${path.basename(unique, path.extname(unique))}](${markdownRel})`,
    url: fileApiUrl(fileRel),
  };
}
