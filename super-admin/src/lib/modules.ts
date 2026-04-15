export type Categoria = 'core' | 'operaciones' | 'integraciones' | 'reportes' | 'crm'

export type Rubro =
  | 'todas'
  | 'indumentaria'
  | 'mecanico'
  | 'kiosco'
  | 'deposito'
  | 'restaurante'
  | 'ferreteria'
  | 'farmacia'
  | 'libreria'
  | 'otro'

export interface Modulo {
  slug: string
  nombre: string
  descripcion: string
  categoria: Categoria
  precioUsd: number
  icono: string
  color: string
  dependencias: string[]
  rubros: Rubro[]
  esCore: boolean
  orden: number
}

export const MODULOS: Modulo[] = [
  // ── CORE ────────────────────────────────────────────────────────────────────
  {
    slug: 'AUTH', nombre: 'Auth & Usuarios', descripcion: 'Login seguro, sesiones JWT y control de acceso por roles.',
    categoria: 'core', precioUsd: 0, icono: 'Shield', color: '#6366f1', dependencias: [], rubros: ['todas'], esCore: true, orden: 1,
  },
  {
    slug: 'EMPRESAS', nombre: 'Multi-empresa', descripcion: 'Branding white-label, separación por empresa y configuración de tenant.',
    categoria: 'core', precioUsd: 0, icono: 'Building2', color: '#8b5cf6', dependencias: [], rubros: ['todas'], esCore: true, orden: 2,
  },
  {
    slug: 'NOTIFICACIONES', nombre: 'Notificaciones & Auditoría', descripcion: 'Alertas internas, eventos del sistema y trazabilidad administrativa.',
    categoria: 'core', precioUsd: 0, icono: 'Bell', color: '#a78bfa', dependencias: [], rubros: ['todas'], esCore: true, orden: 3,
  },

  // ── OPERACIONES ──────────────────────────────────────────────────────────────
  {
    slug: 'LOCALES', nombre: 'Locales & Sucursales', descripcion: 'Alta y gestión de sucursales con operación separada por local.',
    categoria: 'operaciones', precioUsd: 8, icono: 'MapPin', color: '#0284c7', dependencias: [], rubros: ['todas'], esCore: false, orden: 10,
  },
  {
    slug: 'USUARIOS', nombre: 'Usuarios', descripcion: 'ABM de usuarios, permisos y operadores por empresa.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Users', color: '#64748b', dependencias: [], rubros: ['todas'], esCore: false, orden: 11,
  },
  // Compras (grupo)
  {
    slug: 'COMPRAS', nombre: 'Compras (grupo)', descripcion: 'Habilita todo el módulo de compras: pedidos, facturas, ingreso, recepción y resumen.',
    categoria: 'operaciones', precioUsd: 25, icono: 'ShoppingCart', color: '#3b82f6', dependencias: ['CATALOGO'], rubros: ['todas'], esCore: false, orden: 20,
  },
  {
    slug: 'RESUMEN', nombre: 'Resumen', descripcion: 'Vista general del estado de compras y operaciones.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Activity', color: '#3b82f6', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 21,
  },
  {
    slug: 'NOTAS_PEDIDO', nombre: 'Notas de Pedido', descripcion: 'Pedidos a proveedores y seguimiento.',
    categoria: 'operaciones', precioUsd: 0, icono: 'ShoppingCart', color: '#2563eb', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 22,
  },
  {
    slug: 'FACTURAS_PROVEEDOR', nombre: 'Facturas / Remitos', descripcion: 'Facturas de proveedor y remitos de entrada.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Receipt', color: '#1d4ed8', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 23,
  },
  {
    slug: 'INGRESO', nombre: 'Ingreso Mercadería', descripcion: 'Recepción física de mercadería en depósito.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Package', color: '#1e40af', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 24,
  },
  {
    slug: 'RECEPCION', nombre: 'Recepción', descripcion: 'Control de recepción y verificación de bultos.',
    categoria: 'operaciones', precioUsd: 0, icono: 'PackageCheck', color: '#1e3a8a', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 25,
  },
  {
    slug: 'IMPORTACION', nombre: 'Importación', descripcion: 'Gestión de órdenes de importación: embarque, tránsito, aduana, liquidación.',
    categoria: 'operaciones', precioUsd: 15, icono: 'Ship', color: '#0369a1', dependencias: [], rubros: ['todas'], esCore: false, orden: 26,
  },
  {
    slug: 'PAGOS', nombre: 'Gestión de Pagos', descripcion: 'Pagos a proveedores, vencimientos y seguimiento administrativo.',
    categoria: 'operaciones', precioUsd: 20, icono: 'Banknote', color: '#ca8a04', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 30,
  },
  // Catálogo (grupo)
  {
    slug: 'CATALOGO', nombre: 'Catálogo (grupo)', descripcion: 'Habilita catálogo completo: productos, proveedores y comparador.',
    categoria: 'operaciones', precioUsd: 15, icono: 'Package', color: '#0ea5e9', dependencias: [], rubros: ['todas'], esCore: false, orden: 40,
  },
  {
    slug: 'PRODUCTOS', nombre: 'Productos', descripcion: 'Catálogo de productos y variantes.',
    categoria: 'operaciones', precioUsd: 0, icono: 'ShoppingBag', color: '#4f46e5', dependencias: ['CATALOGO'], rubros: ['todas'], esCore: false, orden: 41,
  },
  {
    slug: 'PROVEEDORES', nombre: 'Proveedores', descripcion: 'ABM de proveedores.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Truck', color: '#4338ca', dependencias: ['CATALOGO'], rubros: ['todas'], esCore: false, orden: 42,
  },
  {
    slug: 'COMPARADOR', nombre: 'Comparador Precios', descripcion: 'Comparación de precios entre proveedores.',
    categoria: 'operaciones', precioUsd: 0, icono: 'GitCompare', color: '#6366f1', dependencias: ['CATALOGO'], rubros: ['todas'], esCore: false, orden: 43,
  },
  // Stock
  {
    slug: 'STOCK', nombre: 'Stock', descripcion: 'Inventario, ajustes, movimientos por local.',
    categoria: 'operaciones', precioUsd: 20, icono: 'Boxes', color: '#d97706', dependencias: ['CATALOGO'], rubros: ['todas'], esCore: false, orden: 50,
  },
  {
    slug: 'DEPOSITO', nombre: 'Depósito', descripcion: 'Gestión del depósito, ubicaciones y movimientos.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Warehouse', color: '#b45309', dependencias: ['STOCK'], rubros: ['todas'], esCore: false, orden: 51,
  },
  // Ventas
  {
    slug: 'VENTAS', nombre: 'Facturación', descripcion: 'Ventas, comprobantes, cobranzas y circuitos de facturación.',
    categoria: 'operaciones', precioUsd: 25, icono: 'Receipt', color: '#b45309', dependencias: ['CATALOGO', 'STOCK'], rubros: ['todas'], esCore: false, orden: 55,
  },
  {
    slug: 'CONSULTAS', nombre: 'Consultas ERP', descripcion: 'Consulta rápida de precios, stock, artículos y proveedores.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Search', color: '#059669', dependencias: [], rubros: ['todas'], esCore: false, orden: 56,
  },
  {
    slug: 'TRANSPORTE', nombre: 'Transporte', descripcion: 'Gestión de transportistas, envíos y entregas vinculadas a ventas.',
    categoria: 'operaciones', precioUsd: 12, icono: 'Truck', color: '#78716c', dependencias: ['VENTAS'], rubros: ['todas'], esCore: false, orden: 57,
  },
  {
    slug: 'COMPLETADOS', nombre: 'Completados', descripcion: 'Vista histórica de pedidos y procesos finalizados.',
    categoria: 'operaciones', precioUsd: 5, icono: 'CheckCircle2', color: '#22c55e', dependencias: ['COMPRAS'], rubros: ['todas'], esCore: false, orden: 58,
  },
  // RRHH
  {
    slug: 'RRHH', nombre: 'RRHH (grupo)', descripcion: 'Gestión de empleados, asistencia, liquidación de sueldos y comisiones.',
    categoria: 'operaciones', precioUsd: 15, icono: 'UserCheck', color: '#dc2626', dependencias: [], rubros: ['todas'], esCore: false, orden: 60,
  },
  {
    slug: 'COMISIONES', nombre: 'Comisiones', descripcion: 'Cálculo y seguimiento de comisiones de vendedores.',
    categoria: 'operaciones', precioUsd: 0, icono: 'BadgeDollarSign', color: '#b91c1c', dependencias: ['RRHH'], rubros: ['todas'], esCore: false, orden: 61,
  },
  {
    slug: 'PUNTUACION_EMPLEADOS', nombre: 'Puntuación Empleados', descripcion: 'Evaluación periódica: puntualidad, actitud, ventas.',
    categoria: 'operaciones', precioUsd: 5, icono: 'Star', color: '#f59e0b', dependencias: [], rubros: ['todas'], esCore: false, orden: 62,
  },
  // Otros operativos
  {
    slug: 'KANBAN', nombre: 'TrelloOutdoor', descripcion: 'Tablero operativo para tareas, seguimiento interno y coordinación.',
    categoria: 'operaciones', precioUsd: 10, icono: 'LayoutDashboard', color: '#d946ef', dependencias: [], rubros: ['todas'], esCore: false, orden: 70,
  },
  {
    slug: 'OT', nombre: 'Órdenes de Trabajo', descripcion: 'Dashboard de taller, OTs, clientes taller y repuestos.',
    categoria: 'operaciones', precioUsd: 30, icono: 'Wrench', color: '#f97316', dependencias: ['CATALOGO', 'CRM'], rubros: ['mecanico'], esCore: false, orden: 71,
  },
  {
    slug: 'MEJORAS', nombre: 'Mejoras del ERP', descripcion: 'Tablero de sugerencias de mejora. Aprobación vía Copilot.',
    categoria: 'operaciones', precioUsd: 0, icono: 'Lightbulb', color: '#8b5cf6', dependencias: [], rubros: ['todas'], esCore: false, orden: 72,
  },
  {
    slug: 'MENSAJES', nombre: 'Mensajes', descripcion: 'Chat interno entre usuarios del ERP.',
    categoria: 'operaciones', precioUsd: 0, icono: 'MessageSquare', color: '#7c3aed', dependencias: [], rubros: ['todas'], esCore: false, orden: 73,
  },

  // ── INTEGRACIONES ────────────────────────────────────────────────────────────
  {
    slug: 'SYNC', nombre: 'Estado Sync', descripcion: 'Sync de datos entre dispositivos y recuperación al reconectar.',
    categoria: 'integraciones', precioUsd: 30, icono: 'RefreshCw', color: '#3b82f6', dependencias: [], rubros: ['todas'], esCore: false, orden: 80,
  },
  {
    slug: 'SOCIOS', nombre: 'Socios Montagne', descripcion: 'Seguimiento de socios y franquicias Montagne.',
    categoria: 'integraciones', precioUsd: 25, icono: 'MessageCircle', color: '#10b981', dependencias: [], rubros: ['indumentaria'], esCore: false, orden: 81,
  },
  {
    slug: 'MERCADOLIBRE', nombre: 'MercadoLibre', descripcion: 'Picking de órdenes ML, asignación de depósitos, scanner, impresión.',
    categoria: 'integraciones', precioUsd: 20, icono: 'ShoppingCart', color: '#ffe600', dependencias: [], rubros: ['todas'], esCore: false, orden: 82,
  },
  {
    slug: 'ML_INDUMENTARIA', nombre: 'ML Indumentaria', descripcion: 'Gestión MercadoLibre para indumentaria.',
    categoria: 'integraciones', precioUsd: 0, icono: 'Store', color: '#fbbf24', dependencias: ['MERCADOLIBRE'], rubros: ['indumentaria'], esCore: false, orden: 83,
  },
  {
    slug: 'ML_NEUQUEN', nombre: 'ML Neuquén', descripcion: 'Cuenta MercadoLibre Neuquén.',
    categoria: 'integraciones', precioUsd: 0, icono: 'Store', color: '#f59e0b', dependencias: ['MERCADOLIBRE'], rubros: ['todas'], esCore: false, orden: 84,
  },
  {
    slug: 'VTEX_CANAL', nombre: 'VTEX Canal', descripcion: 'Gestión del canal de ventas VTEX.',
    categoria: 'integraciones', precioUsd: 15, icono: 'Store', color: '#7c3aed', dependencias: [], rubros: ['todas'], esCore: false, orden: 85,
  },
  {
    slug: 'VTEX_INACTIVOS', nombre: 'VTEX Inactivos', descripcion: 'Publicaciones inactivas en VTEX.',
    categoria: 'integraciones', precioUsd: 0, icono: 'Users', color: '#6d28d9', dependencias: ['VTEX_CANAL'], rubros: ['todas'], esCore: false, orden: 86,
  },

  // ── REPORTES ─────────────────────────────────────────────────────────────────
  {
    slug: 'ESTADISTICAS', nombre: 'Estadísticas', descripcion: 'Indicadores y gráficos estadísticos.',
    categoria: 'reportes', precioUsd: 0, icono: 'BarChart3', color: '#f97316', dependencias: [], rubros: ['todas'], esCore: false, orden: 90,
  },
  {
    slug: 'REPORTES', nombre: 'Reportes & Analytics (grupo)', descripcion: 'Habilita todos los reportes e indicadores de operación.',
    categoria: 'reportes', precioUsd: 20, icono: 'BarChart3', color: '#f59e0b', dependencias: [], rubros: ['todas'], esCore: false, orden: 91,
  },
  {
    slug: 'INFORMES', nombre: 'Informes', descripcion: 'Reportes de ventas, empleados, stock, medios de pago y más.',
    categoria: 'reportes', precioUsd: 0, icono: 'FileBarChart', color: '#0ea5e9', dependencias: [], rubros: ['todas'], esCore: false, orden: 92,
  },
  {
    slug: 'MONITOREO', nombre: 'Monitoreo', descripcion: 'Salud del backend, base de datos, CPU, RAM y tiempos de respuesta.',
    categoria: 'reportes', precioUsd: 8, icono: 'Activity', color: '#64748b', dependencias: [], rubros: ['todas'], esCore: false, orden: 93,
  },
  {
    slug: 'SUPERTREND', nombre: 'SuperTrend', descripcion: 'Seguimiento competitivo, tendencias y dashboard de señales.',
    categoria: 'reportes', precioUsd: 25, icono: 'TrendingUp', color: '#d946ef', dependencias: [], rubros: ['todas'], esCore: false, orden: 94,
  },

  // ── CRM ──────────────────────────────────────────────────────────────────────
  {
    slug: 'CRM', nombre: 'CRM Completo (grupo)', descripcion: 'Habilita todo el módulo CRM: clientes, campañas, inbox, analytics.',
    categoria: 'crm', precioUsd: 20, icono: 'Users', color: '#0891b2', dependencias: [], rubros: ['todas'], esCore: false, orden: 100,
  },
  {
    slug: 'CRM_DASHBOARD', nombre: 'CRM Dashboard', descripcion: 'Panel principal del CRM.',
    categoria: 'crm', precioUsd: 0, icono: 'Users', color: '#0e7490', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 101,
  },
  {
    slug: 'CLIENTES_360', nombre: 'Clientes 360°', descripcion: 'Vista 360 de clientes y su historial.',
    categoria: 'crm', precioUsd: 0, icono: 'Users', color: '#155e75', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 102,
  },
  {
    slug: 'INBOX', nombre: 'Inbox', descripcion: 'Bandeja de mensajes y consultas de clientes.',
    categoria: 'crm', precioUsd: 0, icono: 'MessageCircle', color: '#0c4a6e', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 103,
  },
  {
    slug: 'MUNDO_CLUB', nombre: 'Mundo Club', descripcion: 'Programa de fidelidad y beneficios.',
    categoria: 'crm', precioUsd: 0, icono: 'Crown', color: '#164e63', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 104,
  },
  {
    slug: 'CAMPANAS', nombre: 'Campañas', descripcion: 'Gestión de campañas de marketing.',
    categoria: 'crm', precioUsd: 0, icono: 'Rocket', color: '#7c3aed', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 105,
  },
  {
    slug: 'PUBLICIDAD', nombre: 'Publicidad', descripcion: 'Gestión de publicidad y ads.',
    categoria: 'crm', precioUsd: 0, icono: 'Megaphone', color: '#6d28d9', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 106,
  },
  {
    slug: 'CONTENIDO', nombre: 'Contenido', descripcion: 'Creación y gestión de contenido.',
    categoria: 'crm', precioUsd: 0, icono: 'CalendarDays', color: '#5b21b6', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 107,
  },
  {
    slug: 'ANALYTICS_CRM', nombre: 'Analytics CRM', descripcion: 'Analítica avanzada del CRM.',
    categoria: 'crm', precioUsd: 0, icono: 'BarChart3', color: '#4c1d95', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 108,
  },
  {
    slug: 'INTEGRACIONES_CRM', nombre: 'Integraciones', descripcion: 'Integraciones con sistemas externos desde el CRM.',
    categoria: 'crm', precioUsd: 0, icono: 'Link2', color: '#3b0764', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 109,
  },
  {
    slug: 'ASISTENTE_IA', nombre: 'Asistente IA', descripcion: 'Asistente de inteligencia artificial.',
    categoria: 'crm', precioUsd: 0, icono: 'Bot', color: '#1e1b4b', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 110,
  },
  {
    slug: 'DRAGONFISH', nombre: 'Dragonfish', descripcion: 'Motor de análisis y competencia.',
    categoria: 'crm', precioUsd: 0, icono: 'Package', color: '#0f172a', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 111,
  },
  {
    slug: 'REPORTES_CRM', nombre: 'Reportes CRM', descripcion: 'Reportes y métricas del CRM.',
    categoria: 'crm', precioUsd: 0, icono: 'FileText', color: '#1e293b', dependencias: ['CRM'], rubros: ['todas'], esCore: false, orden: 112,
  },
]

export const MODULOS_POR_CATEGORIA = {
  core: MODULOS.filter(m => m.categoria === 'core'),
  operaciones: MODULOS.filter(m => m.categoria === 'operaciones'),
  integraciones: MODULOS.filter(m => m.categoria === 'integraciones'),
  reportes: MODULOS.filter(m => m.categoria === 'reportes'),
  crm: MODULOS.filter(m => m.categoria === 'crm'),
}

export const MODULOS_VISIBLES = MODULOS.filter(m => !m.esCore).sort((a, b) => a.orden - b.orden)

export function calcularPrecio(slugs: string[]): number {
  return MODULOS.filter(m => slugs.includes(m.slug)).reduce((sum, m) => sum + m.precioUsd, 0)
}

export function modulosParaRubro(rubro: string): Modulo[] {
  return MODULOS_VISIBLES.filter(m =>
    m.rubros.includes('todas') || m.rubros.includes(rubro as Rubro)
  )
}

export const LABEL_CATEGORIA: Record<Categoria, string> = {
  core: 'Core',
  operaciones: 'Operaciones',
  integraciones: 'Integraciones',
  reportes: 'Reportes',
  crm: 'CRM',
}

export const LABEL_RUBRO: Record<string, string> = {
  indumentaria: 'Indumentaria',
  mecanico: 'Taller / Mecánico',
  kiosco: 'Kiosco',
  deposito: 'Depósito',
  restaurante: 'Restaurante',
  ferreteria: 'Ferretería',
  farmacia: 'Farmacia',
  libreria: 'Librería',
  otro: 'Otro',
}
