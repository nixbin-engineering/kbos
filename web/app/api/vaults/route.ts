import fs from "fs/promises";
import path from "path";
import yaml from "yaml";
import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAdmin, requireAuth } from "@/lib/require-auth";
import { accessibleVaults, loadRegistry, saveRegistry, vaultsBase, type VaultEntry } from "@/lib/vault-registry";
import { getActiveVaultId } from "@/lib/vault-session";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const registry = await loadRegistry();
  const user = auth.user || "";
  const vaults = (await accessibleVaults(registry, user)).map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    secure: v.secure,
    active: v.id === getActiveVaultId(user),
  }));

  return NextResponse.json({ vaults, vaultsBase: vaultsBase() });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const body = await req.json();
  const { name, description, secure } = body as {
    name?: string;
    description?: string;
    secure?: boolean;
  };
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const registry = await loadRegistry();
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!id) return NextResponse.json({ error: "invalid name" }, { status: 400 });
  if (registry.vaults.some((v) => v.id === id)) {
    return NextResponse.json({ error: `Vault "${id}" already exists` }, { status: 409 });
  }

  // Compute path relative to VAULTS_BASE
  const base = vaultsBase();
  const vaultPath = path.join(base, id);

  // Scaffold the vault directory structure
  for (const sub of ["config", "docs", "templates", "assets"]) {
    await fs.mkdir(path.join(vaultPath, sub), { recursive: true });
  }
  const kbYaml = yaml.stringify({
    vault: { name: name.trim() },
    paths: { docs: "docs", templates: "templates", assets: "assets" },
    index: { fuzzy: true },
    auth: { mode: "local" },
    ai: { enabled: false },
    ui: { autosave_seconds: 5, attachments_subdir: "attachments" },
  });
  await fs.writeFile(path.join(vaultPath, "config", "kb.yaml"), kbYaml, { mode: 0o600 });
  await fs.writeFile(path.join(vaultPath, "config", "users.yaml"), yaml.stringify({ users: [] }), { mode: 0o600 });

  const entry: VaultEntry = {
    id,
    name: name.trim(),
    path: vaultPath,
    description: description?.trim() || undefined,
    secure: Boolean(secure),
    access: [{ user: auth.user || "*", role: "admin" }],
  };

  registry.vaults.push(entry);
  await saveRegistry(registry);

  return NextResponse.json({ vault: entry }, { status: 201 });
}
