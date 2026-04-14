import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnlineStatus } from "../hooks/useOffline";
import {
  getPendingOps, getFailedOps, getOfflineSales, countItems,
  getLastSync, getAll, getCachedSession,
} from "../lib/offlineDB";
import {
  syncAllCatalogs, flushPendingOps, isOnline, CATALOG_DEFS,
} from "../lib/offlineSync";
import {
  Wifi, WifiOff, RefreshCw, Cloud, CloudOff, Database,
  Package, MapPin, Users, Truck, FileText, ShoppingCart,
  Clock, CheckCircle, AlertTriangle, XCircle, Trash2, Loader2,
} from "lucide-react";

const ICON_MAP = {
  catalogProducts: Package,
  catalogStock: Database,
  catalogProviders: Truck,
  catalogLocals: MapPin,
  recentOrders: FileText,
  pendingIngresos: FileText,
};

function timeAgo(ts) {
  if (!ts) return "Nunca";
  const diff = Date.now() - ts;
  if (diff < 60000) return "Hace segundos";
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)}h`;
  return new Date(ts).toLocaleString("es-AR");
}

function freshness(ts) {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 600000) return "fresh";
  return "stale";
}

export default function SyncStatusPage() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [flushing, setFlushing] = useState(false);

  // Catalog stats
  const { data: catalogStats = [], refetch: refetchCatalogs } = useQuery({
    queryKey: ["sync-catalog-stats"],
    queryFn: async () => {
      const results = [];
      for (const cat of CATALOG_DEFS) {
        const count = await countItems(cat.store);
        const lastSync = await getLastSync(cat.store);
        results.push({ ...cat, count, lastSync });
      }
      return results;
    },
    refetchInterval: 10000,
  });

  // Pending ops
  const { data: pendingOps = [], refetch: refetchOps } = useQuery({
    queryKey: ["sync-pending-ops"],
    queryFn: async () => {
      const pending = await getPendingOps();
      const failed = await getFailedOps();
      return [...pending, ...failed].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    refetchInterval: 10000,
  });

  // Offline sales
  const { data: offlineSales = [], refetch: refetchSales } = useQuery({
    queryKey: ["sync-offline-sales"],
    queryFn: () => getOfflineSales(),
    refetchInterval: 10000,
  });

  // Cached auth
  const { data: cachedAuth } = useQuery({
    queryKey: ["sync-cached-auth"],
    queryFn: () => getCachedSession(),
  });

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    try { await syncAllCatalogs(); } catch {}
    refetchCatalogs();
    setSyncing(false);
  }, [refetchCatalogs]);

  const handleFlush = useCallback(async () => {
    setFlushing(true);
    try { await flushPendingOps(); } catch {}
    refetchOps();
    refetchSales();
    setFlushing(false);
  }, [refetchOps, refetchSales]);

  const totalPending = pendingOps.filter(o => o.status === "PENDING").length;
  const totalFailed = pendingOps.filter(o => o.status === "FAILED").length;
  const salesPending = offlineSales.filter(s => s.status === "PENDING" || s.status === "EMITIDA_LOCAL").length;
  const salesSynced = offlineSales.filter(s => s.status === "SYNCED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RefreshCw className="w-7 h-7 text-blue-600" />
          Estado de Sincronización
        </h1>
        <button
          onClick={handleSyncAll}
          disabled={syncing || !online}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Todo"}
        </button>
      </div>

      {/* Connection Status */}
      <div className={`p-5 rounded-xl border-2 ${online
        ? "bg-green-50 border-green-300"
        : "bg-red-50 border-red-300"
      }`}>
        <div className="flex items-center gap-4">
          {online ? (
            <Cloud className="w-10 h-10 text-green-600" />
          ) : (
            <CloudOff className="w-10 h-10 text-red-600" />
          )}
          <div>
            <h2 className={`text-xl font-bold ${online ? "text-green-800" : "text-red-800"}`}>
              {online ? "🟢 Conectado al servidor" : "🔴 Sin conexión — Modo offline"}
            </h2>
            <p className={`text-sm ${online ? "text-green-600" : "text-red-600"}`}>
              {online
                ? "Los datos se sincronizan automáticamente cada 5 minutos"
                : "Las operaciones se guardan localmente y se enviarán al reconectar"
              }
            </p>
          </div>
        </div>
        {(totalPending > 0 || totalFailed > 0) && (
          <div className="mt-3 flex gap-4 text-sm">
            {totalPending > 0 && (
              <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-medium">
                ⏳ {totalPending} operaciones pendientes
              </span>
            )}
            {totalFailed > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                ❌ {totalFailed} fallidas
              </span>
            )}
          </div>
        )}
      </div>

      {/* Catalog Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">📦 Catálogos Locales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalogStats.map(cat => {
            const Icon = ICON_MAP[cat.store] || Database;
            const status = freshness(cat.lastSync);
            return (
              <div key={cat.key} className={`p-4 rounded-lg border ${
                status === "fresh" ? "bg-white border-green-200" :
                status === "stale" ? "bg-amber-50 border-amber-200" :
                "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${
                      status === "fresh" ? "text-green-600" :
                      status === "stale" ? "text-amber-600" :
                      "text-red-500"
                    }`} />
                    <span className="font-medium text-gray-800">{cat.label}</span>
                  </div>
                  {status === "fresh" && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {status === "stale" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  {status === "never" && <XCircle className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{cat.count}</p>
                    <p className="text-xs text-gray-500">registros</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(cat.lastSync)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Operations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">📤 Cola de Operaciones</h2>
          <button
            onClick={handleFlush}
            disabled={flushing || !online || pendingOps.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${flushing ? "animate-spin" : ""}`} />
            {flushing ? "Enviando..." : "Enviar Pendientes"}
          </button>
        </div>
        {pendingOps.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p>No hay operaciones pendientes</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Endpoint</th>
                    <th className="px-3 py-2 text-left">Creado</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                    <th className="px-3 py-2 text-center">Intentos</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingOps.map(op => (
                    <tr key={op.localId} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{op.type}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-40 truncate">{op.endpoint}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{timeAgo(op.createdAt)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          op.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                          op.status === "SYNCED" ? "bg-green-100 text-green-700" :
                          "bg-red-100 text-red-700"
                        }`}>{op.status}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs">{op.attempts || 0}</td>
                      <td className="px-3 py-2 text-xs text-red-600 max-w-48 truncate">{op.lastError || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Offline Sales */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">🧾 Ventas Offline</h2>
        {offlineSales.length === 0 ? (
          <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-500">
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No hay ventas offline registradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {offlineSales.map(sale => (
              <div key={sale.localId} className={`p-4 rounded-lg border ${
                sale.status === "SYNCED" ? "bg-green-50 border-green-200" :
                sale.status === "FAILED" ? "bg-red-50 border-red-200" :
                "bg-amber-50 border-amber-200"
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono font-bold text-sm">{sale.number || sale.localId?.slice(0, 12)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    sale.status === "SYNCED" ? "bg-green-100 text-green-700" :
                    sale.status === "FAILED" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {sale.status === "SYNCED" ? "✅ Sincronizada" :
                     sale.status === "FAILED" ? "❌ Fallida" :
                     "⏳ Pendiente"}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Total: <span className="font-semibold text-gray-900">${(sale.total || 0).toLocaleString("es-AR")}</span></p>
                  <p className="text-xs text-gray-500">{timeAgo(sale.createdAt)}</p>
                  {sale.items && <p className="text-xs">{sale.items.length} artículos</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {offlineSales.length > 0 && (
          <div className="mt-2 flex gap-3 text-sm">
            <span className="text-amber-600 font-medium">⏳ {salesPending} pendientes</span>
            <span className="text-green-600 font-medium">✅ {salesSynced} sincronizadas</span>
          </div>
        )}
      </div>

      {/* Cached Auth */}
      {cachedAuth && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">🔐 Sesión Cacheada</h2>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-medium text-gray-800">
                  {cachedAuth.profile?.full_name || cachedAuth.username}
                </p>
                <p className="text-sm text-gray-500">
                  Usuario: {cachedAuth.username} · Rol: {cachedAuth.profile?.role || "—"}
                </p>
                <p className="text-xs text-gray-400">Cacheado: {timeAgo(cachedAuth.cachedAt)}</p>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Este usuario puede iniciar sesión offline si se corta internet
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
