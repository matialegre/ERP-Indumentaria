/**
 * MercadoLibrePage — Módulo Depósito ML (v2)
 *
 * Tabs: Órdenes | Estadísticas | Configuración
 * Features: Picking, scanner, auto-assign, print, notes, stats charts, config
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  ShoppingCart, RefreshCw, CheckCircle, XCircle, RotateCcw,
  Package, Filter, Search, ChevronDown, ChevronUp, AlertTriangle,
  Info, TrendingUp, Clock, Boxes, MapPin, Zap, Eye, X, Printer,
  MessageSquare, User, Calendar, Settings, BarChart3, ScanBarcode,
  Save, Key, Globe, Warehouse, Send, ArrowUpDown, FileText, Layers,
} from "lucide-react";

// ─────────────────────────── Constants & Helpers ────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const MOTIVOS = ["Sin stock", "Manchado", "Roto", "No está", "Talle incorrecto", "Otro"];

const PICKING_COLORS = {
  PENDIENTE: { row: "bg-emerald-50 hover:bg-emerald-100", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  PICKEADO:  { row: "bg-blue-50 hover:bg-blue-100",       badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  FALLADO:   { row: "bg-red-50 hover:bg-red-100",         badge: "bg-red-100 text-red-700",         dot: "bg-red-500" },
  CANCELADO: { row: "bg-gray-50 hover:bg-gray-100",       badge: "bg-gray-100 text-gray-500",       dot: "bg-gray-400" },
};

const PACK_BORDER_COLORS = [
  "border-l-violet-500", "border-l-cyan-500", "border-l-orange-500",
  "border-l-pink-500", "border-l-lime-500", "border-l-amber-500",
  "border-l-teal-500", "border-l-rose-500",
];

const CHART_COLORS = ["#facc15", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899"];

const DEPOSIT_LIST = ["DEP", "MUNDOAL", "MONBAHIA", "MTGBBPS", "MUNDOCAB", "NQNSHOP", "MTGCOM", "MTGROCA", "MUNDOROC", "NQNALB"];

const STOCK_FIELDS = [
  { key: "stock_dep", label: "DEP" }, { key: "stock_mundoal", label: "MUNDOAL" },
  { key: "stock_monbahia", label: "MONBAHIA" }, { key: "stock_mtgbbps", label: "MTGBBPS" },
  { key: "stock_mundocab", label: "MUNDOCAB" }, { key: "stock_nqnshop", label: "NQNSHOP" },
  { key: "stock_mtgcom", label: "MTGCOM" }, { key: "stock_mtgroca", label: "MTGROCA" },
  { key: "stock_mundoroc", label: "MUNDOROC" }, { key: "stock_nqnalb", label: "NQNALB" },
];

function getOrderType(order) {
  const tipo = (order.venta_tipo || "").toUpperCase();
  const ff = (order.fulfillment || "").toUpperCase();
  const tags = (order.tags || "").toLowerCase();
  const sub = (order.shipping_substatus || "").toLowerCase();
  if (tipo === "FULL" || ff === "FULL") return "FULL";
  if (tipo === "FLEX" || ff.includes("FLEX")) return "FLEX";
  if (tipo === "COLECTA" || tags.includes("self_service") || tags.includes("colecta")) return "COLECTA";
  if (tipo.includes("DEVOL") || sub.includes("return")) return "DEVOLUCIONES";
  return null;
}

const TIPOS_CONFIG = [
  { id: "FULL",        label: "FULL",        bg: "bg-blue-50",   text: "text-blue-700",   activeBg: "bg-blue-600",   border: "border-blue-200" },
  { id: "FLEX",        label: "FLEX",        bg: "bg-purple-50", text: "text-purple-700", activeBg: "bg-purple-600", border: "border-purple-200" },
  { id: "COLECTA",     label: "COLECTA",     bg: "bg-green-50",  text: "text-green-700",  activeBg: "bg-green-600",  border: "border-green-200" },
  { id: "DEVOLUCIONES",label: "DEVOLUCIONES",bg: "bg-red-50",    text: "text-red-700",    activeBg: "bg-red-600",    border: "border-red-200" },
];

// ─────────────────────────── Small Components ──────────────────────────────

function PickingBadge({ estado }) {
  const c = PICKING_COLORS[estado] || PICKING_COLORS.PENDIENTE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {estado}
    </span>
  );
}

function FulfillmentBadge({ fulfillment }) {
  if (!fulfillment) return null;
  const upper = fulfillment.toUpperCase();
  if (upper === "FULL") return <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">FULL</span>;
  if (upper === "FLEX" || upper.includes("FLEX")) return <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">FLEX</span>;
  return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">{fulfillment}</span>;
}

function StatCard({ icon: Icon, label, value, color = "blue", onClick, sub }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 ${onClick ? "cursor-pointer hover:shadow-md transition" : ""}`}
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-none mt-0.5">{value ?? "—"}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-gray-800 text-right max-w-xs truncate">{value}</span>
    </div>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-yellow-600";
  return (
    <div className={`fixed bottom-6 right-6 z-[60] ${bg} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-[slideUp_0.3s_ease]`}>
      {type === "success" ? <CheckCircle size={16} /> : type === "error" ? <XCircle size={16} /> : <Info size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:opacity-80"><X size={14} /></button>
    </div>
  );
}

// ─────────────────────────── ML Status Banner ──────────────────────────────

function MLStatusBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ["ml-status"],
    queryFn: () => api.get("/ml/status"),
    refetchInterval: 120_000,
    retry: false,
  });
  if (isLoading) return null;
  const ok = data?.token_ok;
  const mins = ok ? Math.floor((data?.token_remaining_seconds || 0) / 60) : 0;
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
      {ok ? `Token ML válido · ${mins}min` : "Token ML expirado"}
      {data?.user_info?.nickname && <span className="font-medium ml-1">· {data.user_info.nickname}</span>}
    </div>
  );
}

// ─────────────────────────── Detail Modal ──────────────────────────────────

function OrderDetailModal({ order, onClose, onRefresh }) {
  const qc = useQueryClient();
  const [assignDep, setAssignDep] = useState("");
  const [noteText, setNoteText] = useState("");
  const [showAssign, setShowAssign] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const assignMut = useMutation({
    mutationFn: () => api.post(`/ml/deposito/orders/${order.id}/assign`, { deposito: assignDep }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); setShowAssign(false); onRefresh?.(); },
  });

  const noteMut = useMutation({
    mutationFn: () => api.post(`/ml/deposito/orders/${order.id}/note`, { text: noteText }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); setNoteText(""); setShowNote(false); onRefresh?.(); },
  });

  const moveStockMut = useMutation({
    mutationFn: () => api.post(`/ml/deposito/orders/${order.id}/move-stock`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); onRefresh?.(); },
  });

  if (!order) return null;

  const hasStock = STOCK_FIELDS.some(f => order[f.key] != null && order[f.key] > 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Info size={18} className="text-blue-500" /> Detalle de Orden
            {order.pack_id && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Pack #{order.pack_id}</span>}
            <FulfillmentBadge fulfillment={order.fulfillment} />
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Datos principales */}
          <div className="space-y-2.5 text-sm">
            <Row label="Order ID" value={order.order_id} />
            <Row label="Pack ID" value={order.pack_id || "—"} />
            <Row label="Item ID" value={order.item_id || "—"} />
            <Row label="Producto" value={order.item_title} />
            <Row label="SKU" value={order.sku || "—"} />
            <Row label="SKU Real" value={order.sku_real || "—"} />
            <Row label="Barcode" value={order.barcode || "—"} />
            <Row label="Talle / Color" value={`${order.talle || "—"} / ${order.color || "—"}`} />
            <Row label="Cantidad" value={order.quantity} />
            <Row label="Precio unit." value={order.unit_price ? `$${Number(order.unit_price).toLocaleString("es-AR")}` : "—"} />
            <Row label="Comprador" value={`${order.buyer_nickname || "—"} (${order.buyer_id || "—"})`} />
            <Row label="Estado ML" value={order.order_status || "—"} />
            <Row label="Envío" value={`${order.shipping_status || "—"} / ${order.shipping_substatus || "—"}`} />
            <Row label="Shipment ID" value={order.shipment_id || "—"} />
            <Row label="Tags" value={order.tags || "—"} />
            <Row label="Fulfillment" value={order.fulfillment || "—"} />
            <Row label="Split" value={order.split_status || "—"} />
            <Row label="Tipo venta" value={order.venta_tipo || "—"} />
            <Row label="Cuenta ML" value={order.meli_account || "—"} />
            <Row label="Estado picking" value={<PickingBadge estado={order.estado_picking} />} />
            <Row label="Depósito asignado" value={order.deposito_asignado || "Sin asignar"} />
            {order.motivo_falla && <Row label="Motivo falla" value={<span className="text-red-600">{order.motivo_falla}</span>} />}
            <Row label="Nota" value={order.nota || "—"} />
            <Row label="Comentario" value={order.comentario || "—"} />
            <Row label="Fecha orden" value={fmt(order.fecha_orden)} />
            <Row label="Fecha picking" value={fmt(order.fecha_picking)} />
            <Row label="Fecha sync" value={fmt(order.fecha_sync)} />
            <Row label="Impreso" value={order.printed ? "Sí" : "No"} />
            <Row label="Ready to print" value={order.ready_to_print ? "Sí" : "No"} />
          </div>

          {/* Asignación */}
          {(order.asignado_flag || order.asignacion_detalle) && (
            <div className="bg-indigo-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-indigo-800 mb-1">📋 Asignación</p>
              <p className="text-indigo-700 text-xs">{order.asignacion_detalle || "Asignado"}</p>
              {order.fecha_asignacion && <p className="text-indigo-500 text-xs mt-1">Fecha: {fmt(order.fecha_asignacion)}</p>}
            </div>
          )}

          {/* Movimiento */}
          {order.movimiento_realizado && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-800 mb-1">📦 Movimiento Dragonfish</p>
              <p className="text-amber-700 text-xs">Nº: {order.numero_movimiento || "—"}</p>
              {order.observacion_movimiento && <p className="text-amber-600 text-xs">{order.observacion_movimiento}</p>}
            </div>
          )}

          {/* Stock por depósito */}
          {hasStock && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Stock por depósito</p>
              <div className="grid grid-cols-5 gap-1.5">
                {STOCK_FIELDS.map(f => (
                  <div key={f.key} className={`text-center p-1.5 rounded text-xs ${(order[f.key] || 0) > 0 ? "bg-green-50 text-green-700 font-bold" : "bg-gray-50 text-gray-400"}`}>
                    <div className="text-[10px] text-gray-500">{f.label}</div>
                    <div>{order[f.key] ?? 0}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-gray-500">Stock real: <strong className="text-gray-800">{order.stock_real ?? "—"}</strong></span>
                <span className="text-gray-500">Reservado: <strong className="text-gray-800">{order.stock_reservado ?? "—"}</strong></span>
                <span className="text-gray-500">Resultante: <strong className="text-gray-800">{order.resultante ?? "—"}</strong></span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button onClick={() => setShowAssign(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition">
              <MapPin size={13} /> Asignar depósito
            </button>
            <button onClick={() => setShowNote(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition">
              <MessageSquare size={13} /> Publicar nota
            </button>
            {order.deposito_asignado && !order.movimiento_realizado && (
              <button
                onClick={() => moveStockMut.mutate()}
                disabled={moveStockMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-60 transition"
              >
                <ArrowUpDown size={13} /> {moveStockMut.isPending ? "Moviendo…" : "Mover stock"}
              </button>
            )}
          </div>

          {/* Assign inline form */}
          {showAssign && (
            <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-3">
              <select value={assignDep} onChange={e => setAssignDep(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Seleccionar depósito…</option>
                {DEPOSIT_LIST.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button
                onClick={() => assignMut.mutate()}
                disabled={!assignDep || assignMut.isPending}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                {assignMut.isPending ? "Asignando…" : "Confirmar"}
              </button>
            </div>
          )}

          {/* Note inline form */}
          {showNote && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3">
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Escribir nota…"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) noteMut.mutate(); }}
              />
              <button
                onClick={() => noteMut.mutate()}
                disabled={!noteText.trim() || noteMut.isPending}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {noteMut.isPending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Fail Modal ────────────────────────────────────

function FailModal({ order, onClose, onConfirm, loading }) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  if (!order) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-red-500" />
          <h3 className="text-lg font-semibold text-gray-800">Marcar como FALLADO</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          <strong>{order.item_title}</strong><br />
          <span className="text-gray-400">Order #{order.order_id}</span>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
        <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300">
          {MOTIVOS.map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onConfirm(motivo)} disabled={loading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
            {loading ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Estadísticas Tab ─────────────────────────────

function EstadisticasTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["ml-stats-detailed"],
    queryFn: () => api.get("/ml/deposito/stats/detailed"),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" /> Cargando estadísticas…
    </div>
  );

  if (!data) return <div className="text-center py-20 text-gray-400">No hay datos de estadísticas disponibles.</div>;

  const byHour = data.by_hour || [];
  const byDeposit = data.by_deposit || [];
  const byStatus = data.by_status || {};
  const topProducts = data.top_products || [];
  const failReasons = data.fail_reasons || [];

  return (
    <div className="space-y-6">
      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Pendientes" value={byStatus.PENDIENTE ?? 0} color="yellow" />
        <StatCard icon={CheckCircle} label="Pickeados" value={byStatus.PICKEADO ?? 0} color="green" />
        <StatCard icon={XCircle} label="Fallados" value={byStatus.FALLADO ?? 0} color="red" />
        <StatCard icon={Clock} label="Tiempo prom. pick" value={data.avg_pick_time_minutes != null ? `${Math.round(data.avg_pick_time_minutes)} min` : "—"} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pickings por hora — HTML bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={16} /> Pickings por hora</h3>
          {byHour.length > 0 ? (
            <div className="flex items-end gap-1 h-48">
              {byHour.map((h, i) => {
                const max = Math.max(...byHour.map(x => x.count), 1);
                const pct = (h.count / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="absolute -top-6 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{h.count} pickings</div>
                    <div className="w-full bg-yellow-400 rounded-t transition-all group-hover:bg-yellow-500" style={{ height: `${Math.max(pct, 2)}%` }} />
                    <span className="text-[10px] text-gray-400 mt-1">{h.hour}h</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-10">Sin datos</p>}
        </div>

        {/* Órdenes por depósito — horizontal bars */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Warehouse size={16} /> Órdenes por depósito</h3>
          {byDeposit.length > 0 ? (
            <div className="space-y-2">
              {byDeposit.map((d, i) => {
                const max = Math.max(...byDeposit.map(x => x.count), 1);
                const pct = (d.count / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-20 text-right font-medium truncate">{d.deposit}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="h-full rounded-full transition-all flex items-center px-2" style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                        <span className="text-[10px] text-white font-bold">{d.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-10">Sin datos</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 productos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={16} /> Top 10 productos</h3>
          {topProducts.length > 0 ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-1.5 text-gray-500 font-semibold">#</th>
                <th className="text-left py-1.5 text-gray-500 font-semibold">Producto</th>
                <th className="text-left py-1.5 text-gray-500 font-semibold">SKU</th>
                <th className="text-right py-1.5 text-gray-500 font-semibold">Cant.</th>
              </tr></thead>
              <tbody>
                {topProducts.slice(0, 10).map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-1.5 text-gray-800 max-w-[180px] truncate">{p.title || "—"}</td>
                    <td className="py-1.5 font-mono text-gray-500">{p.sku || "—"}</td>
                    <td className="py-1.5 text-right font-bold text-gray-700">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-gray-400 text-sm text-center py-6">Sin datos</p>}
        </div>

        {/* Motivos de falla */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Motivos de falla</h3>
          {failReasons.length > 0 ? (
            <div className="space-y-2">
              {failReasons.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-red-800">{r.reason || "Sin motivo"}</span>
                  <span className="text-sm font-bold text-red-700">{r.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm text-center py-6">Sin fallas registradas</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Configuración Tab ─────────────────────────────

function ConfiguracionTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ml-config"],
    queryFn: () => api.get("/ml/config"),
  });

  useEffect(() => {
    if (config && !form) setForm({ ...config });
  }, [config, form]);

  const saveMut = useMutation({
    mutationFn: (body) => api.put("/ml/config", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-config"] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const { data: tokenStatus } = useQuery({
    queryKey: ["ml-status"],
    queryFn: () => api.get("/ml/status"),
    refetchInterval: 120_000,
    retry: false,
  });

  if (isLoading || !form) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" /> Cargando configuración…
    </div>
  );

  function field(key, label, type = "text") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        {type === "textarea" ? (
          <textarea
            value={form[key] ?? ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />
        ) : (
          <input
            type={type}
            value={form[key] ?? ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Key size={16} /> Estado del Token</h3>
        <MLStatusBanner />
        {tokenStatus && (
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            {tokenStatus.user_info?.nickname && <p>Usuario: <strong>{tokenStatus.user_info.nickname}</strong></p>}
            {tokenStatus.token_remaining_seconds != null && <p>Expira en: <strong>{Math.floor(tokenStatus.token_remaining_seconds / 60)} min</strong></p>}
          </div>
        )}
      </div>

      {/* Cuenta ML 1 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Globe size={16} /> Cuenta MercadoLibre 1</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("ml_client_id_1", "Client ID")}
          {field("ml_client_secret_1", "Client Secret", "password")}
          {field("ml_access_token_1", "Access Token")}
          {field("ml_refresh_token_1", "Refresh Token")}
          {field("ml_user_id_1", "User ID")}
        </div>
      </div>

      {/* Cuenta ML 2 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Globe size={16} /> Cuenta MercadoLibre 2</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("ml_client_id_2", "Client ID")}
          {field("ml_client_secret_2", "Client Secret", "password")}
          {field("ml_access_token_2", "Access Token")}
          {field("ml_refresh_token_2", "Refresh Token")}
          {field("ml_user_id_2", "User ID")}
        </div>
      </div>

      {/* Dragonfish */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Warehouse size={16} /> Dragonfish</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("dragonfish_base_url", "Base URL")}
          {field("dragonfish_token", "Token", "password")}
        </div>
      </div>

      {/* Clusters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Boxes size={16} /> Clusters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("cluster_a", "Cluster A (JSON)", "textarea")}
          {field("cluster_b", "Cluster B (JSON)", "textarea")}
        </div>
      </div>

      {/* Impresora */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Printer size={16} /> Impresora</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("printer_ip", "IP")}
          {field("printer_port", "Puerto")}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMut.mutate(form)}
          disabled={saveMut.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold disabled:opacity-60 transition"
        >
          <Save size={16} /> {saveMut.isPending ? "Guardando…" : "Guardar configuración"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">✓ Configuración guardada</span>}
        {saveMut.isError && <span className="text-sm text-red-600">Error al guardar: {saveMut.error?.message || "desconocido"}</span>}
      </div>
    </div>
  );
}

// ─────────────────────── Tipos Resumen Panel (inline) ───────────────────────

function TiposResumenPanel({ orders }) {
  const [activeType, setActiveType] = useState("FULL");

  const grouped = useMemo(() => {
    const g = { FULL: [], FLEX: [], COLECTA: [], DEVOLUCIONES: [] };
    orders.forEach(o => { const t = getOrderType(o); if (t) g[t].push(o); });
    return g;
  }, [orders]);

  const items = grouped[activeType] || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Layers size={15} className="text-gray-500" /> Pedidos por tipo de envío
        </span>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          {TIPOS_CONFIG.map(t => (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                activeType === t.id ? `${t.activeBg} text-white` : `${t.bg} ${t.text} hover:opacity-80`
              }`}>
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeType === t.id ? "bg-white/30 text-white" : "bg-white text-gray-600"}`}>
                {grouped[t.id].length}
              </span>
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-center py-5 text-gray-400 text-sm">No hay órdenes {activeType} en el rango actual</p>
      ) : (
        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Producto</th>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">SKU</th>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Talle</th>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Estado</th>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Comprador</th>
                <th className="px-3 py-2 text-left text-gray-500 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 max-w-[200px] truncate text-gray-800 font-medium">{o.item_title || "—"}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{o.sku || "—"}</td>
                  <td className="px-3 py-2 text-gray-700">{o.talle || "—"}</td>
                  <td className="px-3 py-2"><PickingBadge estado={o.estado_picking} /></td>
                  <td className="px-3 py-2 text-gray-600">{o.buyer_nickname || "—"}</td>
                  <td className="px-3 py-2 text-gray-400">{o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Tipos Tab (new tab) ─────────────────────────────────

function TiposTab() {
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const hoyStr = new Date().toISOString().split("T")[0];
  const [activeType, setActiveType] = useState("FULL");
  const [desde, setDesde] = useState(hace30);
  const [hasta, setHasta] = useState(hoyStr);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["ml-tipos-orders", desde, hasta],
    queryFn: () => api.get(`/ml/deposito/orders?include_printed=true&desde=${desde}&hasta=${hasta}`),
    refetchInterval: 60_000,
  });

  const grouped = useMemo(() => {
    const g = { FULL: [], FLEX: [], COLECTA: [], DEVOLUCIONES: [] };
    orders.forEach(o => { const t = getOrderType(o); if (t) g[t].push(o); });
    return g;
  }, [orders]);

  const items = grouped[activeType] || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TIPOS_CONFIG.map(t => (
          <div key={t.id} onClick={() => setActiveType(t.id)}
            className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition hover:shadow-md ${activeType === t.id ? `${t.border} shadow-sm` : "border-gray-200"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${t.text}`}>{t.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{grouped[t.id].length}</p>
            <p className="text-xs text-gray-400 mt-0.5">órdenes</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
        <Calendar size={14} className="text-gray-400" />
        <label className="text-xs text-gray-500">Desde</label>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
        <label className="text-xs text-gray-500">Hasta</label>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
        <button onClick={() => refetch()} disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition">
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Actualizar
        </button>
        <span className="text-xs text-gray-400 ml-auto">{orders.length} órdenes totales en el período</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          {TIPOS_CONFIG.map(t => (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeType === t.id ? `${t.activeBg} text-white` : `${t.bg} ${t.text} hover:opacity-80`
              }`}>
              {t.label} ({grouped[t.id].length})
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Cargando…
          </div>
        ) : items.length === 0 ? (
          <p className="text-center py-10 text-gray-400">No hay órdenes {activeType} en este período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Producto", "SKU", "Talle", "Color", "Estado picking", "Estado ML", "Comprador", "Depósito", "Fecha"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 max-w-[220px] truncate font-medium text-gray-800">{o.item_title || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{o.sku || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{o.talle || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{o.color || "—"}</td>
                    <td className="px-3 py-2"><PickingBadge estado={o.estado_picking} /></td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.order_status === "paid" ? "bg-green-100 text-green-700" : o.order_status === "cancelled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                        {o.order_status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{o.buyer_nickname || "—"}</td>
                    <td className="px-3 py-2">
                      {o.deposito_asignado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                          <MapPin size={10} />{o.deposito_asignado}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════ MAIN PAGE ═══════════════════════════════════════

export default function MercadoLibrePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("ordenes");
  const [toast, setToast] = useState(null);
  const [mlAccount, setMlAccount] = useState("");
  const scanRef = useRef(null);

  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);

  // ── Filtros ──────────────────────────────────────────────────────────────
  const hoy = new Date().toISOString().split("T")[0];
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    estado_picking: "", include_printed: false,
    desde: hace7, hasta: hoy, deposito: "", search: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [detailOrder, setDetailOrder] = useState(null);
  const [failOrder, setFailOrder] = useState(null);
  const [sortCol, setSortCol] = useState("fecha_orden");
  const [sortAsc, setSortAsc] = useState(false);
  const [scanInput, setScanInput] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["ml-deposito-stats", mlAccount],
    queryFn: () => api.get(`/ml/deposito/stats${mlAccount ? `?meli_account=${mlAccount}` : ""}`),
    refetchInterval: 30_000,
  });

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.estado_picking) p.set("estado_picking", filters.estado_picking);
    if (filters.include_printed) p.set("include_printed", "true");
    if (filters.desde) p.set("desde", filters.desde);
    if (filters.hasta) p.set("hasta", filters.hasta);
    if (filters.deposito) p.set("deposito", filters.deposito);
    if (filters.search) p.set("search", filters.search);
    if (mlAccount) p.set("meli_account", mlAccount);
    return p.toString();
  }, [filters, mlAccount]);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["ml-deposito-orders", filters, mlAccount],
    queryFn: () => api.get(`/ml/deposito/orders?${buildParams()}`),
    refetchInterval: 30_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const syncMut = useMutation({
    mutationFn: (days) => api.post(`/ml/deposito/sync?days=${days}`),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); qc.invalidateQueries({ queryKey: ["ml-deposito-stats"] }); showToast(`Sync completado: ${d.fetched} órdenes, ${d.new_records} nuevas`); },
    onError: (e) => showToast(e?.message || "Error en sync", "error"),
  });

  const pickMut = useMutation({
    mutationFn: (id) => api.post(`/ml/deposito/orders/${id}/pick`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); refetchStats(); },
  });

  const failMut = useMutation({
    mutationFn: ({ id, motivo }) => api.post(`/ml/deposito/orders/${id}/fail`, { motivo }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); refetchStats(); setFailOrder(null); showToast("Orden marcada como fallada"); },
  });

  const revertMut = useMutation({
    mutationFn: (id) => api.post(`/ml/deposito/orders/${id}/revert`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); refetchStats(); showToast("Orden revertida a pendiente"); },
  });

  const autoAssignMut = useMutation({
    mutationFn: () => api.post("/ml/deposito/auto-assign"),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["ml-deposito-orders"] }); refetchStats();
      showToast(`Auto-asignación: ${d.assigned ?? 0} asignadas, ${d.divided ?? 0} divididas, ${d.no_stock ?? 0} sin stock`);
    },
    onError: (e) => showToast(e?.message || "Error en auto-asignación", "error"),
  });

  const scanMut = useMutation({
    mutationFn: (barcode) => api.post("/ml/deposito/scan", { barcode }),
    onSuccess: (d) => {
      if (d && d.id) {
        pickMut.mutate(d.id);
        showToast(`✅ Orden ${d.order_id || d.id} pickeada por scanner`);
      } else {
        showToast("Código escaneado, sin orden pendiente asociada", "warning");
      }
      setScanInput("");
    },
    onError: (e) => { showToast(e?.message || "Barcode no encontrado", "error"); setScanInput(""); },
  });

  const printListMut = useMutation({
    mutationFn: (orderIds) => api.post("/ml/deposito/print-list", { order_ids: orderIds }),
    onSuccess: (blob) => {
      try {
        const url = typeof blob === "string" ? blob : URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        window.open(url, "_blank");
      } catch {
        showToast("Lista de impresión generada", "success");
      }
    },
    onError: (e) => showToast(e?.message || "Error al generar lista", "error"),
  });

  // ── Sorting ──────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const copy = [...orders];
    copy.sort((a, b) => {
      let av = a[sortCol] ?? "";
      let bv = b[sortCol] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [orders, sortCol, sortAsc]);

  // Pack color map for visual grouping
  const packColorMap = useMemo(() => {
    const map = {};
    let ci = 0;
    sorted.forEach(o => {
      if (o.pack_id && !map[o.pack_id]) {
        map[o.pack_id] = PACK_BORDER_COLORS[ci % PACK_BORDER_COLORS.length];
        ci++;
      }
    });
    return map;
  }, [sorted]);

  // ── Selection ────────────────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() {
    setSelected(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(o => o.id)));
  }

  async function pickSelected() {
    for (const id of selected) await pickMut.mutateAsync(id);
    setSelected(new Set());
    showToast(`${selected.size} órdenes pickeadas`);
  }

  // ── Sort helpers ─────────────────────────────────────────────────────────
  function handleSort(col) {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <ChevronDown size={12} className="text-gray-300" />;
    return sortAsc ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />;
  }

  function Th({ col, children, className = "" }) {
    return (
      <th className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none ${className}`} onClick={() => handleSort(col)}>
        <span className="flex items-center gap-1">{children}<SortIcon col={col} /></span>
      </th>
    );
  }

  // ── Scanner handler ──────────────────────────────────────────────────────
  function handleScan(e) {
    if (e.key === "Enter" && scanInput.trim()) {
      scanMut.mutate(scanInput.trim());
    }
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: "ordenes",       label: "Órdenes",       icon: Package },
    { id: "tipos",         label: "Tipos",          icon: Layers },
    { id: "estadisticas",  label: "Estadísticas",   icon: BarChart3 },
    { id: "configuracion", label: "Configuración",  icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
              <ShoppingCart size={20} className="text-yellow-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">MercadoLibre — Depósito</h1>
              <p className="text-xs text-gray-400">Picking, asignación y gestión de órdenes</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <MLStatusBanner />

            <div className="flex items-center gap-1">
              <button onClick={() => syncMut.mutate(7)} disabled={syncMut.isPending} className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition">
                <RefreshCw size={14} className={syncMut.isPending ? "animate-spin" : ""} />
                {syncMut.isPending ? "Sync…" : "Sync 7d"}
              </button>
              <button onClick={() => syncMut.mutate(30)} disabled={syncMut.isPending} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-sm text-gray-200 disabled:opacity-60 transition">30d</button>
            </div>

            <button onClick={() => autoAssignMut.mutate()} disabled={autoAssignMut.isPending} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition">
              <Zap size={14} className={autoAssignMut.isPending ? "animate-pulse" : ""} />
              {autoAssignMut.isPending ? "Asignando…" : "⚡ Asignar Auto"}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mt-4 -mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm font-medium transition ${
                activeTab === t.id
                  ? "bg-gray-50 text-gray-900"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* ══════════════ ÓRDENES TAB ══════════════ */}
        {activeTab === "ordenes" && (
          <>
            {/* Selector de cuenta ML */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Cuenta ML:</span>
              {[{ key: "", label: "Todas" }, { key: "1", label: "ML 1" }, { key: "2", label: "ML 2" }].map(acc => (
                <button
                  key={acc.key}
                  onClick={() => setMlAccount(acc.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    mlAccount === acc.key
                      ? "border-transparent"
                      : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                  }`}
                  style={mlAccount === acc.key ? { backgroundColor: "#facc15", color: "#713f12" } : {}}
                >
                  {acc.label}
                </button>
              ))}
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Package} label="Pendientes" value={stats?.total_pendiente} color="yellow"
                onClick={() => setFilters(f => ({ ...f, estado_picking: "PENDIENTE", include_printed: false }))} />
              <StatCard icon={CheckCircle} label="Pickeados hoy" value={stats?.pickeados_hoy} color="green"
                onClick={() => setFilters(f => ({ ...f, estado_picking: "PICKEADO", include_printed: true }))} />
              <StatCard icon={AlertTriangle} label="Fallados hoy" value={stats?.fallados_hoy} color="red"
                onClick={() => setFilters(f => ({ ...f, estado_picking: "FALLADO", include_printed: true }))} />
              <StatCard icon={Boxes} label="Total sync" value={stats?.total_sync} color="blue"
                onClick={() => setFilters(f => ({ ...f, estado_picking: "", include_printed: true }))} />
            </div>

            {/* Scanner */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <ScanBarcode size={18} className="text-yellow-900" />
              </div>
              <input
                ref={scanRef}
                type="text"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={handleScan}
                placeholder="Escanear barcode… (Enter para buscar y pickear)"
                className="flex-1 bg-white border border-yellow-300 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
                autoComplete="off"
              />
              <button
                onClick={() => { if (scanInput.trim()) scanMut.mutate(scanInput.trim()); }}
                disabled={scanMut.isPending || !scanInput.trim()}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition"
              >
                {scanMut.isPending ? "Buscando…" : "Buscar"}
              </button>
            </div>

            {/* Filters */}
            <TiposResumenPanel orders={orders} />
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar producto, SKU, comprador…" value={filters.search}
                      onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                      className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-60 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                  </div>
                  <select value={filters.estado_picking}
                    onChange={e => setFilters(f => ({ ...f, estado_picking: e.target.value, include_printed: e.target.value !== "" }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300">
                    <option value="">Solo pendientes</option>
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="PICKEADO">PICKEADO</option>
                    <option value="FALLADO">FALLADO</option>
                    <option value="CANCELADO">CANCELADO</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={filters.include_printed}
                      onChange={e => setFilters(f => ({ ...f, include_printed: e.target.checked }))} className="rounded" />
                    Incluir impresos
                  </label>
                  <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    <Filter size={14} /> Más filtros
                  </button>
                </div>
                <button onClick={() => refetch()} disabled={isLoading} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition" title="Refrescar">
                  <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {showFilters && (
                <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <label className="text-xs text-gray-500">Desde</label>
                    <input type="date" value={filters.desde} onChange={e => setFilters(f => ({ ...f, desde: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                    <label className="text-xs text-gray-500">Hasta</label>
                    <input type="date" value={filters.hasta} onChange={e => setFilters(f => ({ ...f, hasta: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-gray-400" />
                    <input type="text" placeholder="Depósito (ej: MUNDOCAB)" value={filters.deposito}
                      onChange={e => setFilters(f => ({ ...f, deposito: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                  </div>
                  <button onClick={() => setFilters({ estado_picking: "", include_printed: false, desde: hace7, hasta: hoy, deposito: "", search: "" })}
                    className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1">
                    <X size={12} /> Limpiar
                  </button>
                </div>
              )}
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-yellow-800">
                  {selected.size} orden{selected.size > 1 ? "es" : ""} seleccionada{selected.size > 1 ? "s" : ""}
                </span>
                <button onClick={pickSelected} disabled={pickMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold disabled:opacity-60 transition">
                  <CheckCircle size={15} />
                  {pickMut.isPending ? "Pickeando…" : `PICKEAR ${selected.size}`}
                </button>
                {selected.size === 1 && (
                  <button onClick={() => setFailOrder(sorted.find(o => o.id === [...selected][0]))}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition">
                    <XCircle size={15} /> FALLAR
                  </button>
                )}
                <button
                  onClick={() => printListMut.mutate([...selected])}
                  disabled={printListMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition"
                >
                  <Printer size={15} />
                  {printListMut.isPending ? "Generando…" : "🖨 Imprimir Lista"}
                </button>
                <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-gray-500 hover:text-gray-700">
                  Cancelar selección
                </button>
              </div>
            )}

            {/* Orders table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {isLoading ? "Cargando…" : `${sorted.length} orden${sorted.length !== 1 ? "es" : ""}`}
                </span>
                {sorted.length > 0 && (
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                    {selected.size === sorted.length ? "Deseleccionar todo" : "Seleccionar todo"}
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5 w-10">
                        <input type="checkbox" checked={sorted.length > 0 && selected.size === sorted.length} onChange={selectAll} className="rounded" />
                      </th>
                      <Th col="estado_picking">Estado</Th>
                      <Th col="item_title">Producto</Th>
                      <Th col="sku">SKU</Th>
                      <Th col="quantity">Cant.</Th>
                      <Th col="talle">Talle</Th>
                      <Th col="color">Color</Th>
                      <Th col="buyer_nickname">Comprador</Th>
                      <Th col="deposito_asignado">Depósito</Th>
                      <Th col="stock_real">Stock</Th>
                      <Th col="order_status">Estado ML</Th>
                      <Th col="fecha_orden">Fecha</Th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!isLoading && sorted.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-6 py-12 text-center text-gray-400">
                          <div className="flex flex-col items-center gap-2">
                            <Package size={32} className="opacity-30" />
                            <span>No hay órdenes con estos filtros.</span>
                            <button onClick={() => syncMut.mutate(7)} className="text-yellow-600 hover:underline text-sm mt-1">
                              ¿Querés sincronizar desde ML?
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isLoading && (
                      <tr>
                        <td colSpan={13} className="px-6 py-8 text-center text-gray-400">
                          <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> Cargando órdenes…
                        </td>
                      </tr>
                    )}
                    {sorted.map(order => {
                      const c = PICKING_COLORS[order.estado_picking] || PICKING_COLORS.PENDIENTE;
                      const isSelected = selected.has(order.id);
                      const packBorder = order.pack_id ? packColorMap[order.pack_id] : "";

                      return (
                        <tr
                          key={order.id}
                          className={`${c.row} ${isSelected ? "ring-2 ring-inset ring-yellow-400" : ""} ${packBorder ? `border-l-4 ${packBorder}` : ""} cursor-pointer transition-colors`}
                          onClick={() => toggleSelect(order.id)}
                        >
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.id)} className="rounded" />
                          </td>

                          {/* Estado + Fulfillment */}
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <PickingBadge estado={order.estado_picking} />
                              <FulfillmentBadge fulfillment={order.fulfillment} />
                            </div>
                          </td>

                          {/* Producto + pack tag + nota */}
                          <td className="px-3 py-2 max-w-[220px]">
                            <p className="font-medium text-gray-800 truncate">{order.item_title || "—"}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {order.pack_id && (
                                <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">Pack #{order.pack_id}</span>
                              )}
                              {order.nota && (
                                <span className="text-xs text-blue-600 truncate flex items-center gap-0.5">
                                  <MessageSquare size={9} />{order.nota}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">{order.sku || "—"}</td>

                          <td className="px-3 py-2 text-center">
                            <span className="inline-block bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs font-bold">{order.quantity}</span>
                          </td>

                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{order.talle || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{order.color || <span className="text-gray-300">—</span>}</td>

                          <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                            <span className="flex items-center gap-1"><User size={11} />{order.buyer_nickname || "—"}</span>
                          </td>

                          <td className="px-3 py-2">
                            {order.deposito_asignado ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                <MapPin size={10} />{order.deposito_asignado}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">Sin asignar</span>
                            )}
                          </td>

                          {/* Stock */}
                          <td className="px-3 py-2 text-center">
                            {order.stock_real != null ? (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${order.stock_real > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                {order.stock_real}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Estado ML */}
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              order.order_status === "paid" ? "bg-green-100 text-green-700" :
                              order.order_status === "cancelled" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{order.order_status || "—"}</span>
                          </td>

                          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                            {order.fecha_orden ? new Date(order.fecha_orden).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—"}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setDetailOrder(order)} className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-blue-600 transition" title="Ver detalle">
                                <Eye size={14} />
                              </button>
                              {order.estado_picking === "PENDIENTE" && (
                                <button onClick={() => pickMut.mutate(order.id)} disabled={pickMut.isPending}
                                  className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-green-600 transition" title="Pickear">
                                  <CheckCircle size={14} />
                                </button>
                              )}
                              {order.estado_picking === "PENDIENTE" && (
                                <button onClick={() => setFailOrder(order)}
                                  className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-red-600 transition" title="Fallar">
                                  <XCircle size={14} />
                                </button>
                              )}
                              {(order.estado_picking === "PICKEADO" || order.estado_picking === "FALLADO") && (
                                <button onClick={() => revertMut.mutate(order.id)} disabled={revertMut.isPending}
                                  className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-yellow-600 transition" title="Revertir a pendiente">
                                  <RotateCcw size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live orders panel */}
            <MLOrdersQuickPanel />
          </>
        )}

        {/* ══════════════ TIPOS TAB ══════════════ */}
        {activeTab === "tipos" && <TiposTab />}

        {/* ══════════════ ESTADÍSTICAS TAB ══════════════ */}
        {activeTab === "estadisticas" && <EstadisticasTab />}

        {/* ══════════════ CONFIGURACIÓN TAB ══════════════ */}
        {activeTab === "configuracion" && <ConfiguracionTab />}

      </div>

      {/* Modals */}
      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={() => refetch()} />
      )}
      {failOrder && (
        <FailModal
          order={failOrder}
          onClose={() => setFailOrder(null)}
          onConfirm={(motivo) => failMut.mutate({ id: failOrder.id, motivo })}
          loading={failMut.isPending}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─────────────────────── Live Orders Panel ──────────────────────────────────

function MLOrdersQuickPanel() {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ml-orders-live"],
    queryFn: () => api.get("/ml/orders?limit=20&days=7&status=paid"),
    enabled: open,
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
        <span className="flex items-center gap-2">
          <TrendingUp size={16} className="text-yellow-500" />
          Órdenes en tiempo real (API ML)
          <span className="text-xs text-gray-400 font-normal">— últimas 7 días, pagadas</span>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400"><RefreshCw size={20} className="animate-spin mx-auto mb-2" />Cargando desde ML…</div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">{data?.total ?? 0} órdenes totales</span>
                <button onClick={() => refetch()} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><RefreshCw size={11} /> Actualizar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Order ID", "Producto", "SKU", "Cantidad", "Total", "Comprador", "Fecha"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.orders || []).map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-600">{o.id}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-gray-800">{o.item_title || "—"}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{o.sku || "—"}</td>
                        <td className="px-3 py-2 text-center">{o.item_quantity}</td>
                        <td className="px-3 py-2 text-green-700 font-medium">${o.total_amount?.toLocaleString("es-AR")}</td>
                        <td className="px-3 py-2 text-gray-600">{o.buyer_nickname}</td>
                        <td className="px-3 py-2 text-gray-400">{o.date_created ? new Date(o.date_created).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—"}</td>
                      </tr>
                    ))}
                    {(!data?.orders || data.orders.length === 0) && (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No hay órdenes recientes, o el token ML no está configurado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
