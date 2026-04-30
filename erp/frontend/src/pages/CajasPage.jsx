import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SERVER_BASE } from "../lib/api";
import {
  Wallet, ArrowRightLeft, Receipt, Printer, Check, X, Upload,
  Paperclip, Eye, Filter, MapPin, AlertTriangle, FileText,
  CheckCircle2, XCircle, Clock, PlusCircle, RefreshCw,
} from "lucide-react";

const TIPO_LABEL = {
  INGRESO: "Ingreso",
  EGRESO_GASTO: "Egreso/Gasto",
  TRASPASO_IN: "Traspaso (entrada)",
  TRASPASO_OUT: "Traspaso (salida)",
};

const ESTADO_BADGE = {
  PENDIENTE: { label: "Pendiente", cls: "bg-amber-100 text-amber-700", icon: Clock },
  ACEPTADO: { label: "Aceptado", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
  RECHAZADO: { label: "Rechazado", cls: "bg-red-100 text-red-700", icon: XCircle },
  LIVE: { label: "Live", cls: "bg-purple-100 text-purple-700", icon: Clock },
};

function fmtMoney(v) {
  const n = Number(v ?? 0);
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es-AR");
}

/* ═══════════════════════════════════════════════════════ */
/*  MAIN                                                   */
/* ═══════════════════════════════════════════════════════ */
export default function CajasPage({ initialTab = "control" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-600" />
          {tab === "control" ? "Control de Cajas" : "Gastos Locales"}
        </h1>
        <div className="inline-flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setTab("control")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              tab === "control" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Control de Cajas
          </button>
          <button
            onClick={() => setTab("gastos")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
              tab === "gastos" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Gastos Locales
          </button>
        </div>
      </div>
      {tab === "control" ? <ControlTab /> : <GastosTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  TAB 1 — CONTROL                                        */
/* ═══════════════════════════════════════════════════════ */
function ControlTab() {
  const [selectedCajaId, setSelectedCajaId] = useState(null);

  const { data: cajas = [] } = useQuery({
    queryKey: ["cajas"],
    queryFn: () => api.get("/cajas/"),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4">
      {/* Cards horizontales por ciudad */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cajas.map((c) => {
          const sel = selectedCajaId === c.id;
          const negativo = c.saldo < 0;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCajaId(sel ? null : c.id)}
              className={`text-left p-3 rounded-xl border-2 transition shadow-sm hover:shadow ${
                sel
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {c.ciudad}
              </div>
              <div className={`text-lg font-bold mt-1 ${negativo ? "text-red-600" : "text-gray-900"}`}>
                {fmtMoney(c.saldo)}
              </div>
              {c.movimientos_pendientes > 0 && (
                <div className={`mt-1 text-xs font-medium ${(c.pendiente_a_acreditar || 0) < 0 ? "text-red-600" : "text-amber-700"}`}>
                  {(c.pendiente_a_acreditar || 0) >= 0 ? "+" : "−"} {fmtMoney(Math.abs(c.pendiente_a_acreditar || 0))} pendiente
                  <span className="text-[10px] font-normal text-gray-500 ml-1">
                    ({c.movimientos_pendientes} mov{c.movimientos_pendientes > 1 ? "s" : ""})
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                <span>{c.locales_count} {c.locales_count === 1 ? "local" : "locales"}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCajaId && (
        <CajaDetalle
          caja={cajas.find((c) => c.id === selectedCajaId)}
          cajas={cajas}
        />
      )}
    </div>
  );
}

/* ─── Detalle de una caja seleccionada ─── */
function CajaDetalle({ caja, cajas }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  // Default: últimos 7 días para que siempre haya datos visibles
  const sevenDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(sevenDaysAgo);
  const [filtroHasta, setFiltroHasta] = useState(today);
  const [liveLocalFiltro, setLiveLocalFiltro] = useState("");
  const [filtroDescripcion, setFiltroDescripcion] = useState("");
  const [filtroFuente, setFiltroFuente] = useState(""); // "" | "CLINK" | "SQL" | "PG" | "AMBOS"
  const [filtroDescripcionExacta, setFiltroDescripcionExacta] = useState("");
  const [filtroFP, setFiltroFP] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");

  // ── Cajas registradoras (CLINK + SQL lado a lado) ─────────────────
  const { data: regResp, isFetching: regLoading } = useQuery({
    queryKey: ["cajas-registradoras-comp", caja.id],
    queryFn: () => api.get(`/cajas/${caja.id}/registradoras-comparado`),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const registradorasCiudad = regResp?.items || [];
  const totalRegistradorasClink = registradorasCiudad.reduce(
    (acc, r) => acc + (r.clink_total || 0), 0
  );
  const totalRegistradorasSql = registradorasCiudad.reduce(
    (acc, r) => acc + (r.sql_total || 0), 0
  );

  // ── Tabla principal: PG + CLINK + SQL cruzados ────────────────────
  const compQueryKey = ["caja-comp", caja.id, filtroDesde, filtroHasta];
  const { data: compResp, isFetching: compLoading } = useQuery({
    queryKey: compQueryKey,
    queryFn: () => api.get(`/cajas/${caja.id}/movimientos-comparado?fecha_desde=${filtroDesde}&fecha_hasta=${filtroHasta}`),
    refetchInterval: 30000,
  });
  const allItems = compResp?.items || [];
  const fuentes = compResp?.fuentes || { clink_ok: false, sql_ok: false, errores: [] };

  // Filtros frontend (no van al backend)
  const movsFiltrados = useMemo(() => {
    return allItems.filter((m) => {
      if (liveLocalFiltro && String(m.local_id) !== String(liveLocalFiltro)) return false;
      if (filtroEstado) {
        if (filtroEstado === "PG_PENDIENTE") {
          if (m.pg_estado !== "PENDIENTE") return false;
        } else if (filtroEstado === "PG_ACEPTADO") {
          if (m.pg_estado !== "ACEPTADO") return false;
        } else if (filtroEstado === "PG_RECHAZADO") {
          if (m.pg_estado !== "RECHAZADO") return false;
        } else if (filtroEstado === "SIN_PG") {
          if (m.pg_total != null) return false;
        }
      }
      if (filtroFuente) {
        const enClink = m.clink_total != null;
        const enSql = m.sql_total != null;
        const enPg = m.pg_total != null;
        if (filtroFuente === "CLINK" && !enClink) return false;
        if (filtroFuente === "SQL" && !enSql) return false;
        if (filtroFuente === "PG" && !enPg) return false;
        if (filtroFuente === "AMBOS" && !(enClink && enSql)) return false;
        if (filtroFuente === "SOLO_CLINK" && !(enClink && !enSql)) return false;
        if (filtroFuente === "SOLO_SQL" && !(enSql && !enClink)) return false;
      }
      if (filtroDescripcionExacta && m.descripcion !== filtroDescripcionExacta) return false;
      if (filtroFP && (m.fp_codigo || "") !== filtroFP) return false;
      if (filtroVendedor && m.vendedor !== filtroVendedor) return false;
      if (filtroDescripcion) {
        const q = filtroDescripcion.toLowerCase();
        const text = `${m.descripcion || ""} ${m.local_name || ""} ${m.vendedor || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, liveLocalFiltro, filtroEstado, filtroFuente, filtroDescripcion,
      filtroDescripcionExacta, filtroFP, filtroVendedor]);

  // Valores únicos (para los selects de filtros)
  const descripcionesUnicas = useMemo(() => {
    const s = new Set();
    allItems.forEach((m) => { if (m.descripcion) s.add(m.descripcion); });
    return Array.from(s).sort();
  }, [allItems]);
  const fpUnicos = useMemo(() => {
    const s = new Set();
    allItems.forEach((m) => { if (m.fp_codigo) s.add(m.fp_codigo); });
    return Array.from(s).sort();
  }, [allItems]);
  const vendedoresUnicos = useMemo(() => {
    const s = new Set();
    allItems.forEach((m) => { if (m.vendedor) s.add(m.vendedor); });
    return Array.from(s).sort();
  }, [allItems]);

  // Locales únicos (de los movimientos cargados)
  const localesUnicos = useMemo(() => {
    const map = new Map();
    allItems.forEach((m) => {
      if (m.local_id && !map.has(m.local_id)) map.set(m.local_id, m.local_name);
    });
    return Array.from(map.entries());
  }, [allItems]);

  // Pendientes a acreditar = movimientos PG con estado PENDIENTE
  const pendientesPg = allItems.filter((m) => m.pg_estado === "PENDIENTE");
  const pendienteTotal = pendientesPg.reduce((acc, m) => acc + (m.pg_total || 0), 0);
  const pendienteCount = pendientesPg.length;

  const aceptarLiveMut = useMutation({
    mutationFn: (m) => api.post(`/cajas/${caja.id}/aceptar-live-retiro`, {
      local_id: m.local_id,
      fecha: (m.fecha || "").slice(0, 10),
      numero: null,
      descripcion: m.descripcion,
      monto: m.clink_total ?? m.sql_total ?? 0,
    }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: compQueryKey });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: compQueryKey });
    },
  });

  const aceptarMut = useMutation({
    mutationFn: (id) => api.post(`/cajas/movimientos/${id}/aceptar`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["caja-movs", caja.id] });
      const prev = qc.getQueriesData({ queryKey: ["caja-movs", caja.id] });
      qc.setQueriesData({ queryKey: ["caja-movs", caja.id] }, (old) =>
        Array.isArray(old) ? old.map((m) => m.id === id ? { ...m, estado: "ACEPTADO" } : m) : old
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
    },
  });
  const cancelarMut = useMutation({
    mutationFn: (id) => api.post(`/cajas/movimientos/${id}/cancelar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: ["caja-movs", caja.id] });
    },
  });

  const downloadPdf = async () => {
    const qs = new URLSearchParams();
    const estadoPdf = filtroEstado === "PG_PENDIENTE" ? "PENDIENTE"
      : filtroEstado === "PG_ACEPTADO" ? "ACEPTADO"
      : filtroEstado === "PG_RECHAZADO" ? "RECHAZADO"
      : "ACEPTADO";
    qs.set("estado", estadoPdf);
    if (filtroDesde) qs.set("desde", filtroDesde);
    if (filtroHasta) qs.set("hasta", filtroHasta);
    const url = `${SERVER_BASE}/api/v1/cajas/${caja.id}/export-pdf?${qs}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
    });
    if (!res.ok) {
      alert("Error al exportar PDF");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `caja_${caja.ciudad.replace(/\s+/g, "_")}_${estadoPdf.toLowerCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-start justify-between p-4 border-b border-gray-100 flex-wrap gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase tracking-wide">
                Caja Fuerte
              </span>
              {caja.nombre}
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="px-3 py-2 bg-gray-50 rounded-lg">
                <div className="text-[10px] uppercase text-gray-500 font-medium">Saldo (lo que hay)</div>
                <div className={`text-lg font-bold ${caja.saldo < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {fmtMoney(caja.saldo)}
                </div>
              </div>
              <div className="px-3 py-2 bg-amber-50 rounded-lg">
                <div className="text-[10px] uppercase text-amber-700 font-medium">Pendiente a acreditar</div>
                <div className="text-lg font-bold text-amber-700">
                  {fmtMoney(pendienteTotal)}
                </div>
                <div className="text-[10px] text-amber-600">
                  {pendienteCount} mov pendiente{pendienteCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cajas registradoras — CLINK + SQL lado a lado por local */}
        {registradorasCiudad.length > 0 && (
          <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-blue-50/40 to-white">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                Cajas registradoras (saldo de hoy)
                {regLoading && <RefreshCw className="w-3 h-3 animate-spin text-gray-400 ml-1" />}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-3">
                <span>Total CLINK: <span className="font-semibold text-purple-700">{fmtMoney(totalRegistradorasClink)}</span></span>
                <span>Total SQL: <span className="font-semibold text-amber-700">{fmtMoney(totalRegistradorasSql)}</span></span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {registradorasCiudad.map((r) => {
                const clinkN = r.clink_total;
                const sqlN = r.sql_total;
                return (
                  <div key={r.local_id} className="px-3 py-2 bg-white rounded-lg border border-gray-100">
                    <div className="text-xs text-gray-500 truncate" title={r.local_name}>
                      {r.local_name}
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <div className="border-r border-gray-100 pr-1">
                        <div className="text-[9px] font-bold text-purple-700">CLINK</div>
                        <div className={`text-xs font-semibold tabular-nums ${
                          clinkN == null ? "text-gray-300" : (clinkN < 0 ? "text-red-600" : "text-gray-900")
                        }`}>
                          {clinkN == null ? "NON" : fmtMoney(clinkN)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-amber-700">SQL</div>
                        <div className={`text-xs font-semibold tabular-nums ${
                          sqlN == null ? "text-gray-300" : (sqlN < 0 ? "text-red-600" : "text-gray-900")
                        }`}>
                          {sqlN == null ? "NON" : fmtMoney(sqlN)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Forms (Traspaso / Ingreso / Egreso) — entre registradoras y movimientos del día */}
        <div className="p-4 border-b border-gray-100 grid grid-cols-1 lg:grid-cols-3 gap-3 bg-gray-50/40">
          <TraspasoForm cajas={cajas} cajaActual={caja} />
          <IngresoForm cajas={cajas} cajaActual={caja} />
          <EgresoForm cajas={cajas} cajaActual={caja} />
        </div>

        {/* Filtros — todos los datos cargados, filtros del lado del cliente */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <input
            type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
            title="Desde"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
            title="Hasta"
          />
          <select
            value={liveLocalFiltro}
            onChange={(e) => setLiveLocalFiltro(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
          >
            <option value="">Todos los locales</option>
            {localesUnicos.map(([lid, lname]) => (
              <option key={lid} value={lid}>{lname}</option>
            ))}
          </select>
          <select
            value={filtroFuente}
            onChange={(e) => setFiltroFuente(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
            title="Filtrar por fuente"
          >
            <option value="">Todas las fuentes</option>
            <option value="AMBOS">CLINK + SQL coinciden</option>
            <option value="SOLO_CLINK">Solo CLINK</option>
            <option value="SOLO_SQL">Solo SQL</option>
            <option value="CLINK">En CLINK</option>
            <option value="SQL">En SQL</option>
            <option value="PG">En ERP (manual)</option>
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
          >
            <option value="">Todos los estados</option>
            <option value="PG_PENDIENTE">ERP pendiente</option>
            <option value="PG_ACEPTADO">ERP aceptado</option>
            <option value="PG_RECHAZADO">ERP rechazado</option>
            <option value="SIN_PG">No registrados en ERP</option>
          </select>
          <select
            value={filtroDescripcionExacta}
            onChange={(e) => setFiltroDescripcionExacta(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 max-w-[200px]"
          >
            <option value="">Todas las descripciones</option>
            {descripcionesUnicas.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={filtroFP}
            onChange={(e) => setFiltroFP(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
          >
            <option value="">Todas las FP</option>
            {fpUnicos.map((fp) => (
              <option key={fp} value={fp}>{fp}</option>
            ))}
          </select>
          <select
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 max-w-[180px]"
          >
            <option value="">Todos los vendedores</option>
            {vendedoresUnicos.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <input
            type="text"
            value={filtroDescripcion}
            onChange={(e) => setFiltroDescripcion(e.target.value)}
            placeholder="Buscar texto…"
            className="text-sm border border-gray-200 rounded px-2 py-1 flex-1 min-w-[140px]"
          />
          {(filtroEstado || liveLocalFiltro || filtroFuente || filtroDescripcion ||
            filtroDescripcionExacta || filtroFP || filtroVendedor) && (
            <button
              onClick={() => {
                setFiltroEstado(""); setLiveLocalFiltro(""); setFiltroFuente("");
                setFiltroDescripcion(""); setFiltroDescripcionExacta("");
                setFiltroFP(""); setFiltroVendedor("");
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar
            </button>
          )}
          <span className="text-xs text-gray-500">
            {compLoading ? <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> cargando…</span> : `${movsFiltrados.length}/${allItems.length} movs`}
          </span>
        </div>

        {/* Status fuentes */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50/60 border-b border-gray-100 text-[11px] flex-wrap">
          <span className="font-bold text-purple-700">CLINK:</span>
          {compLoading
            ? <span className="text-purple-600 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> cargando…</span>
            : fuentes.clink_ok
              ? <span className="text-green-700">OK</span>
              : <span className="text-red-600">no responde</span>}
          <span className="font-bold text-amber-700 ml-2">SQL:</span>
          {compLoading
            ? <span className="text-amber-600 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> cargando…</span>
            : fuentes.sql_ok
              ? <span className="text-green-700">OK</span>
              : <span className="text-red-600">no responde</span>}
          {!compLoading && fuentes.errores?.length > 0 && (
            <span className="text-red-600 truncate" title={fuentes.errores.join(" · ")}>
              · {fuentes.errores.length} error(es)
            </span>
          )}
        </div>

        {/* Tabla unificada PG + CLINK + SQL */}
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Fecha</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Hora</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Local</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">FP</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Vendedor</th>
                <th className="text-right px-2 py-2 font-medium text-purple-700 bg-purple-50">CLINK</th>
                <th className="text-right px-2 py-2 font-medium text-amber-700 bg-amber-50">SQL</th>
                <th className="text-right px-2 py-2 font-medium text-blue-700 bg-blue-50">ERP</th>
                <th className="text-left px-2 py-2 font-medium text-gray-600">Estado</th>
                <th className="text-right px-2 py-2 font-medium text-gray-600">Acción</th>
              </tr>
            </thead>
            <tbody>
              {movsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-400 text-sm">
                    {compLoading ? "Cargando…" : "Sin movimientos para los filtros aplicados."}
                  </td>
                </tr>
              ) : movsFiltrados.map((m) => {
                const fechaStr = m.fecha ? (m.fecha.includes("T") ? m.fecha.slice(0, 10) : (m.fecha || "").slice(0, 10)) : "—";
                const horaStr = m.fecha ? (() => {
                  try {
                    const d = new Date(m.fecha.replace(" ", "T"));
                    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                  } catch { return "—"; }
                })() : "—";
                const ingreso = (m.tipo || "").toUpperCase().includes("INGRESO");
                const enClink = m.clink_total != null;
                const enSql = m.sql_total != null;
                const enPg = m.pg_total != null;
                const ambos = enClink && enSql;
                const diff = ambos ? Math.abs(Math.abs(m.clink_total) - Math.abs(m.sql_total)) : 0;
                const conflicto = ambos && diff > 0.01;
                const pgEstado = m.pg_estado;
                const badge = pgEstado ? ESTADO_BADGE[pgEstado] : null;
                const Icon = badge?.icon ?? Clock;
                const isPendienteLive = !enPg && (enClink || enSql);
                const rowBg = conflicto ? "bg-red-50/40"
                  : (enClink && !enSql && !enPg) ? "bg-purple-50/30"
                  : (enSql && !enClink && !enPg) ? "bg-amber-50/30"
                  : "";
                return (
                  <tr key={m.key} className={`border-b border-gray-50 hover:bg-gray-50/50 ${rowBg}`}>
                    <td className="px-2 py-1 text-gray-700 whitespace-nowrap">{fechaStr}</td>
                    <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{horaStr}</td>
                    <td className="px-2 py-1 text-gray-700 truncate max-w-[140px]" title={m.local_name}>{m.local_name || "—"}</td>
                    <td className="px-2 py-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        ingreso ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}>{(m.tipo || "?").replace("_", " ")}</span>
                    </td>
                    <td className="px-2 py-1 text-gray-700 truncate max-w-[220px]" title={m.descripcion}>{m.descripcion || "—"}</td>
                    <td className="px-2 py-1 text-gray-500">{m.fp_descrip || m.fp_codigo || "—"}</td>
                    <td className="px-2 py-1 text-gray-500 truncate max-w-[120px]" title={m.vendedor}>{m.vendedor || "—"}</td>
                    <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                      m.clink_total == null ? "text-gray-300" : (m.clink_total < 0 ? "text-red-600" : "text-gray-900")
                    }`}>
                      {m.clink_total == null ? "NON" : fmtMoney(m.clink_total)}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                      m.sql_total == null ? "text-gray-300" : (m.sql_total < 0 ? "text-red-600" : "text-gray-900")
                    }`}>
                      {m.sql_total == null ? "NON" : fmtMoney(m.sql_total)}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                      m.pg_total == null ? "text-gray-300" : "text-gray-900"
                    }`}>
                      {m.pg_total == null ? "NON" : fmtMoney(m.pg_total)}
                      {m.pg_numero && <div className="text-[9px] text-gray-400 font-normal">{m.pg_numero}</div>}
                    </td>
                    <td className="px-2 py-1">
                      {pgEstado ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${badge?.cls}`}>
                          <Icon className="w-3 h-3" /> {badge?.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">— sin ERP</span>
                      )}
                      {conflicto && (
                        <div className="text-[9px] text-red-700 font-bold mt-0.5">Δ {fmtMoney(diff)}</div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      {pgEstado === "PENDIENTE" && (
                        <button
                          onClick={() => aceptarMut.mutate(m.pg_id)}
                          disabled={aceptarMut.isPending}
                          className="text-[10px] px-2 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium"
                        >
                          <Check className="w-3 h-3 inline" /> Aceptar
                        </button>
                      )}
                      {pgEstado === "ACEPTADO" && (
                        <button
                          onClick={() => {
                            if (confirm("¿Cancelar este movimiento? Volverá atrás el saldo.")) {
                              cancelarMut.mutate(m.pg_id);
                            }
                          }}
                          disabled={cancelarMut.isPending}
                          className="text-[10px] px-2 py-0.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded"
                          title="Cancelar — vuelve el movimiento atrás"
                        >
                          <X className="w-3 h-3 inline" /> Cancelar
                        </button>
                      )}
                      {isPendienteLive && (
                        <button
                          onClick={() => aceptarLiveMut.mutate(m)}
                          disabled={aceptarLiveMut.isPending}
                          className="text-[10px] px-2 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium"
                          title="Acreditar a la caja fuerte"
                        >
                          <Check className="w-3 h-3 inline" /> Acreditar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 p-3 border-t border-gray-100">
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            <Printer className="w-4 h-4" />
            Imprimir {filtroEstado ? filtroEstado.toLowerCase() + "s" : "todos"}
          </button>
        </div>
      </div>

    </div>
  );
}
/* ─── Comprobante uploader inline ─── */
function ComprobanteUploader({ movId, cajaId }) {
  const qc = useQueryClient();
  const upMut = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadFile(`/cajas/movimientos/${movId}/comprobante`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caja-movs", cajaId] });
      qc.invalidateQueries({ queryKey: ["gastos-locales"] });
    },
  });
  return (
    <label className="cursor-pointer text-xs text-gray-500 hover:text-blue-600 inline-flex items-center gap-1">
      <Paperclip className="w-3 h-3" />
      {upMut.isPending ? "Subiendo…" : "Adjuntar"}
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upMut.mutate(f);
        }}
      />
    </label>
  );
}

/* ─── Form Traspaso entre cajas ─── */
function TraspasoForm({ cajas, cajaActual }) {
  const qc = useQueryClient();
  const [origenId, setOrigenId] = useState(cajaActual?.id || "");
  const [destinoId, setDestinoId] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");

  const mut = useMutation({
    mutationFn: () => api.post("/cajas/traspaso", {
      caja_origen_id: Number(origenId),
      caja_destino_id: Number(destinoId),
      monto: Number(monto),
      motivo: motivo || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: ["caja-movs"] });
      setMonto(""); setMotivo(""); setDestinoId("");
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!origenId || !destinoId || !monto) return;
    if (origenId === destinoId) {
      alert("Origen y destino deben ser cajas distintas");
      return;
    }
    mut.mutate();
  };

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-base font-bold text-gray-900">
        <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Traspaso entre cajas
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Caja origen</label>
        <select
          value={origenId}
          onChange={(e) => setOrigenId(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        >
          <option value="">— Elegir —</option>
          {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Caja destino</label>
        <select
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        >
          <option value="">— Elegir —</option>
          {cajas.filter((c) => String(c.id) !== String(origenId)).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
        <input
          type="number" min="0" step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo (opcional)</label>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          placeholder="Ej: Refuerzo de caja"
        />
      </div>
      {mut.isError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          {mut.error?.message || "Error al registrar el traspaso"}
        </div>
      )}
      <button
        type="submit"
        disabled={mut.isPending}
        className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
      >
        {mut.isPending ? "Registrando…" : "Registrar traspaso"}
      </button>
    </form>
  );
}

/* ─── Form Ingreso a caja fuerte ─── */
function IngresoForm({ cajas, cajaActual }) {
  const qc = useQueryClient();
  const [cajaId, setCajaId] = useState(cajaActual?.id || "");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [numero, setNumero] = useState("");
  const [comprobante, setComprobante] = useState(null);

  const mut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("caja_id", String(cajaId));
      fd.append("monto", String(monto));
      fd.append("motivo", motivo);
      if (numero.trim()) fd.append("numero", numero.trim());
      if (comprobante) fd.append("comprobante", comprobante);
      return api.uploadFile("/cajas/ingreso", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: ["caja-movs"] });
      setMonto(""); setMotivo(""); setNumero(""); setComprobante(null);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!cajaId || !monto || !motivo.trim()) return;
    mut.mutate();
  };

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-base font-bold text-gray-900">
        <PlusCircle className="w-4 h-4 text-green-600" /> Registrar ingreso
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Caja destino (caja fuerte de la ciudad)</label>
        <select
          value={cajaId}
          onChange={(e) => setCajaId(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        >
          <option value="">— Elegir —</option>
          {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">N° de retiro (opcional)</label>
        <input
          type="text" value={numero} onChange={(e) => setNumero(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          placeholder="Ej: 6087508"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
        <input
          type="number" min="0" step="0.01"
          value={monto} onChange={(e) => setMonto(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
        <input
          type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          placeholder="Ej: Cierre de caja registradora"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante (opcional)</label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 hover:text-blue-600 px-3 py-2 border border-dashed border-gray-300 rounded">
          <Upload className="w-4 h-4" />
          {comprobante ? comprobante.name : "Adjuntar archivo (PDF/JPG/PNG)"}
          <input
            type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => setComprobante(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      {mut.isError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          {mut.error?.message || "Error al registrar el ingreso"}
        </div>
      )}
      <button
        type="submit" disabled={mut.isPending}
        className="w-full py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition"
      >
        {mut.isPending ? "Registrando…" : "Registrar ingreso"}
      </button>
    </form>
  );
}

/* ─── Form Egreso (retiro) de la caja fuerte ─── */
function EgresoForm({ cajas, cajaActual }) {
  const qc = useQueryClient();
  const [cajaId, setCajaId] = useState(cajaActual?.id || "");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [numero, setNumero] = useState("");
  const [comprobante, setComprobante] = useState(null);

  const mut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("caja_id", String(cajaId));
      fd.append("monto", String(monto));
      fd.append("motivo", motivo);
      if (numero.trim()) fd.append("numero", numero.trim());
      if (comprobante) fd.append("comprobante", comprobante);
      return api.uploadFile("/cajas/egreso", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: ["caja-movs"] });
      setMonto(""); setMotivo(""); setNumero(""); setComprobante(null);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!cajaId || !monto || !motivo.trim()) return;
    mut.mutate();
  };

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-base font-bold text-gray-900">
        <Receipt className="w-4 h-4 text-red-600" /> Registrar egreso / retiro
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Caja origen (caja fuerte de la ciudad)</label>
        <select
          value={cajaId}
          onChange={(e) => setCajaId(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        >
          <option value="">— Elegir —</option>
          {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">N° de retiro (opcional)</label>
        <input
          type="text" value={numero} onChange={(e) => setNumero(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          placeholder="Ej: 6087508"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
        <input
          type="number" min="0" step="0.01"
          value={monto} onChange={(e) => setMonto(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
        <input
          type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
          placeholder="Ej: Retiro de efectivo"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Comprobante (opcional)</label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 hover:text-blue-600 px-3 py-2 border border-dashed border-gray-300 rounded">
          <Upload className="w-4 h-4" />
          {comprobante ? comprobante.name : "Adjuntar archivo (PDF/JPG/PNG)"}
          <input
            type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => setComprobante(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      {mut.isError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          {mut.error?.message || "Error al registrar el egreso"}
        </div>
      )}
      <button
        type="submit" disabled={mut.isPending}
        className="w-full py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition"
      >
        {mut.isPending ? "Registrando…" : "Registrar egreso"}
      </button>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  TAB 2 — GASTOS LOCALES                                 */
/* ═══════════════════════════════════════════════════════ */
function GastosTab() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const sevenDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const [filtroLocal, setFiltroLocal] = useState("");
  const [filtroCiudad, setFiltroCiudad] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFuente, setFiltroFuente] = useState("");
  const [filtroDescripcionExacta, setFiltroDescripcionExacta] = useState("");
  const [filtroFP, setFiltroFP] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(sevenDaysAgo);
  const [filtroHasta, setFiltroHasta] = useState(today);

  const { data: locales = [] } = useQuery({
    queryKey: ["locales", "active"],
    queryFn: () => api.get("/locals/"),
    select: (d) => (d?.items ?? d ?? []).filter((l) => l.is_active !== false),
  });
  const ciudades = useMemo(
    () => Array.from(new Set(locales.map((l) => l.ciudad).filter(Boolean))).sort(),
    [locales],
  );

  // Endpoint global cruzado PG + CLINK + SQL
  const compKey = ["gastos-comp-global", filtroDesde, filtroHasta, filtroCiudad];
  const { data: compResp, isFetching: compLoading } = useQuery({
    queryKey: compKey,
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set("fecha_desde", filtroDesde);
      qs.set("fecha_hasta", filtroHasta);
      if (filtroCiudad) qs.set("ciudad", filtroCiudad);
      return api.get(`/cajas/gastos-comparado-global?${qs}`);
    },
    refetchInterval: 60000,
  });
  const allItems = compResp?.items || [];
  const fuentes = compResp?.fuentes || { clink_ok: false, sql_ok: false, errores: [] };

  const movsFiltrados = useMemo(() => {
    return allItems.filter((m) => {
      if (filtroLocal && String(m.local_id) !== String(filtroLocal)) return false;
      if (filtroEstado) {
        if (filtroEstado === "PG_PENDIENTE" && m.pg_estado !== "PENDIENTE") return false;
        if (filtroEstado === "PG_ACEPTADO" && m.pg_estado !== "ACEPTADO") return false;
        if (filtroEstado === "PG_RECHAZADO" && m.pg_estado !== "RECHAZADO") return false;
        if (filtroEstado === "SIN_PG" && m.pg_total != null) return false;
      }
      if (filtroFuente) {
        const enClink = m.clink_total != null;
        const enSql = m.sql_total != null;
        const enPg = m.pg_total != null;
        if (filtroFuente === "CLINK" && !enClink) return false;
        if (filtroFuente === "SQL" && !enSql) return false;
        if (filtroFuente === "PG" && !enPg) return false;
        if (filtroFuente === "AMBOS" && !(enClink && enSql)) return false;
        if (filtroFuente === "SOLO_CLINK" && !(enClink && !enSql)) return false;
        if (filtroFuente === "SOLO_SQL" && !(enSql && !enClink)) return false;
      }
      if (filtroDescripcionExacta && m.descripcion !== filtroDescripcionExacta) return false;
      if (filtroFP && (m.fp_codigo || "") !== filtroFP) return false;
      if (filtroVendedor && m.vendedor !== filtroVendedor) return false;
      if (filtroBusqueda) {
        const q = filtroBusqueda.toLowerCase();
        const text = `${m.descripcion || ""} ${m.local_name || ""} ${m.vendedor || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, filtroLocal, filtroEstado, filtroFuente, filtroDescripcionExacta,
      filtroFP, filtroVendedor, filtroBusqueda]);

  const localesUnicos = useMemo(() => {
    const map = new Map();
    allItems.forEach((m) => {
      if (m.local_id && !map.has(m.local_id)) map.set(m.local_id, m.local_name);
    });
    return Array.from(map.entries());
  }, [allItems]);
  const descripcionesUnicas = useMemo(() => {
    const s = new Set();
    allItems.forEach((m) => { if (m.descripcion) s.add(m.descripcion); });
    return Array.from(s).sort();
  }, [allItems]);
  const fpUnicos = useMemo(() => {
    const s = new Set();
    allItems.forEach((m) => { if (m.fp_codigo) s.add(m.fp_codigo); });
    return Array.from(s).sort();
  }, [allItems]);
  const vendedoresUnicos = useMemo(() => {
    const s = new Set();
    allItems.forEach((m) => { if (m.vendedor) s.add(m.vendedor); });
    return Array.from(s).sort();
  }, [allItems]);

  const aceptarMut = useMutation({
    mutationFn: (id) => api.post(`/cajas/movimientos/${id}/aceptar`),
    onMutate: async () => { await qc.cancelQueries({ queryKey: compKey }); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: compKey });
    },
  });
  const aceptarGastoLiveMut = useMutation({
    mutationFn: (g) => api.post(`/cajas/aceptar-gasto-live`, {
      local_id: g.local_id,
      fecha: (g.fecha || "").slice(0, 10),
      descripcion: g.descripcion,
      monto: g.clink_total ?? g.sql_total ?? 0,
    }),
    onMutate: async () => { await qc.cancelQueries({ queryKey: compKey }); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cajas"] });
      qc.invalidateQueries({ queryKey: compKey });
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Filtros */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <input
          type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
          title="Desde"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
          title="Hasta"
        />
        <select
          value={filtroCiudad}
          onChange={(e) => { setFiltroCiudad(e.target.value); setFiltroLocal(""); }}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option value="">Todas las ciudades</option>
          {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filtroLocal}
          onChange={(e) => setFiltroLocal(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option value="">Todos los locales</option>
          {localesUnicos.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select
          value={filtroFuente}
          onChange={(e) => setFiltroFuente(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option value="">Todas las fuentes</option>
          <option value="AMBOS">CLINK + SQL coinciden</option>
          <option value="SOLO_CLINK">Solo CLINK</option>
          <option value="SOLO_SQL">Solo SQL</option>
          <option value="CLINK">En CLINK</option>
          <option value="SQL">En SQL</option>
          <option value="PG">En ERP (manual)</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option value="">Todos los estados</option>
          <option value="PG_PENDIENTE">ERP pendiente</option>
          <option value="PG_ACEPTADO">ERP aceptado</option>
          <option value="PG_RECHAZADO">ERP rechazado</option>
          <option value="SIN_PG">No registrados en ERP</option>
        </select>
        <select
          value={filtroDescripcionExacta}
          onChange={(e) => setFiltroDescripcionExacta(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 max-w-[200px]"
        >
          <option value="">Todas las descripciones</option>
          {descripcionesUnicas.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filtroFP}
          onChange={(e) => setFiltroFP(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1"
        >
          <option value="">Todas las FP</option>
          {fpUnicos.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
        </select>
        <select
          value={filtroVendedor}
          onChange={(e) => setFiltroVendedor(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 max-w-[180px]"
        >
          <option value="">Todos los vendedores</option>
          {vendedoresUnicos.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <input
          type="text"
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          placeholder="Buscar texto…"
          className="text-sm border border-gray-200 rounded px-2 py-1 flex-1 min-w-[140px]"
        />
        {(filtroLocal || filtroCiudad || filtroEstado || filtroFuente ||
          filtroDescripcionExacta || filtroFP || filtroVendedor || filtroBusqueda) && (
          <button
            onClick={() => {
              setFiltroLocal(""); setFiltroCiudad(""); setFiltroEstado("");
              setFiltroFuente(""); setFiltroDescripcionExacta("");
              setFiltroFP(""); setFiltroVendedor(""); setFiltroBusqueda("");
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            Limpiar
          </button>
        )}
        <span className="text-xs text-gray-500">
          {compLoading ? <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> cargando…</span> : `${movsFiltrados.length}/${allItems.length} movs`}
        </span>
      </div>

      {/* Status fuentes */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50/60 border-b border-gray-100 text-[11px] flex-wrap">
        <span className="font-bold text-purple-700">CLINK:</span>
        {compLoading
          ? <span className="text-purple-600 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> cargando…</span>
          : fuentes.clink_ok
            ? <span className="text-green-700">OK</span>
            : <span className="text-red-600">no responde</span>}
        <span className="font-bold text-amber-700 ml-2">SQL:</span>
        {compLoading
          ? <span className="text-amber-600 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> cargando…</span>
          : fuentes.sql_ok
            ? <span className="text-green-700">OK</span>
            : <span className="text-red-600">no responde</span>}
        {!compLoading && fuentes.errores?.length > 0 && (
          <span className="text-red-600 truncate" title={fuentes.errores.join(" · ")}>
            · {fuentes.errores.length} error(es)
          </span>
        )}
      </div>

      {/* Tabla unificada PG + CLINK + SQL */}
      <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Hora</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Local</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">FP</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Vendedor</th>
              <th className="text-right px-2 py-2 font-medium text-purple-700 bg-purple-50">CLINK</th>
              <th className="text-right px-2 py-2 font-medium text-amber-700 bg-amber-50">SQL</th>
              <th className="text-right px-2 py-2 font-medium text-blue-700 bg-blue-50">ERP</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600">Estado</th>
              <th className="text-right px-2 py-2 font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody>
            {movsFiltrados.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-400 text-sm">
                  {compLoading ? "Cargando…" : "Sin movimientos para los filtros aplicados."}
                </td>
              </tr>
            ) : movsFiltrados.map((m) => {
              const fechaStr = m.fecha ? (m.fecha.includes("T") ? m.fecha.slice(0, 10) : m.fecha.slice(0, 10)) : "—";
              const horaStr = m.fecha ? (() => {
                try {
                  const d = new Date(m.fecha.replace(" ", "T"));
                  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                } catch { return "—"; }
              })() : "—";
              const ingreso = (m.tipo || "").toUpperCase().includes("INGRESO");
              const enClink = m.clink_total != null;
              const enSql = m.sql_total != null;
              const enPg = m.pg_total != null;
              const ambos = enClink && enSql;
              const diff = ambos ? Math.abs(Math.abs(m.clink_total) - Math.abs(m.sql_total)) : 0;
              const conflicto = ambos && diff > 0.01;
              const pgEstado = m.pg_estado;
              const badge = pgEstado ? ESTADO_BADGE[pgEstado] : null;
              const Icon = badge?.icon ?? Clock;
              const rowBg = conflicto ? "bg-red-50/40"
                : (enClink && !enSql && !enPg) ? "bg-purple-50/30"
                : (enSql && !enClink && !enPg) ? "bg-amber-50/30"
                : "";
              const isLive = !enPg && (enClink || enSql);
              return (
                <tr key={m.key} className={`border-b border-gray-50 hover:bg-gray-50/50 ${rowBg}`}>
                  <td className="px-2 py-1 text-gray-700 whitespace-nowrap">{fechaStr}</td>
                  <td className="px-2 py-1 text-gray-500 whitespace-nowrap">{horaStr}</td>
                  <td className="px-2 py-1 text-gray-700 truncate max-w-[140px]" title={m.local_name}>{m.local_name || "—"}</td>
                  <td className="px-2 py-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      ingreso ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>{(m.tipo || "?").replace("_", " ")}</span>
                  </td>
                  <td className="px-2 py-1 text-gray-700 truncate max-w-[220px]" title={m.descripcion}>{m.descripcion || "—"}</td>
                  <td className="px-2 py-1 text-gray-500">{m.fp_descrip || m.fp_codigo || "—"}</td>
                  <td className="px-2 py-1 text-gray-500 truncate max-w-[120px]" title={m.vendedor}>{m.vendedor || "—"}</td>
                  <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                    m.clink_total == null ? "text-gray-300" : (m.clink_total < 0 ? "text-red-600" : "text-gray-900")
                  }`}>
                    {m.clink_total == null ? "NON" : fmtMoney(m.clink_total)}
                  </td>
                  <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                    m.sql_total == null ? "text-gray-300" : (m.sql_total < 0 ? "text-red-600" : "text-gray-900")
                  }`}>
                    {m.sql_total == null ? "NON" : fmtMoney(m.sql_total)}
                  </td>
                  <td className={`px-2 py-1 text-right font-mono tabular-nums ${
                    m.pg_total == null ? "text-gray-300" : "text-gray-900"
                  }`}>
                    {m.pg_total == null ? "NON" : fmtMoney(m.pg_total)}
                    {m.pg_numero && <div className="text-[9px] text-gray-400 font-normal">{m.pg_numero}</div>}
                  </td>
                  <td className="px-2 py-1">
                    {pgEstado ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${badge?.cls}`}>
                        <Icon className="w-3 h-3" /> {badge?.label}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">— sin ERP</span>
                    )}
                    {conflicto && (
                      <div className="text-[9px] text-red-700 font-bold mt-0.5">Δ {fmtMoney(diff)}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    {pgEstado === "PENDIENTE" && (
                      <button
                        onClick={() => aceptarMut.mutate(m.pg_id)}
                        disabled={aceptarMut.isPending}
                        className="text-[10px] px-2 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium"
                      >
                        <Check className="w-3 h-3 inline" /> Aceptar
                      </button>
                    )}
                    {isLive && (
                      <button
                        onClick={() => aceptarGastoLiveMut.mutate(m)}
                        disabled={aceptarGastoLiveMut.isPending}
                        className="text-[10px] px-2 py-0.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium"
                      >
                        <Check className="w-3 h-3 inline" /> Acreditar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
