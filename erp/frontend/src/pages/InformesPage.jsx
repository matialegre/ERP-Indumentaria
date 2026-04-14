import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import * as XLSX from "xlsx";
import {
  BarChart3, Users, ShoppingBag, Tag, Package,
  CreditCard, TrendingUp, Store, Calendar, Download,
  Search, RefreshCw, ChevronRight, FileBarChart,
  AlertCircle, Loader2, ArrowUpDown, ShoppingCart,
  Star, Clock,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function fmt(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") {
    if (Number.isInteger(val)) return val.toLocaleString("es-AR");
    return val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(val);
}

function fmtMoney(val) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val);
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
        <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Tabla genérica ────────────────────────────────────────────────────────────

function DataTable({ rows, moneyKeys = [], highlight = null }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

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

  return (
    <div>
      <div className="mb-3 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar en resultados..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <p className="text-xs text-slate-400 mb-2">{data.length} filas{search && ` (filtrado de ${rows.length})`}</p>
      <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm" style={{ maxHeight: "480px" }}>
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800">
              {cols.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-3 py-3 text-left text-white font-semibold cursor-pointer hover:bg-white/10 transition-colors whitespace-nowrap select-none"
                >
                  <span className="flex items-center gap-1">
                    {col.replace(/_/g, " ")}
                    <ArrowUpDown size={10} className="opacity-50" />
                  </span>
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
                  <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {moneyKeys.includes(col)
                      ? <span className="font-semibold text-emerald-700">{fmtMoney(row[col])}</span>
                      : <span>{fmt(row[col])}</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Panel de filtros ──────────────────────────────────────────────────────────

function FilterPanel({ filters, values, onChange, locales }) {
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Local</label>
          <select value={values.local || ""} onChange={e => onChange("local", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Todos los locales</option>
            {locales.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}
      {filters.includes("vendedor") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Vendedor</label>
          <input type="text" value={values.vendedor || ""} onChange={e => onChange("vendedor", e.target.value)}
            placeholder="Nombre del vendedor"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("marca") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
          <input type="text" value={values.marca || ""} onChange={e => onChange("marca", e.target.value)}
            placeholder="Ej: COLUMBIA"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      {filters.includes("proveedor") && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
          <input type="text" value={values.proveedor || ""} onChange={e => onChange("proveedor", e.target.value)}
            placeholder="Nombre proveedor"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
    </div>
  );
}

// ── Definición de informes ────────────────────────────────────────────────────

const REPORTS = [
  {
    id: "empleados",
    group: "Empleados",
    label: "Evaluación de Empleados",
    desc: "Tickets y artículos por día y vendedor",
    icon: Users,
    color: "#6366f1",
    endpoint: "/informes/empleados",
    filters: ["fecha", "local", "vendedor"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const totalTickets = rows.reduce((s, r) => s + (r.TOTAL_TICKETS || 0), 0);
      const totalArt = rows.reduce((s, r) => s + (r.TOTAL_ARTICULOS || 0), 0);
      const vendedores = [...new Set(rows.map(r => r.VENDEDOR))].length;
      const promGlobal = totalTickets > 0 ? (totalArt / totalTickets).toFixed(2) : "0";
      return [
        { label: "Total tickets", value: totalTickets.toLocaleString("es-AR"), icon: ShoppingCart, color: "#6366f1" },
        { label: "Total artículos", value: totalArt.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Vendedores activos", value: vendedores, icon: Users, color: "#f59e0b" },
        { label: "Prom. arts/ticket", value: promGlobal, icon: Star, color: "#ec4899" },
      ];
    },
  },
  {
    id: "ventas-agrupadas",
    group: "Ventas",
    label: "Ventas por Día y Local",
    desc: "Monto, cantidad y facturas por día",
    icon: BarChart3,
    color: "#3b82f6",
    endpoint: "/informes/ventas-agrupadas",
    filters: ["fecha", "local"],
    moneyKeys: ["MONTO_VENDIDO"],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.MONTO_VENDIDO || 0), 0);
      const cant = rows.reduce((s, r) => s + (r.CANTIDAD_VENDIDA || 0), 0);
      const facts = rows.reduce((s, r) => s + (r.CANTIDAD_FACTURAS || 0), 0);
      return [
        { label: "Monto total", value: fmtMoney(total), icon: TrendingUp, color: "#3b82f6" },
        { label: "Artículos vendidos", value: cant.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Facturas emitidas", value: facts.toLocaleString("es-AR"), icon: FileBarChart, color: "#f59e0b" },
      ];
    },
  },
  {
    id: "articulos-por-ticket",
    group: "Ventas",
    label: "Artículos por Ticket",
    desc: "Detalle de artículos por comprobante y vendedor",
    icon: ShoppingCart,
    color: "#8b5cf6",
    endpoint: "/informes/articulos-por-ticket",
    filters: ["fecha", "local", "min_articulos"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const tickets = rows.length;
      const totalArt = rows.reduce((s, r) => s + (r.CANTIDAD_ARTICULOS || 0), 0);
      const multi = rows.filter(r => (r.CANTIDAD_ARTICULOS || 0) > 1).length;
      return [
        { label: "Tickets", value: tickets.toLocaleString("es-AR"), icon: ShoppingCart, color: "#8b5cf6" },
        { label: "Total artículos", value: totalArt.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Con +1 artículo", value: multi.toLocaleString("es-AR"), icon: Star, color: "#f59e0b" },
      ];
    },
  },
  {
    id: "ventas-vendedor",
    group: "Ventas",
    label: "Ventas por Vendedor",
    desc: "Artículos vendidos por marca y vendedor",
    icon: Users,
    color: "#10b981",
    endpoint: "/informes/ventas-vendedor",
    filters: ["fecha", "local", "marca", "codigo_articulo"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.TOTAL_VENDIDO || 0), 0);
      const vendedores = [...new Set(rows.map(r => r.VENDEDOR))].length;
      const marcas = [...new Set(rows.map(r => r.MARCA))].length;
      return [
        { label: "Total vendido", value: total.toLocaleString("es-AR"), icon: Package, color: "#10b981" },
        { label: "Vendedores", value: vendedores, icon: Users, color: "#6366f1" },
        { label: "Marcas", value: marcas, icon: Tag, color: "#f59e0b" },
      ];
    },
  },
  {
    id: "ventas-marca",
    group: "Ventas",
    label: "Ventas por Marca",
    desc: "Cantidad vendida y monto por marca y local",
    icon: Tag,
    color: "#f59e0b",
    endpoint: "/informes/ventas-marca",
    filters: ["fecha", "local", "marca", "proveedor"],
    moneyKeys: ["MONTO_VENDIDO"],
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
    desc: "Ranking de artículos más vendidos por local",
    icon: ShoppingBag,
    color: "#ec4899",
    endpoint: "/informes/ventas-articulo",
    filters: ["fecha", "local", "marca"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.TOTAL_VENDIDO || 0), 0);
      const articulos = [...new Set(rows.map(r => r.CODIGO_ARTICULO))].length;
      return [
        { label: "Total vendido", value: total.toLocaleString("es-AR"), icon: Package, color: "#ec4899" },
        { label: "Artículos distintos", value: articulos, icon: ShoppingBag, color: "#6366f1" },
      ];
    },
  },
  {
    id: "ventas-promo",
    group: "Ventas",
    label: "Ventas con Código Promo",
    desc: "Ventas detalladas con código de promoción",
    icon: Tag,
    color: "#06b6d4",
    endpoint: "/informes/ventas-promo",
    filters: ["fecha", "local", "marca", "codigo_articulo"],
    moneyKeys: [],
    kpis: (rows) => {
      if (!rows?.length) return [];
      const total = rows.reduce((s, r) => s + (r.TOTAL_CANTIDAD || 0), 0);
      const conPromo = rows.filter(r => r.CODIGOPROMOCION).length;
      return [
        { label: "Total cantidad", value: total.toLocaleString("es-AR"), icon: Package, color: "#06b6d4" },
        { label: "Líneas con promo", value: conPromo, icon: Tag, color: "#f59e0b" },
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
];

const GROUPS = ["Empleados", "Ventas", "Stock", "Fichas", "MercadoLibre"];

const GROUP_ICONS = {
  Empleados: Users,
  Ventas: BarChart3,
  Stock: Package,
  Fichas: Clock,
  MercadoLibre: TrendingUp,
};

const GROUP_COLORS = {
  Empleados: "#6366f1",
  Ventas: "#3b82f6",
  Stock: "#10b981",
  Fichas: "#f97316",
  MercadoLibre: "#f59e0b",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function InformesPage() {
  const [activeId, setActiveId] = useState("empleados");
  const [filterValues, setFilterValues] = useState({
    desde: firstOfMonth(),
    hasta: today(),
  });
  const [queryEnabled, setQueryEnabled] = useState(false);

  const report = REPORTS.find(r => r.id === activeId);

  // Locales para el select
  const { data: locales = [] } = useQuery({
    queryKey: ["informes-locales"],
    queryFn: () => api.get("/informes/locales-disponibles"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Construir params
  const buildParams = useCallback(() => {
    if (!report) return "";
    const p = new URLSearchParams();
    if (filterValues.desde) p.set("desde", filterValues.desde);
    if (filterValues.hasta) p.set("hasta", filterValues.hasta);
    if (filterValues.local) p.set("local", filterValues.local);
    if (filterValues.vendedor) p.set("vendedor", filterValues.vendedor);
    if (filterValues.marca) p.set("marca", filterValues.marca);
    if (filterValues.proveedor) p.set("proveedor", filterValues.proveedor);
    if (filterValues.min_articulos) p.set("min_articulos", filterValues.min_articulos);
    if (filterValues.codigo_articulo) p.set("codigo_articulo", filterValues.codigo_articulo);
    if (filterValues.medio_pago) p.set("medio_pago", filterValues.medio_pago);
    if (filterValues.categoria) p.set("categoria", filterValues.categoria);
    if (filterValues.producto) p.set("producto", filterValues.producto);
    return p.toString();
  }, [report, filterValues]);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["informe", activeId, filterValues],
    queryFn: () => {
      const params = buildParams();
      return api.get(`${report.endpoint}${params ? "?" + params : ""}`);
    },
    enabled: queryEnabled,
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

  const rows = data?.rows || [];
  const kpis = report?.kpis(rows) || [];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar de informes ── */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-hidden flex-shrink-0 shadow-sm">
        {/* Header sidebar */}
        <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="flex items-center gap-2">
            <FileBarChart size={20} className="text-sky-400" />
            <span className="text-white font-bold text-sm">Centro de Informes</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">SQL Server · Tiempo real</p>
        </div>

        {/* Groups + reports */}
        <div className="overflow-y-auto flex-1 py-2">
          {GROUPS.map(group => {
            const groupReports = REPORTS.filter(r => r.group === group);
            const GroupIcon = GROUP_ICONS[group];
            const groupColor = GROUP_COLORS[group];
            return (
              <div key={group} className="mb-1">
                <div className="flex items-center gap-2 px-3 py-2 mt-1">
                  <GroupIcon size={13} style={{ color: groupColor }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: groupColor }}>
                    {group}
                  </span>
                </div>
                {groupReports.map(rep => (
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
              {rows.length > 0 && (
                <button
                  onClick={() => exportToExcel(rows, report?.id || "informe")}
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
            </div>
          </div>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Filtros</h3>
            {report && (
              <FilterPanel
                filters={report.filters}
                values={filterValues}
                onChange={handleFilterChange}
                locales={locales}
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
                  const desde = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
                  const hasta = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
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
                    onClick={() => exportToExcel(rows, report?.id || "informe")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Download size={12} />
                    .xlsx
                  </button>
                )}
              </div>
              <DataTable rows={rows} moneyKeys={report?.moneyKeys} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
