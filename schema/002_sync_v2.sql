-- ============================================================
-- 002_sync.sql — Event sourcing para sincronización offline/online
-- Versión: 2.0 (reconciliada con sync-architecture.md y sync-gap-analysis.md)
-- Compatible: SQLite + PostgreSQL (diferencias anotadas)
-- ============================================================

-- EVENTOS_SYNC
-- Registro inmutable de toda mutación en tablas de negocio.
-- Generado en el dispositivo origen, enviado al servidor al reconectar.
-- Es el corazón del sistema offline-first.
--
-- Convenciones:
--   - operacion IN ('INSERT','UPDATE','DELETE') → generado por el dispositivo
--   - operacion = 'MERGE' → generado SOLO por el servidor al resolver conflictos
--   - Los timestamps son TEXT en formato ISO 8601 (SQLite).
--   - Los payloads son TEXT con JSON serializado (SQLite).
--   - Nota PostgreSQL: TIMESTAMPTZ para timestamps, JSONB para payloads.
CREATE TABLE eventos_sync (

    -- ─── IDENTIDAD ──────────────────────────────────────────────────────────
    id                  TEXT PRIMARY KEY,
    -- UUID v4 generado en el dispositivo. TEXT por compatibilidad SQLite.

    idempotency_key     TEXT NOT NULL,
    -- Clave de idempotencia: "{dispositivo_id}-{timestamp_ms}-{random_8chars}"
    -- Previene doble-procesamiento si la red falla luego de que el servidor
    -- procesó el evento pero antes de que llegue el HTTP 200.
    -- El servidor hace: INSERT ... ON CONFLICT (idempotency_key) DO NOTHING

    -- ─── ORIGEN ─────────────────────────────────────────────────────────────
    dispositivo_id      TEXT NOT NULL REFERENCES dispositivos(id),
    empresa_id          TEXT NOT NULL REFERENCES empresas(id),
    usuario_id          TEXT REFERENCES usuarios(id),
    -- NULL para eventos generados por el sistema (jobs, servidor).

    -- ─── OPERACIÓN ──────────────────────────────────────────────────────────
    tabla_afectada      TEXT NOT NULL,
    -- Nombre de la tabla: 'productos', 'variantes_producto',
    -- 'movimientos_stock', 'ventas', 'items_venta', etc.

    registro_id         TEXT NOT NULL,
    -- UUID del registro afectado. Nunca NULL.

    operacion           TEXT NOT NULL
                        CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE')),
    -- INSERT/UPDATE/DELETE → dispositivo cliente.
    -- MERGE → SOLO el servidor, al fusionar versiones en conflicto.

    -- ─── PAYLOAD ────────────────────────────────────────────────────────────
    payload_antes       TEXT,
    -- JSON: estado completo del registro ANTES. NULL en INSERT.
    -- Nota PostgreSQL: JSONB.

    payload_despues     TEXT,
    -- JSON: estado completo del registro DESPUÉS. NULL en DELETE.
    -- Nota PostgreSQL: JSONB.

    campos_modificados  TEXT,
    -- JSON array: campos que cambiaron en UPDATE. Ej: '["telefono","email"]'
    -- NULL en INSERT y DELETE.
    -- Permite merge por campo sin parsear payloads completos.
    -- Nota PostgreSQL: TEXT[] o JSONB.

    -- ─── VERSIONADO ─────────────────────────────────────────────────────────
    version             INTEGER NOT NULL DEFAULT 1,
    -- Versión del registro al editar. Optimistic concurrency control.
    -- Si el servidor tiene versión mayor → conflicto.
    -- Se incrementa en cada UPDATE exitoso en el servidor.

    version_catalogo    INTEGER,
    -- Versión del catálogo de precios/config que tenía el dispositivo.
    -- Detecta ventas con precios desactualizados.
    -- NULL si el dispositivo no tiene catálogo versionado.

    -- ─── TEMPORALIDAD ───────────────────────────────────────────────────────
    timestamp_local     TEXT NOT NULL,
    -- Cuándo ocurrió en el dispositivo. ISO 8601 con TZ.
    -- Ej: "2026-04-12T10:00:00.000Z". Puede ser impreciso (reloj del sistema).
    -- Nota PostgreSQL: TIMESTAMPTZ.

    timestamp_servidor  TEXT,
    -- Cuándo lo procesó el servidor. NULL hasta sincronizar.
    -- Nota PostgreSQL: TIMESTAMPTZ DEFAULT NOW().

    numero_secuencia    INTEGER,
    -- Contador monotónico por dispositivo: 1, 2, 3...
    -- Más confiable que timestamp_local para orden causal del mismo device.
    -- Orden causal definitivo: ORDER BY dispositivo_id, numero_secuencia.

    -- ─── LOTE ───────────────────────────────────────────────────────────────
    lote_sync_id        TEXT,
    -- UUID del lote: todos los eventos del mismo flushPendingOps() lo comparten.
    -- Permite rollback coordinado y correlación de errores por lote.
    -- NULL para eventos generados por el servidor.

    -- ─── ESTADO DE SYNC ─────────────────────────────────────────────────────
    sincronizado        BOOLEAN NOT NULL DEFAULT false,

    -- ─── CONFLICTO ──────────────────────────────────────────────────────────
    conflicto           BOOLEAN NOT NULL DEFAULT false,

    conflicto_tipo      TEXT
                        CHECK (conflicto_tipo IS NULL OR conflicto_tipo IN (
                            'SOBREVENTA',        -- vendieron más unidades de las disponibles
                            'CAMPO_DIVERGENTE',  -- mismo campo editado offline en 2 devices
                            'DUPLICADO',         -- registro creado en 2 places offline
                            'VERSION_OBSOLETA',  -- evento generado con catálogo desactualizado
                            'RECHAZO_FISCAL',    -- AFIP rechazó la factura al sincronizar
                            'CLIENTE_BLOQUEADO'  -- venta a cliente bloqueado hecha offline
                        )),
    -- NULL cuando conflicto = false. Permite routing a resolución correcta.

    resolucion_conflicto TEXT,
    -- JSON con detalle completo de cómo se resolvió el conflicto.
    -- Nota PostgreSQL: JSONB.

    conflicto_resuelto  BOOLEAN NOT NULL DEFAULT false,
    -- false: conflicto detectado, pendiente de resolución.
    -- true: conflicto cerrado (manual o automático).

    resuelto_por        TEXT REFERENCES usuarios(id),
    -- Quién resolvió. NULL si fue automático o si no se resolvió aún.

    resuelto_at         TEXT,
    -- Cuándo se resolvió. ISO 8601. NULL si no resuelto.

    -- ─── INTEGRIDAD ─────────────────────────────────────────────────────────
    checksum            TEXT,
    -- SHA-256 (primeros 16 chars) del payload para verificar integridad.
    -- Calculado sobre: {id, operacion, tabla_afectada, registro_id,
    --   payload_despues, timestamp_local, numero_secuencia}
    -- NULL si el cliente no implementa checksum (compatibilidad backward).

    -- ─── METADATA ───────────────────────────────────────────────────────────
    created_at          TEXT NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    -- ─── CONSTRAINTS ────────────────────────────────────────────────────────
    CONSTRAINT uq_idempotency
        UNIQUE (idempotency_key),

    CONSTRAINT chk_payload_insert
        CHECK (operacion != 'INSERT' OR payload_antes IS NULL),
    -- En INSERT no puede haber estado previo.

    CONSTRAINT chk_conflicto_consistente
        CHECK (conflicto = true OR conflicto_tipo IS NULL),
    -- conflicto_tipo solo tiene sentido si conflicto = true.

    CONSTRAINT chk_resolucion_consistente
        CHECK (conflicto_resuelto = false OR conflicto = true)
    -- No se puede marcar como resuelto algo que no es conflicto.
);
-- Nota PostgreSQL: reemplazar TEXT por UUID, TEXT (payloads) por JSONB,
--   TEXT (timestamps) por TIMESTAMPTZ donde se indica.

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────

-- Queries por empresa (todas las queries de sync filtran por empresa_id)
CREATE INDEX idx_eventos_sync_empresa
    ON eventos_sync(empresa_id);

-- Sync incremental: "dame todo lo del dispositivo X desde timestamp Y"
CREATE INDEX idx_eventos_sync_dispositivo_ts
    ON eventos_sync(dispositivo_id, timestamp_local);

-- Auditoría: todos los eventos de un registro específico
CREATE INDEX idx_eventos_sync_registro
    ON eventos_sync(empresa_id, tabla_afectada, registro_id);

-- Queue de pendientes: la query más frecuente del sistema
CREATE INDEX idx_eventos_sync_pendientes
    ON eventos_sync(empresa_id, dispositivo_id, numero_secuencia)
    WHERE sincronizado = false;

-- Panel de conflictos: conflictos abiertos que requieren atención
CREATE INDEX idx_eventos_sync_conflictos_abiertos
    ON eventos_sync(empresa_id, conflicto_tipo, created_at)
    WHERE conflicto = true AND conflicto_resuelto = false;

-- Correlación por lote de sync
CREATE INDEX idx_eventos_sync_lote
    ON eventos_sync(lote_sync_id)
    WHERE lote_sync_id IS NOT NULL;

-- ============================================================

-- COLA_SYNC
-- Cola de reintentos para eventos que fallaron al sincronizar.
-- Separada de eventos_sync para no contaminar el log principal.
-- Implementa backoff exponencial con categorización de errores.
--
-- Política de reintentos por tipo_error:
--   RED, SERVIDOR_5XX   → reintento automático con backoff exponencial
--   CONFLICTO, CHECKSUM → requieren intervención humana (estado=fallido)
--   VALIDACION          → requieren corrección del payload (estado=fallido)
CREATE TABLE cola_sync (
    id              TEXT PRIMARY KEY,            -- UUID v4
    evento_id       TEXT NOT NULL REFERENCES eventos_sync(id),
    intentos        INTEGER NOT NULL DEFAULT 0,
    max_intentos    INTEGER NOT NULL DEFAULT 10,
    ultimo_intento  TEXT,                        -- ISO 8601 del último intento
    proximo_intento TEXT,                        -- ISO 8601 calculado con backoff exponencial
    error_ultimo    TEXT,                        -- mensaje de error del último intento
    tipo_error      TEXT
                    CHECK (tipo_error IS NULL OR tipo_error IN (
                        'RED',           -- timeout, connection refused, DNS fail
                        'SERVIDOR_5XX',  -- error interno del servidor (reintentable)
                        'CONFLICTO',     -- servidor rechazó por conflicto de datos
                        'VALIDACION',    -- datos inválidos (FK, constraint violation)
                        'CHECKSUM'       -- checksum no coincide (posible corrupción)
                    )),
    estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN (
                        'pendiente',    -- esperando proximo_intento para reintentar
                        'procesando',   -- request en vuelo actualmente
                        'completado',   -- sincronizado exitosamente
                        'fallido'       -- agotó max_intentos o requiere intervención manual
                    )),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_cola_sync_estado ON cola_sync(estado);
CREATE INDEX idx_cola_sync_proximo ON cola_sync(proximo_intento)
    WHERE estado = 'pendiente';
CREATE INDEX idx_cola_sync_evento ON cola_sync(evento_id);
CREATE INDEX idx_cola_sync_error ON cola_sync(tipo_error)
    WHERE estado = 'fallido';
-- Último índice: lista todos los fallos por categoría para el dashboard de operaciones.
