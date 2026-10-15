"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSyncState,
  pinForOffline,
  startOfflineSync,
  subscribeSync,
  type SyncState,
  unpinOffline,
  drainPendingQueue,
  resolveConflictKeepLocal,
  resolveConflictTakeServer,
} from "./offline-sync";
import { listPins, type OfflinePin, isExplicitPin, pathCoveredByPins } from "./offline-store";
import type { TreeNode } from "./types";

export function useOfflineSync() {
  const [sync, setSync] = useState<SyncState>(() => getSyncState());
  const [pins, setPins] = useState<OfflinePin[]>([]);

  const reloadPins = useCallback(async () => {
    try {
      setPins(await listPins());
    } catch {
      setPins([]);
    }
  }, []);

  useEffect(() => {
    const stop = startOfflineSync();
    const unsub = subscribeSync(setSync);
    void reloadPins();
    return () => {
      stop();
      unsub();
    };
  }, [reloadPins]);

  const pin = useCallback(
    async (path: string, type: "file" | "dir", tree?: TreeNode | null) => {
      const result = await pinForOffline(path, type, tree);
      await reloadPins();
      return result;
    },
    [reloadPins],
  );

  const unpin = useCallback(
    async (path: string) => {
      await unpinOffline(path);
      await reloadPins();
    },
    [reloadPins],
  );

  const isPinned = useCallback(
    (path: string, type: "file" | "dir") => isExplicitPin(path, type, pins),
    [pins],
  );

  const isAvailableOffline = useCallback(
    (path: string) => pathCoveredByPins(path, pins),
    [pins],
  );

  return {
    sync,
    pins,
    pin,
    unpin,
    isPinned,
    isAvailableOffline,
    reloadPins,
    drain: drainPendingQueue,
    resolveKeepLocal: resolveConflictKeepLocal,
    resolveTakeServer: resolveConflictTakeServer,
    offline: sync.status === "offline" || (typeof navigator !== "undefined" && !navigator.onLine),
  };
}
