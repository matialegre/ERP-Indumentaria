import { useState, useEffect } from "react";
import { RefreshCw, Check, WifiOff, Database, Clock, ChevronUp, ChevronDown, X } from "lucide-react";
import { useOnlineStatus, useSyncProgress } from "../hooks/useOffline";
import { syncAllCatalogs, CATALOG_DEFS } from "../lib/offlineSync";

function formatTimeAgo(ts) {
  if (!ts) return "nunca";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "hace unos segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export default function SyncProgressWidget() {
  const online = useOnlineStatus();
  const { syncing, progress, lastSyncTimes, catalogCounts } = useSyncProgress();
  const [expanded, setExpanded] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("syncWidgetHidden") === "1");

  // Brief "completed" state after sync finishes
  useEffect(() => {
    if (!syncing && progress.current > 0) {
      setJustFinished(true);
      const timer = setTimeout(() => setJustFinished(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [syncing, progress.current]);

  const oldestSync = Object.values(lastSyncTimes).filter(Boolean);
  const oldestTs = oldestSync.length > 0 ? Math.min(...oldestSync) : null;
  const isStale = oldestTs && (Date.now() - oldestTs) > 10 * 60 * 1000;

  const handleManualSync = (e) => {
    e.stopPropagation();
    if (!syncing && online) syncAllCatalogs().catch(() => {});
  };

  // Status badge content
  let badge;
  if (syncing) {
    badge = (
      <div className="flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin text-blue-500" />
        <span className="text-xs text-gray-700 dark:text-gray-200">
          Sincronizando… {progress.current}/{progress.total}
        </span>
      </div>
    );
  } else if (!online) {
    badge = (
      <div className="flex items-center gap-2">
        <WifiOff size={14} className="text-red-500" />
        <span className="text-xs text-red-600 dark:text-red-400">Sin conexión — Datos del cache</span>
      </div>
    );
  } else if (justFinished) {
    badge = (
      <div className="flex items-center gap-2">
        <Check size={14} className="text-green-500" />
        <span className="text-xs text-green-600 dark:text-green-400">Datos actualizados</span>
      </div>
    );
  } else if (isStale) {
    badge = (
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-amber-500" />
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Última sync: {formatTimeAgo(oldestTs)}
        </span>
      </div>
    );
  } else {
    badge = (
      <div className="flex items-center gap-2">
        <Database size={14} className="text-gray-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Sync: {formatTimeAgo(oldestTs)}
        </span>
      </div>
    );
  }

  if (hidden) {
    return (
      <button
        onClick={() => { setHidden(false); sessionStorage.removeItem("syncWidgetHidden"); }}
        className="fixed bottom-2 right-2 z-40 w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full text-xs flex items-center justify-center shadow"
        title="Mostrar widget de sincronización"
      >
        <Database size={11} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-xs">
      <button
        onClick={(e) => { e.stopPropagation(); setHidden(true); sessionStorage.setItem("syncWidgetHidden", "1"); }}
        className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full shadow flex items-center justify-center z-10"
        title="Ocultar (volverá al recargar)"
      >
        <X size={11} />
      </button>
      {/* Expanded detail panel */}
      {expanded && (
        <div className="mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700 dark:text-gray-200">Catálogos offline</span>
            {online && !syncing && (
              <button
                onClick={handleManualSync}
                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                title="Sincronizar ahora"
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {CATALOG_DEFS.map((def) => (
              <div key={def.store} className="flex items-center justify-between gap-3">
                <span className="text-gray-600 dark:text-gray-300 truncate">{def.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-400 tabular-nums">
                    {catalogCounts[def.store] ?? "—"}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400 whitespace-nowrap">
                    {formatTimeAgo(lastSyncTimes[def.store])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed badge */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 px-3 py-2 hover:shadow-lg transition-shadow cursor-pointer w-full"
      >
        {badge}
        <div className="ml-auto pl-2">
          {expanded
            ? <ChevronDown size={12} className="text-gray-400" />
            : <ChevronUp size={12} className="text-gray-400" />}
        </div>
      </button>

      {/* Progress bar during sync */}
      {syncing && (
        <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
          />
        </div>
      )}
    </div>
  );
}
