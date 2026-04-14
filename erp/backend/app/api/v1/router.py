"""
Router principal v1 — agrupa todos los sub-routers
"""

from fastapi import APIRouter
from datetime import datetime, timezone
from app.api.v1.auth import router as auth_router
from app.api.v1.companies import router as companies_router
from app.api.v1.users import router as users_router
from app.api.v1.locals import router as locals_router
from app.api.v1.providers import router as providers_router
from app.api.v1.products import router as products_router
from app.api.v1.ingresos import router as ingresos_router
from app.api.v1.system import router as system_router
from app.api.v1.pedidos import router as pedidos_router
from app.api.v1.sales import router as sales_router
from app.api.v1.stock import router as stock_router
from app.api.v1.menu_config import router as menu_config_router
from app.api.v1.purchase_orders import router as purchase_orders_router
from app.api.v1.purchase_invoices import router as purchase_invoices_router
from app.api.v1.payments import router as payments_router
from app.api.v1.transports import router as transports_router
from app.api.v1.kanban import router as kanban_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.price_lists import router as price_lists_router
from app.api.v1.sql_server import router as sql_server_router
from app.api.v1.pdf_parser import router as pdf_parser_router
from app.api.v1.legacy import router as legacy_router
from app.api.v1.improvement_notes import router as improvement_notes_router
from app.api.v1.socios import router as socios_router
from app.api.v1.modules import router as modules_router
from app.api.v1.mega import router as mega_router
from app.api.v1.branding import router as branding_router
from app.api.v1.templates import router as templates_router
from app.api.v1.plans import router as plans_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.comisiones import router as comisiones_router
from app.api.v1.work_orders import router as work_orders_router
from app.api.v1.customers import router as customers_router
from app.api.v1.deposito import router as deposito_router
from app.api.v1.supertrend import router as supertrend_router
from app.api.v1.sync import sync_router, storage_router
from app.api.v1.importacion import router as importacion_router
from app.api.v1.employee_scores import router as employee_scores_router
from app.api.v1.informes import router as informes_router

api_router = APIRouter(prefix="/api/v1")


# ── Health check (no auth, < 100 ms) ──────────────────────────────────────
# El frontend lo usa para detectar si hay conexión con el servidor (no solo internet).

_APP_VERSION = "1.0.0"

@api_router.get("/health", tags=["Sistema"], include_in_schema=True)
def health():
    """Ping rápido sin auth — siempre responde en < 100 ms."""
    return {
        "status": "ok",
        "server_time": datetime.now(timezone.utc).isoformat(),
        "version": _APP_VERSION,
    }


api_router.include_router(auth_router)
api_router.include_router(companies_router)
api_router.include_router(users_router)
api_router.include_router(locals_router)
api_router.include_router(providers_router)
api_router.include_router(products_router)
api_router.include_router(ingresos_router)
api_router.include_router(system_router)
api_router.include_router(pedidos_router)
api_router.include_router(sales_router)
api_router.include_router(stock_router)
api_router.include_router(menu_config_router)
# Módulo Compras (CONTROL REMITOS migrado)
api_router.include_router(purchase_orders_router)
api_router.include_router(purchase_invoices_router)
api_router.include_router(payments_router)
api_router.include_router(transports_router)
api_router.include_router(kanban_router)
api_router.include_router(notifications_router)
api_router.include_router(price_lists_router)
api_router.include_router(sql_server_router)
api_router.include_router(pdf_parser_router)
api_router.include_router(legacy_router)
api_router.include_router(improvement_notes_router)
api_router.include_router(socios_router)
api_router.include_router(modules_router)
api_router.include_router(mega_router)
api_router.include_router(branding_router)
api_router.include_router(templates_router)
api_router.include_router(plans_router)
api_router.include_router(onboarding_router)
api_router.include_router(comisiones_router)
api_router.include_router(work_orders_router)
api_router.include_router(customers_router)
api_router.include_router(deposito_router)
# Módulo SuperTrend (análisis de competencia)
api_router.include_router(supertrend_router)
# Sincronización + Storage
api_router.include_router(sync_router)
api_router.include_router(storage_router)
# Módulo Importación (indumentaria)
api_router.include_router(importacion_router)
# Módulo Puntuación de Empleados
api_router.include_router(employee_scores_router)
# Módulo Informes (SQL Server)
api_router.include_router(informes_router)
