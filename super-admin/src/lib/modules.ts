export type Categoria = 'core' | 'operaciones' | 'integraciones' | 'reportes'

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
  {
    slug: 'auth',
    nombre: 'Auth & Usuarios',
    descripcion: 'Login seguro, sesiones JWT y control de acceso por roles.',
    categoria: 'core',
    precioUsd: 0,
    icono: 'Shield',
    color: '#6366f1',
    dependencias: [],
    rubros: ['todas'],
    esCore: true,
    orden: 1,
  },
  {
    slug: 'empresas',
    nombre: 'Multi-empresa',
    descripcion: 'Branding white-label, separación por empresa y configuración de tenant.',
    categoria: 'core',
    precioUsd: 0,
    icono: 'Building2',
    color: '#8b5cf6',
    dependencias: [],
    rubros: ['todas'],
    esCore: true,
    orden: 2,
  },
  {
    slug: 'notificaciones',
    nombre: 'Notificaciones & Auditoría',
    descripcion: 'Alertas internas, eventos del sistema y trazabilidad administrativa.',
    categoria: 'core',
    precioUsd: 0,
    icono: 'Bell',
    color: '#a78bfa',
    dependencias: [],
    rubros: ['todas'],
    esCore: true,
    orden: 3,
  },
  {
    slug: 'catalogo',
    nombre: 'Catálogo & Proveedores',
    descripcion: 'Productos, variantes, proveedores y comparador de artículos/precios.',
    categoria: 'operaciones',
    precioUsd: 15,
    icono: 'Package',
    color: '#0ea5e9',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 10,
  },
  {
    slug: 'locales',
    nombre: 'Locales & Sucursales',
    descripcion: 'Alta y gestión de sucursales con operación separada por local.',
    categoria: 'operaciones',
    precioUsd: 8,
    icono: 'MapPin',
    color: '#0284c7',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 11,
  },
  {
    slug: 'usuarios',
    nombre: 'Usuarios',
    descripcion: 'ABM de usuarios, permisos y operadores por empresa.',
    categoria: 'operaciones',
    precioUsd: 0,
    icono: 'Users',
    color: '#64748b',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 12,
  },
  {
    slug: 'compras',
    nombre: 'Compras',
    descripcion: 'Notas de pedido, facturas de proveedor, remitos e ingreso de mercadería.',
    categoria: 'operaciones',
    precioUsd: 25,
    icono: 'ShoppingCart',
    color: '#16a34a',
    dependencias: ['catalogo'],
    rubros: ['todas'],
    esCore: false,
    orden: 20,
  },
  {
    slug: 'pagos',
    nombre: 'Gestión de Pagos',
    descripcion: 'Pagos a proveedores, vencimientos y seguimiento administrativo.',
    categoria: 'operaciones',
    precioUsd: 20,
    icono: 'Banknote',
    color: '#ca8a04',
    dependencias: ['compras'],
    rubros: ['todas'],
    esCore: false,
    orden: 21,
  },
  {
    slug: 'stock',
    nombre: 'Control de Stock',
    descripcion: 'Inventario, ajustes, movimientos y depósito por local.',
    categoria: 'operaciones',
    precioUsd: 20,
    icono: 'Boxes',
    color: '#d97706',
    dependencias: ['catalogo'],
    rubros: ['todas'],
    esCore: false,
    orden: 22,
  },
  {
    slug: 'ventas',
    nombre: 'Facturación & Ventas',
    descripcion: 'Ventas, comprobantes, cobranzas y circuitos de facturación.',
    categoria: 'operaciones',
    precioUsd: 25,
    icono: 'Receipt',
    color: '#b45309',
    dependencias: ['catalogo', 'stock'],
    rubros: ['todas'],
    esCore: false,
    orden: 23,
  },
  {
    slug: 'transporte',
    nombre: 'Logística & Transporte',
    descripcion: 'Gestión de transportistas, envíos y entregas vinculadas a ventas.',
    categoria: 'operaciones',
    precioUsd: 12,
    icono: 'Truck',
    color: '#78716c',
    dependencias: ['ventas'],
    rubros: ['todas'],
    esCore: false,
    orden: 24,
  },
  {
    slug: 'kanban',
    nombre: 'TrellOutdoor',
    descripcion: 'Tablero operativo para tareas, seguimiento interno y coordinación.',
    categoria: 'operaciones',
    precioUsd: 10,
    icono: 'LayoutDashboard',
    color: '#d946ef',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 25,
  },
  {
    slug: 'ot',
    nombre: 'Órdenes de Trabajo',
    descripcion: 'Dashboard de taller, OTs, clientes taller y repuestos.',
    categoria: 'operaciones',
    precioUsd: 30,
    icono: 'Wrench',
    color: '#f97316',
    dependencias: ['catalogo', 'crm'],
    rubros: ['mecanico'],
    esCore: false,
    orden: 26,
  },
  {
    slug: 'crm',
    nombre: 'CRM / Clientes',
    descripcion: 'Clientes, historial y seguimiento comercial/operativo.',
    categoria: 'operaciones',
    precioUsd: 20,
    icono: 'Users',
    color: '#ec4899',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 27,
  },
  {
    slug: 'completados',
    nombre: 'Completados',
    descripcion: 'Vista histórica de pedidos y procesos finalizados.',
    categoria: 'operaciones',
    precioUsd: 5,
    icono: 'CheckCircle2',
    color: '#22c55e',
    dependencias: ['compras'],
    rubros: ['todas'],
    esCore: false,
    orden: 28,
  },
  {
    slug: 'sync',
    nombre: 'Sincronización Offline',
    descripcion: 'Sync de datos entre dispositivos y recuperación al reconectar.',
    categoria: 'integraciones',
    precioUsd: 30,
    icono: 'RefreshCw',
    color: '#3b82f6',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 40,
  },
  {
    slug: 'socios',
    nombre: 'Socios Montagne',
    descripcion: 'Seguimiento de socios y franquicias Montagne.',
    categoria: 'integraciones',
    precioUsd: 25,
    icono: 'MessageCircle',
    color: '#10b981',
    dependencias: [],
    rubros: ['indumentaria'],
    esCore: false,
    orden: 41,
  },
  {
    slug: 'reportes',
    nombre: 'Reportes & Analytics',
    descripcion: 'Indicadores, gráficos y análisis de operación.',
    categoria: 'reportes',
    precioUsd: 20,
    icono: 'BarChart3',
    color: '#f59e0b',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 50,
  },
  {
    slug: 'monitoreo',
    nombre: 'Monitoreo del Sistema',
    descripcion: 'Salud del backend, base de datos, CPU, RAM y tiempos de respuesta.',
    categoria: 'reportes',
    precioUsd: 8,
    icono: 'Activity',
    color: '#64748b',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 51,
  },
  {
    slug: 'supertrend',
    nombre: 'SuperTrend',
    descripcion: 'Seguimiento competitivo, tendencias y dashboard de señales.',
    categoria: 'reportes',
    precioUsd: 25,
    icono: 'TrendingUp',
    color: '#d946ef',
    dependencias: [],
    rubros: ['todas'],
    esCore: false,
    orden: 52,
  },
]

export const MODULOS_POR_CATEGORIA = {
  core: MODULOS.filter(m => m.categoria === 'core'),
  operaciones: MODULOS.filter(m => m.categoria === 'operaciones'),
  integraciones: MODULOS.filter(m => m.categoria === 'integraciones'),
  reportes: MODULOS.filter(m => m.categoria === 'reportes'),
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
