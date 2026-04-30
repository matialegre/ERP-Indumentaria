import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SERVER_BASE } from "../lib/api";
import {
  CheckSquare, Search, Download, ChevronDown, ChevronUp, MapPin,
  RefreshCw, FileText, RotateCcw, AlertTriangle, ChevronRight,
} from "lucide-react";
import PdfViewer from "../components/PdfViewer";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function conDifFrom(order) {
  const hayDif = order.total_ordered > 0 && order.total_received !== order.total_ordered;
  return order.accepted_difference || hayDif;
}

function exportCSV(grouped) {
  const rows = [["Local","N° Pedido","Proveedor","Tipo","Fecha","Pedido","Recibido","Facturado","Docs","Con Diferencia"]];
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
        o._conDif ? "Sí" : "No",
      ]);
    });
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `completados-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── InvoicesDocs: docs nivel-3 de una nota (lazy fetch) ─────────────────── */
function InvoicesDocs({ orderId, onRvClick, onPdfClick }) {
  const { data, isLoading } = useQuery({
    queryKey: ["order-invoices", orderId],
    queryFn: () => api.get(`/purchase-invoices/?purchase_order_id=${orderId}&limit=50`),
    staleTime: 2 * 60 * 1000,
  });
  const invoices = data?.items ?? [];

  const semBadge = (inv) => {
    if (inv.confirmado_admin_at) return { label: "✓ OK", cls: "bg-green-100 text-green-800" };
    if (inv.confirmado_local_at) return { label: "Local ✓", cls: "bg-amber-100 text-amber-800" };
    return { label: "Auto", cls: "bg-blue-100 text-blue-800" };
  };
  const typeLabel = (t) =>
    t === "REMITO" ? "REM" : t === "REMITO_FACTURA" ? "R/F" : "FAC";
  const typeCls = (t) =>
    t === "REMITO"
      ? "bg-orange-100 text-orange-700"
      : t === "REMITO_FACTURA"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";

  if (isLoading)
    return <div className="py-3 text-center text-xs text-gray-400">Cargando documentos...</div>;
  if (invoices.length === 0)
    return <div className="py-3 text-center text-xs text-gray-400">Sin documentos registrados</div>;

  return (
    <table className="w-full text-[11px]">
      <thead className="bg-gray-50/80 border-b border-t">
        <tr>
          <th className="text-center px-2 py-1 w-[55px]">Estado</th>
          <th className="text-left px-2 py-1 w-[40px]">Tipo</th>
          <th className="text-left px-2 py-1 w-[68px]">Fecha</th>
          <th className="text-left px-2 py-1">N° Doc.</th>
          <th className="text-left px-2 py-1 w-[90px]">RV</th>
          <th className="text-center px-2 py-1 w-[45px]">Cant.</th>
          <th className="text-center px-2 py-1 w-[45px]">PDFs</th>
          <th className="text-left px-2 py-1">Obs. local</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {invoices.map((inv) => {
          const sem = semBadge(inv);
          const qty = inv.items?.reduce((s, it) => s + (it.quantity_invoiced || 0), 0) ?? "—";
          return (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-2 py-1 text-center">
                <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 ${sem.cls}`}>{sem.label}</span>
              </td>
              <td className="px-2 py-1">
                <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 ${typeCls(inv.type)}`}>
                  {typeLabel(inv.type)}
                </span>
              </td>
              <td className="px-2 py-1 text-gray-500">
                {inv.date ? new Date(inv.date).toLocaleDateString("es-AR") : "—"}
              </td>
              <td className="px-2 py-1 font-mono text-[10px]">{inv.number || "—"}</td>
              <td className="px-2 py-1 text-green-700 font-medium">
                {inv.remito_venta_number ? (
                  inv.remito_venta_number
                ) : (
                  <button
                    onClick={() => onRvClick({ invoiceId: inv.id, invoiceNumber: inv.number })}
                    className="bg-red-100 text-red-600 px-1 py-0.5 rounded text-[9px] font-bold hover:bg-red-200 cursor-pointer"
                    title="Sin RV — click para cargar"
                  >
                    !RV
                  </button>
                )}
              </td>
              <td className="px-2 py-1 text-center font-bold">{qty}</td>
              <td className="px-2 py-1 text-center">
                <div className="flex gap-0.5 justify-center">
                  {inv.pdf_file ? (
                    <button
                      onClick={() => onPdfClick({ url: `${SERVER_BASE}${inv.pdf_file}`, filename: `${typeLabel(inv.type)}-${inv.number || inv.id}.pdf` })}
                      className="p-0.5 text-blue-500 hover:bg-blue-100 rounded"
                      title="Ver PDF"
                    >
                      <FileText className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </div>
              </td>
              <td className="px-2 py-1 text-[10px] text-yellow-700 truncate max-w-[120px]">
                {inv.local_obs ? `💬 ${inv.local_obs}` : <span className="text-gray-300">-</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── OrderRow ─────────────────────────────────────────────────────────────── */
function OrderRow({ order, onRvClick, onPdfClick, onReopen }) {
  const [docsOpen, setDocsOpen] = useState(false);

  const dateStr = order.date ? new Date(order.date).toLocaleDateString("es-AR") : "—";
  const pct =
    order.total_ordered > 0
      ? Math.round(((order.total_received || 0) / order.total_ordered) * 100)
      : 0;

  const hayDifReal =
    order.total_ordered > 0 && order.total_received !== order.total_ordered;
  const conDif = order._conDif;
  const headerBg = "bg-green-50 border-green-300 text-green-900";

  return (
    <>
      {/* Nota header row */}
      <tr
        className={`cursor-pointer border-l-4 ${headerBg} hover:bg-green-100`}
        onClick={() => setDocsOpen((o) => !o)}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            {docsOpen ? (
              <ChevronDown size={12} className="shrink-0 text-green-700" />
            ) : (
              <ChevronRight size={12} className="shrink-0 text-green-700" />
            )}
            <span className="font-bold text-xs font-mono text-blue-700">
              {order.prefix ? `${order.prefix}-` : ""}{order.number || order.id}
            </span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-gray-700 max-w-[150px] truncate" title={order.provider_name}>
          {order.provider_name || "—"}
        </td>
        <td className="px-3 py-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            order.type === "PRECOMPRA"
              ? "bg-purple-100 text-purple-700"
              : order.type === "REPOSICION"
              ? "bg-blue-100 text-blue-700"
              : "bg-orange-100 text-orange-700"
          }`}>
            {order.type === "PRECOMPRA" ? "PRE" : order.type === "REPOSICION" ? "REP" : order.type || "—"}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">{dateStr}</td>
        <td className="px-3 py-2 text-right text-xs font-medium">{order.total_ordered ?? "—"}</td>
        <td className="px-3 py-2 text-right text-xs">
          <span className={pct >= 100 ? "text-green-600 font-medium" : pct >= 80 ? "text-amber-600" : "text-red-600"}>
            {order.total_received ?? "—"}
          </span>
        </td>
        <td className="px-3 py-2 text-right text-xs text-gray-500">{order.total_invoiced ?? "—"}</td>
        <td className="px-3 py-2 text-center text-xs text-gray-500">{order.invoice_count ?? 0}</td>
        <td className="px-3 py-2 text-center">
          {conDif && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              order.accepted_difference ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700"
            }`}>
              {order.accepted_difference ? "ANP" : "DIF"}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-center text-[10px] text-gray-500">
          {order.total_ordered > 0 && `${order.total_ordered}u`}
        </td>
      </tr>

      {/* Expanded: docs + actions */}
      {docsOpen && (
        <tr>
          <td colSpan={10} className="p-0 bg-white border-l-4 border-green-300">
            <div className="pl-4">
              {/* Difference banner */}
              {conDif && (
                <div className={`mx-1 mt-2 mb-1 border rounded px-3 py-1.5 text-[11px] flex items-center gap-1.5 ${
                  hayDifReal && !order.accepted_difference
                    ? "bg-red-50 border-red-300 text-red-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  <AlertTriangle size={12} className="shrink-0" />
                  <span className="font-bold">Diferencia:</span>
                  <span>Pedido {order.total_ordered}u — Recibido {order.total_received}u</span>
                  {order.accepted_difference && (
                    <span className="ml-1 text-green-700 font-bold">(Compras aceptó diferencia)</span>
                  )}
                  {order.accepted_difference_obs && (
                    <span className="ml-1 text-gray-600">— {order.accepted_difference_obs}</span>
                  )}
                  {hayDifReal && !order.accepted_difference && (
                    <span className="ml-1 font-bold text-red-700">⚠ Diferencia sin aceptar</span>
                  )}
                </div>
              )}

              {/* Docs table */}
              <InvoicesDocs orderId={order.id} onRvClick={onRvClick} onPdfClick={onPdfClick} />

              {/* Action bar */}
              <div className="px-3 py-2 flex items-center gap-2 border-t bg-gray-50/60 flex-wrap">
                {order.excel_file && (
                  <a
                    href={`${SERVER_BASE}${order.excel_file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-200 flex items-center gap-0.5"
                  >
                    <FileText className="h-3 w-3" /> Nota de Pedido
                  </a>
                )}
                {order.pdf_file && (
                  <button
                    onClick={() => onPdfClick({ url: `${SERVER_BASE}${order.pdf_file}`, filename: `OC-${order.number || order.id}.pdf` })}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold hover:bg-blue-200 flex items-center gap-0.5"
                  >
                    <FileText className="h-3 w-3" /> OC PDF
                  </button>
                )}
                <button
                  onClick={() => onReopen(order.id, hayDifReal && !order.accepted_difference)}
                  className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-0.5 ml-auto ${
                    hayDifReal && !order.accepted_difference
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                >
                  <RotateCcw className="h-3 w-3" />
                  {hayDifReal && !order.accepted_difference ? "Reabrir (dif. sin aceptar)" : "Deshacer completado"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── LocalGroup ───────────────────────────────────────────────────────────── */
function LocalGroup({ local, orders, expanded, onToggle, onRvClick, onPdfClick, onReopen }) {
  const totalOrdered = orders.reduce((s, o) => s + (o.total_ordered || 0), 0);
  const totalReceived = orders.reduce((s, o) => s + (o.total_received || 0), 0);
  const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const conDifCount = orders.filter((o) => o._conDif).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-green-700 hover:bg-green-800 text-white transition"
      >
        <div className="flex items-center gap-3">
          <MapPin size={16} />
          <span className="font-semibold">{local}</span>
          <span className="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-medium">
            {orders.length} NP{orders.length !== 1 ? "s" : ""}
          </span>
          {conDifCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">
              {conDifCount} con dif.
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <div className="w-24 bg-white/30 rounded-full h-2">
              <div className="bg-white h-2 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-white/70">{pct}% recibido</span>
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
                <th className="px-3 py-2 text-center">Cant. Ped.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onRvClick={onRvClick}
                  onPdfClick={onPdfClick}
                  onReopen={onReopen}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
export default function CompletadosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedLocals, setExpandedLocals] = useState(new Set());
  const [activeTab, setActiveTab] = useState("completados");
  const [diasFilter, setDiasFilter] = useState("all");
  const [conDifFilter, setConDifFilter] = useState("todos"); // todos | ok | dif
  const [rvPopup, setRvPopup] = useState(null); // { invoiceId, invoiceNumber }
  const [rvInput, setRvInput] = useState("");
  const [pdfViewer, setPdfViewer] = useState(null); // { url, filename }

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ["completados"],
    queryFn: () => api.get("/purchase-orders/?status=COMPLETADO&limit=500"),
    staleTime: 2 * 60 * 1000,
  });

  const { data: recibidosData } = useQuery({
    queryKey: ["recibidos"],
    queryFn: () => api.get("/purchase-orders/?status=RECIBIDO&limit=200"),
    staleTime: 2 * 60 * 1000,
  });

  const rvMutation = useMutation({
    mutationFn: ({ id, rv }) =>
      api.put(`/purchase-invoices/${id}`, { remito_venta_number: rv || null }),
    onSuccess: () => {
      setRvPopup(null);
      setRvInput("");
      queryClient.invalidateQueries({ queryKey: ["order-invoices"] });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completados"] });
      queryClient.invalidateQueries({ queryKey: ["recibidos"] });
    },
  });

  const grouped = useMemo(() => {
    const rawOrders =
      activeTab === "completados"
        ? ordersData?.items || []
        : recibidosData?.items || [];

    // Enrich with _conDif
    const orders = rawOrders.map((o) => ({ ...o, _conDif: conDifFrom(o) }));

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

      const matchDif =
        conDifFilter === "todos" ||
        (conDifFilter === "ok" && !o._conDif) ||
        (conDifFilter === "dif" && o._conDif);

      return matchSearch && matchDias && matchDif;
    });

    const groups = {};
    filtered.forEach((o) => {
      const local = o.local_name || "Sin local";
      if (!groups[local]) groups[local] = [];
      groups[local].push(o);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [ordersData, recibidosData, search, activeTab, diasFilter, conDifFilter]);

  // Auto-expand first 3 groups on load
  useEffect(() => {
    if (grouped.length > 0) {
      setExpandedLocals(new Set(grouped.slice(0, 3).map(([local]) => local)));
    }
  }, [grouped.length]);

  const totalOrders = grouped.reduce((s, [, o]) => s + o.length, 0);

  const allOrders =
    activeTab === "completados"
      ? (ordersData?.items || []).map((o) => ({ ...o, _conDif: conDifFrom(o) }))
      : (recibidosData?.items || []).map((o) => ({ ...o, _conDif: conDifFrom(o) }));
  const countOk = allOrders.filter((o) => !o._conDif).length;
  const countDif = allOrders.filter((o) => o._conDif).length;

  const handleReopen = (orderId, withDif) => {
    const msg = withDif
      ? "¿Reabrir esta nota? Tiene diferencia sin aceptar. Volverá a estado PENDIENTE."
      : "¿Deshacer el completado? Volverá a estado PENDIENTE.";
    if (window.confirm(msg)) {
      reopenMutation.mutate(orderId);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* PDF Viewer overlay */}
      {pdfViewer && (
        <PdfViewer
          url={pdfViewer.url}
          filename={pdfViewer.filename}
          onClose={() => setPdfViewer(null)}
        />
      )}

      {/* RV Popup */}
      {rvPopup && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setRvPopup(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-800 mb-1">Cargar RV</h3>
            <p className="text-xs text-gray-500 mb-3">
              Doc: <b className="font-mono">{rvPopup.invoiceNumber}</b>
            </p>
            <input
              autoFocus
              value={rvInput}
              onChange={(e) => setRvInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && rvInput.trim())
                  rvMutation.mutate({ id: rvPopup.invoiceId, rv: rvInput.trim() });
              }}
              placeholder="Número de RV"
              className="w-full border rounded px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-green-300 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRvPopup(null)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => rvMutation.mutate({ id: rvPopup.invoiceId, rv: rvInput.trim() })}
                disabled={!rvInput.trim() || rvMutation.isPending}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {rvMutation.isPending ? "Guardando..." : "Guardar RV"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare size={24} className="text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Completados</h1>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            {totalOrders} órdenes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Actualizar"
          >
            <RefreshCw size={16} className={`text-gray-500 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => exportCSV(grouped)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition"
          >
            <Download size={14} /> Exportar CSV
          </button>
        </div>
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

      {/* Filters bar */}
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

        {/* OK / Con Diferencia filter */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {[
            ["todos", `Todos (${allOrders.length})`],
            ["ok", `OK (${countOk})`],
            ["dif", `Con Diferencia (${countDif})`],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setConDifFilter(v)}
              className={`px-3 py-2 text-xs font-medium transition ${
                conDifFilter === v
                  ? v === "dif"
                    ? "bg-amber-600 text-white"
                    : "bg-green-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Días filter */}
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
              onRvClick={(data) => { setRvPopup(data); setRvInput(""); }}
              onPdfClick={(data) => setPdfViewer(data)}
              onReopen={handleReopen}
            />
          ))}
          {grouped.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No hay órdenes que coincidan con el filtro.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
