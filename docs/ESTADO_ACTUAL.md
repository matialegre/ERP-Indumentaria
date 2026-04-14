# ESTADO ACTUAL — ERP Mundo Outdoor

> **Fecha de auditoría**: Junio 2025
> **Propósito**: Briefing matutino. Responde tres preguntas: ¿Qué existe? ¿Qué falta? ¿Qué hago primero?
> **Contexto**: Tres agentes Copilot trabajaron en paralelo (Arquitecto, Schema SQL, Sync Specialist). Este documento consolida y audita los resultados.

---

## RESUMEN DE AUDITORÍA

| Pregunta | Respuesta |
|---|---|
| ¿Los modelos Python coinciden con el schema SQL de B? | ⚠️ PARCIALMENTE. Misma arquitectura pero naming diferente (EN vs ES) y 6 campos faltan en SyncEvent |
| ¿Los 26 campos de `eventos_sync` están en `sync.py`? | ❌ NO. Faltan 6: `idempotency_key`, `version`, `version_catalogo`, `campos_modificados`, `lote_sync_id`, `checksum` |
| ¿`conflict-resolution.md` es compatible con `sync.py` endpoints? | ✅ SÍ. Conflictos se manejan en tabla separada `SyncConflict` (mejor que inline en eventos) |
| ¿Hay tablas en docs sin modelo Python? | ⚠️ SÍ: `stock_by_local`, `bank_reconciliation`, `contingency_invoices` (parcial) |

### Divergencia de Naming (resolución)

- **Documentos B/C** usan español: `eventos_sync`, `dispositivos`, `empresas`, `movimientos_stock`, `variantes_producto`, `cola_sync`
- **Modelos Python (A)** usan inglés: `sync_events`, `device_registry`, `companies`, `stock_movements`, `product_variants`
- **Resolución**: Los modelos Python son la fuente de verdad (generan tablas reales vía Alembic). Los nombres en español de los docs de B/C corresponden al diseño conceptual del schema SQLite local. PostgreSQL usa los nombres en inglés de SQLAlchemy.

---

## SECCIÓN 1: QUÉ EXISTE HOY

### Leyenda de estados

| Icono | Significado |
|---|---|
| ✅ FUNCIONAL | Archivo existe, código completo, registrado en router/init |
| ⚙️ ESTRUCTURA | Archivo existe pero sin migración aplicada, sin tests, o sin frontend asociado |
| 📄 DOCUMENTO | Documento de diseño/arquitectura, no código ejecutable |
| ❌ FALTANTE | Referenciado en docs pero no existe como archivo |

---

### Backend — Modelos (`erp/backend/app/models/`)

26 archivos de modelos. 93 clases/enums exportados en `__init__.py`.

| Archivo | Estado | Descripción |
|---|---|---|
| `company.py` | ✅ | Company con branding white-label, `IndustryType` enum (9 industrias) |
| `user.py` | ✅ | User con 12 roles (`UserRole` enum), multi-tenant via `company_id` nullable |
| `local.py` | ✅ | Sucursales/locales |
| `provider.py` | ✅ | Proveedores |
| `provider_contact.py` | ✅ | Contactos de proveedor |
| `product.py` | ✅ | Product + ProductVariant (talle/color/SKU/barcode) |
| `ingreso.py` | ✅ | Remitos/facturas de compra. Workflow BORRADOR→CONFIRMADO→ANULADO |
| `pedido.py` | ✅ | Notas de pedido a proveedor. Workflow BORRADOR→ENVIADO→RECIBIDO |
| `sale.py` | ✅ | Ventas/facturación. Workflow BORRADOR→EMITIDA→PAGADA→ANULADA. **FALTA**: campos AFIP (`cae`, `punto_venta`, `cbte_nro`) |
| `stock_movement.py` | ✅ | Movimientos de stock (INGRESO/EGRESO/AJUSTE/TRANSFERENCIA) |
| `purchase_order.py` | ✅ | Órdenes de compra (migración desde CONTROL REMITOS) |
| `purchase_invoice.py` | ✅ | Facturas de proveedor con tipos y estados |
| `payment.py` | ✅ | BankAccount, PaymentVoucher, PaymentInvoiceLink, CreditNote |
| `transport.py` | ✅ | Transport, Shipment |
| `notification.py` | ✅ | Notification, AuditLog con `NotificationType` y `NotificationStatus` |
| `price_list.py` | ✅ | PriceListFile, PriceListItem |
| `kanban.py` | ✅ | KanbanBoard, KanbanColumn, KanbanCard con prioridades |
| `mail_config.py` | ✅ | MailConfig para configuración de email |
| `improvement_note.py` | ✅ | ImprovementNote (notas de mejora/feedback) |
| `module.py` | ✅ | CompanyModule + `MODULES_CATALOG` (16 módulos habilitables) |
| `plan.py` | ✅ | Plan, CompanySubscription. 4 tiers: FREE, STARTER, PRO, ENTERPRISE |
| `work_order.py` | ⚙️ | 5 modelos OT (WorkOrder, WorkOrderItem, WorkOrderHistory, WorkOrderChecklist, MechanicRate). 10 estados. Backend completo pero **frontend no existe**. **NO tiene `vehicle_id` FK** (vehículos se crearon después) |
| `customer.py` | ⚙️ | 4 modelos CRM (Customer, CustomerCompany, Vehicle, AccountMovement). Recién creado, **sin migración Alembic** |
| `sync.py` | ⚙️ | 10 modelos sync+integraciones (SyncEvent, DeviceRegistry, SyncConflict, AfipConfig, AfipQueue, StorageFile, WhatsAppMessage, MercadoPagoConfig, MercadoPagoTransaction). Recién creado, **sin migración Alembic**. **FALTAN campos**: `idempotency_key`, `version`, `version_catalogo`, `campos_modificados`, `lote_sync_id`, `checksum` |
| `stock_by_local.py` | ❌ | Referenciado en MEGA_PLAN para stock multi-local con PN-Counter. No existe |
| `bank_reconciliation.py` | ❌ | Referenciado en MEGA_PLAN para conciliación bancaria. No existe |

---

### Backend — API Routers (`erp/backend/app/api/v1/`)

35 routers registrados en `router.py` bajo el prefijo `/api/v1`.

| # | Archivo | Prefijo | Tags | Estado |
|---|---|---|---|---|
| 1 | `auth.py` | `/auth` | Auth | ✅ |
| 2 | `companies.py` | `/companies` | Companies | ✅ |
| 3 | `users.py` | `/users` | Usuarios | ✅ |
| 4 | `locals.py` | `/locals` | Locales | ✅ |
| 5 | `providers.py` | `/providers` | Proveedores | ✅ |
| 6 | `products.py` | `/products` | Productos | ✅ |
| 7 | `ingresos.py` | `/ingresos` | Ingresos | ✅ |
| 8 | `system.py` | `/system` | Sistema | ✅ |
| 9 | `pedidos.py` | `/pedidos` | Pedidos | ✅ |
| 10 | `sales.py` | `/sales` | Ventas | ✅ |
| 11 | `stock.py` | `/stock` | Stock | ✅ |
| 12 | `menu_config.py` | `/menu-config` | Configurador de Menú | ✅ |
| 13 | `purchase_orders.py` | `/purchase-orders` | Purchase Orders | ✅ |
| 14 | `purchase_invoices.py` | `/purchase-invoices` | Purchase Invoices | ✅ |
| 15 | `payments.py` | `/payments` | Pagos | ✅ |
| 16 | `transports.py` | `/transports` | Transportes | ✅ |
| 17 | `kanban.py` | `/kanban` | Kanban | ✅ |
| 18 | `notifications.py` | `/notifications` | Notificaciones | ✅ |
| 19 | `price_lists.py` | `/price-lists` | Listas de Precios | ✅ |
| 20 | `sql_server.py` | `/sql-server` | SQL Server | ✅ |
| 21 | `pdf_parser.py` | `/pdf-parser` | PDF Parser | ✅ |
| 22 | `legacy.py` | `/legacy` | Legacy | ✅ |
| 23 | `improvement_notes.py` | `/improvement-notes` | Improvement Notes | ✅ |
| 24 | `socios.py` | `/socios` | Socios | ✅ |
| 25 | `modules.py` | `/modules` | Modules | ✅ |
| 26 | `mega.py` | `/mega` | Mega Admin | ✅ |
| 27 | `branding.py` | `/branding` | Branding | ✅ |
| 28 | `templates.py` | `/templates` | Templates | ✅ |
| 29 | `plans.py` | `/plans` | Planes | ✅ |
| 30 | `onboarding.py` | `/onboarding` | Onboarding | ✅ |
| 31 | `comisiones.py` | `/comisiones` | Comisiones | ✅ |
| 32 | `work_orders.py` | `/work-orders` | Órdenes de Trabajo | ⚙️ Registrado, sin migración de tablas |
| 33 | `customers.py` | `/customers` | Clientes / CRM | ⚙️ Registrado, sin migración de tablas |
| 34 | `sync.py` (sync_router) | `/sync` | Sincronización | ⚙️ Registrado, sin migración de tablas |
| 35 | `sync.py` (storage_router) | `/storage` | Storage | ⚙️ Registrado, sin migración de tablas |
| — | `export_utils.py` | — | — | ✅ Helper interno, no es router |

---

### Backend — Migraciones Alembic (`erp/backend/alembic/versions/`)

13 migraciones existentes:

| Migración | Descripción |
|---|---|
| `1539ccd2cdde` | 001 — Initial schema |
| `98a5cb57ba52` | 002 — Products and Ingresos |
| `627d1be90d54` | 004 — Procurement support models |
| `379ca4b050c0` | 005 — Payment method accepted difference |
| `726700e8d4db` | 006 — Semáforo aprobación 2 niveles |
| `c8f2a1b3d4e5` | 007 — Performance indexes |
| `fccde5b572e2` | Pedidos, Sales, Stock movements |
| `8409976b7861` | Add pedido_id to ingresos |
| `9e90ee6bd204` | Plans and subscriptions |
| `aea558c6b413` | MegaAdmin role and company branding |
| `f2000931f263` | Improvement notes table |
| `a3f9e1d7c2b4` | 004 — Performance indexes |
| `4f0e08f7b365` | Add icon_data to companies |

> ⚠️ **Tablas SIN migración**: `customers`, `customer_companies`, `vehicles`, `account_movements`, `sync_events`, `device_registry`, `sync_conflicts`, `afip_configs`, `afip_queue`, `storage_files`, `whatsapp_messages`, `mercadopago_configs`, `mercadopago_transactions`, `work_orders`, `work_order_items`, `work_order_history`, `work_order_checklists`, `mechanic_rates`

---

### Frontend — Páginas (`erp/frontend/src/pages/`)

30 páginas. Todas lazy-imported en `App.jsx` con Suspense + ErrorBoundary.

| Archivo | Ruta | Estado | Descripción |
|---|---|---|---|
| `LoginPage.jsx` | `/login` | ✅ | Autenticación con fallback offline, branding por empresa |
| `DashboardPage.jsx` | `/` | ✅ | Dashboard principal con KPIs, stats, accesos rápidos a módulos |
| `IngresoPage.jsx` | `/ingreso` | ✅ | Ingreso mercadería con remitos y facturas, tracking de estado |
| `ProductosPage.jsx` | `/productos` | ✅ | Catálogo productos CRUD con variantes (SKU, barcode), carga masiva Excel |
| `ProveedoresPage.jsx` | `/proveedores` | ✅ | Gestión proveedores con colores y datos históricos |
| `LocalesPage.jsx` | `/locales` | ✅ | CRUD sucursales/locales |
| `UsuariosPage.jsx` | `/usuarios` | ✅ | Gestión usuarios con roles RBAC |
| `MonitoreoPage.jsx` | `/monitoreo` | ✅ | Monitoreo sistema con gauges y métricas de performance |
| `PedidosPage.jsx` | `/pedidos` | ✅ | Pedidos de ventas con paginación, filtrado, máquina de estados |
| `PedidosComprasPage.jsx` | `/pedidos-compras` | ✅ | Notas de pedido a proveedores con alertas (OK/ANP/SIN_RV/INCOMPLETO) |
| `FacturasProveedorPage.jsx` | `/facturas-proveedor` | ✅ | Facturas/remitos de proveedor con conciliación RV |
| `GestionPagosPage.jsx` | `/gestion-pagos` | ✅ | Gestión de pagos con vouchers, cuentas bancarias, notas de crédito |
| `KanbanPage.jsx` | `/kanban` | ✅ | Tablero Kanban con prioridades y drag-drop |
| `StockPage.jsx` | `/stock` | ✅ | Inventario con variantes talle/color, soporte offline, ajustes |
| `FacturacionPage.jsx` | `/facturacion` | ✅ | Generación de facturas con impresión de tickets y persistencia offline |
| `ConsultasPage.jsx` | `/consultas` | ✅ | Búsqueda universal: productos, precios, stock, artículos. Barcode scanning |
| `ReportesPage.jsx` | `/reportes` | ✅ | Estadísticas con gráficos recharts (barras, torta), desglose por estado |
| `ConfigPage.jsx` | `/config` | ✅ | Configuración de sistema (sync, módulos, usuarios, seguridad) |
| `RecepcionPage.jsx` | `/recepcion` | ✅ | Recepción depósito con barcode scanning y recepción parcial |
| `ConfiguradorMenuPage.jsx` | `/configurador-menu` | ✅ | Constructor de menú en árbol con jerarquía y estado de deploy |
| `ComparadorPage.jsx` | `/comparador` | ✅ | Comparador de precios cross-proveedor con timeline charts |
| `CompletadosPage.jsx` | `/completados` | ✅ | Resumen de órdenes completadas por local con export CSV |
| `ResumenPage.jsx` | `/resumen` | ✅ | Dashboard resumen semáforo (VERDE/AMARILLO/ROJO) por pedidos |
| `TransportePage.jsx` | `/transporte` | ✅ | Gestión transporte/envíos con tracking de estado |
| `SociosMontagnePage.jsx` | `/socios-montagne` | ✅ | Gestión socios Montagne con mensajería y performance tracking |
| `ConfigModulosPage.jsx` | `/config-modulos` | ✅ | Habilitación de módulos por tipo de cliente (tienda, kiosco, mecánico, depósito) |
| `SyncStatusPage.jsx` | `/sync-status` | ✅ | Diagnóstico sync offline: ops pendientes, sync fallidos, estado de caché |
| `MegaAdminPage.jsx` | `/mega-admin` | ✅ | Panel super admin para gestión de empresas y feature flags |
| `CompanyWizardPage.jsx` | `/mega-admin/nueva-empresa` | ✅ | Wizard multi-paso para alta de empresa: branding, módulos, usuarios |
| `ComisionesPage.jsx` | `/comisiones` | ✅ | Cálculo de comisiones por ventas por usuario con filtrado por fechas |

> **Nota**: Todas las 30 páginas tienen frontend implementado. Las páginas de trabajo (OT), clientes (CRM) y sync se manejan parcialmente vía las páginas existentes (ConfigPage, SyncStatusPage) pero **no tienen páginas dedicadas aún**.

---

### Frontend — Infraestructura Offline (`erp/frontend/src/lib/`)

8 archivos existentes:

| Archivo | Estado | Descripción |
|---|---|---|
| `api.js` | ✅ | HTTP client con routing dinámico (Capacitor/web/LAN), auth Bearer token, timeout 30s |
| `offlineDB.js` | ✅ | IndexedDB wrapper (librería `idb`), 11 stores para catálogos, pendingOps, metadata sync. Schema v3 |
| `offlineSync.js` | ✅ | Motor sync: descarga catálogos, envía ops pendientes, detección de conexión en tiempo real |
| `useOfflineQuery.js` | ✅ | React Query wrapper con fallback a IndexedDB cuando offline |
| `offlineReceipt.js` | ✅ | Generador de tickets/recibos client-side para ventas offline con soporte de impresión |
| `exportUtils.js` | ✅ | Helpers para exportación CSV/Excel usando librería xlsx |
| `minutaPDF.js` | ✅ | Generador PDF para minutas de pago (GestiónPagos) |
| `useBarcode.js` | ✅ | Hook para manejo de estado del scanner de barcode (abrir/cerrar, captura) |
| `eventSourcing.js` | ❌ | Referenciado en documentación de sync, no creado |
| `deviceFingerprint.js` | ❌ | Referenciado en MEGA_PLAN para identificación de dispositivos, no creado |
| `syncEngine.js` | ❌ | Referenciado en MEGA_PLAN como motor push/pull/auto-sync, no creado |

---

### Frontend — Componentes (`erp/frontend/src/components/`)

28 componentes reutilizables:

| Componente | Descripción |
|---|---|
| `BarcodeScanner.jsx` | Modal lector de barcode/QR |
| `Breadcrumbs.jsx` | Trail de navegación |
| `CargaAvanzada.jsx` | Modal de carga avanzada de datos |
| `CargaMasiva.jsx` | Importador masivo/bulk |
| `ComparadorCruzado.jsx` | Matriz comparación cross-proveedor |
| `ComparadorListaFacturas.jsx` | Visor comparación lista de facturas |
| `ComparadorOmbak.jsx` | Comparador sync precios Ombak |
| `ComparadorPreciosViewer.jsx` | Visor resultados comparación precios |
| `CrucePreciosModal.jsx` | Modal de cruce/conciliación de precios |
| `EmptyState.jsx` | Placeholder UI sin datos |
| `ErrorBoundary.jsx` | React error boundary con fallback |
| `ExcelConPreciosViewer.jsx` | Preview Excel con overlay de precios |
| `ExcelViewer.jsx` | Preview/inspección de archivos Excel |
| `GlobalSearch.jsx` | Modal búsqueda universal Ctrl+K |
| `HistoriaProveedor.jsx` | Historial/timeline de proveedor |
| `ImpersonationBanner.jsx` | Banner de impersonación admin |
| `ImprovementNotes.jsx` | Widget de feedback/notas de mejora |
| `InstallPwa.jsx` | Prompt de instalación PWA |
| `LoadingSpinner.jsx` | Animación de carga centrada |
| `LocalSelector.jsx` | Selector modal de sucursal/local |
| `OfflineBanner.jsx` | Banner estado de conexión |
| `Pagination.jsx` | Controles de paginación |
| `PdfViewer.jsx` | Modal visor de PDF |
| `SplashScreen.jsx` | Pantalla de splash al iniciar |
| `SyncProgressWidget.jsx` | Indicador progreso sync offline |
| `Toast.jsx` | Notificación toast |
| `ToastProvider.jsx` | Provider contexto de toasts |

---

### Documentación de Arquitectura (`docs/`)

6 documentos:

| Archivo | Tamaño | Descripción |
|---|---|---|
| `MEGA_PLAN.md` | 67 KB | Plan maestro 8 secciones: roadmap completo del ERP SaaS |
| `conflict-resolution.md` | 73 KB | Manual de resolución de conflictos. 6 escenarios detallados: stock sobreventa, AFIP rechazo, OT simultánea, clientes, 7-días-offline, algoritmo central |
| `sync-architecture.md` | 49 KB | Evaluación tecnológica sync + diseño de protocolo + CRDT |
| `sync-gap-analysis.md` | 34 KB | Comparación campo-por-campo `eventos_sync` vs `SyncEvent` Python |
| `schema-decisions.md` | 18 KB | 14 decisiones de diseño con rationale (DN-1 a DN-14) |
| `model-sql-mapping.md` | 24 KB | Mapeo entre modelos Python y schema SQL |

### Schema SQL de referencia (`schema/`)

5 archivos SQL (diseño conceptual de B, **no ejecutados directamente** — Alembic genera las tablas):

| Archivo | Descripción |
|---|---|
| `001_empresas.sql` | Empresas, usuarios, locales |
| `002_sync.sql` | Sync v1 (original) |
| `002_sync_v2.sql` | Sync v2 (revisado con campos adicionales) |
| `003_catalogo.sql` | Catálogo de productos y variantes |
| `004_negocio.sql` | Lógica de negocio (ventas, stock, OT) |

### Documentación HTML (raíz del proyecto)

| Archivo | Tamaño | Descripción |
|---|---|---|
| `ARQUITECTURA_STOCK_FACTURACION.html` | 89 KB | Doc interactivo stock + facturación |
| `ARQUITECTURA_OT_SYNC.html` | 71 KB | Doc interactivo OT + sync |
| `SUPER_PLAN_ERP.html` | 48 KB | Mockup SaaS interactivo |
| `Propuesta ERP — Mundo Outdoor.html` | 83 KB | Propuesta comercial del ERP |

### Electron / Distribución

| Directorio | Estado | Contenido |
|---|---|---|
| `electron/` | ✅ | App Electron servidor/admin — main.js, preload.js, config-screen.html, splash.html |
| `electron-cliente/` | ✅ | App Electron cliente Mundo Outdoor — main.js, preload.js, splash.html |
| `electron-montagne/` | ✅ | App Electron cliente Montagne — main.js, preload.js, splash.html |
| `DISTRIBUIBLES/` | ✅ | Paquetes listos: 3 ZIPs (Servidor Admin, Cliente MO, Cliente Montagne) + APK Android + INSTRUCCIONES.txt |

---

## SECCIÓN 2: QUÉ FALTA PARA FASE 0 Y FASE 1

### FASE 0 — Fundamentos (incompleta)

#### Lo que ESTÁ hecho

- ✅ 26 modelos Python incluyendo sync (SyncEvent, DeviceRegistry, SyncConflict), CRM (Customer, Vehicle), OT (WorkOrder), AFIP (AfipConfig, AfipQueue), integraciones (WhatsApp, MercadoPago, Storage)
- ✅ 35 API routers registrados en `router.py` incluyendo sync, customers, work_orders
- ✅ 13 migraciones Alembic aplicadas (tablas base funcionando)
- ✅ Infraestructura offline frontend (IndexedDB 11 stores, outbox pattern, service worker)
- ✅ 30 páginas frontend implementadas
- ✅ 28 componentes reutilizables
- ✅ 6 documentos de arquitectura exhaustivos (247 KB total)
- ✅ 5 archivos schema SQL de referencia
- ✅ Distribución Electron + APK empaquetada

#### Lo que FALTA (priorizado)

| # | Prioridad | Tarea | Detalle |
|---|---|---|---|
| 1 | 🔴 CRÍTICO | **Migración Alembic consolidada** | ~18 tablas nuevas existen como modelos Python pero NO como tablas en PostgreSQL: customers, vehicles, sync_events, device_registry, work_orders, afip_configs, etc. |
| 2 | 🔴 CRÍTICO | **Agregar campos faltantes a SyncEvent** | 6 campos identificados en sync-gap-analysis.md: `idempotency_key` (previene duplicados), `version` (concurrencia optimista), `version_catalogo` (detectar precios stale), `campos_modificados` (merge a nivel de campo), `lote_sync_id` (batch de sync), `checksum` (integridad SHA256) |
| 3 | 🟠 ALTO | **Crear `stock_by_local.py`** | Modelo stock multi-local con campos PN-Counter (`pn_increments`, `pn_decrements` JSONB). Referenciado en MEGA_PLAN, necesario para Fase 1 |
| 4 | 🟠 ALTO | **Crear `eventLog` store en IndexedDB** | Store #12 para event sourcing local. Necesario para sync robusto |
| 5 | 🟠 ALTO | **Crear `deviceFingerprint.js`** | Identificación única de dispositivo para registro en DeviceRegistry |
| 6 | 🟠 ALTO | **Crear `syncEngine.js`** | Motor base push/pull/auto-sync que conecte `offlineSync.js` con los endpoints `/sync` del backend |
| 7 | 🟡 MEDIO | **Agregar `vehicle_id` FK a WorkOrder** | WorkOrder se creó antes que Vehicle. Necesita FK + relationship para vincular OT con vehículo del cliente |
| 8 | 🟡 MEDIO | **Crear `bank_reconciliation.py`** | Modelo para conciliación bancaria. Referenciado en MEGA_PLAN |
| 9 | 🟢 BAJO | **Tests para sync push/pull** | Endpoints sync existen pero no tienen tests. Priorizar después de migración |

---

### FASE 1 — MVP Un Local (depende de Fase 0 completa)

1. **stock_by_local** lógica con PN-Counter (backend service layer)
2. **Sale** extendido con campos AFIP (`cae`, `punto_venta`, `cbte_nro`, `contingency_number`)
3. **Facturación de contingencia** Serie C (backend service)
4. **Stock negativo** alerta pero no bloquea (modificar endpoint de ventas — regla DN-1)
5. **Frontend VentasPage** modo offline completo
6. **Frontend OfflineInvoice** component dedicado
7. **Frontend ConnectionStatus** indicador permanente
8. **Sales outbox** en syncEngine para persistencia offline de ventas

---

### Distribución paralela de trabajo

| Tarea | Dev A (Backend) | Dev B (Frontend) | ¿Paralelizable? |
|---|---|---|---|
| Migración Alembic consolidada | ✅ A | — | ❌ No, bloquea todo lo demás |
| Campos SyncEvent (6 campos) | ✅ A | — | ✅ Sí, antes de migrar |
| stock_by_local model | ✅ A | — | ✅ Sí, antes de migrar |
| vehicle_id en WorkOrder | ✅ A | — | ✅ Sí, antes de migrar |
| eventLog IndexedDB store | — | ✅ B | ✅ Sí (paralelo con A) |
| deviceFingerprint.js | — | ✅ B | ✅ Sí (paralelo con A) |
| syncEngine.js base | — | ✅ B | ✅ Sí (paralelo con A) |
| bank_reconciliation model | ✅ A | — | ✅ Sí, antes de migrar |
| Tests sync endpoints | ✅ A | — | ❌ Después de migración |

> **Nota**: Dev A puede hacer tareas 2, 3, 4, 7, 8 en paralelo y luego ejecutar la migración Alembic una sola vez (tarea 1). Dev B puede trabajar en frontend sin depender de la migración.

---

## SECCIÓN 3: PRIMER DÍA REAL

Paso a paso con comandos exactos. Asume PostgreSQL corriendo en puerto 2048 y venv existente.

---

### 9:00 — Verificar que todo arranca

```powershell
# Terminal 1: Verificar modelos Python
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
python -c "from app.models import *; print(f'Modelos cargados: {len(__all__)} exports')"
# Esperado: "Modelos cargados: 93 exports"

# Terminal 2: Verificar DB existente
$env:PGPASSWORD='MundoOutdoor2026!'
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "\dt public.*" | Select-String "public"
# Esperado: ~30 tablas existentes (las que ya tienen migración)

# Terminal 3: Verificar frontend compila
cd "D:\ERP MUNDO OUTDOOR\erp\frontend"
npx vite build 2>&1 | Select-Object -Last 5
# Esperado: "✓ built in Xs"
```

---

### 9:15 — Agregar campos faltantes a SyncEvent

Editar `erp/backend/app/models/sync.py`. Agregar al modelo `SyncEvent`:

```python
# Campos identificados en sync-gap-analysis.md
idempotency_key: Mapped[Optional[str]] = mapped_column(
    String(128), unique=True, nullable=True, index=True,
    comment="Clave idempotente para prevenir procesamiento duplicado"
)
version: Mapped[int] = mapped_column(
    Integer, default=1,
    comment="Control de concurrencia optimista"
)
version_catalogo: Mapped[Optional[int]] = mapped_column(
    Integer, nullable=True,
    comment="Versión del catálogo al momento del evento — detecta precios stale"
)
campos_modificados: Mapped[Optional[dict]] = mapped_column(
    JSONB, nullable=True,
    comment="Array JSON de nombres de campos modificados — merge a nivel de campo"
)
lote_sync_id: Mapped[Optional[str]] = mapped_column(
    String(36), nullable=True, index=True,
    comment="UUID del lote de sync — agrupa flush batch"
)
checksum: Mapped[Optional[str]] = mapped_column(
    String(64), nullable=True,
    comment="SHA256 para verificación de integridad del payload"
)
```

---

### 9:30 — Crear stock_by_local.py

Crear `erp/backend/app/models/stock_by_local.py`:

```python
"""Stock por local con soporte PN-Counter para CRDT."""
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    ForeignKey, Numeric, DateTime, UniqueConstraint, Index, Integer
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class StockByLocal(Base):
    __tablename__ = "stock_by_local"
    __table_args__ = (
        UniqueConstraint("product_variant_id", "local_id",
                         name="uq_stock_variant_local"),
        Index("ix_stock_local_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variants.id"), nullable=False
    )
    local_id: Mapped[int] = mapped_column(
        ForeignKey("locals.id"), nullable=False
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False
    )
    # ACEPTA NEGATIVO per DN-1
    quantity: Mapped[float] = mapped_column(
        Numeric(14, 2), default=0
    )
    # PN-Counter CRDT fields
    pn_increments: Mapped[Optional[dict]] = mapped_column(
        JSONB, default=dict, comment="{device_id: total_increments}"
    )
    pn_decrements: Mapped[Optional[dict]] = mapped_column(
        JSONB, default=dict, comment="{device_id: total_decrements}"
    )
    last_inventory_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    variant = relationship("ProductVariant", lazy="selectin")
    local = relationship("Local", lazy="selectin")
```

Registrar en `app/models/__init__.py`:
```python
from .stock_by_local import StockByLocal
# Agregar "StockByLocal" al __all__
```

---

### 9:45 — Agregar vehicle_id a WorkOrder

Editar `erp/backend/app/models/work_order.py`:

```python
# Agregar al modelo WorkOrder:
vehicle_id: Mapped[Optional[int]] = mapped_column(
    ForeignKey("vehicles.id"), nullable=True
)
vehicle = relationship("Vehicle", lazy="selectin")
```

---

### 10:00 — Migración Alembic CONSOLIDADA

```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate

# Generar migración con todos los cambios pendientes
alembic revision --autogenerate -m "fase0 sync crm ot afip stock_local integrations"

# IMPORTANTE: Revisar el archivo generado antes de aplicar
# Verificar que incluye CREATE TABLE para: customers, customer_companies,
# vehicles, account_movements, sync_events, device_registry, sync_conflicts,
# afip_configs, afip_queue, storage_files, whatsapp_messages,
# mercadopago_configs, mercadopago_transactions, work_orders,
# work_order_items, work_order_history, work_order_checklists,
# mechanic_rates, stock_by_local

# Aplicar migración
alembic upgrade head
```

---

### 10:15 — Verificar tablas creadas

```powershell
$env:PGPASSWORD='MundoOutdoor2026!'
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "\dt public.*" | Measure-Object -Line
# Esperado: ~50 tablas (las ~30 existentes + ~18 nuevas)

# Verificar las tablas críticas específicamente
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'sync_events', 'device_registry', 'sync_conflicts',
    'customers', 'customer_companies', 'vehicles', 'account_movements',
    'work_orders', 'work_order_items',
    'afip_configs', 'afip_queue',
    'stock_by_local',
    'whatsapp_messages', 'mercadopago_configs', 'mercadopago_transactions',
    'storage_files'
)
ORDER BY table_name;
"
# Esperado: TODAS las 16 tablas listadas

# Verificar campos nuevos en sync_events
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sync_events'
AND column_name IN ('idempotency_key','version','version_catalogo','campos_modificados','lote_sync_id','checksum')
ORDER BY column_name;
"
# Esperado: 6 columnas listadas

# Verificar vehicle_id en work_orders
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'work_orders' AND column_name = 'vehicle_id';
"
# Esperado: vehicle_id presente
```

---

### 10:30 — Levantar backend y probar

```powershell
# Terminal 1: Levantar backend
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```powershell
# Terminal 2: Probar endpoints

# Health check
Invoke-RestMethod http://localhost:8000/api/v1/system/health
# Esperado: status = "ok", database = "connected"

# Login para obtener token
$body = @{ username = "admin"; password = "admin" } | ConvertTo-Json
$login = Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/v1/auth/login `
    -ContentType "application/json" -Body $body
$token = $login.access_token
$headers = @{ Authorization = "Bearer $token" }

# Test: Registrar dispositivo sync
$device = @{
    device_id = "test-pc-001"
    name = "PC Desarrollo"
    device_type = "PC"
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/v1/sync/register-device `
    -ContentType "application/json" -Headers $headers -Body $device
# Esperado: objeto con id, name, device_type, company_id

# Test: Listar clientes (debería estar vacío)
Invoke-RestMethod -Uri http://localhost:8000/api/v1/customers -Headers $headers
# Esperado: lista vacía []

# Test: Verificar Swagger docs
Start-Process "http://localhost:8000/docs"
# Esperado: Swagger UI con todos los 35 routers visibles
```

---

### 11:00 — Qué debería verse si todo está bien

```
Backend:     "INFO: Uvicorn running on http://0.0.0.0:8000"
Health:      {"status":"ok","database":"connected","api_version":"v1"}
Device:      {"id":"test-pc-001","name":"PC Desarrollo","device_type":"PC","company_id":...}
PostgreSQL:  ~50 tablas (las existentes + 16-18 nuevas)
sync_events: 6 columnas nuevas presentes (idempotency_key, version, etc.)
work_orders: columna vehicle_id presente
Frontend:    "✓ built in Xs"
Swagger:     35 routers documentados en /docs
```

### Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ModuleNotFoundError` al importar modelos | Falta import en `__init__.py` | Verificar que `stock_by_local` está importado y en `__all__` |
| Alembic `Target database is not up to date` | Migraciones no lineales | `alembic stamp head` y luego generar nueva migración |
| Alembic `Can't locate revision` | Branch de migración rota | `alembic history` para ver el árbol, merge si hay branches |
| `relation "vehicles" does not exist` | Orden de creación de tablas | Verificar que Customer/Vehicle se importa antes de WorkOrder en `__init__.py` |
| Puerto 2048 rechaza conexión | PostgreSQL no está corriendo | `pg_isready -h localhost -p 2048` y levantar el servicio |
| Frontend no compila | Dependencias desactualizadas | `cd erp/frontend && npm install` |

---

> **Próximos pasos después del Día 1**: Con las tablas creadas y verificadas, Dev A puede empezar tests de sync endpoints y el service layer de stock_by_local. Dev B puede empezar `deviceFingerprint.js`, `syncEngine.js`, y el store `eventLog` en IndexedDB sin depender del backend.

---

## DECISIÓN DE ARQUITECTURA (Abril 2026)

### Situación: dos subsistemas paralelos

| Subsistema | Stack | Offline | Multi-empresa | Sync |
|---|---|---|---|---|
| `eurotaller-cassano/` (Copilot B) | React 18 + TS + Supabase | ❌ | ❌ | ❌ |
| `erp/backend/` + `erp/frontend/` (Copilot C) | Python + FastAPI + React 19 | ✅ | ✅ | ✅ |

### Opciones evaluadas

| Opción | Veredicto | Razón principal |
|---|---|---|
| A: Supabase como DB central | ❌ Descartada | Supabase NO soporta offline-first |
| B: B como frontend, C como backend | ⚠️ Costosa | Migrar 40 archivos Supabase→API ≈ reescribir |
| C: Supabase reemplaza backend C | ❌ Descartada | Destruye sync engine + viola offline + multi-empresa |
| **D: Absorber diseño de B en stack C** | ✅ **ELEGIDA** | Más rápido reconstruir 6 páginas que migrar 40 archivos |

### Decisión: OPCIÓN D

**Se toma de B**: Diseño de UX de OT, tipos TypeScript como referencia, validaciones argentinas (CUIT, patente, moneda), campos de checklist vehicular.

**Se descarta de B**: Supabase, Auth, RLS, queries directas, React 18, Vite 6, Tailwind 3, Zustand.

**eurotaller-cassano/ queda como referencia de diseño**, no se ejecuta ni se despliega.

> Documento completo: `docs/DECISION_ARQUITECTURA.md`
