import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Plus, Eye, Trash2, Search, X, Check, Ban, FileText, Package,
  ChevronDown, AlertTriangle, CheckCircle2, Clock, DollarSign,
  ArrowLeft, Pencil, Hash, Calendar, Truck, User, RefreshCw,
  Copy, GitCompare, Upload, MapPin, Download, WifiOff,
} from "lucide-react";
import CargaAvanzada from "../components/CargaAvanzada";
import { exportCSV } from "../lib/exportUtils";
import { useOnlineStatus } from "../hooks/useOffline";
import { getAll, enqueueOp, putItem } from "../lib/offlineDB";

/* ═══════════════════════════════════════════════════════ */
/*  HELPERS                                                */
/* ═══════════════════════════════════════════════════════ */
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";
const fmtMoney = (v) => v ? `$${Number(v).toLocaleString("es-AR", { minimumFractionDigits: 0 })}` : "—";
const daysSince = (d) => {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000);
};

function parseNotes(notes) {
  if (!notes) return { tipo: null, local: null, obs: null };
  const tipo = notes.match(/Tipo:\s*(.+?)(?:\n|$)/)?.[1]?.trim() || null;
  const local = notes.match(/Local:\s*(.+?)(?:\n|$)/)?.[1]?.trim() || null;
  const obs = notes.split('\n').filter(l => !l.startsWith('Tipo:') && !l.startsWith('Local:')).join(' ').trim() || null;
  return { tipo, local, obs };
}

/* Status classification for a nota in the Ingresos context */
function getSeccion(nota) {
  const { facturas = [], remitos = [], total_facturado = 0, pedido_qty = 0, diferencia = 0 } = nota;
  const totalDocs = facturas.length + remitos.length;
  if (totalDocs === 0) return "SIN_NADA";
  const hasFac = facturas.length > 0;
  const hasRem = remitos.length > 0;
  // comprasOK solo cuando ambos docs existen y las cantidades cuadran
  const comprasOK = hasFac && hasRem && diferencia === 0 && pedido_qty > 0;
  if (comprasOK) return "OK";
  // INCOMPLETO antes que SOLO_FALTA — si hay diferencia, es incompleto sin importar si faltan remitos
  if (totalDocs > 0 && diferencia !== 0) return "INCOMPLETO";
  if (hasFac && !hasRem) return "SOLO_FALTA_REM";
  if (hasRem && !hasFac) return "SOLO_FALTA_FAC";
  return "OTROS";
}

const SECCION_CONFIG = {
  SIN_RV:         { label: "Falta remito de venta", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", accent: "border-l-yellow-500" },
  INCOMPLETO:     { label: "Cantidades incompletas", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", accent: "border-l-amber-500" },
  SOLO_FALTA_REM: { label: "Solo falta remito", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", accent: "border-l-red-500" },
  SOLO_FALTA_FAC: { label: "Solo falta factura", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", accent: "border-l-blue-500" },
  OK:             { label: "Compras OK", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", accent: "border-l-emerald-400" },
  OTROS:          { label: "En proceso", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", accent: "border-l-gray-400" },
  SIN_NADA:       { label: "Sin documentación", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", accent: "border-l-slate-400" },
};
const SECCION_ORDEN = ["SIN_RV", "INCOMPLETO", "SOLO_FALTA_REM", "SOLO_FALTA_FAC", "OK", "OTROS", "SIN_NADA"];

/* ═══════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                         */
/* ═══════════════════════════════════════════════════════ */
export default function IngresoPage() {
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);

  if (view === "create") return <IngresoForm onBack={() => setView("list")} />;
  if (view === "detail" && selectedId) return (
    <IngresoDetail id={selectedId} onBack={() => { setView("list"); setSelectedId(null); }} />
  );
  return (
    <IngresoListView
      onView={(id) => { setSelectedId(id); setView("detail"); }}
      onCreate={() => setView("create")}
    />
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  LIST VIEW — nota-centric (matches CONTROL REMITOS)     */
/* ═══════════════════════════════════════════════════════ */
function IngresoListView({ onView, onCreate }) {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set(["SIN_RV", "INCOMPLETO", "SOLO_FALTA_REM", "SOLO_FALTA_FAC", "OK", "OTROS", "SIN_NADA"]));
  const [cruzarModal, setCruzarModal] = useState(null);
  const [itemsModal, setItemsModal] = useState(null); // { doc, type }
  const [showCargaAvanzada, setShowCargaAvanzada] = useState(false);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [groupByLocal, setGroupByLocal] = useState(false);

  const toggleExpand = (id) => setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleSection = (key) => setCollapsedSections(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  /* ── Fetch data ── */
  const { data: vistaData = [], isLoading, refetch } = useQuery({
    queryKey: ["pedidos-vista", online],
    queryFn: async () => {
      if (!online) {
        const cached = await getAll("pendingIngresos");
        return cached;
      }
      return api.get("/pedidos/vista-integrada/all");
    },
    refetchInterval: online ? 10000 : false,
  });

  /* ── Enrich notas ── */
  const allNotas = useMemo(() => vistaData.map(n => {
    const parsed = parseNotes(n.notes);
    const dias = daysSince(n.date);
    const falta = n.pedido_qty - (n.total_facturado || 0);
    const seccion = getSeccion(n);
    const esANP = n.status === "RECIBIDO" && n.diferencia !== 0;
    const latestFacDate = n.facturas?.length
      ? n.facturas.reduce((mx, f) => (!mx || f.date > mx ? f.date : mx), null)
      : null;
    return {
      ...n,
      tipo: parsed.tipo || n.tipo,
      local: parsed.local || n.local,
      _obs: parsed.obs,
      _dias: dias,
      _falta: falta,
      _seccion: seccion,
      _esANP: esANP,
      _latestFacDate: latestFacDate,
    };
  }), [vistaData]);

  /* ── Filter pipeline ── */
  const filtered = useMemo(() => {
    let items = allNotas.filter(n => !["ANULADO"].includes(n.status));
    if (filtroTipo) items = items.filter(n => n.tipo === filtroTipo);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(n =>
        n.number?.toLowerCase().includes(q) ||
        n.provider_name?.toLowerCase().includes(q) ||
        n.local?.toLowerCase().includes(q) ||
        n.facturas?.some(f => f.number?.toLowerCase().includes(q)) ||
        n.remitos?.some(r => r.number?.toLowerCase().includes(q))
      );
    }
    if (sectionFilter !== "all") items = items.filter(n => n._seccion === sectionFilter);
    return items;
  }, [allNotas, filtroTipo, search, sectionFilter]);

  /* ── Group by section ── */
  const sections = useMemo(() =>
    SECCION_ORDEN.map(key => ({
      key,
      notas: filtered.filter(n => n._seccion === key).sort((a, b) => (b._dias || 0) - (a._dias || 0)),
    })).filter(s => s.notas.length > 0),
  [filtered]);

  /* ── Alertas: remitos without linked factura ── */
  const alertasRem = useMemo(() =>
    allNotas.filter(n =>
      n.remitos.length > 0 &&
      n.facturas.length === 0 &&
      !["ANULADO","RECIBIDO"].includes(n.status) &&
      daysSince(n.date) >= 2
    ).sort((a, b) => (b._dias || 0) - (a._dias || 0)),
  [allNotas]);

  /* ── Alertas: reposiciones vencidas ── */
  const alertasRepo = useMemo(() =>
    allNotas.filter(n =>
      n.tipo === "REPOSICIÓN" &&
      !["ANULADO","RECIBIDO"].includes(n.status) &&
      n.total_facturado > 0 &&
      n._falta > 0
    ).sort((a, b) => (b._dias || 0) - (a._dias || 0)),
  [allNotas]);

  /* ── Summary stats ── */
  const stats = useMemo(() => ({
    total: allNotas.filter(n => !["ANULADO"].includes(n.status)).length,
    sinRV: allNotas.filter(n => !["ANULADO"].includes(n.status) && n._seccion === "SIN_RV").length,
    incompleto: allNotas.filter(n => !["ANULADO"].includes(n.status) && n._seccion === "INCOMPLETO").length,
    ok: allNotas.filter(n => !["ANULADO"].includes(n.status) && n._seccion === "OK").length,
    sinNada: allNotas.filter(n => !["ANULADO"].includes(n.status) && n._seccion === "SIN_NADA").length,
  }), [allNotas]);

  /* ── Group by local ── */
  const grouped = useMemo(() => {
    if (!groupByLocal) return null;
    const groups = {};
    filtered.forEach(nota => {
      const local = nota.local || "Sin local";
      if (!groups[local]) groups[local] = [];
      groups[local].push(nota);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupByLocal]);

  const exportCurrentCSV = () => {
    const rows = filtered.map(n => ({
      numero: n.number,
      proveedor: n.provider_name,
      fecha: n.date,
      local: n.local || "",
      tipo: n.tipo || "",
      pedido_qty: n.pedido_qty,
      facturado: n.total_facturado || 0,
      remitido: (n.remitos || []).reduce((s, r) => s + (r.quantity || 0), 0),
      diferencia: n.diferencia,
      estado: n._seccion,
      dias: n._dias,
    }));
    exportCSV(rows, `ingresos-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Ingresos
            {!online && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <WifiOff size={12} /> MODO OFFLINE
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500">Documentación de compras — Facturas y remitos vinculados a notas de pedido</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Nuevo Ingreso
        </button>
        <button onClick={() => setShowCargaAvanzada(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 text-sm font-medium transition">
          <Upload className="w-4 h-4" /> Carga Avanzada
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          ["all", "Todos", "bg-gray-100 text-gray-700"],
          ["SIN_RV", "Sin RV", "bg-yellow-100 text-yellow-700"],
          ["INCOMPLETO", "Incompleto", "bg-amber-100 text-amber-700"],
          ["SOLO_FALTA_REM", "Falta Remito", "bg-red-100 text-red-700"],
          ["SOLO_FALTA_FAC", "Falta Factura", "bg-blue-100 text-blue-700"],
          ["OK", "OK", "bg-emerald-100 text-emerald-700"],
          ["SIN_NADA", "Sin docs", "bg-gray-100 text-gray-500"],
        ].map(([val, label, cls]) => (
          <button key={val} onClick={() => setSectionFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
              sectionFilter === val ? "ring-2 ring-offset-1 ring-blue-500 " + cls : cls + " opacity-70 hover:opacity-100"
            }`}>
            {label}
            {val !== "all" && (
              <span className="ml-1 font-bold">
                ({allNotas.filter(n => !["ANULADO"].includes(n.status) && n._seccion === val).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {showCargaAvanzada && (
        <CargaAvanzada
          onClose={() => setShowCargaAvanzada(false)}
          onSuccess={() => { qc.invalidateQueries(["pedidos-vista"]); qc.invalidateQueries(["purchase-invoices"]); }}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => refetch()} className="p-1.5 hover:bg-gray-100 rounded" title="Actualizar">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar: proveedor, N° pedido, N° factura..."
            className="w-full pl-8 pr-3 py-1.5 border rounded text-xs" />
        </div>
        <button onClick={() => setFiltroTipo(filtroTipo === "PRECOMPRA" ? null : "PRECOMPRA")}
          className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${filtroTipo === "PRECOMPRA" ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50"}`}>PRE</button>
        <button onClick={() => setFiltroTipo(filtroTipo === "REPOSICIÓN" ? null : "REPOSICIÓN")}
          className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${filtroTipo === "REPOSICIÓN" ? "bg-teal-600 text-white border-teal-700" : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50"}`}>REP</button>
        {filtroTipo && (
          <button onClick={() => setFiltroTipo(null)} className="px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600 hover:bg-gray-200">✕ Limpiar</button>
        )}
        <button onClick={() => setGroupByLocal(g => !g)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            groupByLocal ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}>
          <MapPin className="h-3.5 w-3.5" /> Agrupar por local
        </button>
        <button onClick={exportCurrentCSV}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-colors">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : (
        <div className="space-y-1">
          {/* Column header */}
          <div className="flex items-center px-2 py-1 rounded border border-gray-200 bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-wide">
            <span className="shrink-0 w-4"></span>
            <span className="shrink-0 w-[120px]">N° PEDIDO</span>
            <span className="shrink-0 w-[140px]">PROVEEDOR</span>
            <span className="shrink-0 w-[76px]">FECHA</span>
            <span className="shrink-0 w-[140px]">LOCAL</span>
            <span className="shrink-0 w-[55px] text-right pr-2">CANT.</span>
            <span className="shrink-0 w-[80px]">TIPO</span>
            <span className="shrink-0 w-[140px]">OBSERVACIONES</span>
            <span className="shrink-0 w-[180px] text-center">RESUMEN</span>
            <span className="ml-auto shrink-0">DOCS / ACCIONES</span>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Check className="h-12 w-12 mx-auto mb-3 text-green-400" />
              <p className="text-lg font-medium">Sin notas pendientes</p>
            </div>
          )}

          {/* ── Alert: Remitos sin factura (+2d) — MOVIDO A PedidosComprasPage ── */}
          {false && alertasRem.length > 0 && (
            <CollapsibleAlert label="Remitos sin factura (+2 días)" count={alertasRem.length} accentColor="orange"
              collapsed={collapsedSections.has("ALERTA_REM")} onToggle={() => toggleSection("ALERTA_REM")}>
              <div className="flex items-center gap-2 px-2 py-1 bg-orange-100/60 border-b border-orange-200 text-[9px] font-bold text-orange-800 uppercase tracking-wider">
                <span className="shrink-0 w-[50px] text-center">DÍAS</span>
                <span className="shrink-0 w-[55px]">TIPO</span>
                <span className="shrink-0 w-[140px]">N° PEDIDO</span>
                <span className="shrink-0 w-[76px]">FECHA</span>
                <span className="shrink-0 w-[55px] text-right">CANT.</span>
                <span className="shrink-0 w-[160px]">PROVEEDOR</span>
                <span className="flex-1">LOCAL</span>
                <span className="shrink-0 w-[60px] text-center">ACCIONES</span>
              </div>
              <div className="divide-y divide-orange-100 max-h-[300px] overflow-y-auto">
                {alertasRem.map(n => (
                  <div key={`rem-alert-${n.id}`} className={`flex items-center gap-2 px-2 py-1 ${n._dias >= 7 ? "bg-red-50" : "bg-orange-50"}`}>
                    <span className={`px-1.5 py-0 rounded text-[9px] font-bold text-white shrink-0 leading-4 w-[50px] text-center ${n._dias >= 7 ? "bg-red-600" : n._dias >= 4 ? "bg-orange-600" : "bg-yellow-600"}`}>{n._dias}d</span>
                    <span className="bg-blue-100 text-blue-700 border border-blue-300 px-1 py-0 rounded text-[9px] font-bold leading-4 shrink-0 w-[55px] text-center">REM</span>
                    <span className="font-bold text-[11px] text-gray-900 shrink-0 w-[140px] truncate">#{n.number}</span>
                    <span className="text-[10px] text-gray-500 shrink-0 w-[76px]">{fmtDate(n.date)}</span>
                    <span className="text-[10px] font-bold text-gray-700 shrink-0 w-[55px] text-right">{n.pedido_qty}</span>
                    <span className="text-[10px] text-gray-500 shrink-0 w-[160px] truncate">{n.provider_name}</span>
                    <span className="text-[10px] text-gray-400 flex-1 truncate">{n.local || ""}</span>
                    <span className="shrink-0 w-[60px] flex items-center justify-end">
                      <button
                        onClick={() => {
                          setCollapsedSections(prev => { const s = new Set(prev); s.add("ALERTA_REM"); s.delete(n._seccion); return s; });
                          setExpandedIds(prev => { const s = new Set(prev); s.add(n.id); return s; });
                          setTimeout(() => { const el = document.getElementById(`nota-ing-${n.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 300);
                        }}
                        className="px-1.5 py-0 bg-slate-600 text-white rounded text-[9px] font-bold hover:bg-slate-700 leading-4" title="Ver nota en la lista">
                        ↓ Ver
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleAlert>
          )}

          {/* ── Alert: Reposiciones vencidas — MOVIDO A PedidosComprasPage ── */}
          {false && alertasRepo.length > 0 && (
            <CollapsibleAlert label="Alertas de reposición" count={alertasRepo.length} accentColor="red"
              collapsed={collapsedSections.has("ALERTA_REPO")} onToggle={() => toggleSection("ALERTA_REPO")}>
              <div className="flex items-center gap-2 px-2 py-1 bg-red-100/60 border-b border-red-200 text-[9px] font-bold text-red-800 uppercase tracking-wider">
                <span className="shrink-0 w-[58px] text-center">ESTADO</span>
                <span className="shrink-0 w-[140px]">N° PEDIDO</span>
                <span className="shrink-0 w-[120px]">PROVEEDOR</span>
                <span className="flex-1">LOCAL</span>
                <span className="shrink-0 w-[50px] text-right">PEDIDO</span>
                <span className="shrink-0 w-[50px] text-right">FACTUR.</span>
                <span className="shrink-0 w-[50px] text-right">FALTAN</span>
                <span className="shrink-0 w-[80px]"></span>
              </div>
              <div className="divide-y divide-red-100 max-h-[300px] overflow-y-auto">
                {alertasRepo.map(n => {
                  const urgente = n._dias >= 30;
                  return (
                    <div key={`repo-${n.id}`} className={`flex items-center gap-2 px-2 py-1 ${urgente ? "bg-red-50" : "bg-orange-50"}`}>
                      <span className={`px-1.5 py-0 rounded text-[9px] font-bold text-white shrink-0 leading-4 w-[58px] text-center ${urgente ? "bg-red-600" : "bg-orange-500"}`}>ESP. {n._dias}d</span>
                      <span className="font-bold text-[11px] text-gray-900 shrink-0 w-[140px] truncate">#{n.number}</span>
                      <span className="text-[10px] text-gray-500 shrink-0 w-[120px] truncate">{n.provider_name}</span>
                      <span className="text-[10px] text-gray-400 flex-1 truncate">{n.local}</span>
                      <span className="text-[10px] font-bold text-gray-700 shrink-0 w-[50px] text-right">{n.pedido_qty}</span>
                      <span className={`text-[10px] font-bold shrink-0 w-[50px] text-right ${n.total_facturado > 0 ? "text-blue-600" : "text-red-500"}`}>{n.total_facturado}</span>
                      <span className="text-[10px] font-bold text-red-600 shrink-0 w-[50px] text-right">−{n._falta}</span>
                      <div className="flex items-center gap-1 shrink-0 w-[80px] justify-end">
                        <button onClick={() => {
                          setCollapsedSections(prev => { const s = new Set(prev); s.add("ALERTA_REPO"); s.delete(n._seccion); return s; });
                          setExpandedIds(prev => { const s = new Set(prev); s.add(n.id); return s; });
                          setTimeout(() => { const el = document.getElementById(`nota-ing-${n.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 300);
                        }}
                          className="px-1.5 py-0 bg-slate-600 text-white rounded text-[9px] font-bold hover:bg-slate-700 leading-4">↓ Ver</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleAlert>
          )}

          {/* ── Sections grouped by status or local ── */}
          {groupByLocal && grouped ? (
            grouped.map(([localName, localNotas]) => {
              const isCollapsed = collapsedSections.has(`local-${localName}`);
              return (
                <div key={localName} className="mb-1.5">
                  <div className={`flex items-center gap-2 px-3 py-1.5 border-l-4 border-l-indigo-400 bg-indigo-50 border border-indigo-200 cursor-pointer select-none ${isCollapsed ? "rounded" : "rounded-t"}`}
                    onClick={() => toggleSection(`local-${localName}`)}>
                    <span className={`text-[9px] text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}>▶</span>
                    <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-indigo-700">{localName}</span>
                    <span className="text-[10px] text-gray-500 font-medium">{localNotas.length}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {localNotas.map(nota => {
                        const cfg = SECCION_CONFIG[nota._seccion] || SECCION_CONFIG.OTROS;
                        return (
                          <NotaRow key={nota.id} nota={nota} isExpanded={expandedIds.has(nota.id)}
                            onToggle={() => toggleExpand(nota.id)} onCruzar={() => setCruzarModal({ nota })}
                            onViewIngreso={(ingresoId) => onView(ingresoId)}
                            onViewItems={(doc) => setItemsModal({ doc })}
                            cfg={cfg} />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            sections.map(seccion => {
              const cfg = SECCION_CONFIG[seccion.key];
              if (!cfg) return null;
              const isCollapsed = collapsedSections.has(seccion.key);
              return (
                <div key={seccion.key} className="mb-1.5">
                  <div className={`flex items-center gap-2 px-3 py-1 border-l-4 ${cfg.accent} ${cfg.bg} border ${cfg.border} ${isCollapsed ? "rounded" : "rounded-t"} cursor-pointer select-none`}
                    onClick={() => toggleSection(seccion.key)}>
                    <span className={`text-[9px] text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}>▶</span>
                    <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-[10px] text-gray-500 font-medium">{seccion.notas.length}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {seccion.notas.map(nota => (
                        <NotaRow key={nota.id} nota={nota} isExpanded={expandedIds.has(nota.id)}
                          onToggle={() => toggleExpand(nota.id)} onCruzar={() => setCruzarModal({ nota })}
                          onViewIngreso={(ingresoId) => onView(ingresoId)}
                          onViewItems={(doc) => setItemsModal({ doc })}
                          cfg={cfg} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {cruzarModal && <CruzarDocumentosModal nota={cruzarModal.nota} onClose={() => setCruzarModal(null)} />}
      {itemsModal && <ItemsPDFModal doc={itemsModal.doc} onClose={() => setItemsModal(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  COLLAPSIBLE ALERT SECTION                              */
/* ═══════════════════════════════════════════════════════ */
function CollapsibleAlert({ label, count, accentColor, collapsed, onToggle, children }) {
  const borderMap = { red: "border-red-200 border-l-red-500 bg-red-50", orange: "border-orange-200 border-l-orange-500 bg-orange-50" };
  const textMap = { red: "text-red-700", orange: "text-orange-700" };
  return (
    <div className="mb-1.5">
      <div className={`flex items-center gap-2 px-3 py-1 border-l-4 border ${borderMap[accentColor]} ${collapsed ? "rounded" : "rounded-t"} cursor-pointer select-none`} onClick={onToggle}>
        <span className={`text-[9px] text-gray-400 transition-transform ${collapsed ? "" : "rotate-90"}`}>▶</span>
        <AlertTriangle className="h-3 w-3" style={{ color: accentColor === "red" ? "#dc2626" : "#ea580c" }} />
        <span className={`text-[11px] font-semibold ${textMap[accentColor]}`}>{label}</span>
        <span className="text-[10px] text-gray-500 font-medium">{count}</span>
      </div>
      {!collapsed && (
        <div className={`border border-t-0 ${accentColor === "red" ? "border-red-200" : "border-orange-200"} rounded-b overflow-hidden`}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  DOC SINGLE ROW — used inside DocPairsGrid              */
/* ═══════════════════════════════════════════════════════ */
function DocSingleRow({ doc, type, onViewIngreso, onViewItems }) {
  const isFac = type === "FAC";
  const bgClass = isFac ? "bg-white" : "bg-orange-50/40";
  const badgeClass = isFac ? "bg-blue-600 text-white" : "bg-orange-500 text-white";
  const eyeClass = isFac ? "text-blue-500 hover:bg-blue-100" : "text-orange-500 hover:bg-orange-100";
  const npRef = doc.np_ref || doc.notes_np || null;
  const rv = !isFac && (doc.remito_venta_number || null);

  return (
    <div className={`flex items-center gap-1 py-1 px-1.5 flex-wrap ${bgClass}`}>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeClass}`}>{type}</span>
      <span className="font-mono text-[11px] font-bold text-gray-800 shrink-0 truncate max-w-[100px]" title={doc.number}>{doc.number}</span>
      <span className="text-gray-500 text-[10px] shrink-0">{doc.quantity}u</span>
      <span className="text-gray-400 text-[10px] shrink-0">{fmtDate(doc.date)}</span>
      {npRef && <span className="text-gray-500 text-[10px] shrink-0 italic truncate max-w-[90px]" title={npRef}>NP {npRef}</span>}
      {/* Eye: view ingreso */}
      <button onClick={() => onViewIngreso(doc.id)} className={`p-0.5 rounded shrink-0 ${eyeClass}`} title="Ver detalle">
        <Eye className="h-3 w-3" />
      </button>
      {/* Green eye: items PDF */}
      <button onClick={() => onViewItems(doc)} className="p-0.5 text-green-500 hover:bg-green-100 rounded shrink-0" title="Items del PDF">
        <Eye className="h-3 w-3 text-green-500" />
      </button>
      {/* Status badge */}
      {doc.status === "CONFIRMADO" ? (
        <span className="bg-green-600 text-white w-3.5 h-3.5 rounded-full text-[7px] flex items-center justify-center shrink-0" title="Confirmado">✓</span>
      ) : doc.status === "ANULADO" ? (
        <span className="bg-red-500 text-white px-1 py-0.5 rounded text-[7px] font-bold shrink-0">ANUL</span>
      ) : (
        <span className="bg-yellow-400 text-yellow-900 px-1 py-0.5 rounded text-[7px] font-bold shrink-0">BORR</span>
      )}
      {/* RV badge on remitos */}
      {rv && <span className="bg-green-100 text-green-700 border border-green-300 px-1 py-0.5 rounded text-[9px] font-bold shrink-0">RV:{rv}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  DOC PAIRS GRID — FAC left / REM right side by side     */
/* ═══════════════════════════════════════════════════════ */
function DocPairsGrid({ facturas, remitos, onViewIngreso, onViewItems }) {
  const maxPairs = Math.max(facturas.length, remitos.length);
  if (maxPairs === 0) return null;
  return (
    <div className="divide-y divide-gray-100 border border-gray-100 rounded overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-2 gap-0 bg-gray-50 border-b border-gray-200">
        <div className="py-0.5 px-2 text-[10px] font-semibold text-blue-600 border-r border-gray-200">FACTURAS</div>
        <div className="py-0.5 px-2 text-[10px] font-semibold text-orange-600">REMITOS</div>
      </div>
      {Array.from({ length: maxPairs }, (_, i) => {
        const f = facturas[i];
        const r = remitos[i];
        return (
          <div key={i} className="border-b border-gray-100 last:border-b-0">
            <div className="grid grid-cols-2 gap-0">
              <div className="border-r border-gray-100">
                {f
                  ? <DocSingleRow doc={f} type="FAC" onViewIngreso={onViewIngreso} onViewItems={onViewItems} />
                  : <div className="py-1 px-2 text-[10px] text-gray-300 italic">—</div>}
              </div>
              <div>
                {r
                  ? <DocSingleRow doc={r} type="REM" onViewIngreso={onViewIngreso} onViewItems={onViewItems} />
                  : <div className="py-1 px-2 text-[10px] text-gray-300 italic">—</div>}
              </div>
            </div>
            {f && r && (
              <div className="px-2 pb-0.5">
                <button
                  onClick={() => {}}
                  className="text-purple-600 text-[10px] hover:underline flex items-center gap-0.5"
                  title="Comparar cantidades FAC vs REM"
                >
                  <Eye className="h-2.5 w-2.5" /> Comparar FAC vs REM
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  ITEMS PDF MODAL                                         */
/* ═══════════════════════════════════════════════════════ */
function ItemsPDFModal({ doc, onClose }) {
  const items = doc?.items_pdf || [];
  const hasItems = items.length > 0 && items.some(it => it.code || it.description || it.qty > 0);
  const totalQty = hasItems ? items.reduce((s, it) => s + (it.qty || 0), 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Items extraídos del PDF</h3>
            <p className="text-xs text-gray-500 font-mono">{doc?.number || "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto flex-1 p-4">
          {hasItems ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-2 py-1.5 border border-gray-200 text-gray-600 font-semibold w-8">#</th>
                  <th className="text-left px-2 py-1.5 border border-gray-200 text-gray-600 font-semibold">Código</th>
                  <th className="text-left px-2 py-1.5 border border-gray-200 text-gray-600 font-semibold">Descripción</th>
                  <th className="text-right px-2 py-1.5 border border-gray-200 text-gray-600 font-semibold">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1 border border-gray-200 font-mono text-gray-700">{it.code || "—"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-700">{it.description || "—"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-right font-bold text-gray-800">{it.qty ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-bold">
                  <td colSpan={3} className="px-2 py-1.5 border border-gray-200 text-right text-blue-700">TOTAL</td>
                  <td className="px-2 py-1.5 border border-gray-200 text-right text-blue-700">{totalQty}</td>
                </tr>
              </tfoot>
            </table>
          ) : doc?.items_count > 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <Package className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">Resumen disponible</p>
              <p className="text-xs text-gray-500">Items: {doc.items_count} — los detalles individuales no fueron importados.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <Package className="h-10 w-10 text-gray-300" />
              <p className="text-sm font-semibold text-gray-500">Sin datos extraídos del PDF</p>
              <p className="text-xs text-gray-400">Los ítems de este documento no están disponibles en la base de datos.</p>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  NOTA ROW (collapsed + expanded)                        */
/* ═══════════════════════════════════════════════════════ */
function NotaRow({ nota, isExpanded, onToggle, onCruzar, onViewIngreso, onViewItems, cfg }) {
  const totalFac = (nota.facturas || []).reduce((s, f) => s + (f.quantity || 0), 0);
  const totalRem = (nota.remitos || []).reduce((s, r) => s + (r.quantity || 0), 0);
  const np = nota.pedido_qty || 0;
  const difNPFac = np - totalFac;

  return (
    <div id={`nota-ing-${nota.id}`} className={`rounded border overflow-hidden ${cfg.border} bg-white`}>
      {/* Collapsed header */}
      <div className={`flex items-center px-2 py-1 cursor-pointer ${isExpanded ? "bg-slate-700 text-white" : nota.tipo === "REPOSICIÓN" ? "hover:bg-teal-50 bg-teal-50/40" : nota.tipo === "PRECOMPRA" ? "hover:bg-indigo-50 bg-indigo-50/30" : "hover:bg-gray-50"}`} onClick={onToggle}>
        <span className={`transition-transform text-[11px] shrink-0 w-4 ${isExpanded ? "rotate-90" : ""}`}>▶</span>
        <span className="font-bold text-[11px] shrink-0 w-[120px] truncate flex items-center gap-1" title={nota.number}>
          #{nota.number}
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(nota.number); }}
            className={`p-0.5 rounded shrink-0 ${isExpanded ? "text-slate-300 hover:text-white hover:bg-white/20" : "text-gray-300 hover:text-gray-600"}`} title="Copiar">
            <Copy className="h-2.5 w-2.5" />
          </button>
        </span>
        <span className={`text-[11px] shrink-0 w-[140px] truncate ${isExpanded ? "text-slate-300" : "text-gray-600"}`}>{nota.provider_name}</span>
        <span className={`text-[10px] shrink-0 w-[76px] flex items-center gap-0.5 ${isExpanded ? "text-slate-400" : "text-gray-400"}`}>
          <span className="truncate">{fmtDate(nota.date)}</span>
          {nota._dias > 30 && (
            <span className="bg-orange-500 text-white text-[8px] font-bold px-0.5 rounded leading-3 shrink-0">{nota._dias}d</span>
          )}
        </span>
        <span className={`text-[10px] shrink-0 w-[140px] truncate ${isExpanded ? "text-slate-300" : "text-gray-500"}`}>{nota.local || ""}</span>
        <span className={`text-[10px] shrink-0 w-[55px] text-right pr-2 ${isExpanded ? "text-slate-400" : "text-gray-400"}`}>{np || "-"}</span>
        <div className="shrink-0 w-[80px] flex items-center gap-1">
          {nota.tipo === "PRECOMPRA" && <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 ${isExpanded ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-700 border border-indigo-300"}`}>PRE</span>}
          {nota.tipo === "REPOSICIÓN" && <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 ${isExpanded ? "bg-teal-500 text-white" : "bg-teal-100 text-teal-700 border border-teal-300"}`}>REP</span>}
          {nota.diferencia === 0 && totalFac > 0 && <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 ${isExpanded ? "bg-green-500 text-white" : "bg-green-100 text-green-700 border border-green-300"}`}>C:OK</span>}
          {nota._esANP && <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 animate-pulse ${isExpanded ? "bg-green-600 text-white" : "bg-green-500 text-white"}`}>ANP -{Math.abs(nota.diferencia)}u</span>}
          {nota.diferencia !== 0 && totalFac > 0 && !nota._esANP && <span className={`px-1.5 py-0 rounded text-[9px] font-bold leading-4 ${isExpanded ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 border border-amber-300"}`}>C:DIF {nota.diferencia > 0 ? `-${nota.diferencia}` : `+${Math.abs(nota.diferencia)}`}</span>}
        </div>
        <span className={`text-[10px] shrink-0 w-[140px] truncate ${isExpanded ? "text-slate-300" : "text-gray-600"}`} title={nota._obs || ""}>{nota._obs || "-"}</span>
        <div className="shrink-0 w-[180px] flex flex-col gap-0" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 flex-wrap">
            {difNPFac === 0 && totalFac > 0
              ? <span className="bg-green-100 text-green-700 px-1.5 py-0 rounded text-[9px] font-bold leading-4">{totalFac}u ✓</span>
              : difNPFac > 0 && totalFac > 0
                ? <span className="bg-orange-100 text-orange-700 px-1.5 py-0 rounded text-[9px] font-bold leading-4">faltan {difNPFac}u</span>
                : difNPFac < 0
                  ? <span className="bg-red-100 text-red-700 px-1.5 py-0 rounded text-[9px] font-bold leading-4">sobran {Math.abs(difNPFac)}u</span>
                  : null}
            {totalRem > 0 && totalRem !== totalFac && (
              <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0 rounded text-[9px] font-bold leading-4">rem {totalRem < totalFac ? `-${totalFac - totalRem}` : `+${totalRem - totalFac}`}u</span>
            )}
            {(nota.facturas?.length > 0 || nota.remitos?.length > 0) && (
              <span className={`px-1 py-0 rounded text-[9px] leading-4 ${isExpanded ? "bg-white/10 text-slate-300" : "bg-gray-100 text-gray-500"}`}>
                {nota.facturas?.length > 0 && `${nota.facturas.length}F`}{nota.remitos?.length > 0 && ` ${nota.remitos.length}R`}
              </span>
            )}
          </div>
          {np > 0 && totalFac > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-1 mt-0.5">
              <div
                className={`h-1 rounded-full transition-all ${totalFac >= np ? "bg-green-500" : "bg-blue-400"}`}
                style={{ width: `${Math.min(100, Math.round((totalFac / np) * 100))}%` }}
              />
            </div>
          )}
          {(totalFac > 0 || totalRem > 0) && (
            <span className={`text-[8px] ${isExpanded ? "text-slate-400" : "text-gray-400"}`}>ped={np} fac={totalFac}{totalRem > 0 ? ` rem=${totalRem}` : ""}</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {nota.total_docs > 0 && (
            <button onClick={onCruzar} className="bg-slate-600 text-white px-2 py-0.5 rounded text-[9px] font-bold hover:bg-slate-700 leading-4">Cruzar</button>
          )}
          <button onClick={onToggle} className={`p-0.5 rounded text-[10px] font-bold ${isExpanded ? "bg-white/10 hover:bg-white/25 text-white" : "hover:bg-gray-100 text-gray-400"}`}>
            {isExpanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-2">
          <div className="flex items-center gap-3 mb-2 px-2 py-1 bg-gray-50 rounded border text-[11px]">
            <span className="text-gray-500">Ped: <b className="text-gray-800">{np}</b></span>
            <span className="text-gray-300">|</span>
            <span>Fac: <b className="text-blue-700">{totalFac}</b></span>
            <span className="text-gray-300">|</span>
            <span>Rem: <b className="text-orange-600">{totalRem}</b></span>
            {difNPFac !== 0 && totalFac > 0 && (
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold ${difNPFac > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                {difNPFac > 0 ? `FALTAN ${difNPFac}u` : `SOBRAN ${Math.abs(difNPFac)}u`}
              </span>
            )}
            {difNPFac === 0 && totalFac > 0 && (
              <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">✓ Compras OK</span>
            )}
          </div>

          <div className="flex gap-4">
            <div className="w-52 flex-shrink-0">
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3">
                <p className="text-xs font-bold text-emerald-700 uppercase mb-2">📋 NOTA DE PEDIDO</p>
                <div className="space-y-1 text-[11px] text-gray-600 mb-3">
                  <div className="flex justify-between"><span>Pedido:</span><b>{np}u</b></div>
                  <div className="flex justify-between"><span>Facturado:</span><b className="text-blue-700">{totalFac}u</b></div>
                  <div className="flex justify-between"><span>Remitido:</span><b className="text-orange-600">{totalRem}u</b></div>
                </div>
                {nota._obs && (
                  <p className="text-[10px] text-gray-600 italic mb-2 px-2 py-1 bg-white rounded border leading-relaxed">💬 {nota._obs}</p>
                )}
                <button onClick={onCruzar} disabled={nota.total_docs === 0}
                  className="w-full bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg px-3 py-2 text-xs font-bold hover:from-slate-700 hover:to-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <GitCompare className="h-3.5 w-3.5" /> Cruzar Documentos
                </button>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {nota.facturas.length === 0 && nota.remitos.length === 0 ? (
                <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-500">
                  <Package className="h-6 w-6 mx-auto mb-1 text-gray-300" />
                  <p className="text-xs">Sin facturas ni remitos cargados</p>
                </div>
              ) : (
                <DocPairsGrid
                  facturas={nota.facturas}
                  remitos={nota.remitos}
                  onViewIngreso={onViewIngreso}
                  onViewItems={onViewItems}
                />
              )}

              {nota.total_docs > 0 && difNPFac !== 0 && totalFac > 0 && (
                <div className={`mt-1 rounded px-2 py-1 text-center font-bold text-xs ${difNPFac > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                  {difNPFac > 0 ? `FALTAN ${difNPFac}u` : `SOBRAN ${Math.abs(difNPFac)}u`} — Pedido {np} / Facturado {totalFac}
                </div>
              )}

              {nota.total_docs === 0 && (
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-500 text-center">
                  ⏳ Sin facturas ni remitos — esperando documentación
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  CRUZAR DOCUMENTOS MODAL                                */
/* ═══════════════════════════════════════════════════════ */
function CruzarDocumentosModal({ nota, onClose }) {
  const [activeTab, setActiveTab] = useState("compras");
  const facturas = nota.facturas || [];
  const remitos = nota.remitos || [];
  const totalFacturado = facturas.reduce((s, f) => s + (f.quantity || 0), 0);
  const totalRemitido = remitos.reduce((s, r) => s + (r.quantity || 0), 0);
  const difNPvsFac = nota.pedido_qty - totalFacturado;
  const difFacvsRem = totalFacturado - totalRemitido;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-600 to-slate-800 px-5 py-3 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2"><GitCompare className="h-4 w-4" /> Cruzar Documentos</h3>
            <p className="text-slate-300 text-xs mt-0.5">Pedido #{nota.number} — {nota.provider_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-5 gap-0 border-b">
          {[
            { label: "Pedido", val: nota.pedido_qty, cls: "text-gray-800" },
            { label: "Facturado", val: totalFacturado, cls: "text-blue-700" },
            { label: "Remitido", val: totalRemitido, cls: "text-orange-600" },
            { label: "Dif NP↔Fac", val: difNPvsFac, cls: difNPvsFac === 0 ? "text-green-600" : "text-red-600", fmt: v => v === 0 ? "✓ 0" : v > 0 ? `-${v}` : `+${Math.abs(v)}` },
            { label: "Dif Fac↔Rem", val: difFacvsRem, cls: difFacvsRem === 0 ? "text-green-600" : "text-red-600", fmt: v => v === 0 ? "✓ 0" : v > 0 ? `-${v}` : `+${Math.abs(v)}` },
          ].map((c, i) => (
            <div key={i} className={`px-3 py-2 text-center ${i < 4 ? "border-r" : ""}`}>
              <p className="text-[10px] text-gray-500 uppercase">{c.label}</p>
              <p className={`text-lg font-bold ${c.cls}`}>{c.fmt ? c.fmt(c.val) : c.val}</p>
            </div>
          ))}
        </div>

        <div className="flex border-b">
          {[
            { id: "compras", label: "COMPRAS", desc: "NP vs Facturado" },
            { id: "pagos", label: "PAGOS", desc: "Factura vs Remito" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase border-b-2 transition ${activeTab === t.id ? "border-slate-600 text-slate-700 bg-slate-50" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label} <span className="text-[9px] font-normal ml-1 text-gray-400">({t.desc})</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === "compras" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-emerald-600 uppercase font-bold">Pedido (NP)</p>
                  <p className="text-2xl font-bold text-emerald-700">{nota.pedido_qty}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-blue-600 uppercase font-bold">Facturado</p>
                  <p className="text-2xl font-bold text-blue-700">{totalFacturado}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${difNPvsFac === 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <p className="text-[10px] uppercase font-bold text-gray-600">Diferencia</p>
                  <p className={`text-2xl font-bold ${difNPvsFac === 0 ? "text-green-600" : "text-red-600"}`}>{difNPvsFac === 0 ? "✓ OK" : difNPvsFac}</p>
                </div>
              </div>
              <table className="w-full text-xs border rounded-lg overflow-hidden">
                <thead><tr className="bg-gray-100 text-left">
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Número</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold text-right">Cantidad</th>
                  <th className="px-3 py-2 font-semibold text-center">Estado</th>
                </tr></thead>
                <tbody>
                  {facturas.map(f => (
                    <tr key={f.id} className="border-t hover:bg-blue-50/30">
                      <td className="px-3 py-2"><span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">FAC</span></td>
                      <td className="px-3 py-2 font-mono font-bold">{f.number}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(f.date)}</td>
                      <td className="px-3 py-2 text-right font-bold">{f.quantity}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${f.status === "CONFIRMADO" ? "bg-green-100 text-green-700" : f.status === "ANULADO" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{f.status}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right">Total facturado:</td>
                    <td className="px-3 py-2 text-right text-blue-700">{totalFacturado}</td>
                    <td></td>
                  </tr>
                  {remitos.map(r => (
                    <tr key={r.id} className="border-t hover:bg-orange-50/30">
                      <td className="px-3 py-2"><span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">REM</span></td>
                      <td className="px-3 py-2 font-mono font-bold">{r.number}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2 text-right font-bold">{r.quantity}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${r.status === "CONFIRMADO" ? "bg-green-100 text-green-700" : r.status === "ANULADO" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                  {remitos.length > 0 && (
                    <tr className="bg-gray-50 border-t-2 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right">Total remitido:</td>
                      <td className="px-3 py-2 text-right text-orange-600">{totalRemitido}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "pagos" && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Factura vs Remito — Cruce por documento</h4>
              {facturas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No hay facturas para cruzar</p>
              ) : (
                <table className="w-full text-xs border rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-100 text-left">
                    <th className="px-3 py-2 font-semibold">FAC Número</th>
                    <th className="px-3 py-2 font-semibold text-right">FAC Cant.</th>
                    <th className="px-3 py-2 font-semibold text-center">→</th>
                    <th className="px-3 py-2 font-semibold">REM Número</th>
                    <th className="px-3 py-2 font-semibold text-right">REM Cant.</th>
                    <th className="px-3 py-2 font-semibold text-right">Diferencia</th>
                  </tr></thead>
                  <tbody>
                    {facturas.map((f, idx) => {
                      const r = remitos[idx];
                      const facQty = f.quantity || 0;
                      const remQty = r ? (r.quantity || 0) : 0;
                      const diff = facQty - remQty;
                      return (
                        <tr key={f.id} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2"><span className="bg-blue-600 text-white px-1 py-0.5 rounded text-[9px] font-bold mr-1">FAC</span><span className="font-mono font-bold">{f.number}</span></td>
                          <td className="px-3 py-2 text-right font-bold">{facQty}</td>
                          <td className="px-3 py-2 text-center text-gray-300">→</td>
                          <td className="px-3 py-2">{r ? (<><span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[9px] font-bold mr-1">REM</span><span className="font-mono font-bold">{r.number}</span></>) : <span className="text-gray-400 italic">Sin remito</span>}</td>
                          <td className="px-3 py-2 text-right font-bold">{r ? remQty : "—"}</td>
                          <td className="px-3 py-2 text-right">{r ? <span className={`font-bold ${diff === 0 ? "text-green-600" : "text-red-600"}`}>{diff === 0 ? "✓" : diff}</span> : <span className="text-red-500 font-bold">–{facQty}</span>}</td>
                        </tr>
                      );
                    })}
                    {remitos.slice(facturas.length).map(r => (
                      <tr key={r.id} className="border-t bg-orange-50/30">
                        <td className="px-3 py-2 text-gray-400 italic">Sin factura</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-center text-gray-300">←</td>
                        <td className="px-3 py-2"><span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[9px] font-bold mr-1">REM</span><span className="font-mono font-bold">{r.number}</span></td>
                        <td className="px-3 py-2 text-right font-bold">{r.quantity}</td>
                        <td className="px-3 py-2 text-right text-orange-600 font-bold">+{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  DETAIL VIEW                                            */
/* ═══════════════════════════════════════════════════════ */
function IngresoDetail({ id, onBack }) {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const { data: ingreso, isLoading } = useQuery({
    queryKey: ["ingreso", id, online],
    queryFn: async () => {
      if (!online) {
        const all = await getAll("pendingIngresos");
        return all.find(i => i.id === id) || null;
      }
      return api.get(`/ingresos/${id}`);
    },
  });
  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!online) {
        await enqueueOp("INGRESO", "POST", `/ingresos/${id}/confirm`, {});
        return { id, status: "CONFIRMADO" };
      }
      return api.post(`/ingresos/${id}/confirm`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingreso", id] }); qc.invalidateQueries({ queryKey: ["ingresos"] }); },
  });
  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!online) {
        await enqueueOp("INGRESO", "POST", `/ingresos/${id}/cancel`, {});
        return { id, status: "ANULADO" };
      }
      return api.post(`/ingresos/${id}/cancel`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingreso", id] }); qc.invalidateQueries({ queryKey: ["ingresos"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/ingresos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingresos"] }); onBack(); },
  });
  const removeItemMut = useMutation({
    mutationFn: (itemId) => api.delete(`/ingresos/${id}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingreso", id] }),
  });
  const addItemMut = useMutation({
    mutationFn: (data) => api.post(`/ingresos/${id}/items`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingreso", id] }),
  });
  const [addItemOpen, setAddItemOpen] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!ingreso) return <div className="text-center py-12 text-gray-500">Ingreso no encontrado</div>;

  const isDraft = ingreso.status === "BORRADOR";
  const totalUnits = ingreso.items?.reduce((s, it) => s + it.quantity, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
        <ArrowLeft className="w-4 h-4" /> Volver a ingresos
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${ingreso.type === "REMITO" ? "bg-orange-100 text-orange-700 border border-orange-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
              {ingreso.type === "REMITO" ? <Package className="w-3 h-3" /> : <FileText className="w-3 h-3" />} {ingreso.type === "REMITO" ? "REM" : "FAC"}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">#{ingreso.number}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              ingreso.status === "CONFIRMADO" ? "bg-green-50 text-green-700 border border-green-200" :
              ingreso.status === "ANULADO" ? "bg-red-50 text-red-700 border border-red-200" :
              "bg-yellow-50 text-yellow-700 border border-yellow-200"
            }`}>{ingreso.status === "CONFIRMADO" ? "Confirmado" : ingreso.status === "ANULADO" ? "Anulado" : "Borrador"}</span>
            {!online && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <WifiOff size={12} /> MODO OFFLINE
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
            <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {ingreso.provider_name}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(ingreso.date)}</span>
            {ingreso.created_by_name && (
              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {ingreso.created_by_name}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <button onClick={() => { if (confirm("¿Confirmar ingreso? Se actualizará el stock.")) confirmMut.mutate(); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 font-medium"
                disabled={confirmMut.isPending || !ingreso.items?.length}>
                <Check className="w-4 h-4" /> Confirmar
              </button>
              <button onClick={() => { if (confirm("¿Anular este ingreso?")) cancelMut.mutate(); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100 font-medium"
                disabled={cancelMut.isPending}>
                <Ban className="w-4 h-4" /> Anular
              </button>
              <button onClick={() => { if (confirm("¿Eliminar este ingreso permanentemente?")) deleteMut.mutate(); }}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 font-medium"
                disabled={deleteMut.isPending}>
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </>
          )}
          {ingreso.status === "CONFIRMADO" && (
            <button onClick={() => { if (confirm("¿Anular ingreso? Se revertirá el stock.")) cancelMut.mutate(); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100 font-medium"
              disabled={cancelMut.isPending}>
              <Ban className="w-4 h-4" /> Anular Ingreso
            </button>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-xs text-gray-500">Tipo</span>
          <p className="font-semibold capitalize">{ingreso.type.toLowerCase()}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Items</span>
          <p className="font-semibold">{ingreso.items?.length || 0}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Unidades totales</span>
          <p className="font-semibold">{totalUnits}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Monto total</span>
          <p className="font-semibold text-lg">{fmtMoney(ingreso.total)}</p>
        </div>
      </div>

      {/* Notes */}
      {ingreso.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Notas:</strong> {ingreso.notes}
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
          <h3 className="font-semibold text-sm text-gray-700">Ítems ({ingreso.items?.length || 0})</h3>
          {isDraft && (
            <button onClick={() => setAddItemOpen(true)}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
              <Plus className="w-3 h-3" /> Agregar
            </button>
          )}
        </div>
        {(!ingreso.items || ingreso.items.length === 0) ? (
          <div className="text-center py-10">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Sin ítems</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Producto</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 hidden sm:table-cell">SKU</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 hidden md:table-cell">Talle / Color</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">Cantidad</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 hidden sm:table-cell">Costo Unit.</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">Subtotal</th>
                {isDraft && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ingreso.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{item.product_name || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600 hidden sm:table-cell">{item.variant_sku || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">{item.variant_size || "—"} / {item.variant_color || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                    {item.unit_cost ? fmtMoney(item.unit_cost) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {item.unit_cost ? fmtMoney(item.quantity * item.unit_cost) : "—"}
                  </td>
                  {isDraft && (
                    <td className="px-2 py-2.5">
                      <button onClick={() => { if (confirm("¿Quitar este ítem?")) removeItemMut.mutate(item.id); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50/80 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-600 hidden md:table-cell">Total</td>
                <td className="px-4 py-3 text-right font-bold text-gray-700">{totalUnits}</td>
                <td className="px-4 py-3 hidden sm:table-cell"></td>
                <td className="px-4 py-3 text-right font-bold text-lg text-gray-900">{fmtMoney(ingreso.total)}</td>
                {isDraft && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Add Item Modal */}
      {addItemOpen && (
        <AddItemModal
          online={online}
          onClose={() => setAddItemOpen(false)}
          onSave={(data) => addItemMut.mutate(data, { onSuccess: () => setAddItemOpen(false) })}
          loading={addItemMut.isPending}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  CREATE FORM                                            */
/* ═══════════════════════════════════════════════════════ */
function IngresoForm({ onBack }) {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const [form, setForm] = useState({
    type: "REMITO",
    number: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    provider_id: "",
  });
  const [items, setItems] = useState([]);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-list", online],
    queryFn: async () => {
      if (!online) {
        return await getAll("catalogProviders");
      }
      return api.get("/providers/?limit=500");
    },
    select: (d) => Array.isArray(d) ? d : d?.items ?? [],
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      if (online) {
        return api.post("/ingresos/", data);
      }
      const localId = await enqueueOp("INGRESO", "POST", "/ingresos/", data);
      const offlineIngreso = {
        id: localId,
        ...data,
        status: "BORRADOR",
        _offline: true,
        created_at: new Date().toISOString(),
      };
      await putItem("pendingIngresos", offlineIngreso);
      return offlineIngreso;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingresos"] }); qc.invalidateQueries({ queryKey: ["pedidos-vista"] }); onBack(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMut.mutate({
      ...form,
      provider_id: Number(form.provider_id),
      items: items.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        unit_cost: i.unit_cost || null,
      })),
    });
  };

  const total = items.reduce((s, i) => s + (i.unit_cost || 0) * i.quantity, 0);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
        <ArrowLeft className="w-4 h-4" /> Volver a ingresos
      </button>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        Nuevo Ingreso
        {!online && (
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
            <WifiOff size={12} /> MODO OFFLINE
          </span>
        )}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-sm text-gray-700 mb-4">Datos del Ingreso</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <div className="flex gap-2">
                {[
                  { val: "REMITO", label: "Remito", icon: Package, color: "orange" },
                  { val: "FACTURA", label: "Factura", icon: FileText, color: "blue" },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = form.type === opt.val;
                  return (
                    <button key={opt.val} type="button"
                      onClick={() => setForm({ ...form, type: opt.val })}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
                        active
                          ? opt.color === "orange" ? "bg-orange-100 border-orange-300 text-orange-700" : "bg-blue-100 border-blue-300 text-blue-700"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}>
                      <Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
              <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="0001-00001234"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
              <select required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none bg-white">
                <option value="">Seleccionar...</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observaciones del ingreso..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none resize-none" />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <h3 className="font-semibold text-sm text-gray-700">Ítems ({items.length})</h3>
            <button type="button" onClick={() => setAddItemOpen(true)}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
              <Plus className="w-3 h-3" /> Agregar Ítem
            </button>
          </div>
          {items.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Agregue productos a este ingreso</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Producto</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 hidden sm:table-cell">SKU</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 hidden md:table-cell">Talle / Color</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Cant.</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500 hidden sm:table-cell">Costo</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium">{item.product_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 hidden sm:table-cell">{item.variant_sku}</td>
                      <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">{item.variant_size} / {item.variant_color}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                        {item.unit_cost ? fmtMoney(item.unit_cost) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {item.unit_cost ? fmtMoney(item.quantity * item.unit_cost) : "—"}
                      </td>
                      <td className="px-2">
                        <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50/80 border-t border-gray-100">
                <span className="text-sm text-gray-500">{totalUnits} unidades</span>
                <span className="font-bold text-gray-900">Total: {fmtMoney(total)}</span>
              </div>
            </>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onBack}
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">Cancelar</button>
          <button type="submit" disabled={createMut.isPending || items.length === 0}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium transition">
            {createMut.isPending ? "Guardando..." : "Crear Ingreso"}
          </button>
        </div>
      </form>

      {addItemOpen && (
        <AddItemModal
          online={online}
          onClose={() => setAddItemOpen(false)}
          onSave={(data) => { setItems([...items, data]); setAddItemOpen(false); }}
          loading={false}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  ADD ITEM MODAL                                         */
/* ═══════════════════════════════════════════════════════ */
function AddItemModal({ onClose, onSave, loading, online }) {
  const [productSearch, setProductSearch] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-search-ingreso", productSearch, online],
    queryFn: async () => {
      if (!online) {
        let cached = await getAll("catalogProducts");
        if (productSearch) {
          const q = productSearch.toLowerCase();
          cached = cached.filter(p =>
            (p.name || "").toLowerCase().includes(q) ||
            (p.code || "").toLowerCase().includes(q) ||
            (p.brand || "").toLowerCase().includes(q) ||
            (p.variants || []).some(v => (v.sku || "").toLowerCase().includes(q))
          );
        }
        return cached;
      }
      return api.get(`/products/?${productSearch ? `search=${encodeURIComponent(productSearch)}&` : ""}limit=50`);
    },
    select: (d) => Array.isArray(d) ? d : d?.items ?? [],
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedVariant) return;
    onSave({
      variant_id: selectedVariant.id,
      variant_sku: selectedVariant.sku,
      variant_size: selectedVariant.size,
      variant_color: selectedVariant.color,
      product_name: selectedVariant._productName,
      quantity: Number(quantity),
      unit_cost: unitCost ? Number(unitCost) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Agregar Ítem</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Product search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Producto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setSelectedVariant(null); }}
                placeholder="Nombre, código o marca..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          {/* Variant list */}
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {products.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                {productSearch ? "Sin resultados" : "Escriba para buscar productos"}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {products.flatMap((p) =>
                  (p.variants || []).map((v) => ({
                    ...v,
                    _productName: p.name,
                    _productCode: p.code,
                    _baseCost: p.base_cost,
                  }))
                ).map((v) => (
                  <button key={v.id} type="button"
                    onClick={() => { setSelectedVariant(v); if (!unitCost && v._baseCost) setUnitCost(String(v._baseCost)); }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 transition text-sm flex items-center justify-between ${
                      selectedVariant?.id === v.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                    }`}>
                    <div>
                      <span className="font-medium">{v._productName}</span>
                      <span className="text-gray-500 ml-2 text-xs">({v._productCode})</span>
                      <span className="ml-2 text-xs text-gray-600">{v.size} / {v.color}</span>
                    </div>
                    <span className="font-mono text-xs text-gray-400">{v.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedVariant && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm border border-blue-100">
              <strong>{selectedVariant._productName}</strong>
              <span className="ml-2 text-gray-600">{selectedVariant.size} / {selectedVariant.color}</span>
              <span className="ml-2 font-mono text-xs text-gray-500">SKU: {selectedVariant.sku}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
              <input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Unitario</label>
              <input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition">Cancelar</button>
            <button type="submit" disabled={!selectedVariant || loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium transition">
              {loading ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
