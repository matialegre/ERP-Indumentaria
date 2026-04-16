"""
Mundo Outdoor ERP — Punto de entrada principal
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import engine, SessionLocal, get_db
from app.db.base import Base
from app.models import Company, User, UserRole  # noqa: F401
from app.api.v1.router import api_router
from app.core.metrics import MetricsMiddleware
from app.middleware.company_isolation import CompanyIsolationMiddleware

settings = get_settings()

# Ruta al build del frontend (relativa al backend)
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))


def _run_socios_daily():
    """Tarea diaria 8am: actualizar datos + enviar mensajes WA a todos los locales"""
    import asyncio
    from app.api.v1.socios import _task_actualizar, _task_enviar
    async def _job():
        await _task_actualizar()
        await asyncio.sleep(60)   # esperar 1 min para que termine el scraping
        await _task_enviar("", False)
    asyncio.run(_job())


def create_initial_data(db: Session) -> None:
    """Crea la company y el admin inicial si no existen"""
    # Company por defecto
    company = db.query(Company).filter(Company.cuit == "30-12345678-9").first()
    if not company:
        company = Company(
            name="Mundo Outdoor",
            cuit="30-12345678-9",
            address="Argentina",
            is_active=True,
        )
        db.add(company)
        db.flush()

    # Admin por defecto
    admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
    if not admin:
        admin = User(
            username=settings.ADMIN_USERNAME,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            full_name="Administrador Plataforma",
            role=UserRole.MEGAADMIN,
            company_id=None,  # MEGAADMIN no pertenece a ninguna empresa
            is_active=True,
        )
        db.add(admin)
    elif admin.role == UserRole.SUPERADMIN:
        # Migrar SUPERADMIN existente a MEGAADMIN
        admin.role = UserRole.MEGAADMIN
        admin.company_id = None

    db.commit()

    # Crear planes por defecto
    from app.models.plan import Plan, PlanTier
    if db.query(Plan).count() == 0:
        default_plans = [
            Plan(name="Gratis", tier=PlanTier.FREE, description="Para probar el sistema", max_users=2, max_locals=1, max_products=100, max_modules=3, price_monthly=0, is_default=True),
            Plan(name="Starter", tier=PlanTier.STARTER, description="Para negocios pequeños", max_users=5, max_locals=2, max_products=1000, max_modules=6, price_monthly=15000),
            Plan(name="Profesional", tier=PlanTier.PRO, description="Para negocios en crecimiento", max_users=15, max_locals=5, max_products=10000, max_modules=10, price_monthly=35000),
            Plan(name="Enterprise", tier=PlanTier.ENTERPRISE, description="Sin límites", max_users=999, max_locals=99, max_products=999999, max_modules=13, price_monthly=75000),
        ]
        db.add_all(default_plans)
        db.commit()

    # Seed ML competitor: TODOAIRELIBREGD
    from app.models.ml_competitor import MLTrackedSeller
    existing_seed = db.query(MLTrackedSeller).filter(MLTrackedSeller.seller_id == "32898018").first()
    if not existing_seed:
        first_company = db.query(Company).first()
        if first_company:
            seed_seller = MLTrackedSeller(
                company_id=first_company.id,
                seller_id="32898018",
                nickname="TODOAIRELIBREGD",
                notes="Competidor principal - Todo Aire Libre GD",
                is_active=True,
                check_interval_hours=24,
            )
            db.add(seed_seller)
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crear tablas si no existen + seed inicial
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        create_initial_data(db)
    finally:
        db.close()

    # Auto-start WhatsApp sender
    from app.api.v1.socios import start_wa_server
    result = start_wa_server()
    print(f"[WhatsApp] {result['msg']}")

    # Scheduler: envío diario de mensajes socios a las 8:00am
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    scheduler = BackgroundScheduler()
    scheduler.add_job(_run_socios_daily, CronTrigger(hour=8, minute=0), id="socios_daily", replace_existing=True)
    scheduler.start()
    print("[Scheduler] Tarea diaria socios programada a las 08:00")
    app.state.scheduler = scheduler

    yield
    # Shutdown: detener WhatsApp sender y scheduler
    from app.api.v1.socios import stop_wa_server
    stop_wa_server()
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown(wait=False)


app = FastAPI(
    title="ERP Plataforma",
    version="1.0.0",
    description="ERP empresarial multi-empresa — plataforma SaaS",
    lifespan=lifespan,
)

# Métricas de rendimiento
app.add_middleware(MetricsMiddleware)

# CORS — acepta cualquier origen (ERP interno, auth vía Bearer token)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Aislamiento multi-tenant: extrae company_id del JWT y lo pone en request.state
app.add_middleware(CompanyIsolationMiddleware)

# Routers
app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/manifest.json")
def dynamic_manifest(db: Session = Depends(get_db)):
    """Manifest PWA dinámico — refleja el branding de la empresa"""
    from app.models.company import Company
    company = db.query(Company).filter(Company.is_active == True).first()

    app_name = "ERP Sistema"
    short_name = "ERP"
    theme_color = "#1e40af"
    bg_color = "#f8fafc"

    if company:
        app_name = company.app_name or company.name or app_name
        short_name = company.short_name or (company.name or "ERP")[:2].upper()
        theme_color = company.primary_color or theme_color

    return {
        "name": app_name,
        "short_name": short_name,
        "description": "ERP empresarial",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "display_override": ["window-controls-overlay", "standalone", "minimal-ui"],
        "background_color": bg_color,
        "theme_color": theme_color,
        "orientation": "any",
        "categories": ["business", "productivity"],
        "prefer_related_applications": False,
        "icons": [
            {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
            {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "shortcuts": [
            {"name": "Resumen", "url": "/resumen", "icons": [{"src": "/icons/icon-192.png", "sizes": "192x192"}]},
            {"name": "Ingreso", "url": "/ingreso", "icons": [{"src": "/icons/icon-192.png", "sizes": "192x192"}]},
        ],
    }


# ── Servir imágenes de mejoras (accesibles por frontend y Copilot) ────────────
MEJORAS_IMAGES_DIR = r"D:\ERP MUNDO OUTDOOR\erp\mejoras_images"
if os.path.isdir(MEJORAS_IMAGES_DIR):
    app.mount("/mejoras-img", StaticFiles(directory=MEJORAS_IMAGES_DIR), name="mejoras-img")

# ── Servir uploads de mensajes ────────────────────────────────────────────────
MSG_UPLOADS_DIR = r"D:\ERP MUNDO OUTDOOR\erp\msg_uploads"
os.makedirs(MSG_UPLOADS_DIR, exist_ok=True)
app.mount("/msg-uploads", StaticFiles(directory=MSG_UPLOADS_DIR), name="msg-uploads")

# ── Servir frontend buildeado (producción: un solo puerto 8000) ──────────────
# Si existe el dist/ del frontend, lo servimos como archivos estáticos.
# Cualquier ruta no-API retorna index.html (SPA routing).
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    app.mount("/icons",  StaticFiles(directory=os.path.join(FRONTEND_DIST, "icons")),  name="icons")

    @app.get("/sw.js")
    def serve_sw():
        return FileResponse(os.path.join(FRONTEND_DIST, "sw.js"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        """SPA fallback — todo lo que no sea /api/* sirve index.html"""
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(404)
        index = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index):
            # No-cache: fuerza al browser/Electron a buscar el index.html actualizado
            # en cada navegación, evitando que queden chunks viejos en memoria.
            from fastapi.responses import HTMLResponse
            with open(index, "r", encoding="utf-8") as f:
                content = f.read()
            return HTMLResponse(
                content=content,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )
        return {"error": "Frontend no buildeado"}
