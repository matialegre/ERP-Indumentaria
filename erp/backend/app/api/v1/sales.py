"""
Router CRUD de Ventas / Facturación
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.sale import Sale, SaleItem, SaleType, SaleStatus
from app.models.product import ProductVariant
from app.models.stock_movement import StockMovement, MovementType
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class SaleItemOut(BaseModel):
    id: int
    variant_id: int
    variant_sku: str | None = None
    variant_size: str | None = None
    variant_color: str | None = None
    product_name: str | None = None
    quantity: int
    unit_price: float
    discount_pct: float | None = 0
    subtotal: float = 0
    model_config = {"from_attributes": True}


class SaleItemCreate(BaseModel):
    variant_id: int
    quantity: int
    unit_price: float
    discount_pct: float | None = 0


class SaleOut(BaseModel):
    id: int
    type: str
    number: str
    date: datetime.date
    status: str
    customer_name: str | None = None
    customer_cuit: str | None = None
    notes: str | None = None
    subtotal: float | None = None
    tax: float | None = None
    total: float | None = None
    local_id: int | None = None
    local_name: str | None = None
    company_id: int
    created_by_id: int
    created_by_name: str | None = None
    items: list[SaleItemOut] = []
    model_config = {"from_attributes": True}


class SaleCreate(BaseModel):
    type: str  # FACTURA_A | FACTURA_B | TICKET | NOTA_CREDITO
    number: str
    date: datetime.date
    customer_name: str | None = None
    customer_cuit: str | None = None
    notes: str | None = None
    local_id: int | None = None
    items: list[SaleItemCreate] = []


class SaleUpdate(BaseModel):
    number: str | None = None
    date: datetime.date | None = None
    customer_name: str | None = None
    customer_cuit: str | None = None
    notes: str | None = None
    local_id: int | None = None


router = APIRouter(prefix="/sales", tags=["ventas"])


def _compute_item(it) -> SaleItemOut:
    disc = float(it.discount_pct or 0)
    sub = float(it.unit_price) * it.quantity * (1 - disc / 100)
    return SaleItemOut(
        id=it.id, variant_id=it.variant_id,
        variant_sku=it.variant.sku if it.variant else None,
        variant_size=it.variant.size if it.variant else None,
        variant_color=it.variant.color if it.variant else None,
        product_name=it.variant.product.name if it.variant and it.variant.product else None,
        quantity=it.quantity, unit_price=float(it.unit_price),
        discount_pct=disc, subtotal=round(sub, 2),
    )


def _to_out(s: Sale) -> SaleOut:
    items = [_compute_item(it) for it in s.items]
    subtotal = sum(i.subtotal for i in items)
    tax = round(subtotal * 0.21, 2) if s.type in (SaleType.FACTURA_A,) else 0
    total = round(subtotal + tax, 2)
    return SaleOut(
        id=s.id, type=s.type.value, number=s.number, date=s.date,
        status=s.status.value, customer_name=s.customer_name,
        customer_cuit=s.customer_cuit, notes=s.notes,
        subtotal=subtotal, tax=tax, total=total,
        local_id=s.local_id,
        local_name=s.local.name if s.local else None,
        company_id=s.company_id, created_by_id=s.created_by_id,
        created_by_name=s.created_by.full_name if s.created_by else None,
        items=items,
    )


@router.get("")
def list_sales(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=5000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Sale)
    if user.company_id:
        q = q.filter(Sale.company_id == user.company_id)
    if search:
        q = q.filter(
            (Sale.number.ilike(f"%{search}%")) |
            (Sale.customer_name.ilike(f"%{search}%"))
        )
    if status:
        q = q.filter(Sale.status == status)
    if type:
        q = q.filter(Sale.type == type)
    if date_from:
        q = q.filter(Sale.date >= date_from)
    if date_to:
        q = q.filter(Sale.date <= date_to)
    q = q.order_by(Sale.date.desc())
    total = q.count()
    sales = q.offset(skip).limit(limit).all()
    return {"items": [_to_out(s) for s in sales], "total": total, "skip": skip, "limit": limit}


@router.post("", response_model=SaleOut, status_code=201)
def create_sale(
    data: SaleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
        UserRole.LOCAL, UserRole.VENDEDOR
    )),
):
    company_id = user.company_id or 1
    sale = Sale(
        type=data.type, number=data.number, date=data.date,
        customer_name=data.customer_name, customer_cuit=data.customer_cuit,
        notes=data.notes, local_id=data.local_id,
        company_id=company_id, created_by_id=user.id,
    )
    db.add(sale)
    db.flush()

    for it in data.items:
        db.add(SaleItem(
            sale_id=sale.id, variant_id=it.variant_id,
            quantity=it.quantity, unit_price=it.unit_price,
            discount_pct=it.discount_pct or 0,
        ))

    db.commit()
    db.refresh(sale)
    return _to_out(sale)


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    return _to_out(s)


@router.put("/{sale_id}", response_model=SaleOut)
def update_sale(
    sale_id: int, data: SaleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION)),
):
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status != SaleStatus.BORRADOR:
        raise HTTPException(400, "Solo se puede editar en BORRADOR")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return _to_out(s)


@router.post("/{sale_id}/items", status_code=201)
def add_sale_item(sale_id: int, data: SaleItemCreate, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status != SaleStatus.BORRADOR:
        raise HTTPException(400, "Solo se pueden agregar ítems en BORRADOR")
    db.add(SaleItem(
        sale_id=sale_id, variant_id=data.variant_id,
        quantity=data.quantity, unit_price=data.unit_price,
        discount_pct=data.discount_pct or 0,
    ))
    db.commit()
    return {"ok": True}


@router.delete("/{sale_id}/items/{item_id}", status_code=204)
def remove_sale_item(sale_id: int, item_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    item = db.query(SaleItem).filter(SaleItem.id == item_id, SaleItem.sale_id == sale_id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    s = db.query(Sale).get(sale_id)
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status != SaleStatus.BORRADOR:
        raise HTTPException(400, "Solo se pueden eliminar ítems en BORRADOR")
    db.delete(item)
    db.commit()


@router.patch("/{sale_id}/emit")
def emit_sale(sale_id: int, db: Session = Depends(get_db),
              user: User = Depends(require_roles(
                  UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION,
                  UserRole.LOCAL, UserRole.VENDEDOR
              ))):
    """Emitir la venta — descuenta stock"""
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status != SaleStatus.BORRADOR:
        raise HTTPException(400, "Solo se puede emitir desde BORRADOR")
    if not s.items:
        raise HTTPException(400, "No se puede emitir sin ítems")

    for item in s.items:
        variant = db.query(ProductVariant).get(item.variant_id)
        if not variant:
            raise HTTPException(400, f"Variante {item.variant_id} no encontrada")
        if variant.stock < item.quantity:
            raise HTTPException(400, f"Stock insuficiente para {variant.sku}: disponible {variant.stock}, solicitado {item.quantity}")
        variant.stock -= item.quantity
        db.add(StockMovement(
            type=MovementType.EGRESO, variant_id=variant.id,
            quantity=-item.quantity, reference=f"Venta #{s.number}",
            company_id=s.company_id, created_by_id=user.id,
        ))

    s.status = SaleStatus.EMITIDA
    db.commit()
    return {"ok": True, "status": "EMITIDA"}


@router.patch("/{sale_id}/pay")
def pay_sale(sale_id: int, db: Session = Depends(get_db),
             user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION))):
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status != SaleStatus.EMITIDA:
        raise HTTPException(400, "Solo se puede marcar pagada desde EMITIDA")
    s.status = SaleStatus.PAGADA
    db.commit()
    return {"ok": True, "status": "PAGADA"}


@router.patch("/{sale_id}/cancel")
def cancel_sale(sale_id: int, db: Session = Depends(get_db),
                user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN))):
    """Anular venta — si estaba emitida, revierte stock"""
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status == SaleStatus.ANULADA:
        raise HTTPException(400, "Ya está anulada")

    if s.status in (SaleStatus.EMITIDA, SaleStatus.PAGADA):
        for item in s.items:
            variant = db.query(ProductVariant).get(item.variant_id)
            if variant:
                variant.stock += item.quantity
                db.add(StockMovement(
                    type=MovementType.INGRESO, variant_id=variant.id,
                    quantity=item.quantity, reference=f"Anulación Venta #{s.number}",
                    company_id=s.company_id, created_by_id=user.id,
                ))

    s.status = SaleStatus.ANULADA
    db.commit()
    return {"ok": True, "status": "ANULADA"}


@router.delete("/{sale_id}", status_code=204)
def delete_sale(sale_id: int, db: Session = Depends(get_db),
                user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN))):
    s = db.query(Sale).get(sale_id)
    if not s:
        raise HTTPException(404, "Venta no encontrada")
    if user.company_id and s.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if s.status not in (SaleStatus.BORRADOR, SaleStatus.ANULADA):
        raise HTTPException(400, "Solo se pueden eliminar ventas en BORRADOR o ANULADA")
    db.delete(s)
    db.commit()
