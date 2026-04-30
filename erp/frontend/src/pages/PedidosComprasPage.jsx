import { useState, useMemo, Fragment, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import ComparadorCruzado from "../components/ComparadorCruzado";
import ExcelConPreciosViewer from "../components/ExcelConPreciosViewer";
import ComparadorOmbak from "../components/ComparadorOmbak";
import {
  Plus, Eye, Send, Package, CheckCircle2, XCircle, ClipboardCheck,
  ArrowLeft, Calendar, Truck, FileText, Search,
  Hash, ChevronDown, ChevronRight, ChevronUp, Check, RefreshCw, Pencil, Save,
  X, AlertTriangle, ShoppingCart, GitCompare, FileSpreadsheet,
  MapPin, Layers, Tag, Paperclip, Download, Trash2, Upload,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════ */
/*  CONSTANTS & HELPERS                                    */
/* ═══════════════════════════════════════════════════════ */
const STATUS_CONFIG = {
  BORRADOR:   { label: "Borrador",   color: "bg-gray-100 text-gray-700",   dot: "bg-gray-400",   border: "border-l-gray-400"  },
  PENDIENTE:  { label: "Pendiente",  color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500",   border: "border-l-blue-500"  },
  ENVIADO:    { label: "Pendiente",  color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500",   border: "border-l-blue-500"  },
  RECIBIDO:   { label: "Recibido",   color: "bg-amber-100 text-amber-700", dot: "bg-amber-500",  border: "border-l-amber-500" },
  COMPLETADO: { label: "Completado", color: "bg-green-100 text-green-700", dot: "bg-green-500",  border: "border-l-green-500" },
  ANULADO:    { label: "Anulado",    color: "bg-red-100 text-red-700",     dot: "bg-red-400",    border: "border-l-red-400"   },
};

const ORDER_TYPES = ["PRECOMPRA", "REPOSICION", "CAMBIO"];

const ALERT_STATE_CONFIG = {
  OK:            { label: "OK",            color: "bg-green-100 text-green-700",   dot: "bg-green-500"   },
  ANP:           { label: "ANP",           color: "bg-purple-100 text-purple-700", dot: "bg-purple-500"  },
  SIN_RV:        { label: "Sin RV",        color: "bg-red-100 text-red-700",       dot: "bg-red-500"     },
  INCOMPLETO:    { label: "Incompleto",    color: "bg-orange-100 text-orange-700", dot: "bg-orange-500"  },
  SOLO_FALTA_REM:{ label: "Falta Remito",  color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500"  },
  SOLO_FALTA_FAC:{ label: "Falta Factura", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500"  },
  ALERTA_REPO:   { label: "Alerta Repo",   color: "bg-amber-100 text-amber-700",   dot: "bg-amber-500"   },
  SIN_NADA:      { label: "Sin docs",      color: "bg-gray-100 text-gray-500",     dot: "bg-gray-400"    },
};

function AlertStateBadge({ alertState }) {
  if (!alertState) return null;
  const cfg = ALERT_STATE_CONFIG[alertState];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.BORRADOR;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Spinner() {
  return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />;
}

const TYPE_BADGES = {
  PRECOMPRA:  { short: "PRE",    color: "bg-purple-100 text-purple-700" },
  REPOSICION: { short: "REP",    color: "bg-blue-100 text-blue-700" },
  CAMBIO:     { short: "CAMBIO", color: "bg-orange-100 text-orange-700" },
};

const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - d) / (1000 * 60 * 60 * 24)));
};

function TypeBadge({ type }) {
  const cfg = TYPE_BADGES[type];
  if (!cfg) return <span className="text-[10px] text-gray-400">—</span>;
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.color} uppercase tracking-wide`}>
      {cfg.short}
    </span>
  );
}

function DaysBadge({ days }) {
  if (days == null) return <span className="text-gray-300">—</span>;
  let color = "bg-green-100 text-green-700";
  if (days > 30) color = "bg-red-100 text-red-700";
  else if (days > 15) color = "bg-orange-100 text-orange-700";
  else if (days >= 7) color = "bg-yellow-100 text-yellow-700";
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {days}d
    </span>
  );
}

function EstadoCell({ order }) {
  if (order.status === "COMPLETADO") return <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">COMPLETADO</span>;
  if (order.status === "ANULADO") return <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">ANULADO</span>;
  if (order.status === "BORRADOR") return <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">BORRADOR</span>;
  if (order.status === "PENDIENTE" || order.status === "ENVIADO") {
    const invoiced = order.total_invoiced || 0;
    if (invoiced > 0) {
      const falta = (order.total_ordered || 0) - invoiced;
      if (falta > 0) return <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">FALTA {falta.toLocaleString("es-AR")}</span>;
      return <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">FACTURADO</span>;
    }
    return <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">PENDIENTE</span>;
  }
  return <StatusBadge status={order.status} />;
}

function ExpandedRowContent({ orderId }) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["purchase-orders", orderId],
    queryFn: () => api.get(`/purchase-orders/${orderId}`),
  });
  const { data: invoicesData } = useQuery({
    queryKey: ["purchase-invoices", orderId],
    queryFn: () => api.get("/purchase-invoices/", { params: { purchase_order_id: orderId } }).catch(() => ({ items: [] })),
  });
  if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>;
  if (!order) return <p className="text-xs text-gray-400 py-3">No se pudo cargar el detalle</p>;
  const items = order.items || [];
  const invoices = invoicesData?.items || invoicesData || [];
  return (
    <div className="py-3 space-y-3">
      {items.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 px-1">Ítems del pedido ({items.length})</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-100 text-gray-500 font-semibold">
                <th className="text-left px-2 py-1.5">Código</th>
                <th className="text-left px-2 py-1.5">Descripción</th>
                <th className="text-center px-2 py-1.5">Talle</th>
                <th className="text-center px-2 py-1.5">Color</th>
                <th className="text-right px-2 py-1.5">Pedida</th>
                <th className="text-right px-2 py-1.5">Recibida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1 font-mono text-gray-700">{item.code || "—"}</td>
                  <td className="px-2 py-1 text-gray-600">{item.description || item.variant_sku || "—"}</td>
                  <td className="px-2 py-1 text-center">{item.size || "—"}</td>
                  <td className="px-2 py-1 text-center">{item.color || "—"}</td>
                  <td className="px-2 py-1 text-right font-medium">{item.qty_ordered}</td>
                  <td className="px-2 py-1 text-right">
                    <span className={item.qty_received > 0 ? "text-green-700 font-medium" : "text-gray-400"}>
                      {item.qty_received ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {Array.isArray(invoices) && invoices.length > 0 && (
        <div className="px-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Facturas vinculadas</p>
          <div className="flex flex-wrap gap-1.5">
            {invoices.map(inv => (
              <span key={inv.id} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                <FileText className="w-3 h-3" /> {inv.number || `#${inv.id}`}
              </span>
            ))}
          </div>
        </div>
      )}
      {items.length === 0 && (!Array.isArray(invoices) || invoices.length === 0) && (
        <p className="text-xs text-gray-400 py-2 px-1">Sin ítems ni facturas vinculadas</p>
      )}
    </div>
  );
}

function GroupSection({ title, orders, renderTable, count }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-sm font-semibold text-gray-700 border-b border-gray-200"
      >
        <span>{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{count}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </span>
      </button>
      {open && renderTable(orders)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                         */
/* ═══════════════════════════════════════════════════════ */
export default function PedidosComprasPage() {
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState("");

  const goDetail = (id) => { setSelectedId(id); setView("detail"); };
  const goList   = () => { setView("list"); setSelectedId(null); };
  const goCreate = () => setView("create");

  const handleCreated = () => {
    goList();
    setToast("Nota creada");
    setTimeout(() => setToast(""), 3000);
  };

  if (view === "create") return <CreateForm onBack={goList} onCreated={handleCreated} />;
  if (view === "detail" && selectedId) return <DetailView id={selectedId} onBack={goList} />;
  return <ListView onView={goDetail} onCreate={goCreate} toast={toast} />;
}

/* ═══════════════════════════════════════════════════════ */
/*  LIST VIEW                                              */
/* ═══════════════════════════════════════════════════════ */
function ListView({ onView, onCreate, toast }) {
  const qc = useQueryClient();
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDIENTE");
  const [alertFilter, setAlertFilter] = useState("ALL");
  const [comparadorCruzadoPoId, setComparadorCruzadoPoId] = useState(null);
  const [excelPreciosPoId, setExcelPreciosPoId] = useState(null);
  const [ombakPoId, setOmbakPoId] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [subTab, setSubTab] = useState("pedidos");
  const [alertasOpen, setAlertasOpen] = useState(false);
  const [alertasFilter, setAlertasFilter] = useState("all");
  const [groupBy, setGroupBy] = useState(null);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => api.get("/purchase-orders/", { params: { limit: 200 } }),
    select: (d) => d?.items ?? [],
    refetchInterval: 30000,
  });

  const { data: alertasData } = useQuery({
    queryKey: ["alertas-reposicion"],
    queryFn: () => api.get("/purchase-orders/alertas-reposicion").catch(() => ({ alertas: [], total: 0 })),
  });

  const confirmMut = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
  const receiveMut = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/receive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
  const completeMut = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
  const cancelMut = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  const counts = useMemo(() => {
    const c = { ALL: data.length };
    Object.keys(STATUS_CONFIG).forEach(s => { c[s] = 0; });
    data.forEach(o => {
      // Group legacy ENVIADO under PENDIENTE
      const key = o.status === "ENVIADO" ? "PENDIENTE" : o.status;
      c[key] = (c[key] || 0) + 1;
    });
    return c;
  }, [data]);

  const alertCounts = useMemo(() => {
    const c = { ALL: data.length };
    Object.keys(ALERT_STATE_CONFIG).forEach(s => { c[s] = data.filter(o => o.alert_state === s).length; });
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    let items = data;
    if (statusFilter !== "ALL") {
      if (statusFilter === "PENDIENTE") {
        items = items.filter(o => o.status === "PENDIENTE" || o.status === "ENVIADO");
      } else {
        items = items.filter(o => o.status === statusFilter);
      }
    }
    if (alertFilter !== "ALL") items = items.filter(o => o.alert_state === alertFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(o =>
        o.number?.toLowerCase().includes(q) ||
        (o.provider?.name || o.provider_name || "").toLowerCase().includes(q) ||
        o.type?.toLowerCase().includes(q) ||
        (o.local?.name || o.local_name || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, statusFilter, search]);

  const grouped = useMemo(() => {
    const eff = subTab === "locales" ? "local" : subTab === "proveedores" ? "provider" : groupBy;
    if (!eff) return null;
    const groups = {};
    filtered.forEach(order => {
      let key;
      if (eff === "local") key = order.local?.name || order.local_name || "Sin local";
      else if (eff === "provider") key = order.provider?.name || order.provider_name || "Sin proveedor";
      else if (eff === "status") key = STATUS_CONFIG[order.status]?.label || order.status;
      else return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, subTab, groupBy]);

  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const TAB_ORDER = ["ALL", "BORRADOR", "PENDIENTE", "RECIBIDO", "COMPLETADO", "ANULADO"];
  const SUB_TABS = [
    { key: "pedidos",    label: "Pedidos",    icon: ShoppingCart },
    { key: "locales",    label: "Locales",    icon: MapPin },
    { key: "proveedores",label: "Proveedores",icon: Truck },
  ];

  const alertas = alertasData?.alertas || [];
  const alertasTotal = alertasData?.total || alertas.length;

  const provName = (o) => o.provider?.name || o.provider_name || "—";
  const localName = (o) => o.local?.name || o.local_name || "—";

  /* ── Render the dense table ── */
  const renderTable = (orders) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
            <th className="w-7 px-1 py-2"></th>
            <th className="text-left px-2 py-2 whitespace-nowrap">N° Pedido</th>
            <th className="text-left px-2 py-2">Proveedor</th>
            <th className="text-left px-2 py-2">Fecha</th>
            <th className="text-left px-2 py-2">Local</th>
            <th className="text-right px-2 py-2">Cant</th>
            <th className="text-center px-2 py-2">Tipo</th>
            <th className="text-center px-2 py-2">Estado</th>
            <th className="text-center px-2 py-2 whitespace-nowrap">Docs</th>
            <th className="text-right px-2 py-2">Falta</th>
            <th className="text-center px-2 py-2">Días</th>
            <th className="text-right px-2 py-2 min-w-[180px]">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map(order => {
            const isExpanded = expandedRows.has(order.id);
            const cantPedida = order.items_count || 0;
            const cantRecibida = order.total_qty_received || 0;
            const falta = cantPedida - cantRecibida;
            const days = daysSince(order.date || order.created_at);
            const isConfirming = confirmMut.isPending  && confirmMut.variables === order.id;
            const isReceiving = receiveMut.isPending  && receiveMut.variables === order.id;
            const isCompleting = completeMut.isPending && completeMut.variables === order.id;
            const isCancelling = cancelMut.isPending  && cancelMut.variables === order.id;
            return (
              <Fragment key={order.id}>
                <tr className={`hover:bg-blue-50/40 transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}>
                  <td className="px-1 py-1.5 text-center">
                    <button onClick={() => toggleExpand(order.id)} className="p-0.5 hover:bg-gray-200 rounded transition">
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => onView(order.id)} className="font-bold text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap">
                      {order.number || `#${order.id}`}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-gray-700 max-w-[150px]">
                    <span className="block truncate" title={provName(order)}>{provName(order)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{fmtDate(order.date || order.created_at)}</td>
                  <td className="px-2 py-1.5 text-gray-600 max-w-[130px]">
                    <span className="block truncate" title={localName(order)}>{localName(order)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-gray-800">
                    {cantPedida.toLocaleString("es-AR")}
                  </td>
                  <td className="px-2 py-1.5 text-center"><TypeBadge type={order.type} /></td>
                  <td className="px-2 py-1.5 text-center"><EstadoCell order={order} /></td>
                  <td className="px-2 py-1.5 text-center"><AlertStateBadge alertState={order.alert_state} /></td>
                  <td className="px-2 py-1.5 text-right">
                    {falta !== 0
                      ? <span className={`font-bold ${falta > 0 ? "text-red-600" : "text-green-600"}`}>
                          {falta > 0 ? `−${falta.toLocaleString("es-AR")}` : falta.toLocaleString("es-AR")}
                        </span>
                      : <span className="text-green-600 font-bold">✓</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center"><DaysBadge days={days} /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5 flex-nowrap">
                      {["PENDIENTE", "ENVIADO", "RECIBIDO", "COMPLETADO"].includes(order.status) && (
                        <button onClick={() => setComparadorCruzadoPoId(order.id)}
                          className="p-1 text-purple-600 hover:bg-purple-50 rounded transition" title="Cruce de documentos">
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExcelPreciosPoId(order.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition" title="Excel con Precios">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onView(order.id)}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded transition" title="Ver detalle">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {order.status === "BORRADOR" && (
                        <button onClick={() => onView(order.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {order.status === "BORRADOR" && (
                        <button disabled={isConfirming} onClick={() => confirmMut.mutate(order.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition disabled:opacity-50" title="Confirmar">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(order.status === "PENDIENTE" || order.status === "ENVIADO") && (
                        <button disabled={isReceiving} onClick={() => receiveMut.mutate(order.id)}
                          className="p-1 text-amber-600 hover:bg-amber-50 rounded transition disabled:opacity-50" title="Recibir">
                          <Package className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {order.status === "RECIBIDO" && (
                        <button disabled={isCompleting} onClick={() => completeMut.mutate(order.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50" title="Completar">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {["BORRADOR", "PENDIENTE", "ENVIADO"].includes(order.status) && (
                        <button disabled={isCancelling}
                          onClick={() => { if (window.confirm(`¿Anular la nota ${order.number || order.id}?`)) cancelMut.mutate(order.id); }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50" title="Anular">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(provName(order)).toUpperCase().includes("OMBAK") && (
                        <button onClick={() => setOmbakPoId(order.id)}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded transition">
                          Ombak
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={11} className="bg-slate-50 px-4 py-0 border-b-2 border-blue-200">
                      <ExpandedRowContent orderId={order.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" /> Notas de Pedido
          </h1>
          <p className="text-xs text-gray-500">Pedidos de compra a proveedores</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Agrupar dropdown */}
          <div className="relative">
            <button
              onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition
                ${groupBy ? "text-blue-700 bg-blue-50 border-blue-200" : "text-gray-700 bg-white border-gray-200 hover:bg-gray-50"}`}
            >
              <Layers className="w-4 h-4" /> Agrupar <ChevronDown className="w-3 h-3" />
            </button>
            {groupDropdownOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {[
                  { key: null, label: "Sin agrupar" },
                  { key: "provider", label: "Por proveedor" },
                  { key: "local", label: "Por local" },
                  { key: "status", label: "Por estado" },
                ].map(opt => (
                  <button key={String(opt.key)}
                    onClick={() => { setGroupBy(opt.key); setGroupDropdownOpen(false); if (opt.key) setSubTab("pedidos"); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${groupBy === opt.key && subTab === "pedidos" ? "font-medium text-blue-700 bg-blue-50" : "text-gray-700"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Actualizar">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
            <Plus className="w-4 h-4" /> Nueva Nota
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const active = subTab === tab.key;
          return (
            <button key={tab.key}
              onClick={() => { setSubTab(tab.key); if (tab.key !== "pedidos") setGroupBy(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Alertas de reposición */}
      {alertas.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button onClick={() => setAlertasOpen(!alertasOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              ALERTAS DE REPOSICIÓN — {alertasTotal} pendientes
            </span>
            {alertasOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {alertasOpen && (
            <div className="bg-red-50/50 p-3">
              <div className="flex gap-2 mb-3">
                {[
                  { key: "all", label: "Todas" },
                  { key: "sin_factura", label: "Sin Factura" },
                  { key: "con_factura", label: "Con Factura pendiente" },
                ].map(f => (
                  <button key={f.key}
                    onClick={() => setAlertasFilter(f.key)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                      alertasFilter === f.key ? "bg-red-600 text-white" : "bg-white text-red-700 border border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto rounded border border-red-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-100 text-red-800 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="text-center px-2 py-2">Estado</th>
                      <th className="text-left px-2 py-2">N° Pedido</th>
                      <th className="text-left px-2 py-2">Proveedor</th>
                      <th className="text-left px-2 py-2">Local</th>
                      <th className="text-right px-2 py-2">Pedido</th>
                      <th className="text-right px-2 py-2">Factur.</th>
                      <th className="text-right px-2 py-2">Faltan</th>
                      <th className="text-left px-2 py-2">Últ.Fac.</th>
                      <th className="text-right px-2 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {alertas
                      .filter(a => {
                        if (alertasFilter === "sin_factura") return !a.total_invoiced;
                        if (alertasFilter === "con_factura") return a.total_invoiced > 0;
                        return true;
                      })
                      .map(a => {
                        const faltan = (a.total_ordered || 0) - (a.total_invoiced || 0);
                        return (
                          <tr key={a.id} className="hover:bg-red-50/80">
                            <td className="px-2 py-1.5 text-center"><StatusBadge status={a.status} /></td>
                            <td className="px-2 py-1.5">
                              <button onClick={() => onView(a.id)} className="font-bold text-red-800 hover:underline">
                                {a.number || `#${a.id}`}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-gray-700">{a.provider_name || "—"}</td>
                            <td className="px-2 py-1.5 text-gray-700">{a.local_name || "—"}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{(a.total_ordered || 0).toLocaleString("es-AR")}</td>
                            <td className="px-2 py-1.5 text-right">{(a.total_invoiced || 0).toLocaleString("es-AR")}</td>
                            <td className="px-2 py-1.5 text-right font-bold text-red-700">
                              {faltan > 0 ? `−${faltan.toLocaleString("es-AR")}` : faltan.toLocaleString("es-AR")}
                            </td>
                            <td className="px-2 py-1.5 text-gray-600">{a.last_invoice_date ? fmtDate(a.last_invoice_date) : "—"}</td>
                            <td className="px-2 py-1.5 text-right">
                              <button onClick={() => onView(a.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Ver pedido">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status tabs + filters + search */}
      {/* Status tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 pb-0">
        {TAB_ORDER.map(tab => {
          const active = statusFilter === tab;
          const cnt = counts[tab] || 0;
          const cfg = tab === "ALL" ? null : STATUS_CONFIG[tab];
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors
                ${active ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
              {tab === "ALL" ? "Todos" : cfg.label}
              <span className={`text-[10px] px-1 rounded-full ${active ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Alert state filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Docs:</span>
        <button
          onClick={() => setAlertFilter("ALL")}
          className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition ${alertFilter === "ALL" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          Todos {alertFilter === "ALL" && <span className="ml-1 opacity-70">{alertCounts.ALL}</span>}
        </button>
        {Object.entries(ALERT_STATE_CONFIG).map(([key, cfg]) => {
          const cnt = alertCounts[key] || 0;
          if (cnt === 0 && alertFilter !== key) return null;
          return (
            <button
              key={key}
              onClick={() => setAlertFilter(alertFilter === key ? "ALL" : key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-full transition
                ${alertFilter === key ? cfg.color + " ring-1 ring-offset-1 ring-current" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <span className="font-bold">{cnt}</span>
            </button>
          );
        })}
        {alertFilter !== "ALL" && (
          <button onClick={() => setAlertFilter("ALL")} className="text-[10px] text-blue-500 hover:underline ml-1">× limpiar</button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar: número, proveedor, tipo, local…"
          className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay notas de pedido</p>
          <p className="text-sm mt-1">{search || statusFilter !== "ALL" ? "Probá con otros filtros" : "Creá la primera nota"}</p>
        </div>
      ) : grouped ? (
        <div className="space-y-3">
          {grouped.map(([groupName, orders]) => (
            <GroupSection key={groupName} title={groupName} orders={orders} renderTable={renderTable} count={orders.length} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {renderTable(filtered)}
        </div>
      )}

      {/* Summary bar */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
            {" · "}Total pedido: {filtered.reduce((s, o) => s + (o.items_count || 0), 0).toLocaleString("es-AR")}
            {" · "}Total recibido: {filtered.reduce((s, o) => s + (o.total_qty_received || 0), 0).toLocaleString("es-AR")}
          </span>
        </div>
      )}

      {/* Modal overlays */}
      {comparadorCruzadoPoId && (
        <ComparadorCruzado purchaseOrderId={comparadorCruzadoPoId} onClose={() => setComparadorCruzadoPoId(null)} />
      )}
      {excelPreciosPoId && (
        <ExcelConPreciosViewer purchaseOrderId={excelPreciosPoId} onClose={() => setExcelPreciosPoId(null)} />
      )}
      {ombakPoId && (
        <ComparadorOmbak purchaseOrderId={ombakPoId} onClose={() => setOmbakPoId(null)} />
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════ */
/*  CREATE FORM                                            */
/* ═══════════════════════════════════════════════════════ */
function CreateForm({ onBack, onCreated }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    provider_id: "",
    local_id: "",
    type: "REPOSICION",
    date: new Date().toISOString().slice(0, 10),
    expected_date: "",
    prefix: "",
    notes: "",
    selected_brands: [],
  });
  const [errors, setErrors] = useState({});
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [parsePreview, setParsePreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const { data: providers = [] } = useQuery({
    queryKey: ["providers", "with-brands"],
    queryFn: () => api.get("/providers/?limit=500"),
    select: (d) => {
      const items = d?.items ?? d ?? [];
      return items.filter(p => p.brands && p.is_active !== false);
    },
  });

  const { data: locales = [] } = useQuery({
    queryKey: ["locales", "active"],
    queryFn: () => api.get("/locals/"),
    select: (d) => (d?.items ?? d ?? []).filter(l => l.is_active !== false),
  });

  const selectedProvider = providers.find(p => String(p.id) === String(form.provider_id));
  const providerBrands = selectedProvider?.brands
    ? selectedProvider.brands.split(",").map(b => b.trim()).filter(Boolean)
    : [];

  const toggleBrand = (brand) => {
    setForm(f => {
      const cur = f.selected_brands || [];
      return { ...f, selected_brands: cur.includes(brand) ? cur.filter(b => b !== brand) : [...cur, brand] };
    });
  };

  const createMut = useMutation({
    mutationFn: (fd) => api.uploadFile("/purchase-orders/", fd),
    onSuccess: (data) => {
      console.log("[createMut] OK", data);
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      onCreated();
    },
    onError: (err) => {
      console.error("[createMut] ERROR", err);
      alert("Error al crear la nota: " + (err?.message || String(err)));
    },
  });

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  const onProviderChange = (provId) => {
    setForm(f => {
      const prov = providers.find(p => String(p.id) === String(provId));
      const autoPrefix = prov?.order_prefix || (prov?.name ? prov.name.trim().toUpperCase().replace(/\s+/g, "-") : "");
      return { ...f, provider_id: provId, prefix: autoPrefix, selected_brands: [] };
    });
    setErrors(e => ({ ...e, provider_id: null }));
  };

  // Marca efectiva: si el proveedor tiene una sola marca se usa esa;
  // si tiene varias, el usuario debe haber seleccionado exactamente una en selected_brands.
  const effectiveBrand =
    providerBrands.length === 1
      ? providerBrands[0]
      : (form.selected_brands?.length === 1 ? form.selected_brands[0] : "");

  const excelBlockReason = (() => {
    if (!form.provider_id) return "Seleccioná primero el proveedor.";
    if (!form.local_id) return "Seleccioná el local destino.";
    if (!form.type) return "Indicá si es PRECOMPRA o REPOSICIÓN.";
    if (providerBrands.length > 1 && form.selected_brands.length !== 1)
      return "El proveedor tiene varias marcas — seleccioná exactamente UNA para parsear el Excel.";
    return "";
  })();

  const handleExcelSelected = async (file) => {
    setExcelFile(file);
    setParsePreview(null);
    setParseError("");
    if (!file) return;
    if (excelBlockReason) {
      setParseError(excelBlockReason);
      setExcelFile(null);
      return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const prov = providers.find(p => String(p.id) === String(form.provider_id));
      fd.append("proveedor", prov?.name || "");
      fd.append("marca", effectiveBrand || "");
      fd.append("es_reposicion", form.type === "REPOSICION" ? "true" : "false");
      const res = await api.uploadFile(`/excel-parser/parse`, fd);
      setParsePreview(res);
    } catch (err) {
      setParseError(err?.message || "No se pudo parsear el Excel");
    } finally {
      setParsing(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.provider_id) e.provider_id = "Seleccioná un proveedor";
    if (!form.date) e.date = "La fecha es requerida";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("[handleSubmit] click, excelFile=", excelFile?.name, "pdfFile=", pdfFile?.name, "form=", form);
    const e_ = validate();
    if (Object.keys(e_).length) {
      console.warn("[handleSubmit] validation failed", e_);
      setErrors(e_);
      return;
    }
    const fd = new FormData();
    fd.append("provider_id", String(form.provider_id));
    if (form.local_id) fd.append("local_id", String(form.local_id));
    fd.append("type", form.type);
    fd.append("date", form.date);
    if (form.expected_date) fd.append("expected_date", form.expected_date);
    if (form.prefix) fd.append("prefix", form.prefix);
    if (form.notes) fd.append("notes", form.notes);
    if (form.selected_brands?.length) fd.append("selected_brands", form.selected_brands.join(","));
    if (excelFile) fd.append("excel_file", excelFile);
    if (pdfFile) fd.append("pdf_file", pdfFile);
    console.log("[handleSubmit] firing POST with", Array.from(fd.keys()));
    createMut.mutate(fd);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Nueva Nota de Pedido</h1>
          <p className="text-xs text-gray-500">Los ítems se agregan desde el detalle del pedido</p>
        </div>
      </div>

      {createMut.isError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {createMut.error?.message || "Error al crear la nota"}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor <span className="text-red-500">*</span>
          </label>
          <select
            value={form.provider_id}
            onChange={e => onProviderChange(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.provider_id ? "border-red-400" : "border-gray-200"}`}
          >
            <option value="">— Seleccioná proveedor —</option>
            {Object.entries(providers.reduce((acc, p) => {
              const k = p.brands || "Sin marca";
              (acc[k] = acc[k] || []).push(p);
              return acc;
            }, {})).map(([brand, list]) => (
              <optgroup key={brand} label={`▸ ${brand}`}>
                {list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
          {providers.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠ No hay proveedores marcados con marca. Asigná marcas en ABM Proveedores (Gestión de Pagos).
            </p>
          )}
          {errors.provider_id && <p className="text-xs text-red-500 mt-1">{errors.provider_id}</p>}
        </div>

        {/* Brand selector — shows when provider has brands configured */}
        {providerBrands.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Tag className="inline w-3.5 h-3.5 mr-1 text-indigo-500" />
              Marcas que ingresan en este pedido
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              {providerBrands.map(brand => {
                const selected = (form.selected_brands || []).includes(brand);
                return (
                  <button
                    key={brand} type="button"
                    onClick={() => toggleBrand(brand)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? "bg-indigo-600 text-white border-indigo-700"
                        : "bg-white text-indigo-700 border-indigo-200 hover:border-indigo-500"
                    }`}
                  >
                    <Tag className="w-3 h-3" />{brand}
                  </button>
                );
              })}
            </div>
            {(form.selected_brands || []).length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Seleccioná las marcas que van a ingresar (opcional)</p>
            )}
          </div>
        )}

        {/* Local destino */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MapPin className="inline w-3.5 h-3.5 mr-1 text-gray-500" />
            Local destino (opcional)
          </label>
          <select
            value={form.local_id}
            onChange={e => set("local_id", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Sin local específico —</option>
            {locales.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <div className="flex gap-2">
            {ORDER_TYPES.map(t => (
              <button
                type="button" key={t}
                onClick={() => set("type", t)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${form.type === t
                  ? "bg-indigo-600 text-white border-indigo-700"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date" value={form.date} onChange={e => set("date", e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.date ? "border-red-400" : "border-gray-200"}`}
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha esperada</label>
            <input
              type="date" value={form.expected_date} onChange={e => set("expected_date", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Prefix */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo (opcional)</label>
          <input
            type="text" value={form.prefix} onChange={e => set("prefix", e.target.value)}
            placeholder="Ej: MONTAGNE"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            value={form.notes} onChange={e => set("notes", e.target.value)}
            rows={3} placeholder="Notas internas del pedido…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Archivos adjuntos (opcional) */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Archivos adjuntos <span className="text-gray-400 font-normal">(opcional)</span></label>

          {/* Banner de contexto para el parser */}
          {excelBlockReason ? (
            <div className="mb-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">No podés subir el Excel todavía</div>
                <div>{excelBlockReason}</div>
              </div>
            </div>
          ) : (
            <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <div className="font-semibold mb-1">✅ Contexto declarado — el parser usará estas reglas:</div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                <span><b>Proveedor:</b> {selectedProvider?.name}</span>
                <span><b>Marca:</b> {effectiveBrand || "—"}</span>
                <span><b>Local:</b> {locales.find(l => String(l.id) === String(form.local_id))?.name || "—"}</span>
                <span><b>Tipo:</b> {form.type}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel</p>
              <label className={`flex items-center justify-center gap-2 px-3 py-2 border border-dashed rounded-lg transition text-xs truncate ${
                excelBlockReason
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-600 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer"
              }`}>
                <Upload className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{excelFile ? excelFile.name : "Seleccionar Excel…"}</span>
                <input
                  type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  disabled={!!excelBlockReason}
                  onChange={e => handleExcelSelected(e.target.files?.[0] || null)}
                />
              </label>
              {excelFile && (
                <button type="button" onClick={() => { setExcelFile(null); setParsePreview(null); setParseError(""); }} className="text-xs text-red-500 hover:underline mt-1">Quitar</button>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-rose-600" /> PDF</p>
              <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition text-xs text-gray-600 truncate">
                <Upload className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">{pdfFile ? pdfFile.name : "Seleccionar PDF…"}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
              </label>
              {pdfFile && (
                <button type="button" onClick={() => setPdfFile(null)} className="text-xs text-red-500 hover:underline mt-1">Quitar</button>
              )}
            </div>
          </div>
          {parsing && <p className="text-xs text-blue-600 mt-2">Analizando Excel…</p>}
          {parseError && <p className="text-xs text-red-600 mt-2">{parseError}</p>}
          {parsePreview && (
            <div className="mt-3 border-2 border-emerald-300 bg-emerald-50/40 rounded-xl p-4 shadow-sm">
              {/* Header con totales destacados */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3 pb-3 border-b border-emerald-200">
                <div>
                  <div className="text-base font-bold text-emerald-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" /> Vista previa del Excel
                  </div>
                  {parsePreview.filename && (
                    <div className="text-xs text-emerald-700 mt-0.5 truncate max-w-md">{parsePreview.filename}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {parsePreview.proveedor_detectado && (
                    <span className="px-3 py-1 bg-emerald-200 text-emerald-900 rounded-full text-xs font-semibold">
                      🏷️ {parsePreview.proveedor_detectado}{parsePreview.es_reposicion ? " · Reposición" : ""}
                    </span>
                  )}
                  <div className="flex items-center gap-4 text-sm bg-white px-4 py-2 rounded-lg border border-emerald-200">
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-800 tabular-nums">{parsePreview.total_items}</div>
                      <div className="text-[10px] text-emerald-600 uppercase tracking-wide">ítems</div>
                    </div>
                    <div className="w-px h-8 bg-emerald-200" />
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-800 tabular-nums">{parsePreview.total_unidades}</div>
                      <div className="text-[10px] text-emerald-600 uppercase tracking-wide">unidades</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reglas aplicadas */}
              {parsePreview.rules_applied?.length > 0 && (
                <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  <div className="text-xs font-semibold text-blue-900 mb-1">📋 Reglas de parsing aplicadas:</div>
                  <ul className="text-xs text-blue-800 space-y-0.5 ml-4 list-disc">
                    {parsePreview.rules_applied.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {/* Solapas expandibles */}
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {(parsePreview.solapas || []).map((s, idx) => {
                  const curvas = (s.items || []).filter(it => it.es_curva).length;
                  return (
                    <details
                      key={idx}
                      className="bg-white rounded-lg border border-emerald-200 overflow-hidden"
                      open={s.items?.length > 0}
                    >
                      <summary className="cursor-pointer text-sm px-3 py-2 flex items-center justify-between gap-2 hover:bg-emerald-50 transition">
                        <span className="font-semibold text-gray-800">📄 {s.nombre}</span>
                        <span className="flex items-center gap-2 text-xs">
                          {curvas > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">
                              {curvas} curva{curvas === 1 ? "" : "s"} ×10
                            </span>
                          )}
                          <span className="text-gray-600">
                            <b>{s.total_items}</b> items · <b>{s.total_unidades}</b> u.
                            {s.sin_datos ? " (sin datos)" : ""}
                          </span>
                        </span>
                      </summary>
                      {s.items?.length > 0 && (
                        <div className="overflow-x-auto border-t border-emerald-100">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-600 sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-2 font-semibold">Código</th>
                                <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                                <th className="text-left px-3 py-2 font-semibold">Color</th>
                                <th className="text-right px-3 py-2 font-semibold">Cantidad</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.items.map((it, i) => (
                                <tr key={i} className={`border-t border-gray-100 hover:bg-emerald-50/30 ${it.es_curva ? "bg-amber-50/50" : ""}`}>
                                  <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                                    {it.codigo}
                                    {it.es_curva && (
                                      <span className="ml-1.5 text-[9px] px-1 py-0.5 bg-amber-200 text-amber-900 rounded font-bold">×10</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-700">{it.modelo || ""}</td>
                                  <td className="px-3 py-1.5 text-gray-500">{it.color || ""}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                                    {it.es_curva ? (
                                      <span>
                                        <span className="text-gray-400 line-through mr-1">{it.cantidad_original}</span>
                                        <span className="text-amber-800">{it.cantidad}</span>
                                      </span>
                                    ) : (
                                      it.cantidad
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onBack}
            className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
            Cancelar
          </button>
          <button type="submit" disabled={createMut.isPending}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
            {createMut.isPending ? "Creando…" : "Crear Nota de Pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  DETAIL VIEW                                            */
/* ═══════════════════════════════════════════════════════ */
function DetailView({ id, onBack }) {
  const qc = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue]     = useState("");
  const [addingItem, setAddingItem]     = useState(false);
  const [itemForm, setItemForm] = useState({ variant_id: "", code: "", description: "", size: "", color: "", qty_ordered: 1, unit_cost: "" });
  const [uploadError, setUploadError] = useState("");
  const [applyExcelMsg, setApplyExcelMsg] = useState(null); // { type: "success"|"error", text }
  const [excelPreview, setExcelPreview] = useState(null);
  const [excelPreviewLoading, setExcelPreviewLoading] = useState(false);
  const [excelPreviewError, setExcelPreviewError] = useState("");
  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["purchase-orders", id],
    queryFn: () => api.get(`/purchase-orders/${id}`),
  });

  const updateMut = useMutation({
    mutationFn: (payload) => api.put(`/purchase-orders/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", id] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      setEditingNotes(false);
    },
  });

  const confirmMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", id] }),
  });
  const receiveMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/receive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", id] }),
  });
  const completeMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/complete`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", id] }),
  });
  const cancelMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders", id] }); onBack(); },
  });

  const addItemMut = useMutation({
    mutationFn: (item) => api.post(`/purchase-orders/${id}/items`, item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", id] });
      setAddingItem(false);
      setItemForm({ variant_id: "", code: "", description: "", size: "", color: "", qty_ordered: 1, unit_cost: "" });
    },
  });

  const removeItemMut = useMutation({
    mutationFn: (itemId) => api.delete(`/purchase-orders/${id}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", id] }),
  });

  const uploadFileMut = useMutation({
    mutationFn: ({ fileType, file }) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile(`/purchase-orders/${id}/upload-file?file_type=${fileType}`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", id] });
      setUploadError("");
    },
    onError: (err) => setUploadError(err.message || "Error al subir archivo"),
  });

  const deleteFileMut = useMutation({
    mutationFn: (fileType) => api.delete(`/purchase-orders/${id}/upload-file?file_type=${fileType}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", id] }),
  });

  const handleFileChange = (fileType, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    uploadFileMut.mutate({ fileType, file });
    e.target.value = "";
  };

  const handleParseExcel = async () => {
    setExcelPreviewLoading(true);
    setExcelPreviewError("");
    setExcelPreview(null);
    try {
      const res = await api.get(`/purchase-orders/${id}/parse-excel`);
      setExcelPreview(res);
    } catch (err) {
      setExcelPreviewError(err?.message || "No se pudo parsear el Excel");
    } finally {
      setExcelPreviewLoading(false);
    }
  };

  const applyExcelMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/apply-excel`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", id] });
      setExcelPreview(null);
      setApplyExcelMsg({ type: "success", text: `✅ ${data.items_created} ítems importados del Excel al pedido.` });
    },
    onError: (err) => setApplyExcelMsg({ type: "error", text: err?.message || "Error al aplicar Excel" }),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !order) return (
    <div className="text-center py-16 text-red-500">
      <AlertTriangle className="w-10 h-10 mx-auto mb-2" />
      <p className="font-medium">No se pudo cargar el pedido</p>
      <button onClick={onBack} className="mt-4 text-sm text-blue-600 underline">Volver</button>
    </div>
  );

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.BORRADOR;
  const isEditable = order.status === "BORRADOR";
  const items = order.items || [];

  const handleSaveNotes = () => updateMut.mutate({ notes: notesValue });
  const handleStartEditNotes = () => { setNotesValue(order.notes || ""); setEditingNotes(true); };

  const handleAddItem = (e) => {
    e.preventDefault();
    const payload = {
      variant_id: itemForm.variant_id ? Number(itemForm.variant_id) : null,
      code: itemForm.code || null,
      description: itemForm.description || null,
      size: itemForm.size || null,
      color: itemForm.color || null,
      qty_ordered: Number(itemForm.qty_ordered) || 1,
      unit_cost: itemForm.unit_cost ? Number(itemForm.unit_cost) : null,
    };
    addItemMut.mutate(payload);
  };

  const iif = (k, v) => setItemForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Back + Title */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{order.number || `Pedido #${order.id}`}</h1>
              <StatusBadge status={order.status} />
              {order.type && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                  {order.type}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.provider_name || "Sin proveedor"} · {fmtDate(order.date || order.created_at)}
              {order.expected_date && ` → esperado ${fmtDate(order.expected_date)}`}
            </p>
          </div>
        </div>

        {/* Workflow buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {order.status === "BORRADOR" && (
            <button disabled={confirmMut.isPending} onClick={() => confirmMut.mutate()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
              <ClipboardCheck className="w-3.5 h-3.5" /> {confirmMut.isPending ? "Confirmando…" : "Marcar Confirmado"}
            </button>
          )}
          {(order.status === "PENDIENTE" || order.status === "ENVIADO") && (
            <button disabled={receiveMut.isPending} onClick={() => receiveMut.mutate()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50">
              <Package className="w-3.5 h-3.5" /> {receiveMut.isPending ? "…" : "Marcar Recibido"}
            </button>
          )}
          {order.status === "RECIBIDO" && (
            <button disabled={completeMut.isPending} onClick={() => completeMut.mutate()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> {completeMut.isPending ? "…" : "Completar"}
            </button>
          )}
          {["BORRADOR", "PENDIENTE", "ENVIADO"].includes(order.status) && (
            <button
              disabled={cancelMut.isPending}
              onClick={() => { if (window.confirm("¿Anular este pedido?")) cancelMut.mutate(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Anular
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cfg.border} shadow-sm p-5`}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <InfoRow icon={<Truck className="w-4 h-4 text-gray-400" />} label="Proveedor" value={order.provider_name || "—"} />
          <InfoRow icon={<Hash className="w-4 h-4 text-gray-400" />} label="Número" value={order.number || `#${order.id}`} />
          <InfoRow icon={<Calendar className="w-4 h-4 text-gray-400" />} label="Fecha" value={fmtDate(order.date || order.created_at)} />
          {order.expected_date && (
            <InfoRow icon={<Calendar className="w-4 h-4 text-amber-400" />} label="Fecha esperada" value={fmtDate(order.expected_date)} />
          )}
          {order.type && (
            <InfoRow icon={<FileText className="w-4 h-4 text-gray-400" />} label="Tipo" value={order.type} />
          )}
          {order.local_name && (
            <InfoRow icon={<Package className="w-4 h-4 text-gray-400" />} label="Local" value={order.local_name} />
          )}
        </div>

        {/* Notes */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Observaciones</span>
            {isEditable && !editingNotes && (
              <button onClick={handleStartEditNotes} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Pencil className="w-3 h-3" /> Editar
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesValue} onChange={e => setNotesValue(e.target.value)}
                rows={3} autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveNotes} disabled={updateMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                  <Save className="w-3 h-3" /> {updateMut.isPending ? "Guardando…" : "Guardar"}
                </button>
                <button onClick={() => setEditingNotes(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes || <span className="text-gray-400 italic">Sin observaciones</span>}</p>
          )}
        </div>
      </div>

      {/* Adjuntos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <Paperclip className="w-4 h-4 text-gray-500" /> Archivos adjuntos
          </h2>
        </div>
        {uploadError && (
          <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {uploadError}
          </p>
        )}
        {applyExcelMsg && (
          <div className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-xs font-medium ${applyExcelMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {applyExcelMsg.text}
            <button onClick={() => setApplyExcelMsg(null)} className="ml-auto opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Excel */}
          <div className="border border-dashed border-gray-200 rounded-lg p-3 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 mb-0.5">Excel / Planilla</p>
              {order.excel_file ? (
                <div className="flex items-center gap-2">
                  <a href={order.excel_file} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate max-w-[120px]" title={order.excel_file}>
                    {order.excel_file.split("/").pop()}
                  </a>
                  <a href={order.excel_file} download className="p-0.5 text-gray-400 hover:text-blue-600 transition" title="Descargar">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => deleteFileMut.mutate("excel")} disabled={deleteFileMut.isPending}
                    className="p-0.5 text-gray-400 hover:text-red-500 transition disabled:opacity-50" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Sin archivo</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <input ref={excelInputRef} type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileChange("excel", e)} />
              <button onClick={() => excelInputRef.current?.click()}
                disabled={uploadFileMut.isPending}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition disabled:opacity-50 whitespace-nowrap">
                <Upload className="w-3 h-3" />
                {uploadFileMut.isPending && uploadFileMut.variables?.fileType === "excel" ? "Subiendo…" : "Subir"}
              </button>
              {order.excel_file && (
                <button onClick={handleParseExcel}
                  disabled={excelPreviewLoading}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition disabled:opacity-50 whitespace-nowrap">
                  <Eye className="w-3 h-3" />
                  {excelPreviewLoading ? "Parseando…" : "Vista previa"}
                </button>
              )}
            </div>
          </div>

          {/* PDF */}
          <div className="border border-dashed border-gray-200 rounded-lg p-3 flex items-center gap-3">
            <FileText className="w-8 h-8 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-600 mb-0.5">PDF / Documento</p>
              {order.pdf_file ? (
                <div className="flex items-center gap-2">
                  <a href={order.pdf_file} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate max-w-[120px]" title={order.pdf_file}>
                    {order.pdf_file.split("/").pop()}
                  </a>
                  <a href={order.pdf_file} download className="p-0.5 text-gray-400 hover:text-blue-600 transition" title="Descargar">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => deleteFileMut.mutate("pdf")} disabled={deleteFileMut.isPending}
                    className="p-0.5 text-gray-400 hover:text-red-500 transition disabled:opacity-50" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Sin archivo</p>
              )}
            </div>
            <div>
              <input ref={pdfInputRef} type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => handleFileChange("pdf", e)} />
              <button onClick={() => pdfInputRef.current?.click()}
                disabled={uploadFileMut.isPending}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition disabled:opacity-50 whitespace-nowrap">
                <Upload className="w-3 h-3" />
                {uploadFileMut.isPending && uploadFileMut.variables?.fileType === "pdf" ? "Subiendo…" : "Subir"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Excel Preview */}
      {excelPreviewError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al parsear Excel</p>
            <p className="text-xs text-red-600 mt-0.5">{excelPreviewError}</p>
          </div>
          <button onClick={() => setExcelPreviewError("")} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {excelPreview && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-200">
            <h2 className="font-semibold text-blue-900 flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Vista previa del Excel parseado
              <span className="text-xs text-blue-500 font-normal">
                — {excelPreview.total_items} ítems · {excelPreview.total_unidades?.toLocaleString("es-AR")} unidades
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {order?.status === "BORRADOR" && (
                <button
                  onClick={() => { if (window.confirm(`¿Aplicar ${excelPreview.total_items} ítems del Excel al pedido? Esto reemplazará los ítems actuales.`)) applyExcelMut.mutate(); }}
                  disabled={applyExcelMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition">
                  <Check className="w-3.5 h-3.5" />
                  {applyExcelMut.isPending ? "Aplicando…" : "Aplicar al pedido"}
                </button>
              )}
              <button onClick={() => setExcelPreview(null)} className="text-blue-400 hover:text-blue-700 transition" title="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rules applied */}
          {excelPreview.rules_applied?.length > 0 && (
            <div className="px-5 py-2 bg-blue-50/50 border-b border-blue-100">
              <div className="flex flex-wrap gap-2">
                {excelPreview.rules_applied.map((r, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">{r}</span>
                ))}
              </div>
            </div>
          )}

          {/* Solapas */}
          <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
            {(excelPreview.solapas || []).map((s, idx) => {
              const curvas = (s.items || []).filter(it => it.es_curva).length;
              return (
                <details key={idx} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden" open={s.items?.length > 0}>
                  <summary className="px-4 py-2 cursor-pointer hover:bg-gray-100 transition text-sm font-medium text-gray-800 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-gray-500" />
                    {s.nombre || `Hoja ${idx + 1}`}
                    <span className="text-xs text-gray-500 font-normal ml-auto">
                      {s.items?.length || 0} ítems · {(s.items || []).reduce((a, it) => a + (it.cantidad || 0), 0).toLocaleString("es-AR")} u.
                      {curvas > 0 && <span className="ml-1 text-amber-700 font-medium">{curvas} curvas ×10</span>}
                    </span>
                  </summary>
                  {s.items?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-gray-100 text-gray-500 font-medium">
                            <th className="text-left px-3 py-1.5">Código</th>
                            <th className="text-left px-2 py-1.5">Descripción</th>
                            <th className="text-center px-2 py-1.5">Talle</th>
                            <th className="text-center px-2 py-1.5">Color</th>
                            <th className="text-right px-3 py-1.5">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {s.items.map((it, j) => (
                            <tr key={j} className={it.es_curva ? "bg-amber-50" : ""}>
                              <td className="px-3 py-1 font-mono text-gray-700">{it.codigo || "—"}</td>
                              <td className="px-2 py-1 text-gray-600 truncate max-w-[200px]">{it.descripcion || "—"}</td>
                              <td className="px-2 py-1 text-center text-gray-500">{it.talle || "—"}</td>
                              <td className="px-2 py-1 text-center text-gray-500">{it.color || "—"}</td>
                              <td className="px-3 py-1 text-right font-medium">
                                {it.es_curva ? (
                                  <span className="text-amber-800">
                                    <span className="line-through text-gray-400 mr-1">{it.cantidad_original}</span>
                                    {it.cantidad} <span className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded">×10</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-800">{it.cantidad}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* Items section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" /> Ítems del pedido
            <span className="text-xs text-gray-400 font-normal">({items.length})</span>
          </h2>
          {isEditable && !addingItem && (
            <button onClick={() => setAddingItem(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition">
              <Plus className="w-3.5 h-3.5" /> Agregar ítem
            </button>
          )}
        </div>

        {/* Add item form */}
        {addingItem && (
          <form onSubmit={handleAddItem} className="p-4 bg-blue-50 border-b border-blue-100">
            <p className="text-xs text-blue-700 font-medium mb-3">Nuevo ítem</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Cód. variante (ID)</label>
                <input type="number" placeholder="ID (opcional)" value={itemForm.variant_id}
                  onChange={e => iif("variant_id", e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Código</label>
                <input type="text" placeholder="SKU / código" value={itemForm.code}
                  onChange={e => iif("code", e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Descripción</label>
                <input type="text" placeholder="Descripción del artículo" value={itemForm.description}
                  onChange={e => iif("description", e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Talle</label>
                <input type="text" placeholder="XS/S/M/L/XL…" value={itemForm.size}
                  onChange={e => iif("size", e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Color</label>
                <input type="text" placeholder="Color" value={itemForm.color}
                  onChange={e => iif("color", e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Cantidad <span className="text-red-500">*</span></label>
                  <input type="number" min="1" value={itemForm.qty_ordered}
                    onChange={e => iif("qty_ordered", e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Costo unit.</label>
                  <input type="number" step="0.01" placeholder="0.00" value={itemForm.unit_cost}
                    onChange={e => iif("unit_cost", e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>
            </div>
            {addItemMut.isError && (
              <p className="text-xs text-red-600 mb-2">{addItemMut.error?.message || "Error al agregar ítem"}</p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={addItemMut.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                <Check className="w-3 h-3" /> {addItemMut.isPending ? "Agregando…" : "Agregar"}
              </button>
              <button type="button" onClick={() => setAddingItem(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Items table */}
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin ítems cargados</p>
            {isEditable && <p className="text-xs mt-1">Usá "+ Agregar ítem" para cargar artículos</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-medium">
                  <th className="text-left px-4 py-2.5">Código</th>
                  <th className="text-left px-3 py-2.5">Descripción</th>
                  <th className="text-center px-3 py-2.5">Talle</th>
                  <th className="text-center px-3 py-2.5">Color</th>
                  <th className="text-right px-3 py-2.5">Pedido</th>
                  <th className="text-right px-3 py-2.5">Recibido</th>
                  <th className="text-right px-3 py-2.5">Costo u.</th>
                  {isEditable && <th className="w-10 px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-gray-700">{item.code || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-gray-600">{item.description || item.variant_sku || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{item.size || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{item.color || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-800">{item.qty_ordered}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={item.qty_received > 0 ? "text-green-700 font-medium" : "text-gray-400"}>
                        {item.qty_received ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500">
                      {item.unit_cost != null ? `$${Number(item.unit_cost).toLocaleString("es-AR")}` : <span className="text-gray-300">—</span>}
                    </td>
                    {isEditable && (
                      <td className="px-3 py-2.5 text-center">
                        <button
                          disabled={removeItemMut.isPending && removeItemMut.variables === item.id}
                          onClick={() => { if (window.confirm("¿Quitar este ítem?")) removeItemMut.mutate(item.id); }}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-40"
                          title="Quitar ítem"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium text-gray-700">
                    <td colSpan={isEditable ? 4 : 4} className="px-4 py-2 text-right text-xs uppercase tracking-wide text-gray-500">Total</td>
                    <td className="px-3 py-2 text-right">{items.reduce((s, i) => s + (i.qty_ordered || 0), 0)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{items.reduce((s, i) => s + (i.qty_received || 0), 0)}</td>
                    <td className="px-3 py-2 text-right">
                      {items.some(i => i.unit_cost != null)
                        ? `$${items.reduce((s, i) => s + (i.unit_cost || 0) * (i.qty_ordered || 0), 0).toLocaleString("es-AR")}`
                        : "—"}
                    </td>
                    {isEditable && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── small info row helper ─── */
function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}
