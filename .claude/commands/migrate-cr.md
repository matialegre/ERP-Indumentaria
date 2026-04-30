---
description: Template for porting a feature from CONTROL REMITOS legacy to the new ERP
argument-hint: <feature_or_filename>
---

Port the following from `CONTROL REMITOS/` to `erp/`: $ARGUMENTS

Invoke `@migration-legacy` with this plan:

1. Locate the feature in legacy:
   - Backend: search in `CONTROL REMITOS/SISTEMA PEDIDOS/servidor/ENDPOINTS/`
   - Frontend: search in `CONTROL REMITOS/frontend/src/pages/` and `components/`
2. Check if it already exists (partial or full) in the new ERP. `MIGRACION_ESTADO.md` is outdated — many components listed as missing already exist in `erp/frontend/src/components/`. Always grep first.
3. Adapt (don't copy-paste):
   - Add multi-tenant `company_id` filtering
   - Convert Axios → `api` wrapper in `lib/api.js`
   - Convert `.tsx` → `.jsx` (strip types)
   - Use SQLAlchemy ORM instead of raw SQL
   - Inline Pydantic schemas (no separate `schemas/` directory)
   - Use PostgreSQL types (JSONB instead of TEXT+json.loads)
4. Register new backend router in `app/api/v1/router.py`
5. Register new frontend page in `App.jsx` and `AppLayout.jsx` with role/module filtering
6. Run `DEPLOY_RAPIDO.bat` if frontend touched
7. Report back with file paths changed and verification steps
