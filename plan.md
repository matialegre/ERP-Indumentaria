# Plan: Mundo Outdoor ERP — Año 1

## TL;DR
ERP de nivel enterprise, construido desde cero. Multi-tenant desde el día 1 (escala a otras empresas de indumentaria). Stack: FastAPI + PostgreSQL + Redis + React + Vite + Tailwind + shadcn/ui. Primer módulo: Ingreso de mercadería. El Control de Remitos existente sigue corriendo en paralelo y se integra después, no es la base.

## Decisiones de arquitectura
- **Multi-tenant**: tabla `companies` → todo dato scoped a `company_id`. Usuario pertenece a una empresa.
- **Un solo backend**: FastAPI + PostgreSQL + Redis. Sin proxies, sin parches.
- **Stack**: Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, Alembic, psycopg2, Redis (Memurai en Windows)
- **Frontend**: React 19, Vite 6, Tailwind v4, shadcn/ui, TanStack Query v5, TanStack Table v8, React Router v7, Recharts, Lucide icons
- **PWA**: funciona como app en celular/tablet sin build nativo
- **Cero código migrado**: Control Remitos es solo referencia de lógica de negocio
- **Sin Docker en Fase 1**: PostgreSQL y Memurai corren como servicios nativos de Windows

## Estructura de carpetas (definitiva)
Todo en `x:\ERP MUNDO OUTDOOR\`

```
ERP MUNDO OUTDOOR\
│
├── CONTROL REMITOS\          ← no se toca, sigue corriendo
│
└── erp\                      ← el ERP nuevo, desde cero
    ├── backend\
    │   ├── app\
    │   │   ├── api\
    │   │   │   ├── deps.py           ← auth, permisos, scope de company
    │   │   │   └── v1\               ← versioned API
    │   │   │       └── routers\
    │   │   │           ├── auth.py
    │   │   │           ├── companies.py
    │   │   │           ├── users.py
    │   │   │           ├── locals.py
    │   │   │           ├── providers.py
    │   │   │           ├── ingresos.py      ← primer módulo real
    │   │   │           ├── products.py      ← Fase 2
    │   │   │           └── stock.py         ← Fase 2
    │   │   ├── core\
    │   │   │   ├── config.py
    │   │   │   └── security.py
    │   │   ├── db\
    │   │   │   ├── base.py
    │   │   │   └── session.py
    │   │   ├── models\
    │   │   │   ├── company.py        ← multi-tenant base
    │   │   │   ├── user.py
    │   │   │   ├── local.py
    │   │   │   ├── provider.py
    │   │   │   ├── ingreso.py        ← primer módulo
    │   │   │   └── __init__.py
    │   │   ├── schemas\
    │   │   └── main.py
    │   ├── alembic\
    │   │   ├── versions\
    │   │   └── env.py
    │   ├── alembic.ini
    │   ├── requirements.txt
    │   ├── .env                      ← secretos reales, NO en git
    │   └── .env.example
    │
    └── frontend\
        ├── public\
        │   ├── manifest.json         ← PWA
        │   └── icons\
        ├── src\
        │   ├── components\
        │   │   └── ui\               ← shadcn/ui components
        │   ├── pages\
        │   ├── hooks\
        │   ├── lib\
        │   │   └── api.ts
        │   ├── context\
        │   │   └── AuthContext.tsx
        │   ├── types\
        │   └── main.tsx
        ├── package.json
        ├── vite.config.ts
        └── tailwind.config.ts
```

## FASE 1 — Cimientos (Meses 1–3)

### PASO 0 — Instalaciones (solo lo hace el usuario)
En este orden:
1. `postgresql-18.3-2-windows-x64.exe` → instalar, anotar la contraseña del usuario `postgres`
2. `pgadmin4-9.13-x64.exe` → instalar
3. `Memurai Developer Edition` → instalar (servicio Windows, puerto 6379)

Después de instalar: crear la DB `erp_mundooutdoor` y usuario `erp_user` en pgAdmin.

### PASO 1 — Estructura base del proyecto (Yo lo hago)
- Crear carpeta `x:\ERP MUNDO OUTDOOR\erp\` con la estructura completa
- `backend/requirements.txt` con todas las dependencias
- `backend/.env.example` con todas las variables (sin valores reales)
- `backend/app/core/config.py` con Settings usando pydantic-settings
- `backend/app/db/session.py` con PostgreSQL engine + sessionmaker
- `backend/app/db/base.py` con DeclarativeBase
- `backend/app/main.py` con FastAPI app + CORS + lifespan
- Alembic inicializado: `alembic.ini` + `alembic/env.py`

### PASO 2 — Modelos y migración inicial (Yo lo hago)
Multi-tenant core:
- `models/company.py`: Company (id, name, slug, plan, is_active, created_at)
- `models/user.py`: User (id, company_id, username, password_hash, role, local_id, is_active)
- `models/local.py`: Local (id, company_id, name, address)
- `models/provider.py`: Provider (id, company_id, name, cuit, email, phone, logo_filename)

Migración Alembic inicial: `001_initial_schema.py`

### PASO 3 — Auth + RBAC (Yo lo hago)
- JWT con bcrypt, tokens de 8h
- Roles: SUPERADMIN (ve todo) | ADMIN | COMPRAS | ADMINISTRACION | GESTION_PAGOS | LOCAL | VENDEDOR
- `deps.py`: get_current_user, require_roles, get_company_scope (filtra por company_id)
- Rate limiting con slowapi: 100 req/min general, 10 req/min en /auth/login
- CORS restrictivo desde .env

### PASO 4 — Módulo Ingreso de Mercadería (Yo lo hago, semanas 3-6)
Re-implementación limpia de lo que ya tienen en Control Remitos:
- Notas de pedido (órdenes de compra)
- Ingresos: facturas + remitos de proveedor
- Recepción en locales (confirmar llegada)
- Pagos a proveedores
- Upload y parsing de PDFs (reutilizar la lógica de extracción del viejo)
- Grupos de notas
- Comparadores (OMBAK, cruzado, precios)

Tablas nuevas (Alembic migration 002):
- `orders` (notas de pedido)
- `ingresos` (facturas/remitos recibidos)
- `remitos` (remitos de entrega)
- `payments` (pagos)

### PASO 5 — Frontend base + PWA (Yo lo hago, paralelo con Paso 4)
- React 19 + Vite 6 + Tailwind v4 + shadcn/ui setup
- PWA: manifest.json + vite-plugin-pwa
- Layout responsivo: sidebar desktop, bottom nav mobile
- Pantallas: Login, Dashboard vacío, módulo Ingresos
- Auth context con JWT

### Verificación Fase 1
- [ ] PostgreSQL corriendo: `pg_isready -h localhost` → `accepting connections`
- [ ] Memurai: `redis-cli ping` → `PONG`
- [ ] `alembic upgrade head` sin errores
- [ ] Backend en :8000, docs en localhost:8000/docs
- [ ] Login funciona, JWT válido
- [ ] Frontend en :5173, se instala como PWA en celular
- [ ] Módulo ingresos: CRUD completo funcionando

## FASE 2 — Productos con talle/color + Stock (Meses 3–6)
- `models/product.py`: Product, Category, Brand, Season
- `models/variant.py`: ProductVariant (product_id, size_id, color_id, barcode, sku)
- `models/size.py`, `models/color.py`
- `models/stock.py`: StockLocation (variant_id, local_id, quantity), StockMovement (trazabilidad)
- API matriz talle×color
- Redis cache de stock actual
- Frontend: ProductMatrix, StockGrid, BarcodeScanner (cámara PWA)
- Import masivo desde Excel

## FASE 3 — Diseño profesional (Meses 5–7, paralelo con Fase 2)
- Las diseñadoras definen sistema de diseño en Figma
- shadcn/ui configurado con tema de Mundo Outdoor
- Dark mode / light mode
- Rediseño de las 5 pantallas clave

## FASE 4 — Roles + Auditoría + Deploy en VPS (Meses 7–9)
- audit_log automático en todo write
- Notificaciones internas en tiempo real
- Transferencias entre locales
- Deploy: Hetzner VPS $30-65/mes, Nginx + HTTPS

## FASE 5 — Logística completa + Optimización 500 usuarios (Meses 9–12)
- Inventario físico desde celular
- Load testing con Locust (500 usuarios concurrentes)
- PgBouncer
- Reportes y dashboards

## Infraestructura progresiva
| Período | Infra | Costo | Usuarios |
|---------|-------|-------|----------|
| Mes 1–3 | PC local (PostgreSQL + Memurai nativos) | $0 | Solo dev |
| Mes 4–6 | PC + VPS Hetzner $30 (staging) | $30/mes | 5–10 |
| Mes 7–9 | VPS $65 (producción) | $65/mes | 20–50 |
| Mes 10–12 | VPS $120 + PgBouncer | $120/mes | 50–200 |
| Año 2+ | Distribuido | $350–500/mes | 200–500 |

## Excluido del Año 1
- POS / Punto de venta
- Facturación electrónica AFIP
- Clientes + cuenta corriente
- Precios / descuentos / promos
- E-commerce
- App nativa
- Contabilidad
- Integración Control Remitos (se hace cuando el ERP tenga el módulo equivalente funcionando)
