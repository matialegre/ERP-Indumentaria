# ERP Mundo Outdoor — Copilot Instructions

## ⚠️ REGLA OBLIGATORIA: Sistema de Mejoras — aprobación previa

**NUNCA implementar una mejora que venga del módulo Mejoras sin verificar que esté aprobada.**

El flujo correcto es:
1. Empleado crea nota en el módulo → queda en `is_done=false` (PENDIENTE)
2. Admin la revisa en `/mejoras` y aprieta "OK — Aplicar" → pone `is_done=true` (APROBADA) → recién ahí se dispara Copilot
3. El agente solo debe implementar mejoras cuya nota tiene `is_done=true`

Verificar antes de implementar:
```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\backend" && .\venv\Scripts\python.exe -c "
from app.db.session import get_db
from app.models.improvement_note import ImprovementNote
db = next(get_db())
notes = db.query(ImprovementNote).filter(ImprovementNote.is_done==True).order_by(ImprovementNote.updated_at.desc()).limit(5).all()
for n in notes: print(f'id={n.id} is_done={n.is_done} text={n.text[:80]}')
"
```

## ⚠️ Deploy obligatorio tras cambios en frontend

Después de cualquier cambio en `erp/frontend/src/`, ejecutar:
```powershell
D:\ERP MUNDO OUTDOOR\DEPLOY_RAPIDO.bat
```
O el proceso completo:
```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\frontend" && npx vite build
$ids = Get-Process | Where-Object { $_.Name -like '*ERP Mundo*' } | Select-Object -ExpandProperty Id; foreach($id in $ids){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
cd "D:\ERP MUNDO OUTDOOR\erp\electron-cliente" && node_modules\.bin\electron-packager . "ERP Mundo Outdoor - Cliente" --platform=win32 --arch=x64 --out=dist --overwrite
$src="D:\ERP MUNDO OUTDOOR\erp\electron-cliente\dist\ERP Mundo Outdoor - Cliente-win32-x64"; $dst="D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente"; $zip="D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip"; if(Test-Path $dst){Remove-Item $dst -Recurse -Force}; Copy-Item $src $dst -Recurse; if(Test-Path $zip){Remove-Item $zip -Force}; Compress-Archive -Path "$dst\*" -DestinationPath $zip -Force
Start-Process "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente\ERP Mundo Outdoor - Cliente.exe"
```

**NO marcar la tarea como completa sin haber hecho el build y deploy.**
**El backend con `--reload` toma cambios automáticamente — no reiniciar.**

---

## Proyecto

ERP enterprise multi-tenant para Mundo Outdoor (indumentaria/outdoor). PWA instalable + cliente Electron para Windows.

---

## Stack y puertos

### Backend (`erp/backend/`)
- **Python 3.12**, FastAPI 0.115.6, SQLAlchemy 2.0.36, Alembic 1.14.1
- **PostgreSQL 18.3** en puerto **2048** (NO el default 5432)
- **bcrypt==4.0.1** (NO usar 5.x — rompe passlib)
- Venv en `erp/backend/venv/`
- Backend corre en **puerto 8001**: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8001`
- DB: `erp_mundooutdoor`, user: `erp_user`

### Frontend (`erp/frontend/`)
- **React 19**, **Vite 8.0.3**, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7
- TanStack Query v5, Lucide React, Recharts
- Dev server en **puerto 5173**: `npx vite` — proxy `/api` → `http://localhost:8001`
- Preview (producción): puerto **9980** (`vite preview`)
- API client en `src/lib/api.js` — usa `fetch()` con Bearer token desde **`sessionStorage`** (NO localStorage)
- PWA manual (manifest.json + sw.js con iconos PNG). **NO usar `vite-plugin-pwa`** (incompatible con Vite 8)

### Electron (`erp/electron-cliente/`)
- Cliente Windows que empaqueta el frontend con Electron
- Sirve el build estático en puerto 8001 o 8002 localmente
- `erp_server_url` en localStorage indica al cliente la URL del servidor real

### Producción
- IP pública: `190.211.201.217`, puerto `8001`
- Build chunks con nombres estables (sin hash) — configurado en vite.config.js para evitar errores con index.html cacheado
- Auto-reload: el frontend verifica `/api/v1/system/version` cada 30s; si detecta nuevo `build_hash`, recarga automáticamente

---

## Arquitectura

### Multi-tenant
- Tabla `companies` — todo dato scoped a `company_id`
- `User.company_id` nullable (SUPERADMIN y MEGAADMIN acceden a todo sin filtro)
- Cada query **debe** filtrar por `company_id` del usuario logueado

### Roles
`MEGAADMIN | SUPERADMIN | ADMIN | COMPRAS | ADMINISTRACION | GESTION_PAGOS | LOCAL | VENDEDOR | DEPOSITO`

### Auth
- JWT con passlib+bcrypt, tokens de 8h
- `app/api/deps.py`: `get_current_user()`, `require_roles()`
- Token en `sessionStorage` (se pierde al cerrar tab — diseñado para multi-sesión)
- 401 → redirige a `/login` automáticamente; 403 con `LICENCIA_SUSPENDIDA/CANCELADA` → redirige con query param

### Sistema de módulos
- `app/api/module_guard.py`: `RequireModule("slug")` — dependency que verifica que el módulo esté habilitado para la empresa
- MEGAADMIN y SUPERADMIN bypasean el guard
- Tabla `CompanyModule` (company_id, module_slug, is_active)
- Uso: `@router.get("/", dependencies=[Depends(RequireModule("stock"))])`

### Offline (PWA + Electron)
- `src/lib/offlineDB.js` — IndexedDB via `idb` para cachear datos y credenciales
- `src/lib/offlineSync.js` — sincronización de operaciones pendientes al volver online
- `src/lib/offlineReceipt.js` — comprobantes generados offline
- Service Worker escucha evento `FLUSH_PENDING_OPS` para disparar sync en background
- `AuthContext` soporta `isOfflineSession` — login offline con hash SHA-256 local

---

## Modelos principales (`erp/backend/app/models/`)

| Modelo | Descripción |
|--------|-------------|
| `Company`, `User`, `Local` | Multi-tenant base |
| `Provider`, `Customer` | Proveedores y clientes |
| `Product` + `ProductVariant` | Talle/color, SKU, stock |
| `Ingreso` + `IngresoItem` | Remitos/facturas de compra (BORRADOR→CONFIRMADO→ANULADO) |
| `Pedido` + `PedidoItem` | Notas de pedido a proveedor (BORRADOR→ENVIADO→RECIBIDO) |
| `PurchaseOrder`, `PurchaseInvoice` | Módulo Compras migrado de Control Remitos |
| `Sale` + `SaleItem` | Ventas/facturación (BORRADOR→EMITIDA→PAGADA→ANULADA) |
| `StockMovement` | Historial movimientos (INGRESO/EGRESO/AJUSTE/TRANSFERENCIA) |
| `Payment` | Gestión de pagos |
| `WorkOrder` | Órdenes de trabajo (módulo Taller) |
| `KanbanCard` | Tablero Kanban |
| `ImprovementNote` | Mejoras pendientes/aprobadas (`is_done`) |
| `CompanyModule` | Control de módulos habilitados por empresa |
| `EmployeeScore` | Puntuación de empleados |
| `MeliConfig`, `MeliOrder` | Integración MercadoLibre |
| `Transport` | Módulo transporte |
| `PriceList` | Listas de precios |

---

## Routers API (`erp/backend/app/api/v1/`)

El archivo `router.py` registra ~40 routers. Los más usados:

```
/api/v1/auth          login, /me
/api/v1/companies     CRUD empresas
/api/v1/users         CRUD usuarios
/api/v1/products      CRUD productos + variantes
/api/v1/ingresos      Remitos de compra (confirm/cancel)
/api/v1/pedidos       Notas de pedido (send/receive/cancel)
/api/v1/sales         Ventas (emit/pay/cancel)
/api/v1/stock         Inventario, ajustes, movimientos
/api/v1/purchase-orders / purchase-invoices / payments
/api/v1/work-orders   Módulo Taller (OT)
/api/v1/kanban        Tablero Kanban
/api/v1/crm/*         Módulo CRM completo
/api/v1/ml/*          MercadoLibre
/api/v1/informes      SQL Server (datos heredados)
/api/v1/system        Health check + métricas
/api/v1/health        Ping sin auth (< 100 ms)
/api/v1/sync          Sincronización offline
/api/v1/modules       Gestión de módulos por empresa
/api/v1/mega          Panel MEGAADMIN
```

---

## Convenciones de código

### Backend
- Schemas Pydantic **inline en cada router** (no carpeta `schemas/` separada)
- `model_config = {"from_attributes": True}` en todos los schemas de salida
- Filtrar siempre por `company_id` en queries (excepto MEGAADMIN/SUPERADMIN)
- Usar `lazy="selectin"` en relationships frecuentemente accedidas
- Módulos protegidos: `dependencies=[Depends(RequireModule("slug"))]`
- Migraciones: `alembic revision --autogenerate -m "desc"` → `alembic upgrade head`
- Las tablas también se crean vía `Base.metadata.create_all()` en `main.py` startup (fallback)

### Frontend
- Páginas en `src/pages/`, CRM en `src/pages/crm/`, Taller en `src/pages/taller/`
- Todas las páginas se **lazy-importan** en `App.jsx` con `<LazyPage>` wrapper (ErrorBoundary + Suspense)
- TanStack Query: `useQuery` + `useMutation` + `queryClient.invalidateQueries`
- API via `api.get/post/put/patch/delete` de `../lib/api`; archivos con `api.uploadFile` o `api.postForm`
- Iconos de `lucide-react`; gráficos con `recharts`
- UI con Tailwind classes directas — sin componentes UI library
- Modals inline en cada page
- Sidebar en `AppLayout.jsx` — array `NAV_ITEMS`
- Toast notifications via `useToast()` de `../components/ToastProvider`
- `BrandingContext` — logo/colores personalizables por empresa

---

## Comandos

```powershell
# Backend (Windows)
cd erp\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Migraciones
alembic revision --autogenerate -m "descripcion"
alembic upgrade head

# Frontend
cd erp\frontend
npx vite              # dev en puerto 5173
npx vite build        # build producción
npx vite preview      # preview en puerto 9980

# Base de datos
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor
```

---

## Restricciones críticas

- Puerto PostgreSQL: **2048** (NO 5432)
- Puerto backend: **8001** (8000 es el CRM legacy — NO usar para el ERP)
- bcrypt: **4.0.1** (NO 5.x — rompe passlib)
- **NO usar `vite-plugin-pwa`** (incompatible con Vite 8)
- **NO tocar `CONTROL REMITOS/`** (app legacy que sigue corriendo en producción)
- Token en **`sessionStorage`**, no `localStorage` (localStorage era el comportamiento viejo — ya migrado)
- Build chunks con nombres estables (sin hash) — ya configurado en vite.config.js, no cambiar
