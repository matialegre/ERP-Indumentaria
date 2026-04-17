import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Pagination from "../components/Pagination";
import {
  ClipboardList, Plus, Search, Eye, Pencil, Trash2, Send,
  PackageCheck, Ban, X, ArrowLeft, ChevronDown, ChevronRight,
  FileSpreadsheet, AlertTriangle, CheckCircle2, Clock, Package,
  Filter, RotateCcw, Hash, Calendar, Truck, User, DollarSign,
  RefreshCw, FileText, Check, Copy, GitCompare,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════ */
/*  HELPERS                                                */
/* ═══════════════════════════════════════════════════════ */
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";
const fmtMoney = (v) => v ? `$${Number(v).toLocaleString("es-AR", { minimumFractionDigits: 0 })}` : "—";

function parseNoteField(notes, key) {
  if (!notes) return null;
  const m = notes.match(new RegExp(key + ':\\s*(.+?)(?:\\n|$)'));
  return m ? m[1].trim() : null;
}

function daysSince(d) {
  if (!d) return null;
  const diff = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

/* ── Derived state machine ── */
function calcEstado(nota) {
  const { status, total_docs, facturas = [], remitos = [], diferencia } = nota;
  if (status === "ANULADO") return "ANULADO";
  if (status === "RECIBIDO") return diferencia === 0 ? "FINALIZADO" : "FINALIZADO_DIF";
  if (total_docs === 0) return "PENDIENTE";
  if (facturas.length > 0 && remitos.length === 0) return "TRANSITO";
  if (facturas.length > 0 && remitos.length > 0) return diferencia === 0 ? "LISTO_FINALIZAR" : "LISTO_FINALIZAR_DIF";
  if (remitos.length > 0) return "TRANSITO";
  return "PENDIENTE";
}

const ESTADO_LABELS = {
  PENDIENTE: "PENDIENTE", TRANSITO: "EN TRÁNSITO", LISTO_FINALIZAR: "LISTO",
  LISTO_FINALIZAR_DIF: "LISTO c/DIF", FINALIZADO: "COMPLETADO", FINALIZADO_DIF: "COMP. c/DIF", ANULADO: "ANULADO",
};
const ESTADO_BADGE = {
  PENDIENTE:           "bg-gray-100 text-gray-800 border-gray-300",
  TRANSITO:            "bg-blue-100 text-blue-800 border-blue-300",
  LISTO_FINALIZAR:     "bg-green-100 text-green-800 border-green-300",
  LISTO_FINALIZAR_DIF: "bg-orange-100 text-orange-800 border-orange-400",
  FINALIZADO:          "bg-emerald-100 text-emerald-800 border-emerald-300",
  FINALIZADO_DIF:      "bg-amber-100 text-amber-800 border-amber-300",
  ANULADO:             "bg-red-100 text-red-800 border-red-300",
};
const ESTADO_ROW_BG = {
  PENDIENTE: "bg-white", TRANSITO: "bg-blue-50/30", LISTO_FINALIZAR: "bg-green-50/30",
  LISTO_FINALIZAR_DIF: "bg-orange-50/30", FINALIZADO: "bg-emerald-50/20", FINALIZADO_DIF: "bg-amber-50/20", ANULADO: "bg-red-50/20",
};
const EXPANDED_HEADER_BG = {
  PENDIENTE: "bg-gray-600", TRANSITO: "bg-blue-600", LISTO_FINALIZAR: "bg-green-600",
  LISTO_FINALIZAR_DIF: "bg-orange-500", FINALIZADO: "bg-emerald-600", FINALIZADO_DIF: "bg-amber-600", ANULADO: "bg-red-600",
};

/* ═══════════════════════════════════════════════════════ */
/*  TABS                                                   */
/* ═══════════════════════════════════════════════════════ */
const TABS = [
  { id: "activos",    label: "Pendientes",        filter: (n) => n.status === "ENVIADO" },
  { id: "recibidos",  label: "Completados OK",   filter: (n) => n._estado === "FINALIZADO" },
  { id: "con_dif",    label: "Con Diferencia",    filter: (n) => ["LISTO_FINALIZAR_DIF","FINALIZADO_DIF"].includes(n._estado) },
  { id: "anulados",   label: "Anulados",          filter: (n) => n._estado === "ANULADO" },
  { id: "en_ingresos",label: "En Ingresos",       icon: "✓", filter: (n) => n.total_docs > 0 && !["ANULADO","FINALIZADO","FINALIZADO_DIF"].includes(n._estado) },
  { id: "todos",      label: "Todos",             filter: () => true },
];

/* ═══════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                         */
/* ═══════════════════════════════════════════════════════ */
export default function PedidosPage() {
  const qc = useQueryClient();
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("activos");
  const [filtroTipo, setFiltroTipo] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [cruzarModal, setCruzarModal] = useState(null); // { nota }
  const [finalizarModal, setFinalizarModal] = useState(null); // { nota, observacion }
  const [alertasFiltro, setAlertasFiltro] = useState('TODAS'); // 'TODAS'|'SIN_FACTURA'|'CON_FACTURA'
  const [alertasCollapsed, setAlertasCollapsed] = useState(false);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [nuevaFechaPopup, setNuevaFechaPopup] = useState(null);

  const toggleExpand = (id) => setExpandedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  /* ── Fetch vista integrada ── */
  const { data: vistaData = [], isLoading, refetch } = useQuery({
    queryKey: ["pedidos-vista"],
    queryFn: () => api.get("/pedidos/vista-integrada/all"),
    refetchInterval: 10000,
  });

  const allNotas = useMemo(() => vistaData.map(n => {
    // Parse real observaciones (drop Tipo:/Local: lines stored by backend)
    const _obs = (n.notes || "").split('\n')
      .filter(l => !l.startsWith('Tipo:') && !l.startsWith('Local:'))
      .join(' ').trim() || null;
    // Latest factura date (ISO string) for REP timer badge
    const _latestFacDate = n.facturas?.length
      ? n.facturas.reduce((mx, f) => (!mx || f.date > mx ? f.date : mx), null)
      : null;
    return {
      ...n,
      _estado: calcEstado(n),
      _dias: daysSince(n.date),
      _falta: n.pedido_qty - (n.total_facturado || 0),
      _obs,
      _latestFacDate,
    };
  }), [vistaData]);

  /* ── Providers ── */
  const { data: providersData } = useQuery({
    queryKey: ["providers-list"],
    queryFn: () => api.get("/providers/?limit=500"),
  });
  const providers = providersData?.items ?? [];

  /* ── Filter pipeline ── */
  const filtered = useMemo(() => {
    const tabFilter = TABS.find(t => t.id === activeTab)?.filter || (() => true);
    let items = allNotas.filter(tabFilter);
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
    // Sort: LISTO first, then TRANSITO, then PENDIENTE, ties broken by date desc
    const PRIORITY = { LISTO_FINALIZAR: 1, LISTO_FINALIZAR_DIF: 1, TRANSITO: 2, PENDIENTE: 3, FINALIZADO: 4, FINALIZADO_DIF: 4, ANULADO: 5 };
    items.sort((a, b) => {
      const pa = PRIORITY[a._estado] ?? 3, pb = PRIORITY[b._estado] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return items;
  }, [allNotas, activeTab, filtroTipo, search]);

  const tabCounts = useMemo(() => {
    const c = {};
    TABS.forEach(t => { c[t.id] = allNotas.filter(t.filter).length; });
    return c;
  }, [allNotas]);

  const stats = useMemo(() => ({
    pendientes: allNotas.filter(n => n._estado === "PENDIENTE").length,
    enTransito: allNotas.filter(n => n._estado === "TRANSITO").length,
    listo: allNotas.filter(n => ["LISTO_FINALIZAR","LISTO_FINALIZAR_DIF"].includes(n._estado)).length,
    completados: allNotas.filter(n => ["FINALIZADO","FINALIZADO_DIF"].includes(n._estado)).length,
  }), [allNotas]);

  /* ── Alertas de reposición ── */
  const DIAS_ALERTA_DEFAULT = 7;
  const alertas = useMemo(() =>
    allNotas.filter(n =>
      n.tipo === "REPOSICIÓN" &&
      !["ANULADO","FINALIZADO","FINALIZADO_DIF"].includes(n._estado) &&
      n._falta > 0 &&
      n._dias !== null && n._dias >= DIAS_ALERTA_DEFAULT
    ).sort((a, b) => (b._dias || 0) - (a._dias || 0))
  , [allNotas]);

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: (data) => api.post("/pedidos/", data),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["pedidos-vista"] }); setSelectedId(d.id); setView("detail"); },
  });
  const receiveMut = useMutation({
    mutationFn: (id) => api.patch(`/pedidos/${id}/receive`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pedidos-vista"] }); setFinalizarModal(null); },
  });
  const cancelMut = useMutation({
    mutationFn: (id) => api.patch(`/pedidos/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos-vista"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/pedidos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pedidos-vista"] }); setView("list"); },
  });
  const sendMut = useMutation({
    mutationFn: (id) => api.patch(`/pedidos/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pedidos-vista"] }),
  });

  /* ── Sort helpers ── */
  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="text-gray-300 ml-0.5">↕</span>;
    return <span className="text-blue-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const sortedFiltered = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      let va, vb;
      if (sortCol === 'number')   { va = a.number || '';         vb = b.number || ''; }
      else if (sortCol === 'provider') { va = a.provider_name || ''; vb = b.provider_name || ''; }
      else if (sortCol === 'date')    { va = a.date || '';          vb = b.date || ''; }
      else if (sortCol === 'local')   { va = a.local || '';         vb = b.local || ''; }
      else if (sortCol === 'qty')     { va = a.pedido_qty || 0;     vb = b.pedido_qty || 0; return sortDir === 'asc' ? va - vb : vb - va; }
      else { va = 0; vb = 0; }
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  function openDetail(id) { setSelectedId(id); setView("detail"); }

  /* ── Render views ── */
  if (view === "create") return <PedidoCreate providers={providers} createMut={createMut} onBack={() => setView("list")} />;
  if (view === "detail" && selectedId) return (
    <PedidoDetail id={selectedId} sendMut={sendMut} receiveMut={receiveMut}
      cancelMut={cancelMut} deleteMut={deleteMut} onBack={() => { setView("list"); setSelectedId(null); }} />
  );

  /* ═══════════ LIST VIEW ═══════════ */
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-600" /> Pedidos a Proveedores
          </h1>
          <p className="text-xs text-gray-500">Vista integrada — Notas de pedido con facturas y remitos vinculados</p>
        </div>
        <button onClick={() => setView("create")} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Nueva Nota
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: "pendientes", label: "PENDIENTE", sub: "Sin factura ni remito", bg: "bg-gray-600 hover:bg-gray-700", val: stats.pendientes },
          { key: "enTransito", label: "EN TRÁNSITO", sub: "Con facturas/remitos", bg: "bg-blue-600 hover:bg-blue-700", val: stats.enTransito },
          { key: "listo", label: "LISTO", sub: "Documentos completos", bg: "bg-emerald-600 hover:bg-emerald-700", val: stats.listo },
          { key: "completados", label: "COMPLETADOS", sub: "Ciclo cerrado", bg: "bg-violet-600 hover:bg-violet-700", val: stats.completados },
        ].map(s => (
          <div key={s.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${s.bg} text-white`}>
            <span className="text-2xl font-bold leading-none">{s.val}</span>
            <div><p className="text-[11px] font-bold uppercase leading-none">{s.label}</p><p className="text-white/60 text-[10px] leading-none mt-0.5">{s.sub}</p></div>
          </div>
        ))}
      </div>

      {/* Filters: Tabs + PRE/REP + Search + Refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "bg-violet-600 text-white border-violet-700" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}>
            {tab.label} <span className={`ml-0.5 ${activeTab === tab.id ? "text-violet-200" : "text-gray-400"}`}>({tabCounts[tab.id] ?? 0})</span>
          </button>
        ))}
        <span className="w-px h-5 bg-gray-300 mx-1"></span>
        <button onClick={() => setFiltroTipo(filtroTipo === 'PRECOMPRA' ? null : 'PRECOMPRA')}
          className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${filtroTipo === 'PRECOMPRA' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}>
          PRE
        </button>
        <button onClick={() => setFiltroTipo(filtroTipo === 'REPOSICIÓN' ? null : 'REPOSICIÓN')}
          className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${filtroTipo === 'REPOSICIÓN' ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'}`}>
          REP
        </button>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-8 pr-3 py-1.5 border rounded text-xs" />
        </div>
        <button onClick={() => refetch()} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700" title="Actualizar">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <span className="w-px h-5 bg-gray-300 mx-1"></span>
        <button onClick={() => alert('Comparador de documentos — próximamente')}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
          🔍 Comparar
        </button>
        <button onClick={() => alert('Lista de Precios — próximamente')}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
          💲 Lista de Precios
        </button>
        <button onClick={() => alert('Agrupar notas — próximamente')}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100">
          🔗 Agrupar
        </button>
      </div>

      {/* ── ALERTAS DE REPOSICIÓN (tabla) ── */}
      {alertas.length > 0 && activeTab !== "anulados" && activeTab !== "recibidos" && (() => {
        const sinFac = alertas.filter(n => !n.total_facturado).length;
        const conFac = alertas.filter(n => n.total_facturado > 0).length;
        const alertasFiltradas = alertasFiltro === 'SIN_FACTURA'
          ? alertas.filter(n => !n.total_facturado)
          : alertasFiltro === 'CON_FACTURA'
          ? alertas.filter(n => n.total_facturado > 0)
          : alertas;
        return (
          <div className="border border-red-300 rounded-lg overflow-hidden">
            {/* Header — clickable to collapse */}
            <div
              className="bg-red-600 text-white px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setAlertasCollapsed(v => !v)}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-bold uppercase">
                ALERTAS DE REPOSICIÓN — {alertas.length} pendiente{alertas.length > 1 ? 's' : ''}
              </span>
              <span className="ml-auto text-white/70 text-[10px] flex items-center gap-1">
                {alertasCollapsed
                  ? <><ChevronRight className="h-3.5 w-3.5" /> Mostrar</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Minimizar</>
                }
              </span>
            </div>
            {!alertasCollapsed && (
              <>
                {/* Filter pills */}
                <div className="bg-red-50 border-b border-red-200 px-2 py-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-red-700 font-semibold mr-1">Filtrar:</span>
                  <button onClick={() => setAlertasFiltro('TODAS')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${alertasFiltro === 'TODAS' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-700 border-red-300 hover:bg-red-100'}`}>
                    Todas ({alertas.length})
                  </button>
                  <button onClick={() => setAlertasFiltro('SIN_FACTURA')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${alertasFiltro === 'SIN_FACTURA' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-700 border-red-300 hover:bg-red-100'}`}>
                    Sin Factura ({sinFac})
                  </button>
                  <button onClick={() => setAlertasFiltro('CON_FACTURA')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${alertasFiltro === 'CON_FACTURA' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'}`}>
                    Con Factura pendiente ({conFac})
                  </button>
                </div>
                {/* Table */}
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-red-100/50 text-left">
                      <th className="px-2 py-1 font-semibold text-red-800 w-[70px]">ESTADO</th>
                      <th className="px-2 py-1 font-semibold text-red-800">N° PEDIDO</th>
                      <th className="px-2 py-1 font-semibold text-red-800">PROVEEDOR</th>
                      <th className="px-2 py-1 font-semibold text-red-800">LOCAL</th>
                      <th className="px-2 py-1 font-semibold text-red-800 text-right">PEDIDO</th>
                      <th className="px-2 py-1 font-semibold text-red-800 text-right">FACTUR.</th>
                      <th className="px-2 py-1 font-semibold text-red-800 text-right">FALTAN</th>
                      <th className="px-2 py-1 font-semibold text-red-800 text-right">ÚLT.FAC.</th>
                      <th className="px-2 py-1 font-semibold text-red-800 text-right">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertasFiltradas.slice(0, 10).map(n => {
                      const sinFactura = !n.total_facturado;
                      const urgente = n._dias >= 30;
                      const latestFacDias = n._latestFacDate
                        ? Math.floor((Date.now() - new Date(n._latestFacDate).getTime()) / 86400000)
                        : null;
                      return (
                        <tr key={n.id} className={`border-t border-red-200 hover:bg-red-100/30 ${urgente ? 'bg-red-50' : 'bg-orange-50/30'}`}>
                          <td className="px-2 py-1">
                            <span className={`text-white text-[9px] font-bold px-1.5 py-0.5 rounded ${sinFactura ? 'bg-red-600' : urgente ? 'bg-red-500' : 'bg-orange-500'}`}>
                              {sinFactura ? 'SIN FAC.' : `ESP. ${n._dias}d`}
                            </span>
                          </td>
                          <td className="px-2 py-1 font-mono font-bold text-gray-800">#{n.number}</td>
                          <td className="px-2 py-1 text-gray-700 truncate max-w-[140px]">{n.provider_name}</td>
                          <td className="px-2 py-1 text-gray-600 truncate max-w-[120px]">{n.local || "—"}</td>
                          <td className="px-2 py-1 text-right font-bold">{n.pedido_qty}</td>
                          <td className="px-2 py-1 text-right">
                            <span className={n.total_facturado !== n.pedido_qty ? "text-orange-600 font-bold" : "text-green-600"}>
                              {n.total_facturado > 0 ? `${n.total_facturado}/${n.pedido_qty}` : '0'}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-right font-bold text-red-700">–{Math.abs(n._falta)}</td>
                          <td className={`px-2 py-1 text-right font-bold ${latestFacDias !== null && latestFacDias >= 14 ? 'text-red-600' : latestFacDias !== null && latestFacDias >= 7 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {latestFacDias !== null ? `${latestFacDias}d` : '—'}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openDetail(n.id)}
                                className="px-1.5 py-0.5 bg-slate-600 text-white rounded text-[9px] font-bold hover:bg-slate-700 leading-4">
                                ↓ Ver
                              </button>
                              {n._falta > 0 && n.total_facturado > 0 && (
                                <button onClick={() => setFinalizarModal({ nota: n, observacion: "" })}
                                  className="bg-green-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold hover:bg-green-700 whitespace-nowrap leading-4">
                                  Aceptar dif. –{Math.abs(n._falta)}u
                                </button>
                              )}
                              <button
                                onClick={() => setNuevaFechaPopup({ id: n.id, number: n.number, date: n.date || '' })}
                                className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[9px] font-bold hover:bg-purple-700 leading-4"
                                title="Cambiar fecha del pedido">
                                📅
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {alertasFiltradas.length > 10 && (
                  <p className="text-center text-[10px] text-red-600 py-1 border-t border-red-200">
                    → y {alertasFiltradas.length - 10} más
                  </p>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── MAIN TABLE ── */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Check className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="text-lg font-medium">¡Todo al día!</p>
          <p className="text-sm">No hay pedidos en esta categoría</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Table header */}
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                <th className="w-8 px-1 py-2"></th>
                <th className="px-2 py-2 font-semibold cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort('number')}>
                  N° PEDIDO <SortIcon col="number" />
                </th>
                <th className="px-2 py-2 font-semibold cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort('provider')}>
                  PROVEEDOR <SortIcon col="provider" />
                </th>
                <th className="px-2 py-2 font-semibold cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort('date')}>
                  FECHA <SortIcon col="date" />
                </th>
                <th className="px-2 py-2 font-semibold cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort('local')}>
                  LOCAL <SortIcon col="local" />
                </th>
                <th className="px-2 py-2 font-semibold text-center w-[60px] cursor-pointer hover:text-blue-600 select-none" onClick={() => toggleSort('qty')}>
                  CANT. <SortIcon col="qty" />
                </th>
                <th className="px-2 py-2 font-semibold text-center w-[50px]">TIPO</th>
                <th className="px-2 py-2 font-semibold">OBSERVACIONES</th>
                <th className="px-2 py-2 font-semibold text-center">ESTADO</th>
                <th className="px-2 py-2 font-semibold text-center w-[50px]">DÍAS</th>
                <th className="px-2 py-2 font-semibold text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiltered.map(nota => {
                const estado = nota._estado;
                const isExpanded = expandedIds.has(nota.id);
                const dias = nota._dias;
                const falta = nota._falta;
                return (
                  <TableRow key={nota.id} nota={nota} estado={estado} isExpanded={isExpanded}
                    dias={dias} falta={falta}
                    onToggle={() => toggleExpand(nota.id)}
                    onDetail={() => openDetail(nota.id)}
                    onCruzar={() => setCruzarModal({ nota })}
                    onDelete={() => { if (confirm("¿Eliminar pedido?")) deleteMut.mutate(nota.id); }}
                    onFinalizar={() => setFinalizarModal({ nota, observacion: "" })}
                    receiveMut={receiveMut}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── NUEVA FECHA POPUP ── */}
      {nuevaFechaPopup && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setNuevaFechaPopup(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-5 w-80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-gray-800">📅 Nueva fecha de pedido</h3>
              <button onClick={() => setNuevaFechaPopup(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-3 font-mono bg-gray-50 px-2 py-1 rounded">#{nuevaFechaPopup.number}</p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva fecha</label>
            <input
              type="date"
              value={nuevaFechaPopup.date}
              onChange={e => setNuevaFechaPopup(prev => prev ? { ...prev, date: e.target.value } : null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-purple-300 outline-none"
            />
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo <span className="font-normal text-gray-400">(opcional)</span></label>
            <input
              type="text"
              value={nuevaFechaPopup.motivo || ''}
              onChange={e => setNuevaFechaPopup(prev => prev ? { ...prev, motivo: e.target.value } : null)}
              placeholder="Ej: demora del proveedor..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-purple-300 outline-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNuevaFechaPopup(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button
                onClick={async () => {
                  if (!nuevaFechaPopup.date) return;
                  try {
                    await api.put(`/pedidos/${nuevaFechaPopup.id}`, { date: nuevaFechaPopup.date });
                    refetch();
                    setNuevaFechaPopup(null);
                  } catch (e) { alert('Error al guardar la fecha'); }
                }}
                disabled={!nuevaFechaPopup.date}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CRUZAR DOCUMENTOS MODAL ── */}
      {cruzarModal && (
        <CruzarDocumentosModal nota={cruzarModal.nota} onClose={() => setCruzarModal(null)} />
      )}

      {/* ── FINALIZAR MODAL ── */}
      {finalizarModal && (
        <FinalizarModal nota={finalizarModal.nota} receiveMut={receiveMut}
          onClose={() => setFinalizarModal(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  TABLE ROW (collapsed + expanded)                       */
/* ═══════════════════════════════════════════════════════ */
function TableRow({ nota, estado, isExpanded, dias, falta, onToggle, onDetail, onCruzar, onDelete, onFinalizar, receiveMut }) {
  const rowBg = ESTADO_ROW_BG[estado] || "bg-white";
  const badgeCls = ESTADO_BADGE[estado] || ESTADO_BADGE.PENDIENTE;
  const headerBg = EXPANDED_HEADER_BG[estado] || "bg-gray-600";

  return (
    <>
      {/* ── Collapsed row ── */}
      <tr className={`border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer ${rowBg} ${isExpanded ? 'border-b-0' : ''}`}
        onClick={onToggle}>
        {/* Expand arrow */}
        <td className="px-1 py-1.5 text-center">
          <span className="text-gray-400 text-[10px] font-bold">{isExpanded ? '▼' : '▶'}</span>
        </td>
        {/* N° Pedido */}
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1">
            <span className="font-mono font-bold text-gray-900 text-[11px]">#{nota.number}</span>
            <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(nota.number); }}
              className="p-0.5 text-gray-300 hover:text-gray-600 rounded" title="Copiar">
              <Copy className="h-2.5 w-2.5" />
            </button>
          </div>
        </td>
        {/* Proveedor */}
        <td className="px-2 py-1.5 text-gray-700 truncate max-w-[160px] text-[11px]">{nota.provider_name || "—"}</td>
        {/* Fecha */}
        <td className="px-2 py-1.5 text-gray-500 text-[11px]">{fmtDate(nota.date)}</td>
        {/* Local */}
        <td className="px-2 py-1.5 text-gray-600 truncate max-w-[160px] text-[11px]">{nota.local || "—"}</td>
        {/* Cant */}
        <td className="px-2 py-1.5 text-center font-bold text-[11px]">{nota.pedido_qty}</td>
        {/* Tipo + timer badge */}
        <td className="px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {nota.tipo === 'PRECOMPRA' && <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">PRE</span>}
            {nota.tipo === 'REPOSICIÓN' && <>
              <span className="bg-teal-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">REP</span>
              {nota._latestFacDate && (() => {
                const hrs = (Date.now() - new Date(nota._latestFacDate).getTime()) / 3600000;
                const umbral = 24; // 24h threshold
                const restante = umbral - hrs;
                if (hrs > 0 && restante > 0) return <span className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse">⏱ {Math.floor(restante)}h</span>;
                if (restante <= 0) return <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">⏱ 1d CUMP.</span>;
                return null;
              })()}
            </>}
          </div>
        </td>
        {/* Observaciones */}
        <td className="px-2 py-1.5 text-gray-500 text-[10px] truncate max-w-[120px]" title={nota._obs || ""}>{nota._obs || "—"}</td>
        {/* Estado */}
        <td className="px-2 py-1.5 text-center">
          {falta > 0 && nota.total_facturado > 0 ? (
            <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
              FALTA {falta}
            </span>
          ) : falta < 0 && nota.total_facturado > 0 ? (
            <span className="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
              SOBRA {Math.abs(falta)}
            </span>
          ) : (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${badgeCls}`}>
              {ESTADO_LABELS[estado]}
            </span>
          )}
        </td>
        {/* Días */}
        <td className="px-2 py-1.5 text-center">
          {dias !== null && (
            <span className={`text-[11px] font-bold ${dias > 14 ? 'text-red-600' : dias > 7 ? 'text-orange-500' : 'text-green-600'}`}>
              {dias}d
            </span>
          )}
        </td>
        {/* Acciones */}
        <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-0.5">
            {nota.total_docs > 0 && (
              <button onClick={onCruzar}
                className="bg-slate-700 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-800 transition">
                Cruzar
              </button>
            )}
            <button onClick={onDetail} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver detalle">
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDetail} className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded" title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Expanded content ── */}
      {isExpanded && (
        <tr>
          <td colSpan={11} className="p-0">
            <div className={`${headerBg} text-white px-3 py-1 text-[11px] font-bold`}>
              Pedido completo: {nota.number} &nbsp;&nbsp; Artículos: {nota.pedido_qty} &nbsp;&nbsp;
              Facturado: {nota.total_facturado || 0} &nbsp;&nbsp;
              <span className={nota._falta > 0 ? 'text-red-200' : nota._falta < 0 ? 'text-orange-200' : 'text-green-200'}>
                {nota._falta > 0 ? `Faltan ${nota._falta}` : nota._falta < 0 ? `Sobran ${Math.abs(nota._falta)}` : 'Completo ✓'}
              </span>
            </div>

            {/* 2-column: NP card (left) + docs chain (right) */}
            <div className="px-3 py-2 flex gap-4">
              {/* LEFT: NP card */}
              <div className="w-52 flex-shrink-0">
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-3">
                  <p className="text-xs font-bold text-emerald-700 uppercase mb-2">📋 NOTA DE PEDIDO</p>
                  <div className="space-y-1 text-[11px] text-gray-600 mb-3">
                    <div className="flex justify-between"><span>Pedido:</span><b>{nota.pedido_qty}u</b></div>
                    <div className="flex justify-between"><span>Facturado:</span><b className="text-blue-700">{nota.total_facturado || 0}u</b></div>
                    <div className="flex justify-between"><span>Remitido:</span><b className="text-orange-600">{nota.total_remitido || 0}u</b></div>
                  </div>
                  {nota._obs && (
                    <p className="text-[10px] text-gray-600 italic mb-2 px-2 py-1 bg-white rounded border leading-relaxed">💬 {nota._obs}</p>
                  )}
                  <button onClick={onCruzar} disabled={nota.total_docs === 0}
                    className="w-full bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg px-3 py-2 text-xs font-bold hover:from-slate-700 hover:to-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <GitCompare className="h-3.5 w-3.5" />
                    Cruzar Documentos
                  </button>
                </div>
              </div>

              {/* RIGHT: docs + FINALIZAR */}
              <div className="flex-1 min-w-0">
                {/* Diferencia warning */}
                {nota.diferencia !== 0 && nota.total_facturado > 0 && (
                  <div className="mb-2 flex items-center gap-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 flex-wrap">
                    <p className="text-[11px] font-bold text-orange-800 flex-1">
                      {nota.diferencia > 0 ? `FALTAN ${nota.diferencia}u` : `SOBRAN ${Math.abs(nota.diferencia)}u`}
                      {" — Pedido "}{nota.pedido_qty}{" / Facturado "}{nota.total_facturado}
                    </p>
                    <button onClick={onFinalizar}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 whitespace-nowrap flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aceptar dif. {nota.diferencia > 0 ? `–${nota.diferencia}` : `+${Math.abs(nota.diferencia)}`}u
                    </button>
                  </div>
                )}

                {/* Documents chain */}
                {nota.facturas.length === 0 && nota.remitos.length === 0 ? (
                  <p className="text-gray-400 text-[11px] italic py-2 text-center">Sin facturas ni remitos vinculados aún</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {nota.facturas.map(f => (
                      <div key={f.id} className="flex items-center gap-1.5 py-1 px-1 flex-wrap">
                        <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">FAC</span>
                        <span className="font-mono text-[11px] font-bold text-gray-800 shrink-0">{f.number}</span>
                        <span className="text-gray-500 text-[10px] shrink-0">{f.quantity}u</span>
                        <span className="text-gray-400 text-[10px] shrink-0">{fmtDate(f.date)}</span>
                        <button className="p-0.5 text-blue-500 hover:bg-blue-100 rounded shrink-0" title="Ver"><Eye className="h-3 w-3" /></button>
                        {f.status === "CONFIRMADO" ? (
                          <span className="bg-green-600 text-white w-3.5 h-3.5 rounded-full text-[7px] flex items-center justify-center shrink-0" title="Confirmado">✓</span>
                        ) : f.status === "ANULADO" ? (
                          <span className="bg-red-500 text-white px-1 py-0.5 rounded text-[7px] font-bold shrink-0">ANUL</span>
                        ) : (
                          <span className="bg-yellow-400 text-yellow-900 px-1 py-0.5 rounded text-[7px] font-bold shrink-0">BORR</span>
                        )}
                      </div>
                    ))}
                    {nota.remitos.map(r => (
                      <div key={r.id} className="flex items-center gap-1.5 py-1 px-1 bg-orange-50/40 flex-wrap">
                        <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">REM</span>
                        <span className="font-mono text-[11px] font-bold text-gray-700 shrink-0">{r.number}</span>
                        <span className="text-gray-500 text-[10px] shrink-0">{r.quantity}u</span>
                        <span className="text-gray-400 text-[10px] shrink-0">{fmtDate(r.date)}</span>
                        <button className="p-0.5 text-orange-500 hover:bg-orange-100 rounded shrink-0" title="Ver"><Eye className="h-3 w-3" /></button>
                        {r.status === "CONFIRMADO" ? (
                          <span className="bg-green-600 text-white w-3.5 h-3.5 rounded-full text-[7px] flex items-center justify-center shrink-0" title="Confirmado">✓</span>
                        ) : r.status === "ANULADO" ? (
                          <span className="bg-red-500 text-white px-1 py-0.5 rounded text-[7px] font-bold shrink-0">ANUL</span>
                        ) : (
                          <span className="bg-yellow-400 text-yellow-900 px-1 py-0.5 rounded text-[7px] font-bold shrink-0">BORR</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* FINALIZAR button */}
                {(estado === "LISTO_FINALIZAR" || estado === "LISTO_FINALIZAR_DIF") && (
                  <div className="mt-3 pt-3 border-t-2 border-green-300">
                    {estado === "LISTO_FINALIZAR" ? (
                      <button onClick={() => receiveMut.mutate(nota.id)}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl px-6 py-3 font-bold text-sm hover:from-green-600 hover:to-green-700 transition flex items-center justify-center gap-2 shadow-lg">
                        <Check className="h-5 w-5" /> ✓ FINALIZAR PEDIDO
                      </button>
                    ) : (
                      <button onClick={onFinalizar}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl px-6 py-3 font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition flex items-center justify-center gap-2 shadow-lg">
                        <AlertTriangle className="h-5 w-5" /> FINALIZAR CON DIFERENCIAS
                      </button>
                    )}
                  </div>
                )}

                {/* Info messages */}
                {estado === "PENDIENTE" && (
                  <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-500 text-center">
                    ⏳ Sin facturas ni remitos — esperando documentación
                  </div>
                )}
                {estado === "TRANSITO" && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-700 text-center">
                    🚚 En tránsito — {nota.facturas.length} factura(s), {nota.remitos.length} remito(s)
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  CRUZAR DOCUMENTOS MODAL                                */
/* ═══════════════════════════════════════════════════════ */
function CruzarDocumentosModal({ nota, onClose }) {
  const [activeTab, setActiveTab] = useState("compras");
  const facturas = nota.facturas || [];
  const remitos = nota.remitos || [];

  // Calculate cross-reference data
  const totalFacturado = facturas.reduce((s, f) => s + (f.quantity || 0), 0);
  const totalRemitido = remitos.reduce((s, r) => s + (r.quantity || 0), 0);
  const difNPvsFac = nota.pedido_qty - totalFacturado;
  const difFacvsRem = totalFacturado - totalRemitido;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-600 to-slate-800 px-5 py-3 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> Cruzar Documentos
            </h3>
            <p className="text-slate-300 text-xs mt-0.5">Pedido #{nota.number} — {nota.provider_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-5 gap-0 border-b">
          <div className="px-3 py-2 text-center border-r">
            <p className="text-[10px] text-gray-500 uppercase">Pedido</p>
            <p className="text-lg font-bold text-gray-800">{nota.pedido_qty}</p>
          </div>
          <div className="px-3 py-2 text-center border-r">
            <p className="text-[10px] text-gray-500 uppercase">Facturado</p>
            <p className="text-lg font-bold text-blue-700">{totalFacturado}</p>
          </div>
          <div className="px-3 py-2 text-center border-r">
            <p className="text-[10px] text-gray-500 uppercase">Remitido</p>
            <p className="text-lg font-bold text-orange-600">{totalRemitido}</p>
          </div>
          <div className="px-3 py-2 text-center border-r">
            <p className="text-[10px] text-gray-500 uppercase">Dif NP↔Fac</p>
            <p className={`text-lg font-bold ${difNPvsFac === 0 ? 'text-green-600' : difNPvsFac > 0 ? 'text-red-600' : 'text-orange-600'}`}>
              {difNPvsFac === 0 ? '✓ 0' : difNPvsFac > 0 ? `-${difNPvsFac}` : `+${Math.abs(difNPvsFac)}`}
            </p>
          </div>
          <div className="px-3 py-2 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Dif Fac↔Rem</p>
            <p className={`text-lg font-bold ${difFacvsRem === 0 ? 'text-green-600' : difFacvsRem > 0 ? 'text-red-600' : 'text-orange-600'}`}>
              {difFacvsRem === 0 ? '✓ 0' : difFacvsRem > 0 ? `-${difFacvsRem}` : `+${Math.abs(difFacvsRem)}`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: "compras", label: "COMPRAS", desc: "NP vs Facturado" },
            { id: "pagos", label: "PAGOS", desc: "Factura vs Remito" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-3 py-2 text-xs font-bold uppercase border-b-2 transition ${
                activeTab === t.id ? 'border-slate-600 text-slate-700 bg-slate-50' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label} <span className="text-[9px] font-normal ml-1 text-gray-400">({t.desc})</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === "compras" && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Nota de Pedido vs Facturado</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-emerald-600 uppercase font-bold">Pedido (NP)</p>
                  <p className="text-2xl font-bold text-emerald-700">{nota.pedido_qty}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-blue-600 uppercase font-bold">Facturado</p>
                  <p className="text-2xl font-bold text-blue-700">{totalFacturado}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${difNPvsFac === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-[10px] uppercase font-bold text-gray-600">Diferencia</p>
                  <p className={`text-2xl font-bold ${difNPvsFac === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {difNPvsFac === 0 ? '✓ OK' : difNPvsFac}
                  </p>
                </div>
              </div>

              <h4 className="text-sm font-bold text-gray-700 mt-4 mb-2">Detalle de Facturas</h4>
              <table className="w-full text-xs border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Número</th>
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 font-semibold text-right">Cantidad</th>
                    <th className="px-3 py-2 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map(f => (
                    <tr key={f.id} className="border-t hover:bg-blue-50/30">
                      <td className="px-3 py-2"><span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">FAC</span></td>
                      <td className="px-3 py-2 font-mono font-bold">{f.number}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(f.date)}</td>
                      <td className="px-3 py-2 text-right font-bold">{f.quantity}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${f.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : f.status === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.status}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right">Total facturado:</td>
                    <td className="px-3 py-2 text-right text-blue-700">{totalFacturado}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <h4 className="text-sm font-bold text-gray-700 mt-4 mb-2">Detalle de Remitos</h4>
              {remitos.length === 0 ? (
                <p className="text-gray-400 text-xs italic text-center py-3">Sin remitos vinculados</p>
              ) : (
                <table className="w-full text-xs border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="px-3 py-2 font-semibold">Tipo</th>
                      <th className="px-3 py-2 font-semibold">Número</th>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold text-right">Cantidad</th>
                      <th className="px-3 py-2 font-semibold text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remitos.map(r => (
                      <tr key={r.id} className="border-t hover:bg-orange-50/30">
                        <td className="px-3 py-2"><span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">REM</span></td>
                        <td className="px-3 py-2 font-mono font-bold">{r.number}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(r.date)}</td>
                        <td className="px-3 py-2 text-right font-bold">{r.quantity}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${r.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : r.status === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right">Total remitido:</td>
                      <td className="px-3 py-2 text-right text-orange-600">{totalRemitido}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "pagos" && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Factura vs Remito — Cruce por documento</h4>
              {facturas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No hay facturas para cruzar</p>
              ) : (
                <table className="w-full text-xs border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="px-3 py-2 font-semibold">FAC Número</th>
                      <th className="px-3 py-2 font-semibold text-right">FAC Cant.</th>
                      <th className="px-3 py-2 font-semibold text-center">→</th>
                      <th className="px-3 py-2 font-semibold">REM Número</th>
                      <th className="px-3 py-2 font-semibold text-right">REM Cant.</th>
                      <th className="px-3 py-2 font-semibold text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f, idx) => {
                      const r = remitos[idx]; // Simple 1:1 matching by position
                      const facQty = f.quantity || 0;
                      const remQty = r ? (r.quantity || 0) : 0;
                      const diff = facQty - remQty;
                      return (
                        <tr key={f.id} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <span className="bg-blue-600 text-white px-1 py-0.5 rounded text-[9px] font-bold mr-1">FAC</span>
                            <span className="font-mono font-bold">{f.number}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold">{facQty}</td>
                          <td className="px-3 py-2 text-center text-gray-300">→</td>
                          <td className="px-3 py-2">
                            {r ? (
                              <>
                                <span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[9px] font-bold mr-1">REM</span>
                                <span className="font-mono font-bold">{r.number}</span>
                              </>
                            ) : <span className="text-gray-400 italic">Sin remito</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">{r ? remQty : "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {r ? (
                              <span className={`font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diff === 0 ? '✓' : diff}
                              </span>
                            ) : <span className="text-red-500 font-bold">–{facQty}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Remitos without matching factura */}
                    {remitos.slice(facturas.length).map(r => (
                      <tr key={r.id} className="border-t bg-orange-50/30">
                        <td className="px-3 py-2 text-gray-400 italic">Sin factura</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-center text-gray-300">←</td>
                        <td className="px-3 py-2">
                          <span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[9px] font-bold mr-1">REM</span>
                          <span className="font-mono font-bold">{r.number}</span>
                        </td>
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

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  FINALIZAR MODAL                                        */
/* ═══════════════════════════════════════════════════════ */
function FinalizarModal({ nota, receiveMut, onClose }) {
  const [observacion, setObservacion] = useState("");
  const conDif = nota.diferencia !== 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className={`px-6 py-4 text-white ${conDif ? 'bg-gradient-to-r from-amber-600 to-orange-600' : 'bg-gradient-to-r from-green-600 to-green-700'}`}>
          <h3 className="text-lg font-bold flex items-center gap-2">
            {conDif ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            {conDif ? 'FINALIZAR CON DIFERENCIA' : 'FINALIZAR PEDIDO'}
          </h3>
          <p className="text-sm opacity-80 mt-0.5">Pedido #{nota.number} — {nota.provider_name}</p>
        </div>
        <div className="p-6 space-y-4">
          {conDif && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-700 font-medium">
                ⚠️ Diferencia: {nota.diferencia > 0
                  ? `Faltan ${nota.diferencia} unidades`
                  : `Sobran ${Math.abs(nota.diferencia)} unidades`}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Pedido: {nota.pedido_qty} | Facturado: {nota.total_facturado}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observación {conDif ? '(obligatoria) *' : '(opcional)'}
            </label>
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)}
              placeholder={conDif ? "Explique el motivo de aceptar la diferencia..." : "Notas adicionales..."}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> Esta acción moverá el pedido a COMPLETADOS{conDif ? ' con la etiqueta "CON DIFERENCIA"' : ''}.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (conDif && !observacion.trim()) { alert("Debe ingresar una observación"); return; }
              receiveMut.mutate(nota.id);
            }}
            disabled={receiveMut.isPending}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 ${
              conDif ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
            }`}>
            {receiveMut.isPending ? 'Procesando...' : 'Confirmar Finalización'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  CREATE VIEW                                            */
/* ═══════════════════════════════════════════════════════ */
function PedidoCreate({ providers, createMut, onBack }) {
  const [form, setForm] = useState({
    number: "", date: new Date().toISOString().slice(0, 10),
    expected_date: "", notes: "", provider_id: "", tipo: "PRECOMPRA",
  });

  function handleCreate(e) {
    e.preventDefault();
    const notesLines = [];
    if (form.tipo) notesLines.push(`Tipo: ${form.tipo}`);
    if (form.notes) notesLines.push(form.notes);
    createMut.mutate({
      number: form.number, date: form.date, provider_id: parseInt(form.provider_id),
      expected_date: form.expected_date || null, notes: notesLines.join('\n') || null,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition">
        <ArrowLeft className="w-4 h-4" /> Volver a pedidos
      </button>
      <h1 className="text-2xl font-bold text-gray-900">Nueva Nota de Pedido</h1>
      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Pedido *</label>
            <input type="text" required value={form.number} onChange={e => setForm({...form, number: e.target.value})}
              placeholder="NP-0001"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
            <select required value={form.provider_id} onChange={e => setForm({...form, provider_id: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none bg-white">
              <option value="">Seleccionar proveedor...</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entrega esperada</label>
            <input type="date" value={form.expected_date} onChange={e => setForm({...form, expected_date: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setForm({...form, tipo: 'PRECOMPRA'})}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold border transition ${form.tipo === 'PRECOMPRA' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}>
                PRECOMPRA
              </button>
              <button type="button" onClick={() => setForm({...form, tipo: 'REPOSICIÓN'})}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-bold border transition ${form.tipo === 'REPOSICIÓN' ? 'bg-teal-600 text-white border-teal-700' : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'}`}>
                REPOSICIÓN
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Notas internas del pedido..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:outline-none resize-none" />
        </div>
        {createMut.error && <p className="text-sm text-red-600">{createMut.error.message}</p>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onBack} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition">Cancelar</button>
          <button type="submit" disabled={createMut.isPending}
            className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition">
            {createMut.isPending ? "Creando..." : "Crear Pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  DETAIL VIEW                                            */
/* ═══════════════════════════════════════════════════════ */
function PedidoDetail({ id, sendMut, receiveMut, cancelMut, deleteMut, onBack }) {
  const qc = useQueryClient();
  const { data: detail, isLoading } = useQuery({ queryKey: ["pedido", id], queryFn: () => api.get(`/pedidos/${id}`) });
  const { data: ingresosData } = useQuery({
    queryKey: ["ingresos-for-pedido", id],
    queryFn: () => api.get(`/ingresos/?limit=500`),
    select: (d) => (d?.items ?? []).filter(i => i.pedido_id === id),
  });
  const linkedIngresos = ingresosData ?? [];
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-items"], queryFn: () => api.get("/products/?limit=500"),
    select: (d) => d?.items ?? [], enabled: detail?.status === "BORRADOR",
  });
  const addItemMut = useMutation({ mutationFn: (data) => api.post(`/pedidos/${id}/items`, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["pedido", id] }) });
  const removeItemMut = useMutation({ mutationFn: (itemId) => api.delete(`/pedidos/${id}/items/${itemId}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["pedido", id] }) });
  const [itemModal, setItemModal] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div></div>;
  if (!detail) return <div className="text-center py-12 text-gray-500">Pedido no encontrado</div>;

  const isDraft = detail.status === "BORRADOR";
  const isActive = !["ANULADO", "RECIBIDO"].includes(detail.status);
  const totalPedido = detail.items?.length > 0 ? detail.items.reduce((s, it) => s + it.quantity, 0) : (Number(detail.total) || 0);
  const totalRecibido = detail.items?.length > 0 ? detail.items.reduce((s, it) => s + (it.received_qty || 0), 0) : 0;
  const totalFalta = totalPedido - totalRecibido;
  const pct = totalPedido > 0 ? Math.round(totalRecibido / totalPedido * 100) : 0;
  const local = parseNoteField(detail.notes, 'Local');
  const tipo = parseNoteField(detail.notes, 'Tipo');
  const facturas = linkedIngresos.filter(i => i.type === 'FACTURA');
  const remitos = linkedIngresos.filter(i => i.type === 'REMITO');

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
        <ArrowLeft className="w-4 h-4" /> Volver a pedidos
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Pedido #{detail.number}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
              detail.status === 'BORRADOR' ? 'bg-gray-600' : detail.status === 'ENVIADO' ? 'bg-blue-600' :
              detail.status === 'RECIBIDO_PARCIAL' ? 'bg-amber-500' : detail.status === 'RECIBIDO' ? 'bg-green-600' : 'bg-red-600'
            }`}>{detail.status === 'ENVIADO' ? 'PENDIENTE' : detail.status}</span>
            {tipo === 'PRECOMPRA' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">PRE</span>}
            {tipo === 'REPOSICIÓN' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700 border border-teal-200">REP</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
            <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {detail.provider_name}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(detail.date)}</span>
            {detail.expected_date && <span className="flex items-center gap-1 text-blue-600"><Clock className="w-3.5 h-3.5" /> Entrega: {fmtDate(detail.expected_date)}</span>}
            {local && <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> {local}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <button onClick={() => sendMut.mutate(id)} disabled={sendMut.isPending || !detail.items?.length}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition font-medium">
                <Send className="w-4 h-4" /> Enviar
              </button>
              <button onClick={() => { if (confirm("¿Eliminar?")) deleteMut.mutate(id); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100 transition font-medium">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </>
          )}
          {(detail.status === "ENVIADO" || detail.status === "RECIBIDO_PARCIAL") && (
            <button onClick={() => receiveMut.mutate(id)} disabled={receiveMut.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition font-medium">
              <PackageCheck className="w-4 h-4" /> Recibir Todo
            </button>
          )}
          {isActive && !isDraft && (
            <button onClick={() => { if (confirm("¿Anular?")) cancelMut.mutate(id); }}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 transition font-medium">
              <Ban className="w-4 h-4" /> Anular
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {isActive && totalPedido > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Progreso de recepción</span>
            <span className="font-semibold">{totalRecibido} / {totalPedido} ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct > 0 ? "bg-blue-500" : "bg-gray-300"}`}
              style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {totalFalta > 0 && <p className="text-sm text-amber-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Faltan {totalFalta} unidades</p>}
        </div>
      )}

      {/* Linked Documents */}
      {linkedIngresos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <h3 className="font-semibold text-sm text-gray-700">📄 Documentos Vinculados ({linkedIngresos.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {facturas.map(f => (
              <div key={f.id} className="flex items-center gap-2 px-4 py-2">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">FAC</span>
                <span className="font-mono text-sm font-bold text-gray-800">{f.number}</span>
                <span className="text-gray-500 text-xs">{fmtDate(f.date)}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${f.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : f.status === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.status}</span>
              </div>
            ))}
            {remitos.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-4 py-2 bg-orange-50/30">
                <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">REM</span>
                <span className="font-mono text-sm font-bold text-gray-700">{r.number}</span>
                <span className="text-gray-500 text-xs">{fmtDate(r.date)}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === 'CONFIRMADO' ? 'bg-green-100 text-green-700' : r.status === 'ANULADO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {detail.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Observaciones:</strong> {detail.notes}
        </div>
      )}

      {/* Items table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
          <h3 className="font-semibold text-sm text-gray-700">Items del pedido ({detail.items?.length || 0})</h3>
          {isDraft && (
            <button onClick={() => setItemModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700 transition font-medium">
              <Plus className="w-3 h-3" /> Agregar Item
            </button>
          )}
        </div>
        {(!detail.items || detail.items.length === 0) ? (
          <div className="text-center py-10">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Sin items — agregá productos al pedido</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Producto</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 hidden sm:table-cell">SKU</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-500">Pedido</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-500">Recibido</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-500">Falta</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 hidden md:table-cell">Costo</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">Subtotal</th>
                {isDraft && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {detail.items.map(it => {
                const faltaItem = it.quantity - (it.received_qty || 0);
                return (
                  <tr key={it.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{it.product_name || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{it.variant_sku || "—"}</td>
                    <td className="px-4 py-3 text-center font-bold">{it.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={it.received_qty >= it.quantity ? "text-green-600 font-bold" : it.received_qty > 0 ? "text-amber-600 font-bold" : "text-gray-400"}>
                        {it.received_qty || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {faltaItem > 0 ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{faltaItem}</span> : <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">{fmtMoney(it.unit_cost)}</td>
                    <td className="px-4 py-3 text-right font-medium">{it.unit_cost ? fmtMoney(it.unit_cost * it.quantity) : "—"}</td>
                    {isDraft && (
                      <td className="px-2 py-3">
                        <button onClick={() => { if (confirm("¿Quitar?")) removeItemMut.mutate(it.id); }}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {itemModal && <AddItemModal products={products} onClose={() => setItemModal(false)}
        onSave={(data) => { addItemMut.mutate(data, { onSuccess: () => setItemModal(false) }); }}
        loading={addItemMut.isPending} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  ADD ITEM MODAL                                         */
/* ═══════════════════════════════════════════════════════ */
function AddItemModal({ products, onClose, onSave, loading }) {
  const [productSearch, setProductSearch] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState("");

  const { data: searchResults = [] } = useQuery({
    queryKey: ["products-search", productSearch],
    queryFn: () => api.get(`/products/?search=${encodeURIComponent(productSearch)}&limit=50`),
    select: (d) => d?.items ?? [], enabled: productSearch.length >= 2,
  });
  const displayProducts = productSearch.length >= 2 ? searchResults : (products || []).slice(0, 50);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Agregar Item al Pedido</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!selectedVariant) return; onSave({ variant_id: selectedVariant.id, quantity: Number(quantity), unit_cost: unitCost ? Number(unitCost) : null }); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Producto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={productSearch} onChange={e => { setProductSearch(e.target.value); setSelectedVariant(null); }}
                placeholder="Nombre, código o marca..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {displayProducts.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">{productSearch.length >= 2 ? "Sin resultados" : "Escriba para buscar"}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayProducts.flatMap(p => (p.variants || []).map(v => ({ ...v, _productName: p.name, _baseCost: p.base_cost }))).map(v => (
                  <button key={v.id} type="button" onClick={() => { setSelectedVariant(v); if (!unitCost && v._baseCost) setUnitCost(String(v._baseCost)); }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-violet-50 transition text-sm flex items-center justify-between ${selectedVariant?.id === v.id ? "bg-violet-50 ring-1 ring-violet-300" : ""}`}>
                    <div><span className="font-medium">{v._productName}</span><span className="text-gray-500 ml-2">{v.size} / {v.color}</span></div>
                    <span className="font-mono text-xs text-gray-400">{v.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedVariant && <div className="bg-violet-50 rounded-lg p-3 border border-violet-200"><p className="text-sm font-medium text-violet-700">Seleccionado: {selectedVariant._productName} — {selectedVariant.size}/{selectedVariant.color}</p></div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
              <input type="number" min={1} required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo Unitario</label>
              <input type="number" step="0.01" min={0} value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="Opcional" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
            <button type="submit" disabled={!selectedVariant || loading}
              className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition">
              {loading ? "Agregando..." : "Agregar Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
