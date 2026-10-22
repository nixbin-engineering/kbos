/**
 * Line-level 3-way merge. Non-overlapping edits from both sides are kept.
 * The same lines changed differently are kept inline with conflict markers
 * so neither side's text is dropped.
 */

import { diffArrays } from "diff";

export type Merge3Result = {
  text: string;
  conflicts: boolean;
};

type Hunk = { start: number; deleteCount: number; insert: string[] };

function toLines(s: string): string[] {
  if (s.length === 0) return [];
  const parts = s.split("\n");
  if (s.endsWith("\n")) parts.pop();
  return parts;
}

function fromLines(lines: string[], trailingNl: boolean): string {
  if (lines.length === 0) return trailingNl ? "\n" : "";
  return lines.join("\n") + (trailingNl ? "\n" : "");
}

function hunks(base: string[], next: string[]): Hunk[] {
  const changes = diffArrays(base, next);
  const out: Hunk[] = [];
  let idx = 0;
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i]!;
    if (c.added) {
      out.push({ start: idx, deleteCount: 0, insert: [...c.value] });
      continue;
    }
    if (c.removed) {
      const nxt = changes[i + 1];
      const insert = nxt?.added ? [...nxt.value] : [];
      if (nxt?.added) i += 1;
      out.push({ start: idx, deleteCount: c.value.length, insert });
      idx += c.value.length;
      continue;
    }
    idx += c.value.length;
  }
  return out;
}

function endOf(h: Hunk): number {
  return h.start + h.deleteCount;
}

function overlaps(a: Hunk, b: Hunk): boolean {
  if (a.deleteCount === 0 && b.deleteCount === 0) return a.start === b.start;
  if (a.deleteCount === 0) return a.start >= b.start && a.start < endOf(b);
  if (b.deleteCount === 0) return b.start >= a.start && b.start < endOf(a);
  return a.start < endOf(b) && b.start < endOf(a);
}

function applyHunks(base: string[], start: number, end: number, list: Hunk[]): string[] {
  const out: string[] = [];
  let pos = start;
  for (const h of list) {
    if (h.start < start || h.start > end) continue;
    if (h.deleteCount === 0 && h.start === end) continue;
    out.push(...base.slice(pos, h.start), ...h.insert);
    pos = endOf(h);
  }
  out.push(...base.slice(pos, end));
  return out;
}

function sameLines(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function merge3(base: string, ours: string, theirs: string): Merge3Result {
  if (ours === theirs || theirs === base) return { text: ours, conflicts: false };
  if (ours === base) return { text: theirs, conflicts: false };

  const baseLines = toLines(base);
  const oursH = hunks(baseLines, toLines(ours));
  const theirsH = hunks(baseLines, toLines(theirs));
  const trailingNl = base.endsWith("\n") || ours.endsWith("\n") || theirs.endsWith("\n");

  const out: string[] = [];
  let conflicts = false;
  let pos = 0;
  let oi = 0;
  let ti = 0;

  const take = (h: Hunk) => {
    out.push(...baseLines.slice(pos, h.start), ...h.insert);
    pos = endOf(h);
  };

  while (oi < oursH.length || ti < theirsH.length) {
    const a = oi < oursH.length ? oursH[oi] : undefined;
    const b = ti < theirsH.length ? theirsH[ti] : undefined;
    if (a && (!b || a.start <= b.start)) {
      if (b && overlaps(a, b)) {
        const clusterO: Hunk[] = [];
        const clusterT: Hunk[] = [];
        let start = Math.min(a.start, b.start);
        let end = Math.max(endOf(a), endOf(b));
        while (oi < oursH.length || ti < theirsH.length) {
          const na = oi < oursH.length ? oursH[oi] : undefined;
          const nb = ti < theirsH.length ? theirsH[ti] : undefined;
          const touchO = na && na.start <= end;
          const touchT = nb && nb.start <= end;
          if (!touchO && !touchT) break;
          if (touchO && na) {
            clusterO.push(na);
            start = Math.min(start, na.start);
            end = Math.max(end, endOf(na));
            oi += 1;
          }
          if (touchT && nb) {
            clusterT.push(nb);
            start = Math.min(start, nb.start);
            end = Math.max(end, endOf(nb));
            ti += 1;
          }
        }
        const oText = applyHunks(baseLines, start, end, clusterO);
        const tText = applyHunks(baseLines, start, end, clusterT);
        out.push(...baseLines.slice(pos, start));
        if (sameLines(oText, tText)) {
          out.push(...oText);
        } else {
          conflicts = true;
          out.push("<<<<<<< local", ...oText, "=======", ...tText, ">>>>>>> remote");
        }
        pos = end;
      } else {
        take(a);
        oi += 1;
      }
    } else if (b) {
      take(b);
      ti += 1;
    }
  }
  out.push(...baseLines.slice(pos));
  return { text: fromLines(out, trailingNl), conflicts };
}
