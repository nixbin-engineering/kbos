import { buildGraph, getGraph, neighborhood } from "@/lib/graph";
import { invalidateLinkIndex } from "@/lib/links";
import { vaultReady } from "@/lib/vault";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req as import("next/server").NextRequest);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) return NextResponse.json({ error: ready.message }, { status: 503 });

  const url = new URL(req.url);
  const center = url.searchParams.get("center");
  const rebuild = url.searchParams.get("rebuild") === "1";

  const data = await getGraph(rebuild);
  const graph = neighborhood(data, center);
  return NextResponse.json(graph);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req as import("next/server").NextRequest);
  if (isAuthError(auth)) return auth;
  invalidateLinkIndex();
  const graph = await buildGraph();
  return NextResponse.json({ ok: true, nodes: graph.nodes.length, edges: graph.edges.length });
}
