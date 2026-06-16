"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  minLeft?: number;
  minRight?: number;
};

export function ResizableSplit({
  left,
  right,
  defaultRatio = 0.5,
  minLeft = 160,
  minRight = 200,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(defaultRatio);
  const dragging = useRef(false);

  const onMove = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const leftW = Math.max(minLeft, Math.min(rect.width - minRight, x));
      setRatio(leftW / rect.width);
    },
    [minLeft, minRight],
  );

  useEffect(() => {
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const move = (e: MouseEvent) => {
      if (dragging.current) onMove(e.clientX);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onMove]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-h-0 overflow-hidden" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        className="w-1 shrink-0 cursor-col-resize bg-[var(--border)] hover:bg-[var(--accent)] active:bg-[var(--accent)]"
        onMouseDown={() => {
          dragging.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
