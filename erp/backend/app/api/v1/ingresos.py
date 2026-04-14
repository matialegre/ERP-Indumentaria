"""
Router CRUD de Ingresos de Mercadería (Remitos / Facturas de compra)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.ingreso import Ingreso, IngresoItem, IngresoStatus, IngresoType
from app.models.product import ProductVariant
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class IngresoItemOut(BaseModel):
    id: int
    variant_id: int
    variant_sku: str | None = None
    variant_size: str | None = None
    variant_color: str | None = None
    product_name: str | None = None
    quantity: int
    unit_cost: float | None = None
    model_config = {"from_attributes": True}


class IngresoItemCreate(BaseModel):
    variant_id: int
    quantity: int
    unit_cost: float | None = None


class IngresoOut(BaseModel):
    id: int
    type: str
    number: str
    date: datetime.date
    status: str
    notes: str | None = None
    total: float | None = None
    provider_id: int
    provider_name: str | None = None
    pedido_id: int | None = None
    company_id: int
    created_by_id: int
    created_by_name: str | None = None
    items: list[IngresoItemOut] = []
    model_config = {"from_attributes": True}


class IngresoCreate(BaseModel):
    type: str  # REMITO | FACTURA
    number: str
    date: datetime.date
    notes: str | None = None
    provider_id: int
    pedido_id: int | None = None
    items: list[IngresoItemCreate] = []


class IngresoUpdate(BaseModel):
    type: str | None = None
    number: str | None = None
    date: Optional[datetime.date] = None
    notes: str | None = None
    provider_id: int | None = None


router = APIRouter(prefix="/ingresos", tags=["Ingresos"])


def _serialize_ingreso(ingreso: Ingreso) -> dict:
    """Convierte un ingreso + relaciones a diccionario para IngresoOut"""
    items = []
    for it in ingreso.items:
        v = it.variant
        items.append({
            "id": it.id,
            "variant_id": it.variant_id,
            "variant_sku": v.sku if v else None,
            "variant_size": v.size if v else None,
            "variant_color": v.color if v else None,
            "product_name": v.product.name if v and v.product else None,
            "quantity": it.quantity,
            "unit_cost": float(it.unit_cost) if it.unit_cost else None,
        })
    return {
        "id": ingreso.id,
        "type": ingreso.type.value,
        "number": ingreso.number,
        "date": ingreso.date,
        "status": ingreso.status.value,
        "notes": ingreso.notes,
        "total": float(ingreso.total) if ingreso.total else None,
        "provider_id": ingreso.provider_id,
        "provider_name": ingreso.provider.name if ingreso.provider else None,
        "pedido_id": ingreso.pedido_id,
        "company_id": ingreso.company_id,
        "created_by_id": ingreso.created_by_id,
        "created_by_name": ingreso.created_by.full_name if ingreso.created_by else None,
        "items": items,
    }


# ── Endpoints ──────────────────────────────────────────

@router.get("/")
def list_ingresos(
    search: Optional[str] = None,
    status: Optional[str] = None,
    provider_id: Optional[int] = None,
    date_from: Optional[datetime.date] = None,
    date_to: Optional[datetime.date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Ingreso)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(Ingreso.company_id == current_user.company_id)
    if search:
        q = q.filter(Ingreso.number.ilike(f"%{search}%"))
    if status:
        q = q.filter(Ingreso.status == IngresoStatus(status))
    if provider_id:
        q = q.filter(Ingreso.provider_id == provider_id)
    if date_from:
        q = q.filter(Ingreso.date >= date_from)
    if date_to:
        q = q.filter(Ingreso.date <= date_to)
    q = q.order_by(Ingreso.date.desc(), Ingreso.id.desc())
    total = q.count()
    ingresos = q.offset(skip).limit(limit).all()
    return {"items": [_serialize_ingreso(i) for i in ingresos], "total": total, "skip": skip, "limit": limit}


@router.get("/{ingreso_id}")
def get_ingreso(
    ingreso_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    return _serialize_ingreso(ingreso)


@router.post("/", status_code=201)
def create_ingreso(
    body: IngresoCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.DEPOSITO
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    # Validar tipo
    try:
        ingreso_type = IngresoType(body.type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Tipo debe ser REMITO o FACTURA")

    # Calcular total
    total = 0.0
    for item in body.items:
        if item.unit_cost and item.quantity:
            total += item.unit_cost * item.quantity

    ingreso = Ingreso(
        type=ingreso_type,
        number=body.number,
        date=body.date,
        notes=body.notes,
        total=total or None,
        provider_id=body.provider_id,
        pedido_id=body.pedido_id,
        company_id=company_id,
        created_by_id=current_user.id,
        status=IngresoStatus.BORRADOR,
    )
    db.add(ingreso)
    db.flush()

    ingreso_id = ingreso.id
    created_items = []
    for item in body.items:
        ingreso_item = IngresoItem(
            ingreso_id=ingreso_id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
        )
        db.add(ingreso_item)
        db.flush()
        created_items.append({
            "id": ingreso_item.id,
            "variant_id": item.variant_id,
            "variant_sku": None,
            "variant_size": None,
            "variant_color": None,
            "product_name": None,
            "quantity": item.quantity,
            "unit_cost": float(item.unit_cost) if item.unit_cost else None,
        })

    db.commit()
    return {
        "id": ingreso_id,
        "type": body.type,
        "number": body.number,
        "date": body.date,
        "status": IngresoStatus.BORRADOR.value,
        "notes": body.notes,
        "total": float(total) if total else None,
        "provider_id": body.provider_id,
        "provider_name": None,
        "pedido_id": body.pedido_id,
        "company_id": company_id,
        "created_by_id": current_user.id,
        "created_by_name": None,
        "items": created_items,
    }


@router.put("/{ingreso_id}")
def update_ingreso(
    ingreso_id: int,
    body: IngresoUpdate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status != IngresoStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede editar un ingreso en BORRADOR")

    update_data = body.model_dump(exclude_unset=True)
    if "type" in update_data:
        try:
            update_data["type"] = IngresoType(update_data["type"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Tipo debe ser REMITO o FACTURA")

    for key, val in update_data.items():
        setattr(ingreso, key, val)
    db.commit()
    db.refresh(ingreso)
    return _serialize_ingreso(ingreso)


@router.post("/{ingreso_id}/items", status_code=201)
def add_ingreso_item(
    ingreso_id: int,
    body: IngresoItemCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.DEPOSITO
    )),
    db: Session = Depends(get_db),
):
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status != IngresoStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede editar un ingreso en BORRADOR")

    item = IngresoItem(
        ingreso_id=ingreso_id,
        variant_id=body.variant_id,
        quantity=body.quantity,
        unit_cost=body.unit_cost,
    )
    db.add(item)

    # Recalcular total
    db.flush()
    total = sum(
        (float(it.unit_cost or 0) * it.quantity) for it in ingreso.items
    )
    ingreso.total = total or None
    db.commit()
    db.refresh(ingreso)
    return _serialize_ingreso(ingreso)


@router.delete("/{ingreso_id}/items/{item_id}", status_code=204)
def remove_ingreso_item(
    ingreso_id: int,
    item_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status != IngresoStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede editar un ingreso en BORRADOR")

    item = db.query(IngresoItem).filter(
        IngresoItem.id == item_id, IngresoItem.ingreso_id == ingreso_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.delete(item)

    # Recalcular total
    db.flush()
    remaining = db.query(IngresoItem).filter(IngresoItem.ingreso_id == ingreso_id).all()
    total = sum((float(it.unit_cost or 0) * it.quantity) for it in remaining)
    ingreso.total = total or None
    db.commit()


class RecepcionBody(BaseModel):
    notes: str | None = None  # observaciones para ingreso parcial


@router.post("/{ingreso_id}/confirmar-recepcion")
def confirmar_recepcion(
    ingreso_id: int,
    body: RecepcionBody,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPOSITO, UserRole.LOCAL
    )),
    db: Session = Depends(get_db),
):
    """Confirmación de recepción física de mercadería por parte de DEPOSITO/LOCAL.
    Cambia status de BORRADOR a CONFIRMADO y actualiza stock."""
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status != IngresoStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede confirmar un ingreso en BORRADOR")

    # Registrar observación de recepción parcial en notes
    if body.notes:
        obs = f"[RECEPCION PARCIAL] {body.notes.strip()}"
        ingreso.notes = obs if not ingreso.notes else f"{ingreso.notes}\n{obs}"

    # Actualizar stock
    for item in ingreso.items:
        variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
        if variant:
            variant.stock += item.quantity

    ingreso.status = IngresoStatus.CONFIRMADO
    db.commit()
    db.refresh(ingreso)
    return _serialize_ingreso(ingreso)


@router.post("/{ingreso_id}/confirm")
def confirm_ingreso(
    ingreso_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    """Confirma un ingreso: cambia status a CONFIRMADO y actualiza stock de variantes"""
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status != IngresoStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se puede confirmar un ingreso en BORRADOR")
    if not ingreso.items:
        raise HTTPException(status_code=400, detail="No se puede confirmar un ingreso sin ítems")

    # Actualizar stock
    for item in ingreso.items:
        variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
        if variant:
            variant.stock += item.quantity

    ingreso.status = IngresoStatus.CONFIRMADO
    db.commit()
    db.refresh(ingreso)
    return _serialize_ingreso(ingreso)


@router.post("/{ingreso_id}/cancel")
def cancel_ingreso(
    ingreso_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Anula un ingreso. Si estaba confirmado, revierte stock."""
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status == IngresoStatus.ANULADO:
        raise HTTPException(status_code=400, detail="El ingreso ya está anulado")

    # Si estaba confirmado, revertir stock
    if ingreso.status == IngresoStatus.CONFIRMADO:
        for item in ingreso.items:
            variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
            if variant:
                variant.stock = max(0, variant.stock - item.quantity)

    ingreso.status = IngresoStatus.ANULADO
    db.commit()
    db.refresh(ingreso)
    return _serialize_ingreso(ingreso)


@router.delete("/{ingreso_id}", status_code=204)
def delete_ingreso(
    ingreso_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ingreso = db.query(Ingreso).filter(Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    if ingreso.status == IngresoStatus.CONFIRMADO:
        raise HTTPException(status_code=400, detail="No se puede eliminar un ingreso confirmado. Anúlelo primero.")
    db.delete(ingreso)
    db.commit()
