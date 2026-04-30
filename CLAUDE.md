# Instrucciones para Claude Code

**Antes de cualquier cosa, leer `AGENTS.md` en la raíz.** Ese archivo tiene el contexto completo del proyecto. No explorar el codebase a ciegas.

**Principios de trabajo**: aplicar siempre `.claude/skills/karpathy-principles.md` — pensar antes de escribir, simplicidad primero, cambios quirúrgicos, objetivos verificables.

## Reglas duras (no romper nunca)

1. **Puerto backend: 8001.** El 8000 es CRM legacy.
2. **Postgres puerto 2048** (no 5432). DB `erp_mundooutdoor`, user `erp_user`.
3. **No tocar `CONTROL REMITOS/`** — sigue en producción paralela. Solo leer como referencia.
4. **No tocar `CRM/`** — tiene su propio git.
5. **No tocar `BASE DE DATOS/`** — datadir de Postgres.
6. **No editar migraciones existentes** en `erp/backend/alembic/versions/`. Solo agregar nuevas.
7. **Token en `sessionStorage`**, nunca `localStorage`.
8. **Frontend es JSX, NO TypeScript.** No convertir a TS.
9. **No usar `vite-plugin-pwa`** (incompatible con Vite 8).
10. **Mejoras**: nunca implementar nota cuyo `ImprovementNote.is_done=false`.
11. **Tras tocar `erp/frontend/src/`**: correr `DEPLOY_RAPIDO.bat` antes de dar por terminada la tarea.
12. **Backend con `--reload`**: no reiniciar manualmente.
13. **bcrypt 4.0.1** (no 5.x — rompe passlib).
14. **No agregar hash a chunks de Vite** — la estrategia sin-hash es intencional.

## Dónde buscar qué

| Si el tema es… | Ir directamente a… |
|---|---|
| Compras, notas de pedido, facturas de proveedor, pagos | Leer `.claude/docs/COMPRAS_MAPA.md` primero |
| Mejoras aprobadas por admin | `erp/backend/app/api/v1/improvement_notes.py` + `erp/frontend/src/pages/MejorasPage.jsx` |
| Auth, JWT, roles | `erp/backend/app/api/deps.py` + `erp/frontend/src/context/AuthContext.jsx` |
| Multi-tenant scoping | `erp/backend/app/api/module_guard.py` + `deps.py` |
| Navegación, visibilidad de rutas | `erp/frontend/src/layouts/AppLayout.jsx` |
| API client (fetch wrapper) | `erp/frontend/src/lib/api.js` |
| MercadoLibre | `erp/backend/app/api/v1/ml.py` + `ml_competitor.py` |
| Informes SQL Server | `erp/backend/app/api/v1/informes.py` + `sql_server.py` |
| Offline / IndexedDB | `erp/frontend/src/lib/offlineDB.js` + `offlineSync.js` |

## Estrategia para gastar pocos tokens

- Cuando el usuario pide algo, **primero leer AGENTS.md + el archivo relevante del mapa** (ej `.claude/docs/COMPRAS_MAPA.md`), no explorar todo el repo.
- Usar `grep_search` con filtros (`Includes`) antes que `list_dir`.
- Para archivos grandes (>500 líneas) leer solo el rango necesario con `offset`/`limit`.
- No leer `CONTROL REMITOS/frontend/src/pages/Admin.tsx` completo (360 KB). Usar grep con contexto acotado.
- No leer `node_modules/`, `dist/`, `venv/`, `BASE DE DATOS/`, `DISTRIBUIBLES/`.

## Subagents disponibles

Ver `.claude/agents/`. Invocar con `@agent-name` cuando la tarea encaja:

- `@compras-specialist` — módulo compras/notas/facturas/pagos
- `@backend-architect` — FastAPI, SQLAlchemy, Alembic, routers
- `@frontend-react` — React 19, Tailwind, TanStack Query
- `@migration-legacy` — traer funcionalidad desde CONTROL REMITOS
- `@code-reviewer` — revisar cambios antes de confirmar
- `@debugger` — resolver bugs con logs + tests

## Slash commands

- `/compras` — carga contexto completo del módulo compras
- `/deploy` — corre DEPLOY_RAPIDO.bat
- `/mejora <id>` — implementa una nota de mejora aprobada
- `/migrate-cr <archivo>` — plantilla para migrar un archivo del legacy

## Workflow recomendado

1. Leer `AGENTS.md` si no se hizo aún
2. Leer el mapa del módulo afectado en `.claude/docs/`
3. Decidir qué archivos tocar (idealmente < 5)
4. Hacer los cambios con `edit` / `multi_edit`
5. Si tocó frontend: correr `DEPLOY_RAPIDO.bat` (o avisar al usuario)
6. Si tocó schema DB: `alembic revision --autogenerate` + `upgrade head`
7. Pasar por `@code-reviewer` antes de cerrar
