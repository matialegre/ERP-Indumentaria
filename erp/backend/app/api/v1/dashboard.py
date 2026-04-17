"""
Dashboard personalizable por usuario.
Cada usuario tiene su propia lista de widgets con posición y config.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, Any
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# ─── Widgets disponibles ──────────────────────────────────────────────────────

AVAILABLE_WIDGETS = [
    {"id": "ventas_hoy",        "label": "Ventas de hoy",           "icon": "TrendingUp",    "description": "Total y cantidad de ventas del día"},
    {"id": "ventas_recientes",  "label": "Últimas ventas",          "icon": "Receipt",       "description": "Las últimas 5 ventas realizadas"},
    {"id": "mejoras",           "label": "Mejoras pendientes",      "icon": "Lightbulb",     "description": "Notas de mejoras propuestas sin aplicar"},
    {"id": "pedidos_activos",   "label": "Pedidos activos",         "icon": "ShoppingCart",  "description": "Pedidos de compra en curso"},
    {"id": "ingresos_recientes","label": "Ingresos recientes",      "icon": "Package",       "description": "Últimos remitos/facturas recibidos"},
    {"id": "alertas_stock",     "label": "Alertas de stock",        "icon": "AlertTriangle", "description": "Productos con stock bajo o agotado"},
    {"id": "mensajes",          "label": "Mensajes no leídos",      "icon": "MessageSquare", "description": "Mensajes internos pendientes de lectura"},
    {"id": "resumen_stock",     "label": "Resumen de stock",        "icon": "Boxes",         "description": "Total de productos y variantes en stock"},
    {"id": "clientes_activos",  "label": "Clientes activos",        "icon": "Users",         "description": "Clientes con actividad reciente"},
    {"id": "accesos_rapidos",   "label": "Accesos rápidos",         "icon": "LayoutGrid",    "description": "Atajos a los módulos más usados"},
]

DEFAULT_CONFIG = {
    "widgets": ["accesos_rapidos", "ventas_hoy", "ventas_recientes", "pedidos_activos"]
}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class DashboardConfigIn(BaseModel):
    widgets: list[str]  # lista ordenada de widget IDs

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/widgets-available")
def get_available_widgets():
    """Retorna todos los widgets disponibles con metadata."""
    return AVAILABLE_WIDGETS


@router.get("/config")
def get_user_dashboard_config(
    current_user: User = Depends(get_current_user),
):
    """Obtiene la configuración del dashboard del usuario actual."""
    config = current_user.dashboard_config or DEFAULT_CONFIG
    return config


@router.put("/config")
def update_user_dashboard_config(
    body: DashboardConfigIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Guarda la configuración del dashboard del usuario actual."""
    # Validar que todos los widget IDs sean válidos
    valid_ids = {w["id"] for w in AVAILABLE_WIDGETS}
    invalid = [wid for wid in body.widgets if wid not in valid_ids]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Widgets inválidos: {invalid}")

    current_user.dashboard_config = {"widgets": body.widgets}
    db.add(current_user)
    db.commit()
    return {"ok": True, "config": current_user.dashboard_config}


@router.get("/widget-data/{widget_id}")
def get_widget_data(
    widget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtiene los datos para un widget específico."""
    company_id = current_user.company_id

    if widget_id == "ventas_hoy":
        return _widget_ventas_hoy(db, company_id)
    elif widget_id == "ventas_recientes":
        return _widget_ventas_recientes(db, company_id)
    elif widget_id == "mejoras":
        return _widget_mejoras(db, company_id)
    elif widget_id == "pedidos_activos":
        return _widget_pedidos_activos(db, company_id)
    elif widget_id == "ingresos_recientes":
        return _widget_ingresos_recientes(db, company_id)
    elif widget_id == "alertas_stock":
        return _widget_alertas_stock(db, company_id)
    elif widget_id == "mensajes":
        return _widget_mensajes(db, company_id, current_user.id)
    elif widget_id == "resumen_stock":
        return _widget_resumen_stock(db, company_id)
    elif widget_id == "clientes_activos":
        return _widget_clientes_activos(db, company_id)
    elif widget_id == "accesos_rapidos":
        return {"type": "static"}
    else:
        raise HTTPException(status_code=404, detail="Widget no encontrado")


# ─── Data helpers ─────────────────────────────────────────────────────────────

def _widget_ventas_hoy(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT 
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as monto_total
            FROM sales 
            WHERE (:cid IS NULL OR company_id = :cid)
              AND DATE(created_at) = CURRENT_DATE
              AND status != 'ANULADA'
        """), {"cid": company_id}).mappings().fetchone()
        return {"total_ventas": rows["total_ventas"], "monto_total": float(rows["monto_total"])}
    except Exception:
        return {"total_ventas": 0, "monto_total": 0}


def _widget_ventas_recientes(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT s.id, s.sale_number, s.total, s.status, s.created_at,
                   u.full_name as vendedor, l.name as local
            FROM sales s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN locals l ON s.local_id = l.id
            WHERE (:cid IS NULL OR s.company_id = :cid)
              AND s.status != 'ANULADA'
            ORDER BY s.created_at DESC
            LIMIT 6
        """), {"cid": company_id}).mappings().fetchall()
        return {"ventas": [dict(r) for r in rows]}
    except Exception:
        return {"ventas": []}


def _widget_mejoras(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT id, text, section, is_done, created_at
            FROM improvement_notes
            WHERE (:cid IS NULL OR company_id = :cid)
              AND is_done = false
            ORDER BY created_at DESC
            LIMIT 8
        """), {"cid": company_id}).mappings().fetchall()
        return {"mejoras": [dict(r) for r in rows]}
    except Exception:
        return {"mejoras": []}


def _widget_pedidos_activos(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT p.id, p.order_number, p.status, p.created_at,
                   pr.name as proveedor
            FROM pedidos p
            LEFT JOIN providers pr ON p.provider_id = pr.id
            WHERE (:cid IS NULL OR p.company_id = :cid)
              AND p.status NOT IN ('ANULADO', 'RECIBIDO')
            ORDER BY p.created_at DESC
            LIMIT 6
        """), {"cid": company_id}).mappings().fetchall()
        return {"pedidos": [dict(r) for r in rows]}
    except Exception:
        return {"pedidos": []}


def _widget_ingresos_recientes(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT i.id, i.remito_number, i.status, i.created_at,
                   pr.name as proveedor
            FROM ingresos i
            LEFT JOIN providers pr ON i.provider_id = pr.id
            WHERE (:cid IS NULL OR i.company_id = :cid)
            ORDER BY i.created_at DESC
            LIMIT 6
        """), {"cid": company_id}).mappings().fetchall()
        return {"ingresos": [dict(r) for r in rows]}
    except Exception:
        return {"ingresos": []}


def _widget_alertas_stock(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT pv.sku, p.name as producto, pv.size, pv.color, pv.stock
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE (:cid IS NULL OR p.company_id = :cid)
              AND pv.stock <= 2
              AND pv.stock >= 0
            ORDER BY pv.stock ASC
            LIMIT 10
        """), {"cid": company_id}).mappings().fetchall()
        return {"alertas": [dict(r) for r in rows]}
    except Exception:
        return {"alertas": []}


def _widget_mensajes(db: Session, company_id, user_id):
    try:
        rows = db.execute(text("""
            SELECT m.id, m.content, m.created_at,
                   u.full_name as remitente
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.recipient_id = :uid
              AND m.read = false
            ORDER BY m.created_at DESC
            LIMIT 5
        """), {"uid": user_id}).mappings().fetchall()
        return {"mensajes": [dict(r) for r in rows], "total_unread": len(rows)}
    except Exception:
        return {"mensajes": [], "total_unread": 0}


def _widget_resumen_stock(db: Session, company_id):
    try:
        row = db.execute(text("""
            SELECT 
                COUNT(DISTINCT p.id) as total_productos,
                COUNT(pv.id) as total_variantes,
                COALESCE(SUM(pv.stock), 0) as total_unidades
            FROM products p
            LEFT JOIN product_variants pv ON pv.product_id = p.id
            WHERE (:cid IS NULL OR p.company_id = :cid)
              AND p.is_active = true
        """), {"cid": company_id}).mappings().fetchone()
        return dict(row)
    except Exception:
        return {"total_productos": 0, "total_variantes": 0, "total_unidades": 0}


def _widget_clientes_activos(db: Session, company_id):
    try:
        rows = db.execute(text("""
            SELECT c.id, c.full_name, c.email, c.phone,
                   COUNT(s.id) as total_compras
            FROM customers c
            LEFT JOIN sales s ON s.customer_id = c.id
            WHERE (:cid IS NULL OR c.company_id = :cid)
            GROUP BY c.id, c.full_name, c.email, c.phone
            ORDER BY total_compras DESC
            LIMIT 6
        """), {"cid": company_id}).mappings().fetchall()
        return {"clientes": [dict(r) for r in rows]}
    except Exception:
        return {"clientes": []}
