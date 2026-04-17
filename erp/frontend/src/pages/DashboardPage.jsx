import { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Link } from "react-router-dom";
import {
  TrendingUp, Receipt, Package, ShoppingCart, AlertTriangle, Boxes,
  MessageSquare, Users, LayoutGrid, Lightbulb, Warehouse, GripVertical,
  X, Plus, Settings2, ChevronUp, ChevronDown, Loader2, CreditCard,
  PackageCheck, FileText, Store, Truck, Search, GitCompare, Kanban,
} from "lucide-react";

// ── Icons map ──────────────────────────────────────────────────────────────
const ICON_MAP = {
  TrendingUp, Receipt, Package, ShoppingCart, AlertTriangle, Boxes,
  MessageSquare, Users, LayoutGrid, Lightbulb, Warehouse, CreditCard,
  PackageCheck, FileText, Store, Truck, Search, GitCompare, Kanban,
};

const fmt = new Intl.NumberFormat("es-AR");

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

// ── STATUS pills ────────────────────────────────────────────────────────────
const STATUS_PILL = {
  BORRADOR:   "bg-gray-100 text-gray-600",
  ENVIADO:    "bg-blue-100 text-blue-700",
  RECIBIDO:   "bg-green-100 text-green-700",
  EMITIDA:    "bg-blue-100 text-blue-700",
  PAGADA:     "bg-green-100 text-green-700",
  ANULADA:    "bg-red-100 text-red-600",
  CONFIRMADO: "bg-green-100 text-green-700",
  PENDIENTE:  "bg-yellow-100 text-yellow-700",
};

function StatusPill({ status }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${STATUS_PILL[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

// ── Widget skeleton ─────────────────────────────────────────────────────────
function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-1">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
    </div>
  );
}

// ── Widget card wrapper ─────────────────────────────────────────────────────
function WidgetCard({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

function WidgetHeader({ icon: Icon, title, color = "text-gray-500", badge }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className={color} />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {badge != null && (
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
  );
}

// ══ WIDGETS ════════════════════════════════════════════════════════════════

// ventas_hoy
function WidgetVentasHoy({ data, isLoading }) {
  return (
    <WidgetCard>
      <WidgetHeader icon={TrendingUp} title="Ventas de hoy" color="text-green-500" />
      {isLoading ? <WidgetSkeleton /> : (
        <div className="flex gap-4">
          <div className="text-center flex-1">
            <p className="text-3xl font-bold text-gray-900">{data?.total_ventas ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">ventas</p>
          </div>
          <div className="w-px bg-gray-100" />
          <div className="text-center flex-1">
            <p className="text-3xl font-bold text-emerald-600">${fmt.format(data?.monto_total ?? 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">facturado</p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

// ventas_recientes
function WidgetVentasRecientes({ data, isLoading }) {
  const ventas = data?.ventas ?? [];
  return (
    <WidgetCard>
      <WidgetHeader icon={Receipt} title="Últimas ventas" color="text-blue-500" badge={ventas.length} />
      {isLoading ? <WidgetSkeleton /> : ventas.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin ventas recientes</p>
      ) : (
        <div className="space-y-1.5">
          {ventas.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-medium text-gray-700">{v.sale_number || `#${v.id}`}</span>
                {v.local && <span className="text-gray-400 ml-1">· {v.local}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={v.status} />
                <span className="font-semibold text-gray-800">${fmt.format(v.total ?? 0)}</span>
                <span className="text-gray-400">{timeAgo(v.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// mejoras
function WidgetMejoras({ data, isLoading }) {
  const mejoras = data?.mejoras ?? [];
  return (
    <WidgetCard>
      <WidgetHeader icon={Lightbulb} title="Mejoras pendientes" color="text-yellow-500" badge={mejoras.length} />
      {isLoading ? <WidgetSkeleton /> : mejoras.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">✓ Sin mejoras pendientes</p>
      ) : (
        <div className="space-y-2">
          {mejoras.map((m) => (
            <div key={m.id} className="flex items-start gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-gray-700 leading-snug line-clamp-2">{m.text}</p>
                {m.section && <p className="text-gray-400 mt-0.5">{m.section} · {timeAgo(m.created_at)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// pedidos_activos
function WidgetPedidosActivos({ data, isLoading }) {
  const pedidos = data?.pedidos ?? [];
  return (
    <WidgetCard>
      <WidgetHeader icon={ShoppingCart} title="Pedidos activos" color="text-violet-500" badge={pedidos.length} />
      {isLoading ? <WidgetSkeleton /> : pedidos.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin pedidos activos</p>
      ) : (
        <div className="space-y-1.5">
          {pedidos.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-medium text-gray-700">{p.order_number || `#${p.id}`}</span>
                {p.proveedor && <span className="text-gray-400 ml-1">· {p.proveedor}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={p.status} />
                <span className="text-gray-400">{timeAgo(p.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ingresos_recientes
function WidgetIngresosRecientes({ data, isLoading }) {
  const ingresos = data?.ingresos ?? [];
  return (
    <WidgetCard>
      <WidgetHeader icon={Package} title="Ingresos recientes" color="text-indigo-500" badge={ingresos.length} />
      {isLoading ? <WidgetSkeleton /> : ingresos.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin ingresos recientes</p>
      ) : (
        <div className="space-y-1.5">
          {ingresos.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-medium text-gray-700">{i.remito_number || `#${i.id}`}</span>
                {i.proveedor && <span className="text-gray-400 ml-1">· {i.proveedor}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={i.status} />
                <span className="text-gray-400">{timeAgo(i.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// alertas_stock
function WidgetAlertasStock({ data, isLoading }) {
  const alertas = data?.alertas ?? [];
  return (
    <WidgetCard>
      <WidgetHeader icon={AlertTriangle} title="Stock bajo" color="text-red-500" badge={alertas.length} />
      {isLoading ? <WidgetSkeleton /> : alertas.length === 0 ? (
        <p className="text-xs text-green-600 text-center py-3">✓ Todo el stock OK</p>
      ) : (
        <div className="space-y-1.5">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="font-medium text-gray-700 truncate">{a.producto}</span>
                {(a.size || a.color) && <span className="text-gray-400 ml-1">· {[a.size, a.color].filter(Boolean).join(" / ")}</span>}
              </div>
              <span className={`font-bold ${a.stock === 0 ? "text-red-600" : "text-orange-500"}`}>
                {a.stock} u.
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// resumen_stock
function WidgetResumenStock({ data, isLoading }) {
  return (
    <WidgetCard>
      <WidgetHeader icon={Boxes} title="Resumen de stock" color="text-emerald-500" />
      {isLoading ? <WidgetSkeleton /> : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmt.format(data?.total_productos ?? 0)}</p>
            <p className="text-[11px] text-gray-500">productos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmt.format(data?.total_variantes ?? 0)}</p>
            <p className="text-[11px] text-gray-500">variantes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{fmt.format(data?.total_unidades ?? 0)}</p>
            <p className="text-[11px] text-gray-500">unidades</p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

// clientes_activos
function WidgetClientesActivos({ data, isLoading }) {
  const clientes = data?.clientes ?? [];
  return (
    <WidgetCard>
      <WidgetHeader icon={Users} title="Clientes activos" color="text-cyan-500" badge={clientes.length} />
      {isLoading ? <WidgetSkeleton /> : clientes.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin clientes registrados</p>
      ) : (
        <div className="space-y-1.5">
          {clientes.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700 truncate">{c.full_name}</span>
              <span className="text-gray-500 shrink-0">{c.total_compras} compras</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// mensajes
function WidgetMensajes({ data, isLoading }) {
  const msgs = data?.mensajes ?? [];
  const total = data?.total_unread ?? 0;
  return (
    <WidgetCard>
      <WidgetHeader icon={MessageSquare} title="Mensajes no leídos" color="text-pink-500" badge={total} />
      {isLoading ? <WidgetSkeleton /> : msgs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">✓ No hay mensajes nuevos</p>
      ) : (
        <div className="space-y-2">
          {msgs.map((m) => (
            <div key={m.id} className="text-xs">
              <span className="font-medium text-gray-700">{m.remitente}</span>
              <p className="text-gray-500 line-clamp-1 mt-0.5">{m.content}</p>
              <p className="text-gray-400 mt-0.5">{timeAgo(m.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// accesos_rapidos
const QUICK_LINKS = [
  { to: "/pedidos-compras",   icon: ShoppingCart, label: "Pedidos",       color: "bg-violet-100 text-violet-600" },
  { to: "/facturas-proveedor",icon: Receipt,      label: "Facturas",      color: "bg-blue-100 text-blue-600" },
  { to: "/ingreso",           icon: Package,      label: "Ingreso",       color: "bg-indigo-100 text-indigo-600" },
  { to: "/stock",             icon: Warehouse,    label: "Stock",         color: "bg-emerald-100 text-emerald-600" },
  { to: "/facturacion",       icon: FileText,     label: "Ventas",        color: "bg-amber-100 text-amber-600" },
  { to: "/consultas",         icon: Search,       label: "Consultas",     color: "bg-cyan-100 text-cyan-600" },
  { to: "/proveedores",       icon: Truck,        label: "Proveedores",   color: "bg-rose-100 text-rose-600" },
  { to: "/locales",           icon: Store,        label: "Locales",       color: "bg-teal-100 text-teal-600" },
];

function WidgetAccesosRapidos() {
  return (
    <WidgetCard className="col-span-full sm:col-span-2">
      <WidgetHeader icon={LayoutGrid} title="Accesos rápidos" color="text-gray-400" />
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {QUICK_LINKS.map(({ to, icon: Icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
              <Icon size={16} />
            </div>
            <span className="text-[10px] text-gray-500 text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}

// ── Widget registry ────────────────────────────────────────────────────────
const WIDGET_COMPONENTS = {
  ventas_hoy:         (props) => <WidgetVentasHoy {...props} />,
  ventas_recientes:   (props) => <WidgetVentasRecientes {...props} />,
  mejoras:            (props) => <WidgetMejoras {...props} />,
  pedidos_activos:    (props) => <WidgetPedidosActivos {...props} />,
  ingresos_recientes: (props) => <WidgetIngresosRecientes {...props} />,
  alertas_stock:      (props) => <WidgetAlertasStock {...props} />,
  mensajes:           (props) => <WidgetMensajes {...props} />,
  resumen_stock:      (props) => <WidgetResumenStock {...props} />,
  clientes_activos:   (props) => <WidgetClientesActivos {...props} />,
  accesos_rapidos:    () => <WidgetAccesosRapidos />,
};

// ── Single widget data fetcher ─────────────────────────────────────────────
function WidgetDataLoader({ widgetId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-data", widgetId],
    queryFn: () => api.get(`/dashboard/widget-data/${widgetId}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const Comp = WIDGET_COMPONENTS[widgetId];
  if (!Comp) return null;
  return <Comp data={data} isLoading={isLoading} />;
}

// ── Personalization modal ──────────────────────────────────────────────────
function PersonalizeModal({ currentWidgets, availableWidgets, onSave, onClose, saving }) {
  const [selected, setSelected] = useState([...currentWidgets]);

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );

  const moveUp = (idx) => {
    if (idx === 0) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx) => {
    setSelected((prev) => {
      if (idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const availableMap = Object.fromEntries(availableWidgets.map((w) => [w.id, w]));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Personalizar dashboard</h2>
            <p className="text-xs text-gray-500 mt-0.5">Elegí qué widgets ver y en qué orden</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selected widgets with order controls */}
          {selected.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Orden actual</p>
              <div className="space-y-1.5">
                {selected.map((id, idx) => {
                  const w = availableMap[id];
                  if (!w) return null;
                  const IconComp = ICON_MAP[w.icon] ?? LayoutGrid;
                  return (
                    <div key={id} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                      <GripVertical size={14} className="text-gray-400" />
                      <IconComp size={14} className="text-indigo-500 shrink-0" />
                      <span className="text-sm font-medium text-gray-700 flex-1">{w.label}</span>
                      <div className="flex gap-1">
                        <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 rounded hover:bg-white disabled:opacity-30">
                          <ChevronUp size={13} />
                        </button>
                        <button onClick={() => moveDown(idx)} disabled={idx === selected.length - 1} className="p-1 rounded hover:bg-white disabled:opacity-30">
                          <ChevronDown size={13} />
                        </button>
                        <button onClick={() => toggle(id)} className="p-1 rounded hover:bg-red-50 text-red-400">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available widgets to add */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Disponibles</p>
            <div className="grid grid-cols-1 gap-2">
              {availableWidgets.filter((w) => !selected.includes(w.id)).map((w) => {
                const IconComp = ICON_MAP[w.icon] ?? LayoutGrid;
                return (
                  <button
                    key={w.id}
                    onClick={() => toggle(w.id)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-left transition-colors"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <IconComp size={14} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{w.label}</p>
                      <p className="text-xs text-gray-400">{w.description}</p>
                    </div>
                    <Plus size={14} className="text-gray-400 ml-auto shrink-0" />
                  </button>
                );
              })}
              {availableWidgets.filter((w) => !selected.includes(w.id)).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Todos los widgets están activos</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onSave(selected)}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══ PAGE ════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPersonalize, setShowPersonalize] = useState(false);

  const { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ["dashboard-config"],
    queryFn: () => api.get("/dashboard/config"),
    staleTime: Infinity,
  });

  const { data: availableWidgets = [] } = useQuery({
    queryKey: ["dashboard-available"],
    queryFn: () => api.get("/dashboard/widgets-available"),
    staleTime: Infinity,
  });

  const saveConfig = useMutation({
    mutationFn: (widgets) => api.put("/dashboard/config", { widgets }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-config"] });
      setShowPersonalize(false);
    },
  });

  const activeWidgets = configData?.widgets ?? ["accesos_rapidos", "ventas_hoy", "ventas_recientes", "pedidos_activos"];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "¡Buenos días";
    if (h < 19) return "¡Buenas tardes";
    return "¡Buenas noches";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {user?.full_name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => setShowPersonalize(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-indigo-300 transition-colors"
        >
          <Settings2 size={15} />
          Personalizar
        </button>
      </div>

      {/* Widget grid */}
      {loadingConfig ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-32 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="space-y-2">
                <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                <div className="h-2.5 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : activeWidgets.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <LayoutGrid size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Tu dashboard está vacío</p>
          <p className="text-gray-400 text-sm mt-1">Hacé clic en "Personalizar" para agregar widgets</p>
          <button
            onClick={() => setShowPersonalize(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <Plus size={14} className="inline mr-1" />
            Agregar widgets
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeWidgets.map((widgetId) => (
            <div key={widgetId} className={widgetId === "accesos_rapidos" ? "col-span-full" : ""}>
              {widgetId === "accesos_rapidos"
                ? <WidgetAccesosRapidos />
                : <WidgetDataLoader widgetId={widgetId} />
              }
            </div>
          ))}
        </div>
      )}

      {/* Personalize modal */}
      {showPersonalize && (
        <PersonalizeModal
          currentWidgets={activeWidgets}
          availableWidgets={availableWidgets}
          onSave={(widgets) => saveConfig.mutate(widgets)}
          onClose={() => setShowPersonalize(false)}
          saving={saveConfig.isPending}
        />
      )}
    </div>
  );
}
