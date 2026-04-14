-- ============================================================
-- 005_super_admin.sql — Catálogo de módulos, licencias y marketplace
-- Compatible: PostgreSQL 18+ (port 2048)
-- Ejecutar DESPUÉS de 001–004
-- ============================================================

-- ============================================================
-- TABLA: modulos
-- Catálogo maestro de módulos activables en la plataforma.
-- 24 módulos reales mapeados desde INVENTARIO_REAL.md (abril 2026).
-- ============================================================
CREATE TABLE IF NOT EXISTS modulos (
    id              SERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,          -- identificador técnico (usado en código)
    nombre          TEXT NOT NULL,                 -- nombre comercial visible al cliente
    descripcion     TEXT NOT NULL,                 -- descripción corta (1 línea)
    categoria       TEXT NOT NULL                  -- 'core' | 'operaciones' | 'integraciones' | 'reportes'
                    CHECK (categoria IN ('core','operaciones','integraciones','reportes')),
    precio_usd      NUMERIC(8,2) NOT NULL DEFAULT 0, -- precio mensual en USD (0 = incluido en todos los planes)
    icono           TEXT,                          -- emoji o nombre de icono Lucide
    color           TEXT,                          -- color hex para la UI del wizard
    activo          BOOLEAN NOT NULL DEFAULT true,
    visible_wizard  BOOLEAN NOT NULL DEFAULT true, -- mostrar en wizard de nueva empresa?
    dependencias    TEXT[] DEFAULT '{}',           -- slugs de módulos que debe tener activado primero
    rubros          TEXT[] DEFAULT '{"todas"}',    -- industrias donde aplica: todas | indumentaria | mecanico | kiosco | etc.
    es_core         BOOLEAN NOT NULL DEFAULT false,-- si es true, se activa siempre (no se puede desactivar)
    orden           INT NOT NULL DEFAULT 99,       -- orden de display en el wizard
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INSERTS — 24 módulos reales
-- ============================================================

-- ─── CORE (siempre incluidos, no facturable, no desactivable) ───────────────

INSERT INTO modulos (slug, nombre, descripcion, categoria, precio_usd, icono, color, dependencias, rubros, es_core, visible_wizard, orden) VALUES
('auth',
 'Auth & Usuarios',
 'Acceso seguro JWT con 12 roles granulares (ADMIN, VENDEDOR, DEPOSITO, y más)',
 'core', 0, 'Shield', '#6366f1',
 '{}', '{"todas"}', true, false, 1),

('empresas',
 'Multi-empresa',
 'Branding white-label por empresa, locales, sucursales y gestión de filiales',
 'core', 0, 'Building2', '#8b5cf6',
 '{}', '{"todas"}', true, false, 2),

('notificaciones',
 'Notificaciones & Auditoría',
 'Alertas internas, audit log de acciones y contador de novedades en tiempo real',
 'core', 0, 'Bell', '#a78bfa',
 '{}', '{"todas"}', true, false, 3);

-- ─── OPERACIONES ─────────────────────────────────────────────────────────────

INSERT INTO modulos (slug, nombre, descripcion, categoria, precio_usd, icono, color, dependencias, rubros, es_core, visible_wizard, orden) VALUES
('catalogo',
 'Catálogo de Productos',
 'Productos con variantes de talle/color, SKU, barcode e importación masiva desde Excel',
 'operaciones', 15, 'Package', '#0ea5e9',
 '{}', '{"todas"}', false, true, 10),

('proveedores',
 'Gestión de Proveedores',
 'Proveedores con CUIT, retenciones impositivas, múltiples contactos y export CSV',
 'operaciones', 10, 'Truck', '#06b6d4',
 '{}', '{"todas"}', false, true, 11),

('listas_precios',
 'Listas de Precios',
 'Importación de listas Excel por proveedor/temporada con búsqueda instantánea',
 'operaciones', 8, 'FileSpreadsheet', '#0891b2',
 '{"proveedores"}', '{"todas"}', false, true, 12),

('locales',
 'Locales & Sucursales',
 'Alta y gestión de sucursales con stock y usuarios independientes por local',
 'operaciones', 8, 'MapPin', '#0284c7',
 '{}', '{"todas"}', false, true, 13),

('compras',
 'Compras Pro',
 'Notas de pedido a proveedor, facturas con semáforo de aprobación en 2 niveles y cruce automático',
 'operaciones', 25, 'ShoppingCart', '#16a34a',
 '{"catalogo","proveedores"}', '{"todas"}', false, true, 20),

('ingreso_legacy',
 'Ingreso de Mercadería',
 'Control de remitos y facturas de compra estilo clásico (sistema anterior)',
 'operaciones', 10, 'PackageCheck', '#15803d',
 '{"catalogo"}', '{"todas"}', false, true, 21),

('pagos',
 'Gestión de Pagos',
 'Minutas de pago con retenciones (IIBB/Ganancias/IVA), notas de crédito y cuentas bancarias',
 'operaciones', 20, 'Banknote', '#ca8a04',
 '{"compras"}', '{"todas"}', false, true, 22),

('stock',
 'Control de Stock',
 'Inventario en tiempo real, ajustes manuales, historial de movimientos y alertas de reposición',
 'operaciones', 20, 'Boxes', '#d97706',
 '{"catalogo"}', '{"todas"}', false, true, 23),

('ventas',
 'Facturación & Ventas',
 'Emisión de comprobantes (Factura A/B/Ticket), cobranza y cuenta corriente de clientes',
 'operaciones', 25, 'Receipt', '#b45309',
 '{"catalogo","stock"}', '{"todas"}', false, true, 24),

('transporte',
 'Logística & Transporte',
 'Gestión de transportistas, envíos con tracking, foto de entrega y vinculación a facturas',
 'operaciones', 12, 'Truck', '#78716c',
 '{}', '{"todas"}', false, true, 25),

('kanban',
 'Tablero Kanban',
 'Boards de tareas con columnas, prioridades, fechas límite y asignación de responsables',
 'operaciones', 10, 'LayoutDashboard', '#d946ef',
 '{}', '{"todas"}', false, true, 26),

('ot',
 'Órdenes de Trabajo',
 'OTs con 10 estados de workflow, presupuesto, mecánicos, checklists de calidad y sync offline',
 'operaciones', 30, 'Wrench', '#f97316',
 '{"catalogo","crm"}', '{"mecanico"}', false, true, 27),

('crm',
 'CRM / Clientes',
 'Perfil unificado de clientes, cuenta corriente, vehículos y historial de servicios',
 'operaciones', 20, 'Users', '#ec4899',
 '{"ventas"}', '{"todas"}', false, true, 28),

('comisiones',
 'Comisiones de Ventas',
 'Cálculo automático de comisiones por vendedor con ranking y export',
 'operaciones', 10, 'TrendingUp', '#84cc16',
 '{"ventas"}', '{"todas"}', false, true, 29),

('completados',
 'Historial Completados',
 'Vista y gestión de pedidos completados con filtros avanzados y búsqueda',
 'operaciones', 5, 'CheckCircle2', '#22c55e',
 '{"compras"}', '{"todas"}', false, true, 30);

-- ─── INTEGRACIONES ───────────────────────────────────────────────────────────

INSERT INTO modulos (slug, nombre, descripcion, categoria, precio_usd, icono, color, dependencias, rubros, es_core, visible_wizard, orden) VALUES
('sync',
 'Sincronización Offline',
 'Operación completa sin internet: event sourcing, CRDT merge y sync automático al reconectar',
 'integraciones', 30, 'RefreshCw', '#3b82f6',
 '{}', '{"todas"}', false, true, 40),

('socios',
 'Socios Montagne',
 'Bot WhatsApp de seguimiento y mensajería automática para franquicias Montagne',
 'integraciones', 25, 'MessageCircle', '#10b981',
 '{}', '{"indumentaria"}', false, true, 41),

('afip',
 'Facturación AFIP',
 'Emisión de CAE online, contingencia offline con serie C y regularización automática',
 'integraciones', 30, 'FileCheck', '#ef4444',
 '{"ventas"}', '{"todas"}', false, true, 42),

('mercadopago',
 'MercadoPago QR',
 'Cobro presencial con QR de MercadoPago y confirmación automática por webhook',
 'integraciones', 15, 'QrCode', '#06b6d4',
 '{"ventas"}', '{"todas"}', false, true, 43),

('sql_server',
 'Bridge Tango / SQL Server',
 'Conexión con sistema legado Tango/SQL Server: búsqueda de RV, precios y artículos en tiempo real',
 'integraciones', 15, 'Database', '#71717a',
 '{}', '{"indumentaria","deposito"}', false, true, 44);

-- ─── REPORTES ────────────────────────────────────────────────────────────────

INSERT INTO modulos (slug, nombre, descripcion, categoria, precio_usd, icono, color, dependencias, rubros, es_core, visible_wizard, orden) VALUES
('reportes',
 'Reportes & Analytics',
 'Gráficos de ventas, ABC de productos, ranking de proveedores y exportación Excel/PDF',
 'reportes', 20, 'BarChart3', '#f59e0b',
 '{}', '{"todas"}', false, true, 50),

('monitoreo',
 'Monitoreo del Sistema',
 'Dashboard de salud en tiempo real: CPU, RAM, tiempos de API y estado de base de datos',
 'reportes', 8, 'Activity', '#64748b',
 '{}', '{"todas"}', false, true, 51);

INSERT INTO modulos (slug, nombre, descripcion, categoria, precio_usd, icono, color, dependencias, rubros, es_core, visible_wizard, orden) VALUES
('importacion',
 'Importación',
 'Órdenes de importación internacional con liquidación FOB/CIF, derechos de aduana y costo de landing por unidad',
 'operaciones', 20, 'Ship', '#0369a1',
 '{"catalogo","proveedores"}', '{"indumentaria","deposito"}', false, true, 42);

-- ============================================================
-- TABLA: empresa_modulos
-- Módulos activos por empresa.
-- ============================================================
CREATE TABLE IF NOT EXISTS empresa_modulos (
    id              SERIAL PRIMARY KEY,
    empresa_id      TEXT NOT NULL,                 -- FK a companies.id (UUID)
    modulo_slug     TEXT NOT NULL REFERENCES modulos(slug) ON DELETE RESTRICT,
    activo          BOOLEAN NOT NULL DEFAULT true,
    activado_por    TEXT,                          -- user_id que lo activó
    activado_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    desactivado_at  TIMESTAMPTZ,
    notas           TEXT,                          -- ej: "período de prueba 30 días"
    config_json     JSONB DEFAULT '{}',            -- configuración específica por empresa
    UNIQUE (empresa_id, modulo_slug)
);

CREATE INDEX IF NOT EXISTS idx_empresa_modulos_empresa ON empresa_modulos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_modulos_activo  ON empresa_modulos(empresa_id, activo);

-- ============================================================
-- TABLA: instalaciones
-- Registro de deployments / instancias por empresa.
-- Permite saber dónde está corriendo el ERP de cada cliente.
-- ============================================================
CREATE TABLE IF NOT EXISTS instalaciones (
    id              SERIAL PRIMARY KEY,
    empresa_id      TEXT NOT NULL UNIQUE,          -- 1 instalación por empresa
    tipo            TEXT NOT NULL DEFAULT 'cloud'  -- 'cloud' | 'local' | 'electron' | 'android'
                    CHECK (tipo IN ('cloud','local','electron','android')),
    url_backend     TEXT,                          -- ej: https://api.mundooutdoor.com
    url_frontend    TEXT,                          -- ej: https://erp.mundooutdoor.com
    ip_lan          TEXT,                          -- ej: 192.168.0.122
    ip_internet     TEXT,                          -- ej: 190.211.201.217
    puerto_backend  INT DEFAULT 8000,
    puerto_frontend INT DEFAULT 9980,
    version_backend TEXT,                          -- ej: 1.2.0
    version_frontend TEXT,
    ultimo_ping     TIMESTAMPTZ,                   -- último health check exitoso
    estado          TEXT NOT NULL DEFAULT 'activo' -- 'activo' | 'inactivo' | 'error' | 'configurando'
                    CHECK (estado IN ('activo','inactivo','error','configurando')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instalaciones_estado ON instalaciones(estado);
CREATE INDEX IF NOT EXISTS idx_instalaciones_ping   ON instalaciones(ultimo_ping);

-- ============================================================
-- TABLA: planes_precios
-- Planes de suscripción con límites y precio base.
-- Los módulos extra se cobran encima del precio base.
-- ============================================================
CREATE TABLE IF NOT EXISTS planes_precios (
    id              SERIAL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,          -- 'free' | 'starter' | 'pro' | 'enterprise'
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    precio_base_usd NUMERIC(8,2) NOT NULL DEFAULT 0,
    max_usuarios    INT DEFAULT 2,
    max_locales     INT DEFAULT 1,
    max_productos   INT DEFAULT 500,
    incluye_modulos TEXT[] DEFAULT '{}',           -- slugs de módulos incluidos sin costo adicional
    activo          BOOLEAN NOT NULL DEFAULT true,
    orden           INT NOT NULL DEFAULT 99
);

INSERT INTO planes_precios (slug, nombre, descripcion, precio_base_usd, max_usuarios, max_locales, max_productos, incluye_modulos, orden) VALUES
('free',       'Free',       'Para probar el sistema. Sin soporte.',        0,    2,   1,   500,  '{"auth","empresas","notificaciones","catalogo"}',                                                                                    1),
('starter',    'Starter',    'Para negocios pequeños con 1 local.',        29,    5,   2,  2000,  '{"auth","empresas","notificaciones","catalogo","proveedores","stock","ventas","reportes"}',                                         2),
('pro',        'Pro',        'Para negocios medianos con varias sucursales.',79,  15,   5, 10000,  '{"auth","empresas","notificaciones","catalogo","proveedores","listas_precios","locales","compras","pagos","stock","ventas","transporte","kanban","crm","comisiones","completados","reportes","monitoreo"}', 3),
('enterprise', 'Enterprise', 'Sin límites. Módulos de integración incluidos.',149, -1,  -1,    -1,  '{"auth","empresas","notificaciones","catalogo","proveedores","listas_precios","locales","compras","ingreso_legacy","pagos","stock","ventas","transporte","kanban","ot","crm","comisiones","completados","sync","afip","reportes","monitoreo"}', 4);

-- ============================================================
-- TABLA: suscripciones
-- Suscripción activa de cada empresa a un plan.
-- ============================================================
CREATE TABLE IF NOT EXISTS suscripciones (
    id              SERIAL PRIMARY KEY,
    empresa_id      TEXT NOT NULL UNIQUE,
    plan_slug       TEXT NOT NULL REFERENCES planes_precios(slug),
    estado          TEXT NOT NULL DEFAULT 'activa'
                    CHECK (estado IN ('activa','suspendida','cancelada','trial')),
    trial_hasta     TIMESTAMPTZ,
    factura_dia     INT DEFAULT 1,                 -- día del mes para facturar
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VISTA: v_empresa_modulos_activos
-- Para el Super Admin: empresa + módulos activos + precios
-- ============================================================
CREATE OR REPLACE VIEW v_empresa_modulos_activos AS
SELECT
    em.empresa_id,
    m.slug,
    m.nombre,
    m.categoria,
    m.precio_usd,
    em.activo,
    em.activado_at,
    em.config_json
FROM empresa_modulos em
JOIN modulos m ON m.slug = em.modulo_slug
WHERE em.activo = true;

-- ============================================================
-- VISTA: v_mrr_por_empresa
-- Monthly Recurring Revenue estimado por empresa
-- ============================================================
CREATE OR REPLACE VIEW v_mrr_por_empresa AS
SELECT
    em.empresa_id,
    COUNT(*) AS total_modulos,
    SUM(m.precio_usd) AS mrr_usd
FROM empresa_modulos em
JOIN modulos m ON m.slug = em.modulo_slug
WHERE em.activo = true AND m.precio_usd > 0
GROUP BY em.empresa_id;
