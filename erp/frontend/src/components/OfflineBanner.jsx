/**
 * OfflineBanner.jsx — Indicador de estado de conexión + operaciones pendientes
 *
 * Se muestra como barra fija en la parte superior cuando:
 *   - No hay conexión (banner rojo)
 *   - Hay operaciones pendientes de sincronizar (banner ámbar)
 *   - Se restauró la conexión (banner verde temporal)
 */
import { useState, useEffect } from "react";
import { WifiOff, Wifi, CloudOff, Upload, Check, AlertTriangle } from "lucide-react";
import { useOnlineStatus, usePendingOps } from "../hooks/useOffline";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { count: pendingCount, syncing, flush } = usePendingOps();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track offline→online transition to show brief "Reconnected" message
  useEffect(() => {
    if (!online) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      setWasOffline(false);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [online, wasOffline]);

  // Nothing to show
  if (online && !showReconnected && pendingCount === 0) return null;

  return (
    <div className="print:hidden">
      {/* OFFLINE BANNER */}
      {!online && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium animate-pulse shadow-lg">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Sin conexión — Modo offline activo</span>
          <span className="text-red-200 text-xs ml-2">Los datos se muestran desde el caché local</span>
        </div>
      )}

      {/* RECONNECTED BANNER */}
      {online && showReconnected && (
        <div className="bg-green-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Conexión restaurada</span>
          {pendingCount > 0 && (
            <span className="text-green-200 text-xs ml-2">Sincronizando {pendingCount} operación{pendingCount > 1 ? 'es' : ''}...</span>
          )}
        </div>
      )}

      {/* PENDING OPS BANNER (only when online) */}
      {online && !showReconnected && pendingCount > 0 && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <CloudOff className="h-4 w-4 shrink-0" />
          <span>{pendingCount} operación{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''} de sincronizar</span>
          <button
            onClick={flush}
            disabled={syncing}
            className="ml-3 px-3 py-1 bg-white text-amber-700 rounded text-xs font-bold hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1"
          >
            {syncing ? (
              <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-600" /> Sincronizando...</>
            ) : (
              <><Upload className="h-3 w-3" /> Sincronizar ahora</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
