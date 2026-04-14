import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  CheckSquare, Search, Download, ChevronDown, ChevronUp, MapPin,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function exportCSV(grouped) {
  const rows = [["Local","N° Pedido","Proveedor","Tipo","Fecha","Pedido","Recibido","Facturado","Docs"]];
  grouped.forEach(([local, orders]) => {
    orders.forEach((o) => {
      rows.push([
        local,
        `${o.prefix ? o.prefix + "-" : ""}${o.number || o.id}`,
        o.provider_name || "",
        o.type || "",
        o.date ? new Date(o.date).toLocaleDateString("es-AR") : "",
        o.total_ordered ?? "",
        o.total_received ?? "",
        o.total_invoiced ?? "",
        o.invoice_count ?? 0,
      ]);
    });
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `completados-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── LocalGroup ──────────────────────────────────────────────────────────── */
function LocalGroup({ local, orders, expanded, onToggle }) {
  const totalOrdered = orders.reduce((s, o) => s + (o.total_ordered || 0), 0);
  const totalReceived = orders.reduce((s, o) => s + (o.total_received || 0), 0);
  const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition"
      >
        <div className="flex items-center gap-3">
          <MapPin size={16} className="text-green-600" />
          <span className="font-semibold text-gray-800">{local}</span>
          <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-xs font-medium">
            {orders.length} NP{orders.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500">{pct}% recibido</span>
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                <th className="px-3 py-2 text-left">N° Pedido</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-right">Pedido</th>
                <th className="px-3 py-2 text-right">Recibido</th>
                <th className="px-3 py-2 text-right">Facturado</th>
                <th className="px-3 py-2 text-center">Docs</th>
                <th className="px-3 py-2 text-center">Alerta</th>
                <th className="px-3 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── OrderRow ────────────────────────────────────────────────────────────── */
function OrderRow({ order }) {
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${order.id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["completados"] }),
  });

  const dateStr = order.date
    ? new Date(order.date).toLocaleDateString("es-AR")
    : "—";
  const pct =
    order.total_ordered > 0
      ? Math.round(((order.total_received || 0) / order.total_ordered) * 100)
      : 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2 font-mono text-blue-700 font-semibold text-xs">
        {order.prefix ? `${order.prefix}-` : ""}
        {order.number || order.id}
      </td>
      <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate" title={order.provider_name}>
        {order.provider_name || "—"}
      </td>
      <td className="px-3 py-2">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            order.type === "PRECOMPRA"
              ? "bg-purple-100 text-purple-700"
              : order.type === "REPOSICION"
              ? "bg-blue-100 text-blue-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          {order.type || "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-gray-500 text-xs">{dateStr}</td>
      <td className="px-3 py-2 text-right font-medium">{order.total_ordered ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <span
          className={
            pct >= 100
              ? "text-green-600 font-medium"
              : pct >= 80
              ? "text-amber-600"
              : "text-red-600"
          }
        >
          {order.total_received ?? "—"}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-gray-500">{order.total_invoiced ?? "—"}</td>
      <td className="px-3 py-2 text-center text-xs text-gray-500">{order.invoice_count ?? 0}</td>
      <td className="px-3 py-2 text-center">
        {order.accepted_difference && (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">
            ANP
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <button
          onClick={() => archiveMutation.mutate()}
          disabled={archiveMutation.isPending}
          className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-100 transition disabled:opacity-50"
          title="Archivar"
        >
          Archivar
        </button>
      </td>
    </tr>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function CompletadosPage() {
  const [search, setSearch] = useState("");
  const [expandedLocals, setExpandedLocals] = useState(new Set());
  const [activeTab, setActiveTab] = useState("completados");
  const [diasFilter, setDiasFilter] = useState("all");

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["completados"],
    queryFn: () => api.get("/purchase-orders/?status=COMPLETADO&limit=500"),
    staleTime: 2 * 60 * 1000,
  });

  const { data: recibidosData } = useQuery({
    queryKey: ["recibidos"],
    queryFn: () => api.get("/purchase-orders/?status=RECIBIDO&limit=200"),
    staleTime: 2 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    const orders =
      activeTab === "completados"
        ? ordersData?.items || []
        : recibidosData?.items || [];

    const filtered = orders.filter((o) => {
      const matchSearch =
        !search ||
        o.number?.toLowerCase().includes(search.toLowerCase()) ||
        o.provider_name?.toLowerCase().includes(search.toLowerCase()) ||
        (o.prefix + "-" + o.number)?.toLowerCase().includes(search.toLowerCase());

      const matchDias =
        diasFilter === "all" ||
        (() => {
          const dias = (Date.now() - new Date(o.date)) / 86400000;
          return dias <= parseInt(diasFilter);
        })();

      return matchSearch && matchDias;
    });

    const groups = {};
    filtered.forEach((o) => {
      const local = o.local_name || "Sin local";
      if (!groups[local]) groups[local] = [];
      groups[local].push(o);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [ordersData, recibidosData, search, activeTab, diasFilter]);

  // Auto-expand first 3 groups on load
  useEffect(() => {
    if (grouped.length > 0) {
      setExpandedLocals(new Set(grouped.slice(0, 3).map(([local]) => local)));
    }
  }, [grouped.length]);

  const totalOrders = grouped.reduce((s, [, o]) => s + o.length, 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare size={24} className="text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Completados</h1>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            {totalOrders} órdenes
          </span>
        </div>
        <button
          onClick={() => exportCSV(grouped)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition"
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "completados", label: "Completados", count: ordersData?.items?.length },
          { id: "recibidos", label: "Recibidos (pendiente cierre)", count: recibidosData?.items?.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === t.id
                ? "border-green-600 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por NP, proveedor..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {[["all","Todos"],["30","30d"],["90","90d"],["180","180d"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setDiasFilter(v)}
              className={`px-3 py-2 text-xs font-medium transition ${
                diasFilter === v ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpandedLocals(new Set(grouped.map(([l]) => l)))}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Expandir todo
        </button>
        <button
          onClick={() => setExpandedLocals(new Set())}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Colapsar
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([local, orders]) => (
            <LocalGroup
              key={local}
              local={local}
              orders={orders}
              expanded={expandedLocals.has(local)}
              onToggle={() =>
                setExpandedLocals((prev) => {
                  const next = new Set(prev);
                  next.has(local) ? next.delete(local) : next.add(local);
                  return next;
                })
              }
            />
          ))}
          {grouped.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No hay órdenes completadas que coincidan con el filtro.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
