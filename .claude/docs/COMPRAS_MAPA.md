# Mapa exhaustivo del módulo COMPRAS

Este archivo es la fuente de verdad para cualquier trabajo en el módulo de Compras. Leelo antes de tocar código. El resto de la documentación del repo sobre este módulo está incompleta o desactualizada.

---

## Alcance del módulo

El módulo Compras cubre el ciclo completo:

1. **Proveedores** → CRUD + contactos + datos fiscales + retenciones + logos + marcas
2. **Notas de pedido** (Purchase Orders) → crear orden a proveedor con items, tipo PRECOMPRA/REPOSICION/CAMBIO, estado BORRADOR→PENDIENTE→RECIBIDO→COMPLETADO, con Excel/PDF adjunto
3. **Facturas de proveedor** (Purchase Invoices) → remitos, facturas, remito_factura, vinculadas a una orden; con semáforo ROJO/AMARILLO/VERDE a 2 niveles de aprobación (local + admin)
4. **Recepción en locales** → confirmar llegada (SI/NO/PARCIAL) con foto, observaciones, fecha
5. **Gestión de pagos** → comprobantes con retenciones (IVA/IIBB/Ganancias/SUSS), vínculo M2M a varias facturas, notas de crédito
6. **Transportes / Envíos** → carta porte, kg, destino, foto
7. **Listas de precios** → cruces contra facturas para detectar variaciones
8. **Comparadores** → cruces documento-a-documento (pedido → factura → remito → venta)

---

## CRÍTICO: Dualidad de modelos

Hay **dos modelos paralelos** conviviendo en el codebase y es la raíz de muchos bugs:

| Modelo viejo (simple) | Modelo nuevo (completo) | Estado |
|---|---|---|
| `Pedido` (`pedido.py`, 2.4 KB) | `PurchaseOrder` (`purchase_order.py`, 4.9 KB) | Nuevo es el oficial |
| `Ingreso` (`ingreso.py`, 2.6 KB) | `PurchaseInvoice` (`purchase_invoice.py`, 6.5 KB) | Nuevo es el oficial |

**Regla**: para nuevos features usar **SIEMPRE** `PurchaseOrder` + `PurchaseInvoice`. No agregar código que dependa de `Pedido` / `Ingreso` salvo que sea para migrar o mantener compatibilidad. Los dos primeros existen por legacy — hay que irlos deprecando.

Cuando se reporte un bug, verificar primero **cuál de los dos modelos se está usando**. La UI puede estar llamando al endpoint viejo (`/api/v1/pedidos`, `/api/v1/ingresos`) en vez del nuevo (`/api/v1/purchase-orders`, `/api/v1/purchase-invoices`).

---

## Modelos de datos (ERP nuevo, en `erp/backend/app/models/`)

### `purchase_order.py` (4.9 KB)

- **`PurchaseOrder`** — tabla `purchase_orders`
  - Campos clave: `number`, `prefix`, `type`, `status`, `date`, `expected_date`, `total_ordered`, `total_received`, `accepted_difference`, `selected_brands`, `excel_file`, `pdf_file`
  - FKs: `provider_id`, `local_id`, `company_id`, `created_by_id`
  - Relaciones: `provider`, `local`, `items` (cascade), `invoices` (1:N a PurchaseInvoice)
- **Enum `PurchaseOrderStatus`**: `BORRADOR | PENDIENTE | ENVIADO (legacy) | RECIBIDO | COMPLETADO | ANULADO`
  - ⚠️ `ENVIADO` es alias legacy — código nuevo debe usar `PENDIENTE`, pero no removerlo (filas viejas lo usan)
- **Enum `PurchaseOrderType`**: `PRECOMPRA | REPOSICION | CAMBIO`
- **`PurchaseOrderItem`** — tabla `purchase_order_items`
  - Campos: `variant_id`, `code`, `description`, `quantity_ordered`, `quantity_received`, `unit_cost`

### `purchase_invoice.py` (6.5 KB)

- **`PurchaseInvoice`** — tabla `purchase_invoices`
  - Campos clave: `number`, `type`, `status`, `date`, `due_date`, `amount`, `remito_venta_number`, `pdf_file`, `is_partial`, `ingreso_status`, `ingreso_date`, `ingreso_photo`
  - Aprobación 2 niveles: `estado_semaforo`, `confirmado_local_at`, `confirmado_admin_at`, `confirmado_local_by_id`, `confirmado_admin_by_id`
  - Auto-referencia: `linked_to_id` → puede vincularse a otra PurchaseInvoice (típico: REMITO ↔ FACTURA)
  - FKs: `purchase_order_id` (obligatorio), `provider_id`, `local_id`, `company_id`
- **Enum `PurchaseInvoiceType`**: `FACTURA | REMITO | REMITO_FACTURA`
- **Enum `PurchaseInvoiceStatus`**: `PENDIENTE | VERDE | ROJO | ALERTA_REPO | ANULADO`
- **Enum `IngresoStatus`** (dentro de este archivo): `PENDIENTE | PARCIAL | COMPLETO | NO`
- **Enum `SemaforoEstado`**: `ROJO | AMARILLO | VERDE`
  - ROJO = sin RV o sin ingreso
  - AMARILLO = tiene RV + ingreso parcial o no confirmado por admin
  - VERDE = RV + ingreso COMPLETO confirmado por admin
- **`PurchaseInvoiceItem`** — tabla `purchase_invoice_items`
  - Campos: `code`, `description`, `size`, `color`, `quantity_invoiced`, `quantity_received`, `unit_price`, `list_price`

### `payment.py` (6.2 KB)

- **`BankAccount`** — tabla `bank_accounts`, cuentas bancarias del proveedor
- **`PaymentVoucher`** — tabla `payment_vouchers`, comprobante/minuta de pago
  - Retenciones: `amount_gross`, `amount_iibb`, `amount_ganancias`, `amount_iva`, `amount_suss`, `amount_net`, `amount_paid`
  - Estados: `POR_PAGAR | PARCIAL | PAGADO | VENCIDO | ANULADO`
  - Métodos: `TRANSFERENCIA | CHEQUE | EFECTIVO | DEPOSITO | DEBITO_DIRECTO | OTRO`
- **`PaymentInvoiceLink`** — M2M entre `PaymentVoucher` y `PurchaseInvoice`, con `amount` por vínculo
- **`CreditNote`** — tabla `credit_notes`, notas de crédito de proveedor, con flag `applied`

### `provider.py` (3.0 KB)

- **`Provider`** — tabla `providers`
  - Datos comerciales: `name`, `cuit`, `contact_name`, `phone`, `email`, `address`
  - Datos fiscales: `legal_name`, `tax_condition`, `gross_income`, `domicilio`, `localidad`, `provincia`
  - Retenciones (Numeric(6,4)): `ret_iva_pct`, `ret_iibb_pct`, `ret_ganancias_pct`, `ret_suss_pct`
  - Alertas: `days_alert_sin_rv`
  - Comercial: `brands` (CSV en campo String), `tango_code`, `order_prefix`, `logo_filename`
- **`ProviderContact`** (en `provider_contact.py`) — contactos adicionales del proveedor

### `transport.py` (2.9 KB)

- **`Transport`** — tabla `transports`, empresas de transporte
- **`Shipment`** — tabla `shipments`, envíos concretos
  - FKs a `transport_id`, `destination_local_id`, `purchase_invoice_id`

### Modelos relacionados (no-compras pero usados)

- `price_list.py` — listas de precios (import Excel, cruces)
- `local.py` — sucursales (destino de recepción)
- `company.py` — tenant
- `user.py` — creador, aprobador

---

## Routers de backend (en `erp/backend/app/api/v1/`)

| Router | Tamaño | Prefix | Qué hace |
|---|---|---|---|
| `purchase_orders.py` | 46 KB | `/api/v1/purchase-orders` | CRUD + workflow (enviar/recibir/anular) + items + upload Excel/PDF + recálculo de totales |
| `purchase_invoices.py` | 36 KB | `/api/v1/purchase-invoices` | CRUD + tipos FACTURA/REMITO/REMITO_FACTURA + semáforo + confirmación 2 niveles + vínculos + items |
| `payments.py` | 13 KB | `/api/v1/payments` | CRUD comprobantes + retenciones + notas de crédito + cuentas bancarias + M2M a facturas |
| `providers.py` | 25 KB | `/api/v1/providers` | CRUD + contactos + logos + import Tango + fiscales + retenciones |
| `transports.py` | 9 KB | `/api/v1/transports` | CRUD transportes + shipments |
| `price_lists.py` | 8 KB | `/api/v1/price-lists` | Upload Excel de lista + consulta |
| `pedidos.py` | 19 KB | `/api/v1/pedidos` | **Legacy simple** — viejo modelo `Pedido`, aún usado en algunas pantallas |
| `ingresos.py` | 15 KB | `/api/v1/ingresos` | **Legacy simple** — viejo modelo `Ingreso`, aún usado |
| `pdf_parser.py` | 28 KB | `/api/v1/pdf-parser` | Parse PDF de facturas/remitos (OCR + extracción) |
| `excel_parser.py` | 24 KB | `/api/v1/excel-parser` | Parse Excel de listas de precios y pedidos |

**Regla de oro**: `purchase_orders` + `purchase_invoices` + `payments` son los oficiales. `pedidos` / `ingresos` son legacy a deprecar.

---

## Frontend (en `erp/frontend/src/pages/` y `components/`)

### Páginas principales

| Página | Archivo | Rol típico | Qué hace |
|---|---|---|---|
| Pedidos Compras | `PedidosComprasPage.jsx` | COMPRAS, ADMIN | Listado + detalle de Notas de Pedido (PurchaseOrder). Principal página operativa |
| Facturas Proveedor | `FacturasProveedorPage.jsx` | COMPRAS, ADMIN, ADMINISTRACION | Listado facturas con semáforo + aprobación admin |
| Gestión Pagos | `GestionPagosPage.jsx` | GESTION_PAGOS, ADMIN | Comprobantes de pago + retenciones + NC |
| Ingreso | `IngresoPage.jsx` | LOCAL, ADMIN | Ingreso legacy (modelo `Ingreso`) |
| Recepción | `RecepcionPage.jsx` | LOCAL | Confirmar llegada, cargar foto, marcar parcial |
| Proveedores | `ProveedoresPage.jsx` | ADMIN, COMPRAS | CRUD proveedores |
| Pedidos | `PedidosPage.jsx` | varios | Legacy (modelo `Pedido`) |
| Comparador | `ComparadorPage.jsx` | COMPRAS, ADMIN | Entry point a los comparadores |
| Transporte | `TransportePage.jsx` | COMPRAS, ADMIN | Transportes + envíos |
| Informes | `InformesPage.jsx` | ADMIN | Tiene tabs que cruzan datos de compras |
| Reportes | `ReportesPage.jsx` | ADMIN | Stats proveedores (incompleto) |
| Consultas | `ConsultasPage.jsx` | varios | Búsqueda global (incompleto) |
| Resumen | `ResumenPage.jsx` | ADMIN | Dashboard-ish de compras |

### Componentes reutilizables (compras-específicos)

Ya existen en `erp/frontend/src/components/` (NO crear duplicados):

| Componente | Archivo | Qué hace |
|---|---|---|
| `ExcelViewer` | `ExcelViewer.jsx` | Viewer de Excel inline con tabs por hoja |
| `PdfViewer` | `PdfViewer.jsx` | Modal con iframe + botón descarga |
| `ExcelConPreciosViewer` | `ExcelConPreciosViewer.jsx` | Excel de pedido con precios de lista cruzados |
| `ComparadorCruzado` | `ComparadorCruzado.jsx` | Cruce pedido → factura → remito (OK / Con Diferencia / SQL) |
| `ComparadorListaFacturas` | `ComparadorListaFacturas.jsx` | Lista de precios vs facturas (OK / FACTURA_MAYOR / FACTURA_MENOR / SIN_FACTURA) |
| `ComparadorOmbak` | `ComparadorOmbak.jsx` | Excel de pedido vs PDF de orden Ombak |
| `ComparadorPreciosViewer` | `ComparadorPreciosViewer.jsx` | Factura vs pedido con variación % |
| `CargaMasiva` | `CargaMasiva.jsx` | Upload masivo de PDFs con OCR + dedupe |
| `CargaAvanzada` | `CargaAvanzada.jsx` | Upload inteligente con detección de proveedor + matching por nota |
| `CrucePreciosModal` | `CrucePreciosModal.jsx` | Modal de cruce desde gestión pagos |
| `HistoriaProveedor` | `HistoriaProveedor.jsx` | Historial (facturas + NC + pagos) + saldo acumulado + filtros |

⚠️ **`MIGRACION_ESTADO.md` miente** diciendo que muchos de estos faltan. Ya están implementados. Siempre buscar con grep antes de asumir que hay que crearlos.

---

## Flujos de negocio

### Flujo 1: Crear una Nota de Pedido

1. Usuario COMPRAS entra a `PedidosComprasPage.jsx`
2. Click "Nueva Nota" → modal con provider_id, date, expected_date, type (PRECOMPRA/REPOSICION/CAMBIO)
3. POST a `/api/v1/purchase-orders` con items
4. Estado inicial: `BORRADOR`
5. Cuando se envía al proveedor: PUT a `/purchase-orders/{id}/send` → estado `PENDIENTE`
6. Puede adjuntar Excel del pedido y PDF de la OC

### Flujo 2: Recepción en local

1. Usuario LOCAL entra a `RecepcionPage.jsx`
2. Ve remitos/facturas pendientes de confirmar (PurchaseInvoice con `ingreso_status=PENDIENTE`)
3. Marca COMPLETO / PARCIAL / NO → PUT a `/purchase-invoices/{id}/confirm-receipt` con opcional foto
4. Si PARCIAL: sube foto evidencia, cambia `is_partial=true`
5. Trigger: recalcular `estado_semaforo` (ROJO → AMARILLO)

### Flujo 3: Aprobación admin

1. Usuario ADMIN ve facturas confirmadas por local en `FacturasProveedorPage.jsx`
2. Revisa cantidades y precios (via `ComparadorCruzado`)
3. Aprueba → PUT `/purchase-invoices/{id}/admin-confirm` → `estado_semaforo=VERDE`
4. Si hay diferencia aceptable: `accepted_difference=true` en la orden

### Flujo 4: Pago al proveedor

1. Usuario GESTION_PAGOS entra a `GestionPagosPage.jsx`
2. Filtra facturas VERDE del proveedor
3. Crea `PaymentVoucher` con retenciones calculadas desde `Provider.ret_*_pct`
4. Vincula facturas vía `PaymentInvoiceLink` (M2M)
5. Emite comprobante PDF
6. Cuando se acredita: PUT `/payments/{id}/mark-paid` → estado `PAGADO`

---

## Legacy CONTROL REMITOS (solo lectura — nunca editar)

Ubicación: `D:\ERP MUNDO OUTDOOR\CONTROL REMITOS\`

### Backend legacy

`CONTROL REMITOS/SISTEMA PEDIDOS/servidor/ENDPOINTS/`

| Archivo | Tamaño | Qué tiene |
|---|---|---|
| `comparar.py` | **114 KB** | Toda la lógica de cruces, OCR, parsing PDF. ⚠️ Nunca leer completo |
| `facturas.py` | 84 KB | CRUD facturas/remitos, semáforo, ingreso parcial, fotos |
| `notas.py` | 51 KB | Notas de pedido (equivalente a PurchaseOrder) |
| `proveedores.py` | 38 KB | CRUD + import Tango PDF |
| `ombak.py` | 31 KB | Cruce específico de pedidos Ombak |
| `listas_precios.py` | 22 KB | Listas de precios Excel |
| `remitos.py` | 17 KB | Remitos sueltos |
| `gestion_pagos.py` | 10 KB | Pagos + retenciones |
| `transportes.py` | 9 KB | Transportes + envíos |
| `historial.py` | 10 KB | Historia proveedor |

Modelos en `servidor/models.py` (30 KB) y schemas en `servidor/schemas.py` (22 KB).

### Frontend legacy

`CONTROL REMITOS/frontend/src/`

| Archivo | Tamaño | Qué tiene |
|---|---|---|
| `pages/Admin.tsx` | **360 KB** | ⚠️ Nunca leer completo. Contiene muchos tabs |
| `pages/admin/FacturasTab.tsx` | 139 KB | Tab de ingresos, 9 secciones |
| `pages/admin/ResumenTab.tsx` | 57 KB | Tab principal de monitoreo |
| `pages/admin/RemitosTab.tsx` | 54 KB | Tab de recepción |
| `pages/admin/GestionPagosTab.tsx` | 41 KB | Tab de pagos |
| `pages/admin/ProveedoresTab.tsx` | 26 KB | Tab de proveedores |
| `pages/HomeReal.tsx` | 70 KB | Vista local (RecepcionPage equivalente) |
| `pages/Pedidos.tsx` | 33 KB | Pedidos generales |
| `pages/Proveedores.tsx` | 14 KB | |

**Regla**: grep primero, leer rangos específicos. Nunca abrir un archivo > 50 KB completo.

---

## Datos conocidos del entorno real

### Locales (11 activos)

| ID | Nombre |
|---|---|
| 28 | Mundo Outdoor Palermo |
| 34 | Montagne Villa María |
| 35 | Montagne General Roca |
| 36 | Mundo Outdoor General Roca |
| 37 | Mundo Outdoor Bahía Blanca San Martín |
| 38 | Mundo Outdoor Bahía Blanca Plaza Shopping |
| 39 | Montagne Neuquén Centro |
| 40 | Neuquén Shopping Alto Comahue |
| 41 | Neuquén Shopping Paseo de la Patagonia |
| 42 | Montagne Mar del Plata Güemes |
| 43 | Montagne Mar del Plata Juan B. Justo |

Los selectores de local en cualquier pantalla de compras deben mostrar estos 11 filtrados por `company_id` del usuario.

> **Nota histórica (24-abr-2026)**: versiones previas de este doc listaban los locales con IDs `2`–`12`. Esos IDs **no existen** en la DB real; eran de una numeración anterior. Los IDs reales son los de arriba. Si ves hardcodeados IDs `2`–`12` en código viejo, son referencias rotas.
>
> Tabla de cruce (ID viejo → ID real) por si aparece en código legacy:
>
> | ID viejo | ID real | Nombre |
> |---|---|---|
> | 2 | 41 | Neuquén Shopping Paseo de la Patagonia |
> | 3 | 28 | Mundo Outdoor Palermo |
> | 4 | 39 | Montagne Neuquén Centro |
> | 5 | 40 | Neuquén Shopping Alto Comahue |
> | 6 | 35 | Montagne General Roca |
> | 7 | 36 | Mundo Outdoor General Roca |
> | 8 | 37 | Mundo Outdoor Bahía Blanca San Martín |
> | 9 | 38 | Mundo Outdoor Bahía Blanca Plaza Shopping |
> | 10 | 42 | Montagne Mar del Plata Güemes |
> | 11 | 43 | Montagne Mar del Plata Juan B. Justo |
> | 12 | 34 | Montagne Villa María |
>
> Limpieza de datos ejecutada en `erp/backend/scripts/cleanup_seed_data.py` (borra 16 locales contaminados, deduplica Miding/Montagne/Himeba/BB Plaza Shopping y elimina 5 notas de pedido seed vacías).

## Bugs conocidos y zonas calientes

### Alta probabilidad de bug

- **Dualidad Pedido/PurchaseOrder e Ingreso/PurchaseInvoice**: endpoints viejos y nuevos conviven. Si algo no se actualiza, verificar qué endpoint está llamando la UI.
- **`purchase_orders.py` es un archivo de 46 KB**: toda la lógica de CRUD + workflow + semáforo vive ahí. Muchos paths condicionales sobre `status` y `type`.
- **Cálculo de `estado_semaforo`**: depende de `ingreso_status` + `confirmado_local_at` + `confirmado_admin_at` + existencia de `remito_venta_number`. Fuente frecuente de bugs visuales.
- **Retenciones**: `Provider.ret_*_pct` es `Numeric(6, 4)` (ej `0.0350` = 3.5%). Verificar siempre si los cálculos están multiplicando correctamente.
- **Parsing de PDFs/Excels**: `pdf_parser.py` y `excel_parser.py` tienen heurísticas por proveedor (MIDING, MONTAGNE, OMBAK). Bug típico: proveedor nuevo sin regla específica cae al default y parsea mal.
- **Fechas timezone**: `DateTime(timezone=True)` pero algunos endpoints comparan sin tz. Ordenamientos y filtros por fecha son zona caliente.
- **Money**: si ves `Float` en algún lado del módulo, es un bug — deberían ser `Numeric`.
- **Contabilidad de totales**: `PurchaseOrder.total_ordered` vs suma de items, `total_received` vs `quantity_received`. Desincronizaciones frecuentes.
- **`PurchaseInvoiceStatus` vs `IngresoStatus` vs `SemaforoEstado`**: TRES enums distintos en el mismo modelo. Cuando el usuario reporta "está en ROJO pero debería estar VERDE", hay que ver cuál de los 3 está mal.

### Puntos de extensión frecuentes

- Agregar campo a PurchaseOrder → tocar modelo + router + schema + Page
- Agregar cálculo de retención → tocar `payments.py` y `GestionPagosPage.jsx`
- Agregar tipo de comparador → crear componente en `components/` + botón en `ComparadorPage.jsx`
- Cambiar lógica de semáforo → probablemente en `purchase_invoices.py` (función de compute) + frontend que lo muestra

---

## Checklist rápido para trabajar en el módulo

1. [ ] Leí `AGENTS.md` (root) y este archivo
2. [ ] Identifiqué si el bug está en modelo viejo (`Pedido`/`Ingreso`) o nuevo (`PurchaseOrder`/`PurchaseInvoice`)
3. [ ] Verifiqué con `grep` qué endpoint exacto llama la UI afectada
4. [ ] Si la lógica compleja existe en legacy, abrí **solo el rango relevante** (nunca archivo completo)
5. [ ] Mis queries filtran por `current_user.company_id` (excepto MEGAADMIN/SUPERADMIN)
6. [ ] Money es `Numeric`, no `Float`
7. [ ] Dates son timezone-aware
8. [ ] Si toqué frontend → acuerdo de correr `DEPLOY_RAPIDO.bat`
9. [ ] Si toqué modelo → migración Alembic creada y aplicada
10. [ ] Pase por `@code-reviewer` antes de cerrar
