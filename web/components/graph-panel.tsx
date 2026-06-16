"use client";

import { GitBranch, Loader2, Minus, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphData } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenDoc: (path: string) => void;
  centerPath?: string | null;
};

type Vec = { x: number; y: number };
type NodePos = Map<string, Vec>;
type NodeVel = Map<string, Vec>;

function initPositions(data: GraphData, w: number, h: number): { pos: NodePos; vel: NodeVel } {
  const pos: NodePos = new Map();
  const vel: NodeVel = new Map();
  const n = data.nodes.length;
  data.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = Math.min(w, h) * 0.3;
    pos.set(node.id, { x: w / 2 + r * Math.cos(angle), y: h / 2 + r * Math.sin(angle) });
    vel.set(node.id, { x: 0, y: 0 });
  });
  return { pos, vel };
}

function stepForce(
  pos: NodePos,
  vel: NodeVel,
  edges: GraphData["edges"],
  w: number,
  h: number,
) {
  const repulsion = 1800;
  const springLen = 100;
  const springK = 0.04;
  const damping = 0.82;
  const gravity = 0.015;
  const ids = [...pos.keys()];

  // Init force accumulators
  const fx = new Map<string, number>();
  const fy = new Map<string, number>();
  for (const id of ids) { fx.set(id, 0); fy.set(id, 0); }

  // Repulsion between all pairs (approx with random sampling for large graphs)
  const sample = ids.length > 100 ? ids.filter((_, i) => i % 3 === 0) : ids;
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const a = sample[i], b = sample[j];
      const pa = pos.get(a)!, pb = pos.get(b)!;
      const dx = pa.x - pb.x, dy = pa.y - pb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f = repulsion / (dist * dist);
      const nx = (dx / dist) * f, ny = (dy / dist) * f;
      fx.set(a, (fx.get(a) ?? 0) + nx); fy.set(a, (fy.get(a) ?? 0) + ny);
      fx.set(b, (fx.get(b) ?? 0) - nx); fy.set(b, (fy.get(b) ?? 0) - ny);
    }
  }

  // Spring attraction along edges
  for (const e of edges) {
    const pa = pos.get(e.from), pb = pos.get(e.to);
    if (!pa || !pb) continue;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
    const f = springK * (dist - springLen);
    const nx = (dx / dist) * f, ny = (dy / dist) * f;
    fx.set(e.from, (fx.get(e.from) ?? 0) + nx); fy.set(e.from, (fy.get(e.from) ?? 0) + ny);
    fx.set(e.to, (fx.get(e.to) ?? 0) - nx); fy.set(e.to, (fy.get(e.to) ?? 0) - ny);
  }

  // Gravity toward center
  const cx = w / 2, cy = h / 2;
  for (const id of ids) {
    const p = pos.get(id)!;
    fx.set(id, (fx.get(id) ?? 0) + (cx - p.x) * gravity);
    fy.set(id, (fy.get(id) ?? 0) + (cy - p.y) * gravity);
  }

  // Integrate
  for (const id of ids) {
    const v = vel.get(id)!;
    const p = pos.get(id)!;
    const nvx = (v.x + (fx.get(id) ?? 0)) * damping;
    const nvy = (v.y + (fy.get(id) ?? 0)) * damping;
    vel.set(id, { x: nvx, y: nvy });
    pos.set(id, { x: p.x + nvx, y: p.y + nvy });
  }
}

export function GraphPanel({ open, onClose, onOpenDoc, centerPath }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Simulation state stored in refs (mutated each frame, not state)
  const posRef = useRef<NodePos>(new Map());
  const velRef = useRef<NodeVel>(new Map());
  const rafRef = useRef<number>(0);
  const stepsRef = useRef(0);

  // Viewport: zoom + pan
  const zoomRef = useRef(1);
  const panRef = useRef<Vec>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startPan: Vec } | null>(null);
  const graphRef = useRef<GraphData | null>(null);
  const centerRef = useRef(centerPath);
  centerRef.current = centerPath;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const data = graphRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const zoom = zoomRef.current;
    const pan = panRef.current;
    const pos = posRef.current;
    const center = centerRef.current;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const cs = getComputedStyle(document.documentElement);
    const borderColor = cs.getPropertyValue("--border").trim() || "#444";
    const fgColor = cs.getPropertyValue("--foreground").trim() || "#fff";
    const accentColor = cs.getPropertyValue("--accent").trim() || "#6366f1";
    const panelColor = cs.getPropertyValue("--panel").trim() || "#1e1e1e";

    // Edges
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    for (const e of data.edges) {
      const a = pos.get(e.from), b = pos.get(e.to);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodes
    for (const node of data.nodes) {
      const p = pos.get(node.id);
      if (!p) continue;
      const isCenter = node.id === center;
      const isHovered = node.id === hoveredId;
      const r = isCenter ? 9 : isHovered ? 7 : 5;

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isCenter ? accentColor : isHovered ? accentColor + "88" : panelColor;
      ctx.fill();
      ctx.strokeStyle = isCenter ? accentColor : fgColor;
      ctx.lineWidth = isCenter ? 2 : 1;
      ctx.globalAlpha = isCenter ? 1 : 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label for center and hovered (with background rect for readability)
      if (isCenter || isHovered) {
        const title = node.title || node.id.split("/").pop() || node.id;
        const fontSize = 11;
        ctx.font = `${isCenter ? "bold " : ""}${fontSize}px sans-serif`;
        const textX = p.x + r + 4;
        const textY = p.y + 4;
        const textW = ctx.measureText(title).width;
        const pad = 3;
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = panelColor;
        ctx.beginPath();
        ctx.roundRect(textX - pad, textY - fontSize + 1, textW + pad * 2, fontSize + pad, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = fgColor;
        ctx.fillText(title, textX, textY);
      }
    }

    ctx.restore();
  }, [hoveredId]);

  const startSimulation = useCallback((data: GraphData) => {
    cancelAnimationFrame(rafRef.current);
    stepsRef.current = 0;
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth ?? 700;
    const h = canvas?.clientHeight ?? 400;
    const { pos, vel } = initPositions(data, w, h);
    posRef.current = pos;
    velRef.current = vel;
    graphRef.current = data;

    const MAX_STEPS = 300;
    const tick = () => {
      if (stepsRef.current < MAX_STEPS) {
        stepForce(posRef.current, velRef.current, data.edges, w, h);
        stepsRef.current++;
      }
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  const load = useCallback(async (rebuild = false) => {
    setLoading(true);
    cancelAnimationFrame(rafRef.current);
    try {
      const params = new URLSearchParams();
      if (centerPath) params.set("center", centerPath);
      if (rebuild) params.set("rebuild", "1");
      const r = await fetch(`/api/graph?${params}`);
      const data: GraphData = await r.json();
      setGraph(data);
      graphRef.current = data;
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      startSimulation(data);
    } finally {
      setLoading(false);
    }
  }, [centerPath, startSimulation]);

  useEffect(() => {
    if (open) void load(true); // rebuild on open to pick up folder edges
    else cancelAnimationFrame(rafRef.current);
  }, [open, load]);

  // Re-draw when hovered changes
  useEffect(() => { draw(); }, [hoveredId, draw]);

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Screen coords → world coords
  const screenToWorld = (sx: number, sy: number): Vec => {
    const zoom = zoomRef.current;
    const pan = panRef.current;
    return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
  };

  const nodeAtScreen = (sx: number, sy: number): string | null => {
    const w = screenToWorld(sx, sy);
    for (const [id, p] of posRef.current) {
      const dx = p.x - w.x, dy = p.y - w.y;
      if (dx * dx + dy * dy <= 81) return id; // 9px hit radius
    }
    return null;
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      panRef.current = { x: dragRef.current.startPan.x + dx, y: dragRef.current.startPan.y + dy };
      draw();
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const id = nodeAtScreen(e.clientX - rect.left, e.clientY - rect.top);
    setHoveredId(id);
  };

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...panRef.current } };
  };

  const onCanvasMouseUp = () => { dragRef.current = null; };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const id = nodeAtScreen(e.clientX - rect.left, e.clientY - rect.top);
    if (id) { onOpenDoc(id); onClose(); }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(0.2, Math.min(5, oldZoom * factor));
    panRef.current = {
      x: mx - (mx - panRef.current.x) * (newZoom / oldZoom),
      y: my - (my - panRef.current.y) * (newZoom / oldZoom),
    };
    zoomRef.current = newZoom;
    draw();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-end bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[min(560px,85vh)] w-full max-w-4xl flex-col rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <GitBranch className="h-4 w-4" /> Knowledge graph
            {graph && (
              <span className="text-xs font-normal text-[var(--muted)]">
                {graph.nodes.length} notes · {graph.edges.length} links
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { zoomRef.current = Math.min(5, zoomRef.current * 1.2); draw(); }}
              title="Zoom in"
              className="rounded p-1 hover:bg-[var(--border)]"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { zoomRef.current = Math.max(0.2, zoomRef.current * 0.8); draw(); }}
              title="Zoom out"
              className="rounded p-1 hover:bg-[var(--border)]"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; draw(); }}
              title="Reset view"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--border)]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void load(true)}
              title="Rebuild graph"
              className="rounded p-1 hover:bg-[var(--border)]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} title="Close" className="rounded p-1 hover:bg-[var(--border)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 p-2">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[var(--muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building graph…
            </div>
          )}
          {!loading && graph && graph.nodes.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm text-[var(--muted)]">
              <GitBranch className="h-8 w-8 opacity-20" />
              <p>No notes found in the vault</p>
              <p className="text-xs opacity-60">Create some notes and reopen the graph</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-md bg-[var(--background)]"
            style={{ cursor: dragRef.current ? "grabbing" : hoveredId ? "pointer" : "grab" }}
            onClick={onCanvasClick}
            onMouseMove={onCanvasMouseMove}
            onMouseDown={onCanvasMouseDown}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onWheel={onWheel}
          />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
          <span>Click node to open · Drag to pan · Scroll to zoom</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-px w-4 bg-[var(--foreground)] opacity-40" />
              Wikilink
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
