"use client";

import { useEffect, useRef } from "react";

export type VaultEventHandlers = {
  onTree?: () => void;
  onTags?: () => void;
  onDoc?: (path: string) => void;
};

export function useVaultEvents(enabled: boolean, handlers: VaultEventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource("/api/vault/events");

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as { type: string; path?: string };
        if (data.type === "ping") return;
        if (data.type === "tree") handlersRef.current.onTree?.();
        if (data.type === "tags") handlersRef.current.onTags?.();
        if (data.type === "doc" && data.path) handlersRef.current.onDoc?.(data.path);
      } catch {
        /* ignore malformed events */
      }
    };

    return () => es.close();
  }, [enabled]);
}
