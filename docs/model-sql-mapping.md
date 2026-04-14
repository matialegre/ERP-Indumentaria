# Model ↔ SQL Mapping — ERP Mundo Outdoor

> Análisis de correspondencia entre las **19 tablas** del schema SQL (stack Node.js/SQLite)
> y los **modelos Python/SQLAlchemy** del backend FastAPI existente.
>
> Creado por: Copilot B (implementador)
> Fecha: 2026-04-12
> Versión schemas: 001–004 (ver `schema/`)
> Versión modelos: `erp/backend/app/models/`

---

## ⚠️ Advertencia arquitectónica global

Los schemas SQL y los modelos Python **no son el mismo sistema**. Hay tres diferencias
estructurales que afectan TODAS las tablas:

| Aspecto | Schema SQL (Node/SQLite) | Modelos Python (FastAPI/PG) |
|---|---|---|
| **PKs** | UUID v4 (TEXT generado en dispositivo) | Integer autoincrement |
| **Nombres de tabla** | Español (clientes, empresas) | Inglés (customers, companies) |
| **Offline-first** | `timestamp_local`, `dispositivo_id`, `version` en cada tabla | Solo WorkOrder tiene `device_id`/`offline_id` |

Esto significa que los dos sistemas **no pueden compartir datos directamente** sin una capa
de mapeo. El arquitecto debe decidir si unificarlos o mantenerlos separados.

---

## Tabla de mapeo completa

| # | Tabla SQL | Tabla Python (SQLAlchemy) | Archivo | Estado |
|---|-----------|--------------------------|---------|--------|
| 1 | `empresas` | `Company` → `companies` | company.py | ⚠️ divergencias |
| 2 | `usuarios` | `User` → `users` | user.py | ⚠️ divergencias |
| 3 | `usuario_empresa` | *(ninguno — User.company_id es 1:N)* | — | ❌ sin modelo |
| 4 | `dispositivos` | `DeviceRegistry` → `device_registry` | sync.py | ⚠️ divergencias |
| 5 | `eventos_sync` | `SyncEvent` → `sync_events` | sync.py | ⚠️ estructura diferente |
| 6 | `cola_sync` | *(ninguno — AfipQueue es solo para AFIP)* | — | ❌ sin modelo genérico |
| 7 | `productos` | `Product` → `products` | product.py | ⚠️ divergencias |
| 8 | `variantes_producto` | `ProductVariant` → `product_variants` | product.py | ⚠️ divergencias |
| 9 | `movimientos_stock` | `StockMovement` → `stock_movements` | stock_movement.py | ⚠️ divergencias |
| 10 | `clientes` | `Customer` → `customers` | customer.py | ⚠️ divergencias |
| 11 | `vehiculos` | `Vehicle` → `vehicles` | customer.py | ⚠️ divergencias |
| 12 | `ordenes_trabajo` | `WorkOrder` → `work_orders` | work_order.py | ⚠️ divergencias importantes |
| 13 | `ot_items` | `WorkOrderItem` → `work_order_items` | work_order.py | ⚠️ divergencias |
| 14 | `facturas` | `Sale` → `sales` | sale.py | ❌ gaps críticos (AFIP offline) |
| 15 | `factura_items` | `SaleItem` → `sale_items` | sale.py | ⚠️ divergencias |
| 16 | `cliente_empresa` | `CustomerCompany` → `customer_companies` | customer.py | ⚠️ divergencias |
| 17 | `cuenta_corriente` | `AccountMovement` → `account_movements` | customer.py | ⚠️ divergencias |
| 18 | `mensajes_whatsapp` | `WhatsAppMessage` → `whatsapp_messages` | sync.py | ⚠️ divergencias |
| 19 | `archivos` | `StorageFile` → `storage_files` | sync.py | ⚠️ divergencias |

**Resumen:** 0 ✅ completos · 15 ⚠️ con divergencias · 2 ❌ sin modelo · 2 ❌ con gaps críticos

---

## Detalle por tabla

### 1. `empresas` ↔ `Company`
**Estado: ⚠️ — Python es superconjunto, diferencias en campos clave**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `id` TEXT UUID | `id` INTEGER | ❌ PK diferente (UUID vs int) |
| `nombre` | `name` | ✅ equivalente |
| `rubro` | `industry_type` (Enum) | ⚠️ SQL es texto libre, Python es Enum estructurado |
| `config_json` | *(no existe)* | ❌ Python usa columnas específicas en su lugar |
| *(no existe)* | `cuit`, `address`, `phone`, `email`, `logo_url` | Python tiene más datos de empresa |
| *(no existe)* | Branding: `app_name`, `primary_color`, `favicon_url`, etc. | Python tiene white-label (SQL no) |

---

### 2. `usuarios` ↔ `User`
**Estado: ⚠️ — Python es superconjunto**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `id` TEXT UUID | `id` INTEGER | ❌ PK diferente |
| `nombre` | `full_name` | ✅ equivalente |
| `email` | `email` | ✅ |
| `password_hash` | `hashed_password` | ✅ equivalente |
| *(no existe)* | `username`, `role`, `is_active`, `company_id`, `local_id` | Python tiene más campos |
| `empresa_id` (implícito vía usuario_empresa) | `company_id` FK directa | ⚠️ SQL es N:N, Python es 1:N |

---

### 3. `usuario_empresa` ↔ *(sin modelo)*
**Estado: ❌ — No existe en Python**

SQL define una relación **N:N** entre usuarios y empresas con campo `rol` por empresa.
Python `User` tiene un único `company_id` (1:N). Un usuario no puede pertenecer a
múltiples empresas en el modelo Python.

**Impacto:** Si el sistema necesita usuarios con acceso a múltiples empresas, el modelo
Python requiere una tabla join. Por ahora solo MEGAADMIN/SUPERADMIN cubren ese caso
implícitamente (company_id = NULL).

---

### 4. `dispositivos` ↔ `DeviceRegistry`
**Estado: ⚠️ — Python es superconjunto**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `id` TEXT UUID | `id` STRING(100) | ⚠️ Python usa string (compatible) |
| `empresa_id` | `company_id` | ✅ equivalente |
| `nombre` | `name` | ✅ |
| `ultimo_sync` | `last_sync_at` | ✅ equivalente |
| `activo` | `is_active` | ✅ |
| *(no existe)* | `device_type` (PC/TABLET/PHONE/SERVER) | Python tipifica el dispositivo |
| *(no existe)* | `local_id`, `user_id`, `last_sync_sequence`, `app_version`, `os_info` | Python tiene más metadata |

---

### 5. `eventos_sync` ↔ `SyncEvent`
**Estado: ⚠️ — Estructuras conceptualmente diferentes**

| Campo SQL (26 campos) | Campo Python | Diferencia |
|-----------------------|--------------|------------|
| `tabla_afectada` | `aggregate_type` | ⚠️ SQL = tabla SQL, Python = tipo dominio |
| `operacion` (INSERT/UPDATE/DELETE/MERGE) | `event_type` | ⚠️ SQL = CRUD, Python = eventos de dominio |
| `payload_antes` JSON | *(no existe separado)* | ❌ Python usa `payload` único |
| `payload_despues` JSON | `payload` JSONB | ❌ No hay separación antes/después |
| `timestamp_local` | *(no existe)* | ❌ Falta campo offline-first |
| `timestamp_servidor` | *(no existe)* | ❌ |
| `sincronizado` BOOLEAN | `is_processed` BOOLEAN | ⚠️ semánticamente similar |
| `conflicto` BOOLEAN | *(no existe directo)* | ❌ Python usa tabla `SyncConflict` separada |
| `conflicto_tipo` | *(en SyncConflict)* | ⚠️ separado en Python |
| `idempotency_key` | *(no existe)* | ❌ crítico para offline: evita doble procesamiento |
| `campos_modificados` JSON | *(no existe)* | ❌ útil para merge por campo |
| `version` | *(no existe)* | ❌ sin optimistic concurrency |
| `numero_secuencia` | `sequence_num` | ✅ equivalente |
| `company_id` | `company_id` | ✅ |
| `dispositivo_id` | `device_id` | ✅ |
| `usuario_id` | `user_id` | ✅ |

**Nota:** Python además tiene `SyncConflict` (tabla separada para conflictos) que el SQL
integra en `eventos_sync`. Ambos enfoques son válidos; son incompatibles entre sí.

---

### 6. `cola_sync` ↔ *(sin modelo genérico)*
**Estado: ❌ — Solo existe AfipQueue para AFIP**

`cola_sync` es la cola de reintentos de sincronización para TODOS los módulos.
Python tiene `AfipQueue` (sync.py) para reintentos de AFIP específicamente, pero no hay
cola genérica de sync.

**Campos faltantes:** `evento_id`, `intentos`, `ultimo_intento`, `error_ultimo`, `tipo_error`
(RED/SERVIDOR_5XX/CONFLICTO/VALIDACION/CHECKSUM).

---

### 7. `productos` ↔ `Product`
**Estado: ⚠️ — Python tiene más campos, SQL tiene variante_tipo**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `id` TEXT UUID | `id` INTEGER | ❌ PK diferente |
| `empresa_id` | `company_id` | ✅ |
| `nombre` | `name` | ✅ |
| `sku` | `code` | ⚠️ diferentes semánticas (SQL=sku base, Python=code) |
| `activo` | `is_active` | ✅ |
| `variante_tipo` | *(no existe)* | ❌ Python no tipifica el tipo de variante (talle/color/talle+color) |
| *(no existe)* | `description`, `brand`, `category`, `base_cost` | Python tiene más campos |

---

### 8. `variantes_producto` ↔ `ProductVariant`
**Estado: ⚠️ — Estructura de atributos diferente**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `atributos_json` JSON flexible | `size` + `color` columnas fijas | ❌ SQL es flexible, Python es rígido |
| `stock_actual` | `stock` | ✅ equivalente |
| *(no existe)* | `sku`, `barcode`, `is_active` | Python tiene más campos útiles |

**Impacto:** El schema SQL soporta cualquier combinación de atributos (talle+color,
número+ancho, etc.). Python solo soporta talle+color. Para rubro mecánico (productos por
número de parte) el modelo Python necesitaría `size` = número de parte.

---

### 9. `movimientos_stock` ↔ `StockMovement`
**Estado: ⚠️ — Faltan campos offline-first**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `id` TEXT UUID | `id` INTEGER | ❌ PK diferente |
| `variante_id` | `variant_id` | ✅ |
| `tipo` | `type` | ✅ (valores compatibles: INGRESO/EGRESO/AJUSTE/TRANSFERENCIA) |
| `cantidad` | `quantity` | ✅ |
| `motivo` | `notes` / `reference` | ⚠️ Python tiene dos campos separados |
| `usuario_id` | `created_by_id` | ✅ equivalente |
| `dispositivo_id` | *(no existe)* | ❌ falta campo offline |
| `timestamp_local` | *(no existe)* | ❌ falta campo offline |
| *(no existe)* | `company_id` | Python desnormaliza empresa |

---

### 10. `clientes` ↔ `Customer`
**Estado: ⚠️ — Divergencia en empresa_id y datos_json**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `id` TEXT UUID | `id` INTEGER | ❌ PK diferente |
| `empresa_id` | *(no existe directo)* | ❌ Python Customer es master data global, sin empresa propietaria directa |
| `nombre` | `display_name` | ✅ equivalente |
| `razon_social` | `business_name` | ✅ |
| `cuit_dni` | `cuit_dni` | ✅ |
| `tipo_contribuyente` | `tax_condition` | ⚠️ Python incluye MONOTRIBUTISTA, SQL tiene MONOTRIBUTO |
| `condicion_iva` | *(no existe como campo)* | ⚠️ Python usa Enum `tax_condition` que lo cubre |
| `activo` | `is_active` | ✅ |
| `datos_json` | `phone`, `phone2`, `email`, `address`, `city`, `province`, `postal_code` | ⚠️ SQL usa JSON flexible, Python normaliza campos |
| `version` | *(no existe)* | ❌ sin optimistic concurrency |
| *(no existe)* | `customer_type` (PERSONA_FISICA/JURIDICA/CF) | Python distingue tipo de persona |
| `bloqueado`, `deuda_acumulada`, `categoria` | *(movidos a cliente_empresa en v2)* | ✅ alineados post-v2 |

---

### 11. `vehiculos` ↔ `Vehicle`
**Estado: ⚠️ — Python tiene más campos, falta empresa_id**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `empresa_id` desnormalizado | *(no existe)* | ❌ Python no desnormaliza empresa en Vehicle |
| `patente` | `plate` | ✅ |
| `vin` | `vin` | ✅ |
| `marca` | `brand` | ✅ |
| `modelo` | `model` | ✅ |
| `anio` | `year` | ✅ |
| `color` | `color` | ✅ |
| `km_actual` | `last_km` | ⚠️ semántica similar (Python además tiene `next_service_km`) |
| `activo` | `is_active` | ✅ |
| *(no existe)* | `engine_number`, `fuel_type` | Python tiene más datos técnicos |
| *(no existe)* | `last_service_date`, `next_service_km`, `next_service_date` | Python tiene mantenimiento |
| *(no existe)* | `vtv_expiry` | Python tiene control VTV |
| *(no existe)* | `insurance_company`, `insurance_policy`, `insurance_expiry` | Python tiene seguro |
| `version` + `timestamp_local` | *(no existe)* | ❌ sin offline-first |

---

### 12. `ordenes_trabajo` ↔ `WorkOrder`
**Estado: ⚠️ — Divergencias importantes en FK y estados**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `vehiculo_id` FK | *(no existe)* | ❌ Python desnormaliza todos los datos del vehículo en WO (plate, brand, model, etc.) |
| `cliente_id` FK | *(no existe directo)* | ❌ Python desnormaliza datos del cliente (customer_name, customer_phone, etc.) |
| `estado` (8 valores) | `status` (10 valores) | ❌ **Sets diferentes** — ver tabla abajo |
| `aprobado_por` FK usuario | `approved_at` timestamp | ⚠️ SQL registra quién aprobó, Python solo cuándo |
| `ts_recibida`...`ts_anulada` (8 timestamps) | `received_at`...`invoiced_at` (8 timestamps) | ⚠️ diferentes nombres y valores de estados |
| `requiere_revision`, `motivo_revision` | *(no existe)* | ❌ sin marcadores de revisión offline |
| `timestamp_local`, `version`, `dispositivo_id` | `offline_id`, `device_id`, `synced_at` | ⚠️ semánticamente similar pero diferente |
| *(no existe)* | `local_id` FK | Python registra el local/sucursal |
| *(no existe)* | `assigned_mechanic_id` | Python asigna mecánico |
| *(no existe)* | `payment_method`, `discount_pct` | Python mezcla financiero en WO |
| *(no existe)* | `WorkOrderHistory`, `WorkOrderChecklist`, `MechanicRate` | Python tiene más sub-entidades |

**Tabla de estados — incompatibles:**

| SQL (`ordenes_trabajo`) | Python (`WorkOrder`) |
|-------------------------|----------------------|
| BORRADOR | *(no existe)* |
| RECIBIDA | RECEPCION |
| DIAGNOSTICO | DIAGNOSTICO |
| APROBADA | APROBACION_CLIENTE |
| EN_PROGRESO | EN_EJECUCION |
| FINALIZADA | CONTROL_CALIDAD → ENTREGA |
| ENTREGADA | ENTREGA |
| ANULADA | CANCELADO |
| *(no existe)* | PRESUPUESTO |
| *(no existe)* | FACTURADO / CERRADO |

---

### 13. `ot_items` ↔ `WorkOrderItem`
**Estado: ⚠️ — Python tiene más campos, SQL tiene subtotal precalculado**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `empresa_id` desnormalizado | *(no existe)* | ❌ |
| `tipo` (repuesto/mano_obra) | `type` (REPUESTO/MANO_DE_OBRA/SERVICIO_EXTERNO) | ⚠️ Python agrega tipo SERVICIO_EXTERNO |
| `descripcion` | `description` | ✅ |
| `cantidad` | `quantity` | ✅ |
| `precio_unitario` | `unit_price` | ✅ |
| `descuento_pct` | *(no existe)* | ❌ falta descuento por ítem |
| `subtotal` precalculado | *(no existe)* | ❌ Python no precalcula |
| *(no existe)* | `status` (PRESUPUESTADO/APROBADO/USADO/DEVUELTO) | Python tiene estado por ítem |
| *(no existe)* | `hours`, `hourly_rate`, `mechanic_id` | Python desglosa mano de obra |
| *(no existe)* | `unit_cost`, `stock_decremented` | Python trackea costo y descuento de stock |

---

### 14. `facturas` ↔ `Sale`
**Estado: ❌ — Gaps críticos para AFIP offline**

`Sale` es un modelo mínimo. Le faltan casi todos los campos necesarios para el workflow
AFIP completo y offline-first. `AfipQueue` (sync.py) cubre parte del workflow pero de
forma separada.

| Campo SQL | Campo Python (Sale) | Diferencia |
|-----------|---------------------|------------|
| `tipo_comprobante` (FA/FB/FC/NCA/NCB/NCC/TICKET) | `type` (FACTURA_A/FACTURA_B/TICKET/NOTA_CREDITO) | ⚠️ Python no tiene FC (Monotributo) ni NC A/B/C separados |
| `punto_venta` INTEGER | *(no existe)* | ❌ necesario para AFIP |
| `numero_provisorio` | *(no existe)* | ❌ crítico para contingencia offline |
| `numero_fiscal` | `number` STRING | ⚠️ Python tiene un único número |
| `cae` | *(en AfipQueue)* | ❌ no directo en Sale |
| `cae_vencimiento` | *(en AfipQueue)* | ❌ |
| `cai` | *(no existe)* | ❌ para contingencia física |
| `cai_vencimiento` | *(no existe)* | ❌ |
| `estado` (6 valores incl. contingencia/pendiente_afip/rechazada_afip) | `status` (4 valores: BORRADOR/EMITIDA/PAGADA/ANULADA) | ❌ **faltan estados AFIP** |
| `cliente_id` FK | *(no existe)* | ❌ Python desnormaliza customer_name/cuit |
| `ot_id` FK | *(no existe)* | ❌ sin vinculación con OT |
| `iva_total` | `tax` | ⚠️ equivalente |
| `dispositivo_id` | *(no existe)* | ❌ |
| `version_catalogo` | *(no existe)* | ❌ |
| `requiere_revision`, `motivo_revision` | *(no existe)* | ❌ sin marcadores de revisión offline |
| `error_afip` | *(en AfipQueue.last_error)* | ⚠️ separado |
| `timestamp_local` | *(no existe)* | ❌ |
| `timestamp_fiscal` | *(no existe)* | ❌ |

---

### 15. `factura_items` ↔ `SaleItem`
**Estado: ⚠️ — Faltan campos de IVA y descripción libre**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `empresa_id` desnormalizado | *(no existe)* | ❌ |
| `descripcion` texto libre | *(no existe)* | ❌ Python requiere variant_id (no puede tener ítems sin producto) |
| `variante_producto_id` NULLABLE | `variant_id` NOT NULL | ❌ Python requiere variante, SQL la hace opcional |
| `iva_porcentaje` (21/10.5/27/0) | *(no existe)* | ❌ necesario para AFIP |
| `subtotal`, `iva_monto`, `total_linea` | *(no existe)* | ❌ Python no almacena importes pre-calculados |
| `descuento_pct` | `discount_pct` | ✅ |

---

### 16. `cliente_empresa` ↔ `CustomerCompany`
**Estado: ⚠️ — PK diferente, faltan campos**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| PK compuesto `(cliente_id, empresa_id)` | PK surrogate `id` INTEGER + UniqueConstraint | ⚠️ diferente PK (Python agrega `id` autoincrement) |
| `limite_credito` | `credit_limit` | ✅ |
| `condicion_pago_dias` | `payment_terms_days` | ✅ |
| `lista_precios` TEXT | `price_list_id` FK a `price_list_files` | ⚠️ SQL es texto libre, Python es FK estructurada |
| `bloqueado` BOOLEAN | *(no existe)* | ❌ campo crítico para bloqueo de crédito |
| `deuda_acumulada` | `balance` | ✅ equivalente |
| `categoria` | *(no existe)* | ❌ |
| `notas` | `internal_notes` | ✅ equivalente |
| `activo` | `is_active` | ✅ |
| *(no existe)* | `discount_pct` | Python tiene descuento por defecto |
| *(no existe)* | `extra_data` JSONB | Python tiene datos extra flexibles |

---

### 17. `cuenta_corriente` ↔ `AccountMovement`
**Estado: ⚠️ — Estructura de relación diferente y faltan campos offline**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `cliente_id` + `empresa_id` directos | `customer_company_id` FK | ⚠️ Python navega vía CustomerCompany surrogate |
| `factura_id` FK directo | `reference_type` + `reference_id` (polimórfico) | ⚠️ Python usa referencia polimórfica |
| `tipo` (cargo/pago) | `movement_type` (FACTURA/PAGO/NOTA_CREDITO/AJUSTE) | ⚠️ Python tiene más tipos |
| `monto` | `amount` | ✅ |
| `saldo_resultante` | `balance_after` | ✅ equivalente |
| `descripcion` | `description` | ✅ |
| `medio_pago` | *(no existe)* | ❌ |
| `dispositivo_id` | *(no existe)* | ❌ falta campo offline |
| `usuario_id` | `created_by_id` | ✅ equivalente |
| `timestamp_local` | `date` (Date, no timestamp) | ❌ Python usa DATE no TIMESTAMPTZ |

---

### 18. `mensajes_whatsapp` ↔ `WhatsAppMessage`
**Estado: ⚠️ — Stub compatible pero con diferencias**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `cliente_id` FK directo | `entity_type` + `entity_id` polimórfico | ⚠️ Python no tiene FK directa al cliente |
| `template_nombre` | `template_name` | ✅ |
| `contenido_json` | `template_params` JSONB | ✅ equivalente |
| `estado` (pendiente/enviado/fallido/leido) | `status` (QUEUED/SENT/DELIVERED/READ/FAILED/DISABLED) | ⚠️ Python agrega DELIVERED y DISABLED |
| `intentos` | *(no existe)* | ❌ Python no trackea reintentos |
| `error_ultimo` | `error_message` | ✅ equivalente |
| `mensaje_id_whatsapp` | `wa_message_id` | ✅ |
| `timestamp_local` | *(no existe)* | ❌ falta campo offline |
| `timestamp_enviado` | `sent_at` | ✅ |
| *(no existe)* | `delivered_at`, `read_at` | Python tiene timestamps granulares |
| `phone_number` | Python guarda teléfono directamente | ⚠️ SQL lo obtiene vía cliente_id |

---

### 19. `archivos` ↔ `StorageFile`
**Estado: ⚠️ — Diferencias en entity_id y campos offline**

| Campo SQL | Campo Python | Diferencia |
|-----------|--------------|------------|
| `entidad_tipo` | `entity_type` | ✅ |
| `entidad_id` TEXT (UUID) | `entity_id` INTEGER | ❌ **tipo incompatible** — SQL es UUID texto, Python es INT |
| `nombre_original` | `original_name` | ✅ |
| `ruta_servidor` | `stored_path` | ✅ equivalente |
| `mime_type` | `mime_type` | ✅ |
| `tamanio_bytes` | `size_bytes` | ✅ |
| `descripcion` | *(no existe)* | ❌ |
| `orden` INTEGER | *(no existe)* | ❌ sin ordenamiento de fotos |
| `sincronizado` | `is_synced` | ✅ |
| `dispositivo_id` | *(no existe)* | ❌ |
| `timestamp_local` | *(no existe)* | ❌ |
| *(no existe)* | `storage_backend` (LOCAL/S3/CLOUDFLARE) | Python expone backend explícito |
| *(no existe)* | `category`, `sync_priority`, `is_deleted` | Python tiene más metadata |

---

## Resumen de gaps críticos (prioridad para el arquitecto)

### ❌ Gaps críticos (bloquean funcionalidad)

1. **`facturas`/`Sale`**: Faltan todos los campos AFIP offline — `punto_venta`, `numero_provisorio`,
   `cae`, `cae_vencimiento`, `cai`, `cai_vencimiento`, `cliente_id` FK, `ot_id` FK,
   `timestamp_local`, `requiere_revision`. El workflow de contingencia no es implementable
   con el modelo actual.

2. **`cola_sync`**: No existe modelo Python. Sin cola de reintentos genérica no hay
   offline-first robusto para ningún módulo (solo AFIP tiene `AfipQueue`).

3. **`usuario_empresa`**: Un usuario no puede acceder a múltiples empresas en Python.
   Si el negocio requiere operadores multi-empresa, es bloqueante.

4. **`archivos.entity_id`**: Es INT en Python, TEXT (UUID) en SQL. Incompatible si se
   comparten archivos entre el cliente Node.js y el servidor Python.

### ⚠️ Gaps importantes (degradan funcionalidad offline)

5. **`timestamp_local` + `dispositivo_id` + `version`** ausentes en TODOS los modelos
   Python. El backend FastAPI no puede rastrear origen offline de ningún registro.

6. **`ordenes_trabajo` ↔ `WorkOrder`**: Python desnormaliza vehículo y cliente en la WO
   (no hay `vehiculo_id` FK). Esto impide actualizar datos del vehículo desde una OT
   histórica y rompe la consistencia con la tabla `vehicles`.

7. **`cliente_empresa.bloqueado`** ausente en Python. El sistema no puede bloquear un
   cliente por empresa sin agregar este campo.

8. **`factura_items.iva_porcentaje`** ausente en Python. Sin él no se puede generar un
   comprobante AFIP válido (la alícuota de IVA es obligatoria).

9. **`eventos_sync.idempotency_key`** ausente en Python. Sin idempotencia, un evento
   puede procesarse dos veces si la red falla entre envío y confirmación.

---

## Tablas Python sin equivalente en SQL schema

Los modelos Python tienen tablas adicionales **no cubiertas** por los schemas 001–004:

| Tabla Python | Descripción | ¿Necesita schema SQL? |
|---|---|---|
| `work_order_history` | Auditoría de transiciones de estado OT | Sí — importante para auditoría |
| `work_order_checklists` | Checklist de control de calidad | Sí — funcionalidad específica |
| `mechanic_rates` | Tarifas horarias por mecánico | Sí |
| `afip_configs` | Configuración AFIP por empresa | Sí — crítico |
| `afip_queue` | Cola AFIP con contingencia | Reemplazaría cola_sync para AFIP |
| `sync_conflicts` | Registro de conflictos de sync | Complementa eventos_sync |
| `price_list_files` | Listas de precios | No está en schema SQL |
| `purchase_invoices` | Facturas de compra | No está en schema SQL |
| `pedidos` | Pedidos a proveedor | No está en schema SQL |
| `ingresos` | Ingresos de mercadería | No está en schema SQL |
| `bank_accounts`, `payment_vouchers`, `credit_notes` | Pagos a proveedores | No están en schema SQL |
| `transports`, `shipments` | Logística de envíos | No están en schema SQL |
| `mercadopago_configs`, `mercadopago_transactions` | MercadoPago | No están en schema SQL |
