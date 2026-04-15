"""
Module model — sistema de módulos activables por empresa
"""

from sqlalchemy import String, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


# Módulos predefinidos del sistema
MODULES_CATALOG = [
    {
        "slug":        "COMPRAS",
        "nombre":      "Compras",
        "descripcion": "Notas de pedido, facturas de proveedor, gestión de remitos.",
        "rutas":       ["/pedidos-compras", "/facturas-proveedor", "/ingreso", "/recepcion", "/resumen"],
        "icono":       "ShoppingCart",
        "color":       "#3b82f6",
    },
    {
        "slug":        "PAGOS",
        "nombre":      "Gestión de Pagos",
        "descripcion": "Control de pagos a proveedores, vencimientos, vouchers.",
        "rutas":       ["/gestion-pagos"],
        "icono":       "CreditCard",
        "color":       "#8b5cf6",
    },
    {
        "slug":        "STOCK",
        "nombre":      "Stock",
        "descripcion": "Inventario, ajustes de stock, movimientos.",
        "rutas":       ["/stock"],
        "icono":       "Warehouse",
        "color":       "#10b981",
    },
    {
        "slug":        "VENTAS",
        "nombre":      "Ventas / Facturación",
        "descripcion": "Emisión de comprobantes, ventas, POS táctil.",
        "rutas":       ["/facturacion", "/pos"],
        "icono":       "FileText",
        "color":       "#f59e0b",
    },
    {
        "slug":        "TRANSPORTE",
        "nombre":      "Transporte",
        "descripcion": "Gestión de envíos, transportistas, tracking.",
        "rutas":       ["/transporte"],
        "icono":       "Truck",
        "color":       "#06b6d4",
    },
    {
        "slug":        "KANBAN",
        "nombre":      "TrellOutdoor (Kanban)",
        "descripcion": "Tablero de tareas y proyectos estilo Trello.",
        "rutas":       ["/kanban"],
        "icono":       "Kanban",
        "color":       "#ec4899",
    },
    {
        "slug":        "REPORTES",
        "nombre":      "Estadísticas / Reportes",
        "descripcion": "Gráficos, reportes de ventas, compras y stock.",
        "rutas":       ["/reportes"],
        "icono":       "BarChart3",
        "color":       "#f97316",
    },
    {
        "slug":        "SOCIOS",
        "nombre":      "Socios Montagne",
        "descripcion": "Bot de socios, seguimiento de franquicias, envío WhatsApp.",
        "rutas":       ["/socios-montagne"],
        "icono":       "UserCheck",
        "color":       "#25d366",
    },
    {
        "slug":        "CATALOGO",
        "nombre":      "Catálogo (Productos/Proveedores)",
        "descripcion": "ABM de productos, variantes, proveedores, listas de precios.",
        "rutas":       ["/productos", "/proveedores", "/comparador"],
        "icono":       "ShoppingBag",
        "color":       "#6366f1",
    },
    {
        "slug":        "LOCALES",
        "nombre":      "Locales",
        "descripcion": "ABM de locales y sucursales.",
        "rutas":       ["/locales"],
        "icono":       "Store",
        "color":       "#84cc16",
    },
    {
        "slug":        "USUARIOS",
        "nombre":      "Usuarios",
        "descripcion": "ABM de usuarios y roles.",
        "rutas":       ["/usuarios"],
        "icono":       "Users",
        "color":       "#64748b",
    },
    {
        "slug":        "MONITOREO",
        "nombre":      "Monitoreo del sistema",
        "descripcion": "CPU, RAM, DB, tiempos de API.",
        "rutas":       ["/monitoreo"],
        "icono":       "Activity",
        "color":       "#ef4444",
    },
    {
        "slug":        "SUPERTREND",
        "nombre":      "SuperTrend (Análisis de Competencia)",
        "descripcion": "Seguimiento de precios de competidores, indicadores de tendencia de mercado y análisis competitivo por rubro.",
        "rutas":       ["/supertrend"],
        "icono":       "TrendingUp",
        "color":       "#d946ef",
    },
    {
        "slug":        "OT",
        "nombre":      "Órdenes de Trabajo",
        "descripcion": "Gestión de órdenes de trabajo: recepción, diagnóstico, presupuesto, ejecución, entrega.",
        "rutas":       ["/ordenes-trabajo"],
        "icono":       "Wrench",
        "color":       "#0ea5e9",
    },
    {
        "slug":        "SYNC",
        "nombre":      "Sincronización",
        "descripcion": "Motor de sincronización offline-first, registro de dispositivos, conflictos.",
        "rutas":       ["/sync-status"],
        "icono":       "RefreshCw",
        "color":       "#7c3aed",
    },
    {
        "slug":        "CRM",
        "nombre":      "CRM Completo",
        "descripcion": "Gestión de clientes 360°, club de fidelización, inbox multi-canal, campañas, publicidad, contenido, analytics, integraciones y asistente IA.",
        "rutas":       ["/crm", "/crm/clientes", "/crm/mensajes", "/crm/club", "/crm/campanas", "/crm/publicidad", "/crm/contenido", "/crm/analytics", "/crm/integraciones", "/crm/ai", "/crm/dragonfish", "/crm/meli-indumentaria", "/crm/meli-neuquen", "/crm/vtex", "/crm/vtex-inactivos", "/crm/reportes"],
        "icono":       "Users",
        "color":       "#0891b2",
    },
    {
        "slug":        "COMPLETADOS",
        "nombre":      "Completados",
        "descripcion": "Historial de pedidos y facturas completados.",
        "rutas":       ["/completados"],
        "icono":       "CheckCircle",
        "color":       "#22c55e",
    },
    {
        "slug":        "PUNTUACION_EMPLEADOS",
        "nombre":      "Puntuación de Empleados",
        "descripcion": "Evaluación periódica de empleados: puntualidad, actitud, ventas y más.",
        "rutas":       ["/puntuacion-empleados"],
        "icono":       "Star",
        "color":       "#f59e0b",
    },
    {
        "slug":        "MEJORAS",
        "nombre":      "Mejoras del ERP",
        "descripcion": "Tablero de sugerencias de mejora organizadas por módulo. Aprobación y ejecución automática vía Copilot.",
        "rutas":       ["/mejoras"],
        "icono":       "Lightbulb",
        "color":       "#8b5cf6",
    },
    {
        "slug":        "INFORMES",
        "nombre":      "Informes y Estadísticas",
        "descripcion": "Reportes de ventas, empleados, stock, medios de pago, MercadoLibre y más. Datos en tiempo real desde SQL Server.",
        "rutas":       ["/informes"],
        "icono":       "FileBarChart",
        "color":       "#0ea5e9",
    },
    {
        "slug":        "MERCADOLIBRE",
        "nombre":      "MercadoLibre — Depósito",
        "descripcion": "Picking de órdenes ML, asignación automática de depósitos, stock Dragonfish, scanner, impresión y estadísticas.",
        "rutas":       ["/mercadolibre"],
        "icono":       "ShoppingCart",
        "color":       "#ffe600",
    },
    {
        "slug":        "IMPORTACION",
        "nombre":      "Importación",
        "descripcion": "Gestión de órdenes de importación: embarque, tránsito, aduana, liquidación de costos.",
        "rutas":       ["/importacion"],
        "icono":       "Ship",
        "color":       "#0369a1",
    },
    {
        "slug":        "MENSAJES",
        "nombre":      "Mensajes",
        "descripcion": "Chat interno entre usuarios del ERP, notificaciones y comunicación en tiempo real.",
        "rutas":       ["/mensajes"],
        "icono":       "MessageSquare",
        "color":       "#7c3aed",
    },
    {
        "slug":        "CONSULTAS",
        "nombre":      "Consultas ERP",
        "descripcion": "Consulta rápida de precios, stock, artículos y proveedores por código o descripción.",
        "rutas":       ["/consultas"],
        "icono":       "Search",
        "color":       "#059669",
    },
    {
        "slug":        "RRHH",
        "nombre":      "Recursos Humanos",
        "descripcion": "Gestión de empleados, asistencia, liquidación de sueldos y comisiones.",
        "rutas":       ["/rrhh", "/naaloo", "/comisiones"],
        "icono":       "UserCheck",
        "color":       "#dc2626",
    },
    # ── Compras — sub-módulos granulares ─────────────────────────────────
    {
        "slug":        "RESUMEN",
        "nombre":      "Resumen",
        "descripcion": "Vista general del estado de compras y operaciones.",
        "rutas":       ["/resumen"],
        "icono":       "Activity",
        "color":       "#3b82f6",
    },
    {
        "slug":        "NOTAS_PEDIDO",
        "nombre":      "Notas de Pedido",
        "descripcion": "Pedidos a proveedores y seguimiento.",
        "rutas":       ["/pedidos-compras"],
        "icono":       "ShoppingCart",
        "color":       "#2563eb",
    },
    {
        "slug":        "FACTURAS_PROVEEDOR",
        "nombre":      "Facturas / Remitos",
        "descripcion": "Facturas de proveedor y remitos de entrada.",
        "rutas":       ["/facturas-proveedor"],
        "icono":       "Receipt",
        "color":       "#1d4ed8",
    },
    {
        "slug":        "INGRESO",
        "nombre":      "Ingreso Mercadería",
        "descripcion": "Recepción física de mercadería en depósito.",
        "rutas":       ["/ingreso"],
        "icono":       "Package",
        "color":       "#1e40af",
    },
    {
        "slug":        "RECEPCION",
        "nombre":      "Recepción",
        "descripcion": "Control de recepción y verificación de bultos.",
        "rutas":       ["/recepcion"],
        "icono":       "PackageCheck",
        "color":       "#1e3a8a",
    },
    # ── Stock — sub-módulos granulares ───────────────────────────────────
    {
        "slug":        "DEPOSITO",
        "nombre":      "Depósito",
        "descripcion": "Gestión del depósito, ubicaciones y movimientos.",
        "rutas":       ["/deposito"],
        "icono":       "Boxes",
        "color":       "#d97706",
    },
    # ── Catálogo — sub-módulos granulares ────────────────────────────────
    {
        "slug":        "COMPARADOR",
        "nombre":      "Comparador Precios",
        "descripcion": "Comparación de precios entre proveedores.",
        "rutas":       ["/comparador"],
        "icono":       "GitCompare",
        "color":       "#6366f1",
    },
    {
        "slug":        "PRODUCTOS",
        "nombre":      "Productos",
        "descripcion": "Catálogo de productos y variantes.",
        "rutas":       ["/productos"],
        "icono":       "ShoppingBag",
        "color":       "#4f46e5",
    },
    {
        "slug":        "PROVEEDORES",
        "nombre":      "Proveedores",
        "descripcion": "ABM de proveedores.",
        "rutas":       ["/proveedores"],
        "icono":       "Truck",
        "color":       "#4338ca",
    },
    # ── RRHH — sub-módulos granulares ────────────────────────────────────
    {
        "slug":        "NAALOO",
        "nombre":      "Naaloo — Portal Empleado",
        "descripcion": "Portal de autoservicio para empleados: buzón de entrada, fichaje, ausencias, eventos, feed social y documentos.",
        "rutas":       ["/naaloo"],
        "icono":       "CalendarDays",
        "color":       "#7c3aed",
    },
    {
        "slug":        "COMISIONES",
        "nombre":      "Comisiones",
        "descripcion": "Cálculo y seguimiento de comisiones de vendedores.",
        "rutas":       ["/comisiones"],
        "icono":       "BadgeDollarSign",
        "color":       "#dc2626",
    },
    # ── Reportes — sub-módulos granulares ────────────────────────────────
    {
        "slug":        "ESTADISTICAS",
        "nombre":      "Estadísticas",
        "descripcion": "Indicadores y gráficos estadísticos.",
        "rutas":       ["/reportes"],
        "icono":       "BarChart3",
        "color":       "#f97316",
    },
]


class CompanyModule(Base, TimestampMixin):
    __tablename__ = "company_modules"
    __table_args__ = (UniqueConstraint("company_id", "module_slug", name="uq_company_module"),)

    id:           Mapped[int]  = mapped_column(primary_key=True, autoincrement=True)
    company_id:   Mapped[int]  = mapped_column(ForeignKey("companies.id"), nullable=False)
    module_slug:  Mapped[str]  = mapped_column(String(50), nullable=False)
    is_active:    Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    custom_name:  Mapped[str | None] = mapped_column(String(200))   # nombre personalizado opcional

    company = relationship("Company", lazy="select")
