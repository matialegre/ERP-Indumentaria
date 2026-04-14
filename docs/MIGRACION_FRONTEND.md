# docs/MIGRACION_FRONTEND.md
# Plan de Migración Frontend: eurotaller-cassano → erp/frontend

> **Decisión de arquitectura:** Opción D confirmada
> El frontend de B (`eurotaller-cassano/`) es un **diseño de referencia**, no código a ejecutar.
> Se absorben sus UX patterns, validadores argentinos y state machine de OT.
> Todo se reconstruye en el stack C: React 19 + Vite 8 + Tailwind 4 + TanStack Query v5.
>
> **Documento relacionado:** `docs/DECISION_ARQUITECTURA.md`

---

## SECCIÓN 1 — QUÉ SE PORTA TAL CUAL

Componentes y lógica con **cero dependencias de Supabase** — se copian directamente o con mínimos cambios de nombre.

### 1.1 — Utilidades argentinas (`types/index.ts` → `src/lib/utils-ar.js`)

Todo el bloque de helpers del final de `types/index.ts` es puro JavaScript. **Sin Supabase. Sin TypeScript obligatorio.**

```js
// src/lib/utils-ar.js — copiar de eurotaller-cassano/src/types/index.ts líneas 456–528
export function validarCuit(cuit) { ... }          // Algoritmo dígito verificador AFIP
export function validarPatente(patente) { ... }    // Regex mercosur + vieja
export function formatARS(value) { ... }           // Intl.NumberFormat ARS
export function formatFecha(date) { ... }          // dd/mm/yyyy
export function formatCuit(cuit) { ... }           // XX-XXXXXXXX-X
export function generarNombrePDF(tipo, numero, fecha) { ... }
```

**También copiar las constantes de estados OT:**
```js
export const ESTADO_OT_LABEL = { ... }   // 7 estados → labels en español
export const ESTADO_OT_COLOR = { ... }   // estado → clase Tailwind (bg-green-100 etc.)
```

**Esfuerzo:** 30 min. Sin dependencias externas.

---

### 1.2 — Componente `StatCard` (`DashboardPage.tsx` líneas 252–261 → `src/components/ui/StatCard.jsx`)

El StatCard de B es un componente reutilizable sin lógica de datos:
```jsx
// B (TypeScript + iconos)            // C (JSX + Lucide importado)
<StatCard
  title="OTs Activas"
  value={stats.otActivas}
  icon={Wrench}
  color="bg-blue-500"
/>
```
Cambio: quitar las anotaciones TypeScript `: React.FC<...>`. Código idéntico.

**Esfuerzo:** 15 min.

---

### 1.3 — Constantes de máquina de estado OT (`OTDetailPage.tsx` → `src/lib/ot-machine.js`)

En B, `TRANSICIONES` es un Record hardcodeado en el componente. Extraer como módulo:
```js
// src/lib/ot-machine.js
// Mapeo de estados C (backend) ↔ estados B (UI)
export const OT_STATUS_MAP = {
  RECEPCION:      'recibido',
  DIAGNOSTICO:    'diagnostico',
  PRESUPUESTO:    'esperando_repuestos',
  APROBACION:     'esperando_repuestos',
  EN_EJECUCION:   'en_reparacion',
  CONTROL_CALIDAD:'listo',
  ENTREGA:        'listo',
  CERRADO:        'entregado',
  CANCELADO:      'cancelado',
};

// Cuál botón mostrar en cada estado (extraído de TRANSICIONES de B)
export const OT_TRANSICIONES = {
  recibido:           { label: 'Iniciar diagnóstico', next: 'diagnostico' },
  diagnostico:        { label: 'Enviar presupuesto',  next: 'esperando_repuestos' },
  esperando_repuestos:{ label: 'Iniciar reparación',  next: 'en_reparacion' },
  en_reparacion:      { label: 'Marcar como listo',   next: 'listo' },
  listo:              { label: 'Registrar entrega',   next: 'entregado' },
};
```

**DIFERENCIA CRÍTICA:** B tiene 7 estados, C tiene 10.
- Solución: el frontend muestra la vista simplificada de B (7 estados).
- Internamente usa el endpoint `POST /api/v1/work-orders/{id}/advance` del backend C.
- La UI no necesita saber de PRESUPUESTO vs APROBACION — solo "esperando repuestos".

**Esfuerzo:** 45 min.

---

### 1.4 — UI de `ClientesPage` (95% portable)

B: 87 líneas, tabla simple, un solo `supabase.from('clientes').select(*)`.
C: reemplazar 1 línea.

```js
// B — eliminar:
const { data: clientes } = await supabase.from('clientes').select('*')

// C — reemplazar con:
const { data: clientes } = useQuery({
  queryKey: ['customers'],
  queryFn: () => api.get('/customers/')
})
```

El resto (tabla, búsqueda, modal de detalle) queda igual excepto:
- UUID ids (B) → integer ids (C): usar `cliente.id` como número
- Campo `nombre` (B) → `full_name` (C): ajustar en la tabla

**Esfuerzo:** 1.5h.

---

### 1.5 — UI de `StockPage` para taller (90% portable)

B: 109 líneas, lista con filtro "stock crítico", `supabase.from('articulos').select(*)`.
C backend devuelve productos con variantes. Necesita transformar el shape pero la UI es idéntica.

```js
// C — query hacia backend:
const { data: articulos } = useQuery({
  queryKey: ['taller-stock'],
  queryFn: () => api.get('/stock/?company_type=MECANICO')
})
// transformar: { variant_id, sku, product_name, stock, min_stock, unit } → misma tabla
```

**Esfuerzo:** 2h.

---

## SECCIÓN 2 — QUÉ SE ADAPTA

Páginas que requieren reescritura parcial por: Supabase realtime, múltiples inserts secuenciales, supabase.rpc(), o auth context distinto.

---

### 2.1 — `OTNewPage` (reescritura del data layer, UI se preserva)

**En B:** 3 inserts secuenciales + 2 useEffect para cargar dropdowns:
```ts
// B: insertar OT primero, obtener ID, luego insertar items
const { data: ot } = await supabase.from('ordenes_trabajo').insert(otData).select().single()
await supabase.from('items_mano_obra').insert(items.map(i => ({...i, ot_id: ot.id})))
await supabase.from('items_repuesto').insert(repuestos.map(r => ({...r, ot_id: ot.id})))
```

**En C:** 1 solo `useMutation` que envía la OT completa con items anidados:
```js
// C: todo en un POST, el backend maneja la transacción
const mutation = useMutation({
  mutationFn: (formData) => api.post('/work-orders/', {
    ...formData,
    items: [
      ...formData.manoObra.map(i => ({ type: 'MANO_DE_OBRA', ...i })),
      ...formData.repuestos.map(r => ({ type: 'REPUESTO', ...r })),
    ]
  }),
  onSuccess: () => {
    queryClient.invalidateQueries(['work-orders'])
    navigate('/taller/ot')
  }
})
```

**Offline outbox:**
```js
// Si falla por falta de conexión:
mutation.onError((err) => {
  if (err.offline) {
    const offlineId = crypto.randomUUID()
    enqueueOp({
      type: 'CREATE_WORK_ORDER',
      offline_id: offlineId,
      payload: formData,
      timestamp: Date.now(),
    })
    // Guardar borrador en IndexedDB store 'pendingOTs'
    saveOTDraft({ ...formData, offline_id: offlineId, status: 'pendingSync' })
    toast.success('OT guardada localmente — se enviará cuando vuelva la conexión')
    navigate('/taller/ot')
  }
})
```

**Cargas de dropdowns (en B usa 2 useEffect encadenados):**
```js
// B: useEffect 1 → cargar clientes/tecnicos al montar
//     useEffect 2 → cargar vehiculos cuando cambia cliente seleccionado

// C: 2 useQuery + 1 useQuery condicional (igual pero con TanStack Query)
const { data: clientes }   = useQuery({ queryKey: ['customers'],          queryFn: () => api.get('/customers/') })
const { data: tecnicos }   = useQuery({ queryKey: ['mechanics'],           queryFn: () => api.get('/users/?role=MECANICO') })
const { data: vehiculos }  = useQuery({
  queryKey: ['vehicles', selectedClienteId],
  queryFn: () => api.get(`/customers/${selectedClienteId}/vehicles`),
  enabled: !!selectedClienteId,   // ← equivalente al useEffect 2 de B
})
const { data: articulos }  = useQuery({ queryKey: ['taller-parts'],        queryFn: () => api.get('/products/?type=REPUESTO') })
```

**react-hook-form + zod:** B lo usa para validación del formulario.
- Opción A: copiar el schema zod de B, reemplazar nombres de campo.
- Opción B: usar validación nativa HTML (más simple, menos deps).
- **Recomendación: Opción A** — el schema zod de B ya valida patente argentina usando `validarPatente()`. Reutilizar eso.
- Instalar: `npm install react-hook-form zod @hookform/resolvers`

**Esfuerzo:** 4h (más compleja de las 6 páginas).

---

### 2.2 — `OTDetailPage` (reescritura del fetch + cambiarEstado)

**En B:** select con 5 joins anidados, `supabase.realtime` (suscripción a cambios en tiempo real), `cambiarEstado()` hace PATCH directo.

```ts
// B: deep select con joins
const { data: ot } = await supabase
  .from('ordenes_trabajo')
  .select(`*, items_repuesto(*), items_mano_obra(*), historial_ot(*), cliente:clientes(*)`)
  .eq('id', id).single()

// B: subscription realtime
const channel = supabase.channel('ot-changes').on('postgres_changes', ...).subscribe()
```

**En C:**
```js
// Fetch principal — backend C ya devuelve OT con items, historial, checklists en un solo request
const { data: ot, isLoading } = useQuery({
  queryKey: ['work-order', id],
  queryFn: () => api.get(`/work-orders/${id}`),
  refetchInterval: isOnline() ? 15000 : false,   // ← polling cada 15s en vez de realtime
})

// cambiarEstado → POST /advance o POST /cancel
const advanceMutation = useMutation({
  mutationFn: (notes) => api.post(`/work-orders/${id}/advance`, { notes }),
  onSuccess: () => queryClient.invalidateQueries(['work-order', id]),
})
const cancelMutation = useMutation({
  mutationFn: (reason) => api.post(`/work-orders/${id}/cancel`, { reason }),
  onSuccess: () => {
    queryClient.invalidateQueries(['work-orders'])
    navigate('/taller/ot')
  },
})
```

**Sin realtime:** reemplazar Supabase realtime con `refetchInterval: 15000` (polling).
Esto es suficiente para el taller — la mecánica no requiere sub-segundo updates.

**Estado simplificado:** usar `OT_STATUS_MAP` (de `ot-machine.js`) para convertir estado del backend al display de B.

**Esfuerzo:** 3h.

---

### 2.3 — `DashboardPage` (reemplazar 5 queries paralelas + 1 RPC)

**En B:** 5 `supabase.from(...)` paralelas en un `Promise.all()` + `supabase.rpc('count_stock_critico')`.

**En C:**
```js
// 5 queries paralelas — TanStack Query las ejecuta en paralelo automáticamente
const qOtsActivas     = useQuery({ queryKey: ['ots-activas'],    queryFn: () => api.get('/work-orders/?status=active') })
const qOtsHoy         = useQuery({ queryKey: ['ots-hoy'],         queryFn: () => api.get('/work-orders/?created_today=true') })
const qStockCritico   = useQuery({ queryKey: ['stock-critico'],   queryFn: () => api.get('/stock/summary') })
const qClientes       = useQuery({ queryKey: ['customers-count'], queryFn: () => api.get('/customers/?count_only=true') })
const qIngresosMes    = useQuery({ queryKey: ['ingresos-mes'],    queryFn: () => api.get('/ingresos/?period=month') })
```

**Equivalente de `supabase.rpc('count_stock_critico')`:**
El backend C tiene `/api/v1/stock/summary` en `stock.py` (o debe crearse si no existe).
Devuelve: `{ critical_count, total_variants, total_value }` — el `critical_count` reemplaza el RPC.

> **Verificar o crear:** `GET /api/v1/stock/summary?company_id=X` en el backend.

**Esfuerzo:** 2h.

---

### 2.4 — Auth context (cambio simple)

B usa Zustand + Supabase Auth:
```ts
const { user, logout } = useAuthStore()
```

C usa AuthContext con JWT:
```jsx
const { user, logout, token } = useAuth()   // ya existe en erp/frontend/src/context/AuthContext.jsx
```

El `user` object en C tiene: `id`, `username`, `full_name`, `role`, `company_id`, `local_id`.
En B tenía: `id` (UUID), `email`, `user_metadata.nombre`, `app_metadata.role`.

Ajustar referencias en cada página:
- `user.email` → `user.username` (o `user.full_name`)
- `user.user_metadata.nombre` → `user.full_name`
- `user.app_metadata.role` → `user.role`

---

## SECCIÓN 3 — CAPA OFFLINE

### 3.1 — Evaluación de librerías

| Librería | Pros | Contras | Veredicto |
|----------|------|---------|-----------|
| **Workbox** | Abstracción service worker, precaching robusto | C ya tiene sw.js custom que funciona | ❌ No agregar |
| **Dexie.js** | TypeScript types, async/await limpio, migrations | Ya tenemos `idb` instalado en offlineDB.js | ❌ No agregar (redundante) |
| **TanStack Query `persistQueryClient`** | Persiste cache de queries en IndexedDB, integración nativa | Requiere configurar `PersistQueryClientProvider` | ✅ Útil para catalog reads |
| **`networkMode: 'offlineFirst'`** | TQ v5 nativo, queries no fallan offline | La queryFn tiene que leer de IndexedDB manualmente | ✅ Usar en páginas de taller |

### 3.2 — Stack offline recomendado

**MANTENER** (ya funciona, no tocar):
- `offlineDB.js` — stores v1-v3, outbox `pendingOps`
- `offlineSync.js` — engine de sync periódico, `fetchWithFallback()`
- `sw.js` — service worker stale-while-revalidate
- `useOfflineQuery.js` — hook genérico (extender, no reemplazar)

**EXTENDER** (agregar sin romper):
```js
// offlineDB.js — agregar versión 4 con stores del taller
if (oldVersion < 4) {
  if (!db.objectStoreNames.contains('catalogOTs')) {
    const ots = db.createObjectStore('catalogOTs', { keyPath: 'id' })
    ots.createIndex('status', 'status', { unique: false })
    ots.createIndex('local_id', 'local_id', { unique: false })
  }
  if (!db.objectStoreNames.contains('catalogClientes')) {
    const cli = db.createObjectStore('catalogClientes', { keyPath: 'id' })
    cli.createIndex('cuit', 'cuit', { unique: false })
  }
  if (!db.objectStoreNames.contains('catalogTecnicos')) {
    db.createObjectStore('catalogTecnicos', { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains('catalogArticulos')) {
    const art = db.createObjectStore('catalogArticulos', { keyPath: 'id' })
    art.createIndex('stock', 'stock', { unique: false })
  }
  if (!db.objectStoreNames.contains('pendingOTs')) {
    const pot = db.createObjectStore('pendingOTs', { keyPath: 'offline_id' })
    pot.createIndex('status', 'status', { unique: false })
    pot.createIndex('createdAt', 'createdAt', { unique: false })
  }
}
```

**AGREGAR a offlineSync.js:**
```js
// syncTallerCatalogs() — sync específico para stores del taller
export async function syncTallerCatalogs() {
  await syncCatalog('catalogClientes',  '/customers/?limit=500')
  await syncCatalog('catalogTecnicos',  '/users/?role=MECANICO')
  await syncCatalog('catalogArticulos', '/products/?type=REPUESTO&limit=500')
  await syncCatalog('catalogOTs',       '/work-orders/?status=active&limit=100',
    // solo OTs activas van al cache, no el histórico completo
  )
}

// Llamar en syncAllCatalogs() si el módulo OT está activo
```

**AGREGAR a sw.js:**
```js
// Agregar rutas del taller al cache stale-while-revalidate
// En el array de API patterns:
'/api/v1/work-orders',
'/api/v1/customers',
'/api/v1/users',      // para lista de mecánicos
```

### 3.3 — Patrón useOfflineQuery para el taller

Extender `useOfflineQuery.js` para soportar mutations:

```js
// Nuevo: useOfflineMutation — wrappea useMutation con outbox automático
export function useOfflineMutation(mutationFn, offlineOptions = {}) {
  const { type, getOfflinePayload, onOfflineQueued } = offlineOptions
  return useMutation({
    mutationFn,
    onError: (err, variables) => {
      if (err.offline && type) {
        const offline_id = crypto.randomUUID()
        enqueueOp({
          type,
          offline_id,
          payload: getOfflinePayload?.(variables) ?? variables,
          timestamp: Date.now(),
        })
        onOfflineQueued?.(offline_id)
      }
    }
  })
}
```

Uso en OTNewPage:
```js
const createOT = useOfflineMutation(
  (data) => api.post('/work-orders/', data),
  {
    type: 'CREATE_WORK_ORDER',
    onOfflineQueued: (offline_id) => {
      toast.success('OT guardada — se enviará al reconectar')
      navigate('/taller/ot')
    }
  }
)
```

---

## SECCIÓN 4 — ESTRUCTURA NUEVA DE `src/`

```
erp/frontend/src/
│
├── lib/
│   ├── api.js                    ← EXISTENTE (no modificar)
│   ├── offlineDB.js              ← MODIFICAR: bump a v4, agregar 5 stores del taller
│   ├── offlineSync.js            ← MODIFICAR: agregar syncTallerCatalogs()
│   ├── useOfflineQuery.js        ← MODIFICAR: agregar useOfflineMutation()
│   ├── utils-ar.js               ← NUEVO: validarCuit, validarPatente, formatARS, etc.
│   ├── ot-machine.js             ← NUEVO: OT_STATUS_MAP, OT_TRANSICIONES, ESTADO_OT_LABEL/COLOR
│   └── ...resto existente...
│
├── components/
│   ├── ui/
│   │   ├── StatCard.jsx          ← NUEVO: extraído de DashboardPage de B
│   │   └── ...existentes...
│   └── ...existentes...
│
├── pages/
│   ├── taller/                   ← NUEVA CARPETA (módulo OT)
│   │   ├── TallerDashboard.jsx   ← NUEVO: versión taller del dashboard (de B DashboardPage)
│   │   ├── OTListPage.jsx        ← NUEVO: lista de OTs (de B OTListPage)
│   │   ├── OTNewPage.jsx         ← NUEVO: crear OT (de B OTNewPage — más adaptaciones)
│   │   ├── OTDetailPage.jsx      ← NUEVO: detalle + workflow OT (de B OTDetailPage)
│   │   ├── ClientesTallerPage.jsx← NUEVO: lista clientes del taller (de B ClientesPage)
│   │   └── StockTallerPage.jsx   ← NUEVO: repuestos/stock taller (de B StockPage)
│   └── ...páginas existentes...
│
├── App.jsx                       ← MODIFICAR: agregar rutas /taller/*
└── layouts/
    └── AppLayout.jsx             ← MODIFICAR: agregar nav items del taller (con RequireModule OT)
```

### Rutas a agregar en `App.jsx`:
```jsx
// Lazy imports
const TallerDashboard    = lazy(() => import('./pages/taller/TallerDashboard'))
const OTListPage         = lazy(() => import('./pages/taller/OTListPage'))
const OTNewPage          = lazy(() => import('./pages/taller/OTNewPage'))
const OTDetailPage       = lazy(() => import('./pages/taller/OTDetailPage'))
const ClientesTallerPage = lazy(() => import('./pages/taller/ClientesTallerPage'))
const StockTallerPage    = lazy(() => import('./pages/taller/StockTallerPage'))

// Dentro de <Route path="/" element={<AppLayout />}>:
<Route path="taller"           element={<TallerDashboard />} />
<Route path="taller/ot"        element={<OTListPage />} />
<Route path="taller/ot/new"    element={<OTNewPage />} />
<Route path="taller/ot/:id"    element={<OTDetailPage />} />
<Route path="taller/clientes"  element={<ClientesTallerPage />} />
<Route path="taller/stock"     element={<StockTallerPage />} />
```

### Nav items a agregar en `AppLayout.jsx`:
```js
// Dentro del array NAV_ITEMS, protegido por módulo OT y empresa de tipo MECANICO:
{
  label: 'Taller',
  icon: Wrench,
  module: 'OT',           // solo visible si company tiene módulo OT activo
  children: [
    { label: 'Dashboard', path: '/taller', icon: LayoutDashboard },
    { label: 'Órdenes de Trabajo', path: '/taller/ot', icon: ClipboardList },
    { label: 'Clientes', path: '/taller/clientes', icon: Users },
    { label: 'Repuestos', path: '/taller/stock', icon: Package },
  ]
}
```

---

## SECCIÓN 5 — ORDEN DE MIGRACIÓN

**Criterio:** Máximo valor operacional lo antes posible. Un mecánico debe poder crear y gestionar OTs desde el día 1. Las integraciones (AFIP, WhatsApp) son para después.

### Etapa 0 — Fundamentos sin UI (1 día)
> Sin dependencias. Hacerlo primero porque TODO lo demás lo usa.

| # | Tarea | Archivo | Esfuerzo | Valor |
|---|-------|---------|----------|-------|
| 0.1 | Copiar validadores argentinos | `src/lib/utils-ar.js` | 30 min | Base |
| 0.2 | Crear constantes OT | `src/lib/ot-machine.js` | 45 min | Base |
| 0.3 | Extraer StatCard | `src/components/ui/StatCard.jsx` | 15 min | Base |
| 0.4 | Bump offlineDB a v4 | `src/lib/offlineDB.js` | 1h | Base offline |
| 0.5 | Agregar syncTallerCatalogs | `src/lib/offlineSync.js` | 45 min | Base offline |
| 0.6 | Agregar useOfflineMutation | `src/lib/useOfflineQuery.js` | 1h | Outbox OTs |

**Total etapa 0:** ~4.5h

---

### Etapa 1 — Lista de OTs (1 día)
> Depende de: Etapa 0. Sin Etapa 1, el mecánico no puede ver nada.

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1.1 | `OTListPage.jsx` — tabla con filtros por estado | `pages/taller/OTListPage.jsx` | 2h |
| 1.2 | Agregar rutas `/taller/ot` en App.jsx | `src/App.jsx` | 15 min |
| 1.3 | Agregar nav "Taller" en AppLayout.jsx | `src/layouts/AppLayout.jsx` | 30 min |
| 1.4 | Verificar endpoint `GET /work-orders/` en backend | `erp/backend` | 30 min |

**Entregable:** Mecánico puede ver lista de OTs abiertas con sus estados.
**Total etapa 1:** ~3.5h

---

### Etapa 2 — Detalle + Transiciones de OT (1-2 días)
> Depende de: Etapa 1. Es la página más usada en el día a día.

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 2.1 | `OTDetailPage.jsx` — vista completa con historial | `pages/taller/OTDetailPage.jsx` | 3h |
| 2.2 | Botones de avance de estado (advance/cancel) | dentro de OTDetailPage | 1h |
| 2.3 | Sección de items (repuestos + mano de obra) | dentro de OTDetailPage | 1h |
| 2.4 | Agregar ruta `/taller/ot/:id` en App.jsx | `src/App.jsx` | 10 min |

**Entregable:** Mecánico puede avanzar una OT por sus estados, ver historial, ver items.
**Total etapa 2:** ~5h

---

### Etapa 3 — Crear OT nueva (2 días)
> Depende de: Etapa 1. Es la más compleja por el formulario multi-sección.

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 3.1 | Instalar react-hook-form + zod | npm install | 10 min |
| 3.2 | Formulario paso 1: datos del vehículo + cliente | `pages/taller/OTNewPage.jsx` | 2h |
| 3.3 | Formulario paso 2: items iniciales (opcional al crear) | dentro de OTNewPage | 1.5h |
| 3.4 | Offline outbox: guardar borrador si no hay red | dentro de OTNewPage | 1h |
| 3.5 | Agregar ruta `/taller/ot/new` en App.jsx | `src/App.jsx` | 10 min |

**Entregable:** Mecánico puede crear OT completa, funciona sin internet.
**Total etapa 3:** ~5h

---

### Etapa 4 — Dashboard del taller (1 día)
> Depende de: Etapas 1-3 (necesita las stats para que sean útiles).

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 4.1 | `TallerDashboard.jsx` con StatCards | `pages/taller/TallerDashboard.jsx` | 2h |
| 4.2 | Tabla "OTs de hoy" | dentro de TallerDashboard | 1h |
| 4.3 | Verificar/crear `GET /stock/summary` en backend | `erp/backend` | 30 min |

**Entregable:** Pantalla de inicio del taller con métricas del día.
**Total etapa 4:** ~3.5h

---

### Etapa 5 — Clientes y Repuestos (1 día)
> Depende de: Etapas 1-4. Son páginas de apoyo, no críticas para operar.

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 5.1 | `ClientesTallerPage.jsx` — lista + historial OTs | `pages/taller/ClientesTallerPage.jsx` | 2h |
| 5.2 | `StockTallerPage.jsx` — repuestos con alerta crítico | `pages/taller/StockTallerPage.jsx` | 2h |

**Entregable:** Mecánico puede consultar clientes y ver stock de repuestos.
**Total etapa 5:** ~4h

---

### Resumen de tiempos

| Etapa | Contenido | Esfuerzo | Acumulado |
|-------|-----------|----------|-----------|
| 0 | Fundamentos (utils, stores) | 4.5h | 4.5h |
| 1 | OTListPage + rutas | 3.5h | 8h |
| 2 | OTDetailPage + transiciones | 5h | 13h |
| 3 | OTNewPage + offline | 5h | 18h |
| 4 | TallerDashboard | 3.5h | 21.5h |
| 5 | Clientes + Stock | 4h | ~25h |

**Total: ~25h** (vs ~35h estimado para migrar Supabase→FastAPI en B, como estimó DECISION_ARQUITECTURA.md).

---

## APÉNDICE — Tabla completa de mapeo Supabase → FastAPI

| Supabase (B) | FastAPI endpoint (C) | Notas |
|---|---|---|
| `from('ordenes_trabajo').select(*)` | `GET /api/v1/work-orders/` | Paginado, filtros por status/date |
| `from('ordenes_trabajo').select('*, ...')` | `GET /api/v1/work-orders/{id}` | Incluye items, historial, checklists |
| `from('ordenes_trabajo').insert(...)` | `POST /api/v1/work-orders/` | Items anidados en body |
| `from('ordenes_trabajo').update(...).eq('id', x)` | `PUT /api/v1/work-orders/{id}` | Solo datos, no avance de estado |
| `from('ordenes_trabajo').update({estado: 'listo'})` | `POST /api/v1/work-orders/{id}/advance` | Avanza al próximo estado |
| `from('clientes').select(*)` | `GET /api/v1/customers/` | Lista completa |
| `from('clientes').select().eq('id', x)` | `GET /api/v1/customers/{id}` | Con vehicles y account_movements |
| `from('vehiculos').select().eq('cliente_id', x)` | `GET /api/v1/customers/{id}/vehicles` | Por cliente |
| `from('articulos').select(*)` | `GET /api/v1/products/?type=REPUESTO` | O `GET /api/v1/stock/` |
| `from('tecnicos').select(*)` | `GET /api/v1/users/?role=MECANICO` | Usuarios con rol mecánico |
| `rpc('count_stock_critico')` | `GET /api/v1/stock/summary` | Crear si no existe |
| `from('historial_ot').select(*)` | — | Incluido en `GET /work-orders/{id}` |
| `from('comprobantes').select(*)` | `GET /api/v1/sales/` | Facturas/comprobantes |
| `auth.signOut()` | `localStorage.removeItem('token')` | + redirect a /login |
| `auth.getUser()` | `GET /api/v1/auth/me` (cacheado en AuthContext) | — |

---

## APÉNDICE — Campos diferentes B vs C

| Concepto | Campo en B | Campo en C | Acción |
|---|---|---|---|
| ID de registro | UUID string | Integer | Cambiar todos los `.eq('id', id)` → `:id` params |
| Nombre del cliente | `nombre` | `full_name` | Ajustar en UI |
| Estado de OT | `recibido`, `listo`, etc. | `RECEPCION`, `ENTREGA`, etc. | Usar `OT_STATUS_MAP` de `ot-machine.js` |
| Técnico asignado | `tecnico_id` → tabla `tecnicos` | `assigned_mechanic_id` → tabla `users` | Cambiar FK y join |
| Items de repuesto | tabla `items_repuesto` | `WorkOrderItem.type = 'REPUESTO'` | Aplanar en el body del POST |
| Items de mano obra | tabla `items_mano_obra` | `WorkOrderItem.type = 'MANO_DE_OBRA'` | Aplanar en el body del POST |
| Número de OT | `numero` (auto en B) | `number` (OT-YYYY-NNNNN, auto en C) | Sin acción (read-only) |
| Empresa | (implícito en Supabase RLS) | `company_id` del JWT | Sin acción (backend lo inyecta) |
