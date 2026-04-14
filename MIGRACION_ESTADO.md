# 🔄 MIGRACIÓN CONTROL REMITOS → ERP MUNDO OUTDOOR

> **Última actualización:** 7 de Abril 2026 — SPRINT COMPLETO: 15/15 tareas ✅
> **Sistema origen:** `ULTIMO CONTROL/` (FastAPI + React TS, SQLite, puerto 9972/5173)
> **Sistema destino:** `erp/` (FastAPI + React JSX, PostgreSQL 2048, puerto 8000/5174)

---

## 📊 RESUMEN GENERAL

| Categoría | Total módulos | ✅ Migrado | ⚠️ Parcial | ❌ Falta | % Completado |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **Backend - Endpoints** | 21 grupos | 14 | 3 | 4 | ~67% |
| **Frontend - Páginas** | 22 páginas | 16 | 4 | 2 | ~73% |
| **Componentes clave** | 12 componentes | 3 | 2 | 7 | ~25% |
| **Base de datos** | 20 tablas | 18 | 0 | 2 | ~90% |
| **Funcionalidades críticas** | 15 funciones | 5 | 4 | 6 | ~33% |

---

## ✅ YA MIGRADO (Funciona en el ERP nuevo)

### Backend API
| Módulo | Endpoint ERP nuevo | Estado |
|--------|-------------------|--------|
| Auth (login, /me, password) | `/api/v1/auth` | ✅ Completo |
| Usuarios CRUD | `/api/v1/users` | ✅ Completo |
| Locales CRUD | `/api/v1/locals` | ✅ Completo |
| Proveedores CRUD + contactos + retenciones | `/api/v1/providers` | ✅ Completo |
| Productos + Variantes + Import Excel | `/api/v1/products` | ✅ Completo |
| Ingresos (remitos/facturas compra legacy) | `/api/v1/ingresos` | ✅ Completo |
| Pedidos legacy | `/api/v1/pedidos` | ✅ Completo |
| Notas de Pedido v2 (PRE/REP/CAMBIO) | `/api/v1/purchase_orders` | ✅ Completo |
| Facturas Proveedor + semáforo | `/api/v1/purchase_invoices` | ✅ Completo |
| Gestión Pagos + retenciones + NC | `/api/v1/payments` | ✅ Completo |
| Stock (consulta, ajuste, movimientos) | `/api/v1/stock` | ✅ Completo |
| Ventas/Facturación | `/api/v1/sales` | ✅ Completo |
| Transportes + envíos | `/api/v1/transports` | ✅ Completo |
| Kanban TrellOutdoor | `/api/v1/kanban` | ✅ Completo |
| Notificaciones + auditoría | `/api/v1/notifications` | ✅ Completo |
| Listas de Precios | `/api/v1/price_lists` | ✅ Completo |
| Config Menú dinámico | `/api/v1/menu_config` | ✅ Completo |
| PDF Parser (extracción OCR) | `/api/v1/pdf_parser` | ✅ Completo |
| SQL Server bridge (Tango) | `/api/v1/sql_server` | ✅ Completo |
| System health + métricas | `/api/v1/system` | ✅ Completo |

### Frontend Páginas
| Página ERP nuevo | Equivalente legacy | Estado |
|------------------|--------------------|--------|
| LoginPage | Login.tsx | ✅ Completo |
| DashboardPage | Admin.tsx (Resumen) | ✅ Estructura lista |
| ProductosPage | (no tenía) | ✅ Nuevo módulo |
| ProveedoresPage | ProveedoresTab.tsx | ✅ Completo |
| LocalesPage | Locales.tsx | ✅ Completo |
| UsuariosPage | Usuarios.tsx | ✅ Completo |
| IngresoPage | HomeReal.tsx (parcial) | ✅ Completo |
| PedidosPage | Pedidos.tsx | ✅ Estructura lista |
| PedidosComprasPage | ResumenTab.tsx | ✅ Completo |
| FacturasProveedorPage | FacturasTab.tsx | ✅ Completo |
| GestionPagosPage | GestionPagosTab.tsx | ✅ Completo |
| KanbanPage | TrellOutdoorTab.tsx | ✅ Completo |
| StockPage | (no tenía) | ✅ Nuevo módulo |
| FacturacionPage | (no tenía) | ✅ Nuevo módulo |
| MonitoreoPage | (métricas sistema) | ✅ Completo |
| ConfiguradorMenuPage | (nuevo) | ✅ Completo |

### Base de datos
| Tabla legacy (SQLite) | Modelo ERP (PostgreSQL) | Estado |
|-----------------------|------------------------|--------|
| USUARIOS | User | ✅ + más roles (10 vs 4) |
| PROVEEDORES | Provider + ProviderContact | ✅ + retenciones |
| LOCALES | Local | ✅ |
| NOTA_PEDIDO | PurchaseOrder | ✅ + tipos PRE/REP/CAMBIO |
| FACTURAS | PurchaseInvoice + PurchaseInvoiceItem | ✅ + semáforo |
| REMITOS | (integrado en PurchaseInvoice) | ✅ |
| COMPROBANTES_PAGO | PaymentVoucher + PaymentInvoiceLink | ✅ |
| NOTAS_CREDITO | CreditNote | ✅ |
| CUENTAS_BANCARIAS | BankAccount | ✅ |
| LISTA_PRECIOS_ARCHIVO | PriceList | ✅ |
| LISTA_PRECIOS_ITEM | (items en PriceList) | ✅ |
| TRANSPORTES | Transport | ✅ |
| REGISTRO_ENVIOS | Shipment | ✅ |
| TRELLO_BOARDS/COLUMNS/CARDS | KanbanBoard/Column/Card | ✅ |
| NOTIFICACIONES | Notification | ✅ |
| HISTORIAL | (audit en Notification) | ✅ |
| CONFIGURACION_MAIL | MailConfig | ✅ |
| (no tenía) | Product + ProductVariant | ✅ NUEVO |
| (no tenía) | Sale + SaleItem | ✅ NUEVO |
| (no tenía) | StockMovement | ✅ NUEVO |

---

## ⚠️ PARCIALMENTE MIGRADO (Existe pero incompleto)

### 1. Resumen / Dashboard con métricas reales
| Aspecto | Legacy | ERP nuevo | Qué falta |
|---------|--------|-----------|-----------|
| Contadores totales | ✅ Total pedidos/facturas/remitos | ⚠️ Placeholders "—" | Conectar queries reales |
| Alertas reposición | ✅ Alertas por días sin factura | ❌ No tiene | Agregar lógica de alertas |
| Estado semáforo global | ✅ VERDE/ROJO por nota | ⚠️ Solo en facturas | Agregar vista resumen |

### 2. Recepción en Locales (HomeReal → RecepcionPage)
| Aspecto | Legacy | ERP nuevo | Qué falta |
|---------|--------|-----------|-----------|
| Lista remitos por local | ✅ Completo | ⚠️ Página existe | Implementar vista de local con confirmar/desconfirmar |
| Confirmar llegada | ✅ INGRESO: SI/NO/PARCIAL | ❌ | Botón confirmar + mutation |
| Ingreso parcial + foto | ✅ + foto evidencia | ❌ | Upload foto + estado PARCIAL |
| Barcode search | ✅ Debounced 400ms | ❌ | Buscador por código |
| Registrar transporte | ✅ Carta porte, kg, etc. | ❌ | Formulario de envío |

### 3. Consultas (ConsultasPage)
| Aspecto | Legacy | ERP nuevo | Qué falta |
|---------|--------|-----------|-----------|
| Búsqueda artículos | ✅ Por código/nombre | ⚠️ Página existe | Implementar búsqueda real |
| Búsqueda precios | ✅ Lista precios + SQL Server | ❌ | Conectar listas + SQL |
| Búsqueda stock | ✅ Stock por local | ⚠️ Stock existe | Integrar consulta por local |

### 4. Reportes (ReportesPage)
| Aspecto | Legacy | ERP nuevo | Qué falta |
|---------|--------|-----------|-----------|
| Historia proveedor | ✅ Movimientos + saldo acumulado | ❌ | HistoriaProveedor completo |
| Stats proveedores | ✅ Ranking días entrega | ❌ | Endpoint + gráficos |
| Exportar datos | ✅ | ❌ | Descargas CSV/Excel |

---

## ❌ FALTA MIGRAR (No existe en el ERP nuevo)

### PRIORIDAD ALTA 🔴

#### 1. ExcelViewer — Visor de Excel inline
- **Legacy:** `ExcelViewer.tsx` — Muestra archivos Excel con tabs por hoja
- **Usado en:** Pedidos, Resumen, Comparadores
- **Qué hacer:** Crear componente React que lea Excel (usar SheetJS/xlsx) y muestre como tabla
- **Archivos legacy:** `frontend/src/components/ExcelViewer.tsx`

#### 2. PdfViewer — Visor de PDF inline
- **Legacy:** `PdfViewer.tsx` — Muestra PDFs en iframe con botón descarga
- **Usado en:** Facturas, Remitos, Historia proveedor
- **Qué hacer:** Crear componente modal con iframe + botones download/abrir
- **Archivos legacy:** `frontend/src/components/PdfViewer.tsx`

#### 3. ExcelConPreciosViewer — Excel con precios anotados
- **Legacy:** `ExcelConPreciosViewer.tsx` — Muestra Excel de pedido + precios de lista
- **Usado en:** ResumenTab al expandir nota
- **Qué hacer:** Componente que cruza items del pedido con lista de precios
- **Archivos legacy:** `frontend/src/components/ExcelConPreciosViewer.tsx`

#### 4. ComparadorCruzado — Cruce de documentos
- **Legacy:** `ComparadorCruzado.tsx` + endpoint `/comparar/cruce-documentos`
- **Función:** Compara cantidad/precio entre Pedido → Factura → Remito
- **Tabs:** OK / Con Diferencia / SQL
- **Qué hacer:** Replicar lógica de cruce en backend + componente React
- **Archivos legacy:**
  - Frontend: `frontend/src/components/ComparadorCruzado.tsx`
  - Backend: `SISTEMA PEDIDOS/servidor/ENDPOINTS/comparar.py` (113 KB)

#### 5. CargaMasiva — Upload masivo de PDFs
- **Legacy:** `CargaMasiva.tsx` + endpoint `/comparar/extraer-pdf`
- **Función:** Sube múltiples PDFs → OCR extrae datos → Detecta duplicados → Vincula remitos↔facturas
- **Qué hacer:** Componente drag & drop + lógica OCR en backend
- **Archivos legacy:**
  - Frontend: `frontend/src/components/CargaMasiva.tsx`
  - Backend: `SISTEMA PEDIDOS/servidor/ENDPOINTS/comparar.py`

#### 6. CargaAvanzada — Upload inteligente con matching
- **Legacy:** `CargaAvanzada.tsx`
- **Función:** Upload PDF → Detecta proveedor (MIDING/MONTAGNE) → Matchea con nota → Agrupa por proveedor → Cruce automático
- **Qué hacer:** Replicar lógica de detección + matching
- **Archivos legacy:** `frontend/src/components/CargaAvanzada.tsx`

### PRIORIDAD MEDIA 🟡

#### 7. ComparadorPreciosViewer — Comparar precios factura vs pedido
- **Legacy:** `ComparadorPreciosViewer.tsx` + endpoint `/comparar/nota/{notaId}/factura/{id}/precios`
- **Función:** Muestra variaciones de precio (aumento/baja %) entre pedido y factura
- **Qué hacer:** Endpoint de comparación + componente con highlights
- **Archivos legacy:** `frontend/src/components/ComparadorPreciosViewer.tsx`

#### 8. ComparadorListaFacturas — Lista precios vs facturas
- **Legacy:** `ComparadorListaFacturas.tsx`
- **Función:** Sube lista de precios Excel → Compara contra todas las facturas del proveedor → Detecta discrepancias
- **Estados:** OK / FACTURA_MAYOR / FACTURA_MENOR / SIN_FACTURA
- **Archivos legacy:** `frontend/src/components/ComparadorListaFacturas.tsx`

#### 9. ComparadorOmbak — Comparar pedido Ombak
- **Legacy:** `ComparadorOmbak.tsx` + endpoint `/ombak/comparar-nota/{notaId}`
- **Función:** Compara Excel de pedido vs PDF de orden Ombak
- **Archivos legacy:** `frontend/src/components/ComparadorOmbak.tsx`

#### 10. HistoriaProveedor — Historial completo por proveedor
- **Legacy:** `HistoriaProveedor.tsx` + endpoint `/proveedores/{id}/historia`
- **Función:** Listado de movimientos (facturas, NC, pagos) con saldo acumulado y filtro por fechas
- **Qué hacer:** Endpoint que cruza PaymentVoucher + PurchaseInvoice + CreditNote y componente con tabla + totales
- **Archivos legacy:** `frontend/src/components/HistoriaProveedor.tsx`

#### 11. CrucePreciosModal — Modal cruce precios en pagos
- **Legacy:** `CrucePreciosModal.tsx` + endpoint `/listas/{id}/cruce/{facturaId}`
- **Función:** Desde gestión de pagos, sube lista de precios y cruza contra factura específica
- **Archivos legacy:** `frontend/src/components/CrucePreciosModal.tsx`

### PRIORIDAD BAJA 🟢

#### 12. ChatWidget — Asistente IA integrado
- **Legacy:** `ChatWidget.tsx` + endpoint `/agent/chat` (Claude via OpenRouter)
- **Función:** Chat flotante que puede consultar datos del sistema
- **Qué hacer:** Decidir si integrar (requiere API key de LLM)
- **Archivos legacy:** `frontend/src/components/ChatWidget.tsx`

#### 13. ACCESOS LOCALES — Shortcuts por local
- **Legacy:** 11 archivos .bat para cada local (Montagne MDP, Bahia Blanca, etc.)
- **ERP nuevo:** Tiene instalador (`Instalador ERP/`) que ya genera accesos directos
- **Estado:** ⚠️ El instalador nuevo reemplaza esto pero falta parámetro de local

#### 14. Carpeta Compartida — File sync server
- **Legacy:** `CARPETA_COMPARTIDA/servidor.py` — Mini servidor de archivos en puerto 9980
- **ERP nuevo:** No tiene equivalente directo
- **Qué hacer:** Evaluar si se necesita (quizás storage local o S3)

---

## 📋 PLAN DE ACCIÓN — Orden de implementación

### Fase 1: Componentes base (1-2 días)
1. ☐ **ExcelViewer** — Componente React (SheetJS/xlsx)
2. ☐ **PdfViewer** — Componente modal con iframe
3. ☐ **Upload masivo** — Drag & drop de múltiples archivos

### Fase 2: Cruces de documentos (2-3 días)
4. ☐ **ComparadorCruzado** — Backend endpoint + componente React
5. ☐ **CargaMasiva** — Lógica OCR + detección duplicados
6. ☐ **CargaAvanzada** — Matching inteligente por proveedor

### Fase 3: Comparadores de precios (1-2 días)
7. ☐ **ExcelConPreciosViewer** — Pedido + lista precios
8. ☐ **ComparadorPreciosViewer** — Factura vs pedido
9. ☐ **ComparadorListaFacturas** — Lista vs facturas

### Fase 4: Funcionalidades de recepción (1-2 días)
10. ☐ **RecepcionPage completa** — Confirmar/desconfirmar llegada, parcial + foto
11. ☐ **Barcode scanner** — Búsqueda por código de barras
12. ☐ **Registro transporte** — Carta porte, kg aforados

### Fase 5: Reportes y consultas (1-2 días)
13. ☐ **HistoriaProveedor** — Movimientos + saldo acumulado
14. ☐ **Dashboard real** — Métricas conectadas a datos reales
15. ☐ **ReportesPage** — Stats proveedores + exportar

### Fase 6: Extras (1 día)
16. ☐ **ComparadorOmbak** — Cruce específico Ombak
17. ☐ **CrucePreciosModal** — Modal de cruce en pagos
18. ☐ **ConfigPage** — Configuración empresa/mail

---

## 📁 ARCHIVOS DE REFERENCIA EN EL SISTEMA LEGACY

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/comparar.py` | **113 KB** | TODA la lógica de cruces, OCR, parsing PDF |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/facturas.py` | **72 KB** | Lógica completa de facturas/remitos |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/gestion_pagos.py` | ~30 KB | Gestión de pagos y retenciones |
| `frontend/src/pages/admin/ResumenTab.tsx` | ~40 KB | Tab principal de monitoreo |
| `frontend/src/pages/admin/FacturasTab.tsx` | ~50 KB | Tab de ingresos (9 secciones) |
| `frontend/src/pages/admin/RemitosTab.tsx` | ~35 KB | Tab de recepción |
| `frontend/src/pages/admin/GestionPagosTab.tsx` | ~30 KB | Tab de pagos |
| `frontend/src/pages/HomeReal.tsx` | ~45 KB | Vista de local completa |
| `frontend/src/components/ComparadorCruzado.tsx` | ~20 KB | Cruce de documentos |
| `frontend/src/components/CargaMasiva.tsx` | ~15 KB | Upload masivo |
| `frontend/src/components/CargaAvanzada.tsx` | ~15 KB | Upload inteligente |

---

## 🔑 DIFERENCIAS CLAVE ENTRE SISTEMAS

| Aspecto | Legacy (Control Remitos) | ERP Nuevo |
|---------|------------------------|-----------|
| Base de datos | SQLite (archivo único) | PostgreSQL (puerto 2048) |
| Lenguaje frontend | TypeScript | JavaScript (JSX) |
| Framework HTTP | Axios | fetch() nativo |
| Multi-empresa | NO (single tenant) | SÍ (company_id en todo) |
| Roles | 4 (SUPERVISOR, ADMIN, COMPRAS, LOCAL) | 10+ roles |
| Productos/Variantes | NO tiene catálogo propio | SÍ (talle/color/SKU/barcode) |
| Facturación ventas | NO | SÍ (FACTURA_A/B, TICKET, NC) |
| Stock | NO tiene stock propio | SÍ (movimientos, ajustes) |
| PWA/Offline | NO | SÍ (IndexedDB + SW) |
| API puerto | 9972 | 8000 |
| Frontend puerto | 5173 | 5174 |
