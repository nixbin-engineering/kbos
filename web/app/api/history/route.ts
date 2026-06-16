import { spawn } from "child_process";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { docsDir, safeDocPath } from "@/lib/vault";

type Commit = { hash: string; date: string; message: string; author: string };

async function gitLog(absPath: string, repoRoot: string): Promise<Commit[]> {
  return new Promise((resolve) => {
    const proc = spawn(
      "git",
      ["log", "--follow", "--format=%H\x1f%ai\x1f%s\x1f%an", "--", absPath],
      { cwd: repoRoot },
    );
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const commits = out.trim().split("\n").filter(Boolean).map((line) => {
        const [hash, date, message, author] = line.split("\x1f");
        return { hash: hash ?? "", date: date ?? "", message: message ?? "", author: author ?? "" };
      });
      resolve(commits);
    });
    proc.on("error", () => resolve([]));
  });
}

async function gitShow(hash: string, absPath: string, repoRoot: string): Promise<string | null> {
  return new Promise((resolve) => {
    const relToRepo = path.relative(repoRoot, absPath);
    const proc = spawn("git", ["show", `${hash}:${relToRepo}`], { cwd: repoRoot });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", (code) => resolve(code === 0 ? out : null));
    proc.on("error", () => resolve(null));
  });
}

async function findGitRoot(dir: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("git", ["rev-parse", "--show-toplevel"], { cwd: dir });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", (code) => resolve(code === 0 ? out.trim() : null));
    proc.on("error", () => resolve(null));
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const docPath = url.searchParams.get("path");
  const hash = url.searchParams.get("hash");

  if (!docPath) return NextResponse.json({ error: "path required" }, { status: 400 });

  try {
    const absPath = safeDocPath(docPath);
    const repoRoot = await findGitRoot(docsDir());
    if (!repoRoot) return NextResponse.json({ commits: [], gitAvailable: false });

    if (hash) {
      const content = await gitShow(hash, absPath, repoRoot);
      if (content === null) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ content });
    }

    const commits = await gitLog(absPath, repoRoot);
    return NextResponse.json({ commits, gitAvailable: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
