"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

type Props = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: Side;
  delay?: number;
  className?: string;
};

export function Tooltip({ content, children, side = "bottom", delay = 500, className }: Props) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timer.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  };

  const posClass: Record<Side, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && content && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[200] whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs shadow-md text-[var(--foreground)]",
            posClass[side],
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
