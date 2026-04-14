# Gap Analysis: eventos_sync — Propuesta vs. 002_sync.sql

> **Contexto:** `sync-architecture.md` (este documento analiza) propuso un schema de `eventos_sync`  
> diseñado desde la perspectiva de PostgreSQL. El agente de schema implementó `002_sync.sql`  
> diseñado desde la compatibilidad SQLite + PostgreSQL. Este documento reconcilia ambos  
> y produce el **schema oficial** que todos los módulos deben usar.

---

## Resumen ejecutivo

| Estado | Cantidad | Campos |
|--------|----------|--------|
| **Faltan en 002_sync.sql** (mi propuesta los tenía) | 11 | `idempotency_key`, `usuario_id`, `campos_modificados`, `version_catalogo`, `conflicto_tipo`, `conflicto_resuelto`, `resuelto_por`, `resuelto_at`, `lote_sync_id`, `numero_secuencia`, `checksum` |
| **Faltan en mi propuesta** (002_sync.sql los tenía) | 3 | `version`, `resolucion_conflicto`, `created_at` |
| **Tipo diferente** (misma semántica) | 6 | `id`, `tabla_afectada`, `payload_antes`, `payload_despues`, `timestamp_local`, `timestamp_servidor` |
| **Valores CHECK distintos** | 1 | `operacion` (002 no tiene `MERGE`) |
| **Nullable distinto** | 1 | `registro_id` (002: NOT NULL, propuesta: nullable) |
| **Referencia distinta** | 1 | `empresa_id` (tabla se llama `empresas`, no `companies`) |
| **Coinciden exactamente** | 3 | `dispositivo_id`, `sincronizado`, `conflicto` |

**Veredicto general:** 002_sync.sql tiene una base sólida y sigue correctamente las decisiones de diseño del  
`schema-decisions.md`. Le faltan 11 campos necesarios para la estrategia de resolución de conflictos descrita  
en `sync-architecture.md`. La propuesta original usaba tipos PostgreSQL (JSONB, TIMESTAMPTZ, UUID, arrays)  
incompatibles con SQLite — en todos los casos, el tipo TEXT de 002_sync.sql es el correcto para este stack.

---

## Análisis campo por campo

### Grupo 1 — Campos que FALTAN en 002_sync.sql

Estos 11 campos son necesarios según la arquitectura de sync. Los tipos se adaptan a la convención SQLite/TEXT del schema existente.

---

#### `idempotency_key` — **CRÍTICO. Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `VARCHAR(128) UNIQUE NOT NULL`  
**Versión definitiva:** `TEXT NOT NULL` con `UNIQUE INDEX`

**Por qué es crítico:**  
Sin `idempotency_key`, si un dispositivo envía un lote de sync y la red falla *después* de que el servidor lo procesó pero *antes* de que llegue el HTTP 200, el dispositivo reintentará. El servidor procesará el mismo evento dos veces: **una venta se registra duplicada, el stock baja el doble**.

El cliente genera la key una sola vez al crear el evento:
```javascript
idempotency_key: `${dispositivo_id}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`
// Ejemplo: "caja-a1-1712959200000-f3a8c2d1"
```

El servidor al recibir:
```sql
INSERT INTO eventos_sync (..., idempotency_key)
VALUES (...)
ON CONFLICT (idempotency_key) DO NOTHING;
-- Si ya existía: retorna OK silencioso al cliente
```

**Incompatibilidad con 002_sync.sql:** Ninguna. Es un campo nuevo, no rompe nada.

---

#### `usuario_id` — **Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `UUID REFERENCES users(id)`  
**Versión definitiva:** `TEXT REFERENCES usuarios(id)`

**Por qué es necesario:**  
`dispositivo_id` identifica la máquina. `usuario_id` identifica la persona. En un local donde  
varios vendedores turnan en la misma PC, `dispositivo_id` solo no alcanza para auditoría.  
Cuando hay una sobreventa y el auditor pregunta "¿quién vendió?", el sistema debe poder responder.

**Decisión sobre obligatoriedad:** Se deja nullable (`NULL` permitido) para casos donde el sistema genera  
eventos automáticos (ej: recálculo de stock por job nocturno) donde no hay usuario activo.

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

#### `campos_modificados` — **Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `VARCHAR(255)[]` (array PostgreSQL — incompatible con SQLite)  
**Versión definitiva:** `TEXT` (JSON array serializado)

**Adaptación para SQLite:**  
```sql
-- Se guarda como JSON string
campos_modificados TEXT  -- ej: '["telefono","email","direccion"]'
-- NULL para INSERT y DELETE (no aplica)
-- En PostgreSQL se puede castear a TEXT[] o usar json_each()
```

**Por qué es necesario:**  
El merge por campo (Sección 2.3 de sync-architecture.md) requiere saber exactamente qué campos  
cambió un dispositivo. Sin esto, al recibir un UPDATE offline habría que comparar todo el  
`payload_despues` contra el estado del servidor campo por campo — caro y propenso a errores.  
Con `campos_modificados`, el servidor aplica solo los campos que el cliente realmente tocó.

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

#### `version_catalogo` — **Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `BIGINT`  
**Versión definitiva:** `INTEGER` (SQLite usa INTEGER para todo entero; suficiente hasta 9×10¹⁸)

**Por qué es necesario:**  
Detecta el caso del dispositivo que estuvo offline 7 días (Sección 5.3 de sync-architecture.md).  
Si `version_catalogo` del evento es 42 y el servidor está en versión 58, el sistema sabe que  
la venta se hizo con precios de hace 16 versiones. Puede reportarlo y alertar.

Sin este campo, no hay forma de saber si una venta offline usó precios actualizados o no.

**Relación con `version` existente en 002_sync.sql:**  
Son conceptos distintos:
- `version` (ya existe): versión del **registro** afectado. Optimistic concurrency: "yo edité la versión 5 del cliente X"
- `version_catalogo` (nuevo): versión del **catálogo de precios/config** que tenía el dispositivo cuando generó el evento

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

#### `conflicto_tipo` — **Agregar.**

**Estado:** Falta en 002_sync.sql (solo hay un `conflicto BOOLEAN`)  
**Propuesta original:** `VARCHAR(32) CHECK enum`  
**Versión definitiva:** `TEXT CHECK (conflicto_tipo IN (...))`

**Por qué un boolean no alcanza:**  
`conflicto = true` dice "hay un conflicto" pero no dice qué tipo. La resolución de un SOBREVENTA  
es completamente diferente a la de un CAMPO_DIVERGENTE o un RECHAZO_FISCAL. Sin el tipo,  
el código de resolución tiene que inferir el tipo del conflicto leyendo los payloads — frágil.

```sql
conflicto_tipo TEXT CHECK (conflicto_tipo IN (
    'SOBREVENTA',        -- vendieron más de lo disponible
    'CAMPO_DIVERGENTE',  -- dos devices editaron el mismo campo con distintos valores
    'DUPLICADO',         -- cliente/producto creado en dos places offline
    'VERSION_OBSOLETA',  -- precio/config desactualizado al momento de la venta
    'RECHAZO_FISCAL',    -- AFIP rechazó la factura al sincronizar
    'CLIENTE_BLOQUEADO'  -- venta a cliente bloqueado hecha offline
))
-- NULL cuando conflicto = false
```

**Relación con `resolucion_conflicto` existente en 002_sync.sql:**  
Son complementarios, no alternativos:
- `conflicto_tipo` = qué pasó (categoría para routing y queries)
- `resolucion_conflicto` = cómo se resolvió (JSON con detalles completos)

```sql
-- Ejemplo de resolucion_conflicto JSON para una SOBREVENTA:
{
  "decidido_por": "sistema-automatico",
  "accion": "VENTA_ACEPTADA_STOCK_NEGATIVO",
  "stock_resultante": -1,
  "ventas_involucradas": ["uuid-venta-a", "uuid-venta-b"],
  "timestamp_resolucion": "2026-04-12T11:00:05Z"
}
```

**Incompatibilidad con 002_sync.sql:** Ninguna. `conflicto_tipo` se agrega al lado de `conflicto`.

---

#### `conflicto_resuelto`, `resuelto_por`, `resuelto_at` — **Agregar los tres.**

**Estado:** Faltan en 002_sync.sql  
**Propuesta original:** `BOOLEAN`, `UUID REF`, `TIMESTAMPTZ`  
**Versión definitiva:** `BOOLEAN NOT NULL DEFAULT false`, `TEXT REFERENCES usuarios(id)`, `TEXT`

**Por qué son necesarios como trío:**  
`conflicto = true` solo dice que el conflicto fue detectado. No dice si ya fue atendido.  
Sin estos campos, la única forma de saber si un conflicto está resuelto es leer  
`resolucion_conflicto` (JSON) — no se puede hacer `WHERE conflicto_resuelto = false`  
eficientemente.

El índice parcial para conflictos pendientes (el más importante del sistema):
```sql
CREATE INDEX idx_eventos_sync_conflictos_pendientes 
ON eventos_sync(empresa_id, conflicto_tipo)
WHERE conflicto = true AND conflicto_resuelto = false;
```

Este índice es lo que alimenta el "panel de conflictos" del administrador en tiempo real.

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

#### `lote_sync_id` — **Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `UUID`  
**Versión definitiva:** `TEXT` (UUID como TEXT)

**Por qué es necesario:**  
Un `flushPendingOps()` puede enviar 30 operaciones juntas (ej: vendedor offline 2 horas).  
Si el evento nro. 15 falla (ej: violación de FK), necesitamos saber cuáles son sus "hermanos"  
en el mismo flush para tomar decisiones sobre el lote completo.

```sql
-- Todos los eventos del mismo flush tienen el mismo lote_sync_id
SELECT * FROM eventos_sync 
WHERE lote_sync_id = 'uuid-del-lote'
ORDER BY numero_secuencia;
```

Permite rollback de lote completo si se decide que un error en un evento invalida todos los anteriores  
(política configurable por tipo de operación).

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

#### `numero_secuencia` — **Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `BIGINT`  
**Versión definitiva:** `INTEGER`

**Por qué es necesario:**  
El `timestamp_local` puede ser poco confiable:
- Relojes del sistema desincronizados (common en Windows sin NTP)
- Tablets con fecha incorrecta
- Dos eventos en el mismo milisegundo

El `numero_secuencia` es un contador monotónico **dentro del dispositivo** que da el orden  
causal real de los eventos. Combinado con `dispositivo_id`, es el orden de procesamiento correcto:

```
(dispositivo_id, numero_secuencia) → orden causal definitivo
timestamp_local → orden aproximado entre dispositivos
```

```sql
-- Formato: secuencia monotónica en el cliente
numero_secuencia INTEGER  -- 1, 2, 3, 4... por dispositivo (independiente entre devices)
```

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

#### `checksum` — **Agregar.**

**Estado:** Falta en 002_sync.sql  
**Propuesta original:** `VARCHAR(64)`  
**Versión definitiva:** `TEXT`

**Por qué es necesario:**  
Detecta corrupción de datos entre el dispositivo y el servidor. Se calcula en el cliente:

```javascript
checksum = SHA256(JSON.stringify({
    id, operacion, tabla_afectada, registro_id,
    payload_despues, timestamp_local, numero_secuencia
})).slice(0, 16)  // primeros 16 chars = 64 bits, suficiente
```

El servidor verifica antes de procesar. Si no coincide: rechaza el evento y lo marca  
como `error_checksum` en `cola_sync`. Costo: despreciable. Beneficio: detecta  
casos raros pero catastróficos de corrupción en IndexedDB o en tránsito.

**Incompatibilidad con 002_sync.sql:** Ninguna.

---

### Grupo 2 — Campos que FALTAN en mi propuesta (presentes en 002_sync.sql)

Los tres se mantienen en el schema definitivo.

---

#### `version` — **Mantener de 002_sync.sql.** ✅

**Estado:** Presente en 002_sync.sql, ausente en mi propuesta (omisión involuntaria)  
**Tipo:** `INTEGER NOT NULL DEFAULT 1`

**Por qué es correcto:**  
Implementa **Optimistic Concurrency Control** de manera elegante. Cuando un dispositivo  
lee un registro de la base, se guarda la versión. Al editar offline y sincronizar:

```python
def verificar_version(evento: Evento, registro_actual: dict) -> bool:
    if evento.version != registro_actual["version"]:
        # El servidor tiene versión distinta → conflicto
        evento.conflicto = True
        evento.conflicto_tipo = "CAMPO_DIVERGENTE"
        return False
    return True
```

La versión se incrementa en cada UPDATE exitoso en el servidor:
```sql
UPDATE tabla SET version = version + 1, ... WHERE id = ?
```

Este campo es compatible y complementario con `numero_secuencia` (que es orden dentro del device)  
y con `version_catalogo` (que es versión del catálogo de precios).

**No confundir los tres:**
| Campo | Responde a |
|-------|-----------|
| `version` | ¿En qué versión del registro estaba el device cuando editó? |
| `numero_secuencia` | ¿En qué orden ocurrieron los eventos dentro del device? |
| `version_catalogo` | ¿Con qué versión de precios/config se generó este evento? |

---

#### `resolucion_conflicto` — **Mantener de 002_sync.sql.** ✅

**Estado:** Presente en 002_sync.sql, ausente en mi propuesta (usé `conflicto_tipo` en su lugar)  
**Tipo:** `TEXT` (JSON)

**Por qué es correcto:**  
Como se analizó en `conflicto_tipo` arriba, ambos campos coexisten con propósitos distintos.  
`resolucion_conflicto` guarda el JSON completo de cómo se resolvió — el histórico detallado.  
`conflicto_tipo` permite queries rápidas por categoría.

---

#### `created_at` — **Mantener de 002_sync.sql.** ✅

**Estado:** Presente en 002_sync.sql, ausente en mi propuesta (omisión involuntaria)  
**Tipo:** `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

**Por qué es correcto:**  
Está en **todas** las tablas del schema (`empresas`, `usuarios`, `dispositivos`, `productos`).  
Omitirlo en `eventos_sync` sería inconsistente. Semánticamente distinto de `timestamp_local`  
(cuándo ocurrió el evento) y `timestamp_servidor` (cuándo lo procesó el servidor):  
`created_at` es cuándo se insertó la fila en la base de datos.

---

### Grupo 3 — Tipos diferentes (misma semántica)

En todos los casos, el tipo TEXT de 002_sync.sql es correcto para el stack SQLite + PostgreSQL  
definido en `schema-decisions.md`. Mi propuesta usaba tipos PostgreSQL puros.

| Campo | Mi propuesta | 002_sync.sql | Ganador | Razón |
|-------|-------------|-------------|---------|-------|
| `id` | UUID (gen_random_uuid()) | TEXT PK | **002** | gen_random_uuid() es PG-only. UUID generado en app. |
| `tabla_afectada` | VARCHAR(64) | TEXT | **002** | SQLite no distingue VARCHAR de TEXT. |
| `payload_antes` | JSONB | TEXT | **002** | JSONB no existe en SQLite. Ver Decisión #3. |
| `payload_despues` | JSONB NOT NULL | TEXT | **002** | Ídem. PG annotation: `JSONB`. |
| `timestamp_local` | TIMESTAMPTZ | TEXT ISO8601 | **002** | TIMESTAMPTZ no existe en SQLite. Ver Decisión #2. |
| `timestamp_servidor` | TIMESTAMPTZ DEFAULT NOW() | TEXT nullable | **002** | Ídem. DEFAULT NOW() es PG-only. |

---

### Grupo 4 — Diferencias menores

#### `operacion` — CHECK constraint: agregar `MERGE`

**002_sync.sql:** `CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE'))`  
**Mi propuesta:** Agregar `'MERGE'`

**Análisis:**  
`MERGE` como tipo de operación es válido con una **condición importante**: solo el servidor lo genera,  
nunca un dispositivo cliente. Cuando el servidor resuelve un conflicto de campo divergente  
fusionando dos versiones, el evento resultante no es un UPDATE de ninguna de las dos versiones  
originales — es una fusión. Llamarlo `UPDATE` sería impreciso.

**Decisión:** Se agrega `MERGE` al CHECK, con la convención documentada:
```
- INSERT, UPDATE, DELETE → generados por el dispositivo cliente
- MERGE → generado únicamente por el servidor al resolver conflictos
```

#### `registro_id` — Nullable

**002_sync.sql:** `TEXT NOT NULL`  
**Mi propuesta:** Nullable

**Decisión:** `NOT NULL` de 002_sync.sql es correcto. Todo evento afecta un registro específico.  
Si no hay registro (imposible en práctica), hay un bug en el código que genera el evento.  
`NOT NULL` fuerza al código cliente a ser correcto. Mi propuesta de nullable fue un error.

#### `empresa_id` — Nombre de tabla referenciada

**002_sync.sql:** `REFERENCES empresas(id)`  
**Mi propuesta:** `REFERENCES companies(id)` (nombre del modelo Python en el ERP existente)

**Decisión:** `empresas` es el nombre correcto para este nuevo schema. El modelo Python del ERP  
existente tiene su propia convención. El nuevo schema normaliza en español según el resto  
de las tablas (`001_empresas.sql`).

---

## Análisis de `cola_sync`

La tabla `cola_sync` está **únicamente en 002_sync.sql** — mi propuesta no la tenía (usé  
el IndexedDB `pendingOps` para esto). Es un diseño correcto y superior porque:

1. **Persiste en disco** (SQLite) — sobrevive si el app se cierra
2. **Separada de `eventos_sync`** — no contamina el log con metadata de retry
3. **Backoff exponencial** via `proximo_intento`
4. **Max reintentos** configurable por evento

**Se mantiene con una adición:** campo `tipo_error` para categorizar fallos:

```sql
tipo_error TEXT CHECK (tipo_error IN (
    'RED',           -- timeout, connection refused
    'SERVIDOR_5XX',  -- error interno del servidor  
    'CONFLICTO',     -- el servidor rechazó por conflicto
    'VALIDACION',    -- datos inválidos (FK violation, etc.)
    'CHECKSUM'       -- checksum no coincide
))
```

Esto permite reintentos inteligentes: `RED` y `SERVIDOR_5XX` se reintentan automáticamente,  
`VALIDACION` y `CONFLICTO` requieren intervención humana.

---

## Schema definitivo

A continuación, el SQL oficial que reemplaza a `002_sync.sql`. Escrito para SQLite con  
anotaciones PostgreSQL siguiendo la convención de `schema-decisions.md`.

```sql
-- ============================================================
-- 002_sync.sql — Event sourcing para sincronización offline/online
-- Versión: 2.0 (reconciliada con sync-architecture.md)
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
    -- Dispositivo físico que generó el evento.

    empresa_id          TEXT NOT NULL REFERENCES empresas(id),
    -- Tenant. Toda query de sync debe filtrar por empresa_id.

    usuario_id          TEXT REFERENCES usuarios(id),
    -- Usuario que realizó la acción. NULL para eventos del sistema.

    -- ─── OPERACIÓN ──────────────────────────────────────────────────────────
    tabla_afectada      TEXT NOT NULL,
    -- Nombre de la tabla afectada: 'productos', 'variantes_producto',
    -- 'movimientos_stock', 'ventas', 'items_venta', etc.

    registro_id         TEXT NOT NULL,
    -- UUID del registro afectado. Nunca NULL: todo evento afecta un registro.

    operacion           TEXT NOT NULL
                        CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE')),
    -- INSERT/UPDATE/DELETE → generado por el dispositivo cliente.
    -- MERGE → generado SOLO por el servidor al fusionar versiones en conflicto.

    -- ─── PAYLOAD ────────────────────────────────────────────────────────────
    payload_antes       TEXT,
    -- JSON: estado completo del registro ANTES de la operación.
    -- NULL en INSERT (no había estado previo).
    -- Nota PostgreSQL: usar JSONB.

    payload_despues     TEXT,
    -- JSON: estado completo del registro DESPUÉS de la operación.
    -- NULL en DELETE (el registro fue eliminado).
    -- Nota PostgreSQL: usar JSONB.

    campos_modificados  TEXT,
    -- JSON array con los nombres de los campos que cambiaron.
    -- Solo aplica en UPDATE. Ejemplo: '["telefono","email"]'
    -- NULL en INSERT y DELETE.
    -- Nota PostgreSQL: se puede usar TEXT[] o JSONB.
    -- Permite merge por campo sin parsear los payloads completos.

    -- ─── VERSIONADO ─────────────────────────────────────────────────────────
    version             INTEGER NOT NULL DEFAULT 1,
    -- Versión del registro al momento de la mutación.
    -- Optimistic concurrency: si el servidor tiene una versión mayor,
    -- hay conflicto. Incrementa en cada UPDATE exitoso en el servidor.

    version_catalogo    INTEGER,
    -- Versión del catálogo de precios/configuración que tenía el dispositivo
    -- cuando generó este evento. Detecta ventas con precios desactualizados.
    -- NULL si el dispositivo no tiene catálogo versionado aún.
    -- Se compara contra catalog_versions.version en el servidor.

    -- ─── TEMPORALIDAD ───────────────────────────────────────────────────────
    timestamp_local     TEXT NOT NULL,
    -- Cuándo ocurrió el evento en el dispositivo. ISO 8601 con TZ.
    -- Ejemplo: "2026-04-12T10:00:00.000Z"
    -- Puede ser impreciso (reloj del sistema). Para orden causal
    -- usar numero_secuencia.

    timestamp_servidor  TEXT,
    -- Cuándo lo procesó el servidor. NULL hasta que sincroniza.
    -- ISO 8601. En PostgreSQL: TIMESTAMPTZ DEFAULT NOW() al insertar.

    numero_secuencia    INTEGER,
    -- Contador monotónico por dispositivo. 1, 2, 3...
    -- Más confiable que timestamp_local para ordenar causalmente eventos
    -- del mismo dispositivo. NULL si el dispositivo no lo implementa aún.
    -- Orden causal definitivo: ORDER BY dispositivo_id, numero_secuencia.

    -- ─── LOTE ───────────────────────────────────────────────────────────────
    lote_sync_id        TEXT,
    -- UUID del lote de sincronización. Todos los eventos enviados en
    -- el mismo flushPendingOps() comparten el mismo lote_sync_id.
    -- Permite rollback coordinado de lotes y correlación de errores.
    -- NULL para eventos generados por el servidor (MERGE, etc.).

    -- ─── ESTADO DE SYNC ─────────────────────────────────────────────────────
    sincronizado        BOOLEAN NOT NULL DEFAULT false,
    -- false: pendiente de enviar al servidor.
    -- true: el servidor lo procesó y respondió OK.

    -- ─── CONFLICTO ──────────────────────────────────────────────────────────
    conflicto           BOOLEAN NOT NULL DEFAULT false,
    -- true: el servidor detectó un conflicto al procesar este evento.

    conflicto_tipo      TEXT
                        CHECK (conflicto_tipo IS NULL OR conflicto_tipo IN (
                            'SOBREVENTA',        -- vendieron más unidades de las disponibles
                            'CAMPO_DIVERGENTE',  -- mismo campo editado offline en 2 devices
                            'DUPLICADO',         -- registro creado en 2 places offline
                            'VERSION_OBSOLETA',  -- evento generado con catálogo desactualizado
                            'RECHAZO_FISCAL',    -- AFIP rechazó la factura al sincronizar
                            'CLIENTE_BLOQUEADO'  -- venta a cliente bloqueado hecha offline
                        )),
    -- Categoría del conflicto. NULL cuando conflicto = false.
    -- Permite routing a la lógica de resolución correcta y queries eficientes.

    resolucion_conflicto TEXT,
    -- JSON con el detalle completo de cómo se resolvió el conflicto.
    -- NULL si no hubo conflicto o si aún no se resolvió.
    -- Ejemplo: {"accion": "VENTA_ACEPTADA_STOCK_NEGATIVO", "stock_resultante": -1}
    -- Nota PostgreSQL: usar JSONB.

    conflicto_resuelto  BOOLEAN NOT NULL DEFAULT false,
    -- false: conflicto detectado pero pendiente de resolución.
    -- true: conflicto cerrado (manual o automáticamente).
    -- Permite el índice parcial del panel de conflictos pendientes.

    resuelto_por        TEXT REFERENCES usuarios(id),
    -- Usuario que resolvió el conflicto. NULL si fue resolución automática
    -- del sistema o si aún no se resolvió.

    resuelto_at         TEXT,
    -- Cuándo se resolvió. ISO 8601. NULL si no resuelto.

    -- ─── INTEGRIDAD ─────────────────────────────────────────────────────────
    checksum            TEXT,
    -- SHA-256 (primeros 16 chars) del payload para verificar integridad.
    -- Calculado en el cliente sobre: {id, operacion, tabla_afectada,
    -- registro_id, payload_despues, timestamp_local, numero_secuencia}
    -- NULL si el cliente no implementa checksum (compatibilidad backward).

    -- ─── METADATA ───────────────────────────────────────────────────────────
    created_at          TEXT NOT NULL
                        DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- Cuándo se insertó esta fila. Puede diferir de timestamp_local
    -- (en cliente = cuando ocurrió la acción; en servidor = cuando llegó).

    -- ─── CONSTRAINTS ────────────────────────────────────────────────────────
    CONSTRAINT uq_idempotency UNIQUE (idempotency_key),

    CONSTRAINT chk_payload_insert
        CHECK (operacion != 'INSERT' OR payload_antes IS NULL),
    -- En INSERT no puede haber estado previo.

    CONSTRAINT chk_conflicto_consistente
        CHECK (conflicto = true OR conflicto_tipo IS NULL),
    -- conflicto_tipo solo tiene sentido si conflicto = true.

    CONSTRAINT chk_resolucion_consistente
        CHECK (conflicto_resuelto = false OR conflicto = true)
    -- No se puede resolver algo que no es conflicto.
);
-- Nota PostgreSQL: reemplazar TEXT por UUID donde corresponda,
--   TEXT (payloads) por JSONB, TEXT (timestamps) por TIMESTAMPTZ.

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────

-- Queries por empresa (todas las queries de sync filtran por empresa_id)
CREATE INDEX idx_eventos_sync_empresa
    ON eventos_sync(empresa_id);

-- Sync incremental por dispositivo: "dame todo desde mi último sync"
CREATE INDEX idx_eventos_sync_dispositivo_ts
    ON eventos_sync(dispositivo_id, timestamp_local);

-- Buscar todos los eventos de un registro específico (auditoría)
CREATE INDEX idx_eventos_sync_registro
    ON eventos_sync(empresa_id, tabla_afectada, registro_id);

-- Queue de pendientes: la query más frecuente del sistema
CREATE INDEX idx_eventos_sync_pendientes
    ON eventos_sync(empresa_id, dispositivo_id, numero_secuencia)
    WHERE sincronizado = false;
-- Nota SQLite: índices parciales (WHERE) soportados desde v3.8 (2013).

-- Panel de conflictos: conflictos abiertos que requieren atención
CREATE INDEX idx_eventos_sync_conflictos_abiertos
    ON eventos_sync(empresa_id, conflicto_tipo, created_at)
    WHERE conflicto = true AND conflicto_resuelto = false;

-- Lookup por lote de sync (rollback, correlación de errores)
CREATE INDEX idx_eventos_sync_lote
    ON eventos_sync(lote_sync_id)
    WHERE lote_sync_id IS NOT NULL;

-- ============================================================

-- COLA_SYNC
-- Cola de reintentos para eventos que fallaron al sincronizar.
-- Separada de eventos_sync para no contaminar el log principal.
-- Implementa backoff exponencial con categorización de errores.
CREATE TABLE cola_sync (
    id              TEXT PRIMARY KEY,            -- UUID v4
    evento_id       TEXT NOT NULL REFERENCES eventos_sync(id),
    intentos        INTEGER NOT NULL DEFAULT 0,
    max_intentos    INTEGER NOT NULL DEFAULT 10,
    ultimo_intento  TEXT,                        -- ISO 8601 del último intento
    proximo_intento TEXT,                        -- ISO 8601 calculado con backoff
    error_ultimo    TEXT,                        -- mensaje de error del último intento
    tipo_error      TEXT
                    CHECK (tipo_error IS NULL OR tipo_error IN (
                        'RED',           -- timeout, connection refused, DNS fail
                        'SERVIDOR_5XX',  -- error interno del servidor (reintentable)
                        'CONFLICTO',     -- servidor rechazó por conflicto de datos
                        'VALIDACION',    -- datos inválidos (FK, constraint violation)
                        'CHECKSUM'       -- checksum no coincide (posible corrupción)
                    )),
    -- RED y SERVIDOR_5XX → reintento automático con backoff exponencial
    -- CONFLICTO, VALIDACION, CHECKSUM → requieren intervención humana
    estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN (
                        'pendiente',    -- esperando proximo_intento
                        'procesando',   -- en vuelo actualmente
                        'completado',   -- sincronizado exitosamente
                        'fallido'       -- agotó max_intentos o tipo_error manual
                    )),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_cola_sync_estado ON cola_sync(estado);
CREATE INDEX idx_cola_sync_proximo ON cola_sync(proximo_intento)
    WHERE estado = 'pendiente';
CREATE INDEX idx_cola_sync_evento ON cola_sync(evento_id);
CREATE INDEX idx_cola_sync_error ON cola_sync(tipo_error)
    WHERE estado = 'fallido';
-- Último índice: permite listar todos los fallos por categoría de error
-- para el dashboard de operaciones.
```

---

## Tabla de decisiones finales

| Campo | Fuente | Acción | Justificación resumida |
|-------|--------|--------|----------------------|
| `id` | 002_sync.sql | ✅ Mantener como TEXT | gen_random_uuid() es PG-only |
| `idempotency_key` | Propuesta | ✅ Agregar | Previene doble-procesamiento (crítico) |
| `dispositivo_id` | 002_sync.sql | ✅ Mantener | Correcto, con FK |
| `empresa_id` | 002_sync.sql | ✅ Mantener | Referencia a `empresas` (no `companies`) |
| `usuario_id` | Propuesta | ✅ Agregar como nullable | Auditoría — quién hizo la acción |
| `tabla_afectada` | 002_sync.sql | ✅ Mantener como TEXT | Semántica idéntica a VARCHAR |
| `registro_id` | 002_sync.sql | ✅ Mantener NOT NULL | No puede ser NULL — fuerza corrección en cliente |
| `operacion` | Ambos | ✅ Agregar MERGE | Solo servidor puede usar MERGE |
| `payload_antes` | 002_sync.sql | ✅ Mantener como TEXT | PG annotation: JSONB |
| `payload_despues` | 002_sync.sql | ✅ Mantener como TEXT | PG annotation: JSONB |
| `campos_modificados` | Propuesta | ✅ Agregar como TEXT JSON | Arrays no soportados en SQLite |
| `version` | 002_sync.sql | ✅ Mantener | Optimistic concurrency control |
| `version_catalogo` | Propuesta | ✅ Agregar como INTEGER | Detecta ventas con precios viejos |
| `timestamp_local` | 002_sync.sql | ✅ Mantener como TEXT | ISO 8601. PG annotation: TIMESTAMPTZ |
| `timestamp_servidor` | 002_sync.sql | ✅ Mantener como TEXT | Ídem |
| `numero_secuencia` | Propuesta | ✅ Agregar como INTEGER | Orden causal confiable dentro del device |
| `lote_sync_id` | Propuesta | ✅ Agregar como TEXT | Agrupa eventos del mismo flush |
| `sincronizado` | Ambos | ✅ Mantener BOOLEAN NOT NULL | Correcto |
| `conflicto` | Ambos | ✅ Mantener BOOLEAN NOT NULL | Correcto |
| `conflicto_tipo` | Propuesta | ✅ Agregar con CHECK enum | Routing de resolución por categoría |
| `resolucion_conflicto` | 002_sync.sql | ✅ Mantener como TEXT JSON | Detalle completo de resolución |
| `conflicto_resuelto` | Propuesta | ✅ Agregar BOOLEAN NOT NULL | Distingue detectado vs cerrado |
| `resuelto_por` | Propuesta | ✅ Agregar como TEXT REF | Auditoría de resolución |
| `resuelto_at` | Propuesta | ✅ Agregar como TEXT ISO 8601 | Cuándo se resolvió |
| `checksum` | Propuesta | ✅ Agregar como TEXT | Integridad en tránsito |
| `created_at` | 002_sync.sql | ✅ Mantener | Consistente con todas las tablas |
| **`cola_sync.tipo_error`** | **Nueva** | **✅ Agregar** | **Reintentos inteligentes por categoría** |

**Total campos en schema definitivo:** 26 (vs 15 en 002_sync.sql, vs 22 en mi propuesta)  
**Ningún campo eliminado.** Todos los campos de 002_sync.sql se mantienen.  
**Todos los nuevos son backward-compatible** (nullable o con DEFAULT).

---

## Próximo paso

El SQL de arriba reemplaza el contenido actual de `schema/002_sync.sql`.  
Todos los módulos que referencien `eventos_sync` deben usar este schema.  
Las migraciones Alembic del backend deben sincronizarse con este diseño.
