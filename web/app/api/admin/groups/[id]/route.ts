import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth, requireAdmin } from "@/lib/require-auth";
import { loadGroups, saveGroups } from "@/lib/groups";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const deny = requireAdmin(auth);
  if (deny) return deny;

  const { id } = await params;
  const groups = await loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  groups[idx] = {
    ...groups[idx],
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.members !== undefined ? { members: body.members } : {}),
    ...(body.type !== undefined ? { type: body.type === "team" ? "team" as const : "group" as const } : {}),
  };
  await saveGroups(groups);
  return NextResponse.json({ group: groups[idx] });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const deny = requireAdmin(auth);
  if (deny) return deny;

  const { id } = await params;
  const groups = await loadGroups();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });

  groups.splice(idx, 1);
  await saveGroups(groups);
  return NextResponse.json({ ok: true });
}
