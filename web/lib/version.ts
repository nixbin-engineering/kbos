import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type AboutInfo = {
  name: "KBOS";
  version: string;
  commit: string | null;
  built_at: string | null;
  node: string;
  platform: string;
  arch: string;
  env: string;
  kb: string | null;
  uptime_seconds: number;
};

function readEnv(name: string): string {
  // Bracket access so Next does not inline the value at build time.
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

async function git(args: string[]): Promise<string> {
  const roots = [process.cwd(), path.resolve(process.cwd(), "..")];
  for (const cwd of roots) {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd, timeout: 1500, encoding: "utf8" });
      const out = stdout.trim();
      if (out) return out;
    } catch {
      /* not a checkout, or git is absent */
    }
  }
  return "";
}

async function kbVersion(): Promise<string> {
  const bin = readEnv("KB_BIN") || "kb";
  try {
    const { stdout } = await execFileAsync(bin, ["--version"], { timeout: 1500, encoding: "utf8" });
    return stdout.trim().replace(/^kb version\s+/i, "");
  } catch {
    return "";
  }
}

/** Release metadata for Settings → About. Image builds stamp KBOS_* ; local dev falls back to git. */
export async function aboutInfo(): Promise<AboutInfo> {
  let version = readEnv("KBOS_VERSION");
  let commit = readEnv("KBOS_COMMIT");
  const builtAt = readEnv("KBOS_BUILT_AT");

  if (!version) version = (await git(["describe", "--tags", "--always", "--dirty"])) || "dev";
  if (!commit) {
    commit = await git(["rev-parse", "--short", "HEAD"]);
    if (commit && (await git(["status", "--porcelain"]))) commit = `${commit}-dirty`;
  }

  const kb = await kbVersion();
  return {
    name: "KBOS",
    version,
    commit: commit || null,
    built_at: builtAt || null,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || "development",
    kb: kb || null,
    uptime_seconds: Math.floor(process.uptime()),
  };
}
