"""
Router CRUD de Notas de Pedido a Proveedores (Purchase Orders)
Workflow: BORRADOR → PENDIENTE → RECIBIDO → COMPLETADO | ANULADO
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel
import datetime
import os
import shutil
import uuid

from app.db.session import get_db
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, PurchaseOrderType
from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceItem
from app.models.provider import Provider
from app.models.product import ProductVariant
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.v1.export_utils import export_csv, export_xlsx


# ── Schemas ────────────────────────────────────────────

class PurchaseOrderItemOut(BaseModel):
    id: int
    variant_id: int
    code: str | None = None
    description: str | None = None
    size: str | None = None
    color: str | None = None
    sku: str | None = None
    product_name: str | None = None
    quantity_ordered: int
    quantity_received: int
    unit_cost: float | None = None
    model_config = {"from_attributes": True}


class PurchaseOrderItemCreate(BaseModel):
    variant_id: int
    code: str | None = None
    description: str | None = None
    quantity_ordered: int
    unit_cost: float | None = None


class PurchaseOrderOut(BaseModel):
    id: int
    number: str
    prefix: str | None = None
    type: str
    status: str
    date: datetime.date
    expected_date: datetime.date | None = None
    notes: str | None = None
    observations: str | None = None
    total_ordered: float | None = None
    total_received: float | None = None
    provider_id: int
    provider_name: str | None = None
    local_id: int | None = None
    local_name: str | None = None
    company_id: int
    created_by_id: int
    created_by_name: str | None = None
    items: list[PurchaseOrderItemOut] = []
    invoice_count: int = 0
    accepted_difference: bool = False
    accepted_difference_obs: str | None = None
    alert_state: str = "SIN_NADA"
    selected_brands: str | None = None
    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    number: str | None = None
    prefix: str | None = None
    type: str = "REPOSICION"
    date: datetime.date
    expected_date: datetime.date | None = None
    notes: str | None = None
    observations: str | None = None
    provider_id: int
    local_id: int | None = None
    items: list[PurchaseOrderItemCreate] = []
    selected_brands: str | None = None


class PurchaseOrderUpdate(BaseModel):
    type: str | None = None
    date: datetime.date | None = None
    expected_date: datetime.date | None = None
    notes: str | None = None
    observations: str | None = None
    provider_id: int | None = None
    local_id: int | None = None
    selected_brands: str | None = None


router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


# ── Helper ─────────────────────────────────────────────

def compute_alert_state(order: PurchaseOrder) -> str:
    """
    Calcula el estado de alerta de 8 niveles para una nota de pedido.

    Estados (en orden de prioridad):
      ANP         — diferencia aceptada
      ALERTA_REPO — nota de reposición con docs incompletos y vencida
      OK          — factura + remito + RV, todo completo
      SIN_RV      — tiene docs pero alguno sin RV
      INCOMPLETO  — tiene ambos tipos pero cantidades no coinciden
      SOLO_FALTA_REM — tiene factura pero no remito
      SOLO_FALTA_FAC — tiene remito pero no factura
      SIN_NADA    — no tiene documentos
    """
    if order.accepted_difference:
        return "ANP"

    invoices = [inv for inv in (order.invoices or []) if inv.status != "ANULADO"]
    if not invoices:
        # Reposicion sin docs que lleva mucho tiempo → ALERTA_REPO
        if order.type and order.type.value == "REPOSICION" and order.date:
            dias = (datetime.date.today() - order.date).days
            if dias > 30:
                return "ALERTA_REPO"
        return "SIN_NADA"

    has_factura = any(
        inv.type.value in ("FACTURA", "REMITO_FACTURA") for inv in invoices
    )
    has_remito = any(
        inv.type.value in ("REMITO", "REMITO_FACTURA") for inv in invoices
    )
    sin_rv = any(not inv.remito_venta_number for inv in invoices)

    if has_factura and has_remito:
        if sin_rv:
            return "SIN_RV"
        # Compara cantidades facturadas vs pedidas
        qty_ordered = sum(it.quantity_ordered for it in order.items)
        qty_invoiced = sum(
            sum(it.quantity_invoiced or 0 for it in inv.items)
            for inv in invoices
        )
        if qty_ordered > 0 and abs(qty_invoiced - qty_ordered) > 0:
            return "INCOMPLETO"
        return "OK"
    elif has_factura and not has_remito:
        return "SOLO_FALTA_REM"
    elif has_remito and not has_factura:
        return "SOLO_FALTA_FAC"
    else:
        return "SIN_NADA"


def _serialize_order(order: PurchaseOrder) -> dict:
    """Convierte un PurchaseOrder + relaciones a diccionario para PurchaseOrderOut."""
    items = []
    for it in order.items:
        v = it.variant
        items.append({
            "id": it.id,
            "variant_id": it.variant_id,
            "code": it.code,
            "description": it.description,
            "size": v.size if v else None,
            "color": v.color if v else None,
            "sku": v.sku if v else None,
            "product_name": v.product.name if v and v.product else None,
            "quantity_ordered": it.quantity_ordered,
            "quantity_received": it.quantity_received,
            "unit_cost": float(it.unit_cost) if it.unit_cost else None,
        })
    return {
        "id": order.id,
        "number": order.number,
        "prefix": order.prefix,
        "type": order.type.value if order.type else None,
        "status": order.status.value if order.status else None,
        "date": order.date,
        "expected_date": order.expected_date,
        "notes": order.notes,
        "observations": order.observations,
        "total_ordered": float(order.total_ordered) if order.total_ordered else None,
        "total_received": float(order.total_received) if order.total_received else None,
        "provider_id": order.provider_id,
        "provider_name": order.provider.name if order.provider else None,
        "local_id": order.local_id,
        "local_name": order.local.name if order.local else None,
        "company_id": order.company_id,
        "created_by_id": order.created_by_id,
        "created_by_name": order.created_by.full_name if order.created_by else None,
        "items_count": sum(it.quantity_ordered for it in order.items) if order.items else 0,
        "total_qty_received": sum(it.quantity_received for it in order.items) if order.items else 0,
        "items": items,
        "invoice_count": len(order.invoices) if order.invoices else 0,
        "accepted_difference": order.accepted_difference,
        "accepted_difference_obs": order.accepted_difference_obs,
        "alert_state": compute_alert_state(order),
        "selected_brands": order.selected_brands,
        "excel_file": order.excel_file,
        "pdf_file": order.pdf_file,
    }


def _calc_total_ordered(items) -> Optional[float]:
    total = sum(
        float(it.unit_cost or 0) * it.quantity_ordered for it in items
    )
    return total or None


def _calc_total_received(items) -> Optional[float]:
    total = sum(
        float(it.unit_cost or 0) * it.quantity_received for it in items
    )
    return total or None


def _auto_number(db: Session, provider: Provider, company_id: int) -> tuple[str, str]:
    """Genera número automático: {PREFIX}-{n:03d}. Devuelve (number, prefix)."""
    prefix = provider.order_prefix or provider.name[:8].upper().strip()
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.company_id == company_id,
        PurchaseOrder.prefix == prefix,
    ).count()
    number = f"{prefix}-{count + 1:03d}"
    return number, prefix


# ── Endpoints ──────────────────────────────────────────

@router.get("/")
def list_purchase_orders(
    status: Optional[str] = None,
    provider_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(PurchaseOrder)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(PurchaseOrder.company_id == current_user.company_id)
    if status:
        try:
            q = q.filter(PurchaseOrder.status == PurchaseOrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    if provider_id:
        q = q.filter(PurchaseOrder.provider_id == provider_id)
    q = q.order_by(PurchaseOrder.date.desc(), PurchaseOrder.id.desc())
    total = q.count()
    # Eagerly load all relationships in ~5 queries instead of 400+ (N+1 fix)
    orders = q.options(
        selectinload(PurchaseOrder.provider),
        selectinload(PurchaseOrder.local),
        selectinload(PurchaseOrder.created_by),
        selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.variant).selectinload(ProductVariant.product),
        selectinload(PurchaseOrder.invoices).selectinload(PurchaseInvoice.items),
    ).offset(skip).limit(limit).all()
    return {"items": [_serialize_order(o) for o in orders], "total": total, "skip": skip, "limit": limit}


@router.get("/export")
def export_purchase_orders(
    format: str = Query("xlsx", pattern="^(csv|xlsx)$"),
    status: Optional[str] = None,
    provider_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export purchase orders as CSV or XLSX."""
    q = db.query(PurchaseOrder)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(PurchaseOrder.company_id == current_user.company_id)
    if status:
        try:
            q = q.filter(PurchaseOrder.status == PurchaseOrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    if provider_id:
        q = q.filter(PurchaseOrder.provider_id == provider_id)
    q = q.order_by(PurchaseOrder.date.desc(), PurchaseOrder.id.desc())
    orders = q.all()

    data = []
    for o in orders:
        total_ordered = sum(it.quantity_ordered for it in o.items) if o.items else 0
        total_received = sum(it.quantity_received for it in o.items) if o.items else 0
        days = (datetime.date.today() - o.date).days if o.date else 0
        data.append({
            "numero": o.number or "",
            "proveedor": o.provider.name if o.provider else "",
            "fecha": str(o.date) if o.date else "",
            "local": o.local.name if o.local else "",
            "tipo": o.type.value if o.type else "",
            "estado": o.status.value if o.status else "",
            "cant_pedida": total_ordered,
            "cant_recibida": total_received,
            "dias": days,
        })

    columns = ["numero", "proveedor", "fecha", "local", "tipo", "estado", "cant_pedida", "cant_recibida", "dias"]
    headers = ["Número", "Proveedor", "Fecha", "Local", "Tipo", "Estado", "Cant. Pedida", "Cant. Recibida", "Días"]

    if format == "csv":
        return export_csv(data, "notas_de_pedido", columns)
    return export_xlsx(data, "notas_de_pedido", columns, headers)


@router.get("/stats")
def purchase_orders_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estadísticas generales de notas de pedido."""
    company_id = current_user.company_id if current_user.role != UserRole.SUPERADMIN else None
    co = [PurchaseOrder.company_id == company_id] if company_id else []
    ci = [PurchaseInvoice.company_id == company_id] if company_id else []

    total_notas = db.query(func.count(PurchaseOrder.id)).filter(*co).scalar() or 0
    total_facturas = db.query(func.count(PurchaseInvoice.id)).filter(*ci).scalar() or 0

    unidades_pedidas = int(
        db.query(func.coalesce(func.sum(PurchaseOrderItem.quantity_ordered), 0))
        .join(PurchaseOrder)
        .filter(*co)
        .scalar() or 0
    )

    unidades_facturadas = int(
        db.query(func.coalesce(func.sum(PurchaseInvoiceItem.quantity_invoiced), 0))
        .join(PurchaseInvoice)
        .filter(*ci)
        .scalar() or 0
    )

    # Per-order: ordered vs invoiced units (for difference calculations)
    ordered_per_order = dict(
        db.query(
            PurchaseOrderItem.purchase_order_id,
            func.sum(PurchaseOrderItem.quantity_ordered),
        )
        .join(PurchaseOrder)
        .filter(PurchaseOrder.status != PurchaseOrderStatus.ANULADO, *co)
        .group_by(PurchaseOrderItem.purchase_order_id)
        .all()
    )

    invoiced_per_order = dict(
        db.query(
            PurchaseInvoice.purchase_order_id,
            func.coalesce(func.sum(PurchaseInvoiceItem.quantity_invoiced), 0),
        )
        .join(PurchaseInvoiceItem)
        .filter(*ci)
        .group_by(PurchaseInvoice.purchase_order_id)
        .all()
    )

    notas_con_diferencia = 0
    diferencias = []
    for oid, ordered in ordered_per_order.items():
        ordered = int(ordered)
        invoiced = int(invoiced_per_order.get(oid, 0))
        if invoiced < ordered:
            notas_con_diferencia += 1
            diferencias.append((oid, ordered, invoiced, invoiced - ordered))

    diferencias.sort(key=lambda x: x[3])
    top_10_ids = [d[0] for d in diferencias[:10]]

    top_diferencias = []
    if top_10_ids:
        top_orders = {
            o.id: o
            for o in db.query(PurchaseOrder).filter(PurchaseOrder.id.in_(top_10_ids)).all()
        }
        for oid, ordered, invoiced, diff in diferencias[:10]:
            o = top_orders.get(oid)
            if o:
                top_diferencias.append({
                    "numero": o.number,
                    "proveedor": o.provider.name if o.provider else None,
                    "pedido": ordered,
                    "facturado": invoiced,
                    "diferencia": diff,
                })

    # por_mes — last 6 months
    six_months_ago = (datetime.date.today().replace(day=1) - datetime.timedelta(days=180)).replace(day=1)
    month_rows = (
        db.query(
            func.to_char(PurchaseOrder.date, 'YYYY-MM').label('mes'),
            func.count(func.distinct(PurchaseOrder.id)).label('notas'),
            func.coalesce(func.sum(PurchaseOrderItem.quantity_ordered), 0).label('unidades'),
        )
        .outerjoin(PurchaseOrderItem)
        .filter(PurchaseOrder.date >= six_months_ago, *co)
        .group_by(func.to_char(PurchaseOrder.date, 'YYYY-MM'))
        .order_by(func.to_char(PurchaseOrder.date, 'YYYY-MM'))
        .all()
    )
    por_mes = [{"mes": r.mes, "notas": r.notas, "unidades": int(r.unidades)} for r in month_rows]

    return {
        "total_notas": total_notas,
        "total_facturas": total_facturas,
        "unidades_pedidas": unidades_pedidas,
        "unidades_facturadas": unidades_facturadas,
        "notas_con_diferencia": notas_con_diferencia,
        "por_mes": por_mes,
        "top_diferencias": top_diferencias,
    }


@router.get("/alertas-reposicion")
def alertas_reposicion(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Alertas de reposición: pedidos pendientes con facturación incompleta."""
    company_id = current_user.company_id if current_user.role != UserRole.SUPERADMIN else None

    q = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_([PurchaseOrderStatus.PENDIENTE, PurchaseOrderStatus.ENVIADO]))
    if company_id:
        q = q.filter(PurchaseOrder.company_id == company_id)

    orders = q.all()
    today = datetime.date.today()
    alertas = []

    for order in orders:
        pedido = sum(it.quantity_ordered for it in order.items)
        invoices = order.invoices or []
        facturado = sum(
            sum(it.quantity_invoiced for it in inv.items)
            for inv in invoices
        ) if invoices else 0

        faltan = facturado - pedido
        dias_esperando = (today - order.date).days if order.date else 0

        if faltan >= 0:
            continue
        if dias_esperando <= 10 and len(invoices) > 0:
            continue

        if len(invoices) == 0:
            estado = "SIN_FAC"
        else:
            estado = f"ESP_{dias_esperando}d"

        ultima_factura = None
        if invoices:
            dates = [inv.date for inv in invoices if inv.date]
            if dates:
                ultima_factura = max(dates).isoformat()

        alertas.append({
            "id": order.id,
            "numero": order.number,
            "proveedor": order.provider.name if order.provider else None,
            "local": order.local.name if order.local else None,
            "pedido": pedido,
            "facturado": facturado,
            "faltan": faltan,
            "ultima_factura": ultima_factura,
            "dias_esperando": dias_esperando,
            "estado": estado,
        })

    alertas.sort(key=lambda x: x["dias_esperando"], reverse=True)

    return {
        "total": len(alertas),
        "alertas": alertas,
    }


class AcceptDifferenceRequest(BaseModel):
    observations: str | None = None


@router.post("/{order_id}/accept-difference", summary="Aceptar diferencia (ANP)")
def accept_difference(
    order_id: int,
    body: AcceptDifferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == order_id,
        PurchaseOrder.company_id == current_user.company_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status not in [PurchaseOrderStatus.PENDIENTE, PurchaseOrderStatus.ENVIADO, PurchaseOrderStatus.RECIBIDO]:
        raise HTTPException(status_code=400, detail="Solo se puede aceptar diferencia en estado PENDIENTE o RECIBIDO")
    order.accepted_difference = True
    order.accepted_difference_obs = body.observations
    order.status = PurchaseOrderStatus.COMPLETADO
    db.commit()
    db.refresh(order)
    return {"ok": True, "message": "Diferencia aceptada. Nota marcada como COMPLETADO."}


@router.post("/{order_id}/reopen", summary="Reabrir nota (Admin)")
def reopen_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "ADMIN")),
):
    order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == order_id,
        PurchaseOrder.company_id == current_user.company_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status not in [PurchaseOrderStatus.COMPLETADO, PurchaseOrderStatus.ANULADO]:
        raise HTTPException(status_code=400, detail="Solo se puede reabrir COMPLETADO o ANULADO")
    order.status = PurchaseOrderStatus.PENDIENTE
    order.accepted_difference = False
    order.accepted_difference_obs = None
    db.commit()
    return {"ok": True, "message": "Nota reabierta a estado PENDIENTE."}


@router.get("/vista-integrada", summary="Vista integrada RESUMEN")
def vista_integrada(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: str | None = Query(None),
    local_id: int | None = Query(None),
    provider_id: int | None = Query(None),
):
    """Vista integrada: todas las notas activas con sus 4 cantidades y estado semáforo."""
    q = db.query(PurchaseOrder).filter(
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.status != PurchaseOrderStatus.ANULADO,
    )
    if status:
        try:
            q = q.filter(PurchaseOrder.status == PurchaseOrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    else:
        q = q.filter(PurchaseOrder.status.in_([
            PurchaseOrderStatus.PENDIENTE, PurchaseOrderStatus.ENVIADO, PurchaseOrderStatus.RECIBIDO
        ]))
    if local_id:
        q = q.filter(PurchaseOrder.local_id == local_id)
    if provider_id:
        q = q.filter(PurchaseOrder.provider_id == provider_id)

    orders = q.order_by(PurchaseOrder.date.desc()).limit(200).all()

    result = []
    for order in orders:
        invoices = order.invoices or []

        qty_ordered = sum(item.quantity_ordered for item in order.items)
        qty_received = sum(item.quantity_received for item in order.items)

        facturas = [
            inv for inv in invoices
            if inv.type in ("FACTURA", "REMITO_FACTURA")
            and inv.status != "ANULADO"
        ]
        remitos = [
            inv for inv in invoices
            if inv.type in ("REMITO", "REMITO_FACTURA")
            and inv.status != "ANULADO"
        ]

        qty_facturado = sum(
            sum(item.quantity_invoiced or 0 for item in inv.items)
            for inv in facturas
        )
        qty_remitido = sum(
            sum(item.quantity_invoiced or 0 for item in inv.items)
            for inv in remitos
        )

        active_invoices = [inv for inv in invoices if inv.status != "ANULADO"]
        docs_con_rv = sum(1 for inv in active_invoices if inv.remito_venta_number)
        docs_sin_rv = sum(1 for inv in active_invoices if not inv.remito_venta_number)

        if qty_ordered == 0:
            # No tenemos items — usar lógica de documentos como fallback
            if len(active_invoices) == 0:
                semaforo = "ROJO"
            elif docs_sin_rv == 0:
                semaforo = "VERDE"
            elif docs_con_rv > 0:
                semaforo = "AMARILLO"
            else:
                semaforo = "AMARILLO"
        elif qty_facturado >= qty_ordered and qty_remitido >= qty_ordered:
            semaforo = "VERDE"
        elif qty_facturado > 0 or qty_remitido > 0:
            semaforo = "AMARILLO"
        else:
            semaforo = "ROJO"

        dias = (datetime.date.today() - order.date).days if order.date else 0

        result.append({
            "id": order.id,
            "number": order.number,
            "prefix": order.prefix,
            "status": order.status.value if order.status else None,
            "type": order.type.value if order.type else None,
            "date": order.date.isoformat() if order.date else None,
            "dias": dias,
            "provider_id": order.provider_id,
            "provider_name": order.provider.name if order.provider else None,
            "local_id": order.local_id,
            "local_name": order.local.name if order.local else None,
            "qty_ordered": qty_ordered,
            "qty_facturado": qty_facturado,
            "qty_remitido": qty_remitido,
            "qty_ingresado": qty_received,
            "docs_count": len(active_invoices),
            "docs_con_rv": docs_con_rv,
            "docs_sin_rv": docs_sin_rv,
            "semaforo": semaforo,
            "alert_state": compute_alert_state(order),
            "accepted_difference": order.accepted_difference,
            "total_amount": float(order.total_ordered) if order.total_ordered else None,
            "invoices": [
                {
                    "id": inv.id,
                    "tipo": inv.type.value if inv.type else None,
                    "numero": inv.number,
                    "fecha": inv.date.isoformat() if inv.date else None,
                    "rv_numero": inv.remito_venta_number,
                    "estado_semaforo": inv.estado_semaforo,
                    "confirmado_local_at": inv.confirmado_local_at.isoformat() if inv.confirmado_local_at else None,
                    "confirmado_admin_at": inv.confirmado_admin_at.isoformat() if inv.confirmado_admin_at else None,
                    "amount": float(inv.amount) if inv.amount else None,
                }
                for inv in active_invoices
            ],
        })

    return {
        "orders": result,
        "total": len(result),
        "stats": {
            "verde": sum(1 for r in result if r["semaforo"] == "VERDE"),
            "amarillo": sum(1 for r in result if r["semaforo"] == "AMARILLO"),
            "rojo": sum(1 for r in result if r["semaforo"] == "ROJO"),
            "sin_rv": sum(r["docs_sin_rv"] for r in result),
            "sin_nada": sum(1 for r in result if r["alert_state"] == "SIN_NADA"),
            "sin_rv_count": sum(1 for r in result if r["alert_state"] == "SIN_RV"),
            "con_docs": sum(1 for r in result if r["docs_count"] > 0),
        },
    }


@router.get("/{order_id}")
def get_purchase_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    return _serialize_order(order)


@router.post("/", status_code=201)
async def create_purchase_order(
    provider_id: int = Form(...),
    local_id: Optional[int] = Form(None),
    type: str = Form("REPOSICION"),
    date: str = Form(...),
    expected_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    observations: Optional[str] = Form(None),
    prefix: Optional[str] = Form(None),
    number: Optional[str] = Form(None),
    selected_brands: Optional[str] = Form(None),
    excel_file: Optional[UploadFile] = File(None),
    pdf_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    try:
        order_date = datetime.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida, usar YYYY-MM-DD")
    order_expected: Optional[datetime.date] = None
    if expected_date:
        try:
            order_expected = datetime.date.fromisoformat(expected_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="expected_date inválido, usar YYYY-MM-DD")

    company_id = current_user.company_id
    if not company_id:
        from app.models.company import Company
        first_co = db.query(Company).order_by(Company.id.asc()).first()
        if not first_co:
            raise HTTPException(status_code=400, detail="No hay ninguna empresa configurada")
        company_id = first_co.id

    try:
        order_type = PurchaseOrderType(type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Tipo debe ser PRECOMPRA, REPOSICION o CAMBIO")

    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    if number:
        order_number = number
        order_prefix = prefix or provider.order_prefix or provider.name[:8].upper().strip()
    else:
        order_number, order_prefix = _auto_number(db, provider, company_id)

    order = PurchaseOrder(
        number=order_number,
        prefix=order_prefix,
        type=order_type,
        status=PurchaseOrderStatus.PENDIENTE,
        date=order_date,
        expected_date=order_expected,
        notes=notes,
        observations=observations,
        provider_id=provider_id,
        local_id=local_id,
        company_id=company_id,
        created_by_id=current_user.id,
        selected_brands=selected_brands,
    )
    db.add(order)
    db.flush()

    if excel_file is not None and excel_file.filename:
        ext = os.path.splitext(excel_file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Excel: tipo no permitido ({ext})")
        content = await excel_file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="El Excel supera el límite de 20 MB")

        filename = f"{order.id}_excel_{uuid.uuid4().hex[:8]}{ext}"
        filepath = os.path.join(PEDIDOS_FILES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(content)
        order.excel_file = f"/pedidos-files/{filename}"

        from app.api.v1.excel_parser import (
            _resolve_brand_key, _detect_provider_from_filename,
            _detect_provider_from_excel, _parsear_excel_ombak, _parsear_excel_generico,
        )
        marca = selected_brands.split(",")[0].strip() if selected_brands else ""
        es_reposicion = order_type == PurchaseOrderType.REPOSICION
        declared = _resolve_brand_key(marca, provider.name)
        detected = declared or _detect_provider_from_filename(excel_file.filename) or _detect_provider_from_excel(content)
        brand_key = declared or detected
        try:
            if brand_key == "OMBAK":
                data = _parsear_excel_ombak(content)
            else:
                data = _parsear_excel_generico(content, brand_key or provider.name, es_reposicion)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parseando Excel: {e}")

        for solapa in data.get("solapas", []):
            for it in solapa.get("items", []):
                qty = it.get("cantidad", 0) or 0
                if qty <= 0:
                    continue
                db.add(PurchaseOrderItem(
                    purchase_order_id=order.id,
                    code=it.get("codigo") or it.get("cod_alfa") or it.get("cod_normalizado") or "",
                    description=it.get("descripcion") or "",
                    quantity_ordered=int(qty),
                    quantity_received=0,
                    unit_cost=None,
                ))
        db.flush()
        order.total_ordered = _calc_total_ordered(order.items)

    if pdf_file is not None and pdf_file.filename:
        ext = os.path.splitext(pdf_file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"PDF: tipo no permitido ({ext})")
        content = await pdf_file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="El PDF supera el límite de 20 MB")
        filename = f"{order.id}_pdf_{uuid.uuid4().hex[:8]}{ext}"
        filepath = os.path.join(PEDIDOS_FILES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(content)
        order.pdf_file = f"/pedidos-files/{filename}"

    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.put("/{order_id}")
def update_purchase_order(
    order_id: int,
    body: PurchaseOrderUpdate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status != PurchaseOrderStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede editar una nota de pedido en BORRADOR")

    update_data = body.model_dump(exclude_unset=True)
    if "type" in update_data:
        try:
            update_data["type"] = PurchaseOrderType(update_data["type"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Tipo debe ser PRECOMPRA, REPOSICION o CAMBIO")

    for key, val in update_data.items():
        setattr(order, key, val)

    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/{order_id}/confirm")
def confirm_purchase_order(
    order_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    """Marca la nota de pedido como PENDIENTE (BORRADOR → PENDIENTE)."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status != PurchaseOrderStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede confirmar una nota de pedido en BORRADOR")

    order.status = PurchaseOrderStatus.PENDIENTE
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


# Legacy alias so old clients still work
@router.post("/{order_id}/send")
def send_purchase_order_legacy(
    order_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    """Alias legacy de /confirm."""
    return confirm_purchase_order(order_id, current_user, db)


@router.post("/{order_id}/receive")
def receive_purchase_order(
    order_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.DEPOSITO
    )),
    db: Session = Depends(get_db),
):
    """Marca la nota de pedido como RECIBIDO (PENDIENTE → RECIBIDO) y actualiza total_received."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status not in (PurchaseOrderStatus.PENDIENTE, PurchaseOrderStatus.ENVIADO):
        raise HTTPException(status_code=400, detail="Solo se puede recibir una nota de pedido en PENDIENTE")

    order.total_received = _calc_total_received(order.items)
    order.status = PurchaseOrderStatus.RECIBIDO
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/{order_id}/complete")
def complete_purchase_order(
    order_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    """Marca la nota de pedido como COMPLETADO (RECIBIDO → COMPLETADO)."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status != PurchaseOrderStatus.RECIBIDO:
        raise HTTPException(status_code=400, detail="Solo se puede completar una nota de pedido en RECIBIDO")

    order.status = PurchaseOrderStatus.COMPLETADO
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/{order_id}/cancel")
def cancel_purchase_order(
    order_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN
    )),
    db: Session = Depends(get_db),
):
    """Anula la nota de pedido. No se puede anular si está COMPLETADO."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status == PurchaseOrderStatus.COMPLETADO:
        raise HTTPException(status_code=400, detail="No se puede anular una nota de pedido COMPLETADA")
    if order.status == PurchaseOrderStatus.ANULADO:
        raise HTTPException(status_code=400, detail="La nota de pedido ya está anulada")

    order.status = PurchaseOrderStatus.ANULADO
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.post("/{order_id}/items", status_code=201)
def add_purchase_order_item(
    order_id: int,
    body: PurchaseOrderItemCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status != PurchaseOrderStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se pueden agregar ítems a una nota de pedido en BORRADOR")

    item = PurchaseOrderItem(
        purchase_order_id=order_id,
        variant_id=body.variant_id,
        code=body.code,
        description=body.description,
        quantity_ordered=body.quantity_ordered,
        quantity_received=0,
        unit_cost=body.unit_cost,
    )
    db.add(item)

    db.flush()
    order.total_ordered = _calc_total_ordered(order.items)
    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.delete("/{order_id}/items/{item_id}", status_code=204)
def remove_purchase_order_item(
    order_id: int,
    item_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if order.status != PurchaseOrderStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar ítems de una nota de pedido en BORRADOR")

    item = db.query(PurchaseOrderItem).filter(
        PurchaseOrderItem.id == item_id,
        PurchaseOrderItem.purchase_order_id == order_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    db.delete(item)
    db.flush()

    remaining = db.query(PurchaseOrderItem).filter(
        PurchaseOrderItem.purchase_order_id == order_id
    ).all()
    order.total_ordered = sum(
        float(it.unit_cost or 0) * it.quantity_ordered for it in remaining
    ) or None
    db.commit()


PEDIDOS_FILES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "erp", "pedidos_files")
PEDIDOS_FILES_DIR = os.path.abspath(PEDIDOS_FILES_DIR)
os.makedirs(PEDIDOS_FILES_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/{order_id}/upload-file")
async def upload_order_file(
    order_id: int,
    file_type: str = Query(..., description="'excel' o 'pdf'"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION, UserRole.MEGAADMIN
    )),
    db: Session = Depends(get_db),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if current_user.company_id and order.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido. Permitidos: {', '.join(ALLOWED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 20 MB")

    filename = f"{order_id}_{file_type}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(PEDIDOS_FILES_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    file_url = f"/pedidos-files/{filename}"
    if file_type == "excel":
        if order.excel_file:
            old_path = os.path.join(PEDIDOS_FILES_DIR, os.path.basename(order.excel_file))
            if os.path.exists(old_path):
                os.remove(old_path)
        order.excel_file = file_url
    else:
        if order.pdf_file:
            old_path = os.path.join(PEDIDOS_FILES_DIR, os.path.basename(order.pdf_file))
            if os.path.exists(old_path):
                os.remove(old_path)
        order.pdf_file = file_url

    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.delete("/{order_id}/upload-file")
def delete_order_file(
    order_id: int,
    file_type: str = Query(..., description="'excel' o 'pdf'"),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION, UserRole.MEGAADMIN
    )),
    db: Session = Depends(get_db),
):
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if current_user.company_id and order.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    if file_type == "excel":
        if order.excel_file:
            old_path = os.path.join(PEDIDOS_FILES_DIR, os.path.basename(order.excel_file))
            if os.path.exists(old_path):
                os.remove(old_path)
        order.excel_file = None
    else:
        if order.pdf_file:
            old_path = os.path.join(PEDIDOS_FILES_DIR, os.path.basename(order.pdf_file))
            if os.path.exists(old_path):
                os.remove(old_path)
        order.pdf_file = None

    db.commit()
    db.refresh(order)
    return _serialize_order(order)


@router.get("/{order_id}/parse-excel", summary="Parsea el Excel ya subido y devuelve preview")
def parse_order_excel(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lee el Excel ya subido del pedido, lo parsea según proveedor/marca/tipo y devuelve preview."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if current_user.company_id and order.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if not order.excel_file:
        raise HTTPException(status_code=400, detail="El pedido no tiene un Excel cargado")

    filepath = os.path.join(PEDIDOS_FILES_DIR, os.path.basename(order.excel_file))
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="El archivo Excel no se encontró en el servidor")

    with open(filepath, "rb") as f:
        file_bytes = f.read()

    from app.api.v1.excel_parser import (
        _resolve_brand_key, _detect_provider_from_filename,
        _detect_provider_from_excel, _parsear_excel_ombak, _parsear_excel_generico,
    )

    proveedor_name = order.provider.name if order.provider else ""
    marca = order.selected_brands.split(",")[0].strip() if order.selected_brands else ""
    es_reposicion = order.type and order.type.value == "REPOSICION"

    declared = _resolve_brand_key(marca, proveedor_name)
    detected = declared or _detect_provider_from_filename(os.path.basename(order.excel_file)) or _detect_provider_from_excel(file_bytes)
    brand_key = declared or detected

    if brand_key == "OMBAK":
        try:
            data = _parsear_excel_ombak(file_bytes)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parseando Excel OMBAK: {e}")
    else:
        data = _parsear_excel_generico(file_bytes, brand_key or proveedor_name, es_reposicion)

    rules_applied = []
    if brand_key == "OMBAK":
        rules_applied.append("Parser OMBAK — multi-solapa con packs y filas ocultas")
    elif brand_key == "MIDING" and es_reposicion:
        rules_applied.append("Parser MIDING REPOSICIÓN — curvas ×10")
    elif brand_key == "MIDING":
        rules_applied.append("Parser MIDING precompra — cantidades tal cual")
    elif brand_key:
        rules_applied.append(f"Parser {brand_key} — genérico")
    else:
        rules_applied.append("Parser genérico (sin marca detectada)")

    return {
        "filename": os.path.basename(order.excel_file),
        "brand_key": brand_key,
        "es_reposicion": es_reposicion,
        "rules_applied": rules_applied,
        "solapas": data.get("solapas", []),
        "total_unidades": data.get("total_unidades", 0),
        "total_items": data.get("total_items", 0),
    }


@router.post("/{order_id}/apply-excel", summary="Aplica el Excel parseado como ítems del pedido")
def apply_order_excel(
    order_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    """Parsea el Excel ya subido y reemplaza TODOS los ítems del pedido con el resultado.
    Solo funciona en estado BORRADOR."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Nota de pedido no encontrada")
    if current_user.company_id and order.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if order.status != PurchaseOrderStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede aplicar el Excel en BORRADOR")
    if not order.excel_file:
        raise HTTPException(status_code=400, detail="El pedido no tiene un Excel cargado")

    filepath = os.path.join(PEDIDOS_FILES_DIR, os.path.basename(order.excel_file))
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="El archivo Excel no se encontró en el servidor")

    with open(filepath, "rb") as f:
        file_bytes = f.read()

    from app.api.v1.excel_parser import (
        _resolve_brand_key, _detect_provider_from_filename,
        _detect_provider_from_excel, _parsear_excel_ombak, _parsear_excel_generico,
    )

    proveedor_name = order.provider.name if order.provider else ""
    marca = order.selected_brands.split(",")[0].strip() if order.selected_brands else ""
    es_reposicion = order.type and order.type.value == "REPOSICION"

    declared = _resolve_brand_key(marca, proveedor_name)
    detected = declared or _detect_provider_from_filename(os.path.basename(order.excel_file)) or _detect_provider_from_excel(file_bytes)
    brand_key = declared or detected

    try:
        if brand_key == "OMBAK":
            data = _parsear_excel_ombak(file_bytes)
        else:
            data = _parsear_excel_generico(file_bytes, brand_key or proveedor_name, es_reposicion)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parseando Excel: {e}")

    # Eliminar ítems existentes
    db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == order_id).delete()

    # Crear ítems nuevos desde el parser
    total_items_created = 0
    for solapa in data.get("solapas", []):
        for it in solapa.get("items", []):
            qty = it.get("cantidad", 0) or 0
            if qty <= 0:
                continue
            db.add(PurchaseOrderItem(
                purchase_order_id=order_id,
                code=it.get("codigo") or it.get("cod_alfa") or it.get("cod_normalizado") or "",
                description=it.get("descripcion") or "",
                quantity_ordered=int(qty),
                quantity_received=0,
                unit_cost=None,
            ))
            total_items_created += 1

    db.flush()
    order.total_ordered = _calc_total_ordered(order.items)
    db.commit()
    db.refresh(order)

    result = _serialize_order(order)
    result["items_created"] = total_items_created
    return result

