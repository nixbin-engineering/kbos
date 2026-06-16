import { NextRequest, NextResponse } from "next/server";
import { invalidateLinkIndex } from "@/lib/links";
import { isAuthError, requireAuth } from "@/lib/require-auth";
import {
  createDoc,
  createFromTemplate,
  drawingNoteContent,
  vaultReady,
} from "@/lib/vault";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) {
    return NextResponse.json({ error: ready.message }, { status: 503 });
  }
  const body = await req.json();
  if (typeof body.path !== "string" || !body.path.trim()) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }
  try {
    let doc;
    if (typeof body.template === "string" && body.template) {
      const parts = body.path.replace(/\\/g, "/").split("/");
      const name = parts.pop() || "untitled";
      const parent = parts.join("/");
      doc = await createFromTemplate(parent, name.replace(/\.md$/, ""), body.template);
    } else if (body.kind === "drawing") {
      const base = body.path.replace(/\.md$/, "").split("/").pop() || "drawing";
      const title = base.replace(/-/g, " ");
      doc = await createDoc(body.path, drawingNoteContent(title));
    } else {
      doc = await createDoc(body.path, typeof body.raw === "string" ? body.raw : undefined);
    }
    invalidateLinkIndex();
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    const msg = String(e);
    const status = msg.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
