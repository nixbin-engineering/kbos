import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { isAuthError, requireAdmin, requireAuth } from "@/lib/require-auth";
import { vaultRoot } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const root = vaultRoot();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `kbos-backup-${timestamp}.tar.gz`;

  // Tar the docs and config directories, excluding the .kb cache
  const tar = spawn("tar", [
    "-czf", "-",
    "--exclude=.kb",
    "-C", root,
    "docs",
    ...(await dirExists(path.join(root, "config")) ? ["config"] : []),
  ]);

  const chunks: Buffer[] = [];
  let error = "";

  const data = await new Promise<Buffer | null>((resolve) => {
    tar.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    tar.stderr.on("data", (d: Buffer) => { error += d.toString(); });
    tar.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else resolve(null);
    });
    tar.on("error", () => resolve(null));
  });

  if (!data) {
    return NextResponse.json({ error: error || "backup failed" }, { status: 500 });
  }

  return new Response(data as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(data.length),
    },
  });
}

async function dirExists(p: string): Promise<boolean> {
  const { stat } = await import("fs/promises");
  return stat(p).then(() => true).catch(() => false);
}
