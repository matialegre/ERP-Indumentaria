# MEGA PLAN — ERP SaaS Multi-Tenant, Multi-Industria, Offline-First

> **Versión**: 1.0  
> **Fecha**: Diciembre 2026  
> **Autor**: Equipo Mundo Outdoor  
> **Estado**: Documento maestro de arquitectura y hoja de ruta

---

## 1. RESUMEN EJECUTIVO

### Qué es

Sistema ERP SaaS multi-tenant diseñado para operar **sin conexión a internet** como capacidad central, no como fallback. Cada empresa cliente recibe una instancia lógica aislada dentro de la misma infraestructura, con módulos activables según su industria y necesidad comercial.

### A quién va dirigido

Pequeñas y medianas empresas argentinas de rubros diversos: indumentaria, talleres mecánicos, distribuidoras, kioscos, ferreterías, y cualquier comercio que necesite gestión profesional sin depender de conectividad permanente. Los primeros clientes confirmados son:

| Empresa | Industria | Necesidad principal |
|---|---|---|
| **Mundo Outdoor** | Indumentaria/outdoor | Multi-local, talles+colores, stock distribuido |
| **TallerEuro** | Taller mecánico | Órdenes de trabajo, vehículos, fotos, repuestos |
| **Ferreyra** | Distribuidora | Cuenta corriente, crédito 30/60/90, catálogo grande |
| **Kiosco** | Consumibles | Vencimientos por lote, rotación rápida |
| **Ferretería** | Ferretería | Variantes complejas, kits, unidades sueltas/caja/pallet |

### Qué problema resuelve

1. **Conectividad intermitente**: Locales con internet inestable no pueden depender de ERPs cloud-only. El sistema opera 100% offline y sincroniza cuando hay conexión.
2. **Costo de software especializado**: Cada rubro compra software vertical caro. Este ERP ofrece módulos configurables por industria a precio accesible.
3. **Fragmentación de datos**: Empresas con múltiples locales usan planillas separadas. El sistema unifica stock, ventas y clientes en tiempo real.
4. **Facturación electrónica**: AFIP exige facturación electrónica pero la conexión falla. El sistema emite comprobantes de contingencia (serie C) y regulariza automáticamente [DN-3].

### Modelo de negocio

**SaaS vendido por módulos**. Cada empresa paga según los módulos que activa. El catálogo actual tiene 14 módulos (`MODULES_CATALOG`): COMPRAS, PAGOS, STOCK, VENTAS, TRANSPORTE, KANBAN, REPORTES, SOCIOS, CATALOGO, LOCALES, USUARIOS, MONITOREO, OT, COMPLETADOS. La tabla `CompanyModule` vincula módulos a empresas con toggle `is_active`. Cada módulo tiene variantes por industria — por ejemplo, el módulo STOCK para indumentaria maneja talles/colores, mientras que para kiosco maneja vencimientos por lote.

### Diferenciador central

**Offline-first con sincronización inteligente**. No es "funciona sin internet a medias" — es "funciona completamente sin internet y sincroniza sin conflictos cuando se reconecta". Esto se logra con Event Sourcing + CRDTs híbridos, extendiendo el patrón outbox que ya existe en producción.

### Distribución

- **Web**: PWA instalable desde navegador
- **Desktop**: Electron EXE (variante admin para MEGAADMIN, variante cliente por marca)
- **Mobile**: APK Android via Capacitor (4.7 MB)
- **Auto-update**: Sistema implementado para todas las plataformas

---

## 2. ARQUITECTURA GENERAL

### 2.1 Stack definitivo

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| **Base de datos** | PostgreSQL | 18.3 (puerto 2048) | Robustez, JSONB para eventos, extensiones GIS futuras |
| **Backend API** | FastAPI (Python) | 0.115.6 | Async nativo, tipado fuerte, autodoc OpenAPI |
| **ORM** | SQLAlchemy | 2.0.36 | Madurez, migraciones Alembic, soporte multi-tenant |
| **Migraciones** | Alembic | 1.14.1 | Integrado con SQLAlchemy, versionado de schema |
| **Auth** | python-jose + bcrypt | 4.0.1 | JWT 8h, bcrypt 4.0.1 (NO 5.x — rompe) |
| **Frontend** | React | 19 | Concurrent features, Suspense, use() hook |
| **Bundler** | Vite | 8.0.3 | Velocidad, HMR, compatibilidad Electron/Capacitor |
| **CSS** | Tailwind | v4 | Utility-first, @tailwindcss/vite plugin |
| **Data fetching** | TanStack Query | v5 | Cache, retry, offline mutations, optimistic updates |
| **Desktop** | Electron | Latest | Distribución EXE, acceso filesystem, auto-update |
| **Mobile** | Capacitor | Latest | APK nativo, acceso cámara/GPS, plugins nativos |
| **Offline storage** | IndexedDB | Nativo | 11 stores, sin límite práctico de tamaño |
| **Sync** | Custom (Event Sourcing + CRDT) | Propio | Control total, extiende outbox existente |

### 2.2 Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DISPOSITIVOS CLIENTE                            │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │  Electron    │  │  Capacitor   │  │    PWA       │                 │
│  │  (Desktop)   │  │  (Android)   │  │  (Browser)   │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                 │                 │                          │
│         └────────────┬────┴─────────────────┘                         │
│                      │                                                 │
│  ┌───────────────────▼───────────────────────────────────────────┐     │
│  │                    REACT 19 + VITE 8                          │     │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐  │     │
│  │  │ Pages   │ │ TanStack │ │ AuthCtx   │ │ OfflineCtx     │  │     │
│  │  │ (30)    │ │ Query v5 │ │ JWT+local │ │ outbox+sync    │  │     │
│  │  └─────────┘ └──────────┘ └───────────┘ └────────────────┘  │     │
│  └───────────────────┬───────────────────────────────────────────┘     │
│                      │                                                 │
│  ┌───────────────────▼───────────────────────────────────────────┐     │
│  │                    SYNC ENGINE (Cliente)                       │     │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │     │
│  │  │ IndexedDB│  │ EventLog │  │ Outbox    │  │ CRDT       │  │     │
│  │  │ 11 stores│  │ (append) │  │ (pending) │  │ Resolvers  │  │     │
│  │  └──────────┘  └──────────┘  └───────────┘  └────────────┘  │     │
│  │                                                               │     │
│  │  CRDTs: PN-Counter (stock) | LWW-Register (OT) | Set (ventas)│     │
│  └───────────────────┬───────────────────────────────────────────┘     │
│                      │                                                 │
└──────────────────────┼─────────────────────────────────────────────────┘
                       │ HTTPS/WSS (cuando hay conexión)
                       │ Batch sync cada 30s o al reconectar
                       │
┌──────────────────────▼─────────────────────────────────────────────────┐
│                        SERVIDOR CENTRAL                                │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                    FastAPI 0.115.6                             │     │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐ │     │
│  │  │ 35 API   │ │ Auth     │ │ Sync      │ │ AFIP           │ │     │
│  │  │ Routers  │ │ JWT+RBAC │ │ Endpoint  │ │ Gateway        │ │     │
│  │  └──────────┘ └──────────┘ └───────────┘ └────────────────┘ │     │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐ │     │
│  │  │ Modules  │ │ Tenant   │ │ Event     │ │ File Storage   │ │     │
│  │  │ Registry │ │ Filter   │ │ Processor │ │ Abstraction    │ │     │
│  │  └──────────┘ └──────────┘ └───────────┘ └────────────────┘ │     │
│  └───────────────────┬───────────────────────────────────────────┘     │
│                      │                                                 │
│  ┌───────────────────▼───────────────────────────────────────────┐     │
│  │                PostgreSQL 18.3 (puerto 2048)                   │     │
│  │                                                                │     │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐   │     │
│  │  │ Tenant  │ │ Business │ │ Event     │ │ AFIP           │   │     │
│  │  │ Tables  │ │ Tables   │ │ Store     │ │ Tables         │   │     │
│  │  │─────────│ │──────────│ │───────────│ │────────────────│   │     │
│  │  │companies│ │sales     │ │event_store│ │afip_config     │   │     │
│  │  │users    │ │ingresos  │ │sync_queue │ │afip_queue      │   │     │
│  │  │locals   │ │pedidos   │ │device_reg │ │contingency_inv │   │     │
│  │  │products │ │work_order│ │           │ │                │   │     │
│  │  └─────────┘ └──────────┘ └───────────┘ └────────────────┘   │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │  Integraciones externas (stubs listos [DN-6])                 │     │
│  │  WhatsApp API │ MercadoPago │ Bancos CSV │ S3/Cloudflare     │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Flujo de datos entre módulos

```
                    ┌──────────┐
                    │ CATALOGO │ Productos, variantes, precios
                    └────┬─────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
      ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
      │  COMPRAS  │ │ STOCK │ │  VENTAS   │
      │ Pedidos   │ │ [DN-1]│ │ Facturas  │
      │ Ingresos  │ │ Neg OK│ │ [DN-3]    │
      │ Facturas  │ │       │ │ Serie C   │
      └─────┬─────┘ └───┬───┘ └─────┬─────┘
            │            │            │
            └────────────┼────────────┘
                         │
                    ┌────▼─────┐
                    │  PAGOS   │
                    │ Vouchers │
                    │ MP QR    │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
    │    OT     │  │   CRM   │  │    AFIP     │
    │ [DN-4][5] │  │  [DN-2] │  │   [DN-3]    │
    │ Fotos,    │  │ Crédito │  │ WSAA/WSFE   │
    │ Vehículos │  │ x empresa│ │ Contingencia│
    └─────┬─────┘  └────┬────┘  └──────┬──────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
                  ┌──────▼──────┐
                  │  REPORTES   │
                  │  Dashboard  │
                  │  Gráficos   │
                  └─────────────┘
```

**Flujo detallado de operaciones:**

1. **Compra → Stock**: `Ingreso` confirmado genera `StockMovement(INGRESO)` → incrementa `stock_by_local` → PN-Counter sincroniza entre locales.
2. **Venta → Stock**: `Sale` emitida genera `StockMovement(EGRESO)` → decrementa `stock_by_local`. Si stock resulta negativo, se permite la operación y se genera alerta [DN-1].
3. **Venta → AFIP**: Si hay conexión, `Sale` emitida se envía a WSFE y recibe CAE. Si no hay conexión, se emite con serie de contingencia (C-XXXX) [DN-3]. Al reconectar, se emite factura fiscal y se vincula por referencia.
4. **OT → Stock**: `WorkOrder` al completarse puede generar movimientos de repuestos. Fotos se guardan en filesystem local, con abstracción lista para S3/Cloudflare [DN-4]. Cada OT vinculada a vehículo específico [DN-5].
5. **CRM → Ventas**: Cliente identificado por CUIT/DNI universal. Cada empresa define su propio límite de crédito para ese cliente via `customer_company` [DN-2].
6. **WhatsApp**: Módulo stub completo. Tabla `whatsapp_messages`, router registrado, frontend con página placeholder. Listo para activar cuando se integre la API [DN-6].

### 2.4 Decisiones de negocio incorporadas

| ID | Decisión | Impacto arquitectónico |
|---|---|---|
| **[DN-1]** | Stock negativo permitido | `stock_by_local.quantity` acepta valores negativos. Sin validación bloqueante en `Sale.confirm()`. Alerta push al ADMIN. Reconciliación en inventario físico. |
| **[DN-2]** | Límite de crédito por empresa | Tabla `customer_company` con FK a `customers` y `companies`. Campo `credit_limit DECIMAL`. Mismo CUIT puede tener límites independientes en cada empresa. |
| **[DN-3]** | Contingencia AFIP | Serie de numeración separada: `contingency_series` en `afip_config`. Prefijo `C-`. Al regularizar: factura fiscal emitida con campo `contingency_ref` apuntando al comprobante original. |
| **[DN-4]** | Fotos OT en servidor propio | Interfaz `StorageBackend` con implementaciones `LocalFileStorage` y `S3Storage`. Config en `Company.storage_config JSONB`. Migración transparente. |
| **[DN-5]** | Múltiples vehículos por cliente | Tabla `vehicles` con FK a `customers`. `work_orders.vehicle_id` FK obligatorio para industria MECANICO. Historial de OT por patente. |
| **[DN-6]** | WhatsApp futuro | Tabla `whatsapp_messages`, modelo SQLAlchemy, router stub, página frontend placeholder. Todo desactivado por `CompanyModule.is_active = False`. Sin dependencias externas hasta activación. |

### 2.5 Tecnología de sincronización

**Decisión tomada: Custom Event Sourcing + CRDT Hybrid**

Rechazados: PouchDB (CouchDB dependency), PowerSync (vendor lock-in), ElectricSQL (inmadurez), WatermelonDB (React Native only).

**Estructura del event store:**

```sql
-- Servidor
CREATE TABLE event_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    device_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,    -- 'sale', 'stock_movement', 'work_order'
    entity_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,     -- 'created', 'updated', 'confirmed', 'cancelled'
    payload JSONB NOT NULL,
    vector_clock JSONB NOT NULL,         -- {device_id: counter}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    sequence_number BIGSERIAL
);

CREATE INDEX idx_event_store_sync ON event_store(company_id, sequence_number);
CREATE INDEX idx_event_store_entity ON event_store(entity_type, entity_id);
```

**CRDTs utilizados:**

| Tipo de dato | CRDT | Justificación |
|---|---|---|
| Stock por local | **PN-Counter** | Incrementos y decrementos concurrentes sin conflicto. Cada dispositivo mantiene su par (P, N). Stock = ΣP - ΣN. |
| Campos de OT | **LWW-Register** | Último escritor gana con timestamp. Aceptable porque un mecánico edita una OT a la vez. |
| Ventas | **Append-only Set** | Ventas nunca se editan, solo se agregan o anulan. Sin conflicto posible. |
| Datos de cliente | **LWW-Register** | Ediciones infrecuentes, resolución por timestamp suficiente. |

---

## 3. MAPA DE SCHEMA

### 3.1 Modelos existentes (24 modelos en `erp/backend/app/models/`)

> No se repiten schemas completos. Referencia: `erp/backend/app/models/*.py`

### 3.2 Mapa de relaciones

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CORE (Tenant)                               │
│                                                                     │
│  companies ─────┬──→ users (company_id, nullable para MEGAADMIN)    │
│  (industry_type)│──→ locals (company_id)                            │
│  (branding)     │──→ providers (company_id)                         │
│  (modules)      │      └──→ provider_contacts (provider_id)         │
│                 │──→ products (company_id)                           │
│                 │      └──→ product_variants (product_id)            │
│                 │──→ company_modules (company_id, module_slug)       │
│                 │──→ plans ──→ company_subscriptions                 │
│                 │──→ bank_accounts (company_id)                      │
│                 └──→ mail_configs (company_id)                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      OPERACIONES (Business)                         │
│                                                                     │
│  sales ──→ sale_items ──→ product_variants                          │
│    └──→ stock_movements (sale_id)                                   │
│                                                                     │
│  ingresos ──→ ingreso_items ──→ product_variants                    │
│    └──→ stock_movements (ingreso_id)                                │
│                                                                     │
│  pedidos ──→ pedido_items ──→ product_variants                      │
│    └──→ providers (provider_id)                                     │
│                                                                     │
│  purchase_orders ──→ purchase_order_items                            │
│    └──→ purchase_invoices ──→ purchase_invoice_items                 │
│                                                                     │
│  payment_vouchers ──→ payment_invoice_links                          │
│    └──→ bank_accounts                                               │
│                                                                     │
│  credit_notes (company_id, provider_id)                              │
│                                                                     │
│  price_list_files ──→ price_list_items                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     TALLER / OT (Industria MECANICO)                │
│                                                                     │
│  work_orders ──→ work_order_items ──→ product_variants              │
│    ├──→ work_order_history (work_order_id)                          │
│    ├──→ work_order_checklist (work_order_id)                        │
│    └──→ mechanic_rates (company_id)                                 │
│                                                                     │
│  [NUEVO] vehicles ──→ work_orders (vehicle_id) [DN-5]              │
│    └──→ customers (owner_id)                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     LOGÍSTICA / TRANSPORTE                          │
│                                                                     │
│  transports ──→ shipments (transport_id)                             │
│    └──→ locals (origin_id, destination_id)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     GESTIÓN / UTILIDADES                             │
│                                                                     │
│  kanban_boards ──→ kanban_columns ──→ kanban_cards                   │
│  notifications (user_id, company_id)                                 │
│  audit_log (user_id, company_id, entity_type, entity_id)             │
│  improvement_notes (company_id, user_id)                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NUEVOS — Sync Engine                            │
│                                                                     │
│  event_store (company_id, device_id, entity_type, entity_id)         │
│    - payload JSONB, vector_clock JSONB                               │
│    - sequence_number BIGSERIAL (orden global)                        │
│                                                                     │
│  sync_queue (device_id, last_sequence, status)                       │
│    - Tracking de qué eventos ya recibió cada dispositivo             │
│                                                                     │
│  device_registry (device_id, user_id, company_id)                    │
│    - fingerprint, platform, last_seen, app_version                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NUEVOS — AFIP                                   │
│                                                                     │
│  afip_config (company_id)                                            │
│    - cuit, punto_venta, cert_path, key_path                         │
│    - contingency_series VARCHAR  (ej: "C") [DN-3]                   │
│    - contingency_counter INTEGER                                     │
│    - homologation BOOLEAN                                            │
│                                                                     │
│  afip_queue (sale_id, status, attempts, last_error)                  │
│    - Cola de comprobantes pendientes de envío a AFIP                 │
│                                                                     │
│  contingency_invoices (sale_id, contingency_number) [DN-3]           │
│    - fiscal_sale_id (FK a sale regularizada)                         │
│    - regularized_at TIMESTAMPTZ                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NUEVOS — CRM                                    │
│                                                                     │
│  customers (cuit_dni, nombre, email, telefono)                       │
│    - Identificación universal por CUIT/DNI                           │
│                                                                     │
│  customer_company (customer_id, company_id) [DN-2]                   │
│    - credit_limit DECIMAL                                            │
│    - payment_terms VARCHAR (contado, 30, 60, 90)                     │
│    - price_list_id FK                                                │
│    - balance DECIMAL (saldo cuenta corriente)                        │
│    - is_active BOOLEAN                                               │
│                                                                     │
│  vehicles (customer_id, patente, marca, modelo, año) [DN-5]          │
│    - vin VARCHAR, color, km_actual                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NUEVOS — Integraciones                          │
│                                                                     │
│  whatsapp_messages (company_id, customer_id) [DN-6]                  │
│    - direction (INBOUND/OUTBOUND), body, status                      │
│    - template_name, media_url                                        │
│    - STUB: tabla creada, router registrado, sin lógica real          │
│                                                                     │
│  mercadopago_transactions (company_id, sale_id)                      │
│    - mp_payment_id, status, amount, qr_data                         │
│                                                                     │
│  bank_reconciliation (company_id, bank_account_id)                   │
│    - csv_file, imported_at, matched_count, unmatched_count           │
│    - bank_reconciliation_items (transaction_date, amount, ref)       │
│    - matched_payment_id FK nullable                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NUEVOS — Stock por Local                        │
│                                                                     │
│  stock_by_local (product_variant_id, local_id) [DN-1]                │
│    - quantity DECIMAL (acepta negativos)                              │
│    - pn_increments JSONB  -- {device_id: count}                      │
│    - pn_decrements JSONB  -- {device_id: count}                      │
│    - last_inventory_at TIMESTAMPTZ                                   │
│    - UNIQUE(product_variant_id, local_id)                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Resumen de FK principales

| Tabla origen | FK | Tabla destino | Cardinalidad |
|---|---|---|---|
| users | company_id | companies | N:1 (nullable) |
| locals | company_id | companies | N:1 |
| products | company_id | companies | N:1 |
| product_variants | product_id | products | N:1 |
| sales | local_id | locals | N:1 |
| sales | company_id | companies | N:1 |
| sale_items | sale_id | sales | N:1 |
| sale_items | variant_id | product_variants | N:1 |
| stock_movements | variant_id | product_variants | N:1 |
| stock_movements | local_id | locals | N:1 |
| work_orders | company_id | companies | N:1 |
| work_orders | vehicle_id | vehicles | N:1 |
| vehicles | customer_id | customers | N:1 |
| customer_company | customer_id | customers | N:1 |
| customer_company | company_id | companies | N:1 |
| event_store | company_id | companies | N:1 |
| event_store | device_id | device_registry | N:1 |
| stock_by_local | variant_id | product_variants | N:1 |
| stock_by_local | local_id | locals | N:1 |
| afip_config | company_id | companies | 1:1 |
| contingency_invoices | sale_id | sales | 1:1 |
| whatsapp_messages | company_id | companies | N:1 |
| company_modules | company_id | companies | N:1 |

---

## 4. ROADMAP EN 6 FASES

### FASE 0 — Fundamentos (en progreso)

**Objetivo**: Establecer la infraestructura de sincronización y completar el schema de base de datos para todas las tablas pendientes.

**Tareas:**

1. Crear modelos SQLAlchemy para tablas de sync: `EventStore`, `SyncQueue`, `DeviceRegistry`
2. Crear modelos para AFIP: `AfipConfig`, `AfipQueue`, `ContingencyInvoice`
3. Crear modelos para CRM: `Customer`, `CustomerCompany`, `Vehicle`
4. Crear modelo `StockByLocal` con campos CRDT (pn_increments, pn_decrements)
5. Crear stubs de integración: `WhatsappMessage`, `MercadopagoTransaction`, `BankReconciliation`
6. Generar migración Alembic consolidada para todas las tablas nuevas
7. Implementar `eventLog` store en IndexedDB del frontend (store #12)
8. Implementar device fingerprinting (hash de user-agent + screen + timezone)
9. Crear endpoint `/api/v1/sync/push` y `/api/v1/sync/pull` básicos
10. Crear endpoint `/api/v1/devices/register` para registro de dispositivos

**Archivos a crear/modificar:**

| Acción | Ruta |
|---|---|
| Crear | `erp/backend/app/models/event_store.py` |
| Crear | `erp/backend/app/models/sync_queue.py` |
| Crear | `erp/backend/app/models/device_registry.py` |
| Crear | `erp/backend/app/models/afip_config.py` |
| Crear | `erp/backend/app/models/customer.py` |
| Crear | `erp/backend/app/models/vehicle.py` |
| Crear | `erp/backend/app/models/stock_by_local.py` |
| Crear | `erp/backend/app/models/whatsapp_message.py` |
| Crear | `erp/backend/app/models/mercadopago_transaction.py` |
| Crear | `erp/backend/app/models/bank_reconciliation.py` |
| Modificar | `erp/backend/app/models/__init__.py` (registrar modelos) |
| Crear | `erp/backend/app/api/endpoints/sync.py` |
| Crear | `erp/backend/app/api/endpoints/devices.py` |
| Modificar | `erp/backend/app/api/router.py` (registrar routers) |
| Modificar | `erp/frontend/src/lib/db.js` (agregar eventLog store) |
| Crear | `erp/frontend/src/lib/deviceFingerprint.js` |
| Crear | `erp/frontend/src/lib/syncEngine.js` (base) |

**Dependencias**: Ninguna (es la base).

**ENTREGABLE**: 2 dispositivos (Electron + navegador) registrados en `device_registry`, enviando eventos básicos al servidor y recibiendo confirmación de sync. IndexedDB con eventLog funcional.

---

### FASE 1 — MVP Un Local

**Objetivo**: Un local de Mundo Outdoor opera completamente sin internet: vende, factura con serie C, y el stock se actualiza localmente.

**Tareas:**

1. Implementar `stock_by_local` con lógica de PN-Counter (incremento/decremento por device)
2. Extender modelo `Sale` con campos AFIP: `cae`, `cae_vencimiento`, `punto_venta`, `cbte_nro`, `cbte_tipo`
3. Implementar facturación de contingencia serie C [DN-3]: numeración automática `C-0001`, `C-0002`, etc.
4. Modificar endpoint `POST /api/v1/sales/` para no bloquear por stock negativo [DN-1] — generar alerta en su lugar
5. Crear servicio de alertas backend: `StockAlertService` que notifica cuando stock < 0
6. Adaptar frontend `VentasPage` para operar offline: guardar venta en IndexedDB, encolar sync
7. Crear componente `OfflineInvoice` que genera comprobante C imprimible (PDF o ticket)
8. Implementar cola de sync para ventas: `salesOutbox` en IndexedDB → `POST /api/v1/sync/push` al reconectar
9. Tests de integración: venta offline → sync → verificar en servidor
10. Implementar indicador de estado de conexión en header del frontend

**Archivos a crear/modificar:**

| Acción | Ruta |
|---|---|
| Crear | `erp/backend/app/services/stock_local.py` |
| Crear | `erp/backend/app/services/contingency.py` |
| Crear | `erp/backend/app/services/alerts.py` |
| Modificar | `erp/backend/app/models/sale.py` (campos AFIP) |
| Modificar | `erp/backend/app/api/endpoints/sales.py` (stock negativo + contingencia) |
| Modificar | `erp/backend/app/api/endpoints/stock.py` (stock_by_local) |
| Crear | `erp/frontend/src/components/OfflineInvoice.jsx` |
| Crear | `erp/frontend/src/components/ConnectionStatus.jsx` |
| Modificar | `erp/frontend/src/pages/VentasPage.jsx` (offline mode) |
| Modificar | `erp/frontend/src/lib/syncEngine.js` (sales outbox) |
| Crear | `erp/backend/tests/test_offline_sale.py` |

**Dependencias**: Fase 0 completada (event store + device registry + sync endpoints).

**ENTREGABLE**: Un vendedor en un local de Mundo Outdoor abre la app Electron sin internet, registra una venta, se genera comprobante C-0001, stock se decrementa localmente (puede quedar negativo), y al reconectar la venta se sincroniza al servidor con el comprobante de contingencia.

---

### FASE 2 — Multi-Local

**Objetivo**: Dos o más locales sincronizan stock en tiempo real, con resolución automática de conflictos.

**Tareas:**

1. Implementar sync bidireccional completo: pull events por `sequence_number` > last_seen
2. Implementar PN-Counter merge para stock: cada local mantiene sus contadores, merge = sum de todos
3. Implementar resolución de conflictos para ventas: append-only, sin conflicto por diseño
4. Implementar resolución para datos de cliente: LWW-Register con timestamp, último editor gana
5. Crear endpoint de transferencia entre locales: `POST /api/v1/stock/transfer`
6. Implementar traceability de transferencias: `StockMovement(TRANSFERENCIA)` con `origin_local_id` y `destination_local_id`
7. Crear módulo de inventario físico: `POST /api/v1/stock/inventory` con reconciliación automática
8. Frontend: página de transferencias con selector de local origen/destino
9. Frontend: página de inventario físico con scanner de código de barras (input manual como fallback)
10. Dashboard multi-local: vista consolidada de stock por local y total

**Archivos a crear/modificar:**

| Acción | Ruta |
|---|---|
| Crear | `erp/backend/app/services/sync_engine.py` |
| Crear | `erp/backend/app/services/crdt_merge.py` |
| Crear | `erp/backend/app/services/inventory.py` |
| Crear | `erp/backend/app/api/endpoints/transfers.py` |
| Crear | `erp/backend/app/api/endpoints/inventory.py` |
| Modificar | `erp/backend/app/api/endpoints/sync.py` (bidireccional) |
| Modificar | `erp/backend/app/api/endpoints/stock.py` (stock_by_local multi) |
| Crear | `erp/frontend/src/pages/TransferenciasPage.jsx` |
| Crear | `erp/frontend/src/pages/InventarioPage.jsx` |
| Modificar | `erp/frontend/src/pages/StockPage.jsx` (vista multi-local) |
| Modificar | `erp/frontend/src/pages/DashboardPage.jsx` (stats reales multi-local) |
| Modificar | `erp/frontend/src/lib/syncEngine.js` (bidireccional + CRDT merge) |
| Crear | `erp/backend/tests/test_sync_multilocal.py` |
| Crear | `erp/backend/tests/test_crdt_merge.py` |

**Dependencias**: Fase 1 completada (stock_by_local funcional, sync básico operativo).

**ENTREGABLE**: 2 locales de Mundo Outdoor operando simultáneamente. Local A vende producto X → stock se decrementa en A → evento sincroniza a servidor → servidor notifica a Local B → stock actualizado en B. Transferencia de mercadería de Local A a Local B con trazabilidad completa. Inventario físico con reconciliación automática.

---

### FASE 3 — Taller Completo

**Objetivo**: TallerEuro opera al 100% con órdenes de trabajo, integración AFIP real, Mercado Pago, y gestión de vehículos.

**Tareas:**

1. Frontend completo para OT: crear, editar, cambiar estado, checklist, historial (backend ya existe)
2. Implementar integración AFIP real con `pyafipws`: WSAA (autenticación), WSFE (facturación electrónica)
3. Crear servicio de regularización de contingencia [DN-3]: procesar `contingency_invoices` pendientes al reconectar
4. Integrar Mercado Pago QR: generar QR de cobro, webhook de confirmación, vincular a `Sale`
5. Implementar upload de fotos para OT [DN-4]: `StorageBackend` abstracción con `LocalFileStorage` inicial
6. Crear CRUD de vehículos [DN-5]: alta, edición, historial de OT por patente, búsqueda por patente
7. Frontend página de vehículos vinculada a clientes
8. Implementar vista de OT para mecánico (simplificada, touch-friendly para tablet)
9. Dashboard de taller: OTs en curso, completadas hoy, facturación del día
10. Reportes de taller: productividad por mecánico, tiempo promedio por tipo de trabajo

**Archivos a crear/modificar:**

| Acción | Ruta |
|---|---|
| Crear | `erp/frontend/src/pages/WorkOrdersPage.jsx` |
| Crear | `erp/frontend/src/pages/WorkOrderDetailPage.jsx` |
| Crear | `erp/frontend/src/pages/VehiclesPage.jsx` |
| Crear | `erp/frontend/src/components/WorkOrderForm.jsx` |
| Crear | `erp/frontend/src/components/PhotoUpload.jsx` |
| Crear | `erp/backend/app/services/afip_service.py` |
| Crear | `erp/backend/app/services/afip_wsaa.py` |
| Crear | `erp/backend/app/services/mercadopago.py` |
| Crear | `erp/backend/app/services/storage_backend.py` |
| Crear | `erp/backend/app/api/endpoints/afip.py` |
| Crear | `erp/backend/app/api/endpoints/mercadopago.py` |
| Crear | `erp/backend/app/api/endpoints/vehicles.py` |
| Modificar | `erp/backend/app/api/endpoints/work_orders.py` (fotos, vehículos) |
| Modificar | `erp/backend/app/models/work_order.py` (vehicle_id FK) |
| Modificar | `erp/frontend/src/App.jsx` (rutas nuevas) |
| Crear | `erp/backend/tests/test_afip_integration.py` |

**Dependencias**: Fase 2 completada (sync multi-local, stock_by_local, contingencia probada).

**ENTREGABLE**: TallerEuro abre la app, crea OT para vehículo AB123CD de cliente Juan Pérez, agrega ítems de repuesto, sube fotos del trabajo, completa la OT, emite factura electrónica AFIP (o contingencia si está offline), cobra con QR de Mercado Pago. Todo sincronizado.

---

### FASE 4 — CRM + Integraciones

**Objetivo**: Perfil unificado de clientes cross-empresa con cuenta corriente, y integraciones bancarias.

**Tareas:**

1. Implementar modelo `Customer` con CUIT/DNI como identificador universal
2. Implementar `CustomerCompany` con límite de crédito independiente por empresa [DN-2]
3. Crear cuenta corriente por empresa: saldo, movimientos, estado (al día / moroso)
4. Implementar control de crédito en ventas: advertencia si supera límite (no bloquea, solo alerta)
5. Crear frontend CRM: perfil de cliente, historial de compras cross-empresa (solo visible para MEGAADMIN)
6. Completar stub de WhatsApp [DN-6]: tabla, modelo, router, página — todo funcional excepto envío real
7. Implementar importación de CSV bancario: parseo, matching automático contra pagos registrados
8. Crear reconciliación semi-automática: sugerir matches, el usuario confirma
9. Frontend de conciliación bancaria: tabla con matches propuestos, confirmación 1-click
10. Reportes de cartera: aging de cuentas por cobrar, clientes morosos, proyección de cobros

**Archivos a crear/modificar:**

| Acción | Ruta |
|---|---|
| Crear | `erp/backend/app/api/endpoints/customers.py` |
| Crear | `erp/backend/app/api/endpoints/customer_accounts.py` |
| Crear | `erp/backend/app/api/endpoints/bank_reconciliation.py` |
| Crear | `erp/backend/app/services/credit_check.py` |
| Crear | `erp/backend/app/services/bank_import.py` |
| Crear | `erp/backend/app/services/reconciliation.py` |
| Modificar | `erp/backend/app/api/endpoints/whatsapp.py` (completar stub) |
| Crear | `erp/frontend/src/pages/CustomersPage.jsx` |
| Crear | `erp/frontend/src/pages/CustomerDetailPage.jsx` |
| Crear | `erp/frontend/src/pages/AccountsPage.jsx` |
| Crear | `erp/frontend/src/pages/ReconciliationPage.jsx` |
| Crear | `erp/frontend/src/pages/WhatsAppPage.jsx` (placeholder funcional) |
| Modificar | `erp/frontend/src/pages/VentasPage.jsx` (check crédito) |
| Modificar | `erp/frontend/src/App.jsx` (rutas nuevas) |

**Dependencias**: Fase 3 completada (AFIP integrado, vehiculos, OT completo).

**ENTREGABLE**: MEGAADMIN ve perfil unificado de "Juan Pérez" (CUIT 20-12345678-9): compró $150K en Mundo Outdoor (límite $200K), debe $35K en TallerEuro (límite $50K). Cada empresa ve solo su parte. Importar extracto bancario del Galicia, el sistema propone matches con 85% de acierto, operador confirma.

---

### FASE 5 — Escala

**Objetivo**: Onboarding automatizado de nuevas empresas, marketplace de módulos, y reportes avanzados.

**Tareas:**

1. Refinar wizard de onboarding existente (`CompanyWizardPage.jsx`): selección de industria, módulos, branding
2. Implementar provisioning automatizado: crear company + admin user + módulos + config en <5 minutos
3. Crear sistema de variantes de módulo por industria: STOCK-indumentaria vs STOCK-kiosco vs STOCK-ferretería
4. Implementar catálogo de módulos con precios: tabla `module_pricing`, UI de marketplace
5. Reportes avanzados con gráficos: ventas por período, stock valorizado, ABC de productos
6. Implementar export PDF/Excel para todos los reportes
7. Dashboard ejecutivo para MEGAADMIN: métricas cross-empresa, MRR, churn
8. Onboarding de Ferreyra (distribuidora): cuenta corriente 30/60/90, catálogo grande
9. Onboarding de Kiosco: vencimientos por lote, alertas de vencimiento próximo
10. Documentación de API pública para integraciones de terceros

**Archivos a crear/modificar:**

| Acción | Ruta |
|---|---|
| Modificar | `erp/frontend/src/pages/CompanyWizardPage.jsx` (refinar) |
| Crear | `erp/backend/app/services/provisioning.py` |
| Crear | `erp/backend/app/models/module_pricing.py` |
| Crear | `erp/backend/app/api/endpoints/marketplace.py` |
| Crear | `erp/frontend/src/pages/MarketplacePage.jsx` |
| Crear | `erp/frontend/src/pages/ReportesAvanzadosPage.jsx` |
| Crear | `erp/backend/app/services/reports.py` |
| Crear | `erp/backend/app/services/pdf_export.py` |
| Modificar | `erp/frontend/src/pages/DashboardPage.jsx` (métricas reales) |
| Modificar | `erp/frontend/src/pages/ReportesPage.jsx` (gráficos) |

**Dependencias**: Fase 4 completada (CRM, cuentas, reconciliación).

**ENTREGABLE**: Un potencial cliente entra al sistema, elige industria "Ferretería", selecciona módulos STOCK + VENTAS + COMPRAS, configura branding, y en 1 hora tiene su ERP funcional con datos de demo. Ferreyra y Kiosco operando en producción.

---

## 5. RIESGOS CRÍTICOS

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| **R1** | **Pérdida de datos offline por corrupción de IndexedDB** | Media | Crítico | Doble escritura: IndexedDB + localStorage como backup. Export automático periódico a archivo JSON en filesystem (Electron) o descarga programada (PWA). Checksums en eventos del event store. Al detectar inconsistencia, re-sync completo desde servidor. Nunca borrar datos del servidor hasta confirmación de N dispositivos. |
| **R2** | **Gestión de certificados AFIP** | Alta | Alto | Los certificados AFIP vencen cada 2 años. Implementar alerta 60 días antes del vencimiento. Guardar certificados en `afip_config` con `cert_expiry` date. Dashboard de MEGAADMIN muestra estado de certificados por empresa. Documentar procedimiento de renovación paso a paso. Soportar entorno de homologación para testing sin riesgo. |
| **R3** | **Conflictos de stock multi-dispositivo** | Alta | Alto | Mitigado por diseño [DN-1]: stock negativo permitido, por lo que no hay "conflicto" real — solo diferencias temporales. PN-Counter garantiza convergencia eventual. Inventario físico periódico como reconciliación definitiva. Alertas automáticas cuando el delta entre stock calculado y PN-Counter supera el 5%. La decisión de negocio de permitir stock negativo elimina el riesgo de operaciones bloqueadas. |
| **R4** | **Performance con catálogos grandes (10K+ SKUs)** | Media | Alto | Paginación obligatoria en todas las listas (ya implementada en TanStack Query). IndexedDB con índices en `sku`, `name`, `barcode`. Búsqueda fuzzy client-side limitada a campos indexados. Sync incremental: solo eventos nuevos, no catálogo completo. Lazy loading de variantes. Para empresas con >50K SKUs: implementar búsqueda server-side con índice GIN en PostgreSQL sobre JSONB. Benchmark obligatorio en Fase 2 con dataset de 15K productos. |
| **R5** | **Distribución de actualizaciones Electron/Capacitor** | Media | Medio | Electron: auto-updater ya implementado, apunta a servidor de releases propio. Capacitor: distribución via descarga directa de APK (no Google Play por ahora). Versionado semántico estricto. Cada update verifica compatibilidad de schema de IndexedDB antes de aplicar — si hay breaking change, ejecuta migración local primero. Rollback automático si la migración falla. Canal de actualización: stable / beta. Forzar actualización mínima cuando hay cambios críticos de sync protocol. |

### Matriz de prioridad

```
                 Impacto
              Crítico    Alto     Medio
         ┌──────────┬──────────┬──────────┐
   Alta  │          │ R2, R3   │          │
  Prob.  ├──────────┼──────────┼──────────┤
  Media  │   R1     │   R4     │   R5     │
         ├──────────┼──────────┼──────────┤
  Baja   │          │          │          │
         └──────────┴──────────┴──────────┘
```

**Acción inmediata requerida**: R1 (datos offline) y R3 (stock multi-device) se abordan en Fase 0 y 1 respectivamente. R2 (AFIP) se aborda en Fase 3. R4 se valida con benchmark en Fase 2. R5 es riesgo operativo continuo.

---

## 6. PARALELISMO

### Distribución de trabajo por fase

| Fase | Dev A (Backend/Python) | Dev B (Frontend/React) | Dev C (Infra/Mobile/DevOps) |
|---|---|---|---|
| **F0** | Modelos SQLAlchemy nuevos (event_store, sync_queue, device_registry, afip_config, customer, vehicle, stock_by_local, stubs). Migración Alembic. Endpoints `/sync/push`, `/sync/pull`, `/devices/register`. | Agregar `eventLog` store a IndexedDB. Crear `deviceFingerprint.js`. Crear `syncEngine.js` base (cola de eventos local). UI de estado de conexión. | Configurar CI/CD para tests automáticos. Preparar entorno de staging. Configurar auto-update de Electron para canal beta. Documentar setup de desarrollo. |
| **F1** | Servicio `stock_local.py` con PN-Counter. Servicio `contingency.py` para serie C [DN-3]. Modificar endpoint de ventas para stock negativo [DN-1]. Servicio de alertas. | `VentasPage.jsx` modo offline. Componente `OfflineInvoice.jsx` (ticket/PDF). `ConnectionStatus.jsx` en header. Sales outbox en syncEngine. | Testing E2E: simular offline/online con throttling de red. Verificar que Electron funciona sin conexión. Preparar APK de prueba con sync. |
| **F2** | Sync bidireccional completo. `crdt_merge.py` con PN-Counter merge. Endpoint transferencias. Servicio de inventario físico. Tests de concurrencia. | `TransferenciasPage.jsx`. `InventarioPage.jsx` con input manual/scanner. `StockPage.jsx` vista multi-local. Dashboard con stats reales. | Benchmark de performance con 15K productos. Optimizar IndexedDB queries. Configurar WebSocket para push notifications de sync. |
| **F3** | Integración AFIP (`pyafipws`, WSAA, WSFE). Servicio MercadoPago. `storage_backend.py` para fotos [DN-4]. Endpoint vehículos [DN-5]. Regularización contingencia. | `WorkOrdersPage.jsx` completa. `WorkOrderDetailPage.jsx`. `VehiclesPage.jsx`. `PhotoUpload.jsx`. Vista mecánico (tablet). Dashboard taller. | Configurar servidor de fotos local con sync. Testing AFIP en homologación. Integración MercadoPago en sandbox. Build de APK para TallerEuro. |
| **F4** | Endpoints clientes y cuenta corriente. Credit check service [DN-2]. Bank import CSV. Reconciliación. WhatsApp stub completo [DN-6]. | `CustomersPage.jsx`. `CustomerDetailPage.jsx`. `AccountsPage.jsx`. `ReconciliationPage.jsx`. `WhatsAppPage.jsx` placeholder. | Importar datos reales de clientes existentes de cada empresa. Script de migración de datos legacy. Testing cross-browser de reconciliación. |
| **F5** | Provisioning service. Module pricing. API marketplace. Reports service. PDF/Excel export. | Refinar `CompanyWizardPage.jsx`. `MarketplacePage.jsx`. `ReportesAvanzadosPage.jsx` con gráficos (Chart.js o Recharts). | Onboarding real de Ferreyra y Kiosco. Monitoreo de producción. Backup automatizado. Documentación de deploy. |

### Reglas de paralelismo

1. **Dev A y Dev B nunca editan el mismo archivo**. Dev A crea endpoints, Dev B los consume.
2. **Dev C no toca código de negocio**. Se enfoca en infraestructura, testing, deployment, y datos.
3. **Contratos de API primero**: Dev A define el schema de request/response en OpenAPI antes de implementar. Dev B mockea la API con datos estáticos y reemplaza cuando el endpoint está listo.
4. **Branches por feature**: `feature/f0-event-store`, `feature/f0-indexeddb-eventlog`, `feature/f0-ci-setup`. Merge a `develop` cuando la feature pasa tests.
5. **Reunión diaria de 10 minutos**: cada dev reporta qué completó, qué bloquea, qué hará hoy.

---

## 7. PRIMER DÍA DE IMPLEMENTACIÓN

### Mañana — 9:00 AM

**Pre-requisitos**: PostgreSQL corriendo en puerto 2048, venv activado, frontend con `node_modules` instalados.

#### Paso 1: Verificar estado actual (9:00 - 9:15)

```powershell
# Terminal 1: Estado del repo
cd "D:\ERP MUNDO OUTDOOR"
git --no-pager status
git --no-pager log --oneline -5

# Terminal 2: Verificar backend
cd erp\backend
.\venv\Scripts\activate
python -c "from app.models import *; print('Modelos OK')"

# Terminal 3: Verificar DB
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "\dt" 

# Terminal 4: Verificar frontend
cd erp\frontend
npx vite --version
```

#### Paso 2: Crear modelos de sync engine (9:15 - 10:30)

```powershell
cd erp\backend
.\venv\Scripts\activate
```

Crear los siguientes archivos en `erp/backend/app/models/`:

**`event_store.py`** — Modelo EventStore con campos: id (UUID), company_id, device_id, entity_type, entity_id, event_type, payload (JSONB), vector_clock (JSONB), created_at, synced_at, sequence_number (BigInteger autoincrement).

**`sync_queue.py`** — Modelo SyncQueue con campos: id (UUID), device_id (FK device_registry), company_id, last_sequence (BigInteger), status (PENDING/SYNCING/SYNCED/ERROR), last_sync_at, error_message.

**`device_registry.py`** — Modelo DeviceRegistry con campos: id (UUID), user_id (FK users), company_id (FK companies), fingerprint (String unique), platform (ELECTRON/CAPACITOR/PWA), app_version, last_seen_at, is_active, created_at.

#### Paso 3: Crear modelos AFIP y CRM (10:30 - 11:30)

**`afip_config.py`** — AfipConfig: company_id (1:1 FK), cuit, punto_venta, cert_path, key_path, cert_expiry, contingency_series (default "C"), contingency_counter, homologation (Boolean), token_cache (JSONB).

**`customer.py`** — Customer: id, cuit_dni (unique), nombre, email, telefono, direccion, created_at. CustomerCompany: customer_id, company_id, credit_limit, payment_terms, price_list_id, balance, is_active, notes.

**`vehicle.py`** — Vehicle: id, customer_id (FK), company_id, patente (unique per company), marca, modelo, anio, vin, color, km_actual, notas, is_active, created_at.

**`stock_by_local.py`** — StockByLocal: id, product_variant_id (FK), local_id (FK), company_id, quantity (Numeric, acepta negativos), pn_increments (JSONB), pn_decrements (JSONB), last_inventory_at, updated_at. Unique constraint en (product_variant_id, local_id).

#### Paso 4: Crear stubs de integraciones (11:30 - 12:00)

**`whatsapp_message.py`** — WhatsappMessage: id, company_id, customer_id (nullable FK), direction (INBOUND/OUTBOUND), phone_number, body, template_name, media_url, status (PENDING/SENT/DELIVERED/READ/FAILED), wa_message_id, created_at, sent_at.

**`mercadopago_transaction.py`** — MercadopagoTransaction: id, company_id, sale_id (FK), mp_payment_id, status, amount, qr_data, external_reference, webhook_received_at, created_at.

**`bank_reconciliation.py`** — BankReconciliation: id, company_id, bank_account_id (FK), csv_filename, imported_at, total_rows, matched_count, unmatched_count. BankReconciliationItem: id, reconciliation_id (FK), transaction_date, description, amount, reference, matched_payment_id (FK nullable), match_confidence (Numeric), status (PENDING/MATCHED/MANUAL/IGNORED).

#### Paso 5: Registrar modelos y migrar (12:00 - 12:30)

```powershell
# Agregar imports a __init__.py
# Luego generar migración
cd erp\backend
.\venv\Scripts\activate
alembic revision --autogenerate -m "add sync engine, afip, crm, stock_by_local, integration stubs"
alembic upgrade head

# Verificar que las tablas se crearon
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "\dt"
```

#### Paso 6: Verificar backend arranca (12:30 - 12:45)

```powershell
cd erp\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# En otra terminal, verificar health
curl http://localhost:8000/api/v1/system/health
```

### Tarde — 14:00 PM

#### Paso 7: Crear endpoints de sync (14:00 - 15:30)

Crear `erp/backend/app/api/endpoints/sync.py`:
- `POST /api/v1/sync/push` — recibe batch de eventos del cliente, los inserta en event_store, devuelve sequence_numbers asignados.
- `GET /api/v1/sync/pull?since={sequence_number}` — devuelve eventos nuevos para el company_id del usuario, desde el sequence_number indicado.
- `POST /api/v1/sync/ack` — cliente confirma recepción, actualiza sync_queue.

Crear `erp/backend/app/api/endpoints/devices.py`:
- `POST /api/v1/devices/register` — registra dispositivo con fingerprint, devuelve device_id.
- `GET /api/v1/devices/` — lista dispositivos de la empresa.
- `PUT /api/v1/devices/{id}/heartbeat` — actualiza last_seen_at.

Registrar en `erp/backend/app/api/router.py`.

#### Paso 8: Frontend — IndexedDB + Device Fingerprint (15:30 - 17:00)

Modificar `erp/frontend/src/lib/db.js`: agregar store `eventLog` (store #12) con índices en `entityType`, `entityId`, `synced`.

Crear `erp/frontend/src/lib/deviceFingerprint.js`: generar hash estable con user-agent + screen resolution + timezone + idioma.

Crear `erp/frontend/src/lib/syncEngine.js` (versión base):
- `pushEvent(event)` — guarda en IndexedDB eventLog.
- `syncPending()` — envía eventos no sincronizados a `/api/v1/sync/push`.
- `pullEvents(sinceSequence)` — descarga nuevos eventos de `/api/v1/sync/pull`.
- Auto-sync cada 30 segundos cuando hay conexión.

#### Paso 9: Commit y verificación (17:00 - 17:30)

```powershell
cd "D:\ERP MUNDO OUTDOOR"
git add -A
git --no-pager status
git commit -m "feat: add sync engine foundation (event store, device registry, CRDT base)

- Add SQLAlchemy models: EventStore, SyncQueue, DeviceRegistry
- Add AFIP models: AfipConfig, AfipQueue, ContingencyInvoice
- Add CRM models: Customer, CustomerCompany, Vehicle
- Add StockByLocal with PN-Counter CRDT fields
- Add integration stubs: WhatsApp, MercadoPago, BankReconciliation
- Add sync endpoints: push, pull, ack, device register
- Add IndexedDB eventLog store
- Add device fingerprinting
- Add syncEngine base (push/pull/auto-sync)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

#### Verificación final del día

- [ ] Backend arranca sin errores en puerto 8000
- [ ] Todas las tablas nuevas existen en PostgreSQL
- [ ] `GET /api/v1/system/health` responde OK
- [ ] `POST /api/v1/devices/register` registra dispositivo
- [ ] `POST /api/v1/sync/push` acepta evento de prueba
- [ ] `GET /api/v1/sync/pull?since=0` devuelve el evento
- [ ] Frontend compila sin errores
- [ ] IndexedDB muestra store `eventLog` en DevTools
- [ ] Device fingerprint se genera consistentemente

---

## 7.5 AUDITORÍA INTER-AGENTES

> **Fecha**: Junio 2026
> **Participantes**: Agente A (Arquitecto), Copilot B (Schema SQL), Copilot C (Sync Specialist)

### Estado de los entregables

| Agente | Entregable | Estado |
|---|---|---|
| A | `docs/MEGA_PLAN.md` | ✅ Completo (este documento) |
| A | `app/models/customer.py` | ✅ 4 modelos CRM creados |
| A | `app/api/v1/customers.py` | ✅ 15 endpoints registrados |
| A | `app/models/sync.py` | ⚠️ 10 modelos — FALTAN 6 campos en SyncEvent |
| A | `app/api/v1/sync.py` | ✅ 12 endpoints (sync + storage) |
| A | `app/models/work_order.py` | ⚠️ 5 modelos OT — FALTA vehicle_id FK |
| A | `app/api/v1/work_orders.py` | ✅ 25 endpoints OT |
| B | `schema/002_sync_v2.sql` | ❌ Archivo NO existe — diseño solo en docs |
| B | `schema/004_negocio.sql` | ❌ Archivo NO existe — diseño solo en docs |
| B | `docs/schema-decisions.md` | ✅ 14 decisiones documentadas |
| C | `docs/conflict-resolution.md` | ✅ 72KB, 6 escenarios detallados |
| C | `docs/sync-gap-analysis.md` | ✅ 34KB, gap analysis campo por campo |
| C | `docs/sync-architecture.md` | ✅ 49KB, evaluación tecnológica completa |

### Conflictos detectados y resolución

#### ⚠️ C1: Divergencia de nombres SQL vs Python

**Problema**: B/C usan nombres en español para las tablas (`eventos_sync`, `dispositivos`, `empresas`, `movimientos_stock`). Los modelos Python de A usan inglés (`sync_events`, `device_registry`, `companies`, `stock_movements`).

**Resolución**: Los modelos Python son **fuente de verdad** — generan las tablas reales via Alembic en PostgreSQL. Los documentos de B/C representan el diseño conceptual del esquema local (SQLite). Cuando se implemente SQLite local, se usarán los mismos nombres que PostgreSQL para consistencia.

#### ⚠️ C2: Campos faltantes en SyncEvent

**Problema**: El gap analysis de C identifica 11 campos que deberían existir en el evento de sync. Solo 5 están en el modelo Python actual.

| Campo | Estado | Acción |
|---|---|---|
| `idempotency_key` | ❌ Falta | AGREGAR — previene procesamiento duplicado |
| `version` | ❌ Falta | AGREGAR — control de concurrencia optimista |
| `version_catalogo` | ❌ Falta | AGREGAR — detecta precios desactualizados |
| `campos_modificados` | ❌ Falta | AGREGAR — merge a nivel de campo |
| `lote_sync_id` | ❌ Falta | AGREGAR — agrupa eventos del mismo flush |
| `checksum` | ❌ Falta | AGREGAR — verificación de integridad |
| `conflicto_tipo` | ✅ En SyncConflict | OK — mejor en tabla separada |
| `conflicto_resuelto` | ✅ En SyncConflict.resolution | OK |
| `resuelto_por` | ✅ En SyncConflict.resolved_by_id | OK |
| `resuelto_at` | ✅ En SyncConflict.resolved_at | OK |
| `numero_secuencia` | ✅ = sequence_num | OK |

**Resolución**: Agregar los 6 campos faltantes en la próxima iteración, antes de la migración Alembic consolidada.

#### ⚠️ C3: Tablas referenciadas sin modelo Python

| Tabla (docs) | Modelo Python | Estado |
|---|---|---|
| `stock_by_local` | No existe | CREAR — esencial para stock multi-local |
| `bank_reconciliation` | No existe | CREAR en Fase 4 — no bloqueante |
| `contingency_invoices` | Parcial en AfipQueue | Extender AfipQueue con campos contingency |
| `cola_sync` (queue genérica) | No existe | EVALUAR — puede no ser necesaria si syncEngine.js maneja la cola client-side |

**Resolución**: `stock_by_local` se crea inmediatamente (bloquea Fase 1). El resto se crea en la fase correspondiente.

#### ✅ C4: Compatibilidad conflict-resolution.md ↔ sync.py

El algoritmo de resolución de conflictos de C es **100% compatible** con los endpoints de sync.py:
- `POST /sync/push` → recibe eventos (compatible con la cola de C)
- `POST /sync/resolve-conflict/{id}` → resuelve conflictos (compatible con el flujo manual de C)
- Los conflictos se almacenan en `SyncConflict` (tabla separada) en vez de inline en el evento — esto es **mejor** que el diseño original de B porque permite queries independientes de conflictos pendientes.

#### ⚠️ C5: Relación Users↔Companies

**Problema**: `schema-decisions.md` propone tabla N:N `usuario_empresa` para que un usuario trabaje en múltiples empresas. El modelo actual User tiene `company_id` FK simple (1:N).

**Resolución**: Mantener 1:N por ahora. Un usuario pertenece a una empresa. Si el mismo operario trabaja en dos empresas, se crean dos cuentas. La tabla N:N agrega complejidad innecesaria en este punto. Documentar como decisión postergable.

#### ❌ C6: Stack equivocado en schema-decisions.md

**Problema**: La sección 14 de `schema-decisions.md` dice "nuevo stack es Node.js". Esto es **INCORRECTO**.

**Stack real confirmado**: Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL 18.3 (backend), React 19 + Vite 8 + Tailwind v4 (frontend).

**Resolución**: Ignorar esa línea en el documento de C. El stack no va a cambiar.

---

## 7.6 DECISIONES DE NEGOCIO CONFIRMADAS

Decisiones definitivas del dueño del proyecto. No requieren más discusión.

### DN-1: Stock negativo PERMITIDO

La venta **nunca se bloquea** por falta de stock. El sistema:
- Permite la venta
- Registra el stock negativo
- Genera alerta al admin/depósito
- Se resuelve en el próximo inventario físico o ingreso

**Impacto en código**: El endpoint de ventas no valida stock >= 0. Solo emite evento de alerta.

### DN-2: Límite de crédito POR EMPRESA

Un mismo cliente puede tener límites diferentes en cada empresa:
- Mundo Outdoor: $50.000
- TallerEuro: $200.000

**Impacto en código**: Implementado en `CustomerCompany.credit_limit`. Cada empresa tiene su propia relación comercial con el cliente.

### DN-3: Contingencia AFIP con numeración separada

Cuando AFIP no está disponible:
- Se emite comprobante provisional Serie C: C-0001, C-0002...
- Al regularizar, se emite el fiscal y se vincula por referencia
- El cliente se lleva el provisional; luego recibe el fiscal por WhatsApp/email

**Impacto en código**: Campo `contingency_number` en Sale. AfipQueue maneja la cola de regularización.

### DN-4: Fotos OT en servidor propio

- Carpeta local sincronizada al servidor central
- Abstracción de storage (`StorageFile` model) lista para migrar a S3/Cloudflare
- Los dispositivos suben fotos al sync; las fotos se sincronizan en background con baja prioridad

**Impacto en código**: Implementado en `StorageFile` model + `storage_router` endpoints.

### DN-5: Múltiples vehículos por cliente

- Un cliente puede tener N vehículos activos
- Cada OT se vincula a un vehículo específico (vehicle_id FK)
- El vehículo tiene: patente, marca, modelo, año, VIN, km actual

**Impacto en código**: Modelo `Vehicle` creado en customer.py. FALTA agregar `vehicle_id` FK en WorkOrder.

### DN-6: WhatsApp como STUB completo

- Tabla `whatsapp_messages` con todos los campos necesarios
- Cola de envío con reintentos
- La función `sendWhatsApp()` existe pero NO envía hasta configurar token Meta
- Templates pre-diseñados listos:
  - Presupuesto OT listo
  - Vehículo listo para retirar
  - Comprobante de pago
  - Recordatorio de deuda
  - Stock crítico (interno)
  - Recordatorio de service

**Impacto en código**: Modelo `WhatsAppMessage` creado en sync.py.

---

## 7.7 REFERENCIAS A DOCUMENTOS DE B Y C

| Documento | Ubicación | Propósito | Cuándo consultarlo |
|---|---|---|---|
| `docs/conflict-resolution.md` | 72KB | Manual completo de resolución de conflictos offline | Al implementar el sync engine (Fase 2) |
| `docs/sync-gap-analysis.md` | 34KB | Campos que faltan en SyncEvent | Antes de la migración Alembic (Fase 0) |
| `docs/sync-architecture.md` | 49KB | Evaluación de tecnologías de sync, protocolo | Decisiones de arquitectura de sync |
| `docs/schema-decisions.md` | 8KB | 14 decisiones de diseño de esquema | Diseño de tablas nuevas |
| `ARQUITECTURA_OT_SYNC.html` | 71KB | Visualización interactiva de OT + Sync | Explicar arquitectura a stakeholders |
| `ARQUITECTURA_STOCK_FACTURACION.html` | 89KB | Arquitectura de stock + facturación | Planificación de Fase 1 |

---

## 8. PREGUNTAS ABIERTAS

Las siguientes decisiones requieren input del dueño del proyecto antes de avanzar en las fases correspondientes:

### 8.1 Modelo de pricing (afecta Fase 5)

**¿Cómo se cobra el SaaS?**

| Opción | Pros | Contras |
|---|---|---|
| **Por módulo** ($X/mes por módulo activo) | Simple, predecible, el cliente elige lo que necesita | Empresas chicas pagan poco, difícil escalar |
| **Por usuario** ($X/mes por usuario activo) | Escala con el tamaño del cliente | Incentiva a compartir cuentas, difícil controlar |
| **Fee fijo por industria** ($X/mes según rubro) | Muy simple de vender | No refleja uso real, injusto para empresas chicas |
| **Híbrido** (base + módulos + usuarios) | Flexible, captura valor | Complejo de comunicar y facturar |

**Decisión necesaria antes de**: implementar `module_pricing` en Fase 5.

### 8.2 AFIP: ¿Homologación o producción directa? (afecta Fase 3)

- **Homologación primero**: Más seguro, permite testing con datos ficticios, AFIP lo requiere formalmente para nuevos contribuyentes. Demora ~2 semanas adicionales.
- **Producción directa**: Más rápido si ya se tiene CUIT habilitado, pero riesgo de errores con datos reales.
- **Recomendación**: Homologación primero para la primera empresa (TallerEuro). Producción directa para las siguientes si el código ya está probado.

**Decisión necesaria antes de**: configurar certificados AFIP en Fase 3.

### 8.3 Hosting: ¿Local o cloud? (afecta todas las fases)

| Opción | Costo mensual estimado | Pros | Contras |
|---|---|---|---|
| **Servidor local actual** | $0 (ya pagado) | Sin costo, control total, baja latencia local | Sin redundancia, depende de la electricidad/internet del local, sin backup geográfico |
| **VPS Hetzner (ya planificado)** | €10-20/mes | Redundancia, acceso global, backups automáticos | Costo mensual, latencia desde Argentina (~200ms) |
| **Híbrido** (local + VPS) | €10-20/mes | Lo mejor de ambos: opera local cuando hay conexión al servidor local, VPS como fallback y backup | Complejidad de configuración, dos entornos a mantener |

**Decisión necesaria antes de**: configurar deploy en Fase 0.

### 8.4 Retención de datos de sync (afecta Fase 2)

**¿Cuánto tiempo se guardan los eventos en `event_store`?**

- **Opción A**: Indefinido. Crece ~100MB/año por empresa con uso moderado. Simple pero consume storage.
- **Opción B**: 90 días. Suficiente para resolver disputas. Compactar eventos viejos en snapshots.
- **Opción C**: Configurable por empresa. Tabla `company_settings.event_retention_days`.

**Recomendación**: Opción C con default de 180 días. Implementar job de compactación que crea snapshot y borra eventos individuales más viejos que el período configurado.

**Decisión necesaria antes de**: implementar sync completo en Fase 2.

### 8.5 Multi-moneda (afecta Fase 4)

**¿Es necesario soportar múltiples monedas?**

- Empresas actuales operan en ARS (pesos argentinos).
- Algunas distribuidoras compran en USD y venden en ARS.
- Si se necesita: agregar campo `currency` a `sales`, `purchase_orders`, `payment_vouchers`. Tabla `exchange_rates` con cotización diaria.
- Si NO se necesita: todo en ARS, simplifica significativamente la contabilidad.

**Decisión necesaria antes de**: implementar cuenta corriente en Fase 4.

### 8.6 Variaciones impositivas provinciales — IIBB (afecta Fase 3)

**¿Se necesita calcular Ingresos Brutos por provincia?**

- Cada provincia tiene alícuotas diferentes (1% a 5% según actividad).
- Si la empresa opera en una sola provincia: alícuota fija en `company_settings.iibb_rate`.
- Si opera en múltiples provincias (Convenio Multilateral): tabla `provincial_tax_rates` con alícuota por provincia y actividad. Complejidad significativa.
- Impacta en: generación de facturas, reportes fiscales, liquidación mensual.

**Decisión necesaria antes de**: implementar facturación AFIP completa en Fase 3.

### 8.7 Backup de datos offline (afecta Fase 1)

**¿Qué pasa si un dispositivo se rompe con datos no sincronizados?**

| Estrategia | Complejidad | Protección |
|---|---|---|
| **Solo IndexedDB** (actual) | Baja | Ninguna si el dispositivo muere |
| **Export automático a archivo local** | Media | Recuperable si el disco está intacto |
| **Sync a segundo dispositivo vía LAN** | Alta | Redundancia sin internet, pero requiere segundo dispositivo |
| **Backup periódico a USB** (Electron only) | Media | Buena protección, requiere disciplina del usuario |

**Recomendación**: Implementar export automático cada hora a archivo JSON en el directorio de datos de la app (Electron: `userData`, Capacitor: `Documents`). Agregar botón "Backup ahora" en Configuración. Esto cubre el 90% de los casos sin complejidad excesiva.

**Decisión necesaria antes de**: implementar modo offline completo en Fase 1.

---

> **Nota final**: Este documento es un plan vivo. Debe actualizarse al completar cada fase y cuando se tomen las decisiones pendientes de la sección 8. Cada decisión tomada debe marcarse con ✅ y la opción elegida.
