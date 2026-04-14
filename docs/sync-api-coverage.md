# Cobertura API de Sincronización — ERP Mundo Outdoor

> **Objetivo de este documento:** Verificar que `app/api/v1/sync.py` (Copilot A)
> implementa correctamente el algoritmo central de `docs/conflict-resolution.md`.
> Identifica gaps, propone soluciones y define los tests de integración requeridos.

**Fecha:** 2026-04-12  
**Versión analizada:** `sync.py` (commit actual), `conflict-resolution.md` v1.0  
**Referencia de schema:** `schema/002_sync.sql` v2.0

---

## Índice

1. [Cobertura de Endpoints por Caso de Conflicto](#sección-1--cobertura-de-endpoints)
2. [Gaps Críticos Ordenados por Prioridad](#sección-2--gaps-críticos)
3. [Tests de Integración Requeridos](#sección-3--tests-de-integración)
4. [Apéndice: Schema EventIn vs Requerido](#apéndice--schema-evenin-vs-requerido)

---

---

# SECCIÓN 1 — COBERTURA DE ENDPOINTS

## 1.1 Endpoints existentes en sync.py

| Método | Ruta | Función |
|--------|------|---------|
| `POST` | `/sync/events` | Push batch de eventos desde dispositivo |
| `GET`  | `/sync/pull` | Pull eventos desde un watermark |
| `POST` | `/sync/register-device` | Registro/actualización de dispositivo |
| `GET`  | `/sync/status` | Estado de sync para un dispositivo |
| `GET`  | `/sync/conflicts` | Listar conflictos de la empresa |
| `POST` | `/sync/conflicts/{id}/resolve` | Resolución manual de conflicto |
| `GET`  | `/sync/devices` | Listar dispositivos registrados |
| `POST` | `/storage/upload` | Upload de archivo a storage local |
| `GET`  | `/storage/{id}` | Servir archivo |
| `GET`  | `/storage/{id}/download` | Descargar archivo |
| `DELETE` | `/storage/{id}` | Soft-delete de archivo |
| `GET`  | `/storage/entity/{type}/{id}` | Listar archivos de una entidad |

## 1.2 Tabla de cobertura por caso de conflicto

| Caso de conflicto (conflict-resolution.md) | Endpoint que debería manejarlo | Estado | Detalle |
|--------------------------------------------|-------------------------------|--------|---------|
| **Stock negativo — detección** | `POST /sync/events` → `_detect_conflicts` | ⚠️ **PARCIAL** | Detecta solo si `payload.resulting_stock < 0` (dato del cliente). No calcula desde DB. Ver §2.1. |
| **Stock negativo — transacción serializable** | `POST /sync/events` | ❌ **FALTA** | Los eventos se procesan en loop sin `SERIALIZABLE`. Ventana de race condition entre dos dispositivos simultáneos. |
| **Stock negativo — notificación al admin** | `POST /sync/events` | ❌ **FALTA** | Crea `SyncConflict` pero no inserta en `notificaciones`. No existe modelo `Notificacion`. |
| **Stock negativo — marcar factura para revisión** | `POST /sync/events` | ❌ **FALTA** | No actualiza `facturas.requiere_revision`. No existe modelo `Factura` en el backend. |
| **Actualización concurrente (stale update)** | `POST /sync/events` → `_detect_conflicts` | ⚠️ **PARCIAL** | Detecta si `version` nueva ≤ `version` existente. Solo para `event_type="Updated"`. No hace merge por campo. |
| **Factura AFIP rechazada — detección** | *(ninguno)* | ❌ **FALTA** | No hay handler para `tabla_afectada="facturas"`. Sin webhook de respuesta AFIP. |
| **Factura AFIP — notificar al cliente** | *(ninguno)* | ❌ **FALTA** | WhatsApp stub no existe. No hay modelo `Notificacion`. |
| **Factura AFIP — manejar pago cobrado** | *(ninguno)* | ❌ **FALTA** | Sin lógica de estado `rechazada_afip` ni devolución de crédito. |
| **OT merge por campo** | *(ninguno)* | ❌ **FALTA** | No hay handler para `tabla_afectada="ordenes_trabajo"`. Sin lógica de merge field-level. |
| **OT — merge_append en `trabajo_realizado`** | *(ninguno)* | ❌ **FALTA** | No existe. |
| **OT — server_wins para `estado`** | *(ninguno)* | ❌ **FALTA** | No existe. |
| **Clientes — merge datos maestros** | *(ninguno)* | ❌ **FALTA** | No hay handler para `tabla_afectada="clientes"`. |
| **Clientes — server_wins datos comerciales** | *(ninguno)* | ❌ **FALTA** | No existe. |
| **Clientes — alerta por CUIT duplicado** | *(ninguno)* | ❌ **FALTA** | No existe. |
| **Dispositivo 7 días offline — Phase 1 (críticos)** | *(ninguno)* | ❌ **FALTA** | No hay `GET /sync/criticos`. El servidor no empuja bloqueos/precios antes de recibir los pendientes. |
| **Dispositivo offline — precios actualizados** | `GET /sync/pull` | ⚠️ **PARCIAL** | Los eventos de precios llegan en el pull normal. Sin priorización. Sin validación de `version_catalogo`. |
| **Dispositivo offline — cliente bloqueado** | `GET /sync/pull` | ❌ **FALTA** | El servidor debería empujar este bloqueo en Phase 1 *antes* de procesar los pendientes del dispositivo. Con pull puro, el dispositivo envía primero y puede que la venta llegue antes de recibir el bloqueo. |
| **Dispositivo offline — producto discontinuado** | `GET /sync/pull` | ❌ **FALTA** | Sin Phase 1, sin detección de discontinuaciones en el event processor. |
| **Checksum de integridad de evento** | `POST /sync/events` | ❌ **FALTA** | `EventIn` no tiene campo `checksum`. |
| **Idempotency key con formato canónico** | `POST /sync/events` | ⚠️ **DIFERENTE** | Usa `event_id` para deduplicar (funciona), pero no el formato `{device_id}-{ts_ms}-{rand8}` del schema. Sin campo `idempotency_key` en `EventIn`. |
| **Before-state (`payload_antes`)** | `POST /sync/events` | ❌ **FALTA** | `EventIn` solo tiene `payload` (after-state). Sin before-state es imposible hacer merge OT/clientes. |
| **Campos modificados (`campos_modificados`)** | `POST /sync/events` | ❌ **FALTA** | Necesario para merge field-level en OTs. |
| **Version de catálogo (`version_catalogo`)** | `POST /sync/events` | ❌ **FALTA** | Sin esto no se detecta que el dispositivo tenía catálogo desactualizado al emitir. |
| **SSE broadcasting a dispositivos online** | *(ninguno)* | ❌ **FALTA** | Post-sync, los otros dispositivos no se enteran hasta su próximo pull. |
| **Cola de reintentos (`cola_sync`)** | *(ninguno)* | ❌ **FALTA** | Eventos que fallan no tienen dead-letter queue. |
| **WhatsApp stub** | *(ninguno)* | ❌ **FALTA** | Sin servicio de notificaciones. |

## 1.3 Resumen ejecutivo

| Categoría | Total casos | ✅ Completo | ⚠️ Parcial | ❌ Falta |
|-----------|-------------|------------|-----------|---------|
| Detección de conflictos | 8 | 0 | 2 | 6 |
| Schema de eventos | 6 | 1 | 1 | 4 |
| Handlers por entidad | 5 | 0 | 0 | 5 |
| Infraestructura sync | 6 | 1 | 1 | 4 |
| **TOTAL** | **25** | **2 (8%)** | **4 (16%)** | **19 (76%)** |

## 1.4 Lo que está bien implementado

A pesar de los gaps, lo siguiente está **correctamente implementado**:

- ✅ **Device registry** — `register-device` con upsert, tracking de `last_sync_at` y watermark
- ✅ **Deduplicación por `event_id`** — previene doble procesamiento en retries
- ✅ **`SyncConflict` model y persistencia** — estructura de conflictos bien diseñada
- ✅ **Listado + resolución manual de conflictos** — `/conflicts` y `/conflicts/{id}/resolve`
- ✅ **Sync status con conteo de pendientes** — útil para el dashboard
- ✅ **Storage system completo** — upload/serve/delete/list, bien aislado por empresa
- ✅ **Aislamiento por `company_id`** — todos los queries filtran correctamente
- ✅ **Concepto de `ConflictType` y `ConflictResolution`** — enums bien definidos

---

---

# SECCIÓN 2 — GAPS CRÍTICOS

Los gaps están ordenados por prioridad. Los primeros **bloquean la correctitud** del sistema. Los últimos agregan funcionalidad importante pero no causan datos incorrectos.

---

## GAP-1 🔴 CRÍTICO — Transacciones NO son SERIALIZABLE

### El problema

```python
# sync.py actual (líneas 160–189)
for ev in body.events:
    existing = db.query(SyncEvent).filter(...).first()
    if existing:
        duplicates += 1; continue
    
    sync_event = SyncEvent(...)
    db.add(sync_event)
    db.flush()
    
    event_conflicts = _detect_conflicts(db, sync_event, ...)
    sync_event.is_processed = True
    processed += 1

db.commit()  # ← UN solo commit para todos los eventos
```

**Escenario de race condition:**
1. Caja A y Caja B sincronizan simultáneamente
2. Ambas pasan el check de `resulting_stock < 0` (payload del cliente) → ninguna detecta conflicto
3. Se comitean las dos → stock negativo SIN conflicto registrado
4. El admin no recibe alerta → el problema queda silencioso

Además, el código hace **un solo `db.commit()` para todo el lote**, lo que significa que si el evento 47 falla, se revierten también los eventos 1-46 que ya eran válidos.

### Solución requerida

```python
@sync_router.post("/events", response_model=PushEventsOut)
def push_events(body: PushEventsIn, db: Session = Depends(get_db), ...):
    # Validar device ...
    
    processed, duplicates = 0, 0
    conflicts = []

    for ev in body.events:
        # Cada evento en su propia transacción SERIALIZABLE
        result = _process_single_event(ev, body.device_id, db, current_user)
        if result["duplicate"]:
            duplicates += 1
        else:
            processed += 1
            conflicts.extend(result["conflicts"])
    
    # Actualizar watermark del dispositivo (en transacción separada, no serializable)
    _update_device_watermark(body.device_id, db)
    
    return PushEventsOut(processed=processed, duplicates=duplicates, conflicts=conflicts, ...)


def _process_single_event(ev: EventIn, device_id: str, db: Session, user: User) -> dict:
    """Procesa UN evento en transacción SERIALIZABLE con retry automático."""
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Transacción serializable por evento (no por lote)
            db.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
            
            # Idempotencia
            existing = db.query(SyncEvent).filter(SyncEvent.id == ev.event_id).first()
            if existing:
                db.rollback()
                return {"duplicate": True, "conflicts": []}
            
            # Insertar + detectar conflictos (dentro de la misma transacción)
            sync_event = SyncEvent(...)
            db.add(sync_event)
            db.flush()
            
            event_conflicts = _detect_conflicts(db, sync_event, user.company_id)
            sync_event.is_processed = True
            
            db.commit()
            return {"duplicate": False, "conflicts": event_conflicts}
        
        except SerializationFailure:
            db.rollback()
            if attempt == max_retries - 1:
                raise
            time.sleep(0.05 * (attempt + 1))
```

---

## GAP-2 🔴 CRÍTICO — Detección de stock negativo lee del payload del cliente (unsafe)

### El problema

```python
# sync.py actual (líneas 407–422)
def _detect_conflicts(db, event, company_id):
    if event.aggregate_type == "StockMovement" and event.event_type in ("Created", "StockAdjusted"):
        payload = event.payload or {}
        new_stock = payload.get("resulting_stock")  # ← DATO DEL CLIENTE
        if new_stock is not None and new_stock < 0:
            # registrar conflicto ...
```

El problema: `resulting_stock` viene en el payload del cliente. El cliente calculó ese número en su dispositivo, con datos potencialmente desactualizados. El servidor no verifica el stock real. Un cliente malicioso (o simplemente incorrecto) puede enviar `resulting_stock = 5` cuando el stock real del servidor es `-3`.

### Solución requerida

```python
def _detect_conflicts(db: Session, event: SyncEvent, company_id: int) -> list[SyncConflict]:
    conflicts = []
    
    # ─── Stock: SIEMPRE calcular desde la DB, nunca confiar en el payload ───
    if event.aggregate_type == "StockMovement":
        payload = event.payload or {}
        variante_id = payload.get("variante_id")
        local_id = payload.get("local_id")
        cantidad = payload.get("cantidad", 0)
        tipo = payload.get("tipo")  # "EGRESO" | "INGRESO" | "AJUSTE" | ...
        
        if tipo in ("EGRESO", "TRANSFERENCIA_OUT") and variante_id and local_id:
            # Calcular stock REAL desde movimientos_stock (fuente de verdad)
            # FOR UPDATE previene race condition entre transacciones serializables paralelas
            resultado = db.execute(text("""
                SELECT COALESCE(SUM(
                    CASE
                        WHEN tipo IN ('INGRESO', 'TRANSFERENCIA_IN') THEN cantidad
                        WHEN tipo IN ('EGRESO', 'TRANSFERENCIA_OUT') THEN -cantidad
                        WHEN tipo = 'AJUSTE' THEN cantidad
                        ELSE 0
                    END
                ), 0) as stock_actual
                FROM movimientos_stock
                WHERE variante_id = :variante_id
                  AND local_id = :local_id
                  AND empresa_id = :empresa_id
                FOR UPDATE
            """), {"variante_id": variante_id, "local_id": local_id, "empresa_id": company_id})
            
            stock_actual = resultado.scalar() or 0
            stock_resultante = stock_actual - cantidad
            
            if stock_resultante < 0:
                c = SyncConflict(
                    event_id=event.id,
                    conflict_type=ConflictType.STOCK_NEGATIVE,
                    aggregate_type=event.aggregate_type,
                    aggregate_id=event.aggregate_id,
                    description=(
                        f"Sobreventa: stock actual={stock_actual}, "
                        f"cantidad vendida={cantidad}, "
                        f"resultante={stock_resultante} "
                        f"(variante={variante_id}, local={local_id})"
                    ),
                    resolution=ConflictResolution.AUTO_RESOLVED,  # DECISIÓN DUEÑO: siempre aceptar
                    company_id=company_id,
                    resolution_data={
                        "stock_antes": stock_actual,
                        "cantidad_vendida": cantidad,
                        "stock_resultante": stock_resultante,
                        "accion": "VENTA_ACEPTADA_STOCK_NEGATIVO",
                    }
                )
                db.add(c)
                db.flush()
                conflicts.append(c)
    
    # ... resto de detecciones
    return conflicts
```

> **Nota:** Para que `FOR UPDATE` funcione debe estar dentro de una transacción `SERIALIZABLE`. Ver GAP-1.

---

## GAP-3 🟠 ALTO — Falta Phase 1: servidor empuja críticos antes de recibir pendientes

### El problema

El protocolo de 3 fases definido en `conflict-resolution.md` §5 es:

```
Fase 1: Servidor → Dispositivo  (críticos: bloqueos, discontinuaciones, precios urgentes)
Fase 2: Dispositivo → Servidor  (eventos pendientes)
Fase 3: Servidor → Dispositivo  (delta de catálogo)
```

Sin Phase 1, puede ocurrir:
1. Cliente García fue bloqueado por deuda a las 10:30
2. Dispositivo vuelve a conectarse a las 11:00
3. El dispositivo envía `POST /sync/events` con una venta a Cliente García
4. El servidor acepta la venta → luego el pull trae el bloqueo → **demasiado tarde**

### Endpoint requerido

```
GET /sync/criticos
```

```python
@sync_router.get("/criticos")
def get_criticos(
    device_id: str = Query(...),
    version_catalogo: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phase 1: retorna datos críticos que el dispositivo DEBE procesar
    antes de enviar sus eventos pendientes.
    El cliente bloquea su cola hasta recibir esta respuesta.
    """
    company_id = current_user.company_id
    
    criticos = {
        "clientes_bloqueados": _get_clientes_bloqueados_recientes(db, company_id, version_catalogo),
        "productos_discontinuados": _get_discontinuados_recientes(db, company_id, version_catalogo),
        "precios_urgentes": _get_precios_urgentes(db, company_id, version_catalogo),
        "version_catalogo_actual": _get_version_catalogo(db, company_id),
        "timestamp_servidor": datetime.utcnow().isoformat(),
    }
    
    return criticos


def _get_clientes_bloqueados_recientes(db, company_id, version_catalogo):
    """Clientes cuyo estado cambió a BLOQUEADO después de version_catalogo."""
    # Requiere tabla catalog_versions o similar para tracking de cambios
    # Alternativa: retornar todos los clientes con estado BLOQUEADO (safe fallback)
    pass
```

> **Nota:** Requiere una tabla `catalog_versions` o `cambios_criticos` que no existe en los schemas actuales. Ver también `docs/schema-decisions.md` Pregunta 5.

---

## GAP-4 🟠 ALTO — `EventIn` falta campos del schema oficial (002_sync.sql v2.0)

### El problema

El schema oficial en `schema/002_sync.sql` v2.0 define campos que `EventIn` no tiene:

| Campo requerido | En `EventIn` | Impacto |
|-----------------|-------------|---------|
| `payload_antes` (before-state) | ❌ Solo hay `payload` (after-state) | **BLOQUEANTE** para merge OT y clientes |
| `campos_modificados` (lista de campos) | ❌ No existe | **BLOQUEANTE** para merge field-level |
| `version_catalogo` | ❌ No existe | Alto: sin esto no se detecta que el dispositivo estaba desactualizado |
| `idempotency_key` con formato canónico | ⚠️ Usa `event_id` (funciona pero diferente semántica) | Medio |
| `checksum` | ❌ No existe | Bajo: integridad en tránsito |
| `lote_sync_id` | ❌ No existe | Bajo: tracking de batch |

### Solución requerida

```python
class EventIn(BaseModel):
    event_id: str                        # ID único del evento (UUIDv4 del dispositivo)
    idempotency_key: str                 # "{device_id}-{ts_ms}-{rand8}" — para dedup semántico
    aggregate_type: str                  # tabla_afectada: "movimientos_stock" | "facturas" | "clientes" | ...
    aggregate_id: str                    # ID del registro afectado
    event_type: str                      # operacion: "INSERT" | "UPDATE" | "DELETE"
    payload_antes: dict | None = None    # Estado ANTES del cambio (None para INSERT)
    payload: dict                        # Estado DESPUÉS del cambio (payload_despues)
    campos_modificados: list[str] | None = None  # ["estado", "trabajo_realizado"] para UPDATE
    sequence_num: int                    # Número de secuencia causal del dispositivo
    version_catalogo: int = 0            # Versión de catálogo que tenía el dispositivo al emitir
    checksum: str | None = None          # SHA-256 de (event_id + payload + sequence_num)
    metadata: dict | None = None
```

---

## GAP-5 🟠 ALTO — No hay handlers por entidad (HANDLERS routing table)

### El problema

`conflict-resolution.md` §6 define un `HANDLERS` routing table:

```python
HANDLERS = {
    ("movimientos_stock", "INSERT"):    handle_movimiento_stock,
    ("facturas", "INSERT"):             handle_factura_insert,
    ("facturas", "UPDATE"):             handle_factura_update,
    ("ordenes_trabajo", "UPDATE"):      handle_ot_update,
    ("clientes", "UPDATE"):             handle_cliente_update,
    ("precios_producto", "UPDATE"):     aplicar_evento_generico,  # server_wins
    # ... etc
}
```

La implementación actual solo tiene `_detect_conflicts` con 2 casos hardcodeados. No hay lógica de merge para OTs ni clientes, y tampoco hay handler para facturas AFIP.

### Solución requerida (estructura mínima)

```python
# app/sync/handlers/__init__.py

def handle_factura(evento: SyncEvent, conflicto, db: Session) -> dict:
    """
    Maneja INSERT/UPDATE de facturas.
    
    POST-SYNC con AFIP: cuando la factura es tipo FC (contingencia),
    intentar validación AFIP y registrar el resultado:
      - Si AFIP acepta: actualizar estado a 'emitida', guardar CAE
      - Si AFIP rechaza: estado='rechazada_afip', crear notificación,
                         marcar requiere_revision=true
    
    NOTA: La validación AFIP es asíncrona. Este handler solo encola la validación.
    """
    payload = evento.payload or {}
    
    if payload.get("tipo_comprobante") == "FC":  # Contingencia
        # Encolar validación AFIP asíncrona
        _encolar_validacion_afip(evento.aggregate_id, db)
    
    return {"accion": "factura_registrada"}


def handle_ot_update(evento: SyncEvent, conflicto, db: Session) -> dict:
    """
    Merge field-level para ordenes_trabajo según tabla de estrategias.
    
    Campos SERVER_WINS: estado, fecha_entrega_estimada
    Campos LWW (timestamp_local como desempate): tecnico_asignado_id
    Campos MERGE_APPEND: trabajo_realizado, repuestos_utilizados
    Campos MANUAL: presupuesto_aprobado, monto_final (si divergen)
    """
    if evento.payload_antes is None or evento.campos_modificados is None:
        # Sin before-state no se puede hacer merge → stale update conflict
        return _handle_stale_update_generico(evento, conflicto, db)
    
    campos = evento.campos_modificados
    payload_nuevo = evento.payload or {}
    
    for campo in campos:
        estrategia = OT_FIELD_STRATEGIES.get(campo, "LWW")
        _aplicar_estrategia(campo, estrategia, evento, db)
    
    return {"accion": "ot_merged", "campos": campos}


def handle_cliente_update(evento: SyncEvent, conflicto, db: Session) -> dict:
    """
    Merge de datos de cliente.
    
    Datos maestros (nombre, cuit, tipo_doc): MANUAL si divergen
    Datos comerciales (limite_credito, estado): SERVER_WINS
    Datos de contacto (email, telefono): LWW por timestamp_local
    """
    # ...
    pass


OT_FIELD_STRATEGIES = {
    # SERVER_WINS
    "estado": "SERVER_WINS",
    "fecha_entrega_estimada": "SERVER_WINS",
    
    # LWW por timestamp_local
    "tecnico_asignado_id": "LWW",
    "fecha_ingreso": "LWW",
    
    # MERGE_APPEND (concatenar con separador)
    "trabajo_realizado": "MERGE_APPEND",
    "repuestos_utilizados": "MERGE_APPEND",
    "observaciones": "MERGE_APPEND",
    
    # MANUAL (requiere intervención humana si divergen)
    "presupuesto_aprobado": "MANUAL",
    "monto_final": "MANUAL",
    "km_ingreso": "MANUAL",
    "km_egreso": "MANUAL",
}
```

---

## GAP-6 🟡 MEDIO — No existe modelo `Notificacion` ni `notificaciones` tabla

### El problema

`conflict-resolution.md` §1 especifica que al detectar stock negativo se debe:

```sql
INSERT INTO notificaciones (empresa_id, tipo, severity, titulo, mensaje, datos_json, created_at)
VALUES ('emp-1', 'STOCK_NEGATIVO', 'HIGH', ...)
```

Esta tabla no existe en ningún schema (`001`, `002`, `003`, `004`). Tampoco hay modelo SQLAlchemy. Sin esto, las alertas del admin no son posibles.

### Solución requerida

**Schema (agregar en 004_negocio.sql o nuevo 005_notificaciones.sql):**

```sql
CREATE TABLE notificaciones (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    empresa_id  TEXT NOT NULL REFERENCES companies(id),
    tipo        TEXT NOT NULL,  -- 'STOCK_NEGATIVO' | 'AFIP_RECHAZADA' | 'CONFLICTO_OT' | 'CLIENTE_BLOQUEADO_VENTA'
    severity    TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    titulo      TEXT NOT NULL,
    mensaje     TEXT NOT NULL,
    datos_json  TEXT,           -- JSON con contexto específico del tipo
    leida       INTEGER NOT NULL DEFAULT 0,
    leida_at    TEXT,
    leida_por   TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    -- PostgreSQL: TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificaciones_empresa_leida
    ON notificaciones (empresa_id, leida, severity, created_at DESC);
```

**Modelo SQLAlchemy (app/models/notificacion.py):**

```python
class Notificacion(Base):
    __tablename__ = "notificaciones"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    tipo = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="MEDIUM")
    titulo = Column(String, nullable=False)
    mensaje = Column(String, nullable=False)
    datos_json = Column(JSON, nullable=True)
    leida = Column(Boolean, nullable=False, default=False)
    leida_at = Column(DateTime, nullable=True)
    leida_por = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
```

---

## GAP-7 🟡 MEDIO — Naming convention incompatible entre sync.py y conflict-resolution.md

### El problema

Los dos esquemas usan vocabulario diferente para el mismo concepto:

| Concepto | `conflict-resolution.md` (schema oficial) | `sync.py` (implementado) |
|----------|------------------------------------------|--------------------------|
| Tabla afectada | `tabla_afectada` | `aggregate_type` |
| ID del registro | `registro_id` | `aggregate_id` |
| Operación | `operacion` (INSERT/UPDATE/DELETE/MERGE) | `event_type` (Created/Updated/Deleted) |
| Evento antes | `payload_antes` | *(no existe)* |
| Evento después | `payload_despues` | `payload` |
| Lote | `lote_sync_id` | *(no existe)* |
| Sincronizado | `sincronizado` | `is_processed` |

**Impacto:** Los routers de `movimientos_stock`, `facturas`, `ordenes_trabajo` (cuando se implementen) enviarán eventos con la nomenclatura de `conflict-resolution.md`. El backend actual los recibiría en `aggregate_type` y no los enrutaría correctamente.

### Solución recomendada

Opción A (preferida): Actualizar `EventIn` y `SyncEvent` para usar la nomenclatura del schema oficial, manteniendo `aggregate_type`/`event_type` como aliases deprecados.

Opción B: Agregar un mapper en `push_events` que traduzca `aggregate_type` → `tabla_afectada` e `event_type` → `operacion` antes del routing.

---

## GAP-8 🟡 MEDIO — Sin cola de reintentos para eventos fallidos

### El problema

Si el procesamiento de un evento falla (DB temporalmente saturada, error de FK, etc.), el evento se pierde. No hay `cola_sync` (dead-letter queue) implementada.

```python
# sync.py actual: si db.commit() falla por cualquier razón, el evento se pierde silenciosamente
# No hay catch de excepciones específico por evento
```

### Solución requerida

```python
# En _process_single_event:
except Exception as e:
    db.rollback()
    # Persistir en cola_sync para retry posterior
    db.execute(text("""
        INSERT INTO cola_sync (evento_id, dispositivo_id, empresa_id, 
                               payload_original, tipo_error, detalle_error, 
                               intentos, proximo_intento)
        VALUES (:eid, :did, :cid, :payload, :tipo, :detalle, 1, 
                datetime('now', '+5 minutes'))
    """), {...})
    db.commit()
```

La tabla `cola_sync` ya existe en `schema/002_sync.sql` v2.0 — solo falta implementar el modelo y la lógica.

---

## GAP-9 🟢 BAJO — Sin SSE/WebSocket para propagación en tiempo real

### El problema

Cuando el servidor procesa un evento de Dispositivo A, los demás dispositivos online no se enteran hasta su próximo pull. En `conflict-resolution.md` §6 se especifica:

```python
sse_broadcaster.emit(
    canal=f"empresa-{evento.empresa_id}",
    evento={"tipo": "SYNC_UPDATE", "tabla": ..., "registro_id": ..., "version": ...}
)
```

Esto no existe en `sync.py`.

### Solución requerida (mínima)

```python
# En GET /sync/pull, agregar filtro de prioridad como workaround hasta tener SSE:
# Los eventos de tipo CRITICO_BLOQUEO, PRECIO_URGENTE etc se retornan primero
# independientemente del watermark

# Solución real: Server-Sent Events con FastAPI
from sse_starlette.sse import EventSourceResponse

@sync_router.get("/stream")
async def sync_stream(device_id: str, current_user = Depends(get_current_user)):
    async def event_generator():
        async for update in redis_pubsub.subscribe(f"empresa:{current_user.company_id}"):
            yield {"data": json.dumps(update)}
    
    return EventSourceResponse(event_generator())
```

> Requiere Redis o PostgreSQL LISTEN/NOTIFY.

---

## GAP-10 🟢 BAJO — Sin WhatsApp stub

### El problema

`conflict-resolution.md` §2 especifica que cuando una factura es rechazada por AFIP, se debe notificar al cliente por WhatsApp mediante un stub:

```python
whatsapp_service.send(
    destinatario=cliente.telefono,
    mensaje=f"Su comprobante de contingencia {factura.numero_contingencia} ..."
)
```

No existe ningún `whatsapp_service` ni stub en el backend.

### Solución requerida

```python
# app/services/whatsapp.py

class WhatsAppService:
    """
    STUB COMPLETO — No envía mensajes reales.
    Decisión del dueño: stub hasta integración futura.
    Loguea el mensaje y retorna respuesta mock.
    """
    
    def send(self, destinatario: str, mensaje: str, context: dict = None) -> dict:
        import logging
        logger = logging.getLogger("whatsapp_stub")
        logger.info(f"[WHATSAPP STUB] → {destinatario}: {mensaje[:100]}...")
        
        return {
            "status": "stub",
            "message_id": f"stub-{uuid.uuid4().hex[:8]}",
            "destinatario": destinatario,
            "enviado": False,
            "nota": "WhatsApp no implementado. Stub activo."
        }

whatsapp_service = WhatsAppService()
```

---

---

# SECCIÓN 3 — TESTS DE INTEGRACIÓN

Los tests están organizados por caso de conflicto. Cada uno define el nombre del test, qué verifica y cuál es la condición de éxito.

---

## T01 — Stock negativo: sobreventa de dos dispositivos simultáneos

**Nombre:** `test_oversale_two_devices_concurrent`

**Qué verifica:**  
Dos dispositivos del mismo local envían eventos de egreso simultáneos para el mismo producto. El stock inicial es 1. Los dos enviando EGRESO de 1 unidad.

**Setup:**
```python
# Stock inicial: variante "var-test-1" en "local-1" = 1 unidad
# Insertar directamente en movimientos_stock con INGRESO cantidad=1

# Dispositivo A: envía EGRESO de 1 unidad → idempotency_key "dev-a-1000-aaaa"
# Dispositivo B: envía EGRESO de 1 unidad → idempotency_key "dev-b-1001-bbbb"
# Ambos con version en payload y resuling_stock = 0 (calculado en cliente)
```

**Condición de éxito:**
1. Ambos eventos son aceptados (HTTP 200 en ambos)
2. `SyncConflict` con `conflict_type=STOCK_NEGATIVE` creado para el segundo evento
3. `movimientos_stock` tiene 3 filas: 1 INGRESO + 2 EGRESO
4. Stock calculado desde `movimientos_stock` = -1
5. La resolución del conflicto es `AUTO_RESOLVED` (decisión del dueño)
6. El primer evento no tiene conflicto asociado

---

## T02 — Stock negativo: cálculo desde DB, no desde payload

**Nombre:** `test_stock_calculation_from_db_not_payload`

**Qué verifica:**  
El servidor calcula el stock resultante desde `movimientos_stock`, no desde `payload.resulting_stock`. Un dispositivo malicioso envía `resulting_stock = 5` cuando el stock real es 0.

**Setup:**
```python
# Stock real: 0 (no hay movimientos, o hay EGRESO que lo dejó en 0)
# Dispositivo envía evento con payload = {"tipo": "EGRESO", "cantidad": 1, "resulting_stock": 5}
```

**Condición de éxito:**
1. El servidor detecta conflicto aunque `payload.resulting_stock = 5`
2. El `SyncConflict.description` menciona el stock calculado desde DB, no del payload
3. El stock en `variantes_producto` queda en -1, no en 5

---

## T03 — Idempotencia: evento enviado dos veces no se procesa doble

**Nombre:** `test_event_idempotency`

**Qué verifica:**  
El mismo evento (mismo `event_id`) enviado dos veces en lotes separados solo genera un `SyncEvent`.

**Condición de éxito:**
1. Primer POST: `processed=1, duplicates=0`
2. Segundo POST (mismo event_id): `processed=0, duplicates=1`
3. `SELECT COUNT(*) FROM sync_events WHERE id = :event_id` = 1
4. `movimientos_stock` no tiene registros duplicados

---

## T04 — Stale update: versión antigua rechazada

**Nombre:** `test_stale_update_creates_conflict`

**Qué verifica:**  
Un dispositivo envía un UPDATE con `version=3` cuando el servidor ya tiene un UPDATE con `version=5` del mismo registro (enviado antes por otro dispositivo).

**Condición de éxito:**
1. El evento es aceptado (HTTP 200, no rechazado)
2. Se crea un `SyncConflict` con `conflict_type=STALE_UPDATE`
3. La resolución es `MANUAL_PENDING`
4. `GET /sync/conflicts?status=MANUAL_PENDING` devuelve el conflicto

---

## T05 — Phase 1: cliente bloqueado antes de procesar pendientes

**Nombre:** `test_phase1_blocked_client_prevents_sale`

**Qué verifica:**  
El endpoint `GET /sync/criticos` retorna el bloqueo de un cliente. El dispositivo debe recibir este dato antes de enviar sus pendientes.

**Precondición:** Requiere implementación de GAP-3.

**Condición de éxito:**
1. `GET /sync/criticos?device_id=...&version_catalogo=0` incluye el cliente bloqueado en `clientes_bloqueados`
2. La respuesta llega antes de que el dispositivo envíe `POST /sync/events`
3. El frontend puede interceptar la venta offline y mostrar la alerta correspondiente

---

## T06 — Dispositivo 7 días offline: reconciliación completa

**Nombre:** `test_7day_offline_device_reconciliation`

**Qué verifica:**  
Un dispositivo con `version_catalogo = 100` sincroniza cuando el servidor está en `version_catalogo = 250`. Los precios cambiaron, hay 3 productos discontinuados y 1 cliente bloqueado.

**Condición de éxito:**
1. `GET /sync/criticos` retorna los 3 discontinuados y el cliente bloqueado
2. `GET /sync/pull?since=<watermark_viejo>` retorna todos los eventos de precio desde `version_catalogo=100`
3. Los eventos de precio son procesados antes que los eventos de venta offline
4. Si el dispositivo envía una venta de un producto discontinuado, se crea conflicto `PRODUCTO_DISCONTINUADO`

---

## T07 — OT merge por campo

**Nombre:** `test_ot_field_level_merge`

**Qué verifica:**  
Mecánico y recepción editan la misma OT offline. Al sincronizar:
- Mecánico cambió `trabajo_realizado` y `tecnico_asignado_id`
- Recepción cambió `estado` (de DIAGNOSTICO a PRESUPUESTADO) y `trabajo_realizado`

**Precondición:** Requiere implementación de GAP-5.

**Condición de éxito:**
1. `estado` queda con el valor de recepción (SERVER_WINS para el campo `estado`)
2. `trabajo_realizado` contiene AMBAS descripciones (MERGE_APPEND)
3. `tecnico_asignado_id` queda con el valor del dispositivo con mayor `timestamp_local` (LWW)
4. Se crea un `SyncConflict` de tipo `CAMPO_DIVERGENTE` para `trabajo_realizado` (MERGE_APPEND)

---

## T08 — Factura contingencia → AFIP acepta al sincronizar

**Nombre:** `test_contingency_invoice_afip_accepted`

**Qué verifica:**  
Una factura de tipo `FC` (contingencia, punto_venta=999) llega al servidor. El stub de AFIP la acepta. El estado debe cambiar a `emitida` y se guarda el CAE (mock).

**Precondición:** Requiere implementación de GAP-5 (handler de facturas) y stub de AFIP.

**Condición de éxito:**
1. El evento con `aggregate_type="facturas"` y `event_type="INSERT"` es enrutado al handler correcto
2. El handler detecta `tipo_comprobante="FC"` y encola la validación AFIP
3. El job de validación corre y actualiza `estado="emitida"` con un `cae_mock`
4. No se genera `SyncConflict`

---

## T09 — Factura contingencia → AFIP rechaza al sincronizar

**Nombre:** `test_contingency_invoice_afip_rejected`

**Qué verifica:**  
AFIP rechaza la factura de contingencia. El sistema debe marcarla como `rechazada_afip`, crear notificación y (stub) enviar WhatsApp al cliente.

**Precondición:** Requiere implementación de GAP-5, GAP-6, GAP-10.

**Condición de éxito:**
1. `facturas.estado = 'rechazada_afip'`
2. `facturas.requiere_revision = true`
3. `facturas.motivo_revision` contiene el código de rechazo de AFIP
4. `notificaciones` tiene un registro con `tipo='AFIP_RECHAZADA'` y `severity='HIGH'`
5. El WhatsApp stub loguea el mensaje (no envía) y retorna `{"status": "stub"}`

---

## T10 — Cliente editado en 2 locales: merge datos maestros vs comerciales

**Nombre:** `test_client_merge_master_vs_commercial_data`

**Qué verifica:**  
Local A cambia el `email` y `telefono` (contacto) de un cliente offline.
Local B cambia `limite_credito` (dato comercial) del mismo cliente offline.
Al sincronizar, ambos cambios deben coexistir sin conflicto.

**Precondición:** Requiere implementación de GAP-5 (handler de clientes).

**Condición de éxito:**
1. El `email` y `telefono` quedan con los valores de Local A (LWW por timestamp)
2. El `limite_credito` queda con el valor del servidor/Local B (SERVER_WINS para datos comerciales)
3. No se crea `SyncConflict` de tipo `MANUAL` (no hay divergencia en datos maestros críticos)

---

## T11 — Conflicto manual: resolución por admin

**Nombre:** `test_manual_conflict_resolution_flow`

**Qué verifica:**  
Un conflicto `MANUAL_PENDING` (creado por test T04 o T07) es resuelto por un admin usando `POST /sync/conflicts/{id}/resolve`.

**Condición de éxito:**
1. Antes: `GET /sync/conflicts?status=MANUAL_PENDING` devuelve el conflicto
2. Admin llama `POST /sync/conflicts/{id}/resolve` con `{"resolution": "MANUAL_RESOLVED", "resolution_data": {...}}`
3. Después: el conflicto tiene `resolution=MANUAL_RESOLVED`, `resolved_at` no es null, `resolved_by_id = admin_id`
4. `GET /sync/conflicts?status=MANUAL_PENDING` ya no lo devuelve

---

## T12 — Race condition: dos requests simultáneos al mismo stock

**Nombre:** `test_concurrent_stock_requests_no_race`

**Qué verifica:**  
Dos requests HTTP simultáneos (usando `asyncio.gather` o threads) enviando EGRESO del mismo producto. Solo uno debe tener el stock positivo; el otro debe crear conflicto.

**Precondición:** Requiere implementación de GAP-1 (transacciones SERIALIZABLE).

**Condición de éxito:**
1. Ambos requests retornan HTTP 200 (ninguno falla)
2. Exactamente 1 `SyncConflict` de tipo `STOCK_NEGATIVE` en la DB
3. El stock calculado desde `movimientos_stock` es -1 (no -2 ni 0)
4. No hay duplicados en `movimientos_stock`

---

## T13 — Dispositivo no registrado es rechazado

**Nombre:** `test_unregistered_device_rejected`

**Qué verifica:**  
Un dispositivo que no está en `device_registry` intenta hacer push de eventos.

**Condición de éxito:**
1. `POST /sync/events` con `device_id` desconocido retorna HTTP 404
2. Ningún `SyncEvent` es creado

---

## T14 — Aislamiento multi-tenant: empresa A no puede ver conflictos de empresa B

**Nombre:** `test_multitenancy_conflict_isolation`

**Qué verifica:**  
Un usuario de Empresa A no puede ver los conflictos de Empresa B, aún si conoce el `conflict_id`.

**Condición de éxito:**
1. `GET /sync/conflicts` para usuario de Empresa A solo devuelve conflictos de `company_id = A`
2. `POST /sync/conflicts/{conflict_id_de_B}/resolve` para usuario de Empresa A retorna HTTP 404

---

## T15 — Checksum inválido rechaza evento

**Nombre:** `test_invalid_checksum_rejects_event`

**Qué verifica:**  
Un evento enviado con `checksum` incorrecto (simulando corrupción en tránsito) es rechazado y enviado a `cola_sync` con `tipo_error="CHECKSUM"`.

**Precondición:** Requiere implementación de GAP-4 (checksum en EventIn) y GAP-8 (cola_sync).

**Condición de éxito:**
1. El evento no es procesado (`SyncEvent` no se crea o `is_processed=false`)
2. Un registro en `cola_sync` tiene `tipo_error="CHECKSUM"`, `evento_id` y el `payload_original`
3. El response incluye el evento en la lista de errores (no en `processed` ni `duplicates`)

---

---

# APÉNDICE — Schema EventIn vs Requerido

Referencia rápida de todos los campos que `EventIn` necesita para implementar el algoritmo de `conflict-resolution.md`.

| Campo | Tipo actual (sync.py) | Tipo requerido | Prioridad para agregar |
|-------|-----------------------|----------------|------------------------|
| `event_id` | `str` ✅ | `str` | — |
| `idempotency_key` | ❌ (usa event_id) | `str` formato `{dev}-{ts_ms}-{rand8}` | Alta |
| `aggregate_type` / `tabla_afectada` | `str` ✅ | Renombrar a `tabla_afectada` | Media |
| `aggregate_id` / `registro_id` | `str` ✅ | Renombrar a `registro_id` | Media |
| `event_type` / `operacion` | `str` ✅ | Renombrar a `operacion`, valores: INSERT/UPDATE/DELETE | Media |
| `payload_antes` | ❌ | `dict \| None` (None para INSERT) | **Crítica** |
| `payload` / `payload_despues` | `dict` ✅ | Renombrar a `payload_despues` | Media |
| `campos_modificados` | ❌ | `list[str] \| None` | **Crítica** |
| `sequence_num` | `int` ✅ | `int` | — |
| `version_catalogo` | ❌ | `int` default=0 | Alta |
| `checksum` | ❌ | `str \| None` | Baja |
| `metadata` | `dict \| None` ✅ | `dict \| None` | — |

**Campos adicionales en `SyncEvent` (modelo SQLAlchemy) que faltan respecto a 002_sync.sql v2.0:**

| Campo (002_sync.sql) | En modelo actual | Impacto |
|---------------------|-----------------|---------|
| `payload_antes` | ❌ | BLOQUEANTE para merge |
| `campos_modificados` | ❌ | BLOQUEANTE para merge |
| `version_catalogo` | ❌ | Alto |
| `idempotency_key` | ❌ (usa `id` como idempotency key) | Medio |
| `checksum` | ❌ | Bajo |
| `lote_sync_id` | ❌ | Bajo |
| `conflicto_tipo` | ❌ (está en `SyncConflict`, no en `SyncEvent`) | Medio |
| `numero_secuencia` | ✅ como `sequence_num` | — (alias) |
| `sincronizado` | ✅ como `is_processed` | — (alias) |

---

*Documento generado el 2026-04-12 | Basado en sync.py (Copilot A) y conflict-resolution.md*
