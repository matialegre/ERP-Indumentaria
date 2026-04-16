import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOffline";
import { getAll, enqueueOp, putItem } from "../lib/offlineDB";
import BarcodeScanner from "../components/BarcodeScanner";
import PdfViewer from "../components/PdfViewer";
import {
  PackageCheck, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, MessageSquare, Search, Camera, FileText,
  ChevronDown, ChevronRight, ShieldAlert, Check, WifiOff,
  Server,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════ */
/*  HELPERS                                                */
/* ═══════════════════════════════════════════════════════ */

const fmtDate = (d) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";

const esParcial = (ing) =>
  Boolean(ing.notes?.includes("[RECEPCION PARCIAL]"));

const todayISO = () => new Date().toISOString().split("T")[0];

const ADMIN_ROLES = ["SUPERADMIN", "ADMIN", "DEPOSITO"];

const daysSince = (d) =>
  d ? Math.max(0, Math.floor((Date.now() - new Date(d + "T12:00:00").getTime()) / 86400000)) : null;

function DiasBadge({ fecha }) {
  const d = daysSince(fecha);
  if (d === null) return <span className="text-gray-300">—</span>;
  const cls =
    d > 10 ? "bg-red-100 text-red-700 font-bold" :
    d > 5  ? "bg-orange-100 text-orange-700 font-semibold" :
             "bg-gray-100 text-gray-600";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] ${cls}`}>{d}d</span>;
}

function TipoBadge({ tipo }) {
  const cfg = {
    REMITO:         { cls: "bg-orange-100 text-orange-700",  label: "REM" },
    FACTURA:        { cls: "bg-blue-100 text-blue-700",      label: "FAC" },
    REMITO_FACTURA: { cls: "bg-purple-100 text-purple-700",  label: "REM/FAC" },
  }[tipo] ?? { cls: "bg-gray-100 text-gray-600", label: tipo ?? "—" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const TABS = [
  { id: "pendientes", label: "Pendientes" },
  { id: "confirmados", label: "Confirmados" },
  { id: "parciales",  label: "Parciales"  },
];

const SEMAFORO_CONFIG = {
  VERDE:    { color: "bg-green-500",  ring: "ring-green-300",  label: "Completo"         },
  AMARILLO: { color: "bg-yellow-400", ring: "ring-yellow-300", label: "Parcial/Pendiente" },
  ROJO:     { color: "bg-red-500",    ring: "ring-red-300",    label: "Sin RV/Pendiente"  },
};

function SemaforoLuz({ estado }) {
  const cfg = SEMAFORO_CONFIG[estado] || SEMAFORO_CONFIG.ROJO;
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${cfg.color} ring-2 ${cfg.ring}`}
      title={cfg.label}
    />
  );
}

const PI_TABS = [
  { id: "pendientes",  label: "Pendientes"  },
  { id: "confirmados", label: "Confirmados" },
];

/* ═══════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                         */
/* ═══════════════════════════════════════════════════════ */

export default function RecepcionPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const online = useOnlineStatus();

  /* ── Ingresos state ──────────────────────────────── */
  const [search, setSearch]           = useState("");
  const [activeTab, setActiveTab]     = useState("pendientes");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [obsModal, setObsModal]       = useState(null); // { ingresoId, items[] }
  const [obsText, setObsText]         = useState("");
  const [parcialItems, setParcialItems] = useState({}); // { idx: receivedQty }
  const [forzarModal, setForzarModal] = useState(null); // { ingresoId }
  const [forzarObs, setForzarObs]     = useState("");
  const [forzarDate, setForzarDate]   = useState(todayISO());
  const [pdfViewer, setPdfViewer]     = useState(null); // { url, filename }

  /* ── Purchase invoices state ─────────────────────── */
  const [piTab, setPiTab]                 = useState("pendientes");
  const [expandedPiIds, setExpandedPiIds] = useState(new Set());
  const [piConfirmModal, setPiConfirmModal] = useState(null); // { invoiceId, invoice }
  const [piConfirmDate, setPiConfirmDate]   = useState(todayISO());
  const [filterSinRV, setFilterSinRV]     = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [rvEditingId, setRvEditingId]     = useState(null);   // invoice.id cuyo RV se está editando
  const [rvEditingValue, setRvEditingValue] = useState("");
  const [piForzarModal, setPiForzarModal] = useState(null);   // { invoiceId, invoice }
  const [piForzarObs, setPiForzarObs]     = useState("");

  /* ── SQL Tomy state ─────────────────────────────── */
  const [sqlToMyTime,   setSqlToMyTime]   = useState(null);
  const [sqlToMyResult, setSqlToMyResult] = useState(null);

  /* ── Ingresos queries ────────────────────────────── */
  const { data: borradoresData, isLoading: loadingB, refetch } = useQuery({
    queryKey: ["ingresos-recepcion-pendientes", online],
    queryFn: async () => {
      if (!online) {
        const cached = await getAll("pendingIngresos");
        const borradores = cached.filter(i => (i.status || "BORRADOR") === "BORRADOR");
        return { items: borradores, total: borradores.length };
      }
      return api.get("/ingresos/?status=BORRADOR&limit=500");
    },
    refetchInterval: online ? 20_000 : false,
  });
  const { data: confirmadosData, isLoading: loadingC } = useQuery({
    queryKey: ["ingresos-recepcion-confirmados", online],
    queryFn: async () => {
      if (!online) {
        const cached = await getAll("pendingIngresos");
        const confirmados = cached.filter(i => i.status === "CONFIRMADO");
        return { items: confirmados, total: confirmados.length };
      }
      return api.get("/ingresos/?status=CONFIRMADO&limit=500");
    },
    refetchInterval: online ? 30_000 : false,
  });

  /* ── Purchase invoice queries ────────────────────── */
  const { data: piPendData, isLoading: loadingPiP } = useQuery({
    queryKey: ["purchase-invoices-pendientes"],
    queryFn:  () => api.get("/purchase-invoices/?ingreso_status=PENDIENTE&limit=500"),
    refetchInterval: 30_000,
    enabled: online,
  });
  const { data: piCompData, isLoading: loadingPiC } = useQuery({
    queryKey: ["purchase-invoices-completos"],
    queryFn:  () => api.get("/purchase-invoices/?ingreso_status=COMPLETO&limit=500"),
    refetchInterval: 30_000,
    enabled: online,
  });

  const isLoading = loadingB || loadingC;

  /* ── Mutations ───────────────────────────────────── */
  const confirmarMut = useMutation({
    mutationFn: async ({ ingresoId, notes, items }) => {
      if (online) {
        return api.post(`/ingresos/${ingresoId}/confirmar-recepcion`, {
          notes: notes || null,
          ...(items?.length ? { items } : {}),
        });
      }
      await enqueueOp("RECEPCION", "POST", `/ingresos/${ingresoId}/confirmar-recepcion`, {
        notes: notes || null,
        ...(items?.length ? { items } : {}),
      });
      const all = await getAll("pendingIngresos");
      const ing = all.find(i => i.id === ingresoId);
      if (ing) {
        ing.status = "CONFIRMADO";
        ing.notes = notes ? (items?.length ? `[RECEPCION PARCIAL] ${notes}` : notes) : ing.notes;
        ing._offline_confirmed = true;
        await putItem("pendingIngresos", ing);
      }
      return { ok: true, offline: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingresos-recepcion-pendientes"] });
      qc.invalidateQueries({ queryKey: ["ingresos-recepcion-confirmados"] });
      setObsModal(null);
      setObsText("");
      setParcialItems({});
    },
  });

  const forzarMut = useMutation({
    mutationFn: async ({ ingresoId, notes }) => {
      if (online) {
        return api.patch(`/ingresos/${ingresoId}`, {
          status: "CONFIRMADO",
          notes: "[FORZADO] " + (notes || ""),
        });
      }
      await enqueueOp("RECEPCION", "PATCH", `/ingresos/${ingresoId}`, {
        status: "CONFIRMADO",
        notes: "[FORZADO] " + (notes || ""),
      });
      const all = await getAll("pendingIngresos");
      const ing = all.find(i => i.id === ingresoId);
      if (ing) {
        ing.status = "CONFIRMADO";
        ing.notes = "[FORZADO] " + (notes || "");
        ing._offline_confirmed = true;
        await putItem("pendingIngresos", ing);
      }
      return { ok: true, offline: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingresos-recepcion-pendientes"] });
      qc.invalidateQueries({ queryKey: ["ingresos-recepcion-confirmados"] });
      setForzarModal(null);
      setForzarObs("");
    },
  });

  const confirmarPiMut = useMutation({
    mutationFn: async ({ invoiceId, ingreso_date }) => {
      if (online) {
        return api.post(`/purchase-invoices/${invoiceId}/confirm-ingreso`, {
          ingreso_date,
          items: [],
        });
      }
      await enqueueOp("RECEPCION", "POST", `/purchase-invoices/${invoiceId}/confirm-ingreso`, {
        ingreso_date,
        items: [],
      });
      return { ok: true, offline: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices-pendientes"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices-completos"] });
      setPiConfirmModal(null);
    },
  });

  const confirmLocalMutation = useMutation({
    mutationFn: async (id) => {
      if (online) return api.post(`/purchase-invoices/${id}/confirm-local`);
      await enqueueOp("RECEPCION", "POST", `/purchase-invoices/${id}/confirm-local`, {});
      return { ok: true, offline: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices-pendientes"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices-completos"] });
    },
    onError: (err) => alert(err.message || "Error al confirmar recepción local"),
  });

  const confirmAdminMutation = useMutation({
    mutationFn: async (id) => {
      if (online) return api.post(`/purchase-invoices/${id}/confirm-admin`);
      await enqueueOp("RECEPCION", "POST", `/purchase-invoices/${id}/confirm-admin`, {});
      return { ok: true, offline: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices-pendientes"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices-completos"] });
    },
    onError: (err) => alert(err.message || "Error al verificar como admin"),
  });

  // Reasigna el RV (remito_venta_number) de una factura manualmente (portado de CONTROL REMITOS)
  const reasignarRvMutation = useMutation({
    mutationFn: ({ factura_id, nuevo_rv }) =>
      api.post("/sql-server/reasignar-rv", { factura_id, nuevo_rv }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices-pendientes"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices-completos"] });
      setRvEditingId(null);
      setRvEditingValue("");
    },
    onError: (err) => alert(err.message || "Error al reasignar RV"),
  });

  // Fuerza el ingreso de una factura (admin) con comentario auditado
  const piForzarMutation = useMutation({
    mutationFn: ({ invoiceId, observaciones }) =>
      api.patch(`/purchase-invoices/${invoiceId}/forzar-ingreso?observaciones=${encodeURIComponent(observaciones || "")}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices-pendientes"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices-completos"] });
      setPiForzarModal(null);
      setPiForzarObs("");
    },
    onError: (err) => alert(err.message || "Error al forzar ingreso"),
  });

  // Consulta SQL Server Tomy y actualiza RVs automáticamente
  const reAsociarRvMut = useMutation({
    mutationFn: () => api.post("/sql-server/re-asociar-rv/ejecutar"),
    onSuccess: (data) => {
      setSqlToMyTime(new Date());
      setSqlToMyResult(data);
      qc.invalidateQueries({ queryKey: ["purchase-invoices-pendientes"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices-completos"] });
    },
    onError: (err) => alert(err.message || "Error al consultar SQL Tomy"),
  });

  /* ── Derived lists ───────────────────────────────── */
  const applySearch = (items) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.number?.toLowerCase().includes(q) ||
        i.provider_name?.toLowerCase().includes(q)
    );
  };

  const pendientes  = useMemo(() => applySearch(borradoresData?.items  ?? []), [borradoresData,  search]);
  const todosConf   = useMemo(() =>                confirmadosData?.items ?? [],                  [confirmadosData]);
  const confirmados = useMemo(() => applySearch(todosConf),                                       [todosConf, search]);
  const parciales   = useMemo(() => applySearch(todosConf.filter(esParcial)),                    [todosConf, search]);

  const tabCounts = {
    pendientes:  borradoresData?.total  ?? 0,
    confirmados: confirmadosData?.total ?? 0,
    parciales:   todosConf.filter(esParcial).length,
  };

  const piCounts = useMemo(() => {
    const pendItems = Array.isArray(piPendData) ? piPendData : piPendData?.items ?? [];
    const compItems = Array.isArray(piCompData) ? piCompData : piCompData?.items ?? [];
    const sinRV = pendItems.filter(i => !i.remito_venta_number).length;
    return { pendiente: pendItems.length, completo: compItems.length, sinRV };
  }, [piPendData, piCompData]);

  const stats = [
    { label: "PENDIENTES",  sub: "Esperando confirmación",   val: tabCounts.pendientes,  bg: "bg-yellow-500 hover:bg-yellow-600" },
    { label: "PARCIALES",   sub: "Con diferencia reportada", val: tabCounts.parciales,   bg: "bg-orange-500 hover:bg-orange-600" },
    { label: "CONFIRMADOS", sub: "Recepción completa",       val: tabCounts.confirmados, bg: "bg-emerald-600 hover:bg-emerald-700" },
  ];

  const tableRows = { pendientes, confirmados, parciales }[activeTab] ?? [];

  // Purchase invoice rows — handle both { items: [] } and bare array responses
  const piRows = useMemo(() => {
    const raw = piTab === "pendientes" ? piPendData : piCompData;
    const rows = Array.isArray(raw) ? raw : raw?.items ?? [];
    if (piTab === "pendientes" && filterSinRV) {
      return rows.filter(inv => !inv.remito_venta_number);
    }
    return rows;
  }, [piTab, piPendData, piCompData, filterSinRV]);

  const togglePiExpand = (id) =>
    setExpandedPiIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleGroup = (key) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const groupedPiRows = useMemo(() => {
    if (piTab !== "pendientes") return null;
    return piRows.reduce((acc, inv) => {
      const key = inv.purchase_order_number
        ? inv.purchase_order_number
        : inv.purchase_order_id
        ? `NP-${inv.purchase_order_id}`
        : "Sin nota de pedido";
      if (!acc[key]) acc[key] = { orderNumber: key, items: [] };
      acc[key].items.push(inv);
      return acc;
    }, {});
  }, [piRows, piTab]);

  const openParcialModal = (ing) => {
    const items = ing.items ?? [];
    const initQtys = {};
    items.forEach((item, idx) => { initQtys[idx] = item.quantity ?? 0; });
    setParcialItems(initQtys);
    setObsModal({ ingresoId: ing.id, items });
    setObsText("");
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-3">
      {/* Overlays */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onScan={(code) => { setSearch(code); setScannerOpen(false); }}
        onClose={() => setScannerOpen(false)}
      />
      {pdfViewer && (
        <PdfViewer
          url={pdfViewer.url}
          filename={pdfViewer.filename}
          onClose={() => setPdfViewer(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-600" /> Recepción de Mercadería
            {!online && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <WifiOff size={12} /> MODO OFFLINE
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500">Confirmá la llegada de los ingresos pendientes</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Stat cards — basados en Facturas/Remitos de Proveedores */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => { setPiTab("pendientes"); setFilterSinRV(false); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all bg-yellow-500 hover:bg-yellow-600 text-white text-left"
        >
          <span className="text-2xl font-bold leading-none">{piCounts.pendiente}</span>
          <div>
            <p className="text-[11px] font-bold uppercase leading-none">PENDIENTES</p>
            <p className="text-white/60 text-[10px] leading-none mt-0.5">Sin confirmar ingreso</p>
          </div>
        </button>
        <button
          onClick={() => { setPiTab("pendientes"); setFilterSinRV(true); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all bg-orange-500 hover:bg-orange-600 text-white text-left"
        >
          <span className="text-2xl font-bold leading-none">{piCounts.sinRV}</span>
          <div>
            <p className="text-[11px] font-bold uppercase leading-none">SIN RV</p>
            <p className="text-white/60 text-[10px] leading-none mt-0.5">Sin remito de venta</p>
          </div>
        </button>
        <button
          onClick={() => setPiTab("confirmados")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all bg-emerald-600 hover:bg-emerald-700 text-white text-left"
        >
          <span className="text-2xl font-bold leading-none">{piCounts.completo}</span>
          <div>
            <p className="text-[11px] font-bold uppercase leading-none">CONFIRMADOS</p>
            <p className="text-white/60 text-[10px] leading-none mt-0.5">Ingreso completo</p>
          </div>
        </button>
      </div>

      {/* Toolbar (búsqueda) */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proveedor, N° doc..."
              className="pl-7 pr-3 py-1 border rounded text-xs w-52 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="p-1.5 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition"
            title="Escanear código de barras"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ═══ INGRESOS TABLE (colapsada — sistema interno) ═══ */}
      {false && (
        <>
          {activeTab === "pendientes" && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-800">
              Pendientes de Confirmar — {pendientes.length}
            </span>
          </div>
        )}
        {activeTab === "confirmados" && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">
              Recibidos y Confirmados — {confirmados.length}
            </span>
          </div>
        )}
        {activeTab === "parciales" && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-semibold text-orange-800">
              Ingresos Parciales — {parciales.length}
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">N° Doc.</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedido</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ítems</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {activeTab === "pendientes" ? "Acción" : "Observación"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin text-gray-300" />
                    Cargando...
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <CheckCircle2 className="h-9 w-9 mx-auto mb-2 text-emerald-400" />
                    <p className="text-emerald-600 font-medium text-sm">
                      {activeTab === "pendientes" ? "¡Todo al día! No hay pendientes" : "No hay registros"}
                    </p>
                  </td>
                </tr>
              ) : (
                tableRows.map((ing) => {
                  const parcial = esParcial(ing);
                  const rowBg =
                    activeTab === "pendientes"
                      ? "hover:bg-yellow-50/50"
                      : parcial
                      ? "bg-orange-50/20 hover:bg-orange-50/50"
                      : "hover:bg-emerald-50/30";
                  return (
                    <tr key={ing.id} className={rowBg}>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{fmtDate(ing.date)}</td>
                      <td className="px-3 py-2.5 font-medium text-blue-700 text-xs">{ing.provider_name || "—"}</td>
                      <td className="px-3 py-2.5">
                        <TipoBadge tipo={ing.type} />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-800">{ing.number}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        {ing.pedido_id ? `#${ing.pedido_id}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold text-gray-700">
                        {ing.items?.length ?? 0}
                      </td>

                      {/* Last column: actions (pending) or observation (confirmed/parciales) */}
                      {activeTab === "pendientes" ? (
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 items-center flex-wrap">
                            {ing.pdf_path && (
                              <button
                                onClick={() => setPdfViewer({
                                  url: `${window.location.protocol}//${window.location.hostname}:8000/api/v1/ingresos/${ing.id}/pdf`,
                                  filename: `Ingreso-${ing.number ?? ing.id}.pdf`,
                                })}
                                className="p-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded transition"
                                title="Ver PDF"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => confirmarMut.mutate({ ingresoId: ing.id, notes: null })}
                              disabled={confirmarMut.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50 transition"
                            >
                              ✓ OK
                            </button>
                            <button
                              onClick={() => openParcialModal(ing)}
                              disabled={confirmarMut.isPending}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50 transition"
                            >
                              ⚠ Parcial
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => { setForzarModal({ ingresoId: ing.id }); setForzarObs(""); setForzarDate(todayISO()); }}
                                className="bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded text-xs font-medium transition flex items-center gap-0.5"
                                title="Forzar llegada (admin)"
                              >
                                <ShieldAlert className="h-3 w-3" /> Forzar
                              </button>
                            )}
                          </div>
                        </td>
                      ) : (
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-xs">
                          <div className="flex items-start gap-1.5">
                            {ing.pdf_path && (
                              <button
                                onClick={() => setPdfViewer({
                                  url: `${window.location.protocol}//${window.location.hostname}:8000/api/v1/ingresos/${ing.id}/pdf`,
                                  filename: `Ingreso-${ing.number ?? ing.id}.pdf`,
                                })}
                                className="flex-shrink-0 p-0.5 text-red-500 hover:text-red-700 transition"
                                title="Ver PDF"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <span className="truncate">
                              {ing.notes
                                ? ing.notes.replace("[RECEPCION PARCIAL]", "").trim() || "—"
                                : "—"}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </>
      )} {/* end {false && ...} for INGRESOS TABLE */}

      {/* ═══ PURCHASE INVOICES SECTION ═══ */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-indigo-50 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-indigo-800 flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Facturas / Remitos de Proveedores (Módulo Compras)
          </h2>
          <div className="flex gap-1 flex-wrap items-center">
            {PI_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setPiTab(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  piTab === t.id
                    ? "bg-indigo-600 text-white border-indigo-700"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
            {piTab === "pendientes" && (
              <button
                onClick={() => setFilterSinRV(f => !f)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filterSinRV
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filterSinRV ? "Ver Todos" : "Sin RV"}
              </button>
            )}
            <span className="w-px h-5 bg-gray-300 mx-0.5" />
            {/* Consultar SQL Server Tomy */}
            <button
              onClick={() => reAsociarRvMut.mutate()}
              disabled={reAsociarRvMut.isPending || !online}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                reAsociarRvMut.isPending
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-violet-600 hover:bg-violet-700 text-white"
              }`}
              title="Consultar SQL Server Tomy y actualizar RVs automáticamente"
            >
              <Server size={12} />
              {reAsociarRvMut.isPending ? "Consultando Tomy..." : "🔄 Consultar Tomy SQL"}
            </button>
            {sqlToMyTime && (
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                ✓ {sqlToMyTime.toLocaleTimeString("es-AR")}
                {sqlToMyResult && (
                  <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                    {sqlToMyResult.updated} actualiz.
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2.5 w-8" />
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Días</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">N°</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nota Pedido</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ítems</th>
                {piTab === "pendientes" && (
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(loadingPiP || loadingPiC) ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin text-gray-300" />
                    Cargando facturas...
                  </td>
                </tr>
              ) : piRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                    {piTab === "pendientes"
                      ? "No hay facturas/remitos pendientes de ingreso"
                      : "No hay registros confirmados"}
                  </td>
                </tr>
              ) : piTab === "pendientes" && groupedPiRows ? (
                Object.entries(groupedPiRows).flatMap(([key, group]) => {
                  const groupExpanded = expandedGroups.has(key);
                  const allHaveRv = group.items.every(i => i.remito_venta_number);
                  const someHaveRv = group.items.some(i => i.remito_venta_number);

                  const groupHeader = (
                    <tr key={`group-${key}`} className="bg-indigo-50 cursor-pointer hover:bg-indigo-100 border-t-2 border-indigo-200" onClick={() => toggleGroup(key)}>
                      <td colSpan={9} className="px-3 py-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          {groupExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />}
                          <span className="font-bold text-indigo-900 text-xs">NP: {group.orderNumber}</span>
                          <span className="text-xs text-gray-600">{group.items[0]?.provider_name ?? "—"}</span>
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                            {group.items.length} doc{group.items.length !== 1 ? "s" : ""}
                          </span>
                          {/* Días del doc más antiguo del grupo */}
                          {(() => {
                            const oldest = group.items.reduce((a, b) => {
                              const da = a.date ?? a.invoice_date ?? "";
                              const db = b.date ?? b.invoice_date ?? "";
                              return da < db ? a : b;
                            });
                            const d = daysSince(oldest.date ?? oldest.invoice_date);
                            return d != null ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${d > 10 ? "bg-red-100 text-red-700" : d > 5 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                                {d}d sin confirmar
                              </span>
                            ) : null;
                          })()}
                          {allHaveRv
                            ? <span className="text-xs text-green-600 font-medium">✓ Con RV</span>
                            : <span className="text-xs text-yellow-600 font-medium">⚠️ {someHaveRv ? "RV parcial" : "Sin RV"}</span>}
                        </div>
                      </td>
                    </tr>
                  );

                  if (!groupExpanded) return [groupHeader];

                  const invoiceRows = group.items.flatMap((inv) => {
                    const expanded = expandedPiIds.has(inv.id);
                    const items = inv.items ?? inv.purchase_invoice_items ?? [];
                    const dateVal = inv.date ?? inv.invoice_date ?? inv.created_at;
                    const providerName = inv.provider_name ?? inv.supplier_name ?? "—";
                    const docType = inv.type ?? inv.document_type;
                    const docNumber = inv.number ?? inv.invoice_number ?? inv.document_number ?? "—";
                    const pedidoId = inv.pedido_id ?? inv.purchase_order_id;

                    return [
                      <tr key={inv.id} className="hover:bg-indigo-50/30">
                        <td className="px-3 py-2.5 text-center pl-8">
                          {items.length > 0 && (
                            <button
                              onClick={() => togglePiExpand(inv.id)}
                              className="text-gray-400 hover:text-indigo-600 transition"
                              title={expanded ? "Ocultar ítems" : "Ver ítems"}
                            >
                              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center"><DiasBadge fecha={dateVal} /></td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{fmtDate(dateVal)}</td>
                        <td className="px-3 py-2.5 font-medium text-blue-700 text-xs">{providerName}</td>
                        <td className="px-3 py-2.5"><TipoBadge tipo={docType} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            <SemaforoLuz estado={inv.estado_semaforo} />
                            <span className="font-mono text-xs text-gray-800">{docNumber}</span>
                            {/* Edición inline de RV — portado de CONTROL REMITOS */}
                            {rvEditingId === inv.id ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  value={rvEditingValue}
                                  onChange={(e) => setRvEditingValue(e.target.value)}
                                  autoFocus
                                  placeholder="RV"
                                  className="w-24 px-1.5 py-0.5 border rounded text-xs font-mono"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && rvEditingValue.trim()) {
                                      reasignarRvMutation.mutate({ factura_id: inv.id, nuevo_rv: rvEditingValue.trim() });
                                    } else if (e.key === "Escape") {
                                      setRvEditingId(null);
                                      setRvEditingValue("");
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => rvEditingValue.trim() && reasignarRvMutation.mutate({ factura_id: inv.id, nuevo_rv: rvEditingValue.trim() })}
                                  disabled={reasignarRvMutation.isPending || !rvEditingValue.trim()}
                                  className="px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-semibold disabled:opacity-50"
                                  title="Guardar RV"
                                >✓</button>
                                <button
                                  onClick={() => { setRvEditingId(null); setRvEditingValue(""); }}
                                  className="px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px]"
                                  title="Cancelar"
                                >✕</button>
                              </span>
                            ) : inv.remito_venta_number ? (
                              <button
                                onClick={() => { setRvEditingId(inv.id); setRvEditingValue(inv.remito_venta_number || ""); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 font-medium hover:bg-green-200 transition"
                                title="Click para reasignar RV"
                              >
                                RV: {inv.remito_venta_number}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setRvEditingId(inv.id); setRvEditingValue(""); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 font-medium hover:bg-yellow-200 transition"
                                title="Click para asignar RV"
                              >
                                ⚠️ Sin RV
                              </button>
                            )}
                          </div>
                          {inv.confirmado_local_at && (
                            <p className="text-[10px] text-blue-600 mt-0.5">✓ Local: {new Date(inv.confirmado_local_at).toLocaleTimeString("es-AR")}</p>
                          )}
                          {inv.confirmado_admin_at && (
                            <p className="text-[10px] text-green-600 mt-0.5">✓ Admin: {new Date(inv.confirmado_admin_at).toLocaleTimeString("es-AR")}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{pedidoId ? `#${pedidoId}` : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-bold text-gray-700">{items.length}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex gap-1 items-center justify-center flex-wrap">
                            <button
                              onClick={() => { setPiConfirmModal({ invoiceId: inv.id, invoice: inv }); setPiConfirmDate(todayISO()); }}
                              disabled={confirmarPiMut.isPending}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50 transition"
                            >
                              ✓ Confirmar
                            </button>
                            {!inv.confirmado_local_at && ["LOCAL", "DEPOSITO", "ADMIN", "SUPERADMIN", "COMPRAS"].includes(user?.role) && (
                              <button
                                onClick={() => confirmLocalMutation.mutate(inv.id)}
                                disabled={confirmLocalMutation.isPending}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                                title="Confirmar recepción local"
                              >
                                <Check size={12} /> Local
                              </button>
                            )}
                            {inv.confirmado_local_at && !inv.confirmado_admin_at && ["ADMIN", "SUPERADMIN", "COMPRAS"].includes(user?.role) && (
                              <button
                                onClick={() => confirmAdminMutation.mutate(inv.id)}
                                disabled={confirmAdminMutation.isPending}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                                title="Verificar como admin"
                              >
                                <Check size={12} /> Admin
                              </button>
                            )}
                            {/* Forzar ingreso (portado de CONTROL REMITOS) */}
                            {!inv.confirmado_admin_at && ["ADMIN", "SUPERADMIN"].includes(user?.role) && (
                              <button
                                onClick={() => { setPiForzarModal({ invoiceId: inv.id, invoice: inv }); setPiForzarObs(""); }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition"
                                title="Forzar ingreso (sin confirmar local)"
                              >
                                <ShieldAlert size={12} /> Forzar
                              </button>
                            )}
                            {/* Export ítems a Excel */}
                            {(inv.items?.length || inv.purchase_invoice_items?.length) ? (
                              <button
                                onClick={() => api.download(`/purchase-invoices/${inv.id}/export-items-excel`).catch(err => alert(err.message || "Error al descargar"))}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                                title="Descargar ítems en Excel"
                              >
                                <FileText size={12} /> Excel
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>,
                      expanded && items.length > 0 && (
                        <tr key={`${inv.id}-detail`} className="bg-indigo-50/40">
                          <td colSpan={9} className="px-12 py-2">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase text-gray-400">
                                  <th className="text-left pb-1 pr-6">Producto</th>
                                  <th className="text-left pb-1 pr-6">SKU</th>
                                  <th className="text-right pb-1 pr-6">Cant.</th>
                                  <th className="text-right pb-1">P. Unit.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => (
                                  <tr key={idx} className="border-t border-indigo-100">
                                    <td className="py-0.5 pr-6 text-gray-700">{item.product_name ?? item.description ?? `Ítem ${idx + 1}`}</td>
                                    <td className="py-0.5 pr-6 font-mono text-gray-500">{item.sku ?? "—"}</td>
                                    <td className="py-0.5 pr-6 text-right font-bold text-gray-800">{item.quantity}</td>
                                    <td className="py-0.5 text-right text-gray-600">
                                      {item.unit_price != null ? `$${Number(item.unit_price).toLocaleString("es-AR")}` : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ),
                    ].filter(Boolean);
                  });

                  return [groupHeader, ...invoiceRows];
                })
              ) : (
                piRows.flatMap((inv) => {
                  const expanded = expandedPiIds.has(inv.id);
                  const items = inv.items ?? inv.purchase_invoice_items ?? [];
                  const dateVal = inv.date ?? inv.invoice_date ?? inv.created_at;
                  const providerName = inv.provider_name ?? inv.supplier_name ?? "—";
                  const docType = inv.type ?? inv.document_type;
                  const docNumber = inv.number ?? inv.invoice_number ?? inv.document_number ?? "—";
                  const pedidoId = inv.pedido_id ?? inv.purchase_order_id;

                  return [
                    <tr key={inv.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-center">
                        {items.length > 0 && (
                          <button
                            onClick={() => togglePiExpand(inv.id)}
                            className="text-gray-400 hover:text-indigo-600 transition"
                            title={expanded ? "Ocultar ítems" : "Ver ítems"}
                          >
                            {expanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center"><DiasBadge fecha={dateVal} /></td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{fmtDate(dateVal)}</td>
                      <td className="px-3 py-2.5 font-medium text-blue-700 text-xs">{providerName}</td>
                      <td className="px-3 py-2.5"><TipoBadge tipo={docType} /></td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-800">
                        <div className="flex items-center gap-1">
                          <SemaforoLuz estado={inv.estado_semaforo} />
                          <span>{docNumber}</span>
                        </div>
                        {inv.confirmado_local_at && (
                          <p className="text-[10px] text-blue-600 mt-0.5">✓ Local: {new Date(inv.confirmado_local_at).toLocaleTimeString("es-AR")}</p>
                        )}
                        {inv.confirmado_admin_at && (
                          <p className="text-[10px] text-green-600 mt-0.5">✓ Admin: {new Date(inv.confirmado_admin_at).toLocaleTimeString("es-AR")}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        {pedidoId ? `#${pedidoId}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold text-gray-700">
                        {items.length}
                      </td>
                    </tr>,
                    expanded && items.length > 0 && (
                      <tr key={`${inv.id}-detail`} className="bg-indigo-50/40">
                        <td colSpan={8} className="px-8 py-2">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="text-[10px] uppercase text-gray-400">
                                <th className="text-left pb-1 pr-6">Producto</th>
                                <th className="text-left pb-1 pr-6">SKU</th>
                                <th className="text-right pb-1 pr-6">Cant.</th>
                                <th className="text-right pb-1">P. Unit.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-t border-indigo-100">
                                  <td className="py-0.5 pr-6 text-gray-700">
                                    {item.product_name ?? item.description ?? `Ítem ${idx + 1}`}
                                  </td>
                                  <td className="py-0.5 pr-6 font-mono text-gray-500">
                                    {item.sku ?? "—"}
                                  </td>
                                  <td className="py-0.5 pr-6 text-right font-bold text-gray-800">
                                    {item.quantity}
                                  </td>
                                  <td className="py-0.5 text-right text-gray-600">
                                    {item.unit_price != null
                                      ? `$${Number(item.unit_price).toLocaleString("es-AR")}`
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MODAL: Ingreso Parcial (con ítems) ═══ */}
      {obsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setObsModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b bg-orange-50 rounded-t-xl flex-shrink-0">
              <h3 className="font-bold text-orange-800 flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" /> Ingreso Parcial — Observación
              </h3>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Describí qué faltó o qué problema hubo:</p>
                <textarea
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Ej: Faltaron 5 unidades del código ABC123..."
                  className="w-full px-3 py-2 border rounded-lg h-20 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  autoFocus
                />
              </div>

              {obsModal.items?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Cantidad recibida por ítem:</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {obsModal.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {item.product_name ?? item.description ?? item.sku ?? `Ítem ${idx + 1}`}
                          </p>
                          {item.sku && (
                            <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-gray-500">
                          <span>Esp: {item.quantity}</span>
                          <input
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={parcialItems[idx] ?? item.quantity}
                            onChange={(e) =>
                              setParcialItems((prev) => ({ ...prev, [idx]: Number(e.target.value) }))
                            }
                            className="w-16 px-2 py-0.5 border rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-300"
                          />
                          <span className="text-[10px] text-gray-400">rcb</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setObsModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const itemsPayload = obsModal.items?.length
                    ? obsModal.items.map((item, idx) => ({
                        ...item,
                        received_quantity: parcialItems[idx] ?? item.quantity,
                      }))
                    : undefined;
                  confirmarMut.mutate({
                    ingresoId: obsModal.ingresoId,
                    notes: obsText,
                    items: itemsPayload,
                  });
                }}
                disabled={confirmarMut.isPending || !obsText.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold disabled:opacity-50 transition"
              >
                {confirmarMut.isPending ? "Guardando..." : "Confirmar Parcial"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Forzar Llegada (admin) ═══ */}
      {forzarModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setForzarModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b bg-red-50 rounded-t-xl flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-700" />
              <h3 className="font-bold text-red-800 text-sm">Confirmar Forzar Llegada</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                Esta acción forzará el estado a CONFIRMADO sin verificación completa. Solo usar en casos excepcionales.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de llegada</label>
                <input
                  type="date"
                  value={forzarDate}
                  onChange={(e) => setForzarDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={forzarObs}
                  onChange={(e) => setForzarObs(e.target.value)}
                  placeholder="Motivo del forzado..."
                  className="w-full px-3 py-2 border rounded-lg h-20 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-3 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setForzarModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => forzarMut.mutate({ ingresoId: forzarModal.ingresoId, notes: forzarObs })}
                disabled={forzarMut.isPending}
                className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm font-semibold disabled:opacity-50 transition"
              >
                {forzarMut.isPending ? "Forzando..." : "⚡ Forzar Llegada"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Confirmar Factura/Remito ═══ */}
      {piConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setPiConfirmModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b bg-indigo-50 rounded-t-xl">
              <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Confirmar Recepción
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {piConfirmModal?.invoice && !piConfirmModal.invoice.remito_venta_number && (
                <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start gap-2">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">Documento sin Remito de Venta</p>
                    <p className="text-xs text-yellow-700">Este documento no tiene RV asignado. Se recomienda asignarlo antes de confirmar la recepción.</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">Ingresá la fecha en que se recibió la mercadería:</p>
              <input
                type="date"
                value={piConfirmDate}
                onChange={(e) => setPiConfirmDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="p-3 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setPiConfirmModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  confirmarPiMut.mutate({
                    invoiceId: piConfirmModal.invoiceId,
                    ingreso_date: piConfirmDate,
                  })
                }
                disabled={confirmarPiMut.isPending || !piConfirmDate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50 transition"
              >
                {confirmarPiMut.isPending ? "Confirmando..." : "✓ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Forzar Ingreso (admin) — portado de CONTROL REMITOS ═══ */}
      {piForzarModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setPiForzarModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b bg-orange-50 rounded-t-xl">
              <h3 className="font-bold text-orange-800 text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Forzar Ingreso
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg text-xs text-orange-800">
                ⚠️ Esta acción marca la factura como <b>INGRESO COMPLETO</b>, pone el semáforo en
                <b> VERDE</b> y queda auditada como "FORZADO, SIN IMAGEN DE CARTA DE PORTE". Usar solo
                cuando no haya forma de confirmar la recepción normalmente.
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Motivo / Observaciones <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={piForzarObs}
                  onChange={(e) => setPiForzarObs(e.target.value)}
                  rows={3}
                  placeholder="Explicá por qué se fuerza el ingreso..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Documento: <b>{piForzarModal.invoice?.number ?? "—"}</b>
              </p>
            </div>
            <div className="p-3 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setPiForzarModal(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => piForzarMutation.mutate({ invoiceId: piForzarModal.invoiceId, observaciones: piForzarObs })}
                disabled={piForzarMutation.isPending}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold disabled:opacity-50 transition"
              >
                {piForzarMutation.isPending ? "Forzando..." : "Forzar ingreso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
