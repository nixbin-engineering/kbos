import path from "path";

export function docFolderRel(docPath: string): string {
  const normalized = docPath.replace(/\\/g, "/");
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "" : dir;
}

export function fileApiUrl(docsRelPath: string): string {
  return `/api/files/${docsRelPath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;
}

/** Resolve markdown image src relative to a note path. */
export function resolveImageSrc(docPath: string | undefined, src: string): string {
  if (!src || /^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  const normalized = src.replace(/^\.\//, "");
  const docDir = docFolderRel(docPath || "");
  const full = docDir ? `${docDir}/${normalized}` : normalized;
  return fileApiUrl(full.replace(/\\/g, "/"));
}

export function sanitizeAttachmentsSubdir(s: string): string {
  const t = s
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "");
  return t || "attachments";
}

export function attachmentDirRel(docPath: string, subdir: string): string {
  const folder = docFolderRel(docPath);
  const clean = sanitizeAttachmentsSubdir(subdir);
  return folder ? `${folder}/${clean}` : clean;
}
