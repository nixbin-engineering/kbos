import { spawn } from "child_process";
import { vaultRoot } from "./vault";

const KB_BIN = process.env.KB_BIN || "kb";

function kbArgs(subcommand: string, extra: string[]): string[] {
  return ["-V", vaultRoot(), subcommand, ...extra];
}

function runKb(args: string[], passphrase: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(KB_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      // kb exits 0 even on errors — detect via "error:" prefix in stderr
      const errLine = stderr.split("\n").find((l) => /^error:/i.test(l.trim()));
      if (code !== 0 || errLine) {
        const msg = errLine?.replace(/^error:\s*/i, "").trim() || stderr.trim() || stdout.trim() || `kb exited with code ${code}`;
        reject(new Error(msg));
      } else {
        resolve({ stdout, stderr });
      }
    });
    proc.stdin.write(`${passphrase}\n`);
    proc.stdin.end();
  });
}

export async function kbEncryptNote(relPath: string, passphrase: string): Promise<void> {
  const path = relPath.endsWith(".md") ? relPath : `${relPath}.md`;
  await runKb(kbArgs("encrypt", ["--passphrase-stdin", path]), passphrase);
}

export async function kbEncryptFolder(folderRel: string, passphrase: string): Promise<number> {
  const args = ["--folder", "--passphrase-stdin", folderRel || "."];
  const { stdout, stderr } = await runKb(kbArgs("encrypt", args), passphrase);
  const m = (stdout + stderr).match(/Encrypted (\d+) note/);
  return m ? Number(m[1]) : 0;
}

export async function kbDecryptNote(relPath: string, passphrase: string): Promise<void> {
  const path = relPath.endsWith(".md.enc") ? relPath : `${relPath}.md.enc`;
  await runKb(kbArgs("decrypt", ["--passphrase-stdin", path]), passphrase);
}

export async function kbDecryptFolder(folderRel: string, passphrase: string): Promise<number> {
  const args = ["--folder", "--passphrase-stdin", folderRel || "."];
  const { stdout, stderr } = await runKb(kbArgs("decrypt", args), passphrase);
  const m = (stdout + stderr).match(/Decrypted (\d+) note/);
  return m ? Number(m[1]) : 0;
}

export async function kbDecryptToMemory(encPath: string, passphrase: string): Promise<string> {
  const path = encPath.endsWith(".md.enc") ? encPath : `${encPath}.md.enc`;
  const { stdout } = await runKb(kbArgs("decrypt", ["--passphrase-stdin", "--stdout", path]), passphrase);
  return stdout;
}
