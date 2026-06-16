import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAdmin, requireAuth } from "@/lib/require-auth";
import { loadRegistry, saveRegistry, type VaultAccess } from "@/lib/vault-registry";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { id } = await params;
  const registry = await loadRegistry();
  const vault = registry.vaults.find((v) => v.id === id);
  if (!vault) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(vault);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { id } = await params;
  const body = await req.json();
  const registry = await loadRegistry();
  const idx = registry.vaults.findIndex((v) => v.id === id);
  if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = registry.vaults[idx];

  if (body.name !== undefined) existing.name = String(body.name).trim();
  if (body.description !== undefined) existing.description = String(body.description).trim() || undefined;
  if (body.secure !== undefined) existing.secure = Boolean(body.secure);
  if (Array.isArray(body.access)) {
    existing.access = (body.access as VaultAccess[]).filter((a) => a.user && a.role);
  }

  await saveRegistry(registry);
  return NextResponse.json(existing);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { id } = await params;
  if (id === "main") {
    return NextResponse.json({ error: "cannot delete the main vault" }, { status: 400 });
  }

  const registry = await loadRegistry();
  registry.vaults = registry.vaults.filter((v) => v.id !== id);
  await saveRegistry(registry);
  return NextResponse.json({ ok: true });
}
