import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireAuth, requireAdmin } from "@/lib/require-auth";
import { loadGroups, saveGroups } from "@/lib/groups";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const groups = await loadGroups();
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const deny = requireAdmin(auth);
  if (deny) return deny;

  const body = await req.json();
  const { name, description, members, type } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const groups = await loadGroups();
  const id = crypto.randomBytes(6).toString("hex");
  const group = { id, name: name.trim(), description: description?.trim(), members: members ?? [], type: type === "team" ? "team" : "group" } as const;
  groups.push(group);
  await saveGroups(groups);
  return NextResponse.json({ group }, { status: 201 });
}
