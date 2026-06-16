import { NextRequest, NextResponse } from "next/server";
import { saveAttachmentForDoc } from "@/lib/attachments";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const docPath = String(formData.get("docPath") || "").trim();
  const file = formData.get("file");
  if (!docPath || !docPath.endsWith(".md")) {
    return NextResponse.json({ error: "docPath must be a markdown note path" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await saveAttachmentForDoc(docPath, file.name, buffer);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
