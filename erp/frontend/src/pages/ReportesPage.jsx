import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  BarChart3, TrendingUp, FileText, Package, AlertTriangle,
  Clock, Loader2, ShoppingCart, DollarSign, CheckCircle,
  XCircle, Building2, Database, BarChart2,
} from "lucide-react";

/* ── Constants ──────────────────────────────────────── */
const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

const STATUS_COLOR_MAP = {
  BORRADOR: "#9ca3af",
  ENVIADO: "#3b82f6",
  RECIBIDO: "#f59e0b",
  COMPLETADO: "#10b981",
  ANULADO: "#ef4444",
  VERDE: "#10b981",
  AMARILLO: "#f59e0b",
  ROJO: "#ef4444",
  POR_PAGAR: "#3b82f6",
  PARCIAL: "#8b5cf6",
  PAGADO: "#10b981",
  VENCIDO: "#ef4444",
};

/* ── Helpers ──────────────────────────────────────── */
const fmtNum = (n) => new Intl.NumberFormat("es-AR").format(n || 0);
const fmtCur = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";

/* ── Reusable Components ────────────────────────────── */
function StatCard({ title, value, sub, icon: Icon, colorClass = "bg-blue-50 text-blue-700 border-blue-200" }) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{title}</span>
        {Icon && <Icon size={18} className="opacity-50" />}
      </div>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      {title && <h3 className="font-semibold text-sm text-gray-700 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function EmptyState({ text = "Sin datos" }) {
  return <p className="text-sm text-gray-400 text-center py-10">{text}</p>;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  );
}

function StatusBadge({ status }) {
  const colorMap = {
    BORRADOR: "bg-gray-100 text-gray-600",
    ENVIADO: "bg-blue-100 text-blue-700",
    RECIBIDO: "bg-amber-100 text-amber-700",
    COMPLETADO: "bg-green-100 text-green-700",
    ANULADO: "bg-red-100 text-red-600",
    POR_PAGAR: "bg-blue-100 text-blue-700",
    PARCIAL: "bg-purple-100 text-purple-700",
    PAGADO: "bg-green-100 text-green-700",
    VENCIDO: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

/* ── Section: Pedidos de Compra ─────────────────────── */
function PedidosSection({ data, isLoading }) {
  const orders = data?.items ?? [];

  const byStatus = useMemo(() => {
    const counts = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const byType = useMemo(() => {
    const counts = {};
    orders.forEach((o) => { const t = o.type || "SIN TIPO"; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const byProvider = useMemo(() => {
    const counts = {};
    orders.forEach((o) => { const n = o.provider_name || "Sin proveedor"; counts[n] = (counts[n] || 0) + 1; });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [orders]);

  const recent = useMemo(() =>
    [...orders].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 20),
    [orders]);

  const countByStatus = (s) => orders.filter((o) => o.status === s).length;

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total pedidos" value={fmtNum(orders.length)} icon={ShoppingCart} colorClass="bg-blue-50 text-blue-700 border-blue-200" />
        <StatCard title="Enviados" value={fmtNum(countByStatus("ENVIADO"))} icon={TrendingUp} colorClass="bg-indigo-50 text-indigo-700 border-indigo-200" />
        <StatCard title="Recibidos" value={fmtNum(countByStatus("RECIBIDO"))} icon={CheckCircle} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
        <StatCard title="Completados" value={fmtNum(countByStatus("COMPLETADO"))} icon={CheckCircle} colorClass="bg-green-50 text-green-700 border-green-200" />
        <StatCard title="Anulados" value={fmtNum(countByStatus("ANULADO"))} icon={XCircle} colorClass="bg-red-50 text-red-700 border-red-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Por estado">
          {byStatus.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStatus} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v) => [`${v} pedidos`, "Cantidad"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byStatus.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLOR_MAP[d.label] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Por tipo">
          {byType.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byType} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v) => [`${v} pedidos`, "Cantidad"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byType.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel title="Top 10 proveedores por cantidad de pedidos">
        {byProvider.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={Math.max(220, byProvider.length * 38)}>
            <BarChart data={byProvider} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={140} />
              <Tooltip formatter={(v) => [`${v} pedidos`, "Cantidad"]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byProvider.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Pedidos recientes (últimos 20)">
        {recent.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Número</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Estado</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Proveedor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Local</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Importe</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{o.np_number || `NP-${o.id}`}</td>
                    <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{o.type || "—"}</td>
                    <td className="px-4 py-2 text-gray-700 max-w-[160px] truncate">{o.provider_name || "—"}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{o.local_name || "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {o.total_amount != null ? fmtCur(o.total_amount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ── Section: Facturas / Ingresos ───────────────────── */
function FacturasSection({ data, isLoading }) {
  const invoices = data?.items ?? [];

  const semaforo = useMemo(() => {
    const counts = { VERDE: 0, AMARILLO: 0, ROJO: 0 };
    invoices.forEach((inv) => {
      const s = inv.estado_semaforo || "ROJO";
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [invoices]);

  const sinRV = useMemo(() =>
    invoices.filter((inv) => !inv.remito_venta_number).length, [invoices]);
  const sinConfLocal = useMemo(() =>
    invoices.filter((inv) => !inv.confirmado_local_at).length, [invoices]);
  const sinConfAdmin = useMemo(() =>
    invoices.filter((inv) => !inv.confirmado_admin_at).length, [invoices]);

  const semaforoByLocal = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const local = inv.local_name || "Sin local";
      const sem = inv.estado_semaforo || "ROJO";
      if (!map[local]) map[local] = { VERDE: 0, AMARILLO: 0, ROJO: 0 };
      if (sem in map[local]) map[local][sem]++;
    });
    return Object.entries(map)
      .map(([local, c]) => ({ local, ...c, total: c.VERDE + c.AMARILLO + c.ROJO }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [invoices]);

  const topProviders = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const name = inv.provider_name || "Sin proveedor";
      if (!map[name]) map[name] = { count: 0, amount: 0 };
      map[name].count++;
      map[name].amount += inv.amount || 0;
    });
    return Object.entries(map)
      .map(([proveedor, d]) => ({ proveedor, ...d }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [invoices]);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total facturas" value={fmtNum(invoices.length)} icon={FileText} colorClass="bg-blue-50 text-blue-700 border-blue-200" />
        <StatCard title="Sin RV" value={fmtNum(sinRV)} icon={AlertTriangle} colorClass="bg-orange-50 text-orange-700 border-orange-200" />
        <StatCard title="Sin confirmar local" value={fmtNum(sinConfLocal)} icon={Building2} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
        <StatCard title="Sin confirmar admin" value={fmtNum(sinConfAdmin)} icon={AlertTriangle} colorClass="bg-red-50 text-red-700 border-red-200" />
      </div>

      {/* Semáforo aggregate */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "ROJO", label: "Rojos", dot: "bg-red-500", colorClass: "bg-red-50 text-red-700 border-red-200" },
          { key: "AMARILLO", label: "Amarillos", dot: "bg-yellow-400", colorClass: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { key: "VERDE", label: "Verdes", dot: "bg-green-500", colorClass: "bg-green-50 text-green-700 border-green-200" },
        ].map(({ key, label, dot, colorClass }) => (
          <div key={key} className={`rounded-xl border p-4 ${colorClass}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-3 h-3 rounded-full ${dot}`} />
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
            </div>
            <p className="text-3xl font-bold">{fmtNum(semaforo[key])}</p>
            <p className="text-xs opacity-60 mt-0.5">
              {invoices.length > 0 ? `${Math.round((semaforo[key] / invoices.length) * 100)}%` : "0%"} del total
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Semáforo por local (top 10)">
          {semaforoByLocal.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={Math.max(220, semaforoByLocal.length * 40)}>
              <BarChart data={semaforoByLocal} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="local" tick={{ fontSize: 10 }} width={100} />
                <Tooltip />
                <Bar dataKey="ROJO" name="Rojo" fill="#ef4444" stackId="a" />
                <Bar dataKey="AMARILLO" name="Amarillo" fill="#f59e0b" stackId="a" />
                <Bar dataKey="VERDE" name="Verde" fill="#10b981" stackId="a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Top 10 proveedores por monto facturado">
          {topProviders.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Proveedor</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Facturas</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topProviders.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-700 font-medium">{r.proveedor}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtNum(r.count)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmtCur(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── Section: Pagos ─────────────────────────────────── */
function PagosSection({ data, isLoading }) {
  const vouchers = data?.items ?? [];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const vencidos = useMemo(() =>
    vouchers.filter((v) => v.status === "VENCIDO"), [vouchers]);

  const pagadosMes = useMemo(() =>
    vouchers.filter((v) => {
      if (v.status !== "PAGADO" || !v.payment_date) return false;
      const d = new Date(v.payment_date + "T00:00:00");
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }), [vouchers, thisMonth, thisYear]);

  const pendientes = useMemo(() =>
    vouchers.filter((v) => v.status === "POR_PAGAR" || v.status === "PARCIAL" || v.status === "VENCIDO"),
    [vouchers]);

  const importePendiente = useMemo(() =>
    pendientes.reduce((s, v) => s + Math.max((v.amount_net || 0) - (v.amount_paid || 0), 0), 0),
    [pendientes]);

  const topPendientes = useMemo(() => {
    const map = {};
    pendientes.forEach((v) => {
      const name = v.provider_name || "Sin proveedor";
      if (!map[name]) map[name] = 0;
      map[name] += Math.max((v.amount_net || 0) - (v.amount_paid || 0), 0);
    });
    return Object.entries(map)
      .map(([proveedor, saldo]) => ({ proveedor, saldo }))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5);
  }, [pendientes]);

  const byStatusChart = useMemo(() => {
    const counts = {};
    vouchers.forEach((v) => { counts[v.status] = (counts[v.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [vouchers]);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Vencidos" value={fmtNum(vencidos.length)} icon={AlertTriangle} colorClass="bg-red-50 text-red-700 border-red-200" />
        <StatCard title="Pagados este mes" value={fmtNum(pagadosMes.length)} icon={CheckCircle} colorClass="bg-green-50 text-green-700 border-green-200" />
        <StatCard title="Pendientes" value={fmtNum(pendientes.length)} icon={Clock} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
        <StatCard title="Saldo pendiente" value={fmtCur(importePendiente)} icon={DollarSign} colorClass="bg-blue-50 text-blue-700 border-blue-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Top 5 proveedores por saldo pendiente">
          {topPendientes.length === 0 ? (
            <EmptyState text="No hay pagos pendientes" />
          ) : (
            <div className="space-y-4">
              {topPendientes.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.proveedor}</p>
                    <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.max((r.saldo / (topPendientes[0]?.saldo || 1)) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">{fmtCur(r.saldo)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Estado de comprobantes">
          {byStatusChart.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStatusChart} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v) => [`${v} comprobantes`, "Cantidad"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byStatusChart.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLOR_MAP[d.label] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── Section: Stock Legacy ──────────────────────────── */
function StockSection({ stats, isLoading }) {
  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Artículos con stock" value={fmtNum(stats?.articulos_con_stock)} icon={Package} colorClass="bg-blue-50 text-blue-700 border-blue-200" />
        <StatCard title="Unidades en stock" value={fmtNum(stats?.unidades_en_stock)} icon={BarChart3} colorClass="bg-green-50 text-green-700 border-green-200" />
        <StatCard title="Locales activos" value={fmtNum(stats?.locales)} icon={Building2} colorClass="bg-purple-50 text-purple-700 border-purple-200" />
        <StatCard title="RVs registrados" value={fmtNum(stats?.rvs_registrados)} icon={Database} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
      </div>

      <Panel>
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-gray-700 mb-1">Datos del sistema legacy</p>
            <p className="text-xs text-gray-500">
              Estos datos provienen de <code className="bg-gray-100 px-1 rounded">legacy.articulos</code> (sistema anterior).
              Para actualizar el inventario, usar pgAdmin o el proceso de importación masiva.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ── Section: Ventas Legacy ─────────────────────────── */
function VentasSection({ diasVentas, setDiasVentas }) {
  const { data: ventasPorLocal, isLoading: loadingLocal } = useQuery({
    queryKey: ["legacy-ventas-local", diasVentas],
    queryFn: () => api.get(`/legacy/ventas/por-local?dias=${diasVentas}`),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProductos, isLoading: loadingProductos } = useQuery({
    queryKey: ["legacy-top-productos", diasVentas],
    queryFn: () => api.get(`/legacy/ventas/top-productos?dias=${diasVentas}&limit=15`),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = loadingLocal || loadingProductos;
  const porLocal = ventasPorLocal?.por_local ?? [];
  const productos = topProductos?.items ?? [];

  const chartData = porLocal.map((r) => ({ label: r.local, value: r.total_bruto }));
  const totalBruto = ventasPorLocal?.total_bruto ?? 0;
  const localesActivos = porLocal.length;
  const totalComprobantes = porLocal.reduce((s, r) => s + (r.comprobantes ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Período:</span>
        {[30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDiasVentas(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              diasVentas === d
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {d === 365 ? "1 año" : `${d} días`}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}

      {!isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total bruto"
              value={fmtCur(totalBruto)}
              sub={`últimos ${diasVentas} días`}
              icon={TrendingUp}
              colorClass="bg-blue-50 text-blue-700 border-blue-200"
            />
            <StatCard
              title="Locales activos"
              value={fmtNum(localesActivos)}
              icon={Building2}
              colorClass="bg-purple-50 text-purple-700 border-purple-200"
            />
            <StatCard
              title="Comprobantes"
              value={fmtNum(totalComprobantes)}
              icon={FileText}
              colorClass="bg-green-50 text-green-700 border-green-200"
            />
          </div>

          <Panel title="Ventas por local (bruto)">
            {chartData.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 38)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => fmtCur(v)} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip formatter={(v) => [fmtCur(v), "Total bruto"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title={`Top ${productos.length} productos más vendidos (últimos ${diasVentas} días)`}>
            {productos.length === 0 ? <EmptyState /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">#</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Producto</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Marca</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Unidades</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Total</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Precio Prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 text-gray-800 font-medium max-w-[280px] truncate">{r.descripcion || "—"}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{r.marca || "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmtNum(r.unidades)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtCur(r.total)}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{fmtCur(r.precio_avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────── */
const TABS = [
  { id: "pedidos", label: "Pedidos de Compra", icon: ShoppingCart },
  { id: "facturas", label: "Facturas / Ingresos", icon: FileText },
  { id: "pagos", label: "Pagos", icon: DollarSign },
  { id: "stock", label: "Stock Legacy", icon: Package },
  { id: "ventas", label: "Ventas", icon: TrendingUp },
];

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState("pedidos");
  const [diasVentas, setDiasVentas] = useState(30);

  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ["reportes-orders"],
    queryFn: () => api.get("/purchase-orders/?limit=500").catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ["reportes-invoices"],
    queryFn: () => api.get("/purchase-invoices/?limit=500").catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vouchersData, isLoading: loadingVouchers } = useQuery({
    queryKey: ["reportes-vouchers"],
    queryFn: () => api.get("/payments/vouchers/?limit=500").catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const { data: legacyStats, isLoading: loadingLegacy } = useQuery({
    queryKey: ["reportes-legacy-stats"],
    queryFn: () => api.get("/legacy/stats").catch(() => null),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 size={24} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="text-sm text-gray-500">Analytics del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "pedidos" && <PedidosSection data={ordersData} isLoading={loadingOrders} />}
      {activeTab === "facturas" && <FacturasSection data={invoicesData} isLoading={loadingInvoices} />}
      {activeTab === "pagos" && <PagosSection data={vouchersData} isLoading={loadingVouchers} />}
      {activeTab === "stock" && <StockSection stats={legacyStats} isLoading={loadingLegacy} />}
      {activeTab === "ventas" && <VentasSection diasVentas={diasVentas} setDiasVentas={setDiasVentas} />}
    </div>
  );
}

