"""
Router CRUD + lifecycle de Órdenes de Trabajo (OT)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, date
import uuid

from app.db.session import get_db
from app.models.work_order import (
    WorkOrder, WorkOrderItem, WorkOrderHistory, WorkOrderChecklist,
    MechanicRate,
    WOStatus, WOPriority, WOItemType, WOItemStatus, WO_TRANSITIONS,
)
from app.models.product import ProductVariant
from app.models.stock_movement import StockMovement, MovementType
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.module_guard import RequireModule
from app.services.copilot_hook import trigger_copilot


# ── Schemas ────────────────────────────────────────────

class WOItemCreate(BaseModel):
    type: str  # REPUESTO | MANO_DE_OBRA | SERVICIO_EXTERNO
    variant_id: int | None = None
    quantity: float | None = None
    unit_cost: float | None = None
    unit_price: float | None = None
    description: str | None = None
    hours: float | None = None
    hourly_rate: float | None = None
    mechanic_id: int | None = None
    provider_name: str | None = None
    cost: float | None = None
    price: float | None = None
    offline_id: str | None = None


class WOItemUpdate(BaseModel):
    quantity: float | None = None
    unit_cost: float | None = None
    unit_price: float | None = None
    description: str | None = None
    hours: float | None = None
    hourly_rate: float | None = None
    mechanic_id: int | None = None
    provider_name: str | None = None
    cost: float | None = None
    price: float | None = None
    status: str | None = None


class WOItemOut(BaseModel):
    id: int
    work_order_id: int
    type: str
    status: str
    variant_id: int | None = None
    variant_sku: str | None = None
    product_name: str | None = None
    quantity: float | None = None
    unit_cost: float | None = None
    unit_price: float | None = None
    description: str | None = None
    hours: float | None = None
    hourly_rate: float | None = None
    mechanic_id: int | None = None
    mechanic_name: str | None = None
    provider_name: str | None = None
    cost: float | None = None
    price: float | None = None
    stock_decremented: bool = False
    subtotal: float = 0
    offline_id: str | None = None
    model_config = {"from_attributes": True}


class WOHistoryOut(BaseModel):
    id: int
    from_status: str | None = None
    to_status: str
    user_id: int
    user_name: str | None = None
    device_id: str | None = None
    notes: str | None = None
    timestamp: datetime
    model_config = {"from_attributes": True}


class WOChecklistOut(BaseModel):
    id: int
    item_text: str
    is_checked: bool
    checked_by_id: int | None = None
    checked_by_name: str | None = None
    checked_at: datetime | None = None
    model_config = {"from_attributes": True}


class WOOut(BaseModel):
    id: int
    number: str
    status: str
    priority: str
    received_at: datetime | None = None
    diagnosed_at: datetime | None = None
    quoted_at: datetime | None = None
    approved_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    delivered_at: datetime | None = None
    invoiced_at: datetime | None = None
    plate: str | None = None
    vin: str | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    km_in: int | None = None
    km_out: int | None = None
    fuel_level: str | None = None
    color: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    customer_cuit: str | None = None
    customer_address: str | None = None
    reception_notes: str | None = None
    diagnosis_notes: str | None = None
    delivery_notes: str | None = None
    reception_photos: list | None = None
    delivery_photos: list | None = None
    estimated_total: float | None = None
    final_total: float | None = None
    discount_pct: float | None = None
    payment_method: str | None = None
    cancel_reason: str | None = None
    local_id: int | None = None
    local_name: str | None = None
    company_id: int
    created_by_id: int
    created_by_name: str | None = None
    assigned_mechanic_id: int | None = None
    assigned_mechanic_name: str | None = None
    offline_id: str | None = None
    device_id: str | None = None
    synced_at: datetime | None = None
    items: list[WOItemOut] = []
    history: list[WOHistoryOut] = []
    checklists: list[WOChecklistOut] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None
    model_config = {"from_attributes": True}


class WOListOut(BaseModel):
    """Versión resumida para listados"""
    id: int
    number: str
    status: str
    priority: str
    plate: str | None = None
    brand: str | None = None
    model: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    assigned_mechanic_name: str | None = None
    local_name: str | None = None
    estimated_total: float | None = None
    final_total: float | None = None
    received_at: datetime | None = None
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class WOCreate(BaseModel):
    priority: str | None = "NORMAL"
    plate: str | None = None
    vin: str | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    km_in: int | None = None
    fuel_level: str | None = None
    color: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    customer_cuit: str | None = None
    customer_address: str | None = None
    reception_notes: str | None = None
    reception_photos: list | None = None
    local_id: int | None = None
    assigned_mechanic_id: int | None = None
    offline_id: str | None = None
    device_id: str | None = None
    items: list[WOItemCreate] = []


class WOUpdate(BaseModel):
    priority: str | None = None
    plate: str | None = None
    vin: str | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    km_in: int | None = None
    km_out: int | None = None
    fuel_level: str | None = None
    color: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    customer_cuit: str | None = None
    customer_address: str | None = None
    reception_notes: str | None = None
    diagnosis_notes: str | None = None
    delivery_notes: str | None = None
    reception_photos: list | None = None
    delivery_photos: list | None = None
    estimated_total: float | None = None
    final_total: float | None = None
    discount_pct: float | None = None
    payment_method: str | None = None
    local_id: int | None = None
    assigned_mechanic_id: int | None = None


class CancelBody(BaseModel):
    reason: str


class AdvanceBody(BaseModel):
    notes: str | None = None


class ChecklistCreate(BaseModel):
    item_text: str


class ChecklistToggle(BaseModel):
    is_checked: bool


class MechanicRateOut(BaseModel):
    id: int
    user_id: int
    user_name: str | None = None
    hourly_rate: float
    speciality: str | None = None
    model_config = {"from_attributes": True}


class MechanicRateCreate(BaseModel):
    user_id: int
    hourly_rate: float
    speciality: str | None = None


class SyncOperation(BaseModel):
    action: str  # create | update | advance | cancel | add_item
    offline_id: str
    data: dict


class SyncBatch(BaseModel):
    operations: list[SyncOperation]


# ── Router ─────────────────────────────────────────────

router = APIRouter(
    prefix="/work-orders",
    tags=["órdenes de trabajo"],
    dependencies=[Depends(RequireModule("OT"))],
)


# ── Helpers ────────────────────────────────────────────

def _company_filter(q, user: User):
    if user.company_id:
        q = q.filter(WorkOrder.company_id == user.company_id)
    return q


def _get_wo_or_404(wo_id: int, db: Session, user: User) -> WorkOrder:
    wo = db.query(WorkOrder).get(wo_id)
    if not wo:
        raise HTTPException(404, "Orden de trabajo no encontrada")
    if user.company_id and wo.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    return wo


def _next_number(db: Session, company_id: int) -> str:
    """Genera OT-YYYY-NNNNN auto-incremental por empresa"""
    year = datetime.now().year
    prefix = f"OT-{year}-"
    last = (
        db.query(WorkOrder.number)
        .filter(
            WorkOrder.company_id == company_id,
            WorkOrder.number.like(f"{prefix}%"),
        )
        .order_by(WorkOrder.number.desc())
        .first()
    )
    if last:
        try:
            seq = int(last[0].replace(prefix, "")) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:05d}"


def _item_subtotal(item: WorkOrderItem) -> float:
    """Calcula subtotal según tipo de ítem"""
    if item.type == WOItemType.REPUESTO:
        return round(float(item.unit_price or 0) * float(item.quantity or 0), 2)
    elif item.type == WOItemType.MANO_DE_OBRA:
        return round(float(item.hourly_rate or 0) * float(item.hours or 0), 2)
    elif item.type == WOItemType.SERVICIO_EXTERNO:
        return round(float(item.price or 0), 2)
    return 0


def _item_out(item: WorkOrderItem) -> WOItemOut:
    return WOItemOut(
        id=item.id,
        work_order_id=item.work_order_id,
        type=item.type.value,
        status=item.status.value,
        variant_id=item.variant_id,
        variant_sku=item.variant.sku if item.variant else None,
        product_name=(
            item.variant.product.name
            if item.variant and item.variant.product else None
        ),
        quantity=float(item.quantity) if item.quantity else None,
        unit_cost=float(item.unit_cost) if item.unit_cost else None,
        unit_price=float(item.unit_price) if item.unit_price else None,
        description=item.description,
        hours=float(item.hours) if item.hours else None,
        hourly_rate=float(item.hourly_rate) if item.hourly_rate else None,
        mechanic_id=item.mechanic_id,
        mechanic_name=item.mechanic.full_name if item.mechanic else None,
        provider_name=item.provider_name,
        cost=float(item.cost) if item.cost else None,
        price=float(item.price) if item.price else None,
        stock_decremented=item.stock_decremented,
        subtotal=_item_subtotal(item),
        offline_id=item.offline_id,
    )


def _history_out(h: WorkOrderHistory) -> WOHistoryOut:
    return WOHistoryOut(
        id=h.id,
        from_status=h.from_status,
        to_status=h.to_status,
        user_id=h.user_id,
        user_name=h.user.full_name if h.user else None,
        device_id=h.device_id,
        notes=h.notes,
        timestamp=h.timestamp,
    )


def _checklist_out(c: WorkOrderChecklist) -> WOChecklistOut:
    return WOChecklistOut(
        id=c.id,
        item_text=c.item_text,
        is_checked=c.is_checked,
        checked_by_id=c.checked_by_id,
        checked_by_name=c.checked_by.full_name if c.checked_by else None,
        checked_at=c.checked_at,
    )


def _to_out(wo: WorkOrder) -> WOOut:
    items = [_item_out(it) for it in wo.items]
    return WOOut(
        id=wo.id, number=wo.number,
        status=wo.status.value, priority=wo.priority.value,
        received_at=wo.received_at, diagnosed_at=wo.diagnosed_at,
        quoted_at=wo.quoted_at, approved_at=wo.approved_at,
        started_at=wo.started_at, completed_at=wo.completed_at,
        delivered_at=wo.delivered_at, invoiced_at=wo.invoiced_at,
        plate=wo.plate, vin=wo.vin, brand=wo.brand, model=wo.model,
        year=wo.year, km_in=wo.km_in, km_out=wo.km_out,
        fuel_level=wo.fuel_level, color=wo.color,
        customer_name=wo.customer_name, customer_phone=wo.customer_phone,
        customer_email=wo.customer_email, customer_cuit=wo.customer_cuit,
        customer_address=wo.customer_address,
        reception_notes=wo.reception_notes, diagnosis_notes=wo.diagnosis_notes,
        delivery_notes=wo.delivery_notes,
        reception_photos=wo.reception_photos, delivery_photos=wo.delivery_photos,
        estimated_total=float(wo.estimated_total) if wo.estimated_total else None,
        final_total=float(wo.final_total) if wo.final_total else None,
        discount_pct=float(wo.discount_pct) if wo.discount_pct else None,
        payment_method=wo.payment_method,
        cancel_reason=wo.cancel_reason,
        local_id=wo.local_id,
        local_name=wo.local.name if wo.local else None,
        company_id=wo.company_id,
        created_by_id=wo.created_by_id,
        created_by_name=wo.created_by.full_name if wo.created_by else None,
        assigned_mechanic_id=wo.assigned_mechanic_id,
        assigned_mechanic_name=(
            wo.assigned_mechanic.full_name if wo.assigned_mechanic else None
        ),
        offline_id=wo.offline_id, device_id=wo.device_id, synced_at=wo.synced_at,
        items=items,
        history=[_history_out(h) for h in wo.history],
        checklists=[_checklist_out(c) for c in wo.checklists],
        created_at=wo.created_at, updated_at=wo.updated_at,
    )


def _to_list_out(wo: WorkOrder) -> WOListOut:
    return WOListOut(
        id=wo.id, number=wo.number,
        status=wo.status.value, priority=wo.priority.value,
        plate=wo.plate, brand=wo.brand, model=wo.model,
        customer_name=wo.customer_name, customer_phone=wo.customer_phone,
        assigned_mechanic_name=(
            wo.assigned_mechanic.full_name if wo.assigned_mechanic else None
        ),
        local_name=wo.local.name if wo.local else None,
        estimated_total=float(wo.estimated_total) if wo.estimated_total else None,
        final_total=float(wo.final_total) if wo.final_total else None,
        received_at=wo.received_at,
        created_at=wo.created_at,
    )


def _add_history(db: Session, wo: WorkOrder, from_st: str | None,
                 to_st: str, user: User, notes: str | None = None,
                 device_id: str | None = None):
    db.add(WorkOrderHistory(
        work_order_id=wo.id,
        from_status=from_st,
        to_status=to_st,
        user_id=user.id,
        device_id=device_id,
        notes=notes,
        timestamp=datetime.now(),
    ))


# Map status → milestone date field name
_STATUS_DATE_FIELD = {
    WOStatus.RECEPCION:          "received_at",
    WOStatus.DIAGNOSTICO:        "diagnosed_at",
    WOStatus.PRESUPUESTO:        "quoted_at",
    WOStatus.APROBACION_CLIENTE: "approved_at",
    WOStatus.EN_EJECUCION:       "started_at",
    WOStatus.CONTROL_CALIDAD:    "completed_at",
    WOStatus.ENTREGA:            "delivered_at",
    WOStatus.FACTURADO:          "invoiced_at",
}


def _decrement_stock_for_items(db: Session, wo: WorkOrder, user: User):
    """Descuenta stock de repuestos aprobados al pasar a EN_EJECUCION"""
    for item in wo.items:
        if (
            item.type == WOItemType.REPUESTO
            and item.variant_id
            and not item.stock_decremented
            and item.status in (WOItemStatus.APROBADO, WOItemStatus.PRESUPUESTADO)
        ):
            variant = db.query(ProductVariant).get(item.variant_id)
            if not variant:
                continue
            qty = int(item.quantity or 0)
            if variant.stock < qty:
                raise HTTPException(
                    400,
                    f"Stock insuficiente para {variant.sku}: "
                    f"disponible {variant.stock}, necesario {qty}",
                )
            variant.stock -= qty
            item.stock_decremented = True
            item.status = WOItemStatus.USADO
            db.add(StockMovement(
                type=MovementType.EGRESO,
                variant_id=variant.id,
                quantity=-qty,
                reference=f"OT #{wo.number}",
                company_id=wo.company_id,
                created_by_id=user.id,
            ))


def _revert_stock_for_items(db: Session, wo: WorkOrder, user: User):
    """Re-incrementa stock de repuestos al cancelar"""
    for item in wo.items:
        if item.type == WOItemType.REPUESTO and item.stock_decremented and item.variant_id:
            variant = db.query(ProductVariant).get(item.variant_id)
            if variant:
                qty = int(item.quantity or 0)
                variant.stock += qty
                item.stock_decremented = False
                db.add(StockMovement(
                    type=MovementType.INGRESO,
                    variant_id=variant.id,
                    quantity=qty,
                    reference=f"Cancelación OT #{wo.number}",
                    company_id=wo.company_id,
                    created_by_id=user.id,
                ))


# ── CRUD Endpoints ─────────────────────────────────────

@router.get("")
def list_work_orders(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    plate: Optional[str] = Query(None),
    mechanic_id: Optional[int] = Query(None),
    local_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(WorkOrder)
    q = _company_filter(q, user)
    if search:
        q = q.filter(
            (WorkOrder.number.ilike(f"%{search}%")) |
            (WorkOrder.customer_name.ilike(f"%{search}%")) |
            (WorkOrder.plate.ilike(f"%{search}%"))
        )
    if status:
        q = q.filter(WorkOrder.status == status)
    if priority:
        q = q.filter(WorkOrder.priority == priority)
    if plate:
        q = q.filter(WorkOrder.plate.ilike(f"%{plate}%"))
    if mechanic_id:
        q = q.filter(WorkOrder.assigned_mechanic_id == mechanic_id)
    if local_id:
        q = q.filter(WorkOrder.local_id == local_id)
    if date_from:
        q = q.filter(func.date(WorkOrder.received_at) >= date_from)
    if date_to:
        q = q.filter(func.date(WorkOrder.received_at) <= date_to)
    q = q.order_by(WorkOrder.created_at.desc())
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {
        "items": [_to_list_out(wo) for wo in items],
        "total": total, "skip": skip, "limit": limit,
    }


@router.post("", status_code=201)
def create_work_order(
    data: WOCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    company_id = user.company_id or 1
    number = _next_number(db, company_id)
    now = datetime.now()

    wo = WorkOrder(
        number=number,
        status=WOStatus.RECEPCION,
        priority=data.priority or "NORMAL",
        received_at=now,
        plate=data.plate, vin=data.vin, brand=data.brand, model=data.model,
        year=data.year, km_in=data.km_in, fuel_level=data.fuel_level,
        color=data.color,
        customer_name=data.customer_name, customer_phone=data.customer_phone,
        customer_email=data.customer_email, customer_cuit=data.customer_cuit,
        customer_address=data.customer_address,
        reception_notes=data.reception_notes,
        reception_photos=data.reception_photos or [],
        local_id=data.local_id,
        company_id=company_id,
        created_by_id=user.id,
        assigned_mechanic_id=data.assigned_mechanic_id,
        offline_id=data.offline_id,
        device_id=data.device_id,
        synced_at=now if data.offline_id else None,
    )
    db.add(wo)
    db.flush()

    _add_history(db, wo, None, WOStatus.RECEPCION.value, user)

    for it_data in data.items:
        db.add(WorkOrderItem(
            work_order_id=wo.id,
            type=it_data.type,
            variant_id=it_data.variant_id,
            quantity=it_data.quantity,
            unit_cost=it_data.unit_cost,
            unit_price=it_data.unit_price,
            description=it_data.description,
            hours=it_data.hours,
            hourly_rate=it_data.hourly_rate,
            mechanic_id=it_data.mechanic_id,
            provider_name=it_data.provider_name,
            cost=it_data.cost,
            price=it_data.price,
            offline_id=it_data.offline_id,
        ))

    db.commit()
    db.refresh(wo)
    return _to_out(wo)


@router.get("/dashboard")
def work_order_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """OTs por estado, tiempos promedio, ingresos del mes"""
    q = db.query(WorkOrder)
    q = _company_filter(q, user)

    # Conteo por estado
    by_status = {}
    for st in WOStatus:
        by_status[st.value] = q.filter(WorkOrder.status == st).count()

    # Conteo por prioridad
    by_priority = {}
    for pr in WOPriority:
        by_priority[pr.value] = q.filter(WorkOrder.priority == pr).count()

    # OTs del mes actual
    now = datetime.now()
    month_q = q.filter(
        extract("year", WorkOrder.received_at) == now.year,
        extract("month", WorkOrder.received_at) == now.month,
    )
    month_count = month_q.count()
    month_revenue = db.query(func.sum(WorkOrder.final_total)).filter(
        WorkOrder.status.in_([WOStatus.FACTURADO, WOStatus.CERRADO]),
    )
    if user.company_id:
        month_revenue = month_revenue.filter(WorkOrder.company_id == user.company_id)
    month_revenue = month_revenue.filter(
        extract("year", WorkOrder.invoiced_at) == now.year,
        extract("month", WorkOrder.invoiced_at) == now.month,
    ).scalar() or 0

    return {
        "by_status": by_status,
        "by_priority": by_priority,
        "month_count": month_count,
        "month_revenue": float(month_revenue),
        "total_active": sum(
            v for k, v in by_status.items()
            if k not in (WOStatus.CERRADO.value, WOStatus.CANCELADO.value, WOStatus.FACTURADO.value)
        ),
    }


@router.get("/{wo_id}")
def get_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wo = _get_wo_or_404(wo_id, db, user)
    return _to_out(wo)


@router.put("/{wo_id}")
def update_work_order(
    wo_id: int, data: WOUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status in (WOStatus.FACTURADO, WOStatus.CERRADO):
        raise HTTPException(400, "No se puede editar una OT facturada o cerrada")
    updated_fields = data.model_dump(exclude_unset=True)
    for field, val in updated_fields.items():
        setattr(wo, field, val)
    db.commit()
    db.refresh(wo)
    # ── Hook Copilot Automator para notas de diagnóstico/recepción ───────────
    _note_fields = {
        "diagnosis_notes": "Notas de Diagnóstico",
        "reception_notes": "Notas de Recepción",
        "delivery_notes": "Notas de Entrega",
    }
    for field, label in _note_fields.items():
        if field in updated_fields and updated_fields[field]:
            trigger_copilot(
                module=f"OT #{wo.number} — {label}",
                user=user.full_name or user.username,
                text=updated_fields[field],
            )
    return _to_out(wo)


@router.delete("/{wo_id}", status_code=204)
def delete_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status not in (WOStatus.RECEPCION, WOStatus.CANCELADO):
        raise HTTPException(400, "Solo se pueden eliminar OT en RECEPCION o CANCELADO")
    _revert_stock_for_items(db, wo, user)
    db.delete(wo)
    db.commit()


# ── Lifecycle Endpoints ────────────────────────────────

@router.patch("/{wo_id}/advance")
def advance_work_order(
    wo_id: int,
    body: AdvanceBody = AdvanceBody(),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    """Avanza la OT al siguiente estado según el flujo definido"""
    wo = _get_wo_or_404(wo_id, db, user)
    current = wo.status

    if current == WOStatus.CANCELADO:
        raise HTTPException(400, "No se puede avanzar una OT cancelada. Use /reopen")
    if current == WOStatus.CERRADO:
        raise HTTPException(400, "La OT ya está cerrada")

    next_status = WO_TRANSITIONS.get(current)
    if not next_status:
        raise HTTPException(400, f"No hay transición definida desde {current.value}")

    # Validaciones por estado
    if next_status == WOStatus.PRESUPUESTO and not wo.diagnosis_notes:
        raise HTTPException(400, "Debe completar el diagnóstico antes de presupuestar")
    if next_status == WOStatus.APROBACION_CLIENTE and not wo.items:
        raise HTTPException(400, "Debe agregar ítems al presupuesto antes de enviar al cliente")
    if next_status == WOStatus.EN_EJECUCION and not wo.assigned_mechanic_id:
        raise HTTPException(400, "Debe asignar un mecánico antes de iniciar la ejecución")

    old_status = current.value
    wo.status = next_status

    # Setear fecha del hito
    date_field = _STATUS_DATE_FIELD.get(next_status)
    if date_field:
        setattr(wo, date_field, datetime.now())

    # Al pasar a EN_EJECUCION, descontar stock de repuestos aprobados
    if next_status == WOStatus.EN_EJECUCION:
        _decrement_stock_for_items(db, wo, user)

    # Al pasar a FACTURADO, calcular total final
    if next_status == WOStatus.FACTURADO:
        total = sum(_item_subtotal(it) for it in wo.items if it.status != WOItemStatus.DEVUELTO)
        disc = float(wo.discount_pct or 0)
        wo.final_total = round(total * (1 - disc / 100), 2)

    _add_history(db, wo, old_status, next_status.value, user, body.notes)
    db.commit()
    db.refresh(wo)
    # ── Hook Copilot Automator si el avance lleva nota (fire & forget) ───────
    if body.notes:
        trigger_copilot(
            module=f"OT #{wo.number}",
            user=user.full_name or user.username,
            text=f"[{old_status} → {next_status.value}] {body.notes}",
        )
    return {"ok": True, "status": next_status.value, "number": wo.number}


@router.patch("/{wo_id}/cancel")
def cancel_work_order(
    wo_id: int,
    body: CancelBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status in (WOStatus.FACTURADO, WOStatus.CERRADO):
        raise HTTPException(400, "No se puede cancelar una OT facturada o cerrada")
    if wo.status == WOStatus.CANCELADO:
        raise HTTPException(400, "La OT ya está cancelada")

    old_status = wo.status.value
    _revert_stock_for_items(db, wo, user)
    wo.status = WOStatus.CANCELADO
    wo.cancel_reason = body.reason
    _add_history(db, wo, old_status, WOStatus.CANCELADO.value, user, body.reason)
    db.commit()
    return {"ok": True, "status": "CANCELADO"}


@router.patch("/{wo_id}/reopen")
def reopen_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status != WOStatus.CANCELADO:
        raise HTTPException(400, "Solo se puede reabrir una OT cancelada")
    wo.status = WOStatus.RECEPCION
    wo.cancel_reason = None
    wo.received_at = datetime.now()
    _add_history(db, wo, WOStatus.CANCELADO.value, WOStatus.RECEPCION.value, user, "Reabierta")
    db.commit()
    db.refresh(wo)
    return {"ok": True, "status": "RECEPCION", "number": wo.number}


# ── Quote / Approval ───────────────────────────────────

@router.get("/{wo_id}/quote")
def get_quote(
    wo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retorna los datos del presupuesto para generar PDF"""
    wo = _get_wo_or_404(wo_id, db, user)
    items = [_item_out(it) for it in wo.items]
    subtotal = sum(it.subtotal for it in items)
    disc = float(wo.discount_pct or 0)
    total = round(subtotal * (1 - disc / 100), 2)
    return {
        "work_order": {
            "number": wo.number,
            "plate": wo.plate, "brand": wo.brand, "model": wo.model, "year": wo.year,
            "customer_name": wo.customer_name, "customer_phone": wo.customer_phone,
            "customer_cuit": wo.customer_cuit,
            "diagnosis_notes": wo.diagnosis_notes,
        },
        "items": [it.model_dump() for it in items],
        "subtotal": subtotal,
        "discount_pct": disc,
        "total": total,
        "date": datetime.now().isoformat(),
    }


@router.post("/{wo_id}/send-quote")
def send_quote(
    wo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
    )),
):
    """Marca el presupuesto como enviado (WhatsApp/email será manejado por frontend)"""
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status != WOStatus.PRESUPUESTO:
        raise HTTPException(400, "La OT debe estar en estado PRESUPUESTO para enviar")
    wo.quoted_at = datetime.now()
    _add_history(db, wo, wo.status.value, wo.status.value, user, "Presupuesto enviado al cliente")
    db.commit()
    return {"ok": True, "msg": "Presupuesto marcado como enviado"}


@router.patch("/{wo_id}/approve")
def approve_quote(
    wo_id: int,
    body: AdvanceBody = AdvanceBody(),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    """Cliente aprueba el presupuesto → pasa a EN_EJECUCION"""
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status != WOStatus.APROBACION_CLIENTE:
        raise HTTPException(400, "La OT debe estar en APROBACION_CLIENTE")
    if not wo.assigned_mechanic_id:
        raise HTTPException(400, "Debe asignar un mecánico antes de aprobar")

    # Aprobar todos los ítems presupuestados
    for item in wo.items:
        if item.status == WOItemStatus.PRESUPUESTADO:
            item.status = WOItemStatus.APROBADO

    items_total = sum(_item_subtotal(it) for it in wo.items)
    wo.estimated_total = round(items_total, 2)
    wo.approved_at = datetime.now()
    old_status = wo.status.value
    wo.status = WOStatus.EN_EJECUCION
    wo.started_at = datetime.now()

    _decrement_stock_for_items(db, wo, user)
    _add_history(db, wo, old_status, WOStatus.EN_EJECUCION.value, user,
                 body.notes or "Presupuesto aprobado por cliente")
    db.commit()
    db.refresh(wo)
    return {"ok": True, "status": "EN_EJECUCION", "number": wo.number}


@router.patch("/{wo_id}/reject")
def reject_quote(
    wo_id: int,
    body: CancelBody,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    """Cliente rechaza el presupuesto → vuelve a PRESUPUESTO para re-cotizar"""
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status != WOStatus.APROBACION_CLIENTE:
        raise HTTPException(400, "La OT debe estar en APROBACION_CLIENTE")
    old_status = wo.status.value
    wo.status = WOStatus.PRESUPUESTO
    _add_history(db, wo, old_status, WOStatus.PRESUPUESTO.value, user,
                 f"Rechazado por cliente: {body.reason}")
    db.commit()
    return {"ok": True, "status": "PRESUPUESTO", "msg": "Presupuesto rechazado"}


# ── Items (partes / mano de obra) ──────────────────────

@router.post("/{wo_id}/items", status_code=201)
def add_item(
    wo_id: int, data: WOItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    wo = _get_wo_or_404(wo_id, db, user)
    if wo.status in (WOStatus.FACTURADO, WOStatus.CERRADO, WOStatus.CANCELADO):
        raise HTTPException(400, "No se pueden agregar ítems en este estado")

    item_type = WOItemType(data.type)
    item = WorkOrderItem(
        work_order_id=wo.id,
        type=item_type,
        variant_id=data.variant_id,
        quantity=data.quantity,
        unit_cost=data.unit_cost,
        unit_price=data.unit_price,
        description=data.description,
        hours=data.hours,
        hourly_rate=data.hourly_rate,
        mechanic_id=data.mechanic_id,
        provider_name=data.provider_name,
        cost=data.cost,
        price=data.price,
        offline_id=data.offline_id,
    )

    # Si la OT ya pasó aprobación, el ítem entra como APROBADO
    if wo.status in (
        WOStatus.EN_EJECUCION, WOStatus.CONTROL_CALIDAD, WOStatus.ENTREGA,
    ):
        item.status = WOItemStatus.APROBADO

    db.add(item)
    db.flush()

    # Si es REPUESTO y la OT ya está en ejecución, descontar stock inmediatamente
    if (
        item_type == WOItemType.REPUESTO
        and data.variant_id
        and wo.status in (WOStatus.EN_EJECUCION, WOStatus.CONTROL_CALIDAD)
    ):
        variant = db.query(ProductVariant).get(data.variant_id)
        if variant:
            qty = int(data.quantity or 0)
            if variant.stock < qty:
                raise HTTPException(
                    400,
                    f"Stock insuficiente para {variant.sku}: "
                    f"disponible {variant.stock}, necesario {qty}",
                )
            variant.stock -= qty
            item.stock_decremented = True
            item.status = WOItemStatus.USADO
            db.add(StockMovement(
                type=MovementType.EGRESO,
                variant_id=variant.id,
                quantity=-qty,
                reference=f"OT #{wo.number}",
                company_id=wo.company_id,
                created_by_id=user.id,
            ))

    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.put("/items/{item_id}")
def update_item(
    item_id: int, data: WOItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR,
    )),
):
    item = db.query(WorkOrderItem).get(item_id)
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    wo = db.query(WorkOrder).get(item.work_order_id)
    if user.company_id and wo.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if wo.status in (WOStatus.FACTURADO, WOStatus.CERRADO):
        raise HTTPException(400, "No se puede editar en este estado")

    for field, val in data.model_dump(exclude_unset=True).items():
        if field == "status":
            val = WOItemStatus(val)
        setattr(item, field, val)
    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.delete("/items/{item_id}", status_code=204)
def remove_item(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
    )),
):
    item = db.query(WorkOrderItem).get(item_id)
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    wo = db.query(WorkOrder).get(item.work_order_id)
    if user.company_id and wo.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if wo.status in (WOStatus.FACTURADO, WOStatus.CERRADO):
        raise HTTPException(400, "No se pueden eliminar ítems en este estado")

    # Revertir stock si fue descontado
    if item.stock_decremented and item.variant_id:
        variant = db.query(ProductVariant).get(item.variant_id)
        if variant:
            qty = int(item.quantity or 0)
            variant.stock += qty
            db.add(StockMovement(
                type=MovementType.INGRESO,
                variant_id=variant.id,
                quantity=qty,
                reference=f"Devolución OT #{wo.number}",
                company_id=wo.company_id,
                created_by_id=user.id,
            ))

    db.delete(item)
    db.commit()


# ── Checklists ─────────────────────────────────────────

@router.post("/{wo_id}/checklists", status_code=201)
def add_checklist_item(
    wo_id: int, data: ChecklistCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
    )),
):
    wo = _get_wo_or_404(wo_id, db, user)
    item = WorkOrderChecklist(work_order_id=wo.id, item_text=data.item_text)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _checklist_out(item)


@router.patch("/{wo_id}/checklists/{check_id}")
def toggle_checklist(
    wo_id: int, check_id: int, data: ChecklistToggle,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wo = _get_wo_or_404(wo_id, db, user)
    item = db.query(WorkOrderChecklist).filter(
        WorkOrderChecklist.id == check_id,
        WorkOrderChecklist.work_order_id == wo.id,
    ).first()
    if not item:
        raise HTTPException(404, "Checklist item no encontrado")
    item.is_checked = data.is_checked
    item.checked_by_id = user.id if data.is_checked else None
    item.checked_at = datetime.now() if data.is_checked else None
    db.commit()
    db.refresh(item)
    return _checklist_out(item)


@router.delete("/{wo_id}/checklists/{check_id}", status_code=204)
def delete_checklist_item(
    wo_id: int, check_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    wo = _get_wo_or_404(wo_id, db, user)
    item = db.query(WorkOrderChecklist).filter(
        WorkOrderChecklist.id == check_id,
        WorkOrderChecklist.work_order_id == wo.id,
    ).first()
    if not item:
        raise HTTPException(404, "Checklist item no encontrado")
    db.delete(item)
    db.commit()


# ── Vehicle History ────────────────────────────────────

@router.get("/vehicles/{plate}/history")
def vehicle_history(
    plate: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Historial de todas las OT para una patente"""
    q = db.query(WorkOrder).filter(WorkOrder.plate.ilike(plate))
    q = _company_filter(q, user)
    q = q.order_by(WorkOrder.received_at.desc())
    orders = q.all()
    return {
        "plate": plate.upper(),
        "total": len(orders),
        "orders": [_to_list_out(wo) for wo in orders],
    }


# ── Mechanic Rates ────────────────────────────────────

@router.get("/mechanic-rates")
def list_mechanic_rates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MechanicRate)
    if user.company_id:
        q = q.filter(MechanicRate.company_id == user.company_id)
    rates = q.all()
    return [
        MechanicRateOut(
            id=r.id, user_id=r.user_id,
            user_name=r.user.full_name if r.user else None,
            hourly_rate=float(r.hourly_rate),
            speciality=r.speciality,
        )
        for r in rates
    ]


@router.post("/mechanic-rates", status_code=201)
def create_mechanic_rate(
    data: MechanicRateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    company_id = user.company_id or 1
    rate = MechanicRate(
        user_id=data.user_id,
        hourly_rate=data.hourly_rate,
        speciality=data.speciality,
        company_id=company_id,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return MechanicRateOut(
        id=rate.id, user_id=rate.user_id,
        user_name=rate.user.full_name if rate.user else None,
        hourly_rate=float(rate.hourly_rate),
        speciality=rate.speciality,
    )


@router.put("/mechanic-rates/{rate_id}")
def update_mechanic_rate(
    rate_id: int, data: MechanicRateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    rate = db.query(MechanicRate).get(rate_id)
    if not rate:
        raise HTTPException(404, "Tarifa no encontrada")
    if user.company_id and rate.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    rate.user_id = data.user_id
    rate.hourly_rate = data.hourly_rate
    rate.speciality = data.speciality
    db.commit()
    db.refresh(rate)
    return MechanicRateOut(
        id=rate.id, user_id=rate.user_id,
        user_name=rate.user.full_name if rate.user else None,
        hourly_rate=float(rate.hourly_rate),
        speciality=rate.speciality,
    )


@router.delete("/mechanic-rates/{rate_id}", status_code=204)
def delete_mechanic_rate(
    rate_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    rate = db.query(MechanicRate).get(rate_id)
    if not rate:
        raise HTTPException(404, "Tarifa no encontrada")
    if user.company_id and rate.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    db.delete(rate)
    db.commit()


# ── Sync (offline operations) ─────────────────────────

@router.post("/sync")
def sync_work_orders(
    batch: SyncBatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Recibe un batch de operaciones offline y las aplica"""
    results = []
    company_id = user.company_id or 1

    for op in batch.operations:
        try:
            if op.action == "create":
                # Verificar duplicado por offline_id
                existing = db.query(WorkOrder).filter(
                    WorkOrder.offline_id == op.offline_id,
                    WorkOrder.company_id == company_id,
                ).first()
                if existing:
                    results.append({
                        "offline_id": op.offline_id,
                        "action": "create",
                        "status": "duplicate",
                        "server_id": existing.id,
                    })
                    continue

                number = _next_number(db, company_id)
                wo = WorkOrder(
                    number=number,
                    status=WOStatus.RECEPCION,
                    priority=op.data.get("priority", "NORMAL"),
                    received_at=datetime.now(),
                    plate=op.data.get("plate"),
                    brand=op.data.get("brand"),
                    model=op.data.get("model"),
                    customer_name=op.data.get("customer_name"),
                    customer_phone=op.data.get("customer_phone"),
                    reception_notes=op.data.get("reception_notes"),
                    company_id=company_id,
                    created_by_id=user.id,
                    offline_id=op.offline_id,
                    device_id=op.data.get("device_id"),
                    synced_at=datetime.now(),
                )
                db.add(wo)
                db.flush()
                _add_history(db, wo, None, WOStatus.RECEPCION.value, user,
                             "Sincronizado desde offline")
                results.append({
                    "offline_id": op.offline_id,
                    "action": "create",
                    "status": "ok",
                    "server_id": wo.id,
                    "number": wo.number,
                })

            elif op.action == "update":
                wo = db.query(WorkOrder).filter(
                    WorkOrder.offline_id == op.offline_id,
                    WorkOrder.company_id == company_id,
                ).first()
                if not wo:
                    results.append({
                        "offline_id": op.offline_id,
                        "action": "update",
                        "status": "not_found",
                    })
                    continue
                for field, val in op.data.items():
                    if hasattr(wo, field) and field not in ("id", "company_id", "number"):
                        setattr(wo, field, val)
                wo.synced_at = datetime.now()
                results.append({
                    "offline_id": op.offline_id,
                    "action": "update",
                    "status": "ok",
                    "server_id": wo.id,
                })

            else:
                results.append({
                    "offline_id": op.offline_id,
                    "action": op.action,
                    "status": "unsupported_action",
                })

        except Exception as e:
            results.append({
                "offline_id": op.offline_id,
                "action": op.action,
                "status": "error",
                "detail": str(e),
            })

    db.commit()
    return {"synced": len(results), "results": results}
