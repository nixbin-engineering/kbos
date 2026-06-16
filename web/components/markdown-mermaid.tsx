"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme-provider";

type Props = {
  code: string;
};

export function MarkdownMermaid({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedAppearance } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedAppearance === "dark" ? "dark" : "default",
          securityLevel: "strict",
        });
        if (!ref.current || cancelled) return;
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (ref.current && !cancelled) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, resolvedAppearance]);

  if (error) {
    return (
      <pre className="my-3 overflow-x-auto rounded-lg border border-red-500/40 bg-[var(--panel)] p-3 text-xs text-red-600">
        Mermaid error: {error}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4"
    />
  );
}
