import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import { accessibleVaults, loadRegistry } from "@/lib/vault-registry";
import { getActiveVaultId, setActiveVaultId } from "@/lib/vault-session";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const registry = await loadRegistry();
  const user = auth.user || "";
  const accessible = await accessibleVaults(registry, user);
  const vault = accessible.find((v) => v.id === id);

  if (!vault) {
    return NextResponse.json({ error: "vault not found or access denied" }, { status: 404 });
  }

  setActiveVaultId(user, id);
  return NextResponse.json({ active: id, name: vault.name });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const user = auth.user || "";
  return NextResponse.json({ active: getActiveVaultId(user) });
}
