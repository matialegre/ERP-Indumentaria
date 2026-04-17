import { useState } from "react";
import {
  ShoppingBag, Store, Package, Ship, Globe, Sparkles, ChevronDown, ChevronRight,
  LayoutDashboard, Users, ShoppingCart, CreditCard, Warehouse, FileText, Truck,
  BarChart3, Tag, Receipt, Calculator, Banknote, FileSpreadsheet, Anchor,
  Container, FileCheck, DollarSign, Languages, Box, PackageCheck, Scan,
  Megaphone, TrendingUp, Zap, Bot, Activity, Settings, Lightbulb,
} from "lucide-react";

/**
 * PropuestasPage — laboratorio de diseño de menús del ERP.
 * 5 propuestas temáticas + 1 propuesta maestra interactiva.
 */

// ═══════════════════════════════════════════════════════════════════════════
// PROPUESTAS
// ═══════════════════════════════════════════════════════════════════════════

const PROPUESTA_MINORISTA = {
  id: "minorista",
  titulo: "Retail / Minorista",
  subtitulo: "Optimizada para PDV, cajero, vendedor de salón y encargado de local",
  icon: ShoppingBag,
  color: "#10b981",
  filosofia: "El cajero arranca el día y necesita vender YA. Todo lo operativo al alcance de un clic; lo administrativo replegado.",
  grupos: [
    {
      label: "🏪 Punto de Venta",
      items: [
        { label: "POS Táctil", icon: ShoppingCart, hint: "Pantalla principal del cajero" },
        { label: "Facturación rápida", icon: Receipt, hint: "Factura A/B/C + ticket" },
        { label: "Cambios y devoluciones", icon: PackageCheck },
        { label: "Apertura / Cierre de caja", icon: CreditCard, hint: "Arqueo diario" },
      ],
    },
    {
      label: "📦 Productos y Stock del Local",
      items: [
        { label: "Consulta rápida (F1)", icon: Scan, hint: "Código de barras, SKU, descripción" },
        { label: "Stock del local", icon: Warehouse },
        { label: "Stock otros locales", icon: Store, hint: "Para derivaciones" },
        { label: "Pedidos entre locales", icon: Truck },
      ],
    },
    {
      label: "👥 Clientes",
      items: [
        { label: "Ficha de cliente", icon: Users },
        { label: "Club Mundo Outdoor", icon: Tag, hint: "Canje de puntos en caja" },
        { label: "Cuenta corriente", icon: DollarSign },
      ],
    },
    {
      label: "📊 Mi Local",
      items: [
        { label: "Ventas de hoy", icon: BarChart3 },
        { label: "Ranking de vendedores", icon: TrendingUp },
        { label: "Mis comisiones", icon: Calculator },
      ],
    },
  ],
};

const PROPUESTA_MAYORISTA = {
  id: "mayorista",
  titulo: "Mayorista / B2B",
  subtitulo: "Cuentas corrientes, listas de precios por cliente, pedidos grandes y logística",
  icon: Store,
  color: "#8b5cf6",
  filosofia: "El operador B2B trabaja con pocos clientes pero pedidos grandes. Listas de precios, condiciones de pago y logística son el corazón.",
  grupos: [
    {
      label: "🤝 Clientes B2B",
      items: [
        { label: "Cartera de clientes", icon: Users, hint: "Con límite de crédito" },
        { label: "Cuenta corriente", icon: FileSpreadsheet },
        { label: "Condiciones comerciales", icon: FileText, hint: "Descuentos, plazos, listas" },
        { label: "Saldos y vencimientos", icon: CreditCard, badge: "12" },
      ],
    },
    {
      label: "📋 Pedidos y Venta",
      items: [
        { label: "Nuevo pedido mayorista", icon: ShoppingCart },
        { label: "Pedidos en preparación", icon: Package, badge: "5" },
        { label: "Remitos y entregas", icon: Truck },
        { label: "Facturación por lote", icon: Receipt },
      ],
    },
    {
      label: "💰 Listas de Precios",
      items: [
        { label: "Lista mayorista A/B/C", icon: Tag },
        { label: "Promociones vigentes", icon: Sparkles },
        { label: "Política de descuentos", icon: Calculator },
      ],
    },
    {
      label: "🚚 Logística",
      items: [
        { label: "Programación de envíos", icon: Truck },
        { label: "Transportistas", icon: Container },
        { label: "Tracking de entregas", icon: Activity },
      ],
    },
    {
      label: "📈 Análisis B2B",
      items: [
        { label: "Ranking de clientes", icon: BarChart3 },
        { label: "Rotación por cliente", icon: TrendingUp },
        { label: "Rentabilidad por lista", icon: DollarSign },
      ],
    },
  ],
};

const PROPUESTA_ADMIN = {
  id: "admin",
  titulo: "Administración y Finanzas",
  subtitulo: "Cash flow, pagos, cobros, impuestos y control contable",
  icon: Calculator,
  color: "#3b82f6",
  filosofia: "El administrativo vive de tableros: qué debo, qué me deben, qué se vence, cuál es mi caja. Todo en un vistazo.",
  grupos: [
    {
      label: "💵 Tesorería",
      items: [
        { label: "Cash Flow proyectado", icon: TrendingUp, hint: "Los próximos 30 días" },
        { label: "Saldos de caja y bancos", icon: Banknote },
        { label: "Movimientos bancarios", icon: FileSpreadsheet },
        { label: "Conciliación", icon: FileCheck },
      ],
    },
    {
      label: "📤 Cuentas por Pagar",
      items: [
        { label: "Vencimientos próximos", icon: CreditCard, badge: "8" },
        { label: "Pagos pendientes", icon: DollarSign },
        { label: "OP en aprobación", icon: FileCheck, badge: "3" },
        { label: "Vouchers emitidos", icon: Receipt },
      ],
    },
    {
      label: "📥 Cuentas por Cobrar",
      items: [
        { label: "Deuda por cliente", icon: Users },
        { label: "Cobranzas del día", icon: DollarSign },
        { label: "Cheques en cartera", icon: FileText },
        { label: "Morosos", icon: Activity, badge: "4" },
      ],
    },
    {
      label: "🧾 Impositivo",
      items: [
        { label: "Libro IVA Ventas", icon: FileSpreadsheet },
        { label: "Libro IVA Compras", icon: FileSpreadsheet },
        { label: "Percepciones y retenciones", icon: Calculator },
        { label: "AFIP / AAIP", icon: Receipt },
      ],
    },
    {
      label: "📊 Reportes Gerenciales",
      items: [
        { label: "Estado de resultados", icon: BarChart3 },
        { label: "Balance general", icon: FileText },
        { label: "Ranking de gastos", icon: TrendingUp },
        { label: "KPIs operativos", icon: Activity },
      ],
    },
  ],
};

const PROPUESTA_IMPORTACION = {
  id: "importacion",
  titulo: "Importación",
  subtitulo: "Órdenes de importación, embarque, aduana, costeo y liquidación",
  icon: Ship,
  color: "#0369a1",
  filosofia: "Un embarque vive 60-120 días. El menú debe mostrar el estado del trámite, no solo los datos. Alertas, hitos y costos actualizados.",
  grupos: [
    {
      label: "📋 Órdenes de Importación",
      items: [
        { label: "Nueva OI", icon: FileText },
        { label: "OI en curso", icon: Activity, badge: "7" },
        { label: "Historial de OI", icon: FileSpreadsheet },
      ],
    },
    {
      label: "🚢 Logística Internacional",
      items: [
        { label: "Proveedores extranjeros", icon: Globe },
        { label: "Embarques", icon: Ship, hint: "FCL / LCL / Air" },
        { label: "Tránsito marítimo", icon: Anchor, badge: "2" },
        { label: "Contenedores", icon: Container },
      ],
    },
    {
      label: "🏛 Aduana y Despacho",
      items: [
        { label: "Despachantes", icon: Users },
        { label: "Seguimiento SIM / SIMI", icon: FileCheck },
        { label: "Derechos y aranceles", icon: Calculator },
        { label: "Documentación (BL, Invoice, PL)", icon: FileText },
      ],
    },
    {
      label: "💰 Costeo y Liquidación",
      items: [
        { label: "Prorrateo de gastos", icon: Calculator, hint: "Por kilo / valor / bulto" },
        { label: "Costo final por SKU", icon: Tag },
        { label: "Diferencia presupuesto vs real", icon: TrendingUp },
        { label: "Liquidación final", icon: DollarSign },
      ],
    },
    {
      label: "📊 Indicadores",
      items: [
        { label: "Costo promedio USD/kg", icon: DollarSign },
        { label: "Lead time por proveedor", icon: Activity },
        { label: "ROI por importación", icon: BarChart3 },
      ],
    },
  ],
};

const PROPUESTA_ECOMMERCE = {
  id: "ecommerce",
  titulo: "E-commerce / Omnicanal",
  subtitulo: "Tiendas online, marketplaces, publicaciones, órdenes y publicidad",
  icon: Globe,
  color: "#ec4899",
  filosofia: "Un pedido de ML, VTEX o TiendaNube exige velocidad. El flujo debe ir: ver órdenes → pickear → facturar → despachar en segundos.",
  grupos: [
    {
      label: "🛒 Órdenes Multicanal",
      items: [
        { label: "Bandeja unificada", icon: ShoppingCart, badge: "23", hint: "ML + VTEX + TN" },
        { label: "MercadoLibre Full", icon: Store },
        { label: "MercadoLibre Flex", icon: Truck, badge: "8" },
        { label: "VTEX — Montagne", icon: Store },
        { label: "TiendaNube — MO", icon: Store },
      ],
    },
    {
      label: "🏷 Publicaciones y Catálogo",
      items: [
        { label: "Publicaciones activas", icon: Tag },
        { label: "Sincronizar stock", icon: Zap },
        { label: "Sincronizar precios", icon: DollarSign },
        { label: "Fotos y fichas", icon: FileText },
      ],
    },
    {
      label: "📦 Picking y Despacho",
      items: [
        { label: "Picking list del día", icon: Scan, badge: "15" },
        { label: "Etiquetas de envío", icon: Receipt },
        { label: "Entregas Flex", icon: Truck },
        { label: "Reclamos y devoluciones", icon: Box },
      ],
    },
    {
      label: "📣 Marketing digital",
      items: [
        { label: "Campañas Ads", icon: Megaphone },
        { label: "Mailing masivo", icon: FileText },
        { label: "Recuperación de carrito", icon: ShoppingCart },
        { label: "Remarketing", icon: TrendingUp },
      ],
    },
    {
      label: "📊 Analytics E-com",
      items: [
        { label: "Ventas por canal", icon: BarChart3 },
        { label: "Conversión y embudo", icon: TrendingUp },
        { label: "Top productos", icon: Tag },
        { label: "ROI por campaña", icon: DollarSign },
      ],
    },
  ],
};

const PROPUESTAS_INDIVIDUALES = [
  PROPUESTA_MINORISTA,
  PROPUESTA_MAYORISTA,
  PROPUESTA_ADMIN,
  PROPUESTA_IMPORTACION,
  PROPUESTA_ECOMMERCE,
];

// ═══════════════════════════════════════════════════════════════════════════
// PROPUESTA MAESTRA — menú principal unificado
// ═══════════════════════════════════════════════════════════════════════════

const MENU_MAESTRO = [
  {
    label: "Inicio",
    icon: LayoutDashboard,
    color: "#64748b",
    items: [
      { label: "Dashboard general", icon: LayoutDashboard },
      { label: "Resumen operativo", icon: Activity },
      { label: "Notificaciones", icon: Sparkles },
    ],
  },
  {
    label: "Ventas",
    icon: ShoppingCart,
    color: "#10b981",
    sub: [
      {
        titulo: "Minorista / POS",
        items: [
          { label: "POS Táctil", icon: ShoppingCart },
          { label: "Facturación rápida", icon: Receipt },
          { label: "Arqueo de caja", icon: CreditCard },
          { label: "Cambios y devoluciones", icon: PackageCheck },
        ],
      },
      {
        titulo: "Mayorista / B2B",
        items: [
          { label: "Pedidos mayoristas", icon: ShoppingCart },
          { label: "Listas de precios", icon: Tag },
          { label: "Cuenta corriente", icon: FileSpreadsheet },
          { label: "Remitos y entregas", icon: Truck },
        ],
      },
    ],
  },
  {
    label: "E-commerce",
    icon: Globe,
    color: "#ec4899",
    sub: [
      {
        titulo: "Órdenes y canales",
        items: [
          { label: "Bandeja unificada", icon: ShoppingCart, badge: "23" },
          { label: "MercadoLibre", icon: Store },
          { label: "VTEX", icon: Store },
          { label: "TiendaNube", icon: Store },
        ],
      },
      {
        titulo: "Catálogo online",
        items: [
          { label: "Publicaciones", icon: Tag },
          { label: "Sincronización stock/precio", icon: Zap },
          { label: "Fotos y fichas", icon: FileText },
        ],
      },
      {
        titulo: "Despacho digital",
        items: [
          { label: "Picking del día", icon: Scan, badge: "15" },
          { label: "Etiquetas de envío", icon: Receipt },
          { label: "Reclamos", icon: Box, badge: "3" },
        ],
      },
    ],
  },
  {
    label: "Catálogo & Stock",
    icon: Warehouse,
    color: "#f59e0b",
    sub: [
      {
        titulo: "Productos",
        items: [
          { label: "ABM de productos", icon: ShoppingBag },
          { label: "Variantes y combos", icon: Box },
          { label: "Consulta rápida", icon: Scan },
          { label: "Comparador de precios", icon: TrendingUp },
        ],
      },
      {
        titulo: "Depósito",
        items: [
          { label: "Stock por local", icon: Warehouse },
          { label: "Movimientos internos", icon: Truck },
          { label: "Ajustes e inventario", icon: FileCheck },
          { label: "Transferencias", icon: PackageCheck },
        ],
      },
    ],
  },
  {
    label: "Compras",
    icon: Package,
    color: "#6366f1",
    items: [
      { label: "Notas de pedido", icon: ShoppingCart, badge: "12" },
      { label: "Recepción", icon: PackageCheck },
      { label: "Facturas de proveedor", icon: Receipt },
      { label: "Proveedores nacionales", icon: Truck },
    ],
  },
  {
    label: "Importación",
    icon: Ship,
    color: "#0369a1",
    sub: [
      {
        titulo: "Operación",
        items: [
          { label: "Órdenes de importación", icon: FileText, badge: "7" },
          { label: "Embarques en tránsito", icon: Ship, badge: "2" },
          { label: "Aduana y despacho", icon: Anchor },
        ],
      },
      {
        titulo: "Costeo",
        items: [
          { label: "Prorrateo de gastos", icon: Calculator },
          { label: "Costo final por SKU", icon: Tag },
          { label: "Liquidación", icon: DollarSign },
        ],
      },
    ],
  },
  {
    label: "Administración",
    icon: Calculator,
    color: "#3b82f6",
    sub: [
      {
        titulo: "Tesorería",
        items: [
          { label: "Cash Flow", icon: TrendingUp },
          { label: "Caja y bancos", icon: Banknote },
          { label: "Conciliación", icon: FileCheck },
        ],
      },
      {
        titulo: "Cobros y Pagos",
        items: [
          { label: "Cuentas por pagar", icon: CreditCard, badge: "8" },
          { label: "Cuentas por cobrar", icon: DollarSign },
          { label: "Vencimientos", icon: Activity, badge: "5" },
          { label: "Cheques", icon: FileText },
        ],
      },
      {
        titulo: "Impositivo",
        items: [
          { label: "Libro IVA Ventas / Compras", icon: FileSpreadsheet },
          { label: "Retenciones y percepciones", icon: Calculator },
          { label: "AFIP", icon: Receipt },
        ],
      },
    ],
  },
  {
    label: "CRM & Marketing",
    icon: Users,
    color: "#0891b2",
    sub: [
      {
        titulo: "Clientes 360°",
        items: [
          { label: "Cartera de clientes", icon: Users },
          { label: "Mundo Club", icon: Sparkles },
          { label: "Cuenta corriente cliente", icon: FileSpreadsheet },
        ],
      },
      {
        titulo: "Comunicación",
        items: [
          { label: "Inbox multicanal", icon: Megaphone },
          { label: "Campañas y mailing", icon: Megaphone },
          { label: "Publicidad / Ads", icon: TrendingUp },
          { label: "Asistente IA", icon: Bot },
        ],
      },
    ],
  },
  {
    label: "Reportes",
    icon: BarChart3,
    color: "#f97316",
    items: [
      { label: "Dashboard ejecutivo", icon: LayoutDashboard },
      { label: "Ventas por canal/local", icon: BarChart3 },
      { label: "Rentabilidad por SKU", icon: DollarSign },
      { label: "Informes AFIP", icon: FileSpreadsheet },
      { label: "Estado de resultados", icon: TrendingUp },
    ],
  },
  {
    label: "RRHH & Operaciones",
    icon: Users,
    color: "#dc2626",
    items: [
      { label: "Empleados", icon: Users },
      { label: "Fichajes y horarios", icon: Activity },
      { label: "Comisiones", icon: Calculator },
      { label: "Puntuación de equipo", icon: Sparkles },
      { label: "Kanban de tareas", icon: FileText },
    ],
  },
  {
    label: "Sistema",
    icon: Settings,
    color: "#64748b",
    items: [
      { label: "Usuarios y permisos", icon: Users },
      { label: "Locales / Sucursales", icon: Store },
      { label: "Licencias por PC", icon: FileCheck },
      { label: "Sincronización offline", icon: Zap },
      { label: "Monitoreo", icon: Activity },
      { label: "Configuración", icon: Settings },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function PropuestaCard({ propuesta }) {
  const Icon = propuesta.icon;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div
        className="p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${propuesta.color}, ${propuesta.color}dd)` }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
            <Icon size={28} />
          </div>
          <div>
            <h3 className="text-xl font-bold">{propuesta.titulo}</h3>
            <p className="text-sm text-white/80 mt-0.5">{propuesta.subtitulo}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 text-xs text-gray-600 italic">
          💡 {propuesta.filosofia}
        </div>
        <div className="space-y-3">
          {propuesta.grupos.map((grupo, gi) => (
            <div key={gi}>
              <div className="text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">{grupo.label}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {grupo.items.map((it, ii) => {
                  const IIcon = it.icon;
                  return (
                    <div
                      key={ii}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-white hover:border-gray-200 transition text-xs"
                      title={it.hint || ""}
                    >
                      <IIcon size={13} className="shrink-0" style={{ color: propuesta.color }} />
                      <span className="text-gray-700 truncate flex-1">{it.label}</span>
                      {it.badge && (
                        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
                          {it.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuMaestro() {
  const [open, setOpen] = useState(null);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
      {/* Cabecera */}
      <div className="p-6 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
            <Sparkles size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold">Menú unificado</h3>
              <span className="text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                ⭐ RECOMENDADO
              </span>
            </div>
            <p className="text-sm text-white/85 mt-1">
              Barra superior con 11 grupos, mega-dropdown al hacer hover/clic. Pensado para cubrir los 5 perfiles al mismo tiempo — el usuario solo ve los grupos de los módulos a los que tiene permisos.
            </p>
          </div>
        </div>
      </div>

      {/* Barra simulada del menú */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="flex items-stretch overflow-x-auto">
          {MENU_MAESTRO.map((group) => {
            const GIcon = group.icon;
            const isOpen = open === group.label;
            return (
              <button
                key={group.label}
                onClick={() => setOpen(isOpen ? null : group.label)}
                onMouseEnter={() => setOpen(group.label)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  isOpen
                    ? "bg-slate-700 text-white border-b-2"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white border-transparent"
                }`}
                style={isOpen ? { borderBottomColor: group.color } : {}}
              >
                <GIcon size={15} style={{ color: group.color }} />
                {group.label}
                <ChevronDown size={12} className={`transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Área de dropdown */}
      <div
        className="relative bg-slate-50 min-h-[340px]"
        onMouseLeave={() => setOpen(null)}
      >
        {open ? (
          <MegaDropdown group={MENU_MAESTRO.find((g) => g.label === open)} />
        ) : (
          <div className="flex items-center justify-center h-[340px] text-center px-8">
            <div className="max-w-md">
              <Sparkles size={36} className="text-violet-400 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Pasá el mouse sobre cualquiera de los 11 grupos para ver su submenú.
              </p>
              <p className="text-slate-400 text-xs mt-2">
                <b>Inicio → Ventas → E-commerce → Catálogo & Stock → Compras → Importación → Administración → CRM → Reportes → RRHH → Sistema</b>
              </p>
              <div className="grid grid-cols-3 gap-3 mt-6 text-left">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-700 mb-1">✅ Multi-perfil</div>
                  <div className="text-[11px] text-slate-500">POS, B2B, admin, import y e-com conviven en una misma barra.</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-700 mb-1">✅ Mega-dropdown</div>
                  <div className="text-[11px] text-slate-500">Sub-columnas por dominio, badges en vivo de pendientes.</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-700 mb-1">✅ Permisos</div>
                  <div className="text-[11px] text-slate-500">Cada usuario ve solo los grupos de sus módulos activos.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MegaDropdown({ group }) {
  if (!group) return null;
  const GIcon = group.icon;

  return (
    <div className="bg-white border-b border-slate-200 shadow-inner p-6 animate-fadeIn">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${group.color}20` }}
        >
          <GIcon size={20} style={{ color: group.color }} />
        </div>
        <h4 className="text-lg font-bold text-slate-800">{group.label}</h4>
      </div>

      {group.sub ? (
        <div className="grid grid-cols-3 gap-6">
          {group.sub.map((col) => (
            <div key={col.titulo}>
              <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                {col.titulo}
              </div>
              <div className="space-y-1">
                {col.items.map((it) => {
                  const IIcon = it.icon;
                  return (
                    <button
                      key={it.label}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition group"
                    >
                      <IIcon size={14} style={{ color: group.color }} />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900 flex-1 truncate">
                        {it.label}
                      </span>
                      {it.badge && (
                        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
                          {it.badge}
                        </span>
                      )}
                      <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {group.items.map((it) => {
            const IIcon = it.icon;
            return (
              <button
                key={it.label}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left transition group"
              >
                <IIcon size={14} style={{ color: group.color }} />
                <span className="text-sm text-slate-700 group-hover:text-slate-900 flex-1 truncate">
                  {it.label}
                </span>
                {it.badge && (
                  <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
                    {it.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function PropuestasPage() {
  const [tab, setTab] = useState("maestro");

  const tabs = [
    { id: "maestro", label: "⭐ Menú Unificado", color: "#7c3aed" },
    { id: "minorista", label: "🏪 Minorista", color: PROPUESTA_MINORISTA.color },
    { id: "mayorista", label: "🤝 Mayorista", color: PROPUESTA_MAYORISTA.color },
    { id: "admin", label: "💵 Administración", color: PROPUESTA_ADMIN.color },
    { id: "importacion", label: "🚢 Importación", color: PROPUESTA_IMPORTACION.color },
    { id: "ecommerce", label: "🌐 E-commerce", color: PROPUESTA_ECOMMERCE.color },
    { id: "todas", label: "Todas a la vez" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
            <Lightbulb size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Propuestas de Menú</h1>
            <p className="text-sm text-slate-500">
              Laboratorio de diseño de la navegación principal del ERP. Seleccioná una propuesta para explorarla, o mirá todas juntas al final.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id
                ? "bg-slate-900 text-white shadow"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "maestro" && <MenuMaestro />}
      {tab === "minorista" && <PropuestaCard propuesta={PROPUESTA_MINORISTA} />}
      {tab === "mayorista" && <PropuestaCard propuesta={PROPUESTA_MAYORISTA} />}
      {tab === "admin" && <PropuestaCard propuesta={PROPUESTA_ADMIN} />}
      {tab === "importacion" && <PropuestaCard propuesta={PROPUESTA_IMPORTACION} />}
      {tab === "ecommerce" && <PropuestaCard propuesta={PROPUESTA_ECOMMERCE} />}
      {tab === "todas" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROPUESTAS_INDIVIDUALES.map((p) => (
            <PropuestaCard key={p.id} propuesta={p} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          ¿Cuál elegimos?
        </h3>
        <ul className="text-sm text-slate-600 space-y-1.5 ml-6 list-disc">
          <li>Las 5 propuestas temáticas muestran el <b>criterio editorial</b> ideal para cada perfil (POS, B2B, admin, import, e-com).</li>
          <li>El <b>Menú Unificado</b> integra los 5 en una sola barra superior con mega-dropdowns — cada usuario solo ve los grupos de los módulos a los que tiene permiso.</li>
          <li>Compatible con la arquitectura actual: cada ítem puede mapearse 1:1 con un slug de <code className="bg-white px-1 rounded">MODULES_CATALOG</code>.</li>
          <li>Los <b>badges rojos</b> muestran cantidades en vivo (pedidos pendientes, OPs, reclamos, etc.) para que el usuario vea lo urgente sin abrir cada sección.</li>
        </ul>
      </div>
    </div>
  );
}
