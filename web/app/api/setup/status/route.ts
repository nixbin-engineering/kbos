import { NextResponse } from "next/server";
import { needsSetup } from "@/lib/auth";

export async function GET() {
  const required = await needsSetup();
  return NextResponse.json({ required, step: required ? "admin" : "done" });
}
