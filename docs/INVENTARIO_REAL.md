# INVENTARIO REAL — ERP Mundo Outdoor

> **Fecha**: Abril 2026  
> **Propósito**: Fotografía exacta del sistema tal como existe HOY en el código.  
> **Fuente**: Lectura directa de `app/models/`, `app/api/v1/`, `erp/frontend/src/`, `eurotaller-cassano/src/`  
> **Nota**: No incluye intenciones ni documentos. Solo lo que existe en archivos `.py` y `.jsx/.tsx`.

---

## SECCIÓN 1 — MÓDULOS FUNCIONALES REALES

### 1. Auth / Seguridad
- **Archivos**: `app/models/user.py`, `app/api/v1/auth.py`, `app/api/v1/users.py`
- **Qué hace**: Login JWT (8h), `/me`, cambio de password, CRUD usuarios con 12 roles (`MEGAADMIN`, `SUPERADMIN`, `ADMIN`, `COMPRAS`, `ADMINISTRACION`, `GESTION_PAGOS`, `LOCAL`, `VENDEDOR`, `DEPOSITO`, `SUPERVISOR`, `MONITOREO`, `TRANSPORTE`). RBAC vía `require_roles()` en deps.
- **Estado**: **completo**
- **Variantes por rubro**: No aplica — los roles son transversales a todos los rubros.

---

### 2. Empresas / Multi-tenant
- **Archivos**: `app/models/company.py`, `app/api/v1/companies.py`, `app/api/v1/branding.py`, `app/api/v1/templates.py`
- **Qué hace**: CRUD de empresas con branding white-label (nombre, colores, logo, favicon, icono SVG). Soporte de 9 tipos de industria (`INDUMENTARIA`, `KIOSCO`, `MECANICO`, `DEPOSITO`, `RESTAURANTE`, `FERRETERIA`, `FARMACIA`, `LIBRERIA`, `OTRO`). Templates predefinidos por industria. Endpoint `/companies/me` para empresa del usuario logueado.
- **Estado**: **completo**
- **Variantes por rubro**: `IndustryType` enum define el rubro. Los templates de módulos cambian según la industria seleccionada.

---

### 3. Catálogo — Productos
- **Archivos**: `app/models/product.py`, `app/api/v1/products.py`
- **Qué hace**: CRUD de productos con variantes talle/color/SKU/barcode. Importación masiva desde Excel (`/import-excel`). Toggle activo/inactivo.
- **Estado**: **completo**
- **Variantes por rubro**: El modelo `ProductVariant` usa campos `size` y `color` — pensado para indumentaria. Para otros rubros (kiosco, ferretería) los mismos campos se reutilizan para otras dimensiones, pero no hay campos específicos como `lot_number` o `expiry_date` para vencimientos.

---

### 4. Catálogo — Proveedores
- **Archivos**: `app/models/provider.py`, `app/models/provider_contact.py`, `app/api/v1/providers.py`
- **Qué hace**: CRUD proveedores con datos fiscales/Tango (CUIT, condición IVA, retenciones por tipo), múltiples contactos, logo, prefijo de pedido. Export CSV. Ranking de proveedores. Historia completa del proveedor con export.
- **Estado**: **completo**
- **Variantes por rubro**: No, modelo genérico.

---

### 5. Listas de Precios
- **Archivos**: `app/models/price_list.py`, `app/api/v1/price_lists.py`
- **Qué hace**: Importación de listas de precios en Excel por proveedor/temporada. Búsqueda por código/descripción. Bulk import de ítems.
- **Estado**: **completo**
- **Variantes por rubro**: No, genérico.

---

### 6. Locales / Sucursales
- **Archivos**: `app/models/local.py`, `app/api/v1/locals.py`
- **Qué hace**: CRUD de locales/sucursales. Campo `code` único por empresa.
- **Estado**: **completo**
- **Variantes por rubro**: No.

---

### 7. Módulo Compras — Notas de Pedido (sistema nuevo)
- **Archivos**: `app/models/purchase_order.py`, `app/api/v1/purchase_orders.py`
- **Qué hace**: Notas de pedido a proveedor con workflow `BORRADOR→ENVIADO→RECIBIDO→COMPLETADO|ANULADO`. Tipos: PRECOMPRA / REPOSICION / CAMBIO. Alertas de reposición. Vista integrada (resumen). Export. Aceptar diferencia de recepción (ANP). Reabrir nota. Adjunto PDF/Excel.
- **Estado**: **completo**
- **Variantes por rubro**: `PurchaseOrderType` con PRECOMPRA aplica principalmente a indumentaria (colecciones). Genérico para el resto.

---

### 8. Módulo Compras — Facturas de Proveedor
- **Archivos**: `app/models/purchase_invoice.py`, `app/api/v1/purchase_invoices.py`
- **Qué hace**: Facturas/remitos de compra vinculados a notas de pedido. Semáforo de aprobación en 2 niveles (LOCAL → ADMIN). Sistema de colores `ROJO/AMARILLO/VERDE` basado en estado de RV y confirmaciones. Cruce automático de facturas. Confirmación de ingreso con foto. Parser PDF para carga automática de items.
- **Estado**: **completo**
- **Variantes por rubro**: El semáforo y workflow de RV (remito de venta) es específico de indumentaria/distribución. Genérico para otros rubros.

---

### 9. Módulo Compras — Ingreso de Mercadería (sistema viejo)
- **Archivos**: `app/models/ingreso.py`, `app/api/v1/ingresos.py`
- **Qué hace**: Remitos/facturas de compra (sistema anterior a `purchase_orders`). Workflow `BORRADOR→CONFIRMADO→ANULADO`. Tipos REMITO/FACTURA. Vinculable a un `Pedido` (sistema viejo).
- **Estado**: **completo** — pero es el sistema legado. El nuevo sistema usa `purchase_orders/purchase_invoices`.
- **Variantes por rubro**: No.

---

### 10. Módulo Compras — Pedidos Viejos
- **Archivos**: `app/models/pedido.py`, `app/api/v1/pedidos.py`
- **Qué hace**: Notas de pedido a proveedor del sistema anterior. Workflow `BORRADOR→ENVIADO→RECIBIDO_PARCIAL→RECIBIDO→ANULADO`. Vista integrada. 
- **Estado**: **parcial** — sistema legado en transición. El frontend `PedidosPage.jsx` tiene partes marcadas como "en construcción".
- **Variantes por rubro**: No.

---

### 11. Gestión de Pagos
- **Archivos**: `app/models/payment.py`, `app/api/v1/payments.py`
- **Qué hace**: Comprobantes/minutas de pago con retenciones (`IIBB`, `Ganancias`, `IVA`, `SUSS`). Cuentas bancarias por proveedor (CBU, alias). Notas de crédito. Vínculo M2M entre pagos y facturas. Métodos: transferencia, cheque, efectivo, depósito.
- **Estado**: **completo**
- **Variantes por rubro**: Las retenciones impositivas son específicas del contexto argentino, no del rubro.

---

### 12. Stock / Inventario
- **Archivos**: `app/models/stock_movement.py`, `app/api/v1/stock.py`
- **Qué hace**: Consulta de inventario con filtros. Export. Summary de totales. Ajustes manuales. Historial de movimientos (INGRESO/EGRESO/AJUSTE/TRANSFERENCIA).
- **Estado**: **parcial** — stock global por variante funciona. Falta `stock_by_local` (stock independiente por sucursal con PN-Counter CRDT, requerido por MEGA_PLAN Fase 1).
- **Variantes por rubro**: Para indumentaria: filtra por talle/color. Para otros rubros el modelo es genérico.

---

### 13. Ventas / Facturación
- **Archivos**: `app/models/sale.py`, `app/api/v1/sales.py`
- **Qué hace**: CRUD comprobantes (FACTURA_A, FACTURA_B, TICKET, NOTA_CREDITO). Workflow `BORRADOR→EMITIDA→PAGADA→ANULADA`. Líneas de detalle con descuentos.
- **Estado**: **parcial** — flujo de negocio completo. Faltan campos AFIP (`cae`, `cae_vencimiento`, `punto_venta`, `cbte_nro`, `cbte_tipo`). Sin integración AFIP real.
- **Variantes por rubro**: Aplica a todos los rubros que facturen.

---

### 14. Transporte / Logística
- **Archivos**: `app/models/transport.py`, `app/api/v1/transports.py`
- **Qué hace**: CRUD transportistas. Envíos con tracking (número de seguimiento, origen, destino local, fechas envío/llegada, estado, foto). Vinculable a facturas de proveedor.
- **Estado**: **completo**
- **Variantes por rubro**: No, genérico.

---

### 15. Kanban (TrellOutdoor)
- **Archivos**: `app/models/kanban.py`, `app/api/v1/kanban.py`
- **Qué hace**: Boards de tareas con columnas y tarjetas. Prioridades (BAJA/MEDIA/ALTA/URGENTE). Mover tarjetas entre columnas. Completar tarjetas. Fechas límite. Labels. Asignación a usuarios.
- **Estado**: **completo**
- **Variantes por rubro**: No, herramienta interna transversal.

---

### 16. Notificaciones / Auditoría
- **Archivos**: `app/models/notification.py`, `app/api/v1/notifications.py`
- **Qué hace**: Notificaciones internas (INFO/ALERTA/URGENTE) entre usuarios y roles. Marcado como leída/no leída. Contador de no leídas. Audit log de acciones sobre entidades. Vinculable a facturas/pedidos/eventos de sync.
- **Estado**: **completo**
- **Variantes por rubro**: No.

---

### 17. Órdenes de Trabajo (OT)
- **Archivos**: `app/models/work_order.py`, `app/api/v1/work_orders.py`, `erp/frontend/src/pages/taller/`
- **Qué hace**: Gestión completa de OTs con 10 estados (`RECEPCION→DIAGNOSTICO→PRESUPUESTO→APROBACION_CLIENTE→EN_EJECUCION→CONTROL_CALIDAD→ENTREGA→FACTURADO→CERRADO|CANCELADO`). Items de 3 tipos: REPUESTO (con variante), MANO_DE_OBRA (con horas/tarifa), SERVICIO_EXTERNO. Checklist de control de calidad. Historial de cambios de estado. Presupuesto PDF. Aprobación/rechazo. Tarifas por mecánico. Datos de vehículo en cabecera. Sync offline con `offline_id`.
- **Estado**: **completo backend**, **parcial frontend** — el ERP principal tiene `OTListPage` y `OTDetailPage` pero no hay página de dashboard del taller ni integración completa con CRM/Vehículos. Eurotaller-cassano tiene frontend más completo.
- **Variantes por rubro**: Diseñado para `MECANICO`. Adaptable a otros rubros de servicio.

---

### 18. CRM / Clientes
- **Archivos**: `app/models/customer.py`, `app/api/v1/customers.py`
- **Qué hace**: Clientes con CUIT/DNI como identificador universal cross-empresa. Relación comercial por empresa (`CustomerCompany`) con límite de crédito, plazo de pago, descuento, saldo cuenta corriente. Vehículos del cliente (patente, marca, modelo, año, VTV, seguro, km). Movimientos de cuenta corriente. Historial de pagos.
- **Estado**: **completo backend** — modelos y endpoints completos. **Sin migración Alembic aplicada** (tablas no creadas en DB). Frontend: solo existe `ClientesTallerPage.jsx` (4.6KB, básico).
- **Variantes por rubro**: `extra_data JSONB` en `CustomerCompany` para datos ad-hoc por industria.

---

### 19. Sincronización Offline / Event Sourcing
- **Archivos**: `app/models/sync.py`, `app/api/v1/sync.py`
- **Qué hace**: Event Store inmutable (append-only) con secuencia de servidor. Registro de dispositivos. Detección y registro de conflictos. Bootstrap de catálogos. Delta sync incremental. Cola de reintentos con backoff exponencial. Storage abstracto (local/S3/Cloudflare). AFIP queue con contingencia. WhatsApp message queue (stub). MercadoPago config y transacciones (stub).
- **Estado**: **completo backend** — 12 endpoints sync + 5 endpoints storage. **Sin migración Alembic**. Sin servicios de negocio reales para AFIP/WhatsApp/MercadoPago. Frontend sync engine incompleto (faltan `eventSourcing.js`, `deviceFingerprint.js`, `syncEngine.js`).
- **Variantes por rubro**: No aplica directamente — infraestructura transversal.

---

### 20. Sistema de Módulos / Planes
- **Archivos**: `app/models/module.py`, `app/models/plan.py`, `app/api/v1/modules.py`, `app/api/v1/plans.py`
- **Qué hace**: Catálogo de 16 módulos activables por empresa (`COMPRAS`, `PAGOS`, `STOCK`, `VENTAS`, `TRANSPORTE`, `KANBAN`, `REPORTES`, `SOCIOS`, `CATALOGO`, `LOCALES`, `USUARIOS`, `MONITOREO`, `OT`, `SYNC`, `CRM`, `COMPLETADOS`). Toggle por empresa. Planes de licencia (FREE/STARTER/PRO/ENTERPRISE) con límites de usuarios/locales/productos. Suscripciones.
- **Estado**: **completo**
- **Variantes por rubro**: Los módulos se activan/desactivan según el rubro. Ej: `OT` solo para `MECANICO`.

---

### 21. Mega Admin / Onboarding
- **Archivos**: `app/api/v1/mega.py`, `app/api/v1/onboarding.py`
- **Qué hace**: Panel MEGAADMIN con stats de plataforma. CRUD empresas con módulos y branding. Impersonación de usuarios. Creación completa de empresa en un paso. Quick setup de empresa nueva. Export/import de configuración de empresa. Health check por empresa.
- **Estado**: **completo**
- **Variantes por rubro**: No.

---

### 22. Socios Montagne
- **Archivos**: `app/api/v1/socios.py`
- **Qué hace**: Gestión de socios de la franquicia Montagne. Bot de seguimiento. Envío de mensajes WhatsApp (integración WhatsApp Web via QR). Estado del bot, log de actividad, configuración por local. Envío masivo o individual.
- **Estado**: **completo** — depende de WhatsApp Web (no API oficial). Frágil por naturaleza.
- **Variantes por rubro**: Específico de `INDUMENTARIA` / franquicias Montagne.

---

### 23. Comisiones
- **Archivos**: `app/api/v1/comisiones.py`
- **Qué hace**: Cálculo de comisiones por ventas agrupado por vendedor. Detalle por vendedor con filtrado por fechas.
- **Estado**: **completo** — pero sin modelo propio, calcula desde `sales`.
- **Variantes por rubro**: Aplica a rubros con fuerza de ventas.

---

### 24. Utilidades / Infraestructura
- **Archivos**: `app/api/v1/system.py`, `app/api/v1/improvement_notes.py`, `app/api/v1/pdf_parser.py`, `app/api/v1/sql_server.py`, `app/api/v1/legacy.py`, `app/api/v1/menu_config.py`, `app/api/v1/export_utils.py`
- **Qué hace**: Monitoreo (CPU/RAM/DB/API). Notas de mejora con imágenes y prioridades. Parser de PDFs de facturas (detección automática de ítems). Bridge a SQL Server legacy (búsqueda RV, precios, artículos). Bridge a sistema CONTROL REMITOS legado (búsqueda RV, precios, stock, ventas, stats). Configurador de menú con SSE. Helpers de exportación CSV/Excel.
- **Estado**: **completo**
- **Variantes por rubro**: `legacy.py` y `sql_server.py` son específicos de Mundo Outdoor (conectan al sistema Tango/SQL Server anterior).

---

## SECCIÓN 2 — ENDPOINTS DISPONIBLES

> Prefijo base: `/api/v1`  
> Total: ~195 endpoints en 35 routers + 1 health check raíz.

### Auth (`/auth`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/auth/login` | Login con usuario/password → JWT |
| GET | `/auth/me` | Perfil del usuario autenticado |
| PUT | `/auth/me/password` | Cambiar contraseña propia |

### Companies (`/companies`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/companies/me` | Empresa del usuario logueado |
| PUT | `/companies/me` | Actualizar empresa propia |
| GET | `/companies` | Listar todas (SUPERADMIN) |
| POST | `/companies` | Crear empresa |
| GET | `/companies/{id}` | Detalle empresa |
| PUT | `/companies/{id}` | Actualizar empresa |
| DELETE | `/companies/{id}` | Eliminar empresa |

### Users (`/users`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/users/` | Listar usuarios de la empresa |
| GET | `/users/{id}` | Detalle usuario |
| POST | `/users/` | Crear usuario |
| PUT | `/users/{id}` | Actualizar usuario |
| DELETE | `/users/{id}` | Eliminar usuario |
| PATCH | `/users/{id}/toggle` | Activar/desactivar usuario |

### Locals (`/locals`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/locals/` | Listar locales |
| POST | `/locals/` | Crear local |
| PUT | `/locals/{id}` | Actualizar local |
| DELETE | `/locals/{id}` | Eliminar local |

### Providers (`/providers`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/providers/` | Listar proveedores |
| GET | `/providers/export` | Export CSV |
| POST | `/providers/` | Crear proveedor |
| GET | `/providers/ranking` | Ranking por volumen |
| GET | `/providers/{id}/contacts` | Contactos del proveedor |
| POST | `/providers/{id}/contacts` | Agregar contacto |
| PUT | `/providers/{id}/contacts/{cid}` | Actualizar contacto |
| DELETE | `/providers/{id}/contacts/{cid}` | Eliminar contacto |
| PUT | `/providers/{id}` | Actualizar proveedor |
| DELETE | `/providers/{id}` | Eliminar proveedor |
| GET | `/providers/{id}/historia` | Historia completa del proveedor |
| GET | `/providers/{id}/historia/export` | Export historia del proveedor |

### Products (`/products`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/products/` | Listar productos con variantes |
| GET | `/products/{id}` | Detalle producto |
| POST | `/products/` | Crear producto |
| PUT | `/products/{id}` | Actualizar producto |
| DELETE | `/products/{id}` | Eliminar producto |
| PATCH | `/products/{id}/toggle` | Activar/desactivar |
| POST | `/products/{id}/variants` | Agregar variante |
| PUT | `/products/{id}/variants/{vid}` | Actualizar variante |
| DELETE | `/products/{id}/variants/{vid}` | Eliminar variante |
| POST | `/products/import-excel` | Importar masivo desde Excel |

### Ingresos (`/ingresos`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/ingresos/` | Listar ingresos |
| GET | `/ingresos/{id}` | Detalle ingreso |
| POST | `/ingresos/` | Crear ingreso borrador |
| PUT | `/ingresos/{id}` | Actualizar ingreso |
| POST | `/ingresos/{id}/items` | Agregar ítem |
| DELETE | `/ingresos/{id}/items/{iid}` | Eliminar ítem |
| POST | `/ingresos/{id}/confirmar-recepcion` | Confirmar recepción |
| POST | `/ingresos/{id}/confirm` | Confirmar ingreso → mueve stock |
| POST | `/ingresos/{id}/cancel` | Anular ingreso |
| DELETE | `/ingresos/{id}` | Eliminar borrador |

### Pedidos Viejos (`/pedidos`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/pedidos` | Listar pedidos |
| POST | `/pedidos` | Crear pedido borrador |
| GET | `/pedidos/{id}` | Detalle pedido |
| PUT | `/pedidos/{id}` | Actualizar pedido |
| POST | `/pedidos/{id}/items` | Agregar ítem |
| DELETE | `/pedidos/{id}/items/{iid}` | Eliminar ítem |
| PATCH | `/pedidos/{id}/send` | Enviar pedido |
| PATCH | `/pedidos/{id}/receive` | Marcar recibido |
| PATCH | `/pedidos/{id}/cancel` | Anular pedido |
| DELETE | `/pedidos/{id}` | Eliminar borrador |
| GET | `/pedidos/vista-integrada/all` | Vista integrada de todos |

### Sales (`/sales`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/sales` | Listar ventas |
| POST | `/sales` | Crear venta borrador |
| GET | `/sales/{id}` | Detalle venta |
| PUT | `/sales/{id}` | Actualizar venta |
| POST | `/sales/{id}/items` | Agregar ítem |
| DELETE | `/sales/{id}/items/{iid}` | Eliminar ítem |
| PATCH | `/sales/{id}/emit` | Emitir comprobante |
| PATCH | `/sales/{id}/pay` | Marcar pagada |
| PATCH | `/sales/{id}/cancel` | Anular venta |
| DELETE | `/sales/{id}` | Eliminar borrador |

### Stock (`/stock`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/stock` | Listar inventario con filtros |
| GET | `/stock/export` | Export stock CSV |
| GET | `/stock/summary` | Resumen totales de stock |
| POST | `/stock/adjust` | Ajuste manual de stock |
| GET | `/stock/movements` | Historial de movimientos |

### Purchase Orders (`/purchase-orders`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/purchase-orders/` | Listar notas de pedido |
| GET | `/purchase-orders/export` | Export CSV |
| GET | `/purchase-orders/stats` | Estadísticas |
| GET | `/purchase-orders/alertas-reposicion` | Alertas de reposición |
| POST | `/purchase-orders/{id}/accept-difference` | Aceptar diferencia (ANP) |
| POST | `/purchase-orders/{id}/reopen` | Reabrir nota |
| GET | `/purchase-orders/vista-integrada` | Vista resumen integrada |
| GET | `/purchase-orders/{id}` | Detalle nota |
| POST | `/purchase-orders/` | Crear nota borrador |
| PUT | `/purchase-orders/{id}` | Actualizar nota |
| POST | `/purchase-orders/{id}/send` | Enviar al proveedor |
| POST | `/purchase-orders/{id}/receive` | Registrar recepción |
| POST | `/purchase-orders/{id}/complete` | Completar nota |
| POST | `/purchase-orders/{id}/cancel` | Anular nota |
| POST | `/purchase-orders/{id}/items` | Agregar ítem |
| DELETE | `/purchase-orders/{id}/items/{iid}` | Eliminar ítem |

### Purchase Invoices (`/purchase-invoices`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/purchase-invoices/` | Listar facturas |
| GET | `/purchase-invoices/export` | Export CSV |
| GET | `/purchase-invoices/stats` | Estadísticas |
| POST | `/purchase-invoices/{id}/confirm-local` | Confirmar recepción (LOCAL) |
| POST | `/purchase-invoices/{id}/confirm-admin` | Confirmar verificación (ADMIN) |
| GET | `/purchase-invoices/{id}` | Detalle factura |
| POST | `/purchase-invoices/` | Crear factura |
| PUT | `/purchase-invoices/{id}` | Actualizar factura |
| POST | `/purchase-invoices/{id}/confirm-ingreso` | Confirmar ingreso de mercadería |
| POST | `/purchase-invoices/{id}/auto-link` | Auto-vincular con RV |
| POST | `/purchase-invoices/{id}/set-status` | Cambiar estado manualmente |
| GET | `/purchase-invoices/cruce` | Vista cruce facturas |
| DELETE | `/purchase-invoices/{id}` | Eliminar factura |

### Payments (`/payments`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/payments/bank-accounts/` | Listar cuentas bancarias |
| POST | `/payments/bank-accounts/` | Crear cuenta bancaria |
| DELETE | `/payments/bank-accounts/{id}` | Eliminar cuenta bancaria |
| GET | `/payments/vouchers/` | Listar comprobantes de pago |
| GET | `/payments/vouchers/{id}` | Detalle comprobante |
| POST | `/payments/vouchers/` | Crear comprobante de pago |
| POST | `/payments/vouchers/{id}/mark-paid` | Marcar como pagado |
| POST | `/payments/vouchers/{id}/undo` | Deshacer pago |
| GET | `/payments/credit-notes/` | Listar notas de crédito |
| POST | `/payments/credit-notes/` | Crear nota de crédito |
| POST | `/payments/credit-notes/{id}/apply` | Aplicar nota de crédito |

### Transports (`/transports`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/transports/` | Listar transportistas |
| POST | `/transports/` | Crear transportista |
| PUT | `/transports/{id}` | Actualizar transportista |
| GET | `/transports/shipments/` | Listar envíos |
| GET | `/transports/shipments/{id}` | Detalle envío |
| POST | `/transports/shipments/` | Crear envío |
| PUT | `/transports/shipments/{id}` | Actualizar envío |
| POST | `/transports/shipments/{id}/delivered` | Marcar como entregado |

### Kanban (`/kanban`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/kanban/boards/` | Listar boards |
| GET | `/kanban/boards/{id}` | Detalle board |
| POST | `/kanban/boards/` | Crear board |
| DELETE | `/kanban/boards/{id}` | Eliminar board |
| POST | `/kanban/boards/{id}/columns/` | Agregar columna |
| DELETE | `/kanban/columns/{id}` | Eliminar columna |
| POST | `/kanban/cards/` | Crear tarjeta |
| PUT | `/kanban/cards/{id}` | Actualizar tarjeta |
| POST | `/kanban/cards/{id}/move` | Mover tarjeta a otra columna |
| POST | `/kanban/cards/{id}/complete` | Completar tarjeta |
| DELETE | `/kanban/cards/{id}` | Eliminar tarjeta |

### Notifications (`/notifications`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/notifications/` | Listar notificaciones del usuario |
| GET | `/notifications/unread-count` | Contador no leídas |
| POST | `/notifications/{id}/read` | Marcar como leída |
| POST | `/notifications/read-all` | Marcar todas como leídas |
| POST | `/notifications/` | Crear notificación |
| GET | `/notifications/audit/` | Audit log de acciones |

### Price Lists (`/price-lists`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/price-lists/` | Listar archivos de listas |
| GET | `/price-lists/{id}` | Detalle archivo |
| POST | `/price-lists/` | Subir nuevo archivo Excel |
| DELETE | `/price-lists/{id}` | Eliminar archivo |
| GET | `/price-lists/{id}/items` | Ítems del archivo |
| POST | `/price-lists/{id}/items/bulk` | Importar ítems en bulk |
| POST | `/price-lists/search` | Buscar en todas las listas |

### Work Orders (`/work-orders`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/work-orders` | Listar OTs con filtros |
| POST | `/work-orders` | Crear OT |
| GET | `/work-orders/dashboard` | Dashboard del taller |
| GET | `/work-orders/{id}` | Detalle OT |
| PUT | `/work-orders/{id}` | Actualizar OT |
| DELETE | `/work-orders/{id}` | Eliminar OT |
| PATCH | `/work-orders/{id}/advance` | Avanzar al siguiente estado |
| PATCH | `/work-orders/{id}/cancel` | Cancelar OT |
| PATCH | `/work-orders/{id}/reopen` | Reabrir OT cancelada |
| GET | `/work-orders/{id}/quote` | Obtener presupuesto |
| POST | `/work-orders/{id}/send-quote` | Enviar presupuesto al cliente |
| PATCH | `/work-orders/{id}/approve` | Aprobar presupuesto |
| PATCH | `/work-orders/{id}/reject` | Rechazar presupuesto |
| POST | `/work-orders/{id}/items` | Agregar ítem |
| PUT | `/work-orders/items/{id}` | Actualizar ítem |
| DELETE | `/work-orders/items/{id}` | Eliminar ítem |
| POST | `/work-orders/{id}/checklists` | Agregar ítem checklist |
| PATCH | `/work-orders/{id}/checklists/{cid}` | Marcar checklist |
| DELETE | `/work-orders/{id}/checklists/{cid}` | Eliminar checklist |
| GET | `/work-orders/vehicles/{plate}/history` | Historial OT por patente |
| GET | `/work-orders/mechanic-rates` | Listar tarifas mecánicos |
| POST | `/work-orders/mechanic-rates` | Crear tarifa mecánico |
| PUT | `/work-orders/mechanic-rates/{id}` | Actualizar tarifa |
| DELETE | `/work-orders/mechanic-rates/{id}` | Eliminar tarifa |
| POST | `/work-orders/sync` | Sync offline OTs |

### Customers (`/customers`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/customers/search` | Búsqueda por nombre/CUIT |
| GET | `/customers/` | Listar clientes paginado |
| POST | `/customers/` | Crear cliente |
| GET | `/customers/{id}` | Detalle cliente |
| PUT | `/customers/{id}` | Actualizar cliente |
| DELETE | `/customers/{id}` | Eliminar cliente |
| POST | `/customers/{id}/companies` | Vincular cliente a empresa |
| PUT | `/customers/{id}/companies/{cid}` | Actualizar relación comercial |
| GET | `/customers/{id}/account/{cid}` | Resumen cuenta corriente |
| GET | `/customers/{id}/account/{cid}/statement` | Movimientos cuenta corriente |
| POST | `/customers/{id}/account/{cid}/payment` | Registrar pago en cuenta |
| GET | `/customers/{id}/vehicles` | Vehículos del cliente |
| POST | `/customers/{id}/vehicles` | Agregar vehículo |
| PUT | `/customers/{id}/vehicles/{vid}` | Actualizar vehículo |
| GET | `/customers/vehicles/{plate}/history` | Historial por patente |

### System (`/system`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/system/sidebar-counts` | Contadores para sidebar |
| GET | `/system/health` | Health check con métricas DB |
| GET | `/system/metrics` | CPU, RAM, tiempos de API |
| GET | `/system/version` | Versión del backend |
| GET | `/system/download/{filename}` | Descargar archivo generado |

### Modules (`/modules`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/modules` | Módulos activos de la empresa |
| PATCH | `/modules/{slug}` | Activar/desactivar módulo |
| POST | `/modules/seed` | Inicializar módulos por defecto |

### Plans (`/plans`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/plans/` | Listar planes disponibles |
| POST | `/plans/` | Crear plan |
| PATCH | `/plans/{id}` | Actualizar plan |
| DELETE | `/plans/{id}` | Eliminar plan |
| POST | `/plans/subscribe` | Suscribir empresa a plan |
| GET | `/plans/subscription/{company_id}` | Suscripción actual de empresa |
| PATCH | `/plans/subscription/{id}` | Actualizar suscripción |

### Branding (`/branding`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/branding/` | Datos de branding de la empresa |
| GET | `/branding/icon/{company_id}` | Icono de empresa (SVG/PNG) |

### Templates (`/templates`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/templates/modules` | Presets de módulos por tipo |
| GET | `/templates/industries` | Templates por industria |
| GET | `/templates/industries/{type}` | Template específico de industria |

### Onboarding (`/onboarding`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/onboarding/quick-setup` | Setup rápido de empresa nueva |
| GET | `/onboarding/export/{company_id}` | Exportar configuración empresa |
| GET | `/onboarding/health/{company_id}` | Health check de empresa |

### Comisiones (`/comisiones`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/comisiones/resumen` | Resumen comisiones por vendedor |
| GET | `/comisiones/detalle/{vendedor}` | Detalle de un vendedor |

### Improvement Notes (`/improvement-notes`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/improvement-notes/` | Listar notas de mejora |
| POST | `/improvement-notes/` | Crear nota de mejora |
| PUT | `/improvement-notes/{id}` | Actualizar nota |
| DELETE | `/improvement-notes/{id}` | Eliminar nota |
| GET | `/improvement-notes/export/markdown` | Exportar en Markdown |

### Socios Montagne (`/socios`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/socios/estado` | Estado del bot de socios |
| GET | `/socios/log` | Log de actividad |
| GET | `/socios/locales-config` | Configuración por local |
| POST | `/socios/actualizar` | Actualizar datos socios |
| POST | `/socios/enviar/{local}` | Enviar mensaje a un local |
| POST | `/socios/enviar-todos` | Envío masivo |
| GET | `/socios/wa/status` | Estado de WhatsApp Web |
| POST | `/socios/wa/start` | Iniciar sesión WhatsApp |
| POST | `/socios/wa/stop` | Detener sesión WhatsApp |
| GET | `/socios/wa/qr` | QR para autenticar WA |

### Mega Admin (`/mega`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/mega/stats` | Estadísticas de plataforma |
| GET | `/mega/companies` | Listar todas las empresas |
| GET | `/mega/companies/{id}` | Detalle empresa |
| POST | `/mega/companies/create-full` | Crear empresa completa en un paso |
| PATCH | `/mega/companies/{id}` | Actualizar empresa |
| PATCH | `/mega/companies/{id}/toggle` | Activar/desactivar empresa |
| PATCH | `/mega/companies/{id}/modules` | Actualizar módulos de empresa |
| POST | `/mega/impersonate/{user_id}` | Impersonar usuario |
| GET | `/mega/available-updates` | Actualizaciones disponibles |
| POST | `/mega/companies/{id}/icon` | Subir icono empresa |
| DELETE | `/mega/companies/{id}/icon` | Eliminar icono empresa |

### PDF Parser (`/pdf-parser`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/pdf-parser/parse-pdf` | Parsear un PDF de factura |
| POST | `/pdf-parser/parse-pdfs-masivo` | Parsear múltiples PDFs |

### SQL Server (`/sql-server`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/sql-server/health` | Estado de conexión SQL Server |
| GET | `/sql-server/buscar-rv/{doc}` | Buscar remito de venta |
| POST | `/sql-server/re-asociar-rv/preview` | Preview re-asociación RV |
| POST | `/sql-server/re-asociar-rv/ejecutar` | Ejecutar re-asociación RV |
| POST | `/sql-server/precio-compra` | Consultar precio de compra |
| POST | `/sql-server/articulo` | Consultar artículo por código |

### Legacy (`/legacy`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/legacy/buscar-rv` | Buscar RV en sistema legacy |
| GET | `/legacy/precio/{barcode}` | Precio por barcode |
| GET | `/legacy/stock/{barcode}` | Stock por barcode |
| GET | `/legacy/buscar-producto` | Búsqueda de producto |
| POST | `/legacy/comparar-precios` | Comparar precios |
| GET | `/legacy/locales` | Listar locales legacy |
| GET | `/legacy/stats` | Estadísticas legacy |
| GET | `/legacy/stocks/resumen` | Resumen de stocks |
| GET | `/legacy/stocks/{barcode}` | Stock por barcode (v2) |
| GET | `/legacy/ventas/por-local` | Ventas agrupadas por local |
| GET | `/legacy/ventas/top-productos` | Top productos vendidos |
| GET | `/legacy/ventas/top-vendedores` | Top vendedores |

### Menu Config (`/menu-config`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/menu-config` | Obtener configuración del menú |
| GET | `/menu-config/events` | SSE para cambios en tiempo real |
| PUT | `/menu-config` | Guardar configuración del menú |

### Sync (`/sync`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/sync/events` | Push de eventos desde dispositivo |
| GET | `/sync/pull` | Pull de eventos nuevos para el dispositivo |
| POST | `/sync/register-device` | Registrar dispositivo |
| GET | `/sync/status` | Estado de sync del dispositivo |
| GET | `/sync/conflicts` | Listar conflictos pendientes |
| POST | `/sync/conflicts/{id}/resolve` | Resolver conflicto |
| GET | `/sync/devices` | Listar dispositivos registrados |
| GET | `/sync/criticos` | Eventos críticos pendientes |
| GET | `/sync/bootstrap` | Bootstrap de catálogos para nuevo dispositivo |
| GET | `/sync/delta` | Delta sync incremental |
| POST | `/sync/retry/process` | Procesar cola de reintentos |
| GET | `/sync/retry/pending` | Reintentos pendientes |

### Storage (`/storage`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/storage/upload` | Subir archivo |
| GET | `/storage/{id}` | Obtener archivo |
| GET | `/storage/{id}/download` | Descargar archivo |
| DELETE | `/storage/{id}` | Eliminar archivo |
| GET | `/storage/entity/{type}/{id}` | Archivos de una entidad |

### Health (raíz)
| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/api/v1/health` | Ping rápido sin auth (< 100ms) |

---

## SECCIÓN 3 — FRONTEND EXISTENTE

### ERP Principal (`erp/frontend/src/pages/`)

| Página | Archivo | Ruta | Funciona? |
|--------|---------|------|-----------|
| Login | `LoginPage.jsx` | `/login` | ✅ Completo |
| Dashboard | `DashboardPage.jsx` | `/` | ✅ Completo (KPIs, accesos rápidos) |
| Ingreso | `IngresoPage.jsx` | `/ingreso` | ✅ Completo (82KB — el más grande) |
| Pedidos (viejo) | `PedidosPage.jsx` | `/pedidos` | ⚠️ Parcial — partes marcadas "en construcción" |
| Pedidos Compras | `PedidosComprasPage.jsx` | `/pedidos-compras` | ✅ Completo (64KB) |
| Facturas Proveedor | `FacturasProveedorPage.jsx` | `/facturas-proveedor` | ✅ Completo (48KB) |
| Gestión Pagos | `GestionPagosPage.jsx` | `/gestion-pagos` | ✅ Completo (49KB) |
| Kanban | `KanbanPage.jsx` | `/kanban` | ✅ Completo |
| Stock | `StockPage.jsx` | `/stock` | ✅ Completo (19KB, soporte offline) |
| Facturación | `FacturacionPage.jsx` | `/facturacion` | ✅ Completo (42KB, offline + tickets) |
| Consultas | `ConsultasPage.jsx` | `/consultas` | ✅ Completo (40KB, barcode scanning) |
| Productos | `ProductosPage.jsx` | `/productos` | ✅ Completo (25KB) |
| Proveedores | `ProveedoresPage.jsx` | `/proveedores` | ✅ Completo (44KB) |
| Locales | `LocalesPage.jsx` | `/locales` | ✅ Completo |
| Usuarios | `UsuariosPage.jsx` | `/usuarios` | ✅ Completo |
| Reportes | `ReportesPage.jsx` | `/reportes` | ✅ Completo (32KB, gráficos Recharts) |
| Config | `ConfigPage.jsx` | `/config` | ✅ Completo (27KB) |
| Monitoreo | `MonitoreoPage.jsx` | `/monitoreo` | ✅ Completo |
| Recepción | `RecepcionPage.jsx` | `/recepcion` | ✅ Completo (54KB, barcode) |
| Configurador Menú | `ConfiguradorMenuPage.jsx` | `/configurador-menu` | ✅ Completo (25KB) |
| Comparador | `ComparadorPage.jsx` | `/comparador` | ✅ Completo (37KB) |
| Completados | `CompletadosPage.jsx` | `/completados` | ✅ Completo |
| Resumen | `ResumenPage.jsx` | `/resumen` | ✅ Completo (semáforo) |
| Transporte | `TransportePage.jsx` | `/transporte` | ✅ Completo |
| Socios Montagne | `SociosMontagnePage.jsx` | `/socios-montagne` | ✅ Completo |
| Config Módulos | `ConfigModulosPage.jsx` | `/config-modulos` | ✅ Completo |
| Sync Status | `SyncStatusPage.jsx` | `/sync-status` | ✅ Completo |
| Mega Admin | `MegaAdminPage.jsx` | `/mega-admin` | ✅ Completo (65KB) |
| Company Wizard | `CompanyWizardPage.jsx` | `/mega-admin/nueva-empresa` | ✅ Completo (33KB) |
| Comisiones | `ComisionesPage.jsx` | `/comisiones` | ✅ Completo |
| Taller Dashboard | `taller/TallerDashboard.jsx` | `/taller` | ✅ Existe (9KB) |
| OT Lista | `taller/OTListPage.jsx` | `/taller/ot` | ✅ Existe (9KB) |
| OT Nueva | `taller/OTNewPage.jsx` | `/taller/ot/nueva` | ✅ Existe (22KB) |
| OT Detalle | `taller/OTDetailPage.jsx` | `/taller/ot/:id` | ✅ Existe (19KB) |
| Clientes Taller | `taller/ClientesTallerPage.jsx` | `/taller/clientes` | ✅ Existe (4.6KB — básico) |
| Stock Taller | `taller/StockTallerPage.jsx` | `/taller/stock` | ✅ Existe (6.1KB — básico) |

**Total ERP**: 36 páginas registradas en rutas. Todas existen en disco.

---

### Eurotaller-Cassano (`eurotaller-cassano/src/pages/`)

Frontend independiente (TypeScript + React) para el cliente TallerEuro. Codebase separado.

| Página | Archivo | Funciona? |
|--------|---------|-----------|
| Dashboard | `DashboardPage.tsx` | ✅ Funcional (9.8KB) |
| Login | `LoginPage.tsx` | ✅ Funcional (4KB) |
| Configuración | `ConfigPage.tsx` | ❌ Stub (187 bytes — solo esqueleto) |
| Clientes | `clientes/ClientesPage.tsx` | ✅ Funcional (4.2KB) |
| Facturación | `facturacion/FacturacionPage.tsx` | ✅ Funcional (31KB) |
| Orden de Compra | `oc/OcPage.tsx` | ❌ Stub (225 bytes) |
| OT Detalle | `ot/OTDetailPage.tsx` | ✅ Funcional (12KB) |
| OT Lista | `ot/OTListPage.tsx` | ✅ Funcional (8.6KB) |
| OT Nueva | `ot/OTNewPage.tsx` | ✅ Funcional (15KB) |
| Presupuestos | `presupuestos/PresupuestosPage.tsx` | ✅ Funcional (34KB) |
| Proveedores | `proveedores/ProveedoresPage.tsx` | ❌ Stub (219 bytes) |
| Reportes | `reportes/ReportesPage.tsx` | ❌ Stub (216 bytes) |
| Stock | `stock/StockPage.tsx` | ✅ Funcional (5.2KB) |
| Turnos | `turnos/TurnosPage.tsx` | ✅ Funcional (29KB) |
| Vehículos | `vehiculos/VehiculosPage.tsx` | ❌ Stub (244 bytes) |

**Total Eurotaller**: 15 páginas, 10 funcionales, 5 stubs.

---

## SECCIÓN 4 — LO QUE FALTA

### 4.1 Modelos sin tablas en base de datos (sin migración Alembic)

Estos modelos Python existen pero sus tablas **no están en PostgreSQL** — `create_all()` en startup las crearía, pero no hay migración Alembic formal, lo que significa que no son reproducibles en deploy limpio si `create_all` no está activo.

| Modelo | Tablas pendientes |
|--------|------------------|
| `work_order.py` | `work_orders`, `work_order_items`, `work_order_history`, `work_order_checklists`, `mechanic_rates` |
| `customer.py` | `customers`, `customer_companies`, `vehicles`, `account_movements` |
| `sync.py` | `sync_events`, `device_registry`, `sync_conflicts`, `afip_configs`, `afip_queue`, `storage_files`, `whatsapp_messages`, `mercadopago_configs`, `mercadopago_transactions`, `sync_retry_queue` |

**Acción requerida**: Una migración Alembic consolidada con `alembic revision --autogenerate`.

---

### 4.2 Modelos referenciados en MEGA_PLAN que NO existen

| Módulo | Qué falta | Referencia MEGA_PLAN |
|--------|-----------|----------------------|
| Stock multi-local | Modelo `StockByLocal` con PN-Counter CRDT (`pn_increments`, `pn_decrements` JSONB) | Fase 1, DN-1 |
| Conciliación bancaria | Modelo `BankReconciliation` + `BankReconciliationItem` | Fase 4 |
| Contingencia AFIP | Tabla `contingency_invoices` standalone (la cola existe en `AfipQueue` pero sin FK `contingency_ref` en `Sale`) | DN-3 |
| Marketplace módulos | Modelo `ModulePricing` para catálogo con precios | Fase 5 |

---

### 4.3 Campos faltantes en modelos existentes

| Modelo | Campos que faltan | Impacto |
|--------|------------------|---------|
| `Sale` | `cae`, `cae_vencimiento`, `punto_venta`, `cbte_nro`, `cbte_tipo` | Sin estos campos, la integración AFIP real no puede funcionar |
| `SyncEvent` | `idempotency_key`, `version`, `lote_sync_id`, `checksum` | Documentados en `sync-gap-analysis.md` como GAPs 1-8 |
| `WorkOrder` | `vehicle_id` FK a `vehicles` | DN-5: vehículo como FK obligatorio para rubro MECANICO |
| `StockMovement` | `local_id`, `origin_local_id`, `destination_local_id` | Necesarios para transferencias multi-local |

---

### 4.4 Servicios backend sin implementar

| Servicio | Descripción | Fase MEGA_PLAN |
|----------|-------------|----------------|
| `services/afip_service.py` | Integración real WSAA + WSFE con `pyafipws` | Fase 3 |
| `services/afip_wsaa.py` | Autenticación AFIP (certificados x.509) | Fase 3 |
| `services/contingency.py` | Numeración y regularización de serie C | Fase 1 |
| `services/stock_local.py` | Lógica de stock por local con PN-Counter | Fase 1 |
| `services/alerts.py` | Alertas de stock negativo | Fase 1 |
| `services/mercadopago.py` | QR de cobro + webhook de confirmación | Fase 3 |
| `services/storage_backend.py` | Abstracción LocalFileStorage / S3Storage | Fase 3 |
| `services/sync_engine.py` | Lógica de merge CRDT server-side | Fase 2 |
| `services/crdt_merge.py` | PN-Counter merge, LWW-Register | Fase 2 |
| `services/credit_check.py` | Validación límite de crédito de clientes | Fase 4 |
| `services/bank_import.py` | Import CSV bancario | Fase 4 |
| `services/provisioning.py` | Auto-provisioning de empresas nuevas | Fase 5 |

---

### 4.5 Frontend — páginas sin implementar

| Página | Ruta | Descripción | Fase MEGA_PLAN |
|--------|------|-------------|----------------|
| Clientes / CRM (completo) | `/clientes` | Perfil unificado de clientes, cuenta corriente, historial | Fase 4 |
| Vehículos (completo) | `/vehiculos` | CRUD vehículos, historial por patente | Fase 3 |
| Transferencias | `/transferencias` | Transferencias de stock entre locales | Fase 2 |
| Inventario Físico | `/inventario` | Toma de inventario con scanner, reconciliación | Fase 2 |
| Conciliación Bancaria | `/conciliacion` | Import CSV, matching automático | Fase 4 |
| WhatsApp (completo) | `/whatsapp` | Mensajería con clientes (stub API) | Fase 4 |
| Marketplace Módulos | `/marketplace` | Catálogo y activación de módulos con precio | Fase 5 |
| Reportes Avanzados | `/reportes-avanzados` | ABC productos, aging, proyección de cobros | Fase 5 |
| AFIP Config | (dentro de `/config`) | Configuración de certificados, punto de venta | Fase 3 |
| Eurotaller: Proveedores | `proveedores/ProveedoresPage.tsx` | Stub 219 bytes | — |
| Eurotaller: Vehículos | `vehiculos/VehiculosPage.tsx` | Stub 244 bytes | — |
| Eurotaller: Reportes | `reportes/ReportesPage.tsx` | Stub 216 bytes | — |
| Eurotaller: Config | `ConfigPage.tsx` | Stub 187 bytes | — |
| Eurotaller: OC | `oc/OcPage.tsx` | Stub 225 bytes | — |

---

### 4.6 Frontend — infraestructura offline incompleta

| Archivo | Estado | Qué hace |
|---------|--------|----------|
| `src/lib/eventSourcing.js` | ❌ No existe | Event log append-only en IndexedDB (store #12) |
| `src/lib/deviceFingerprint.js` | ❌ No existe | Hash de identificación de dispositivo |
| `src/lib/syncEngine.js` | ❌ No existe | Motor push/pull/auto-sync bidireccional |
| `src/lib/offlineDB.js` | ✅ Existe | IndexedDB wrapper, 11 stores, schema v3 |
| `src/lib/offlineSync.js` | ✅ Existe | Motor sync básico (descarga catálogos, envía ops) |
| `src/lib/offlineReceipt.js` | ✅ Existe | Generador de tickets offline |
| `src/lib/useOffline.js` | ✅ Existe | Hook de estado offline |

---

### 4.7 Integraciones externas sin implementar (stubs)

| Integración | Estado | Detalle |
|-------------|--------|---------|
| AFIP WSAA/WSFE | Stub completo | Modelos `AfipConfig`, `AfipQueue` listos. Sin `pyafipws`, sin servicio real. |
| MercadoPago QR | Stub completo | Modelos `MercadoPagoConfig`, `MercadoPagoTransaction` listos. Sin lógica de negocio. |
| WhatsApp API oficial | Stub completo | Modelo `WhatsAppMessage` listo. La integración actual (socios) usa WhatsApp Web — no la API oficial. |
| S3 / Cloudflare R2 | Stub completo | `StorageBackend` enum + `StorageFile` modelo listos. Solo funciona LOCAL por ahora. |
| Bancos CSV | No existe | Requiere `BankReconciliation` modelo + servicio de importación. |

---

### 4.8 Builds de distribución sin implementar

| Plataforma | Estado | Referencia |
|------------|--------|------------|
| Electron (Windows EXE) | ❌ No implementado | MEGA_PLAN §2.1 — "Electron Latest" |
| Android APK (Capacitor) | ❌ No implementado | MEGA_PLAN §2.1 — "Capacitor Latest" |
| Auto-updater | ❌ No implementado | MEGA_PLAN Riesgo R5 |

---

*Documento generado por lectura directa del código. Para la visión estratégica ver `MEGA_PLAN.md`. Para el estado anterior ver `ESTADO_ACTUAL.md`.*
