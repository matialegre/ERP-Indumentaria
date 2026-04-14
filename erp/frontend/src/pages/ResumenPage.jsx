import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  Layers,
} from "lucide-react";

const SEMAFORO_CONFIG = {
  VERDE: { label: "Verde", color: "bg-green-500", bg: "bg-green-50" },
  AMARILLO: { label: "Amarillo", color: "bg-yellow-400", bg: "bg-yellow-50" },
  ROJO: { label: "Rojo", color: "bg-red-500", bg: "bg-red-50" },
  GRIS: { label: "Sin unidades", color: "bg-gray-400", bg: "bg-gray-50" },
};

const TYPE_CONFIG = {
  PRECOMPRA: { label: "PRE", color: "bg-indigo-100 text-indigo-700" },
  REPOSICION: { label: "REP", color: "bg-teal-100 text-teal-700" },
  CAMBIO: { label: "CAM", color: "bg-amber-100 text-amber-700" },
};

const TABLE_HEADERS = [
  { label: "" },
  { label: "Estado" },
  { label: "NP" },
  { label: "Proveedor" },
  { label: "Local" },
  { label: "Pedido", align: "right" },
  { label: "Facturado", align: "right" },
  { label: "Remitido", align: "right" },
  { label: "Ingresado", align: "right" },
  { label: "Días", align: "center" },
  { label: "Docs", align: "center" },
  { label: "RV", align: "center" },
];

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

function getEstadoTexto(order) {
  const { semaforo, alert_state, status } = order;
  if (status === "COMPLETADO" || status === "ANULADO")
    return { label: status, color: "bg-gray-100 text-gray-600" };
  if (alert_state === "SIN_NADA")
    return { label: "Sin docs", color: "bg-gray-100 text-gray-500" };
  if (alert_state === "SIN_RV")
    return { label: "Tránsito", color: "bg-blue-100 text-blue-700" };
  if (alert_state === "SOLO_FALTA_FAC")
    return { label: "Falta factura", color: "bg-red-100 text-red-700" };
  if (alert_state === "SOLO_FALTA_REM")
    return { label: "Falta remito", color: "bg-orange-100 text-orange-700" };
  if (alert_state === "INCOMPLETO")
    return { label: "Incompleto", color: "bg-amber-100 text-amber-700" };
  if (alert_state === "ANP")
    return { label: "ANP ✓", color: "bg-purple-100 text-purple-700" };
  if (semaforo === "VERDE")
    return { label: "✓ Listo", color: "bg-green-100 text-green-700" };
  if (semaforo === "AMARILLO")
    return { label: "Para confirmar", color: "bg-yellow-100 text-yellow-700" };
  return { label: "En proceso", color: "bg-blue-100 text-blue-700" };
}

export default function ResumenPage() {
  // Filter states
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLocal, setFilterLocal] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterProvider, setFilterProvider] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [groupByLocal, setGroupByLocal] = useState(false);

  // UI states
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [expandedLocals, setExpandedLocals] = useState(new Set());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["resumen-integrado"],
    queryFn: async () => {
      const result = await api.get("/purchase-orders/vista-integrada");
      setLastRefresh(new Date());
      return result;
    },
    refetchInterval: 10000,
  });

  const { data: localesData } = useQuery({
    queryKey: ["locales-filter"],
    queryFn: () => api.get("/locals/"),
    staleTime: 5 * 60 * 1000,
  });

  const orders = data?.orders || [];
  const stats = data?.stats || {};

  const displayed = useMemo(() => {
    let result = orders;
    if (filterStatus !== "all")
      result = result.filter(
        (o) => o.semaforo?.toLowerCase() === filterStatus
      );
    if (filterLocal !== "all")
      result = result.filter((o) => String(o.local_id) === filterLocal);
    if (filterType !== "all")
      result = result.filter((o) => o.type === filterType);
    if (filterProvider) {
      const q = filterProvider.toLowerCase();
      result = result.filter((o) =>
        o.provider_name?.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case "date_asc":
        result = [...result].sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
      case "provider":
        result = [...result].sort((a, b) =>
          (a.provider_name || "").localeCompare(b.provider_name || "")
        );
        break;
      case "local":
        result = [...result].sort((a, b) =>
          (a.local_name || "").localeCompare(b.local_name || "")
        );
        break;
      default:
        result = [...result].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return result;
  }, [orders, filterStatus, filterLocal, filterType, filterProvider, sortBy]);

  const groupedByLocal = useMemo(() => {
    if (!groupByLocal) return null;
    const groups = {};
    for (const order of displayed) {
      const key = order.local_name || "Sin local";
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [displayed, groupByLocal]);

  const hasActiveFilters =
    filterLocal !== "all" ||
    filterType !== "all" ||
    filterProvider !== "" ||
    filterStatus !== "all";

  const clearFilters = () => {
    setFilterLocal("all");
    setFilterType("all");
    setFilterProvider("");
    setFilterStatus("all");
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLocal = (name) => {
    setExpandedLocals((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const renderOrderRow = (order) => {
    const sem = SEMAFORO_CONFIG[order.semaforo] || SEMAFORO_CONFIG.GRIS;
    const isExpanded = expandedIds.has(order.id);
    const diasColor =
      order.dias > 30
        ? "bg-red-100 text-red-700"
        : order.dias > 15
        ? "bg-orange-100 text-orange-700"
        : order.dias > 7
        ? "bg-yellow-100 text-yellow-700"
        : "bg-green-100 text-green-700";
    const factPct = pct(order.qty_facturado, order.qty_ordered);
    const remPct = pct(order.qty_remitido, order.qty_ordered);
    const ingPct = pct(order.qty_ingresado, order.qty_ordered);
    const estado = getEstadoTexto(order);
    const typeConf = TYPE_CONFIG[order.type];

    return (
      <React.Fragment key={order.id}>
        <tr
          className={`hover:bg-gray-50/80 cursor-pointer transition-colors ${sem.bg}`}
          onClick={() => toggleExpand(order.id)}
        >
          <td className="p-2 text-center text-gray-400">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </td>
          {/* Semaforo dot + estado badge */}
          <td className="px-2 py-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${sem.color}`}
                title={sem.label}
              />
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${estado.color}`}
              >
                {estado.label}
              </span>
            </div>
          </td>
          {/* NP + type badge + ANP badge */}
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-semibold text-gray-900 text-xs">
                {order.prefix ? `${order.prefix}-` : ""}
                {order.number}
              </span>
              {order.accepted_difference && (
                <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                  ANP
                </span>
              )}
              {typeConf && (
                <span
                  className={`px-1 py-0.5 rounded text-[10px] font-medium ${typeConf.color}`}
                >
                  {typeConf.label}
                </span>
              )}
            </div>
          </td>
          <td className="px-3 py-2.5 text-gray-700 max-w-[160px] truncate text-sm">
            {order.provider_name}
          </td>
          <td className="px-3 py-2.5 text-gray-500 text-xs">
            {order.local_name || "—"}
          </td>
          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
            {order.qty_ordered}
          </td>
          <td className="px-3 py-2.5 text-right">
            <span
              className={
                factPct >= 100
                  ? "text-green-700 font-semibold"
                  : factPct > 0
                  ? "text-yellow-700"
                  : "text-red-600"
              }
            >
              {order.qty_facturado}{" "}
              <span className="text-xs text-gray-400">({factPct}%)</span>
            </span>
          </td>
          <td className="px-3 py-2.5 text-right">
            <span
              className={
                remPct >= 100
                  ? "text-green-700 font-semibold"
                  : remPct > 0
                  ? "text-yellow-700"
                  : "text-red-600"
              }
            >
              {order.qty_remitido}{" "}
              <span className="text-xs text-gray-400">({remPct}%)</span>
            </span>
          </td>
          {/* Ingresado: value + mini progress bar */}
          <td className="px-3 py-2.5 text-right">
            <div className="flex flex-col items-end gap-0.5">
              <span
                className={
                  ingPct >= 100
                    ? "text-green-700 font-semibold text-xs"
                    : ingPct > 0
                    ? "text-yellow-700 text-xs"
                    : "text-gray-400 text-xs"
                }
              >
                {order.qty_ingresado}{" "}
                <span className="text-[10px] text-gray-400">({ingPct}%)</span>
              </span>
              <div className="w-14 bg-gray-200 rounded-full h-1">
                <div
                  className={`h-1 rounded-full ${
                    ingPct >= 100
                      ? "bg-green-500"
                      : ingPct > 0
                      ? "bg-yellow-400"
                      : "bg-gray-300"
                  }`}
                  style={{ width: `${Math.min(ingPct, 100)}%` }}
                />
              </div>
            </div>
          </td>
          <td className="px-3 py-2.5 text-center">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${diasColor}`}>
              {order.dias}d
            </span>
          </td>
          <td className="px-3 py-2.5 text-center text-gray-600 text-xs">
            {order.docs_count}
          </td>
          <td className="px-3 py-2.5 text-center">
            {order.docs_sin_rv > 0 ? (
              <span className="text-xs text-orange-600 font-medium">
                ⚠️ {order.docs_sin_rv}
              </span>
            ) : (
              <span className="text-xs text-green-600">✓</span>
            )}
          </td>
        </tr>

        {/* Invoice sub-rows (visible when expanded) */}
        {isExpanded && order.invoices?.length > 0 && (
          <>
            <tr className="bg-blue-50/60 border-t border-blue-100">
              <td colSpan={12} className="px-8 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                  Documentos vinculados ({order.invoices.length})
                </span>
              </td>
            </tr>
            {order.invoices.map((inv) => {
              const tipoLabel = inv.tipo === "FACTURA" ? "FAC" : inv.tipo === "REMITO" ? "REM" : inv.tipo === "REMITO_FACTURA" ? "REM/FAC" : (inv.tipo || "DOC");
              const semDot = inv.estado_semaforo === "VERDE" ? "bg-green-500" : inv.estado_semaforo === "AMARILLO" ? "bg-yellow-400" : "bg-red-400";
              return (
                <tr key={inv.id} className="bg-blue-50/30 hover:bg-blue-50/60 border-t border-blue-100/40 text-xs">
                  <td colSpan={2} />
                  <td className="px-4 py-1.5 pl-10">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${semDot}`} />
                      <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                        inv.tipo === "FACTURA" ? "bg-blue-100 text-blue-700" :
                        inv.tipo === "REMITO" ? "bg-orange-100 text-orange-700" :
                        "bg-purple-100 text-purple-700"
                      }`}>{tipoLabel}</span>
                      <span className="font-mono text-gray-700">{inv.numero}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-gray-500">{inv.fecha || "—"}</td>
                  <td colSpan={4} className="px-3 py-1.5 text-gray-500">
                    {inv.amount ? `$${Number(inv.amount).toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td colSpan={2} className="px-3 py-1.5 text-gray-500 font-mono">
                    RV: {inv.rv_numero || <span className="text-orange-500">⚠ Sin RV</span>}
                  </td>
                  <td colSpan={2} className="px-3 py-1.5">
                    <div className="flex gap-2">
                      {inv.confirmado_local_at && <span className="text-green-600">✓ Local</span>}
                      {inv.confirmado_admin_at && <span className="text-blue-600">✓ Admin</span>}
                      {!inv.confirmado_local_at && !inv.confirmado_admin_at && <span className="text-gray-400">Sin confirmar</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </>
        )}

        {/* Expanded details panel */}
        {isExpanded && (
          <tr className="bg-blue-50">
            <td colSpan={12} className="px-6 py-3">
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Progreso</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Facturado", p: factPct, color: "bg-blue-500" },
                      { label: "Remitido", p: remPct, color: "bg-purple-500" },
                      { label: "Ingresado", p: ingPct, color: "bg-green-500" },
                    ].map(({ label, p, color }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="w-16 text-right">{label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${color}`}
                            style={{ width: `${Math.min(p, 100)}%` }}
                          />
                        </div>
                        <span className="w-8 font-medium">{p}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Detalles</p>
                  <p>
                    Tipo: <span className="font-medium">{order.type}</span>
                  </p>
                  <p>
                    Estado: <span className="font-medium">{order.status}</span>
                  </p>
                  <p>
                    Fecha: <span className="font-medium">{order.date}</span>
                  </p>
                  {order.total_amount && (
                    <p>
                      Importe:{" "}
                      <span className="font-medium">
                        ${order.total_amount.toLocaleString("es-AR")}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Documentos</p>
                  <p>
                    Total: <span className="font-medium">{order.docs_count}</span>
                  </p>
                  <p>
                    Con RV:{" "}
                    <span className="font-medium text-green-600">
                      {order.docs_con_rv}
                    </span>
                  </p>
                  <p>
                    Sin RV:{" "}
                    <span
                      className={`font-medium ${
                        order.docs_sin_rv > 0 ? "text-orange-600" : "text-green-600"
                      }`}
                    >
                      {order.docs_sin_rv}
                    </span>
                  </p>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Resumen Integrado</h1>
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {displayed.length} de {orders.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Actualización automática cada 10s · Última:{" "}
            {lastRefresh.toLocaleTimeString()}
            {isFetching && (
              <span className="ml-2 text-blue-500">↻ actualizando...</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGroupByLocal((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              groupByLocal
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Layers size={14} />
            {groupByLocal ? "Vista agrupada" : "Agrupar por local"}
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            key: "verde",
            label: "Completas",
            icon: CheckCircle2,
            color: "text-green-600",
            bg: "bg-green-50 border-green-200",
          },
          {
            key: "amarillo",
            label: "Parciales",
            icon: AlertTriangle,
            color: "text-yellow-600",
            bg: "bg-yellow-50 border-yellow-200",
          },
          {
            key: "rojo",
            label: "Sin docs",
            icon: XCircle,
            color: "text-red-600",
            bg: "bg-red-50 border-red-200",
          },
          {
            key: "sin_rv",
            label: "Sin RV",
            icon: AlertTriangle,
            color: "text-orange-600",
            bg: "bg-orange-50 border-orange-200",
          },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => {
              if (key === "sin_rv") return;
              setFilterStatus((prev) => (prev === key ? "all" : key));
            }}
            className={`p-3 rounded-lg border text-left transition-all ${bg} ${
              filterStatus === key ? "ring-2 ring-offset-1 ring-blue-500" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon size={16} className={color} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{stats[key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="relative flex-1 min-w-40">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            placeholder="Filtrar proveedor..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <select
          value={filterLocal}
          onChange={(e) => setFilterLocal(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none max-w-40 bg-white"
        >
          <option value="all">Todos los locales</option>
          {(localesData?.items || localesData || []).map((l) => (
            <option key={l.id} value={String(l.id)}>
              {l.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {[
            ["all", "Todos"],
            ["PRECOMPRA", "Pre"],
            ["REPOSICION", "Repo"],
            ["CAMBIO", "Cambio"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterType(v)}
              className={`px-2.5 py-1.5 font-medium transition ${
                filterType === v
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 bg-white"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {[
            ["all", "Todos"],
            ["verde", "✅ OK"],
            ["amarillo", "⚠️ Parcial"],
            ["rojo", "❌ Sin docs"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`px-2.5 py-1.5 font-medium transition ${
                filterStatus === v
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 bg-white"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white"
        >
          <option value="date_desc">Más reciente</option>
          <option value="date_asc">Más antiguo</option>
          <option value="provider">Proveedor A-Z</option>
          <option value="local">Local A-Z</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : groupByLocal && groupedByLocal ? (
        /* Grouped by local view */
        <div className="space-y-2">
          {groupedByLocal.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No hay notas activas
            </div>
          )}
          {groupedByLocal.map(([localName, localOrders]) => {
            const isOpen = expandedLocals.has(localName);
            const verdeCnt = localOrders.filter((o) => o.semaforo === "VERDE").length;
            const rojoCnt = localOrders.filter((o) => o.semaforo === "ROJO").length;
            return (
              <div
                key={localName}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleLocal(localName)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    <span className="font-semibold">{localName}</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                      {localOrders.length} nota
                      {localOrders.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {verdeCnt > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-300" />
                        {verdeCnt} lista{verdeCnt !== 1 ? "s" : ""}
                      </span>
                    )}
                    {rojoCnt > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-300" />
                        {rojoCnt} sin docs
                      </span>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {TABLE_HEADERS.map((h, i) => (
                          <th
                            key={i}
                            className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide ${
                              h.align === "right"
                                ? "text-right"
                                : h.align === "center"
                                ? "text-center"
                                : "text-left"
                            } ${i === 0 ? "w-8 p-2" : ""}`}
                          >
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {localOrders.map((order) => renderOrderRow(order))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat table view */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {TABLE_HEADERS.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide ${
                      h.align === "right"
                        ? "text-right"
                        : h.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${i === 0 ? "w-8 p-2" : ""}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-gray-400">
                    No hay notas activas
                  </td>
                </tr>
              )}
              {displayed.map((order) => renderOrderRow(order))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            {displayed.length} nota{displayed.length !== 1 ? "s" : ""} activa
            {displayed.length !== 1 ? "s" : ""}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-2 text-blue-500 hover:underline"
              >
                × Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
