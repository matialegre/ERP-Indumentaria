/**
 * TallerDashboard — Dashboard del módulo taller (EuroTaller)
 * Portada de eurotaller-cassano/src/pages/DashboardPage.tsx
 * Stack: React 19 + TanStack Query + api.js
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench, CheckCircle2, AlertTriangle, TrendingUp,
  Car, ArrowRight, RefreshCw,
} from "lucide-react";
import { api } from "../../lib/api";
import { isOnline } from "../../lib/offlineSync";
import StatCard from "../../components/ui/StatCard";
import { ESTADO_OT_LABEL, ESTADO_OT_COLOR, ESTADOS_ACTIVOS, toUIStatus } from "../../lib/ot-machine";
import { formatARS, diasDesde } from "../../lib/utils-ar";

export default function TallerDashboard() {
  // OTs activas (para conteo y tabla)
  const { data: otsData, isLoading: loadingOTs, refetch } = useQuery({
    queryKey: ["taller-ots-activas"],
    queryFn: () => api.get("/work-orders/?active=true&limit=50&ordering=received_at"),
    staleTime: 60 * 1000,
    refetchInterval: isOnline() ? 2 * 60 * 1000 : false,
  });

  // Stock crítico / resumen
  const { data: stockSummary } = useQuery({
    queryKey: ["taller-stock-summary"],
    queryFn: () => api.get("/stock/summary"),
    staleTime: 5 * 60 * 1000,
    retry: false, // no crítico si falla
  });

  // Facturación del mes
  const { data: salesData } = useQuery({
    queryKey: ["taller-sales-mes"],
    queryFn: () => {
      const inicioMes = new Date().toISOString().slice(0, 7) + "-01";
      return api.get(`/sales/?date_from=${inicioMes}&status=PAGADA`);
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    select: (data) => {
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      return items.reduce((s, c) => s + (c.total ?? 0), 0);
    },
  });

  const allOTs = Array.isArray(otsData) ? otsData : (otsData?.items ?? []);
  const otsActivas = allOTs.filter((o) => ESTADOS_ACTIVOS.includes(toUIStatus(o.status)));
  const otsListas  = allOTs.filter((o) => toUIStatus(o.status) === "listo");

  // OTs más antiguas primero (las que llevan más días)
  const otsRecientes = [...otsActivas]
    .sort((a, b) => new Date(a.received_at ?? a.created_at) - new Date(b.received_at ?? b.created_at))
    .slice(0, 8);

  const hoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Taller</h1>
          <p className="text-sm text-gray-500 capitalize">{hoy}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline() && (
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full border border-amber-200">
              Offline
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="OTs en proceso"
          value={loadingOTs ? "…" : otsActivas.filter((o) => toUIStatus(o.status) !== "listo").length}
          icon={Wrench}
          color="blue"
          link="/taller/ot"
        />
        <StatCard
          label="Listas para entregar"
          value={loadingOTs ? "…" : otsListas.length}
          icon={CheckCircle2}
          color="green"
          link="/taller/ot?estado=listo"
        />
        <StatCard
          label="Stock crítico"
          value={stockSummary?.critical_count ?? "—"}
          icon={AlertTriangle}
          color={stockSummary?.critical_count ? "red" : "gray"}
          link="/taller/stock"
        />
        <StatCard
          label="Facturación del mes"
          value={salesData != null ? formatARS(salesData) : "—"}
          icon={TrendingUp}
          color="orange"
          link="/facturacion"
          isText
        />
      </div>

      {/* OTs abiertas */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-500" />
            Órdenes de Trabajo abiertas
          </h2>
          <Link
            to="/taller/ot"
            className="text-sm text-orange-600 hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loadingOTs ? (
          <div className="py-8 text-center text-gray-400 text-sm">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b bg-gray-50">
                  <th className="px-5 py-3">N° OT</th>
                  <th className="px-5 py-3">Vehículo</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Días</th>
                </tr>
              </thead>
              <tbody>
                {otsRecientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      No hay órdenes abiertas 🎉
                    </td>
                  </tr>
                ) : (
                  otsRecientes.map((ot) => {
                    const uiStatus = toUIStatus(ot.status);
                    const dias = diasDesde(ot.received_at ?? ot.created_at);
                    return (
                      <tr key={ot.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono font-medium">
                          <Link to={`/taller/ot/${ot.id}`} className="text-orange-600 hover:underline">
                            {ot.number}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium">{ot.plate ?? "—"}</p>
                          <p className="text-gray-500 text-xs">
                            {[ot.brand, ot.model].filter(Boolean).join(" ")}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{ot.customer_name ?? "—"}</td>
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
                              dias > 7 ? "text-red-600 font-medium" : dias > 3 ? "text-yellow-600" : "text-gray-500"
                            }
                          >
                            {dias}d
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alertas rápidas */}
      {otsListas.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {otsListas.length} vehículo{otsListas.length > 1 ? "s" : ""} listo{otsListas.length > 1 ? "s" : ""} para retirar
            </p>
            <p className="text-xs text-green-600">
              {otsListas.map((o) => o.plate ?? o.number).join(", ")}
            </p>
          </div>
          <Link
            to="/taller/ot?estado=listo"
            className="ml-auto text-xs text-green-700 hover:underline flex items-center gap-1 shrink-0"
          >
            Ver <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
