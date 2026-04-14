# DECISIÓN DE ARQUITECTURA — Integración Backend C + Frontend B

> **Fecha**: Abril 2026  
> **Decisor**: Copilot A (Arquitecto)  
> **Estado**: RECOMENDACIÓN EMITIDA → pendiente confirmación del dueño

---

## CONTEXTO

Dos agentes Copilot construyeron subsistemas para el mismo problema (ERP para TallerEuro):

### Lo que construyó Copilot B (eurotaller-cassano/)

| Aspecto | Detalle |
|---|---|
| **Stack** | React 18 + TypeScript + Tailwind + Zustand + Zod |
| **DB** | Supabase (PostgreSQL hosted + Auth + RLS) |
| **Schema** | 24 tablas con RLS, triggers, sequences, validación de patente |
| **Frontend** | Dashboard, OT (CRUD completo), Clientes, Stock, Login |
| **Páginas reales** | 6 funcionales + 9 placeholders |
| **Offline** | ❌ NO tiene. Todo conecta directo a Supabase. |
| **Multi-empresa** | ❌ NO tiene. Single-tenant. |
| **Sync** | ❌ NO tiene. |
| **Ventaja clave** | Frontend de taller muy completo y funcional (OT con 7 estados, checklist vehicular, presupuestos, turnos, comprobantes AFIP) |

### Lo que construyó Copilot C (erp/backend/)

| Aspecto | Detalle |
|---|---|
| **Stack** | Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic |
| **DB** | PostgreSQL propio (puerto 2048) |
| **Schema** | 26 modelos SQLAlchemy (40+ tablas cuando se migre) |
| **Frontend** | erp/frontend/ — React 19 + Vite 8 + Tailwind v4 (30 páginas, mayoría funcional para Mundo Outdoor) |
| **Offline** | ✅ SÍ. IndexedDB, outbox, Service Worker, fetchWithFallback |
| **Multi-empresa** | ✅ SÍ. company_id en toda tabla, RBAC con 12 roles |
| **Sync** | ✅ SÍ. Event sourcing con HANDLERS (stock, OT, clientes, ventas). CRDT para stock. |
| **Ventaja clave** | Sync engine funcional con resolución de conflictos field-level, merge strategies, sobreventa DN-1 |

---

## LAS 3 OPCIONES

### OPCIÓN A — Supabase como DB central

```
eurotaller-cassano (frontend B)
        ↓ directo
    Supabase (PostgreSQL hosted)
        ↑ sync engine C adaptado
erp/backend (FastAPI) ─→ Lee/escribe Supabase
```

| Pro | Contra |
|---|---|
| Frontend B ya conecta a Supabase | Supabase Auth ≠ nuestro JWT auth. Reescribir TODO el auth. |
| RLS de Supabase da seguridad extra | RLS es single-tenant. Multi-empresa requiere reescribir TODAS las policies. |
| Hosting incluido | **OFFLINE IMPOSIBLE con Supabase.** supabase-js NO tiene modo offline. Sin PouchDB/ReplicaciónQL. |
| | Sync engine de C usa transacciones SERIALIZABLE + FOR UPDATE. Supabase RLS NO permite FOR UPDATE desde el cliente. |
| | Doble costo: Supabase free tier tiene límite de 500MB y 50K auth requests/mes |
| | Vendor lock-in fuerte |

**VEREDICTO**: ❌ **DESCARTADA**. Supabase no soporta offline-first, que es requisito NO NEGOCIABLE. La RLS de Supabase es para apps online single-tenant. Nuestro sync engine necesita transacciones SERIALIZABLE server-side que Supabase no permite desde el cliente.

---

### OPCIÓN B — Mantener separados, B como frontend de TallerEuro

```
eurotaller-cassano (frontend B)
        ↓ REST API
erp/backend (FastAPI + sync engine C)
        ↓ SQLAlchemy
    PostgreSQL propio (puerto 2048)
```

| Pro | Contra |
|---|---|
| **Frontend B ya está hecho** — OT con 7 estados, clientes, stock, dashboard | Hay que **reemplazar TODA la capa de datos** de B: de `supabase.from('tabla')` a `fetch('/api/v1/...')` |
| **Backend C ya tiene sync + offline + multi-empresa** | TypeScript (B) vs JavaScript (C frontend). Dos lenguajes en frontend. |
| Supabase se abandona → $0 hosting extra | Tipos TypeScript de B (24 interfaces) no coinciden con schemas Python de C |
| Un solo PostgreSQL para todo | React 18 (B) vs React 19 (C). Diferente versión. |
| Sync engine funciona tal cual | Tailwind 3 (B) vs Tailwind 4 (C). Diferente versión. |
| Auth unificado (JWT existente) | Zustand (B) vs TanStack Query (C). Diferente state management. |
| Multi-empresa gratis — el backend ya lo tiene | El **esfuerzo de migración de B es alto**: ≈40 archivos con queries Supabase directas que hay que reescribir |

**VEREDICTO**: ⚠️ **VIABLE PERO COSTOSA**. Funciona conceptualmente, pero el esfuerzo de migrar B es casi equivalente a reconstruir las páginas desde cero dentro del frontend de C.

---

### OPCIÓN C — Supabase reemplaza al backend

```
eurotaller-cassano (frontend B)
        ↓ directo
    Supabase (DB + Auth + Edge Functions)
```

| Pro | Contra |
|---|---|
| Stack más simple (solo Supabase) | **Se pierde TODO el sync engine** (573 líneas de handlers con lógica de conflictos, merge field-level, DN-1, AFIP queueing) |
| Frontend B no cambia | **Se pierde offline-first** (Edge Functions requieren internet) |
| | **Se pierde multi-empresa** (RLS de Supabase no tiene company_id nativo) |
| | **Se pierden 26 modelos SQLAlchemy** + 40 routers + servicios |
| | Edge Functions son Deno, no Python → reescribir TODO |
| | Latencia desde Argentina a Supabase (~200ms) vs PostgreSQL local (~1ms) |

**VEREDICTO**: ❌ **DESCARTADA**. Destruye 3 meses de trabajo del sync engine y viola los 2 requisitos no negociables (offline + multi-empresa).

---

## RECOMENDACIÓN: OPCIÓN D — Absorber lo valioso de B dentro de C

Ninguna de las 3 opciones es óptima. La opción correcta es una cuarta:

```
erp/frontend/ (React 19 + Vite 8 + Tailwind v4)
   └── src/pages/ot/  ← RECONSTRUIDO inspirado en B
   └── src/pages/taller/ ← NUEVO módulo taller
        ↓ REST API (api.js existente)
erp/backend/ (FastAPI + sync engine + handlers)
        ↓ SQLAlchemy + Alembic
    PostgreSQL propio (puerto 2048)
```

### Qué se toma de B (el DISEÑO, no el código):

| De B | Se usa en C como |
|---|---|
| **Modelo de datos de taller** (24 tablas) | Referencia para validar completitud de work_order.py. B tiene campos que C no: `checklist vehicular`, `nivel combustible`, `firma cliente`, `fotos estado inicial` |
| **Estados de OT** (7 estados prácticos) | Validar contra los 10 estados de C. B es más simple y probablemente más real para un taller chico. |
| **Tipos TypeScript** (473 líneas) | Referencia de UI contracts. Los enums de B (CondicionIva, MedioPago, UnidadMedida) se incorporan al backend si faltan. |
| **UX de OT** (OTNewPage 318 líneas, OTDetailPage 258 líneas) | Inspiración directa para reconstruir en el frontend de C con los hooks existentes (useQuery, useMutation, useOffline) |
| **Dashboard de taller** (241 líneas con stats) | Referencia para DashboardPage del módulo taller |
| **Validaciones argentinas** (CUIT, patente, formato moneda) | Copiar `validarCuit()`, `validarPatente()`, `formatARS()` al frontend de C |
| **Naming de archivos PDF** | Copiar convención `generarNombrePDF()` |
| **Sequences para numeración** | seq_numero_ot, seq_numero_presupuesto ya están en C vía Python sequences |

### Qué se descarta de B:

| Descartado | Razón |
|---|---|
| Supabase como backend | No soporta offline-first |
| supabase.ts + todas las queries directas | Se reemplazan por api.js + TanStack Query |
| Supabase Auth | Se usa JWT existente de C |
| RLS policies | Multi-tenant via company_id en queries Python |
| Zustand auth store | Se usa AuthContext de C |
| React 18, Vite 6, Tailwind 3 | Se usa React 19, Vite 8, Tailwind 4 de C |

### Esfuerzo estimado:

| Tarea | Complejidad |
|---|---|
| Revisar campos de B que faltan en work_order.py y agregar | Baja (1-2 horas) |
| Copiar utilidades argentinas (CUIT, patente, moneda) al frontend C | Baja (30 min) |
| Reconstruir OTNewPage en React 19 + TanStack Query + useOffline | Media (4-6 horas) |
| Reconstruir OTListPage con filtros | Media (3-4 horas) |
| Reconstruir OTDetailPage con tabs | Media (3-4 horas) |
| Reconstruir Dashboard taller | Baja (2-3 horas) |
| **Total** | **~15-20 horas** |

Comparar con migrar B completo (reescribir 40 archivos de Supabase→API): **~30-40 horas** y termina con código Frankenstein (dos stacks mezclados).

---

## DECISIÓN FINAL

### ✅ OPCIÓN D: Absorber diseño de B → reconstruir en stack de C

**Justificación en una línea**: Es más rápido y limpio reconstruir 6 páginas de taller en el stack que ya tiene offline+sync+multi-empresa, que migrar 40 archivos de un stack incompatible.

### Razones ordenadas por peso:

1. **Offline-first es no negociable** → Solo C lo tiene
2. **Multi-empresa es no negociable** → Solo C lo tiene  
3. **El sync engine es el asset más valioso** → 573 líneas de handlers probados con 4 strategies (SERVER_WINS, LWW, MERGE_APPEND, MANUAL)
4. **El frontend de C ya tiene 30 páginas** → agregar 6 más es incremental
5. **B aporta DISEÑO invaluable** → los tipos TypeScript, la UX de OT, y las validaciones argentinas se aprovechan sin el código Supabase

### Lo que pasa con eurotaller-cassano/:

- **NO se borra** — queda como referencia de diseño
- Se crea `docs/REFERENCIA_EUROTALLER_B.md` cuando se reconstruyan las páginas
- El schema SQL de B se usa para validar completitud del modelo Python

---

## ACCIONES INMEDIATAS

1. **Copiar utilidades de B al frontend C**:
   - `validarCuit()`, `validarPatente()`, `formatARS()`, `formatFecha()`, `formatCuit()` → `erp/frontend/src/lib/utils-ar.js`
   - `generarNombrePDF()` → `erp/frontend/src/lib/pdf-naming.js`
   - `ESTADO_OT_LABEL`, `ESTADO_OT_COLOR` → `erp/frontend/src/lib/ot-constants.js`

2. **Revisar campos faltantes en work_order.py** comparando con B:
   - `checklist vehicular` (nivel_combustible, carroceria_estado, accesorios, vidrios_ok, tapizado_ok, firma_cliente) → `WorkOrderChecklist` ya existe en C pero verificar campos
   - `nombre_archivo_pdf` en OT → agregar si falta
   - `turno_id` FK → agregar cuando se implemente módulo turnos

3. **Agregar a MODULES_CATALOG**: Verificar que el módulo TURNOS existe como stub

4. **Marcar eurotaller-cassano/ como referencia**:
   - No incluir en builds
   - No incluir en deploys
   - Sí incluir en git como documentación viva

---

## DIAGRAMA DE ARQUITECTURA FINAL

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTES                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Mundo    │  │ Taller   │  │ Ferreyra │  ...N más    │
│  │ Outdoor  │  │ Euro     │  │          │              │
│  │ (Ropa)   │  │ (Taller) │  │ (Distrib)│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│       └──────────────┼──────────────┘                    │
│                      ↓                                   │
│         erp/frontend/ (React 19)                        │
│         ┌─────────────────────────┐                     │
│         │ Módulos por rubro:      │                     │
│         │ • Stock (ropa/repuestos)│                     │
│         │ • OT (solo taller)     │                     │
│         │ • Facturación          │                     │
│         │ • CRM unificado        │                     │
│         │ • useOffline() hooks   │                     │
│         │ • syncEngine.js        │                     │
│         │ • IndexedDB local      │                     │
│         └───────────┬─────────────┘                     │
│                     ↓ REST API                          │
│         erp/backend/ (FastAPI)                          │
│         ┌─────────────────────────┐                     │
│         │ • 40+ routers          │                     │
│         │ • Sync handlers (CRDT) │                     │
│         │ • Multi-tenant RBAC    │                     │
│         │ • AFIP queue           │                     │
│         │ • Module system        │                     │
│         └───────────┬─────────────┘                     │
│                     ↓ SQLAlchemy                        │
│            PostgreSQL (puerto 2048)                     │
│         ┌─────────────────────────┐                     │
│         │ • 40+ tablas           │                     │
│         │ • company_id scoping   │                     │
│         │ • Event store          │                     │
│         │ • Conflict tracking    │                     │
│         └─────────────────────────┘                     │
│                                                         │
│  eurotaller-cassano/ (REFERENCIA — no se ejecuta)      │
│  └── Diseño de UX, tipos, validaciones → se copian     │
└─────────────────────────────────────────────────────────┘
```
