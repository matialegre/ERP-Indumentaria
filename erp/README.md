# Mundo Outdoor ERP

ERP enterprise para indumentaria. Multi-tenant, escalable a 500 usuarios concurrentes.

## Stack
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 + PostgreSQL 18 + Alembic
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Cache**: Redis (Memurai en Windows)

## Requisitos
- PostgreSQL 18 (puerto 2048)
- Python 3.12+
- Node.js 20+

## Arrancar (desarrollo)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Estructura
```
erp/
├── backend/          ← FastAPI + PostgreSQL
│   ├── app/
│   │   ├── api/      ← routers y dependencias
│   │   ├── core/     ← config, security
│   │   ├── db/       ← engine, session, base
│   │   ├── models/   ← SQLAlchemy models
│   │   └── schemas/  ← Pydantic v2
│   └── alembic/      ← migraciones
└── frontend/         ← React + Vite + Tailwind
```
