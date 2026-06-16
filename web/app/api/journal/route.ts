import { invalidateLinkIndex } from "@/lib/links";
import { createFromTemplate, readDoc, vaultReady } from "@/lib/vault";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/require-auth";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const TEMPLATE_MAP: Record<Period, { template: string; pathFn: (d: Date) => string }> = {
  daily: {
    template: "daily/daily.md",
    pathFn: (d) => `journal/${d.toISOString().slice(0, 10)}`,
  },
  weekly: {
    template: "weekly/weekly.md",
    pathFn: (d) => {
      const year = d.getFullYear();
      const week = getISOWeek(d);
      return `journal/${year}-W${String(week).padStart(2, "0")}`;
    },
  },
  monthly: {
    template: "project/project.md",
    pathFn: (d) => `journal/${d.toISOString().slice(0, 7)}`,
  },
  yearly: {
    template: "project/project.md",
    pathFn: (d) => `journal/${d.getFullYear()}`,
  },
};

function getISOWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req as import("next/server").NextRequest);
  if (isAuthError(auth)) return auth;
  const ready = await vaultReady();
  if (!ready.ok) return NextResponse.json({ error: ready.message }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const period = body.period as Period;
  if (!period || !TEMPLATE_MAP[period]) {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }

  const now = new Date();
  const rel = TEMPLATE_MAP[period].pathFn(now);
  const template = TEMPLATE_MAP[period].template;

  try {
    const doc = await readDoc(`${rel}.md`);
    return NextResponse.json({ path: doc.path, created: false });
  } catch {
    const doc = await createFromTemplate("journal", rel.split("/").pop()!, template);
    invalidateLinkIndex();
    return NextResponse.json({ path: doc.path, created: true });
  }
}
