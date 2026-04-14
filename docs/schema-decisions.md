# Decisiones de Diseño — Schema Fase 0

Documento para revisión del arquitecto. Cada decisión incluye el razonamiento y las alternativas descartadas.

---

## 1. UUIDs como TEXT en lugar de tipos nativos

**Decisión**: Todos los IDs son `TEXT` con UUID v4.

**Razón**:
- SQLite no tiene tipo UUID nativo. TEXT es la representación natural.
- PostgreSQL sí tiene `UUID`, pero usando TEXT en el schema base mantenemos compatibilidad 1:1 entre ambos motores.
- Los UUIDs se generan en el **dispositivo origen**, no en el servidor. Esto es fundamental para offline-first: un dispositivo sin conexión puede crear registros con IDs únicos globalmente, sin coordinación.

**Alternativas descartadas**:
- Auto-increment: imposible en sync distribuido (colisiones entre dispositivos).
- ULID/CUID: viables, pero UUID v4 es estándar, tiene soporte nativo en todas las plataformas y better-sqlite3 no da ventajas con formatos ordenables.

**Nota para el arquitecto**: Si se decide usar UUID v7 (ordenable por tiempo) en el futuro, el cambio es transparente — solo cambia la función de generación, no el schema.

---

## 2. Timestamps como TEXT (ISO 8601), no INTEGER

**Decisión**: Todos los timestamps son `TEXT` con formato ISO 8601 (`2026-04-12T22:30:00.000Z`).

**Razón**:
- SQLite no tiene tipo datetime nativo. Las opciones son TEXT, REAL (Julian day) o INTEGER (Unix epoch).
- TEXT con ISO 8601 es legible en queries manuales, en logs y en debugging.
- `strftime()` de SQLite trabaja naturalmente con este formato.
- JSON payloads de sync usan ISO 8601 — no hay conversión.

**Alternativas descartadas**:
- Unix epoch (INTEGER): más compacto y eficiente para comparaciones, pero ilegible. Los 4 bytes ahorrados no justifican la pérdida de debuggability en una app de este volumen.
- REAL (Julian day): API oscura, nadie la entiende sin documentación.

**Nota para el arquitecto**: En PostgreSQL usamos `TIMESTAMPTZ` — la conversión TEXT↔TIMESTAMPTZ es automática si el formato es ISO 8601.

---

## 3. JSON como TEXT, no tipos estructurados separados

**Decisión**: `config_json`, `atributos_json`, `payload_antes`, `payload_despues` son `TEXT` con JSON.

**Razón**:
- SQLite tiene funciones JSON (`json_extract`, `json_each`) desde la versión 3.38. better-sqlite3 las incluye.
- Campos como `atributos_json` en variantes necesitan ser flexibles: una empresa puede tener talle+color, otra solo talle, otra puede agregar "largo de manga". Normalizar esto en tablas es overengineering prematuro.
- Los payloads de sync son snapshots completos del registro — un JSON blob es exactamente lo que necesitamos.

**Trade-off aceptado**: No se pueden hacer JOINs directos sobre contenido JSON. Si en el futuro se necesita consultar por atributo específico (ej: "todos los productos talle L"), se puede crear un índice generado o una vista materializada.

**Nota para el arquitecto**: En PostgreSQL, estos campos deberían ser `JSONB` para permitir indexación con GIN.

---

## 4. Relación N:N usuarios ↔ empresas (usuario_empresa)

**Decisión**: Un usuario puede pertenecer a múltiples empresas con roles distintos en cada una.

**Razón**:
- Mundo Outdoor puede tener empresas hermanas o marcas que comparten personal.
- Un SUPERADMIN necesita acceder a todas las empresas sin tener un registro por cada una.
- El JWT incluye `empresa_id` — el usuario elige con qué empresa trabaja al loguearse (o se le asigna una por defecto).

**Alternativas descartadas**:
- `usuario.empresa_id` directo (1:N): más simple, pero cierra la puerta a multi-empresa por usuario.
- Tabla de roles separada (RBAC granular): overengineering para 8 roles fijos.

---

## 5. Dispositivos como entidad de primer nivel

**Decisión**: Cada dispositivo (PC, tablet, celular) se registra en la tabla `dispositivos` con UUID propio.

**Razón**:
- El sync necesita saber **de dónde viene** cada cambio. Sin dispositivo_id, no se puede resolver conflictos ni auditar.
- `ultimo_sync` por dispositivo permite sync incremental eficiente: "dame todo lo que cambió desde mi último sync".
- Un dispositivo robado o perdido se puede desactivar (`activo = false`) sin afectar al usuario.

**Nota para el arquitecto**: El dispositivo_id se genera y persiste localmente en el primer uso. Se incluye en el JWT para que el servidor identifique el origen de cada request.

---

## 6. Event sourcing con eventos_sync

**Decisión**: Cada mutación (INSERT/UPDATE/DELETE) en tablas de negocio genera un registro en `eventos_sync` con payload antes/después.

**Razón**:
- Es la base del sync offline-first. El dispositivo trabaja localmente y genera eventos. Cuando hay red, los eventos se envían al servidor.
- El payload completo (antes/después) permite:
  - Reconstruir el estado de cualquier registro en cualquier punto del tiempo.
  - Detectar conflictos comparando versiones.
  - Auditoría completa sin tabla de audit separada.

**Trade-off aceptado**:
- La tabla `eventos_sync` va a crecer rápido. Se necesita una política de purgado (ej: archivar eventos de más de 90 días una vez sincronizados).
- Almacenar el payload completo duplica datos. Se acepta porque el volumen esperado (indumentaria, no e-commerce masivo) es manejable.

**Nota para el arquitecto**: La estrategia de resolución de conflictos (last-write-wins, merge manual, campo por campo) queda pendiente. El schema soporta cualquiera de estas vía `resolucion_conflicto` y `version`.

---

## 7. Campo `version` en eventos_sync para conflictos

**Decisión**: Cada evento tiene un campo `version` (INTEGER) que representa la versión del registro al momento de la mutación.

**Razón**:
- Optimistic concurrency control: si dos dispositivos editan el mismo registro, el servidor compara versiones.
- Versión 1 = creación. Cada UPDATE incrementa la versión.
- Si el servidor recibe versión 5 pero tiene versión 6, sabe que hay conflicto.

**Nota para el arquitecto**: Esto es compatible con CRDTs si se decide ir en esa dirección. El `version` actúa como vector clock simplificado (un solo nodo).

---

## 8. Cola de sync separada de eventos

**Decisión**: `cola_sync` es una tabla separada que referencia a `eventos_sync`.

**Razón**:
- Separar la cola de reintentos de los eventos mantiene limpia la tabla principal.
- La cola tiene su propio ciclo de vida: backoff exponencial, max reintentos, estados propios.
- Un evento puede existir sin estar en cola (ya sincronizado). Un evento en cola tiene metadata de reintentos que no pertenece a la definición del evento.

**Alternativas descartadas**:
- Campos de reintento directamente en `eventos_sync`: contamina la tabla con lógica operacional.
- Cola en memoria (Redis/in-process): se pierde si el dispositivo se apaga. Inaceptable para offline-first.

---

## 9. stock_actual desnormalizado en variantes_producto

**Decisión**: `variantes_producto.stock_actual` es un campo calculado/cache que se actualiza con cada movimiento.

**Razón**:
- Consultar stock en tiempo real requeriría `SUM(cantidad)` sobre `movimientos_stock` — costoso con muchos movimientos.
- El campo desnormalizado permite queries instantáneos: "mostrame todos los productos con stock < 5".
- La fuente de verdad sigue siendo `movimientos_stock`. Se puede recalcular en cualquier momento.

**Trade-off aceptado**:
- Riesgo de inconsistencia si un movimiento se registra pero el update del cache falla. Mitigación: recalcular periódicamente con un job, y registrar `stock_resultante` en cada movimiento para detección de drift.

---

## 10. stock_resultante en movimientos_stock

**Decisión**: Cada movimiento registra `stock_resultante` — el stock DESPUÉS del movimiento.

**Razón**:
- Permite detectar inconsistencias entre el cache (`stock_actual`) y la realidad.
- Permite reconstruir el historial de stock sin recalcular desde cero.
- En caso de conflicto de sync, el servidor puede comparar stock_resultante esperado vs real.

---

## 11. Tipos de movimiento con dirección implícita

**Decisión**: `tipo` indica la dirección (INGRESO=suma, EGRESO=resta, etc.) y `cantidad` es siempre positivo.

**Razón**:
- Más claro que cantidades negativas. "EGRESO de 5" es inequívoco.
- `TRANSFERENCIA_IN` y `TRANSFERENCIA_OUT` son movimientos separados — uno en el local origen, otro en el destino. Esto permite que la transferencia funcione offline: cada local registra su parte independientemente.

---

## 12. Índices parciales (WHERE)

**Decisión**: Varios índices usan `WHERE` para filtrar solo registros relevantes.

**Razón**:
- `idx_eventos_sync_pendientes WHERE sincronizado = false`: el 99% de los eventos están sincronizados. Indexar solo los pendientes ahorra espacio y acelera la query más frecuente del sync.
- `idx_eventos_sync_conflictos WHERE conflicto = true`: misma lógica — los conflictos son excepcionales.
- SQLite soporta índices parciales desde la versión 3.8 (2013). PostgreSQL también.

---

## 13. Sin tabla de locales (todavía)

**Decisión**: `movimientos_stock.local_id` es un TEXT sin FK, no una tabla `locales`.

**Razón**:
- Los locales ya existen en el ERP actual (tabla `locals`). No quiero crear una tabla duplicada en Fase 0.
- Cuando se implemente el módulo de locales en el nuevo stack, se agregará la FK.
- El campo está preparado para recibir el UUID del local.

---

## 14. Sin soft delete en eventos_sync y movimientos_stock

**Decisión**: Estas tablas NO tienen campo `activo` ni soft delete.

**Razón**:
- Son tablas de auditoría/log. Un evento de sync o un movimiento de stock NUNCA se elimina — es un registro histórico inmutable.
- Si un movimiento fue un error, se genera un movimiento inverso (AJUSTE), no se borra el original.

---

## Respuestas del arquitecto (2026-04-12)

Respondidas con base en `docs/sync-architecture.md`.

---

### Pregunta 1 — Estrategia de resolución de conflictos

**Respuesta**: Estrategia híbrida, por tipo de dato. No existe una sola estrategia.

| Tipo de dato | Estrategia | Razón |
|---|---|---|
| **Stock** | G-Counter CRDT (delta-based) | Nunca sincronizar valor absoluto. Sincronizar operaciones (+3, -1, +10). El servidor aplica todos los deltas ordenados causalmente. Permite stock negativo como señal de sobreventa (ver Pregunta 5). |
| **Facturas** | Append-only — sin conflicto posible por diseño | Una factura emitida nunca se modifica. Los errores se corrigen con notas de crédito. La numeración fiscal es en dos fases: numero_provisorio offline → numero_fiscal asignado por servidor al sincronizar. |
| **Órdenes de trabajo** | Merge por campo con reglas diferenciadas | Cada campo se trata como unidad independiente. Campos simples (diagnóstico, observaciones): LWW por timestamp. Campos críticos (estado, monto_total, items): conflicto manual con UI de resolución para ADMIN. Campos de configuración (precio_hora, descuento_máximo): server-wins. |
| **Configuración y precios** | Server-wins absoluto | Los dispositivos nunca envían cambios de precio. Solo consumen. Propagación vía SSE (online inmediato) o pull incremental (offline, al reconectar). |
| **Clientes** | Merge por campo + detección de duplicados | Campos de contacto (teléfono, email): LWW. Campos legales (razón social, CUIT): conflicto manual. Campos comerciales (bloqueado, deuda): server-wins. Al crear cliente offline, el servidor busca duplicados por CUIT/similitud de nombre. |

**Implementación**: El campo `conflicto_tipo` en `eventos_sync` distingue entre: `SOBREVENTA`, `CAMPO_DIVERGENTE`, `DUPLICADO`, `VERSION_OBSOLETA`, `RECHAZO_FISCAL`. Cada tipo activa un handler diferente. Ver también decisión 15.

---

### Pregunta 2 — Política de retención de eventos

**Respuesta**: Retención diferenciada en dos fases.

| Estado del evento | Retención | Acción |
|---|---|---|
| `sincronizado = false` | Indefinida | Nunca purgar hasta que se sincronice |
| `sincronizado = true, conflicto = false` | 90 días | Archivar a tabla `eventos_sync_archivo` (misma estructura, sin índices) |
| `sincronizado = true, conflicto = true, conflicto_resuelto = false` | Indefinida | No purgar hasta resolución manual |
| `sincronizado = true, conflicto = true, conflicto_resuelto = true` | 1 año | Parte del registro de auditoría fiscal |

**Implementación**: Job nocturno en el servidor (cron). Los eventos archivados se comprimen y mueven a almacenamiento frío. El cliente SQLite purga sus propios eventos sincronizados después de 30 días (espacio limitado en disco de dispositivo).

---

### Pregunta 3 — Protocolo de sync

**Respuesta**: Protocolo en 3 fases, híbrido SSE + HTTP batch.

```
Fase 1 — CRÍTICOS (servidor → cliente, ANTES de procesar nada):
  Servidor envía bloqueos de clientes y cambios de precios críticos
  que el dispositivo no tiene. El dispositivo los aplica localmente
  ANTES de que el servidor procese las operaciones pendientes.
  → Previene ventas a crédito a clientes bloqueados ya conocidos.

Fase 2 — PENDIENTES (cliente → servidor, POST /sync/batch):
  El cliente envía todos sus eventos pendientes en un lote.
  El servidor los procesa secuencialmente, detecta conflictos,
  aplica resoluciones, y retorna el resultado por evento.
  → HTTP batch (no WebSocket) para simplicidad y tolerancia a fallos.

Fase 3 — CATÁLOGO (servidor → cliente, incremental):
  El servidor envía solo los cambios de catálogo desde la última
  versión conocida del cliente (version_catalogo).
  Si el delta es > 500 registros o el desfase es > 7 días: full sync.
```

**Para eventos en tiempo real (online)**: SSE en `/api/v1/menu_config/events` — ya implementado. Notifica cambios de precios, bloqueos y stock crítico a los dispositivos conectados.

**Trigger del sync**: `online` event del browser → 2 segundos de delay → `flushPendingOps()`. También cada 5 minutos si hay pendientes. El delay evita re-sincronizaciones en conexiones inestables.

---

### Pregunta 4 — Compresión de payloads

**Respuesta**: No se implementa diff. Se agrega `campos_modificados` como optimización pragmática.

**Decisión final**: El evento sigue guardando snapshot completo (`payload_antes` + `payload_despues`), pero se agrega el campo `campos_modificados TEXT` (array JSON con los nombres de campos que cambiaron, ej: `["telefono", "estado"]`).

**Por qué no diff**:
- Generar y aplicar diffs JSON correctamente requiere una librería (json-patch RFC 6902) y complejidad operacional.
- Para el volumen esperado (ERP retail, no Big Data), los snapshots completos son manejables.
- Los snapshots permiten reconstruir estado sin "replay" de toda la cadena.

**Por qué `campos_modificados`**:
- El merge por campo (Pregunta 1) necesita saber qué campos cambiaron sin deserializar el JSON completo.
- Permite queries eficientes: `WHERE campos_modificados @> '["estado"]'` (PostgreSQL JSONB).
- No hay que parsear `payload_antes` y `payload_despues` para detectar diferencias.

**Nota**: El schema en `002_sync.sql` ya tiene `version` para optimistic concurrency. Se actualizará `eventos_sync` en un schema futuro (005) para agregar `campos_modificados`, `idempotency_key`, `checksum`, y `lote_sync_id` tal como propone `sync-architecture.md` § 4.1.

---

### Pregunta 5 — Multi-local stock

**Respuesta**: Stock por local (cada local tiene su propio pool), con pool centralizado en depósito.

**Decisión**: Cada local opera sobre su propio stock. No hay un pool global compartido. El depósito central es un "local más" (`local_id = deposito-central`).

**Por qué por local**:
- Elimina los conflictos de sobreventa en el caso común (dos locales raramente tienen el mismo físico).
- Si Local A y Local B ambos venden del mismo pool offline → sobreventa inevitable. Si cada uno tiene su propio stock → solo hay sobreventa si venden más de lo que tienen en su local.
- Las transferencias entre locales (`TRANSFERENCIA_OUT` + `TRANSFERENCIA_IN`) son el mecanismo de reabastecimiento.

**Cuándo puede quedar stock negativo**:
- Sobreventa dentro del mismo local (dos dispositivos del mismo local sin sync).
- Ajuste manual incorrecto.
- En estos casos: se acepta el negativo, se genera alerta `STOCK_NEGATIVO` con severity HIGH, y se resuelve con reposición o ajuste. No se anula la venta.

**Schema**: `movimientos_stock.local_id` ya existe. El campo `variantes_producto.stock_actual` es el stock global (suma de todos los locales). Para stock por local se usa `SELECT SUM(cantidad) FROM movimientos_stock WHERE variante_id = ? AND local_id = ? GROUP BY tipo`.

**Pendiente de implementación**: Tabla `stock_por_local` (vista materializada o tabla desnormalizada) para queries rápidos de stock por local. Se define en schema 005.

---

### Pregunta 6 — Migración de datos del ERP actual

**Respuesta**: Sí, se migran. Script de migración one-shot, no hay sync continuo con el ERP viejo.

**Lo que existe en el ERP actual** (PostgreSQL, esquema SQLAlchemy):
- `companies`, `users`, `locals`, `providers` → mapean a `empresas`, `usuarios`, `dispositivos`
- `products` + `product_variants` → mapean a `productos` + `variantes_producto`
- `ingresos` + `ingreso_items` → historial de compras (no se migra a negocio, solo stock resultante)
- `sales` + `sale_items` → historial de ventas (se migra como snapshot de stock)
- `stock_movements` → se migra como movimientos históricos

**Estrategia de migración**:
1. **IDs**: El ERP actual usa UUIDs (SQLAlchemy genera UUID4). Son compatibles directamente.
2. **Timestamps**: El ERP usa `TIMESTAMPTZ` PostgreSQL → se convierte a TEXT ISO 8601 para SQLite.
3. **Stock**: Se toma el último `stock_actual` por variante como `movimiento_stock` de tipo `AJUSTE` con motivo `MIGRACION_INICIAL`. No se migran movimientos históricos individuales (demasiado ruido).
4. **Productos sin variantes**: Los `Product` sin `ProductVariant` hijos se migran con `variante_tipo = NULL`.
5. **Validación**: Script de reconciliación post-migración compara totales de stock antes/después.

**No se migra**:
- Historial de `eventos_sync` (no existe en el ERP actual, tabla nueva).
- Pedidos (Pedido/PedidoItem) — datos operativos que expiran, no vale la pena migrar.
- Configuración de Alembic y migraciones del backend Python (nuevo stack es Node.js).
