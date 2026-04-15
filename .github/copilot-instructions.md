# ERP Mundo Outdoor — Copilot Instructions

## ⚠️ REGLA OBLIGATORIA: Sistema de Mejoras — aprobación previa

**NUNCA implementar una mejora que venga del módulo Mejoras sin verificar que esté aprobada.**

El flujo correcto es:
1. Empleado crea nota en el módulo → queda en `is_done=false` (PENDIENTE)
2. Admin la revisa en `/mejoras` y aprieta "OK — Aplicar" → pone `is_done=true` (APROBADA) → recién ahí se dispara Copilot
3. El agente solo debe implementar mejoras cuya nota tiene `is_done=true`

Si recibís un prompt de mejora, antes de implementar verificar:
```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\backend" && .\venv\Scripts\python.exe -c "
from app.db.session import get_db
from app.models.improvement_note import ImprovementNote
db = next(get_db())
notes = db.query(ImprovementNote).filter(ImprovementNote.is_done==True).order_by(ImprovementNote.updated_at.desc()).limit(5).all()
for n in notes: print(f'id={n.id} is_done={n.is_done} text={n.text[:80]}')
"
```
Solo implementar si la nota aparece con `is_done=True`.

**Después de completar CUALQUIER tarea que modifique archivos del frontend (`erp/frontend/src/`):**

1. Ejecutar build y deploy con este comando PowerShell:
```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\frontend" && npx vite build
$ids = Get-Process | Where-Object { $_.Name -like '*ERP Mundo*' } | Select-Object -ExpandProperty Id; foreach($id in $ids){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
cd "D:\ERP MUNDO OUTDOOR\erp\electron-cliente" && node_modules\.bin\electron-packager . "ERP Mundo Outdoor - Cliente" --platform=win32 --arch=x64 --out=dist --overwrite
$src="D:\ERP MUNDO OUTDOOR\erp\electron-cliente\dist\ERP Mundo Outdoor - Cliente-win32-x64"; $dst="D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente"; $zip="D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip"; if(Test-Path $dst){Remove-Item $dst -Recurse -Force}; Copy-Item $src $dst -Recurse; if(Test-Path $zip){Remove-Item $zip -Force}; Compress-Archive -Path "$dst\*" -DestinationPath $zip -Force
Start-Process "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente\ERP Mundo Outdoor - Cliente.exe"
```

2. O simplemente ejecutar: `D:\ERP MUNDO OUTDOOR\DEPLOY_RAPIDO.bat`

**NO marcar la tarea como completa sin haber hecho el build y deploy.**
**El backend con `--reload` toma cambios automáticamente — no reiniciar.**

## Proyecto
ERP enterprise multi-tenant para Mundo Outdoor (indumentaria/outdoor). Construido desde cero. PWA instalable.

## Stack Técnico

### Backend (`erp/backend/`)
- **Python 3.12**, FastAPI 0.115.6, SQLAlchemy 2.0.36, Alembic 1.14.1
- **PostgreSQL 18.3** en puerto **2048** (NO el default 5432)
- **bcrypt==4.0.1** (NO usar 5.x — rompe)
- psutil 7.2.2, psycopg2-binary, python-jose, pydantic-settings
- Venv en `erp/backend/venv/`
- Backend corre en **puerto 8000**: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- DB: `erp_mundooutdoor`, user: `erp_user`, password: `MundoOutdoor2026!`

### Frontend (`erp/frontend/`)
- **React 19**, **Vite 8.0.3**, Tailwind CSS v4 (`@tailwindcss/vite`), React Router v7
- TanStack Query v5, Lucide React
- Frontend corre en **puerto 5174**: `npx vite --host` (5173 ocupado por Control Remitos)
- PWA manual (manifest.json + sw.js con iconos PNG). `vite-plugin-pwa` incompatible con Vite 8.
- API client en `src/lib/api.js` — usa `fetch()` con Bearer token

## Arquitectura

### Multi-tenant
- Tabla `companies` → todo dato scoped a `company_id`
- `User.company_id` nullable (SUPERADMIN accede a todo)
- Cada query filtra por `company_id` del usuario logueado

### Roles
`SUPERADMIN | ADMIN | COMPRAS | ADMINISTRACION | GESTION_PAGOS | LOCAL | VENDEDOR | DEPOSITO`

### Auth
- JWT con bcrypt, tokens de 8h
- `app/api/deps.py`: `get_current_user()`, `require_roles()`
- Frontend: `AuthContext` con token en localStorage

### Modelos existentes
- `Company`, `User`, `Local`, `Provider`
- `Product` + `ProductVariant` (talle/color, SKU, stock)
- `Ingreso` + `IngresoItem` (remitos/facturas de compra, estados: BORRADOR→CONFIRMADO→ANULADO)
- `Pedido` + `PedidoItem` (notas de pedido a proveedor, estados: BORRADOR→ENVIADO→RECIBIDO)
- `Sale` + `SaleItem` (ventas/facturación, estados: BORRADOR→EMITIDA→PAGADA→ANULADA)
- `StockMovement` (historial de movimientos: INGRESO/EGRESO/AJUSTE/TRANSFERENCIA)

### APIs existentes (router.py)
- `/api/v1/auth` — login, /me
- `/api/v1/users` — CRUD usuarios
- `/api/v1/locals` — CRUD locales
- `/api/v1/providers` — CRUD proveedores
- `/api/v1/products` — CRUD productos + variantes
- `/api/v1/ingresos` — CRUD ingresos con confirm/cancel workflow
- `/api/v1/pedidos` — CRUD pedidos con send/receive/cancel workflow
- `/api/v1/sales` — CRUD ventas con emit/pay/cancel workflow
- `/api/v1/stock` — consulta inventario, ajustes, movimientos
- `/api/v1/system` — health check + métricas (CPU/RAM/DB/API)

### Frontend pages
- **Completas**: Dashboard, Login, Productos, Proveedores, Locales, Usuarios, Ingreso, Monitoreo
- **En construcción**: Pedidos, Stock, Facturación, Consultas, Reportes, Configuración

## Convenciones de código

### Backend
- Schemas Pydantic inline en cada router (no carpeta schemas/ separada)
- `model_config = {"from_attributes": True}` en schemas de salida
- Filtrar siempre por `company_id` en queries
- Usar `lazy="selectin"` en relationships frecuentemente accedidas
- Migraciones Alembic: `alembic revision --autogenerate -m "desc"` → `alembic upgrade head`

### Frontend
- Páginas en `src/pages/`, layout en `src/layouts/`
- TanStack Query para fetching: `useQuery` + `useMutation` + `queryClient.invalidateQueries`
- API via `api.get()`, `api.post()`, `api.put()`, `api.delete()` de `../lib/api`
- Iconos de `lucide-react`
- UI: Tailwind classes directas, sin componentes UI library (no shadcn instalado aún)
- Modals inline en cada page
- Cada page se lazy-importa en `App.jsx`
- Sidebar nav en `AppLayout.jsx` con array `NAV_ITEMS`

## Comandos útiles

```bash
# Backend
cd erp/backend
.\venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
alembic revision --autogenerate -m "descripcion"
alembic upgrade head

# Frontend
cd erp/frontend
npx vite --host

# Base de datos
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor
```

## Estado actual del proyecto

### Completado
- Estructura base + auth + RBAC
- 6 modelos con 2 Alembic migrations aplicadas (+ 3 modelos nuevos pendientes de migración: Pedido, Sale, StockMovement)
- 10 routers API funcionando
- PWA con iconos PNG, manifest.json, service worker
- Sistema de monitoreo (middleware métricas + dashboard)
- .gitignore configurado, git limpio (79 archivos tracked)

### Pendiente inmediato
1. **Migración Alembic** para tablas nuevas (pedidos, sales, stock_movements)
2. **Registrar routers nuevos** (pedidos, sales, stock) en router.py
3. **Frontend StockPage** — consulta inventario, ajustes, movimientos
4. **Frontend PedidosPage** — CRUD notas de pedido
5. **Frontend FacturacionPage** — CRUD ventas/comprobantes
6. **Frontend ConsultasPage** — búsqueda de precios, stock, artículos
7. **Frontend ReportesPage** — reportes con gráficos
8. **Frontend ConfigPage** — configuración de empresa

### Pendiente futuro
- Barcode scanner (cámara PWA)
- Import masivo desde Excel
- Dashboard con stats reales (hoy tiene placeholders "—")
- Dark mode
- Deploy VPS Hetzner
- `git push origin master --force` (usuario debe ejecutar)

## Restricciones críticas
- Puerto PostgreSQL: **2048** (NO 5432)
- bcrypt: **4.0.1** (NO 5.x)
- Vite: **8.0.3** (algunas libs no son compatibles)
- Frontend: puerto **5174** (5173 ocupado)
- NO usar `vite-plugin-pwa` (incompatible con Vite 8)
- NO tocar la carpeta `CONTROL REMITOS/` (app legacy que sigue corriendo)
