-- ============================================================
-- 004_negocio.sql — Tablas del núcleo de negocio
-- clientes, vehiculos, ordenes_trabajo, ot_items,
-- facturas, factura_items,
-- cliente_empresa, cuenta_corriente,
-- mensajes_whatsapp, archivos
--
-- Compatible: SQLite + PostgreSQL (diferencias anotadas)
-- Requiere: 001_empresas.sql, 003_catalogo.sql
-- Versión: 2.0 (cliente_empresa N:N, cuenta corriente, stubs)
-- ============================================================

-- ============================================================
-- CLIENTES
-- Identidad global de un cliente. Datos fiscales y de contacto
-- compartidos entre empresas.
--
-- Los campos comerciales (límite de crédito, condición de pago,
-- bloqueo, deuda, categoría) viven en cliente_empresa para
-- permitir distintas condiciones por empresa (decisión del dueño).
--
-- Estrategia de sync: merge por campo (ver schema-decisions § P1).
-- Campos con conflicto manual: nombre, cuit_dni, condicion_iva.
-- ============================================================
CREATE TABLE clientes (
    id                      TEXT PRIMARY KEY,        -- UUID v4
    empresa_id              TEXT NOT NULL REFERENCES empresas(id), -- empresa creadora/propietaria
    cuit_dni                TEXT,                    -- CUIT (11 dígitos) o DNI (8 dígitos)
    nombre                  TEXT NOT NULL,            -- nombre comercial o apellido y nombre
    razon_social            TEXT,                    -- nombre legal completo
    tipo_contribuyente      TEXT                     -- tipo para facturación AFIP
                            CHECK (tipo_contribuyente IS NULL OR tipo_contribuyente IN (
                                'RESPONSABLE_INSCRIPTO',
                                'MONOTRIBUTO',
                                'CONSUMIDOR_FINAL',
                                'EXENTO',
                                'NO_CATEGORIZADO'
                            )),
    condicion_iva           TEXT,                    -- 'RI', 'M', 'CF', 'EX' (abreviado AFIP)
    activo                  BOOLEAN NOT NULL DEFAULT true,
    datos_json              TEXT NOT NULL DEFAULT '{}',  -- datos flexibles:
                                                        --   telefono, email, direccion,
                                                        --   localidad, provincia, notas
    version                 INTEGER NOT NULL DEFAULT 1,  -- para optimistic concurrency / merge
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: JSONB para datos_json

CREATE UNIQUE INDEX idx_clientes_cuit_empresa ON clientes(empresa_id, cuit_dni)
    WHERE cuit_dni IS NOT NULL;
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_nombre ON clientes(empresa_id, nombre);
CREATE INDEX idx_clientes_activo ON clientes(empresa_id, activo);


-- ============================================================
-- VEHICULOS
-- Pertenece a un cliente. Puede tener múltiples órdenes de trabajo.
-- Estrategia de sync: merge por campo, sin campos críticos —
-- los datos de un vehículo raramente generan conflictos.
-- empresa_id desnormalizado para queries multi-tenant sin JOIN.
-- ============================================================
CREATE TABLE vehiculos (
    id              TEXT PRIMARY KEY,            -- UUID v4
    cliente_id      TEXT NOT NULL REFERENCES clientes(id),
    empresa_id      TEXT NOT NULL REFERENCES empresas(id), -- desnormalizado para queries directas
    patente         TEXT NOT NULL,               -- dominio del vehículo
    vin             TEXT,                        -- VIN/chasis, opcional
    marca           TEXT,
    modelo          TEXT,
    anio            INTEGER,
    color           TEXT,
    km_actual       INTEGER DEFAULT 0,           -- se actualiza en cada OT
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX idx_vehiculos_patente_empresa ON vehiculos(empresa_id, patente);
CREATE INDEX idx_vehiculos_cliente ON vehiculos(cliente_id);
CREATE INDEX idx_vehiculos_empresa ON vehiculos(empresa_id);


-- ============================================================
-- ORDENES_TRABAJO (OT)
-- Documento central del negocio. Registra cada trabajo realizado
-- sobre un vehículo.
--
-- Estados: BORRADOR → RECIBIDA → DIAGNOSTICO → APROBADA →
--          EN_PROGRESO → FINALIZADA → ENTREGADA
--          (desde cualquier estado → ANULADA)
--
-- Estrategia de sync: merge por campo (ver schema-decisions § P1).
--   LWW:     diagnostico, observaciones, notas_internas,
--            fecha_estimada, prioridad
--   MANUAL:  estado, total_final, items
--   SERVER:  precio_hora, descuento_maximo
--
-- Cada transición de estado tiene su timestamp propio para
-- auditoría y KPI (ej: tiempo de diagnóstico, tiempo de reparación).
-- ============================================================
CREATE TABLE ordenes_trabajo (
    id                      TEXT PRIMARY KEY,        -- UUID v4
    empresa_id              TEXT NOT NULL REFERENCES empresas(id),
    vehiculo_id             TEXT NOT NULL REFERENCES vehiculos(id),
    cliente_id              TEXT NOT NULL REFERENCES clientes(id),
    numero_ot               TEXT,                    -- número legible asignado por servidor (ej: OT-2026-0042)

    -- Estado y workflow
    estado                  TEXT NOT NULL DEFAULT 'BORRADOR'
                            CHECK (estado IN (
                                'BORRADOR',          -- creada, no ingresada aún
                                'RECIBIDA',          -- vehículo en taller
                                'DIAGNOSTICO',       -- en evaluación técnica
                                'APROBADA',          -- cliente aprobó presupuesto
                                'EN_PROGRESO',       -- trabajo en curso
                                'FINALIZADA',        -- trabajo terminado, pendiente de entrega
                                'ENTREGADA',         -- vehículo devuelto al cliente
                                'ANULADA'
                            )),
    prioridad               TEXT NOT NULL DEFAULT 'NORMAL'
                            CHECK (prioridad IN ('BAJA', 'NORMAL', 'ALTA', 'URGENTE')),

    -- Kilometraje
    km_entrada              INTEGER,
    km_salida               INTEGER,

    -- Contenido técnico (campos LWW — merge automático)
    diagnostico             TEXT,
    observaciones           TEXT,                    -- visibles al cliente
    notas_internas          TEXT,                    -- solo para el taller
    fecha_estimada          TEXT,                    -- fecha estimada de entrega (ISO 8601)

    -- Importes
    presupuesto_total       REAL NOT NULL DEFAULT 0, -- calculado de ot_items
    total_final             REAL NOT NULL DEFAULT 0, -- campo CRÍTICO — conflicto manual

    -- Aprobación de presupuesto
    aprobado_por            TEXT REFERENCES usuarios(id),
    aprobado_timestamp      TEXT,                    -- cuándo se aprobó el presupuesto

    -- Timestamps de cada transición de estado (para auditoría y KPI)
    ts_recibida             TEXT,
    ts_diagnostico          TEXT,
    ts_aprobada             TEXT,
    ts_en_progreso          TEXT,
    ts_finalizada           TEXT,
    ts_entregada            TEXT,
    ts_anulada              TEXT,

    -- Offline-first
    dispositivo_id          TEXT REFERENCES dispositivos(id),
    usuario_creacion_id     TEXT REFERENCES usuarios(id),
    version                 INTEGER NOT NULL DEFAULT 1, -- para merge por campo
    requiere_revision       BOOLEAN NOT NULL DEFAULT false,
    motivo_revision         TEXT,                    -- 'CLIENTE_BLOQUEADO', 'CAMPO_DIVERGENTE', etc.
    timestamp_local         TEXT NOT NULL,           -- cuándo se creó en el dispositivo

    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: NUMERIC(12,2) para presupuesto_total y total_final

CREATE UNIQUE INDEX idx_ot_numero ON ordenes_trabajo(empresa_id, numero_ot)
    WHERE numero_ot IS NOT NULL;
CREATE INDEX idx_ot_empresa ON ordenes_trabajo(empresa_id);
CREATE INDEX idx_ot_vehiculo ON ordenes_trabajo(vehiculo_id);
CREATE INDEX idx_ot_cliente ON ordenes_trabajo(cliente_id);
CREATE INDEX idx_ot_estado ON ordenes_trabajo(empresa_id, estado);
CREATE INDEX idx_ot_revision ON ordenes_trabajo(empresa_id, requiere_revision)
    WHERE requiere_revision = true;
CREATE INDEX idx_ot_dispositivo ON ordenes_trabajo(dispositivo_id);


-- ============================================================
-- OT_ITEMS
-- Líneas de una orden de trabajo. Pueden ser repuestos (stock)
-- o mano de obra (sin stock).
--
-- variante_producto_id solo aplica para repuestos.
-- La descarga de stock se genera automáticamente al confirmar
-- la OT como FINALIZADA (movimiento tipo EGRESO).
--
-- empresa_id desnormalizado para queries directas.
-- ============================================================
CREATE TABLE ot_items (
    id                      TEXT PRIMARY KEY,        -- UUID v4
    ot_id                   TEXT NOT NULL REFERENCES ordenes_trabajo(id),
    empresa_id              TEXT NOT NULL REFERENCES empresas(id), -- desnormalizado
    tipo                    TEXT NOT NULL
                            CHECK (tipo IN (
                                'repuesto',          -- artículo físico de stock
                                'mano_obra'          -- servicio, sin impacto en stock
                            )),
    descripcion             TEXT NOT NULL,
    cantidad                REAL NOT NULL DEFAULT 1,
    precio_unitario         REAL NOT NULL DEFAULT 0,
    descuento_pct           REAL NOT NULL DEFAULT 0, -- 0–100
    subtotal                REAL,                    -- calculado: cantidad × precio × (1 - desc/100)
                                                    -- almacenado para evitar re-calcular offline
    variante_producto_id    TEXT REFERENCES variantes_producto(id), -- NULL para mano_obra
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: NUMERIC(12,2) para montos; NUMERIC(5,2) para porcentajes

CREATE INDEX idx_ot_items_ot ON ot_items(ot_id);
CREATE INDEX idx_ot_items_empresa ON ot_items(empresa_id);
CREATE INDEX idx_ot_items_variante ON ot_items(variante_producto_id)
    WHERE variante_producto_id IS NOT NULL;


-- ============================================================
-- FACTURAS
-- Append-only: una factura emitida nunca se modifica.
-- Los errores se corrigen con notas de crédito (nueva factura).
--
-- Ciclo de vida del estado:
--   borrador      → factura en construcción (puede editarse)
--   contingencia  → emitida offline, con numero_provisorio
--                   (ej: OFF-CAJA-A1-00042)
--   pendiente_afip → sincronizada al servidor, esperando
--                   respuesta AFIP para obtener CAE
--   emitida       → CAE asignado, factura válida fiscalmente
--   rechazada_afip → AFIP rechazó la factura (ver error_afip)
--   anulada       → anulada (requiere nota de crédito en AFIP)
--
-- Estrategia de sync: append-only, sin conflictos de edición.
-- El único conflicto posible es la sobreventa (stock insuficiente)
-- detectada al sincronizar, que se marca con requiere_revision.
-- ============================================================
CREATE TABLE facturas (
    id                      TEXT PRIMARY KEY,        -- UUID v4
    empresa_id              TEXT NOT NULL REFERENCES empresas(id),
    cliente_id              TEXT NOT NULL REFERENCES clientes(id),

    -- Identificación fiscal
    tipo_comprobante        TEXT NOT NULL            -- tipos AFIP
                            CHECK (tipo_comprobante IN (
                                'FA',               -- Factura A (a RI)
                                'FB',               -- Factura B (a consumidor final)
                                'FC',               -- Factura C (de monotributista)
                                'NCA',              -- Nota de Crédito A
                                'NCB',              -- Nota de Crédito B
                                'NCC',              -- Nota de Crédito C
                                'TICKET'            -- Ticket / comprobante interno (sin CAE)
                            )),
    punto_venta             INTEGER,                 -- punto de venta AFIP (ej: 1, 5)
    numero_provisorio       TEXT,                    -- asignado offline: OFF-{device_id}-{seq}
    numero_fiscal           TEXT,                    -- asignado por servidor en sync: 00001-00000042
    cae                     TEXT,                    -- Código de Autorización Electrónico (AFIP)
    cae_vencimiento         TEXT,                    -- fecha de vencimiento del CAE (ISO 8601)

    -- Estado (ver ciclo de vida arriba)
    estado                  TEXT NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN (
                                'borrador',
                                'contingencia',      -- offline, provisoria
                                'pendiente_afip',    -- en servidor, esperando CAE
                                'emitida',           -- con CAE válido
                                'rechazada_afip',    -- AFIP la rechazó
                                'anulada'
                            )),

    -- Importes
    subtotal                REAL NOT NULL DEFAULT 0, -- sin IVA
    iva_total               REAL NOT NULL DEFAULT 0,
    total                   REAL NOT NULL DEFAULT 0, -- subtotal + iva_total

    -- CAE (online) y CAI (contingencia AFIP)
    -- Cuando el POS está offline se usa CAI (Código de Autorización de Impresión):
    --   numero_provisorio con formato OFF-{device_id}-{seq}
    --   punto_venta dedicado para contingencia (decisión: numeración serie C separada)
    cai                     TEXT,                    -- Código de Autorización de Impresión (contingencia física)
    cai_vencimiento         TEXT,                    -- fecha de vencimiento del CAI (ISO 8601)

    -- Relación con OT (opcional — una factura puede no venir de una OT)
    ot_id                   TEXT REFERENCES ordenes_trabajo(id),

    -- Offline-first
    dispositivo_id          TEXT REFERENCES dispositivos(id),
    usuario_id              TEXT REFERENCES usuarios(id),
    version_catalogo        INTEGER,                 -- versión del catálogo al momento de emitir
    requiere_revision       BOOLEAN NOT NULL DEFAULT false, -- sobreventa, cliente bloqueado, etc.
    motivo_revision         TEXT,                    -- 'SOBREVENTA_OFFLINE', 'CLIENTE_BLOQUEADO', etc.
    error_afip              TEXT,                    -- detalle del error si rechazada_afip

    -- Timestamps
    timestamp_local         TEXT NOT NULL,           -- cuándo se emitió en el dispositivo
    timestamp_fiscal        TEXT,                    -- cuándo AFIP asignó el CAE

    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Nota PostgreSQL: NUMERIC(12,2) para montos

-- Unicidad de numero_provisorio por dispositivo (garantía offline)
CREATE UNIQUE INDEX idx_facturas_provisorio ON facturas(dispositivo_id, numero_provisorio)
    WHERE numero_provisorio IS NOT NULL;
-- Unicidad de numero_fiscal por empresa, punto de venta y tipo
CREATE UNIQUE INDEX idx_facturas_fiscal ON facturas(empresa_id, tipo_comprobante, punto_venta, numero_fiscal)
    WHERE numero_fiscal IS NOT NULL;
CREATE INDEX idx_facturas_empresa ON facturas(empresa_id);
CREATE INDEX idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX idx_facturas_estado ON facturas(empresa_id, estado);
CREATE INDEX idx_facturas_ot ON facturas(ot_id)
    WHERE ot_id IS NOT NULL;
CREATE INDEX idx_facturas_revision ON facturas(empresa_id, requiere_revision)
    WHERE requiere_revision = true;
CREATE INDEX idx_facturas_pendiente_afip ON facturas(empresa_id, estado)
    WHERE estado = 'pendiente_afip';
CREATE INDEX idx_facturas_fecha ON facturas(empresa_id, timestamp_local);


-- ============================================================
-- FACTURA_ITEMS
-- Líneas de una factura. Inmutables una vez emitida la factura.
-- IVA se guarda como porcentaje (21, 10.5, 0) y como monto calculado
-- para que el total sea auditable sin recalcular.
-- empresa_id desnormalizado para queries directas.
-- ============================================================
CREATE TABLE factura_items (
    id                      TEXT PRIMARY KEY,        -- UUID v4
    factura_id              TEXT NOT NULL REFERENCES facturas(id),
    empresa_id              TEXT NOT NULL REFERENCES empresas(id), -- desnormalizado
    descripcion             TEXT NOT NULL,
    cantidad                REAL NOT NULL DEFAULT 1,
    precio_unitario         REAL NOT NULL,           -- precio sin IVA
    iva_porcentaje          REAL NOT NULL DEFAULT 21, -- 21, 10.5, 27, 0
    subtotal                REAL NOT NULL,           -- cantidad × precio_unitario (sin IVA)
    iva_monto               REAL NOT NULL,           -- subtotal × iva_porcentaje / 100
    total_linea             REAL NOT NULL,           -- subtotal + iva_monto
    -- Referencia opcional al producto/variante (para trazabilidad)
    variante_producto_id    TEXT REFERENCES variantes_producto(id),
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    -- Sin updated_at: las líneas de factura son inmutables
);
-- Nota PostgreSQL: NUMERIC(12,2) para montos; NUMERIC(5,2) para porcentaje

CREATE INDEX idx_factura_items_factura ON factura_items(factura_id);
CREATE INDEX idx_factura_items_empresa ON factura_items(empresa_id);
CREATE INDEX idx_factura_items_variante ON factura_items(variante_producto_id)
    WHERE variante_producto_id IS NOT NULL;


-- ============================================================
-- CLIENTE_EMPRESA
-- Relación N:N entre clientes y empresas.
-- Contiene los términos comerciales de un cliente específicos
-- para cada empresa: límite de crédito, condición de pago,
-- lista de precios, bloqueo, deuda acumulada.
--
-- Un mismo cliente puede tener condiciones distintas en cada
-- empresa (decisión del dueño: "límite de crédito por empresa,
-- independiente").
--
-- bloqueado y deuda_acumulada son SERVER-WINS: el servidor es
-- la única fuente de verdad para el estado financiero del cliente.
-- ============================================================
CREATE TABLE cliente_empresa (
    cliente_id              TEXT NOT NULL REFERENCES clientes(id),
    empresa_id              TEXT NOT NULL REFERENCES empresas(id),

    -- Términos comerciales (por empresa)
    limite_credito          REAL NOT NULL DEFAULT 0,        -- 0 = sin crédito habilitado
    condicion_pago_dias     INTEGER NOT NULL DEFAULT 0,     -- 0 = contado, 30 = 30 días, etc.
    lista_precios           TEXT,                           -- 'MAYORISTA', 'MINORISTA', 'ESPECIAL', etc.

    -- Estado comercial (SERVER-WINS: no modificar offline)
    bloqueado               BOOLEAN NOT NULL DEFAULT false, -- SERVER-WINS
    deuda_acumulada         REAL NOT NULL DEFAULT 0,        -- SERVER-WINS: calculado por servidor
    categoria               TEXT,                           -- SERVER-WINS: clasificación comercial

    activo                  BOOLEAN NOT NULL DEFAULT true,
    notas                   TEXT,                           -- notas específicas de esta relación
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    PRIMARY KEY (cliente_id, empresa_id)
);
-- Nota PostgreSQL: NUMERIC(12,2) para limite_credito y deuda_acumulada

CREATE INDEX idx_cliente_empresa_empresa ON cliente_empresa(empresa_id);
CREATE INDEX idx_cliente_empresa_lista ON cliente_empresa(empresa_id, lista_precios)
    WHERE lista_precios IS NOT NULL;
CREATE INDEX idx_cliente_empresa_bloqueado ON cliente_empresa(empresa_id, bloqueado)
    WHERE bloqueado = true;
CREATE INDEX idx_cliente_empresa_activo ON cliente_empresa(empresa_id, activo);


-- ============================================================
-- CUENTA_CORRIENTE
-- Ledger de movimientos financieros por cliente + empresa.
-- Inmutable: cada movimiento es un registro nuevo, nunca se edita.
-- saldo_resultante es denormalizado (como stock_resultante en
-- movimientos_stock): el saldo DESPUÉS de este movimiento.
--
-- Estrategia de sync: append-only, sin conflictos de edición.
-- Los movimientos se sincronizan en orden por timestamp_local.
-- Un conflicto de saldo se resuelve recalculando desde el servidor.
-- ============================================================
CREATE TABLE cuenta_corriente (
    id                      TEXT PRIMARY KEY,               -- UUID v4
    cliente_id              TEXT NOT NULL REFERENCES clientes(id),
    empresa_id              TEXT NOT NULL REFERENCES empresas(id),
    factura_id              TEXT REFERENCES facturas(id),   -- NULL para pagos sin factura específica
    tipo                    TEXT NOT NULL
                            CHECK (tipo IN (
                                'cargo',    -- deuda generada (factura, cargo manual)
                                'pago'      -- pago recibido (efectivo, transferencia, etc.)
                            )),
    monto                   REAL NOT NULL,                  -- siempre positivo; tipo indica dirección
    saldo_resultante        REAL NOT NULL,                  -- saldo DESPUÉS de este movimiento
    descripcion             TEXT,                           -- detalle del movimiento
    medio_pago              TEXT,                           -- 'efectivo', 'transferencia', 'tarjeta', etc.
    dispositivo_id          TEXT REFERENCES dispositivos(id),
    usuario_id              TEXT REFERENCES usuarios(id),
    timestamp_local         TEXT NOT NULL,                  -- cuándo se registró en el dispositivo
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    -- Sin updated_at: ledger inmutable
);
-- Nota PostgreSQL: NUMERIC(12,2) para monto y saldo_resultante

CREATE INDEX idx_cc_cliente_empresa ON cuenta_corriente(cliente_id, empresa_id);
CREATE INDEX idx_cc_empresa ON cuenta_corriente(empresa_id);
CREATE INDEX idx_cc_factura ON cuenta_corriente(factura_id)
    WHERE factura_id IS NOT NULL;
CREATE INDEX idx_cc_fecha ON cuenta_corriente(empresa_id, timestamp_local);


-- ============================================================
-- MENSAJES_WHATSAPP
-- Stub completo para integración futura con WhatsApp Business API.
-- La lógica de envío NO se implementa aún (decisión del dueño).
-- Los campos están listos para cuando se integre Meta/Twilio.
--
-- Estado: pendiente → enviado → leido
--                   ↘ fallido (reintentar o intervención manual)
-- ============================================================
CREATE TABLE mensajes_whatsapp (
    id                      TEXT PRIMARY KEY,               -- UUID v4
    empresa_id              TEXT NOT NULL REFERENCES empresas(id),
    cliente_id              TEXT NOT NULL REFERENCES clientes(id),
    template_nombre         TEXT NOT NULL,                  -- nombre del template aprobado en Meta
    contenido_json          TEXT NOT NULL DEFAULT '{}',     -- parámetros del template (JSON)
    -- Nota PostgreSQL: JSONB para contenido_json
    estado                  TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN (
                                'pendiente',    -- en cola, no enviado aún
                                'enviado',      -- enviado a la API de WhatsApp
                                'fallido',      -- error en el envío
                                'leido'         -- confirmación de lectura (webhook)
                            )),
    intentos                INTEGER NOT NULL DEFAULT 0,
    error_ultimo            TEXT,                           -- mensaje del último error
    mensaje_id_whatsapp     TEXT,                           -- ID retornado por la API de WA (para webhook)
    timestamp_local         TEXT NOT NULL,                  -- cuándo se encoló el mensaje
    timestamp_enviado       TEXT,                           -- cuándo se confirmó el envío
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    -- Sin updated_at: el estado se actualiza vía webhook, no edición directa
);

CREATE INDEX idx_whatsapp_empresa ON mensajes_whatsapp(empresa_id);
CREATE INDEX idx_whatsapp_cliente ON mensajes_whatsapp(cliente_id);
CREATE INDEX idx_whatsapp_estado ON mensajes_whatsapp(empresa_id, estado);
CREATE INDEX idx_whatsapp_pendientes ON mensajes_whatsapp(empresa_id, estado)
    WHERE estado = 'pendiente';


-- ============================================================
-- ARCHIVOS
-- Adjuntos genéricos para cualquier entidad del sistema.
-- Asociación polimórfica: entidad_tipo + entidad_id.
-- Storage abstraído: ruta_servidor es un path opaco que puede
-- apuntar a sistema de archivos local, S3, o cualquier otro
-- backend (decisión del dueño: servidor propio, abstraer storage).
--
-- Caso de uso primario: fotos de OT (estado del vehículo al
-- ingreso y egreso). También soporta PDFs, documentos, etc.
--
-- Offline-first: sincronizado=false hasta que el archivo se
-- suba al servidor. La app puede operar con referencias locales.
-- ============================================================
CREATE TABLE archivos (
    id                      TEXT PRIMARY KEY,               -- UUID v4
    empresa_id              TEXT NOT NULL REFERENCES empresas(id),

    -- Asociación polimórfica
    entidad_tipo            TEXT NOT NULL                   -- tabla a la que pertenece
                            CHECK (entidad_tipo IN (
                                'ordenes_trabajo',
                                'vehiculos',
                                'clientes',
                                'facturas',
                                'productos',
                                'ingresos'
                            )),
    entidad_id              TEXT NOT NULL,                  -- UUID del registro relacionado

    -- Metadata del archivo
    nombre_original         TEXT NOT NULL,                  -- nombre en el dispositivo
    ruta_servidor           TEXT,                           -- path abstracto en servidor (NULL hasta sync)
    mime_type               TEXT,                           -- 'image/jpeg', 'application/pdf', etc.
    tamanio_bytes           INTEGER,
    descripcion             TEXT,                           -- ej: "foto frente al ingreso"
    orden                   INTEGER NOT NULL DEFAULT 0,     -- para ordenar múltiples archivos de la misma entidad

    -- Offline-first
    sincronizado            BOOLEAN NOT NULL DEFAULT false,
    dispositivo_id          TEXT REFERENCES dispositivos(id),
    usuario_id              TEXT REFERENCES usuarios(id),
    timestamp_local         TEXT NOT NULL,                  -- cuándo se capturó/subió en el dispositivo

    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    -- Sin updated_at: los archivos no se editan, se reemplazan
);

CREATE INDEX idx_archivos_entidad ON archivos(entidad_tipo, entidad_id);
CREATE INDEX idx_archivos_empresa ON archivos(empresa_id);
CREATE INDEX idx_archivos_pendientes ON archivos(empresa_id, sincronizado)
    WHERE sincronizado = false;
CREATE INDEX idx_archivos_ot ON archivos(entidad_id)
    WHERE entidad_tipo = 'ordenes_trabajo';

