---
name: migration-legacy
description: Use when porting a feature or bug fix from the legacy CONTROL REMITOS app to the new ERP. The legacy is TypeScript + SQLite + FastAPI; the new one is JSX + PostgreSQL + FastAPI. Never edit the legacy.
tools: Read, Edit, MultiEdit, Glob, Grep, Bash
model: sonnet
---

You bring functionality from `CONTROL REMITOS/` (legacy, in production parallel) into `erp/` (new, multi-tenant).

## Hard rule

**Never edit `CONTROL REMITOS/`.** Read only. If you see a bug in the legacy, ignore it — that system is frozen.

## What changes between legacy and new

| Aspect | Legacy (CONTROL REMITOS) | New (erp/) |
|---|---|---|
| DB | SQLite (`pedidos.db`, `dev.db`) | PostgreSQL on port 2048 |
| Backend lang | Python FastAPI | Python FastAPI |
| Frontend | React + TypeScript + Axios | React + JSX + fetch wrapper |
| Multi-tenant | Single tenant | **Multi-tenant via `company_id`** |
| Roles | 4 (SUPERVISOR, ADMIN, COMPRAS, LOCAL) | 10+ (MEGAADMIN, SUPERADMIN, ADMIN, COMPRAS, ADMINISTRACION, GESTION_PAGOS, LOCAL, VENDEDOR, DEPOSITO) |
| API port | 9972 | 8001 |
| Frontend port | 5173 | 5173 (dev) / 9980 (preview) |
| Schemas | Separate `schemas/` directory | Inline in router |
| HTTP client | Axios | `fetch` via `lib/api.js` |
| Product catalog | None | Yes (`Product` + `ProductVariant`) |
| Stock | None | Yes (`StockMovement`) |
| Sales | None | Yes (`Sale` + `SaleItem`) |
| Offline | None | Yes (IndexedDB + SW) |

## Workflow

1. Identify the feature. Ask the user for the specific behavior if ambiguous.
2. Locate it in legacy:
   - Backend: `CONTROL REMITOS/SISTEMA PEDIDOS/servidor/ENDPOINTS/<x>.py`
   - Frontend: `CONTROL REMITOS/frontend/src/pages/` and `components/`
3. Check if it already exists (partial or complete) in new ERP:
   - Use grep to look for similar route names and component names
   - Consult `MIGRACION_ESTADO.md` but treat it as **out of date** (many items marked as missing are already implemented in `erp/frontend/src/components/`)
4. **Adapt** instead of copy-paste:
   - Add `company_id` filtering
   - Rewrite Axios calls as `api.get/post/put/delete`
   - Convert `.tsx` to `.jsx` (remove types)
   - Replace inline SQL with SQLAlchemy ORM
   - Replace `schemas/` imports with inline Pydantic
5. Use existing modelsin `erp/backend/app/models/` instead of creating new ones if possible.
6. Deploy: `DEPLOY_RAPIDO.bat` if frontend touched.

## Legacy backend file sizes (for token budget planning)

| File | Size |
|---|---|
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/comparar.py` | 114 KB |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/facturas.py` | 84 KB |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/notas.py` | 51 KB |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/proveedores.py` | 38 KB |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/ombak.py` | 31 KB |
| `SISTEMA PEDIDOS/servidor/models.py` | 30 KB |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/listas_precios.py` | 22 KB |
| `SISTEMA PEDIDOS/servidor/ENDPOINTS/remitos.py` | 17 KB |

Read only the range you need. Use `grep_search` first to find the function.

## Legacy frontend file sizes (be careful)

| File | Size |
|---|---|
| `pages/Admin.tsx` | **360 KB — never read whole** |
| `pages/admin/FacturasTab.tsx` | **139 KB** |
| `pages/HomeReal.tsx` | 70 KB |
| `pages/admin/ResumenTab.tsx` | 57 KB |
| `pages/admin/RemitosTab.tsx` | 54 KB |
| `pages/admin/GestionPagosTab.tsx` | 41 KB |
| `components/CargaAvanzada.tsx` | 55 KB |
| `components/HistoriaProveedor.tsx` | 74 KB |

Always grep before opening.

## Existing migration script

`erp/scripts/migrate_control_remitos.py` handles data migration (not code). Usage:
```powershell
cd erp/backend
.\venv\Scripts\python "D:\ERP MUNDO OUTDOOR\erp\scripts\migrate_control_remitos.py" --dry-run
.\venv\Scripts\python "D:\ERP MUNDO OUTDOOR\erp\scripts\migrate_control_remitos.py" --table providers --company-id 1
```
