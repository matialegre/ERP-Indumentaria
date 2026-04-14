/**
 * useOffline.js — React hooks para modo offline
 *
 * Hooks:
 *   - useOnlineStatus() — boolean + listener para online/offline
 *   - useOfflineQuery(key, endpoint, storeName, options) — TanStack Query + IndexedDB fallback
 *   - usePendingOps() — monitor de operaciones pendientes
 */
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithFallback, onConnectionChange, isOnline, flushPendingOps, getSyncStatus, onSyncProgress, CATALOG_DEFS } from "../lib/offlineSync";
import { getPendingOps, getLastSync, countItems } from "../lib/offlineDB";

/* ═══════════════════════════════════════════════════════ */
/*  useOnlineStatus                                        */
/* ═══════════════════════════════════════════════════════ */
export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    return onConnectionChange(setOnline);
  }, []);

  return online;
}

/* ═══════════════════════════════════════════════════════ */
/*  useOfflineQuery                                        */
/* ═══════════════════════════════════════════════════════ */

/**
 * Like useQuery but with automatic IndexedDB fallback when offline or slow.
 *
 * @param {string|string[]} queryKey — TanStack Query key
 * @param {string} endpoint — API endpoint (e.g. "/products/?limit=10000")
 * @param {string} storeName — IndexedDB store name for fallback
 * @param {object} [options]
 * @param {number} [options.networkTimeout=2500] — ms before switching to cache
 * @param {function} [options.filter] — filter function for cached items
 * @param {number} [options.staleTime=300000] — 5 min default
 * @param {number} [options.refetchInterval] — auto refetch interval
 */
export function useOfflineQuery(queryKey, endpoint, storeName, options = {}) {
  const { networkTimeout = 2500, filter, staleTime = 5 * 60 * 1000, refetchInterval } = options;
  const [source, setSource] = useState("network");

  const query = useQuery({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
    queryFn: async () => {
      const result = await fetchWithFallback(endpoint, storeName, {
        timeout: networkTimeout,
        filter,
      });
      setSource(result.source);
      return result;
    },
    staleTime,
    refetchInterval,
    // Don't error on cache fallback
    retry: 0,
  });

  return {
    data: query.data?.data ?? [],
    source: query.data?.source ?? source,
    stale: query.data?.stale ?? false,
    lastSync: query.data?.lastSync,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    isOffline: source === "cache",
  };
}

/* ═══════════════════════════════════════════════════════ */
/*  usePendingOps                                          */
/* ═══════════════════════════════════════════════════════ */
export function usePendingOps() {
  const [pending, setPending] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const ops = await getPendingOps();
    setPending(ops);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, [refresh]);

  const flush = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await flushPendingOps();
      await refresh();
      return result;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  return { pending, syncing, flush, refresh, count: pending.length };
}

/* ═══════════════════════════════════════════════════════ */
/*  useSyncStatus                                          */
/* ═══════════════════════════════════════════════════════ */
export function useSyncStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getSyncStatus().then(setStatus);
    const id = setInterval(() => getSyncStatus().then(setStatus), 30000);
    return () => clearInterval(id);
  }, []);

  return status;
}

/* ═══════════════════════════════════════════════════════ */
/*  useSyncProgress                                        */
/* ═══════════════════════════════════════════════════════ */

/**
 * Subscribe to real-time catalog sync progress + catalog metadata.
 * Returns { syncing, progress, lastSyncTimes, catalogCounts }
 */
export function useSyncProgress() {
  const [progress, setProgress] = useState({
    syncing: false, current: 0, total: 0, currentStore: null, currentLabel: null,
  });
  const [lastSyncTimes, setLastSyncTimes] = useState({});
  const [catalogCounts, setCatalogCounts] = useState({});

  // Subscribe to sync progress events
  useEffect(() => {
    return onSyncProgress((state) => {
      setProgress(state);
      // When sync finishes, refresh catalog metadata
      if (!state.syncing && state.current > 0) {
        loadCatalogMeta();
      }
    });
  }, []);

  const loadCatalogMeta = useCallback(async () => {
    const times = {};
    const counts = {};
    for (const def of CATALOG_DEFS) {
      times[def.store] = await getLastSync(def.store);
      counts[def.store] = await countItems(def.store);
    }
    setLastSyncTimes(times);
    setCatalogCounts(counts);
  }, []);

  // Load catalog metadata on mount and periodically
  useEffect(() => {
    loadCatalogMeta();
    const id = setInterval(loadCatalogMeta, 60000);
    return () => clearInterval(id);
  }, [loadCatalogMeta]);

  return {
    syncing: progress.syncing,
    progress,
    lastSyncTimes,
    catalogCounts,
  };
}
