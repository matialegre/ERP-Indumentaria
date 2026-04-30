import { useState, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import * as XLSX from "xlsx";
import {
  BarChart3, ShoppingBag, Tag, Package,
  CreditCard, TrendingUp, Store, Calendar, Download,
  Search, RefreshCw, ChevronRight, ChevronDown, FileBarChart,
  AlertCircle, Loader2, ArrowUpDown, ShoppingCart,
  Star, Clock, DollarSign, Plus, Trash2,
} from "lucide-react";

// ── Snapshot status badge ───────────────────────────────────────────────────

function SnapshotStatusBadge() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["snapshot-status"],
    queryFn: () => api.get("/informes/snapshot-status"),
    refetchInterval: 60_000,
    retry: false,
  });

  const [refreshing, setRefreshing] = useState(false);
  const last = data?.last_sync_at ? new Date(data.last_sync_at) : null;
  const ageMin = last ? Math.floor((Date.now() - last.getTime()) / 60000) : null;
  const stale = ageMin !== null && ageMin > 30;
  const ok = data?.all_ok !== false && last;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post("/informes/snapshot-refresh");
      // refrescar cada 5s durante 90s para ver el cambio
      for (let i = 0; i < 18; i++) {
        await new Promise(r => setTimeout(r, 5000));
        await refetch();
      }
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`w-2 h-2 rounded-full ${ok && !stale ? 'bg-emerald-500' : stale ? 'bg-amber-500' : 'bg-red-500'}`} />
        <span className="text-slate-700 font-medium flex-1 truncate">
          {last ? `Datos: ${last.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Sin datos'}
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || isFetching}
          title="Forzar actualización ahora"
          className="text-slate-500 hover:text-sky-600 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      {ageMin !== null && (
        <p className="text-[10px] text-slate-500 mt-0.5">
          Hace {ageMin < 60 ? `${ageMin} min` : `${Math.floor(ageMin/60)}h ${ageMin%60}m`}
        </p>
      )}
    </div>
  );
}


// ── Helpers ─────────────────────────────────────────────────────────────────

const AR_TZ = "America/Argentina/Buenos_Aires";
const localDate = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ }).format(d);
const today = () => localDate(new Date());
const firstOfMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  return `${y}-${m}-01`;
};

const FALTANTE_SQL = "__FALTANTE_SQL__";

function fmt(val) {
  if (val === null || val === undefined) return FALTANTE_SQL;
  if (typeof val === "number") {
    if (Number.isInteger(val)) return val.toLocaleString("es-AR");
    return val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(val);
}

function fmtMoney(val) {
  if (val === null || val === undefined) return FALTANTE_SQL;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val);
}

function FaltanteSQL() {
  return <span className="text-amber-500 italic text-[10px] font-medium">Faltante SQL</span>;
}

function FmtCell({ val, money = false }) {
  const raw = money ? fmtMoney(val) : fmt(val);
  if (raw === FALTANTE_SQL) return <FaltanteSQL />;
  if (money) return <span className="font-semibold text-emerald-700">{raw}</span>;
  return <span>{raw}</span>;
}

function exportToExcel(rows, filename) {
  if (!rows || rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Informe");
  XLSX.writeFile(wb, `${filename}_${today()}.xlsx`);
}

// ── KPI cards ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 shadow-sm">
      <div className="rounded-lg p-2.5 flex-shrink-0" style={{ background: color + "20" }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-slate-800 break-all">{value}</p>
      </div>
    </div>
  );
}

// ── Tabla genérica ────────────────────────────────────────────────────────────

function DataTable({ rows, moneyKeys = [], highlight = null }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [colWidths, setColWidths] = useState({});
  const containerRef = useRef(null);

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <FileBarChart size={48} className="mb-3 opacity-30" />
        <p className="text-sm">Sin datos para mostrar</p>
      </div>
    );
  }

  const cols = Object.keys(rows[0]);

  let data = rows;
  if (search.trim()) {
    const q = search.toLowerCase();
    data = data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }
  if (sortCol) {
    data = [...data].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const res = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "es-AR");
      return sortDir === "asc" ? res : -res;
    });
  }

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const handleAutoFit = () => {
    if (!containerRef.current) return;
    const available = containerRef.current.clientWidth - 2;
    const w = Math.max(40, Math.floor(available / cols.length));
    const widths = {};
    cols.forEach(c => { widths[c] = w; });
    setColWidths(widths);
  };

  const handleResetWidths = () => setColWidths({});

  const startResize = (e, col) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col] || 120;
    const onMove = (ev) => {
      const newW = Math.max(40, startW + ev.clientX - startX);
      setColWidths(prev => ({ ...prev, [col]: newW }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const hasCustomWidths = Object.keys(colWidths).length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en resultados..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleAutoFit}
          title="Ajustar todas las columnas al ancho visible"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
        >
          <ArrowUpDown size={12} />
          Ajustar columnas
        </button>
        {hasCustomWidths && (
          <button
            onClick={handleResetWidths}
            title="Restaurar anchos originales"
            className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Restablecer
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-2">{data.length} filas{search && ` (filtrado de ${rows.length})`}</p>
      <div ref={containerRef} className="overflow-auto scrollbar-visible rounded-xl border border-slate-200 shadow-sm" style={{ maxHeight: "480px" }}>
        <table className="text-xs border-collapse" style={{ tableLayout: hasCustomWidths ? "fixed" : "auto", width: hasCustomWidths ? `${cols.reduce((s, c) => s + (colWidths[c] || 120), 0)}px` : "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800">
              {cols.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  style={{ width: colWidths[col] || undefined, minWidth: 40, position: "relative" }}
                  className="px-3 py-3 text-left text-white font-semibold cursor-pointer hover:bg-white/10 transition-colors select-none overflow-hidden"
                >
                  <span className="flex items-center gap-1 overflow-hidden">
                    <span className="truncate">{col.replace(/_/g, " ")}</span>
                    <ArrowUpDown size={10} className="opacity-50 flex-shrink-0" />
                  </span>
                  <div
                    onMouseDown={(e) => startResize(e, col)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute", right: 0, top: 0, bottom: 0, width: 5,
                      cursor: "col-resize", background: "transparent",
                    }}
                    className="hover:bg-white/30"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 transition-colors ${
                  highlight && row[highlight] ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                } hover:bg-blue-50/50`}
              >
                {cols.map(col => (
                  <td key={col} style={{ maxWidth: colWidths[col] || undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: hasCustomWidths ? "nowrap" : "nowrap" }} className="px-3 py-2 text-slate-700">
                    <FmtCell val={row[col]} money={moneyKeys.includes(col)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800 border-t-2 border-slate-500">
              {cols.map((col, idx) => {
                const isNumeric = data.length > 0 && typeof data[0][col] === "number";
                let total = null;
                if (isNumeric) {
                  const upper = col.toUpperCase();
                  const isAvgCol = upper.includes("PROMEDIO");
                  if (isAvgCol) {
                    const valid = data.filter(r => r[col] !== null && r[col] !== undefined);
                    total = valid.length > 0 ? valid.reduce((s, r) => s + (r[col] || 0), 0) / valid.length : 0;
                  }else {
                    total = data.reduce((s, r) => s + (r[col] ?? 0), 0);
                  }
                }
                return (
                  <td key={col} style={{ maxWidth: colWidths[col] || undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="px-3 py-2 font-bold text-white">
                    {total !== null
                      ? (moneyKeys.includes(col)
                        ? <span className="text-emerald-300">{fmtMoney(total)}</span>
                        : <span>{fmt(total)}</span>)
                      : idx === 0
                        ? <span className="text-slate-300 text-xs uppercase tracking-wide">TOTAL</span>
                        : null
                    }
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Multi-select de locales ──────────────────────────────────────────────────

function MultiLocalSelect({ value, options, onChange, label = "Locales" }) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : (value ? value.split(",").filter(Boolean) : []);
  const allSelected = selected.length === options.length && options.length > 0;
  const toggleOne = (loc) => {
    if (selected.includes(loc)) onChange(selected.filter(x => x !== loc));
    else onChange([...selected, loc]);
  };
  const toggleAll = () => { onChange(allSelected ? [] : [...options]); };
  let display;
  if (selected.length === 0) display = "Todos los locales";
  else if (selected.length === 1) display = selected[0];
  else if (selected.length <= 3) display = selected.join(", ");
  else display = `${selected.length} locales seleccionados`;
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between">
        <span className="truncate">{display}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 sticky top-0 bg-white">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              <span className="text-sm font-medium text-slate-700">
                {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
              </span>
            </label>
            {options.map(l => (
              <label key={l} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(l)} onChange={() => toggleOne(l)} className="rounded" />
                <span className="text-sm text-slate-700">{l}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Panel de filtros ──────────────────────────────────────────────────────────

function FilterPanel({ filters, values, onChange, locales, marcas, proveedores }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {filters.includes("fecha") && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
            <input type="date" value={values.desde || ""} onChange={e => onChange("desde", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
            <input type="date" value={values.hasta || ""} onChange={e => onChange("hasta", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </>
      )}
      {filters.includes("local") && (
        <MultiLocalSelect
          value={values.local}
          options={locales}
          onChange={(arr) => onChange("local", arr)}
        />
      )}

      {filters.includes("marca") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
          <select value={values.marca || ""} onChange={e => onChange("marca", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todas las marcas</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}
      {filters.includes("proveedor") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
          <select value={values.proveedor || ""} onChange={e => onChange("proveedor", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}
      {filters.includes("min_articulos") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mín. artículos</label>
          <input type="number" min="1" value={values.min_articulos || 1} onChange={e => onChange("min_articulos", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("codigo_articulo") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Código artículo</label>
          <input type="text" value={values.codigo_articulo || ""} onChange={e => onChange("codigo_articulo", e.target.value)}
            placeholder="Ej: COL123"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("medio_pago") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Medio de pago</label>
          <input type="text" value={values.medio_pago || ""} onChange={e => onChange("medio_pago", e.target.value)}
            placeholder="Ej: EFECTIVO"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("codigo_promo") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Código promo</label>
          <input type="text" value={values.codigo_promo || ""} onChange={e => onChange("codigo_promo", e.target.value)}
            placeholder="Ej: PROMO10"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("categoria") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Categoría ML</label>
          <input type="text" value={values.categoria || ""} onChange={e => onChange("categoria", e.target.value)}
            placeholder="Ej: Ropa deportiva"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("producto") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Producto (contiene)</label>
          <input type="text" value={values.producto || ""} onChange={e => onChange("producto", e.target.value)}
            placeholder="Buscar producto"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("dias_sin_movimiento") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sin movimiento en (días)</label>
          <input type="number" min="1" value={values.dias_sin_movimiento || 30} onChange={e => onChange("dias_sin_movimiento", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("porcentaje") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Porcentaje (%)</label>
          <input type="number" min="0" max="100" step="0.1" value={values.porcentaje || ""} onChange={e => onChange("porcentaje", e.target.value)}
            placeholder="Ej: 5"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("unificar_dias") && (
        <div className="flex items-center col-span-full mt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!values.unificar_dias}
              onChange={e => onChange("unificar_dias", e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <span className="text-sm font-medium text-slate-700">Unificar días</span>
            <span className="text-xs text-slate-400">(mostrar totales por local sin desglose diario)</span>
          </label>
        </div>
      )}
      {filters.includes("desglose_local") && (
        <div className="flex items-center col-span-full mt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!values.desglose_local}
              onChange={e => onChange("desglose_local", e.target.checked)}
              className="w-4 h-4 rounded accent-amber-600"
            />
            <span className="text-sm font-medium text-slate-700">Desglose por local</span>
            <span className="text-xs text-slate-400">(ver cada marca desagregada por sucursal)</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ── Definición de informes ────────────────────────────────────────────────────

const REPORTS = [
  {
    id: "ventas-agrupadas",
    group: "Ventas",
    label: "Ventas por Día y Local",
    desc: "Monto, cantidad y facturas por día",
    note: "Incluye todos los artículos sin filtro de precio (bolsas, accesorios, etc.). Las «Facturas emitidas» solo cuentan comprobantes tipo TKF/TIQUE; las notas de crédito se muestran por separado. Por eso los totales difieren del informe «Artículos por Ticket».",
    icon: BarChart3,
    color: "#3b82f6",
    endpoint: "/informes/ventas-agrupadas",
    filters: ["fecha", "local", "unificar_dias"],
    moneyKeys: ["MONTO_VENDIDO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.MONTO_VENDIDO || 0), 0);
      const cant = rows.reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
      const tickets = rows.reduce((s, r) => s + (r.CANTIDAD_FACTURAS || 0), 0);
      const promArt = tickets > 0 ? (cant / tickets) : 0;
      const ticketProm = tickets > 0 ? (total / tickets) : 0;
      return [
        { label: "Cantidad de comprobantes", value: tickets.toLocaleString("es-AR"), icon: FileBarChart, color: "#3b82f6" },
        { label: "Cantidad de artículos", value: cant.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Promedio art/ticket", value: promArt.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), icon: ShoppingCart, color: "#8b5cf6" },
        { label: "Cantidad de tickets", value: tickets.toLocaleString("es-AR"), icon: ShoppingBag, color: "#f59e0b" },
        { label: "Monto vendido", value: fmtMoney(total), icon: TrendingUp, color: "#059669" },
        { label: "Ticket promedio", value: fmtMoney(ticketProm), icon: Star, color: "#ef4444" },
      ];
    },
  },
  {
    id: "articulos-por-ticket",
    group: "Ventas",
    label: "Artículos por Ticket",
    desc: "Totales de comprobantes y artículos vendidos unificados por local",
    note: "Solo cuenta artículos con precio > $10 (excluye bolsas y accesorios de bajo valor). Los «Total comprobantes» incluyen todos los tipos de comprobante que tengan al menos un ítem con precio > $10. Por eso los totales difieren del informe «Ventas por Día y Local».",
    icon: ShoppingCart,
    color: "#8b5cf6",
    endpoint: "/informes/articulos-por-ticket",
    filters: ["fecha", "local"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalArt = rows.reduce((s, r) => s + (r.TOTAL_ARTICULOS || 0), 0);
      const totalTickets = rows.reduce((s, r) => s + (r.TOTAL_TICKETS || 0), 0);
      return [
        { label: "Total artículos", value: totalArt.toLocaleString("es-AR"), icon: Package, color: "#8b5cf6" },
        { label: "Total comprobantes", value: totalTickets.toLocaleString("es-AR"), icon: ShoppingCart, color: "#10b981" },
      ];
    },
  },
  {
    id: "ventas-marca",
    group: "Ventas",
    label: "Ventas por Marca",
    desc: "Cantidad vendida y monto total por marca en el período",
    icon: Tag,
    color: "#f59e0b",
    endpoint: "/informes/ventas-marca",
    filters: ["fecha", "local", "marca", "proveedor", "desglose_local"],
    moneyKeys: ["MONTO_VENDIDO", "STOCK_VALORIZADO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.MONTO_VENDIDO || 0), 0);
      const cant = rows.reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
      const marcas = [...new Set(rows.map(r => r.MARCA))].length;
      return [
        { label: "Monto total", value: fmtMoney(total), icon: TrendingUp, color: "#f59e0b" },
        { label: "Artículos vendidos", value: cant.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Marcas", value: marcas, icon: Tag, color: "#6366f1" },
      ];
    },
  },
  {
    id: "ventas-articulo",
    group: "Ventas",
    label: "Top Artículos Vendidos",
    desc: "Ranking de artículos más vendidos con variante (talle/color) y stock actual",
    icon: ShoppingBag,
    color: "#ec4899",
    endpoint: "/informes/ventas-articulo",
    filters: ["fecha", "local", "marca", "desglose_local"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.TOTAL_VENDIDO || 0), 0);
      const articulos = [...new Set(rows.map(r => r.CODIGO_ARTICULO))].length;
      const stock = rows.reduce((s, r) => s + (r.STOCK_ACTUAL || 0), 0);
      return [
        { label: "Unidades vendidas", value: total.toLocaleString("es-AR"), icon: Package, color: "#ec4899" },
        { label: "Artículos distintos", value: articulos, icon: ShoppingBag, color: "#6366f1" },
        { label: "Stock actual (variantes)", value: stock.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
      ];
    },
  },
  {
    id: "ventas-promo",
    group: "Ventas",
    label: "Ventas con Código Promo",
    desc: "Fecha, local, comprobante, artículo, precio de lista, descuento, precio neto, código promo, forma de pago",
    icon: Tag,
    color: "#06b6d4",
    endpoint: "/informes/ventas-promo",
    filters: ["fecha", "local", "marca", "codigo_articulo", "codigo_promo"],
    moneyKeys: ["PRECIO_LISTA", "DESCUENTO", "PRECIO_NETO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalNeto = rows.reduce((s, r) => s + (r.PRECIO_NETO || 0), 0);
      const totalDescuento = rows.reduce((s, r) => s + (r.DESCUENTO || 0), 0);
      const promos = [...new Set(rows.map(r => r.CODIGOPROMOCION).filter(Boolean))].length;
      return [
        { label: "Monto neto total", value: fmtMoney(totalNeto), icon: TrendingUp, color: "#06b6d4" },
        { label: "Descuentos aplicados", value: fmtMoney(totalDescuento), icon: Tag, color: "#f59e0b" },
        { label: "Códigos promo distintos", value: promos, icon: Star, color: "#a855f7" },
      ];
    },
  },
  {
    id: "medio-pago",
    group: "Ventas",
    label: "Ventas por Medio de Pago",
    desc: "Monto por forma de pago, fecha y local",
    icon: CreditCard,
    color: "#a855f7",
    endpoint: "/informes/medio-pago",
    filters: ["fecha", "local", "medio_pago"],
    moneyKeys: ["MONTO_VENDIDO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.MONTO_VENDIDO || 0), 0);
      const medios = [...new Set(rows.map(r => r.MEDIO_PAGO))].length;
      return [
        { label: "Monto total", value: fmtMoney(total), icon: TrendingUp, color: "#a855f7" },
        { label: "Medios de pago", value: medios, icon: CreditCard, color: "#10b981" },
      ];
    },
  },
  {
    id: "ticket-promedio",
    group: "Ventas",
    label: "Ticket Promedio",
    desc: "Cantidad de tickets, monto total y ticket promedio por local",
    icon: TrendingUp,
    color: "#0ea5e9",
    endpoint: "/informes/ticket-promedio",
    filters: ["fecha", "local"],
    moneyKeys: ["MONTO_TOTAL", "TICKET_PROMEDIO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalTickets = rows.reduce((s, r) => s + (r.TOTAL_TICKETS || 0), 0);
      const montoTotal = rows.reduce((s, r) => s + (r.MONTO_TOTAL || 0), 0);
      const promGlobal = totalTickets > 0 ? montoTotal / totalTickets : 0;
      return [
        { label: "Monto total", value: fmtMoney(montoTotal), icon: TrendingUp, color: "#0ea5e9" },
        { label: "Total tickets", value: totalTickets.toLocaleString("es-AR"), icon: ShoppingCart, color: "#6366f1" },
        { label: "Ticket promedio global", value: fmtMoney(promGlobal), icon: Star, color: "#f59e0b" },
      ];
    },
  },
  {
    id: "ventas-categoria",
    group: "Ventas",
    label: "Ventas por Categoría",
    desc: "Monto y cantidad por categoría de producto (calzado, indumentaria, etc.)",
    icon: Tag,
    color: "#14b8a6",
    endpoint: "/informes/ventas-categoria",
    filters: ["fecha", "local"],
    moneyKeys: ["MONTO_VENDIDO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.MONTO_VENDIDO || 0), 0);
      const cant = rows.reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
      const cats = [...new Set(rows.map(r => r.CATEGORIA))].length;
      return [
        { label: "Monto total", value: fmtMoney(total), icon: TrendingUp, color: "#14b8a6" },
        { label: "Artículos vendidos", value: cant.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Categorías", value: cats, icon: Tag, color: "#6366f1" },
      ];
    },
  },
  {
    id: "ventas-stock",
    group: "Stock",
    label: "Ventas y Stock",
    desc: "Comparativa de stock actual vs cantidad vendida",
    icon: Package,
    color: "#10b981",
    endpoint: "/informes/ventas-stock",
    filters: ["fecha", "local", "marca", "proveedor"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalStock = rows.reduce((s, r) => s + (r.STOCK_ACTUAL || 0), 0);
      const totalVend = rows.reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
      const sinStock = rows.filter(r => (r.STOCK_ACTUAL || 0) === 0).length;
      return [
        { label: "Stock total", value: totalStock.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Total vendido", value: totalVend.toLocaleString("es-AR"), icon: TrendingUp, color: "#3b82f6" },
        { label: "Sin stock", value: sinStock, icon: AlertCircle, color: "#ef4444" },
      ];
    },
  },
  {
    id: "stock-valorizado",
    group: "Stock",
    label: "Stock Valorizado",
    desc: "Valor total del stock por local (stock × costo)",
    icon: Store,
    color: "#0ea5e9",
    endpoint: "/informes/stock-valorizado",
    filters: ["local", "marca", "proveedor"],
    moneyKeys: ["VALOR_TOTAL"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.VALOR_TOTAL || 0), 0);
      return [
        { label: "Valor total stock", value: fmtMoney(total), icon: TrendingUp, color: "#0ea5e9" },
        { label: "Locales", value: rows.length, icon: Store, color: "#6366f1" },
      ];
    },
  },
  {
    id: "stock-actual",
    group: "Stock",
    label: "Stock Actual por Producto",
    desc: "Stock disponible agrupado por producto, marca y proveedor",
    icon: Package,
    color: "#22c55e",
    endpoint: "/informes/stock-actual",
    filters: ["local", "marca", "proveedor"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalStock = rows.reduce((s, r) => s + (r.STOCK_TOTAL || 0), 0);
      const articulos = rows.length;
      const marcas = [...new Set(rows.map(r => r.MARCA).filter(Boolean))].length;
      return [
        { label: "Stock total", value: totalStock.toLocaleString("es-AR"), icon: Package, color: "#22c55e" },
        { label: "Artículos distintos", value: articulos.toLocaleString("es-AR"), icon: ShoppingBag, color: "#3b82f6" },
        { label: "Marcas", value: marcas, icon: Tag, color: "#f59e0b" },
      ];
    },
  },
  {
    id: "productos-sin-movimiento",
    group: "Stock",
    label: "Productos sin Movimiento",
    desc: "Productos en stock sin ventas en los últimos X días",
    icon: Clock,
    color: "#f97316",
    endpoint: "/informes/productos-sin-movimiento",
    filters: ["local", "marca", "dias_sin_movimiento"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalStock = rows.reduce((s, r) => s + (r.STOCK_ACTUAL || 0), 0);
      const sinVenta = rows.filter(r => !r.ULTIMA_VENTA).length;
      return [
        { label: "Productos parados", value: rows.length.toLocaleString("es-AR"), icon: Clock, color: "#f97316" },
        { label: "Unidades inmovilizadas", value: totalStock.toLocaleString("es-AR"), icon: Package, color: "#ef4444" },
        { label: "Sin venta histórica", value: sinVenta, icon: AlertCircle, color: "#6366f1" },
      ];
    },
  },
  {
    id: "fichas-locales",
    group: "Fichas",
    label: "Fichas de Compras por Local",
    desc: "Tasa de conversión de atención a compra efectiva",
    icon: Store,
    color: "#f97316",
    endpoint: "/informes/fichas-locales",
    filters: ["fecha", "local"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.TOTAL_OPERACIONES || 0), 0);
      const compras = rows.reduce((s, r) => s + (r.COMPRAS_EFECTIVAS || 0), 0);
      const prom = total > 0 ? ((compras / total) * 100).toFixed(1) : "0";
      return [
        { label: "Total operaciones", value: total.toLocaleString("es-AR"), icon: ShoppingCart, color: "#f97316" },
        { label: "Compras efectivas", value: compras.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Conversión global", value: `${prom}%`, icon: TrendingUp, color: "#6366f1" },
      ];
    },
  },
  {
    id: "fichas-diarias",
    group: "Fichas",
    label: "Fichas de Compras Diarias",
    desc: "Evolución diaria de la tasa de conversión",
    icon: Calendar,
    color: "#84cc16",
    endpoint: "/informes/fichas-diarias",
    filters: ["fecha", "local"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalOps = rows.reduce((s, r) => s + (r.TOTAL_OPERACIONES_DIA || 0), 0);
      const totalComp = rows.reduce((s, r) => s + (r.COMPRAS_EFECTIVAS_DIA || 0), 0);
      const dias = rows.length;
      return [
        { label: "Días", value: dias, icon: Calendar, color: "#84cc16" },
        { label: "Total operaciones", value: totalOps.toLocaleString("es-AR"), icon: ShoppingCart, color: "#f97316" },
        { label: "Total compras", value: totalComp.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
      ];
    },
  },
  {
    id: "declaracion-shopping",
    group: "Shopping",
    label: "Declaración Shopping",
    desc: "Ventas por local cruzadas con porcentaje para declarar al shopping",
    icon: Store,
    color: "#7c3aed",
    endpoint: "/informes/declaracion-shopping",
    filters: ["fecha", "local", "porcentaje"],
    moneyKeys: ["MONTO_VENDIDO", "MONTO_A_PAGAR"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.MONTO_VENDIDO || 0), 0);
      const totalDec = rows.reduce((s, r) => s + (r.MONTO_A_PAGAR || 0), 0);
      const tickets = rows.reduce((s, r) => s + (r.CANTIDAD_TICKETS || 0), 0);
      return [
        { label: "Total vendido", value: fmtMoney(total), icon: TrendingUp, color: "#7c3aed" },
        { label: "Total a declarar", value: fmtMoney(totalDec), icon: FileBarChart, color: "#ef4444" },
        { label: "Tickets", value: tickets.toLocaleString("es-AR"), icon: ShoppingCart, color: "#10b981" },
      ];
    },
  },
  {
    id: "mercadolibre-categorias",
    group: "MercadoLibre",
    label: "MercadoLibre — Categorías",
    desc: "Unidades y monto por categoría de ML",
    icon: TrendingUp,
    color: "#f59e0b",
    endpoint: "/informes/mercadolibre-categorias",
    filters: ["fecha", "local", "categoria"],
    moneyKeys: ["VENTAS"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalVentas = rows.reduce((s, r) => s + (r.VENTAS || 0), 0);
      const totalUni = rows.reduce((s, r) => s + (r.UNIDADES || 0), 0);
      return [
        { label: "Ventas ML total", value: fmtMoney(totalVentas), icon: TrendingUp, color: "#f59e0b" },
        { label: "Unidades", value: totalUni.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Categorías", value: rows.length, icon: Tag, color: "#6366f1" },
      ];
    },
  },
  {
    id: "mercadolibre-productos",
    group: "MercadoLibre",
    label: "MercadoLibre — Productos",
    desc: "Unidades y monto por producto de ML",
    icon: ShoppingBag,
    color: "#ef4444",
    endpoint: "/informes/mercadolibre-productos",
    filters: ["fecha", "local", "producto"],
    moneyKeys: ["VENTAS"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalVentas = rows.reduce((s, r) => s + (r.VENTAS || 0), 0);
      const totalUni = rows.reduce((s, r) => s + (r.UNIDADES || 0), 0);
      return [
        { label: "Ventas ML total", value: fmtMoney(totalVentas), icon: TrendingUp, color: "#ef4444" },
        { label: "Unidades", value: totalUni.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Productos", value: rows.length, icon: ShoppingBag, color: "#6366f1" },
      ];
    },
  },
  {
    id: "estado-resultado",
    group: "Resultados",
    label: "Estado de Resultado",
    desc: "Ventas por local menos gastos operativos con distribución por porcentaje",
    icon: DollarSign,
    color: "#059669",
    endpoint: null,
    filters: [],
    moneyKeys: [],
    custom: true,
    kpis: () => [],
  },
];

const GROUPS = ["Ventas", "Stock", "Fichas", "Shopping", "MercadoLibre", "Resultados"];

const GROUP_ICONS = {
  Ventas: BarChart3,
  Stock: Package,
  Fichas: Clock,
  Shopping: Store,
  MercadoLibre: TrendingUp,
  Resultados: DollarSign,
};

const GROUP_COLORS = {
  Ventas: "#3b82f6",
  Stock: "#10b981",
  Fichas: "#f97316",
  Shopping: "#7c3aed",
  MercadoLibre: "#f59e0b",
  Resultados: "#059669",
};

// ── Estado de Resultado ──────────────────────────────────────────────────────

function EstadoResultadoView({ localesDisponibles, filterValues, onFilterChange }) {
  const [gastos, setGastos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("erp-estado-resultado-gastos") || "[]"); }
    catch { return []; }
  });
  const [localFilter, setLocalFilter] = useState([]);
  const [queryEnabled, setQueryEnabled] = useState(false);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["informe-ventas-por-local", filterValues.desde, filterValues.hasta, localFilter.join(",")],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterValues.desde) p.set("desde", filterValues.desde);
      if (filterValues.hasta) p.set("hasta", filterValues.hasta);
      if (localFilter.length) p.set("local", localFilter.join(","));
      return api.get(`/informes/ventas-por-local?${p.toString()}`);
    },
    enabled: queryEnabled,
    staleTime: 0,
    retry: false,
  });

  const { data: dataDiario } = useQuery({
    queryKey: ["informe-ventas-diarias", filterValues.desde, filterValues.hasta, localFilter.join(",")],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterValues.desde) p.set("desde", filterValues.desde);
      if (filterValues.hasta) p.set("hasta", filterValues.hasta);
      if (localFilter.length) p.set("local", localFilter.join(","));
      return api.get(`/informes/ventas-diarias?${p.toString()}`);
    },
    enabled: queryEnabled,
    staleTime: 0,
    retry: false,
  });

  const ventasPorLocal = data?.rows || [];
  const locales = ventasPorLocal.map(r => r.LOCAL);
  const totalVentas = ventasPorLocal.reduce((s, r) => s + (r.VENTAS_NETAS || 0), 0);
  const displayLocales = locales.length > 0 ? locales : [];
  const colColors = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#db2777", "#65a30d"];

  const saveGastos = (g) => {
    setGastos(g);
    try { localStorage.setItem("erp-estado-resultado-gastos", JSON.stringify(g)); } catch {}
  };

  const addGasto = () => saveGastos([...gastos, {
    id: Date.now(),
    descripcion: "",
    monto: 0,
    porcentajes: Object.fromEntries((localesDisponibles.length ? localesDisponibles : locales).map(l => [l, 0])),
  }]);

  const updateGasto = (id, field, value) =>
    saveGastos(gastos.map(g => g.id === id ? { ...g, [field]: value } : g));

  const updatePct = (id, local, value) =>
    saveGastos(gastos.map(g => g.id === id
      ? { ...g, porcentajes: { ...g.porcentajes, [local]: parseFloat(value) || 0 } }
      : g
    ));

  const removeGasto = (id) => saveGastos(gastos.filter(g => g.id !== id));

  const gastoAlLocal = (g, local) => g.monto * ((g.porcentajes[local] || 0) / 100);

  const totalGastosPorLocal = Object.fromEntries(
    displayLocales.map(local => [local, gastos.reduce((s, g) => s + gastoAlLocal(g, local), 0)])
  );
  const totalGastosGlobal = gastos.reduce((s, g) => s + (g.monto || 0), 0);

  const resultadoPorLocal = Object.fromEntries(
    displayLocales.map(local => {
      const venta = ventasPorLocal.find(r => r.LOCAL === local)?.VENTAS_NETAS || 0;
      return [local, venta - (totalGastosPorLocal[local] || 0)];
    })
  );
  const resultadoGlobal = totalVentas - totalGastosGlobal;

  const handleConsultar = () => { setQueryEnabled(true); setTimeout(() => refetch(), 50); };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Período</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
            <input type="date" value={filterValues.desde || ""} onChange={e => onFilterChange("desde", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
            <input type="date" value={filterValues.hasta || ""} onChange={e => onFilterChange("hasta", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <MultiLocalSelect value={localFilter} options={localesDisponibles} onChange={setLocalFilter} />
          <div className="flex items-end">
            <button onClick={handleConsultar} disabled={isFetching}
              className="w-full flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all disabled:opacity-60">
              {isFetching
                ? <><Loader2 size={15} className="animate-spin" /> Consultando...</>
                : <><RefreshCw size={15} /> Consultar</>}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error.message}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Gastos Operativos
          </h3>
          <button onClick={addGasto}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus size={13} />
            Agregar Gasto
          </button>
        </div>
        {gastos.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 italic">
            No hay gastos cargados. Presioná "Agregar Gasto" para comenzar.
          </p>
        ) : (
          <div className="space-y-2">
            {gastos.map(g => {
              const sumPct = displayLocales.reduce((s, l) => s + (g.porcentajes[l] || 0), 0);
              const pctOk = displayLocales.length === 0 || Math.abs(sumPct - 100) < 0.5;
              return (
                <div key={g.id} className={`border rounded-lg p-3 ${pctOk ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" value={g.descripcion}
                      onChange={e => updateGasto(g.id, "descripcion", e.target.value)}
                      placeholder="Descripción del gasto"
                      className="flex-1 min-w-[140px] px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <span className="px-2 py-1.5 text-xs text-slate-500 bg-slate-50 border-r border-slate-200">$</span>
                      <input type="number" min="0" value={g.monto || ""}
                        onChange={e => updateGasto(g.id, "monto", parseFloat(e.target.value) || 0)}
                        placeholder="Monto"
                        className="w-32 px-2 py-1.5 text-sm focus:outline-none" />
                    </div>
                    {displayLocales.map(local => (
                      <div key={local} className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white text-xs">
                        <span className="px-2 py-1.5 bg-slate-50 border-r border-slate-200 text-slate-600 font-medium max-w-[72px] truncate" title={local}>
                          {local.length > 8 ? local.slice(0, 8) + "…" : local}
                        </span>
                        <input type="number" min="0" max="100" step="1" value={g.porcentajes[local] ?? ""}
                          onChange={e => updatePct(g.id, local, e.target.value)}
                          placeholder="0"
                          className="w-12 px-1 py-1.5 focus:outline-none text-center" />
                        <span className="px-1.5 py-1.5 text-slate-400">%</span>
                      </div>
                    ))}
                    {displayLocales.length > 0 && !pctOk && (
                      <span className="text-xs font-semibold text-amber-600">⚠ Suma: {sumPct.toFixed(0)}%</span>
                    )}
                    {displayLocales.length === 0 && (
                      <span className="text-xs text-slate-400 italic">Consultá primero para asignar %</span>
                    )}
                    <button onClick={() => removeGasto(g.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {queryEnabled && !isFetching && ventasPorLocal.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold tracking-wide text-base">ESTADO DE RESULTADO</h2>
              <p className="text-slate-400 text-xs mt-0.5">{data?.fecha_desde} al {data?.fecha_hasta}</p>
            </div>
            <DollarSign size={22} className="text-emerald-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide min-w-[200px]">Concepto</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-800 uppercase tracking-wide whitespace-nowrap">TOTAL</th>
                  {displayLocales.map((local, li) => (
                    <th key={local} className="text-right px-4 py-3 text-xs font-bold text-white uppercase tracking-wide whitespace-nowrap"
                      style={{ background: colColors[li % colColors.length] }}>
                      {local}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-emerald-50 border-b border-emerald-200">
                  <td colSpan={2 + displayLocales.length}
                    className="px-4 py-2 text-xs font-bold text-emerald-700 uppercase tracking-widest">
                    ▸ INGRESOS
                  </td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700 font-medium pl-8">Ventas Netas</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">{fmtMoney(totalVentas)}</td>
                  {displayLocales.map(local => {
                    const v = ventasPorLocal.find(r => r.LOCAL === local)?.VENTAS_NETAS || 0;
                    return <td key={local} className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{fmtMoney(v)}</td>;
                  })}
                </tr>
                <tr className="bg-emerald-50/60 border-b-2 border-slate-300">
                  <td className="px-4 py-2.5 pl-8 text-xs font-bold text-slate-600 uppercase">Total Ingresos</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold text-emerald-700">{fmtMoney(totalVentas)}</td>
                  {displayLocales.map(local => {
                    const v = ventasPorLocal.find(r => r.LOCAL === local)?.VENTAS_NETAS || 0;
                    return <td key={local} className="px-4 py-2.5 text-sm text-right font-bold text-emerald-700">{fmtMoney(v)}</td>;
                  })}
                </tr>

                <tr className="bg-red-50 border-b border-red-200">
                  <td colSpan={2 + displayLocales.length}
                    className="px-4 py-2 text-xs font-bold text-red-700 uppercase tracking-widest">
                    ▸ EGRESOS / GASTOS OPERATIVOS
                  </td>
                </tr>
                {gastos.length === 0 ? (
                  <tr className="border-b border-slate-100">
                    <td colSpan={2 + displayLocales.length} className="px-8 py-3 text-xs text-slate-400 italic">
                      Sin gastos cargados — agregá gastos en el panel de arriba
                    </td>
                  </tr>
                ) : gastos.map(g => (
                  <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700 pl-8">
                      {g.descripcion || <span className="text-slate-400 italic text-xs">Sin nombre</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{fmtMoney(g.monto)}</td>
                    {displayLocales.map(local => {
                      const pct = g.porcentajes[local] || 0;
                      const monto = gastoAlLocal(g, local);
                      return (
                        <td key={local} className="px-4 py-3 text-sm text-right text-red-500">
                          <span>{fmtMoney(monto)}</span>
                          <span className="text-xs text-slate-400 ml-1">({pct.toFixed(0)}%)</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-red-50/60 border-b-2 border-slate-300">
                  <td className="px-4 py-2.5 pl-8 text-xs font-bold text-slate-600 uppercase">Total Gastos</td>
                  <td className="px-4 py-2.5 text-sm text-right font-bold text-red-700">{fmtMoney(totalGastosGlobal)}</td>
                  {displayLocales.map(local => (
                    <td key={local} className="px-4 py-2.5 text-sm text-right font-bold text-red-700">
                      {fmtMoney(totalGastosPorLocal[local] || 0)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-slate-800">
                  <td className="px-4 py-3.5 text-sm font-bold text-white uppercase tracking-wide">
                    RESULTADO OPERATIVO
                  </td>
                  <td className={`px-4 py-3.5 text-base text-right font-bold ${resultadoGlobal >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {fmtMoney(resultadoGlobal)}
                  </td>
                  {displayLocales.map(local => (
                    <td key={local} className={`px-4 py-3.5 text-base text-right font-bold ${(resultadoPorLocal[local] || 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {fmtMoney(resultadoPorLocal[local] || 0)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-700 border-b border-slate-600">
                  <td className="px-4 py-2 text-xs text-slate-400 pl-8">Margen sobre ventas</td>
                  <td className="px-4 py-2 text-xs text-right font-bold text-slate-200">
                    {totalVentas > 0 ? `${((resultadoGlobal / totalVentas) * 100).toFixed(1)}%` : "—"}
                  </td>
                  {displayLocales.map(local => {
                    const v = ventasPorLocal.find(r => r.LOCAL === local)?.VENTAS_NETAS || 0;
                    const res = resultadoPorLocal[local] || 0;
                    return (
                      <td key={local} className="px-4 py-2 text-xs text-right font-bold text-slate-200">
                        {v > 0 ? `${((res / v) * 100).toFixed(1)}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(!queryEnabled || isFetching) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center">
          {isFetching ? (
            <>
              <Loader2 size={40} className="animate-spin mb-3 text-emerald-600" />
              <p className="text-sm text-slate-500">Consultando ventas por local...</p>
            </>
          ) : (
            <>
              <div className="rounded-full p-5 mb-4 bg-emerald-50">
                <DollarSign size={36} className="text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">Estado de Resultado</h3>
              <p className="text-sm text-slate-400 text-center max-w-sm">
                Seleccioná el período, cargá los gastos operativos y presioná Consultar para generar el informe
              </p>
            </>
          )}
        </div>
      )}

      {queryEnabled && !isFetching && dataDiario?.rows?.length > 0 && (() => {
        const rowsDiario = dataDiario.rows;
        const dias = [...new Set(rowsDiario.map(r => r.FECHA))].sort((a, b) => b.localeCompare(a));
        const localesDiario = [...new Set(rowsDiario.map(r => r.LOCAL))].sort();
        const byDiaLocal = {};
        rowsDiario.forEach(r => {
          if (!byDiaLocal[r.FECHA]) byDiaLocal[r.FECHA] = {};
          byDiaLocal[r.FECHA][r.LOCAL] = r;
        });
        const colColors = ["#2563eb","#059669","#7c3aed","#d97706","#dc2626","#0891b2","#db2777","#65a30d"];
        const totalVentasDiario = rowsDiario.reduce((s, r) => s + (r.VENTAS_NETAS || 0), 0);
        const totalCantDiario = rowsDiario.reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
        const totalTicketsDiario = rowsDiario.reduce((s, r) => s + (r.TICKETS || 0), 0);
        const totalNCDiario = rowsDiario.reduce((s, r) => s + (r.NOTAS_CREDITO || 0), 0);

        const exportDiario = () => {
          const exportRows = dias.map(dia => {
            const row = { FECHA: dia };
            let totalVentas = 0, totalCant = 0, totalTk = 0, totalNC = 0;
            localesDiario.forEach(loc => {
              const d = byDiaLocal[dia]?.[loc];
              row[`${loc}_VENTAS`] = d?.VENTAS_NETAS ?? 0;
              row[`${loc}_CANT`] = d?.CANTIDAD_VENDIDA ?? 0;
              row[`${loc}_TICKETS`] = d?.TICKETS ?? 0;
              totalVentas += d?.VENTAS_NETAS ?? 0;
              totalCant += d?.CANTIDAD_VENDIDA ?? 0;
              totalTk += d?.TICKETS ?? 0;
              totalNC += d?.NOTAS_CREDITO ?? 0;
            });
            row.TOTAL_VENTAS = totalVentas;
            row.TOTAL_CANT = totalCant;
            row.TOTAL_TICKETS = totalTk;
            row.NOTAS_CREDITO = totalNC;
            return row;
          });
          exportToExcel(exportRows, "detalle-diario");
        };

        return (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold tracking-wide text-base flex items-center gap-2">
                  <Calendar size={17} className="text-sky-400" />
                  DETALLE DÍA A DÍA
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">{dataDiario.fecha_desde} al {dataDiario.fecha_hasta} · {dias.length} días</p>
              </div>
              <button
                onClick={exportDiario}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-600 rounded-lg hover:bg-emerald-900/30 transition-colors"
              >
                <Download size={13} />
                Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-200">
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wide min-w-[100px] sticky left-0 bg-slate-100 z-10">Fecha</th>
                    {localesDiario.map((loc, li) => (
                      <th key={loc} colSpan={3} className="text-center px-2 py-2.5 text-xs font-bold text-white uppercase tracking-wide whitespace-nowrap border-l border-white/20"
                        style={{ background: colColors[li % colColors.length] }}>
                        {loc}
                      </th>
                    ))}
                    <th colSpan={4} className="text-center px-2 py-2.5 text-xs font-bold text-white uppercase tracking-wide bg-slate-800 border-l border-white/20">TOTAL DÍA</th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-1.5 sticky left-0 bg-slate-50 z-10"></th>
                    {localesDiario.map((loc, li) => (
                      <>
                        <th key={`${loc}-v`} className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-600 whitespace-nowrap border-l" style={{ borderColor: colColors[li % colColors.length] + "40" }}>Ventas</th>
                        <th key={`${loc}-c`} className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-600 whitespace-nowrap">Unid.</th>
                        <th key={`${loc}-t`} className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-600 whitespace-nowrap">Tkt.</th>
                      </>
                    ))}
                    <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap border-l border-slate-300">Ventas</th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">Unid.</th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">Tkt.</th>
                    <th className="text-right px-2 py-1.5 text-[10px] font-semibold text-slate-700 whitespace-nowrap">NC</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((dia, idx) => {
                    const diaData = byDiaLocal[dia] || {};
                    const totalDiaVentas = localesDiario.reduce((s, l) => s + (diaData[l]?.VENTAS_NETAS ?? 0), 0);
                    const totalDiaCant = localesDiario.reduce((s, l) => s + (diaData[l]?.CANTIDAD_VENDIDA ?? 0), 0);
                    const totalDiaTk = localesDiario.reduce((s, l) => s + (diaData[l]?.TICKETS ?? 0), 0);
                    const totalDiaNC = localesDiario.reduce((s, l) => s + (diaData[l]?.NOTAS_CREDITO ?? 0), 0);
                    const diaSemana = new Date(dia + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short" });
                    return (
                      <tr key={dia} className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        <td className={`px-3 py-2 font-semibold whitespace-nowrap sticky left-0 z-10 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <span className="text-slate-800">{dia}</span>
                          <span className="ml-1.5 text-[10px] text-slate-400 uppercase">{diaSemana}</span>
                        </td>
                        {localesDiario.map((loc, li) => {
                          const d = diaData[loc];
                          return (
                            <>
                              <td key={`${loc}-v`} className="px-2 py-2 text-right text-emerald-700 font-medium whitespace-nowrap border-l" style={{ borderColor: colColors[li % colColors.length] + "30" }}>
                                <FmtCell val={d?.VENTAS_NETAS} money={true} />
                              </td>
                              <td key={`${loc}-c`} className="px-2 py-2 text-right text-slate-600 whitespace-nowrap">
                                <FmtCell val={d?.CANTIDAD_VENDIDA} />
                              </td>
                              <td key={`${loc}-t`} className="px-2 py-2 text-right text-slate-500 whitespace-nowrap">
                                <FmtCell val={d?.TICKETS} />
                              </td>
                            </>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-bold text-emerald-800 whitespace-nowrap border-l border-slate-200">{fmtMoney(totalDiaVentas)}</td>
                        <td className="px-2 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">{fmt(totalDiaCant)}</td>
                        <td className="px-2 py-2 text-right text-slate-600 whitespace-nowrap">{fmt(totalDiaTk)}</td>
                        <td className="px-2 py-2 text-right text-red-500 whitespace-nowrap">{totalDiaNC > 0 ? fmt(totalDiaNC) : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-700 to-slate-800 border-t-2 border-slate-500">
                    <td className="px-3 py-2.5 text-xs font-bold text-white uppercase tracking-wide sticky left-0 bg-slate-800 z-10">TOTAL</td>
                    {localesDiario.map((loc) => {
                      const locVentas = rowsDiario.filter(r => r.LOCAL === loc).reduce((s, r) => s + (r.VENTAS_NETAS || 0), 0);
                      const locCant = rowsDiario.filter(r => r.LOCAL === loc).reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
                      const locTk = rowsDiario.filter(r => r.LOCAL === loc).reduce((s, r) => s + (r.TICKETS || 0), 0);
                      return (
                        <>
                          <td key={`${loc}-v`} className="px-2 py-2.5 text-right font-bold text-emerald-300 whitespace-nowrap border-l border-white/20">{fmtMoney(locVentas)}</td>
                          <td key={`${loc}-c`} className="px-2 py-2.5 text-right font-bold text-white whitespace-nowrap">{fmt(locCant)}</td>
                          <td key={`${loc}-t`} className="px-2 py-2.5 text-right text-slate-300 whitespace-nowrap">{fmt(locTk)}</td>
                        </>
                      );
                    })}
                    <td className="px-2 py-2.5 text-right font-bold text-emerald-300 whitespace-nowrap border-l border-white/20">{fmtMoney(totalVentasDiario)}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-white whitespace-nowrap">{fmt(totalCantDiario)}</td>
                    <td className="px-2 py-2.5 text-right text-slate-300 whitespace-nowrap">{fmt(totalTicketsDiario)}</td>
                    <td className="px-2 py-2.5 text-right text-red-300 whitespace-nowrap">{fmt(totalNCDiario)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function InformesPage() {
  const [activeId, setActiveId] = useState("ventas-agrupadas");
  const [filterValues, setFilterValues] = useState({
    desde: firstOfMonth(),
    hasta: today(),
  });
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({ Ventas: false, Stock: false, Fichas: false, Shopping: false, Resultados: false });

  const toggleGroup = (group) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const report = REPORTS.find(r => r.id === activeId);

  // Locales para el select
  const { data: locales = [] } = useQuery({
    queryKey: ["informes-locales"],
    queryFn: () => api.get("/informes/locales-disponibles"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ["informes-marcas"],
    queryFn: () => api.get("/informes/marcas-disponibles"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: proveedores = [] } = useQuery({
    queryKey: ["informes-proveedores"],
    queryFn: () => api.get("/informes/proveedores-disponibles"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Construir params
  const buildParams = useCallback(() => {
    if (!report) return "";
    const p = new URLSearchParams();
    if (filterValues.desde) p.set("desde", filterValues.desde);
    if (filterValues.hasta) p.set("hasta", filterValues.hasta);
    if (filterValues.local) {
      const localStr = Array.isArray(filterValues.local) ? filterValues.local.join(",") : filterValues.local;
      if (localStr) p.set("local", localStr);
    }
    if (filterValues.marca) p.set("marca", filterValues.marca);
    if (filterValues.proveedor) p.set("proveedor", filterValues.proveedor);
    if (filterValues.codigo_articulo) p.set("codigo_articulo", filterValues.codigo_articulo);
    if (filterValues.medio_pago) p.set("medio_pago", filterValues.medio_pago);
    if (filterValues.codigo_promo) p.set("codigo_promo", filterValues.codigo_promo);
    if (filterValues.categoria) p.set("categoria", filterValues.categoria);
    if (filterValues.producto) p.set("producto", filterValues.producto);
    if (filterValues.dias_sin_movimiento) p.set("dias", filterValues.dias_sin_movimiento);
    if (filterValues.unificar_dias) p.set("unificar_dias", "true");
    if (filterValues.desglose_local) p.set("desglose_local", "true");
    return p.toString();
  }, [report, filterValues]);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["informe", activeId, filterValues],
    queryFn: () => {
      const params = buildParams();
      return api.get(`${report.endpoint}${params ? "?" + params : ""}`);
    },
    enabled: queryEnabled && !!report?.endpoint,
    staleTime: 0,
    retry: false,
  });

  const handleFilterChange = (key, val) => {
    setFilterValues(prev => ({ ...prev, [key]: val }));
    setQueryEnabled(false);
  };

  const handleSelectReport = (id) => {
    setActiveId(id);
    setQueryEnabled(false);
    setFilterValues({ desde: firstOfMonth(), hasta: today() });
  };

  const handleRun = () => {
    setQueryEnabled(true);
    setTimeout(() => refetch(), 50);
  };

  // Columnas que no deben mostrarse en ninguna tabla de informes
  const COLS_TO_HIDE = new Set(["VENDEDOR"]);
  const stripHiddenCols = (r) => {
    const clean = { ...r };
    COLS_TO_HIDE.forEach(col => delete clean[col]);
    return clean;
  };

  const rows = (data?.rows || []).map(r => {
    const cleaned = (r.MARCA !== undefined && (r.MARCA === null || r.MARCA === "" || String(r.MARCA).trim() === ""))
      ? { ...r, MARCA: "SIN MARCA" }
      : r;
    return stripHiddenCols(cleaned);
  });
  const pct = parseFloat(filterValues.porcentaje) || 0;
  const displayRows = (report?.id === "declaracion-shopping" && pct > 0)
    ? rows.map(r => ({ ...r, MONTO_A_PAGAR: Math.round((r.MONTO_VENDIDO || 0) * pct / 100) }))
    : rows;
  const kpis = report?.kpis(displayRows) || [];

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden -m-4 lg:-m-6 -mb-32 -mt-2">
      {/* ── Sidebar de informes ── */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-hidden flex-shrink-0 shadow-sm">
        {/* Header sidebar */}
        <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="flex items-center gap-2">
            <FileBarChart size={20} className="text-sky-400" />
            <span className="text-white font-bold text-sm">Centro de Informes</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">Snapshot local · Actualiza cada 15 min</p>
        </div>

        {/* Snapshot status indicator */}
        <SnapshotStatusBadge />

        {/* Groups + reports */}
        <div className="overflow-y-auto flex-1 py-2">
          {GROUPS.map(group => {
            const groupReports = REPORTS.filter(r => r.group === group);
            const GroupIcon = GROUP_ICONS[group];
            const groupColor = GROUP_COLORS[group];
            const isCollapsible = group in collapsedGroups;
            const isCollapsed = collapsedGroups[group];
            return (
              <div key={group} className="mb-1">
                <button
                  onClick={() => isCollapsible && toggleGroup(group)}
                  className={`w-full flex items-center gap-2 px-3 py-2 mt-1 ${isCollapsible ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}
                >
                  <GroupIcon size={13} style={{ color: groupColor }} />
                  <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left" style={{ color: groupColor }}>
                    {group}
                  </span>
                  {isCollapsible && (
                    isCollapsed
                      ? <ChevronRight size={12} style={{ color: groupColor }} />
                      : <ChevronDown size={12} style={{ color: groupColor }} />
                  )}
                </button>
                {!isCollapsed && groupReports.map(rep => (
                  <button
                    key={rep.id}
                    onClick={() => handleSelectReport(rep.id)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-all ${
                      activeId === rep.id
                        ? "bg-slate-100 border-r-2 border-slate-700"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <rep.icon size={14} style={{ color: rep.color, flexShrink: 0 }} />
                    <span className={`text-xs truncate ${activeId === rep.id ? "text-slate-900 font-semibold" : "text-slate-600"}`}>
                      {rep.label}
                    </span>
                    {activeId === rep.id && <ChevronRight size={12} className="ml-auto text-slate-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Panel principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {report && (
                <div className="rounded-xl p-2.5" style={{ background: report.color + "15" }}>
                  <report.icon size={22} style={{ color: report.color }} />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-slate-800">{report?.label}</h1>
                <p className="text-xs text-slate-500">{report?.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeId !== "estado-resultado" && <>
              {rows.length > 0 && (
                <button
                  onClick={() => exportToExcel(displayRows, report?.id || "informe")}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Download size={15} />
                  Exportar Excel
                </button>
              )}
              <button
                onClick={handleRun}
                disabled={isFetching}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60"
                style={{ background: report?.color || "#3b82f6" }}
              >
                {isFetching
                  ? <><Loader2 size={15} className="animate-spin" /> Consultando...</>
                  : <><RefreshCw size={15} /> Consultar</>
                }
              </button>
              </>}
            </div>
          </div>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto scrollbar-visible p-6">
          {activeId === "estado-resultado" ? (
            <EstadoResultadoView
              localesDisponibles={locales}
              filterValues={filterValues}
              onFilterChange={handleFilterChange}
            />
          ) : (<>
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Filtros</h3>
            {report && (
              <FilterPanel
                filters={report.filters}
                values={filterValues}
                onChange={handleFilterChange}
                locales={locales}
                marcas={marcas}
                proveedores={proveedores}
              />
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => handleFilterChange("desde", firstOfMonth()) || handleFilterChange("hasta", today())}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Este mes
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => {
                  const d = new Date();
                  const desde = localDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
                  const hasta = localDate(new Date(d.getFullYear(), d.getMonth(), 0));
                  setFilterValues(prev => ({ ...prev, desde, hasta }));
                  setQueryEnabled(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Mes anterior
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => {
                  const t = today();
                  setFilterValues(prev => ({ ...prev, desde: t, hasta: t }));
                  setQueryEnabled(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Hoy
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const y = localDate(d);
                  setFilterValues(prev => ({ ...prev, desde: y, hasta: y }));
                  setQueryEnabled(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Ayer
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Error al consultar</p>
                <p className="text-xs text-red-600 mt-1">{error.message}</p>
              </div>
            </div>
          )}

          {/* KPIs */}
          {kpis.length > 0 && (
            <div className={`grid ${kpis.length === 6 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"} gap-3 mb-4`}>
              {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
            </div>
          )}

          {/* Nota explicativa del informe */}
          {kpis.length > 0 && report?.note && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
              <AlertCircle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">{report.note}</p>
            </div>
          )}

          {/* Tabla */}
          {!queryEnabled && !isFetching && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center">
              <div className="rounded-full p-5 mb-4" style={{ background: (report?.color || "#3b82f6") + "15" }}>
                {report && <report.icon size={36} style={{ color: report?.color }} />}
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">
                Configurá los filtros y presioná Consultar
              </h3>
              <p className="text-sm text-slate-400">{report?.desc}</p>
            </div>
          )}

          {isFetching && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center">
              <Loader2 size={40} className="animate-spin mb-3" style={{ color: report?.color }} />
              <p className="text-sm text-slate-500">Consultando SQL Server...</p>
            </div>
          )}

          {queryEnabled && !isFetching && data && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">
                  Resultados
                  {data.fecha_desde && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {data.fecha_desde} → {data.fecha_hasta}
                    </span>
                  )}
                </h3>
                {rows.length > 0 && (
                  <button
                    onClick={() => exportToExcel(displayRows, report?.id || "informe")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Download size={12} />
                    .xlsx
                  </button>
                )}
              </div>
              {report?.id === "declaracion-shopping" && pct > 0 && (
                <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-2">
                  <span className="text-xs font-semibold text-violet-700">Porcentaje aplicado: {pct}%</span>
                  <span className="text-xs text-violet-400">· MONTO_A_PAGAR = MONTO_VENDIDO × {pct}%</span>
                </div>
              )}
              <DataTable rows={displayRows} moneyKeys={report?.moneyKeys} />
              {report?.id === "ventas-marca" && rows.length > 0 && (() => {
                const BAR_COLORS = ["#f59e0b","#3b82f6","#10b981","#ef4444","#a855f7","#06b6d4","#f97316","#84cc16","#ec4899","#6366f1"];
                const isDesglose = data?.desglose_local && rows.some(r => r.LOCAL);
                if (isDesglose) {
                  const localesList = [...new Set(rows.map(r => r.LOCAL).filter(Boolean))].sort();
                  const byMarca = rows.reduce((acc, r) => {
                    const m = r.MARCA || "SIN MARCA";
                    if (!acc[m]) acc[m] = { name: m };
                    acc[m][r.LOCAL] = (acc[m][r.LOCAL] || 0) + (r.MONTO_VENDIDO || 0);
                    return acc;
                  }, {});
                  const chartData = Object.values(byMarca).sort((a, b) => {
                    const ta = localesList.reduce((s, l) => s + (a[l] || 0), 0);
                    const tb = localesList.reduce((s, l) => s + (b[l] || 0), 0);
                    return tb - ta;
                  });
                  return (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h4 className="text-sm font-bold text-slate-700 mb-4">Ventas por Marca y Local</h4>
                      <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 40)}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })} />
                          <Legend />
                          {localesList.map((loc, i) => (
                            <Bar key={loc} dataKey={loc} stackId="a" fill={BAR_COLORS[i % BAR_COLORS.length]} radius={i === localesList.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                }
                const barData = [...rows]
                  .sort((a, b) => (b.MONTO_VENDIDO || 0) - (a.MONTO_VENDIDO || 0))
                  .map((r, i) => ({ name: r.MARCA || "SIN MARCA", value: r.MONTO_VENDIDO || 0, fill: BAR_COLORS[i % BAR_COLORS.length] }));
                return (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 mb-4">Totales por Marca</h4>
                    <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 36)}>
                      <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
              {report?.id === "medio-pago" && rows.length > 0 && (() => {
                const PIE_COLORS = ["#a855f7","#06b6d4","#10b981","#f59e0b","#ef4444","#3b82f6","#f97316","#84cc16","#ec4899","#6366f1"];
                const pieData = Object.values(
                  rows.reduce((acc, r) => {
                    const key = r.MEDIO_PAGO || "Sin especificar";
                    if (!acc[key]) acc[key] = { name: key, value: 0 };
                    acc[key].value += r.MONTO_VENDIDO || 0;
                    return acc;
                  }, {})
                ).sort((a, b) => b.value - a.value);
                return (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 mb-4">Distribución por Medio de Pago</h4>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`} labelLine={true}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
              {report?.id === "ventas-categoria" && rows.length > 0 && (() => {
                const PIE_COLORS = ["#14b8a6","#f59e0b","#6366f1","#ef4444","#10b981","#f97316"];
                const pieData = Object.values(
                  rows.reduce((acc, r) => {
                    const key = r.CATEGORIA || "OTROS";
                    if (!acc[key]) acc[key] = { name: key, value: 0 };
                    acc[key].value += r.MONTO_VENDIDO || 0;
                    return acc;
                  }, {})
                ).sort((a, b) => b.value - a.value);
                return (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 mb-4">Distribución por Categoría</h4>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`} labelLine={true}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => v.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
