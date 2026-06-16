import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedImage, mimeForFile, safeDocsFilePath } from "@/lib/attachments";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const segments = (await params).path;
  if (!segments?.length) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  const rel = segments.map(decodeURIComponent).join("/");
  if (!isAllowedImage(rel)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 403 });
  }

  try {
    const full = safeDocsFilePath(rel);
    const data = await fs.readFile(full);
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeForFile(rel),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
