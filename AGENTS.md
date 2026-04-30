# AGENTS.md — Contexto para Claude Code

## Qué es este proyecto

ERP enterprise multi-tenant para Mundo Outdoor (cadena de indumentaria/outdoor en Argentina). Incluye compras, ventas, stock, RRHH, CRM, integración MercadoLibre, tablero Kanban, RFID, informes SQL Server y más. Está en producción parcial, corriendo en paralelo con el sistema legacy "CONTROL REMITOS" mientras se migran módulos. Soporta PWA instalable, cliente Electron Windows y app Expo Android.

## Stack tecnológico

- Lenguaje backend: Python 3.12
- Framework backend: FastAPI 0.115.6 + SQLAlchemy 2.0.36 + Alembic 1.14.1 + Pydantic 2.10 + passlib/bcrypt 4.0.1
- Lenguaje frontend: JavaScript (JSX) — NO TypeScript
- Framework frontend: React 19 + Vite 8.0.3 + Tailwind v4 (`@tailwindcss/vite`) + React Router v7 + TanStack Query v5 + Recharts + lucide-react + xlsx + idb + framer-motion
- DB principal: PostgreSQL 18.3 en puerto **2048** (no 5432), DB `erp_mundooutdoor`, user `erp_user`
- DB secundaria: SQL Server en LAN (`192.168.0.109:9970`) vía `pyodbc` — lectura de datos heredados de Tango
- Cache: Redis/Memurai en 6379 (opcional, pendiente de instalar correctamente)
- Auth: JWT con bcrypt, tokens 8h en `sessionStorage` (no localStorage)
- Desktop: Electron (packager clásico, no electron-builder)
- Mobile: Expo + Capacitor
- Offline: IndexedDB (`mo-erp-offline` v5) + Service Worker manual (no `vite-plugin-pwa`)
- Infra producción: Windows Server + IP pública `190.211.201.217:8001` (Hetzner VPS previsto para futuro)

## Estructura de módulos

- `erp/` → producto activo (backend + frontend + wrappers desktop/mobile)
- `erp/backend/` → FastAPI monolítico; entrypoint real es `main.py`
- `erp/backend/app/api/v1/` → ~65 routers por dominio; agregados en `router.py`
- `erp/backend/app/models/` → modelos SQLAlchemy
- `erp/backend/app/services/` → integraciones (copilot_hook, etc.)
- `erp/backend/app/workers/` → snapshot_worker (thread de background)
- `erp/backend/alembic/versions/` → migraciones de producción
- `erp/frontend/src/pages/` → ~80 pages React lazy-loaded
- `erp/frontend/src/layouts/AppLayout.jsx` → navegación, módulos dinámicos, role-filtering
- `erp/frontend/src/lib/api.js` → cliente HTTP con URL dinámica (capacitor/electron/browser)
- `erp/frontend/src/lib/offlineDB.js`, `offlineSync.js` → offline-first via IndexedDB
- `erp/electron-cliente/` → cliente Windows principal (contiene license flow + machine-id)
- `erp/electron-montagne/`, `erp/electron-taller/` → variantes Electron por cliente/área
- `erp/android-app/` → app Expo (secundaria)
- `erp/scripts/` → utilidades; `migrate_control_remitos.py` importa desde sistema legacy
- `erp/mejoras_images/`, `pedidos_files/`, `rfid_contenido/`, `msg_uploads/` → uploads servidos por el backend
- `super-admin/` → panel separado TypeScript + Vite (gestión multi-empresa)
- `CONTROL REMITOS/` → legacy FastAPI+SQLite+React-TS en producción paralela — no tocar
- `CRM/` → proyecto aparte con su propio `.git` (BACKEND/FRONTEND/VTEX)
- `MERCADOLIBRE/meli_stock_pipeline/` → pipeline standalone Dragonfish↔MercadoLibre
- `webhook/WEBHOOK MERCADO/` → receptores de webhooks de MercadoLibre
- `deploy/` → scripts VPS Linux (Docker, nginx, ssh, setup-cliente.ps1)
- `schema/` → SQL DDL de la "Fase 0" planeada originalmente; documental, no usado
- `BASE DE DATOS/` → datadir de PostgreSQL (no tocar)
- `DISTRIBUIBLES/` → exe empaquetado + ZIP de distribución
- `Instalador ERP/`, `DEMO JEFE/`, `PROPUESTA RFID/` → assets y demos
- `_tools/` → herramientas varias; contiene su propio `.github/workflows`
- Raíz también tiene utilidades Python sueltas (`_apply_pg_rewrite.py`, `_test_conn.py`, `analizar_sqlserver.py`, `dump_sqlserver_completo.py`, `auto_deploy.py`)

## Cómo correr el proyecto

```powershell
# Arranque full automatizado (verifica Postgres, levanta backend y frontend, abre browser)
D:\ERP MUNDO OUTDOOR\start.bat

# Backend manual
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Frontend dev
cd "D:\ERP MUNDO OUTDOOR\erp\frontend"
npx vite                  # puerto 5173, proxy /api -> :8001

# Build + empaquetar Electron + ZIP + reabrir cliente
D:\ERP MUNDO OUTDOOR\DEPLOY_RAPIDO.bat

# Watcher que dispara DEPLOY_RAPIDO al detectar cambios en src/
python "D:\ERP MUNDO OUTDOOR\auto_deploy.py"

# Migraciones
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
alembic revision --autogenerate -m "desc"
alembic upgrade head

# psql
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor

# Tests (smoke, requieren backend corriendo)
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\pytest tests_minimal.py -v
```

## Flujo de datos principal

1. Cliente (browser, PWA, Electron o Android) autentica con `POST /api/v1/auth/login` → recibe JWT y lo guarda en `sessionStorage`; si está offline, `AuthContext` valida contra hash cacheado en IndexedDB.
2. Cada request pasa por `get_current_user()` en `app/api/deps.py` que valida JWT, chequea licencia (403 si `LICENCIA_SUSPENDIDA/CANCELADA`) y resuelve `company_id` para scoping multi-tenant.
3. `RequireModule("slug")` (en `app/api/module_guard.py`) verifica contra tabla `CompanyModule` que el módulo esté habilitado para la empresa; MEGAADMIN y SUPERADMIN bypasean.
4. Las queries filtran por `company_id` del usuario; las escrituras pasan por el ORM SQLAlchemy contra PostgreSQL 2048.
5. Algunos módulos consumen SQL Server (Tango) vía `/api/v1/sql_server` y `/api/v1/informes` con `pyodbc`; otros consumen MercadoLibre vía `/api/v1/ml` y `/api/v1/ml_competitor`.
6. Operaciones offline se encolan en IndexedDB (`mo-erp-offline`) y se reenvían al volver online desde `offlineSync.js`; el SW escucha `FLUSH_PENDING_OPS`.
7. El frontend poolea `/api/v1/system/version` cada 30s y fuerza reload si cambia `build_hash` (evita stale chunks en Electron).
8. Cambios a `erp/frontend/src/` requieren `DEPLOY_RAPIDO.bat`: build Vite → `electron-packager` → copia a `DISTRIBUIBLES/` → ZIP → relanza exe → `POST /improvement-notes/internal/mark-all-deployed` para notificar autores de mejoras.

## Estado actual

Funcionando (según `MIGRACION_ESTADO.md`, 7-abr-2026):
- Backend migrado desde Control Remitos: ~67% (14/21 grupos de endpoints)
- Frontend pages: ~73% (16/22 pages activas)
- DB: ~90% (18/20 tablas)
- Módulos nuevos (no existían en legacy): Productos+Variantes, Ventas, Stock, Kanban, RRHH, CRM, MercadoLibre, RFID, Fichaje facial, WebAuthn, Informes SQL Server, SuperTrend, Mensajería interna, Sistema de Mejoras (copilot automator), Arena (easter egg)

En progreso / roto:
- Componentes de Control Remitos pendientes: ExcelViewer, PdfViewer, ComparadorCruzado, CargaMasiva, CargaAvanzada, HistoriaProveedor, ComparadorPrecios, ComparadorListaFacturas, ComparadorOmbak, CrucePreciosModal (prioridad alta).
- Dashboard con métricas reales, RecepcionPage (confirmar llegada + foto), ReportesPage (exportar, stats proveedores) incompletos.
- Redis/Memurai: no instalado correctamente — código lo trata como opcional.
- Notas de mejoras pendientes en `NOTAS_MEJORAS.md` (abr-2026): multi-selección de locales en informes, totalización por marca, gráficos comparativos en SuperTrend, detalles de envío ML (Full/Flex/Colecta), botón flotante de mensajes global, mensajes configurables en Socios Montagne, corrección de conteo de ventas Valen/Neuquen, renombres MUNDO.OUTDOOR/aspen, fix de imagen "dañada" en RFID Contenido.
- `erp/README.md` está desactualizado (menciona TypeScript + shadcn que no existen).
- `ERP_PROYECTO_RESUMEN.md` describe el sistema legacy, no el ERP nuevo.
- `estructura.md` y `plan.md` describen la arquitectura planeada Fase 0 (Node+Fastify+SQLite), que fue reemplazada por el stack Python actual — no tomarlos como fuente de verdad.

## Archivos clave

- `erp/backend/main.py` → entrypoint real FastAPI; seeding inicial, WhatsApp sender, APScheduler, snapshot worker, SPA fallback
- `erp/backend/app/api/v1/router.py` → registra todos los sub-routers (~65)
- `erp/backend/app/api/deps.py` → `get_current_user`, `require_roles`, scope multi-tenant
- `erp/backend/app/api/module_guard.py` → `RequireModule` por empresa
- `erp/backend/app/services/copilot_hook.py` → lanza `copilot_automator.py` en consola nueva cuando se aprueba una mejora
- `erp/backend/app/api/v1/improvement_notes.py` → CRUD + approve + approve-manual + cancel + endpoints internos (`set-ai-reply`, `mark-deployed`, `mark-all-deployed`) con `AUTOMATOR_SECRET`
- `erp/frontend/src/App.jsx` → rutas lazy-loaded, polling de versión
- `erp/frontend/src/layouts/AppLayout.jsx` → `NAV_ITEMS`, visibilidad por rol/módulo, Arena easter egg via input secreto
- `erp/frontend/src/lib/api.js` → cliente HTTP con URL dinámica según runtime (capacitor/electron/browser), manejo 401/403
- `erp/frontend/src/context/AuthContext.jsx` → login online/offline, restauración desde IndexedDB
- `erp/frontend/src/lib/offlineDB.js`, `offlineSync.js` → cola de operaciones offline
- `erp/frontend/public/sw.js` → service worker (stale-while-revalidate + network-first)
- `erp/frontend/vite.config.js` → chunks con nombres estables sin hash (no cambiar), proxy a :8001, preview en :9980
- `erp/electron-cliente/main.js` → cliente Windows; contiene hardcode `SERVER_URL='http://190.211.201.217:8000'` (histórico, revisar al tocar auth)
- `DEPLOY_RAPIDO.bat` → pipeline de deploy frontend obligatorio
- `auto_deploy.py` → watcher que dispara `DEPLOY_RAPIDO` con debounce de 12s
- `start.bat` → arranque full (postgres check + backend + frontend + browser)
- `C:\Users\Mundo Outdoor\Documents\Proyecto ERP\copilot_automator.py` → NO está en el repo; corre Copilot CLI en autopilot, hace build, empaqueta, deploya
- `.github/copilot-instructions.md` → reglas vigentes para agentes (puerto 8001, bcrypt 4.x, sessionStorage, no tocar CONTROL REMITOS)

## NUNCA tocar sin preguntar

- `CREDENCIALES.txt` → contiene contraseñas reales de Postgres, admin, SQL Server; está gitignored
- `erp/backend/.env` → secretos reales (JWT_SECRET, DB password, AUTOMATOR_SECRET); gitignored
- `BASE DE DATOS/` → data directory de PostgreSQL en disco; corromperlo rompe producción
- `CONTROL REMITOS/` → app legacy en producción paralela; regla explícita en `.github/copilot-instructions.md`
- `erp/backend/alembic/versions/*.py` → migraciones ya aplicadas en producción; no editar, solo agregar nuevas
- `erp/frontend/vite.config.js` → la estrategia de chunks sin hash es intencional por el flujo Electron; no reintroducir hashes
- `erp/electron-cliente/main.js` → toca auth/license/machine-id; cualquier cambio debe verificarse en browser y Electron
- `sqlserver_dump_completo.json`, `sqlserver_resumen.txt`, `dump_sqlserver_completo.py` → datos exportados de producción
- `crush.ps1` → embebe API key; gitignored
- `.crush/`, `.venv/`, `venv/`, `node_modules/`, `dist/` → artefactos o entornos locales
- `CRM/` → tiene su propio `.git`; cambios requieren coordinación aparte

## Convenciones del proyecto

- Nombres de archivo y columnas: snake_case en backend, PascalCase en componentes React, camelCase en variables JS
- Roles y módulos: strings uppercase (`MEGAADMIN`, `SUPERADMIN`, `ADMIN`, `COMPRAS`, `ADMINISTRACION`, `GESTION_PAGOS`, `LOCAL`, `VENDEDOR`, `DEPOSITO`)
- Schemas Pydantic: definidos inline junto al router, no en `app/schemas/` separado; siempre `model_config = {"from_attributes": True}` en respuestas
- Multi-tenant: toda query debe filtrar por `current_user.company_id` salvo MEGAADMIN/SUPERADMIN
- Relationships SQLAlchemy frecuentes: `lazy="selectin"`
- Frontend: Tailwind classes directas inline, sin librería UI; modals inline en cada page; archivos grandes aceptados
- Rutas: todas lazy-cargadas con wrapper `LazyPage` (Suspense + ErrorBoundary)
- TanStack Query: `useQuery` + `useMutation` + `queryClient.invalidateQueries` como patrón estándar
- Token en `sessionStorage` siempre; no migrar a `localStorage`
- Iconos: `lucide-react`; gráficos: `recharts`; toasts: `useToast()` de `components/ToastProvider`
- Comentarios en español para business rules, inglés para lógica técnica pura
- Sistema de mejoras: nunca implementar una nota sin verificar `ImprovementNote.is_done=true`
- Tras cambios en `erp/frontend/src/`: correr `DEPLOY_RAPIDO.bat` antes de dar por terminada la tarea
- Backend con `--reload`: no reiniciar manualmente para cambios de código
- Chunks Vite con nombres estables (sin hash); `/assets/*` y `index.html` se sirven con `no-cache`

## Tareas frecuentes

- Agregar endpoint a un módulo → `erp/backend/app/api/v1/<modulo>.py` + registrar en `router.py` si es nuevo
- Agregar página React → `erp/frontend/src/pages/<Page>.jsx` + ruta en `App.jsx` + entrada en `NAV_ITEMS` de `AppLayout.jsx` (respetar role/module filtering)
- Agregar columna a tabla → modelo en `app/models/` + `alembic revision --autogenerate` + `alembic upgrade head`
- Habilitar módulo para una empresa → tabla `CompanyModule` o vía `/api/v1/modules` desde el panel MEGAADMIN
- Aprobar una mejora del tablero → UI en `/mejoras` (`MejorasPage.jsx`) botón "OK — Copilot" o "OK — Manual"; esto dispara `copilot_hook.trigger_copilot()` que abre una consola nueva con `copilot_automator.py`
- Deployar cambio de frontend a clientes Electron → `DEPLOY_RAPIDO.bat` (o `auto_deploy.py` como watcher)
- Migrar datos desde Control Remitos → `erp/scripts/migrate_control_remitos.py [--dry-run] [--table providers|orders|invoices|payments] [--company-id N]`
- Consultar SQL Server heredado (Tango) → router `app/api/v1/sql_server.py` y `informes.py`
- Debug de integración MercadoLibre → `erp/backend/app/api/v1/ml.py`, `ml_competitor.py`; pipeline standalone en `MERCADOLIBRE/meli_stock_pipeline/`
- Revisar logs backend → `erp/backend/uvicorn.log`, `uvicorn.err`
- Tests backend → `tests_minimal.py` (pytest contra backend HTTP en `localhost:8000` — inconsistente con el 8001 de producción; verificar antes de correr)
