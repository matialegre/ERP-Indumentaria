/**
 * OTListPage — Lista de Órdenes de Trabajo
 * Portada de eurotaller-cassano/src/pages/ot/OTListPage.tsx
 * Stack: React 19 + TanStack Query + useOfflineQuery + api.js
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Wrench, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import { useOfflineQuery } from "../../lib/useOfflineQuery";
import {
  ESTADO_OT_LABEL,
  ESTADO_OT_COLOR,
  TODOS_LOS_ESTADOS,
  ESTADOS_ACTIVOS,
  toUIStatus,
} from "../../lib/ot-machine";
import { diasDesde, formatARS } from "../../lib/utils-ar";

export default function OTListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const estadoFiltro = searchParams.get("estado") || null;
  const [busqueda, setBusqueda] = useState("");

  // Construir parámetros de query para el backend
  const queryParams = estadoFiltro
    ? `?limit=100&ordering=-created_at`
    : `?active=true&limit=100&ordering=-created_at`;

  const { data, isLoading, isError } = useOfflineQuery(
    ["work-orders", estadoFiltro],
    () => api.get(`/work-orders/${queryParams}`),
    "catalogOTs",
    { staleTime: 60 * 1000 }
  );

  // El backend puede devolver { items: [...] } o directamente un array
  const allOTs = Array.isArray(data) ? data : (data?.items ?? []);

  // Filtrar por estado UI si hay filtro activo
  const otsPorEstado = estadoFiltro
    ? allOTs.filter((o) => toUIStatus(o.status) === estadoFiltro)
    : allOTs.filter((o) => ESTADOS_ACTIVOS.includes(toUIStatus(o.status)));

  // Filtro de búsqueda local (patente, vehículo, cliente, número)
  const otsFiltradas = busqueda
    ? otsPorEstado.filter((o) => {
        const q = busqueda.toLowerCase();
        const vehiculo = `${o.brand ?? ""} ${o.model ?? ""}`.toLowerCase();
        return (
          (o.plate ?? "").toLowerCase().includes(q) ||
          vehiculo.includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.number ?? "").toLowerCase().includes(q)
        );
      })
    : otsPorEstado;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1>
        </div>
        <Link
          to="/taller/ot/nueva"
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva OT
        </Link>
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSearchParams({})}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !estadoFiltro
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          En proceso
        </button>
        {TODOS_LOS_ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => setSearchParams({ estado: e })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              estadoFiltro === e
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {ESTADO_OT_LABEL[e]}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por patente, vehículo, cliente o N° OT…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : isError ? (
          <div className="py-12 text-center text-red-400">
            <p className="font-medium">Error al cargar OTs</p>
            <p className="text-xs mt-1">Mostrando datos locales si están disponibles</p>
          </div>
        ) : otsFiltradas.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No hay órdenes de trabajo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                  <th className="px-5 py-3">N° OT</th>
                  <th className="px-5 py-3">Vehículo</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Mecánico</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Días</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {otsFiltradas.map((ot) => {
                  const uiStatus = toUIStatus(ot.status);
                  const dias = diasDesde(ot.received_at ?? ot.created_at);
                  const total = ot.final_total ?? ot.estimated_total ?? 0;
                  return (
                    <tr key={ot.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link
                          to={`/taller/ot/${ot.id}`}
                          className="font-mono font-semibold text-orange-600 hover:underline"
                        >
                          {ot.number}
                        </Link>
                        {ot.offline_id && !ot.synced_at && (
                          <span className="ml-1 text-xs text-amber-500" title="Pendiente de sync">⏳</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold">{ot.plate ?? "—"}</p>
                        <p className="text-gray-500 text-xs">
                          {[ot.brand, ot.model, ot.year].filter(Boolean).join(" ")}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{ot.customer_name ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        {ot.assigned_mechanic_name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            ESTADO_OT_COLOR[uiStatus] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ESTADO_OT_LABEL[uiStatus] ?? ot.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={
                            dias > 7
                              ? "text-red-600 font-medium"
                              : dias > 3
                              ? "text-yellow-600"
                              : "text-gray-500"
                          }
                        >
                          {dias}d
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">
                        {total > 0 ? formatARS(total) : "—"}
                      </td>
                      <td className="px-2 py-3">
                        <Link to={`/taller/ot/${ot.id}`} className="text-gray-400 hover:text-gray-600">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{otsFiltradas.length} registros</p>
    </div>
  );
}
