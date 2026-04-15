import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Package,
  Warehouse,
  FileText,
  Truck,
  Store,
  Users,
  Search,
  ShoppingCart,
  Receipt,
  CreditCard,
  GitCompare,
  Kanban,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Boxes,
  PackageCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { CssBarChart } from "../components/CssCharts";

const fmt = new Intl.NumberFormat("es-AR");

function StatSkeleton() {
  return <div className="animate-pulse bg-gray-200 h-8 w-16 rounded" />;
}

const MODULES = [
  { to: "/pedidos-compras", icon: ShoppingCart, label: "Notas de Pedido", desc: "Pedidos a proveedores", color: "bg-violet-500" },
  { to: "/facturas-proveedor", icon: Receipt, label: "Facturas / Remitos", desc: "Documentos de compra", color: "bg-blue-500" },
  { to: "/gestion-pagos", icon: CreditCard, label: "Gestión de Pagos", desc: "Comprobantes y retenciones", color: "bg-sky-500" },
  { to: "/ingreso", icon: Package, label: "Ingreso Mercadería", desc: "Recibir remitos y facturas", color: "bg-indigo-500" },
  { to: "/stock", icon: Warehouse, label: "Stock", desc: "Inventario por talle y color", color: "bg-emerald-500" },
  { to: "/facturacion", icon: FileText, label: "Facturación", desc: "Comprobantes y documentos", color: "bg-amber-500" },
  { to: "/comparador", icon: GitCompare, label: "Comparador Precios", desc: "Comparar proveedores", color: "bg-orange-500" },
  { to: "/consultas", icon: Search, label: "Consultas ERP", desc: "Precios, stock, artículos", color: "bg-cyan-500" },
  { to: "/kanban", icon: Kanban, label: "TrellOutdoor", desc: "Gestión de tareas", color: "bg-pink-500" },
  { to: "/proveedores", icon: Truck, label: "Proveedores", desc: "Gestión de proveedores", color: "bg-rose-500" },
  { to: "/locales", icon: Store, label: "Locales", desc: "Puntos de venta", color: "bg-teal-500" },
  { to: "/usuarios", icon: Users, label: "Usuarios", desc: "Roles y permisos", color: "bg-slate-500" },
];

const STATUS_COLORS = {
  BORRADOR: "bg-gray-100 text-gray-700",
  ENVIADO: "bg-blue-100 text-blue-700",
  PARCIAL: "bg-yellow-100 text-yellow-800",
  RECIBIDO: "bg-green-100 text-green-700",
  VENCIDO: "bg-red-100 text-red-700",
};

function StatCard({ icon: Icon, label, value, color, isLoading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
          <div className="mt-0.5">
            {isLoading ? <StatSkeleton /> : (
              <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
            )}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alertasOpen, setAlertasOpen] = useState(true);

  // --- Queries ---
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => api.get("/sales/?limit=100"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: sidebarCounts, isLoading: loadingSidebar } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: () => api.get("/system/sidebar-counts"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: poStats, isLoading: loadingPoStats } = useQuery({
    queryKey: ["po-stats"],
    queryFn: () => api.get("/purchase-orders/stats"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: stockSummary, isLoading: loadingStock } = useQuery({
    queryKey: ["stock-summary"],
    queryFn: () => api.get("/stock/summary"),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: legacyStats, isLoading: loadingLegacy } = useQuery({
    queryKey: ["legacy-stats"],
    queryFn: () => api.get("/legacy/stats"),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: alertas } = useQuery({
    queryKey: ["alertas-reposicion"],
    queryFn: () => api.get("/purchase-orders/alertas-reposicion"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: ingresos = [] } = useQuery({
    queryKey: ["ingresos-dash"],
    queryFn: () => api.get("/ingresos/?limit=50"),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    select: (d) => d?.items ?? [],
  });

  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["recent-invoices"],
    queryFn: () => api.get("/purchase-invoices/?limit=5"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    select: (d) => d?.items?.slice(0, 5) ?? [],
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: () => api.get("/purchase-orders/?limit=5"),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    select: (d) => d?.items?.slice(0, 5) ?? [],
  });

  // --- Computed ---
  const today = new Date().toISOString().slice(0, 10);
  const ingresosHoy = ingresos.filter((i) => i.created_at?.startsWith(today)).length;

  const ventasHoy = useMemo(() => {
    const items = salesData?.items ?? [];
    const todayItems = items.filter(s => s.created_at?.startsWith(today));
    return {
      count: todayItems.length,
      total: todayItems.reduce((sum, s) => sum + (s.total_amount || s.total || 0), 0),
    };
  }, [salesData, today]);

  const alertasList = alertas?.alertas ?? [];
  const alertasCount = alertasList.length;

  const chartData = useMemo(() => {
    const raw = poStats?.por_mes;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map((m) => ({ name: m.mes || m.month || m.label, pedidos: m.notas || m.cantidad || m.count || m.total || 0 }));
  }, [poStats?.por_mes]);

  const recentActivity = useMemo(() => {
    const items = [
      ...recentInvoices.map((f) => ({
        id: `inv-${f.id}`,
        type: "factura",
        icon: Receipt,
        label: `Factura ${f.numero_completo || f.numero || f.id} — ${f.provider_name || f.proveedor || ""}`,
        date: f.created_at,
        color: "text-blue-500",
        bg: "bg-blue-100",
      })),
      ...recentOrders.map((p) => ({
        id: `po-${p.id}`,
        type: "pedido",
        icon: ShoppingCart,
        label: `Nota #${p.number || p.numero || p.id} — ${p.provider_name || p.proveedor || ""}`,
        date: p.created_at,
        color: "text-violet-500",
        bg: "bg-violet-100",
      })),
    ];
    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return items.slice(0, 10);
  }, [recentInvoices, recentOrders]);

  return (
    <div className="space-y-6">
      {/* A) Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bienvenido, {user?.full_name} —{" "}
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* B) Stats — 2 rows of 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Ingresos hoy" value={ingresosHoy} color="bg-blue-500" />
        <StatCard icon={ShoppingCart} label="Pedidos pendientes" value={sidebarCounts?.pedidos_pendientes} color="bg-violet-500" isLoading={loadingSidebar} />
        <StatCard icon={Receipt} label="Facturas sin RV" value={sidebarCounts?.facturas_sin_rv} color="bg-red-500" isLoading={loadingSidebar} />
        <StatCard icon={AlertTriangle} label="Alertas reposición" value={sidebarCounts?.alertas_reposicion} color="bg-orange-500" isLoading={loadingSidebar} />
        <StatCard icon={TrendingUp} label="Notas con diferencia" value={poStats?.notas_con_diferencia} color="bg-yellow-500" isLoading={loadingPoStats} />
        <StatCard icon={Boxes} label="Unidades pedidas" value={poStats?.unidades_pedidas != null ? fmt.format(poStats.unidades_pedidas) : undefined} color="bg-cyan-500" isLoading={loadingPoStats} />
        <StatCard icon={CreditCard} label="Pagos pendientes" value={sidebarCounts?.pagos_pendientes} color="bg-sky-500" isLoading={loadingSidebar} />
        <StatCard icon={Warehouse} label="Unidades en stock" value={legacyStats?.unidades_en_stock != null ? fmt.format(legacyStats.unidades_en_stock) : stockSummary?.total_units != null ? fmt.format(stockSummary.total_units) : undefined} color="bg-emerald-500" isLoading={loadingLegacy && loadingStock} />
        <StatCard icon={FileText} label="Ventas hoy" value={ventasHoy.count} color="bg-green-500" isLoading={loadingSales} />
        <StatCard icon={TrendingUp} label="Facturado hoy" value={ventasHoy.total > 0 ? `$${fmt.format(ventasHoy.total)}` : "—"} color="bg-emerald-600" isLoading={loadingSales} />
      </div>

      {/* C) Alertas de Reposición */}
      <div className={`rounded-xl border overflow-hidden ${alertasCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
        <button
          onClick={() => setAlertasOpen(!alertasOpen)}
          className={`w-full flex items-center justify-between px-5 py-3 text-sm font-semibold ${
            alertasCount > 0 ? "bg-red-600 text-white" : "bg-green-600 text-white"
          }`}
        >
          <span className="flex items-center gap-2">
            {alertasCount > 0 ? <AlertTriangle size={16} /> : <PackageCheck size={16} />}
            {alertasCount > 0
              ? `⚠ ALERTAS DE REPOSICIÓN — ${alertasCount} pendiente${alertasCount !== 1 ? "s" : ""}`
              : "✓ Sin alertas de reposición"}
          </span>
          {alertasCount > 0 && (alertasOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </button>

        {alertasOpen && alertasCount > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200 text-left text-xs text-red-700 uppercase">
                  <th className="px-5 py-2">Estado</th>
                  <th className="px-3 py-2">N° Pedido</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Local</th>
                  <th className="px-3 py-2 text-right">Faltan</th>
                  <th className="px-3 py-2 text-right">Días</th>
                </tr>
              </thead>
              <tbody>
                {alertasList.map((a, i) => (
                  <tr
                    key={a.id || i}
                    onClick={() => navigate("/pedidos-compras")}
                    className="border-b border-red-100 hover:bg-red-100/60 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-2">
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status || a.estado] || "bg-gray-100 text-gray-700"}`}>
                        {a.estado || a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{a.number || a.numero || `#${a.id}`}</td>
                    <td className="px-3 py-2 text-gray-600">{a.provider_name || a.proveedor || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{a.local_name || a.local || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-700">{a.faltan ?? a.missing ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{a.dias_esperando ?? a.dias ?? a.days ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* D) Actividad Reciente + E) Chart side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Actividad Reciente</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin actividad reciente</p>
          ) : (
            <div className="space-y-0">
              {recentActivity.map((item, idx) => (
                <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <div className="relative flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                      <item.icon size={14} className={item.color} />
                    </div>
                    {idx < recentActivity.length - 1 && (
                      <div className="w-px h-full bg-gray-200 absolute top-8 left-1/2 -translate-x-1/2" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{timeAgo(item.date)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${item.bg} ${item.color}`}>
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* E) Chart — Pedidos por Mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Pedidos por Mes (últimos 6 meses)</h2>
          {chartData ? (
            <CssBarChart data={chartData} height={260} color="#7c3aed" labelKey="name" valueKey="pedidos" />
          ) : (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              Sin datos de pedidos por mes
            </div>
          )}
        </div>
      </div>

      {/* F) Módulos — 2 rows of 6 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Módulos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULES.map((mod) => (
            <Link
              key={mod.to}
              to={mod.to}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all group text-center"
            >
              <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                <mod.icon size={20} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 text-xs">{mod.label}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">{mod.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
