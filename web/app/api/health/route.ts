import { NextResponse } from "next/server";
import { vaultReady } from "@/lib/vault";

export async function GET() {
  const status = await vaultReady();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
