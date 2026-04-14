# CREDENCIALES DEV — ERP Mundo Outdoor

> **Uso:** Referencia rápida para desarrolladores. NO subir a git, NO compartir.
> **Última verificación:** 13/04/2026 — Copilot VERIFICADOR

---

## URLs del sistema

| Servicio | URL | Estado |
|---|---|---|
| Backend API | http://localhost:8000 | ✅ Siempre levantar primero |
| Swagger / Docs API | http://localhost:8000/docs | ✅ Sin auth, explorable |
| Frontend ERP | http://localhost:5174 | ✅ (5173 ocupado por Control Remitos) |
| eurotaller-cassano | http://localhost:5175 | ✅ Migrado a FastAPI (sin Supabase) |
| Control Remitos (legacy) | http://localhost:5173 | ℹ️ No tocar |
| PostgreSQL | localhost:2048 | ✅ Puerto no-standard (no es 5432) |

---

## Credenciales de acceso

### Admin del ERP
```
Usuario:   admin
Password:  MundoAdmin2026!
Rol:       ADMIN
Empresa:   company_id = 3
```

### Base de datos PostgreSQL
```
Host:      localhost
Puerto:    2048  ← IMPORTANTE: no es el default 5432
DB:        erp_mundooutdoor
Usuario:   erp_user
Password:  MundoOutdoor2026!
```

### Superusuario PostgreSQL (para PgAdmin)
```
Usuario:   postgres
Password:  0896
```

### JWT
```
Secret:    wX9kP2mN7vR4tH8qL3jF6bA1cY5dE0gZuI8oS2nK7xV4
Algoritmo: HS256
Expiración: 8 horas
```

---

## Cómo levantar el backend

```bat
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Notas importantes:**
- Usar `main:app` — NO `app.main:app` (el main.py está en la raíz del backend)
- Usar `python -m uvicorn` — NO `uvicorn` directamente (problema con stderr en PowerShell)
- Usar `python -m alembic` — NO `alembic` directamente (mismo motivo)
- Puerto PostgreSQL es **2048**, está en `erp/backend/.env`

### Primera vez / si falla el seed:
```bat
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
python -m alembic upgrade head
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Reset de password admin (si las credenciales no funcionan):
```bat
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
python -c "
from app.db.session import SessionLocal
from app.models import User
from app.core.security import hash_password
db = SessionLocal()
u = db.query(User).filter(User.username == 'admin').first()
u.hashed_password = hash_password('MundoAdmin2026!')
db.commit()
print('OK — password reseteada')
db.close()
"
```

---

## Cómo levantar el frontend ERP (`erp/frontend/`)

```bat
cd "D:\ERP MUNDO OUTDOOR\erp\frontend"
npm run dev
```

> El puerto configurado en `vite.config.js` es 5173, pero si Control Remitos está corriendo
> Vite automáticamente usa el siguiente disponible (normalmente **5174**).
> Para forzar el puerto:
```bat
node_modules\.bin\vite --port 5174 --host
```

---

## Cómo levantar eurotaller-cassano

> ✅ **Migrado a FastAPI** — ya no requiere Supabase. Solo necesita el backend en :8000.
> ⚠️ Activar módulos OT y CRM para la empresa (ya activados para company_id=3).

```bat
cd "D:\ERP MUNDO OUTDOOR\eurotaller-cassano"
npm run dev
```

Para usar puerto específico y evitar conflictos:
```bat
node_modules\.bin\vite --port 5175
```

### Activar módulos OT/CRM (si es empresa nueva):
```bat
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
python -c "
from app.db.session import SessionLocal
from app.models.module import CompanyModule
db = SessionLocal()
for slug in ['OT', 'CRM']:
    m = CompanyModule(company_id=3, module_slug=slug, is_active=True)
    db.add(m)
db.commit()
db.close()
print('OK')
"
```

---

## Cómo correr los tests

```bat
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
REM El backend debe estar corriendo en :8000
.\venv\Scripts\pytest tests_minimal.py -v
```

### Tests disponibles (11/11):

| Test | Qué verifica |
|---|---|
| `test_health_no_auth` | GET /health → 200 sin auth |
| `test_login` | POST /auth/login → token JWT |
| `test_me` | GET /auth/me → datos del usuario |
| `test_products_list` | GET /products/ → lista paginada |
| `test_stock_list` | GET /stock → inventario |
| `test_notifications_list` | GET /notifications/ |
| `test_sync_bootstrap` | GET /sync/bootstrap → productos + config |
| `test_sync_delta` | GET /sync/delta → eventos incrementales |
| `test_sync_criticos_unregistered_device` | GET /sync/criticos → 404 esperado |
| `test_sync_push_unregistered_device` | POST /sync/events → 404 esperado |
| `test_system_metrics` | GET /system/metrics → CPU/RAM/DB |

---

## Comandos útiles de Alembic

```bat
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate

REM Ver migración actual
python -m alembic current

REM Aplicar todas las migraciones pendientes
python -m alembic upgrade head

REM Ver historial
python -m alembic history

REM Crear nueva migración
python -m alembic revision --autogenerate -m "descripcion"
```

---

## Endpoint de login — referencia rápida

```bash
# curl
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"MundoAdmin2026!"}'

# Respuesta
{"access_token":"eyJ...","token_type":"bearer"}
```

> **Nota:** El campo es `username` (no `email`). El login usa username.
> Para usar el token: `Authorization: Bearer <token>`
