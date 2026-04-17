"""
Router CRUD de Pedidos a Proveedores
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.pedido import Pedido, PedidoItem, PedidoStatus
from app.models.ingreso import Ingreso, IngresoStatus
from app.models.product import ProductVariant
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class PedidoItemOut(BaseModel):
    id: int
    variant_id: int
    variant_sku: str | None = None
    variant_size: str | None = None
    variant_color: str | None = None
    product_name: str | None = None
    quantity: int
    received_qty: int = 0
    unit_cost: float | None = None
    model_config = {"from_attributes": True}


class PedidoItemCreate(BaseModel):
    variant_id: int
    quantity: int
    unit_cost: float | None = None


class PedidoOut(BaseModel):
    id: int
    number: str
    date: datetime.date
    expected_date: datetime.date | None = None
    status: str
    notes: str | None = None
    total: float | None = None
    provider_id: int
    provider_name: str | None = None
    company_id: int
    created_by_id: int
    created_by_name: str | None = None
    items: list[PedidoItemOut] = []
    model_config = {"from_attributes": True}


class PedidoCreate(BaseModel):
    number: str
    date: datetime.date
    expected_date: datetime.date | None = None
    notes: str | None = None
    provider_id: int
    items: list[PedidoItemCreate] = []


class PedidoUpdate(BaseModel):
    number: str | None = None
    date: datetime.date | None = None
    expected_date: datetime.date | None = None
    notes: str | None = None
    provider_id: int | None = None


router = APIRouter(prefix="/pedidos", tags=["pedidos"])


def _to_out(p: Pedido) -> dict:
    items = []
    for it in p.items:
        items.append(PedidoItemOut(
            id=it.id,
            variant_id=it.variant_id,
            variant_sku=it.variant.sku if it.variant else None,
            variant_size=it.variant.size if it.variant else None,
            variant_color=it.variant.color if it.variant else None,
            product_name=it.variant.product.name if it.variant and it.variant.product else None,
            quantity=it.quantity,
            received_qty=it.received_qty,
            unit_cost=float(it.unit_cost) if it.unit_cost else None,
        ))
    total = sum((it.unit_cost or 0) * it.quantity for it in p.items) if p.items else p.total
    return PedidoOut(
        id=p.id, number=p.number, date=p.date, expected_date=p.expected_date,
        status=p.status.value, notes=p.notes, total=float(total) if total else None,
        provider_id=p.provider_id, provider_name=p.provider.name if p.provider else None,
        company_id=p.company_id, created_by_id=p.created_by_id,
        created_by_name=p.created_by.full_name if p.created_by else None,
        items=items,
    )


@router.get("")
def list_pedidos(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    provider_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=5000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Pedido)
    if user.company_id:
        q = q.filter(Pedido.company_id == user.company_id)
    if search:
        q = q.filter(Pedido.number.ilike(f"%{search}%"))
    if status:
        q = q.filter(Pedido.status == status)
    if provider_id:
        q = q.filter(Pedido.provider_id == provider_id)
    q = q.order_by(Pedido.date.desc())
    total = q.count()
    pedidos = q.offset(skip).limit(limit).all()
    return {"items": [_to_out(p) for p in pedidos], "total": total, "skip": skip, "limit": limit}


@router.post("", response_model=PedidoOut, status_code=201)
def create_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
):
    company_id = user.company_id or 1
    pedido = Pedido(
        number=data.number, date=data.date, expected_date=data.expected_date,
        notes=data.notes, provider_id=data.provider_id,
        company_id=company_id, created_by_id=user.id,
    )
    db.add(pedido)
    db.flush()

    for it in data.items:
        item = PedidoItem(
            pedido_id=pedido.id, variant_id=it.variant_id,
            quantity=it.quantity, unit_cost=it.unit_cost,
        )
        db.add(item)

    db.commit()
    db.refresh(pedido)
    return _to_out(pedido)


@router.get("/{pedido_id}", response_model=PedidoOut)
def get_pedido(pedido_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    return _to_out(p)


@router.put("/{pedido_id}", response_model=PedidoOut)
def update_pedido(
    pedido_id: int, data: PedidoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
):
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status != PedidoStatus.BORRADOR:
        raise HTTPException(400, "Solo se puede editar en estado BORRADOR")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.post("/{pedido_id}/items", status_code=201)
def add_item(pedido_id: int, data: PedidoItemCreate, db: Session = Depends(get_db),
             user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS))):
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status != PedidoStatus.BORRADOR:
        raise HTTPException(400, "Solo se pueden agregar ítems en BORRADOR")

    item = PedidoItem(
        pedido_id=pedido_id, variant_id=data.variant_id,
        quantity=data.quantity, unit_cost=data.unit_cost,
    )
    db.add(item)
    db.commit()
    return {"ok": True}


@router.delete("/{pedido_id}/items/{item_id}", status_code=204)
def remove_item(pedido_id: int, item_id: int, db: Session = Depends(get_db),
                user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS))):
    item = db.query(PedidoItem).filter(PedidoItem.id == item_id, PedidoItem.pedido_id == pedido_id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    p = db.query(Pedido).get(pedido_id)
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status != PedidoStatus.BORRADOR:
        raise HTTPException(400, "Solo se pueden eliminar ítems en BORRADOR")
    db.delete(item)
    db.commit()


@router.patch("/{pedido_id}/send")
def send_pedido(pedido_id: int, db: Session = Depends(get_db),
                user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS))):
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status != PedidoStatus.BORRADOR:
        raise HTTPException(400, "Solo se puede enviar desde BORRADOR")
    if not p.items:
        raise HTTPException(400, "No se puede enviar un pedido sin ítems")
    p.status = PedidoStatus.ENVIADO
    db.commit()
    return {"ok": True, "status": "ENVIADO"}


@router.patch("/{pedido_id}/receive")
def receive_pedido(pedido_id: int, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPOSITO))):
    """Marca el pedido como recibido totalmente — actualiza stock"""
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status not in (PedidoStatus.ENVIADO, PedidoStatus.RECIBIDO_PARCIAL):
        raise HTTPException(400, "Solo se puede recibir desde ENVIADO o RECIBIDO_PARCIAL")

    from app.models.stock_movement import StockMovement as SM, MovementType as MT

    for item in p.items:
        remaining = item.quantity - item.received_qty
        if remaining > 0:
            variant = db.query(ProductVariant).get(item.variant_id)
            if variant:
                variant.stock += remaining
                item.received_qty = item.quantity
                db.add(SM(
                    type=MT.INGRESO, variant_id=variant.id, quantity=remaining,
                    reference=f"Pedido #{p.number}",
                    company_id=p.company_id, created_by_id=user.id,
                ))

    p.status = PedidoStatus.RECIBIDO
    db.commit()
    return {"ok": True, "status": "RECIBIDO"}


@router.patch("/{pedido_id}/cancel")
def cancel_pedido(pedido_id: int, db: Session = Depends(get_db),
                  user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN))):
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status == PedidoStatus.ANULADO:
        raise HTTPException(400, "Ya está anulado")
    p.status = PedidoStatus.ANULADO
    db.commit()
    return {"ok": True, "status": "ANULADO"}


@router.delete("/{pedido_id}", status_code=204)
def delete_pedido(pedido_id: int, db: Session = Depends(get_db),
                  user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN))):
    p = db.query(Pedido).get(pedido_id)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if user.company_id and p.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    if p.status not in (PedidoStatus.BORRADOR, PedidoStatus.ANULADO):
        raise HTTPException(400, "Solo se pueden eliminar pedidos en BORRADOR o ANULADO")
    db.delete(p)
    db.commit()


@router.get("/vista-integrada/all")
def vista_integrada(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns all pedidos with their linked ingresos (facturas/remitos) for the integrated view."""
    import re as _re
    from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceItem

    q = db.query(Pedido)
    if user.company_id:
        q = q.filter(Pedido.company_id == user.company_id)
    pedidos = q.order_by(Pedido.date.desc()).all()

    # Get all ingresos with pedido_id in one query
    pedido_ids = [p.id for p in pedidos]
    ingresos = []
    if pedido_ids:
        iq = db.query(Ingreso).filter(Ingreso.pedido_id.in_(pedido_ids))
        if user.company_id:
            iq = iq.filter(Ingreso.company_id == user.company_id)
        ingresos = iq.all()

    # Group ingresos by pedido_id
    ing_by_pedido = {}
    for ing in ingresos:
        ing_by_pedido.setdefault(ing.pedido_id, []).append(ing)

    # Pre-fetch PurchaseInvoices by ingreso number (for RV + PDF items)
    all_numbers = [i.number for i in ingresos if i.number]
    pi_by_number: dict = {}
    if all_numbers:
        co = [PurchaseInvoice.company_id == user.company_id] if user.company_id else []
        pis = db.query(PurchaseInvoice).filter(PurchaseInvoice.number.in_(all_numbers), *co).all()
        for pi in pis:
            if pi.number:
                pi_by_number[pi.number] = pi

    result = []
    for p in pedidos:
        linked = ing_by_pedido.get(p.id, [])
        facturas = [i for i in linked if i.type.value == "FACTURA" and i.status.value != "ANULADO"]
        remitos = [i for i in linked if i.type.value == "REMITO" and i.status.value != "ANULADO"]

        def _parse_qty(notes, key):
            if not notes:
                return 0
            import re
            m = re.search(rf'{key}:\s*([\d.]+)', notes)
            return int(float(m.group(1))) if m else 0

        # Calculate quantities
        pedido_qty = sum(it.quantity for it in p.items) if p.items else (int(float(p.total)) if p.total else _parse_qty(p.notes, 'Cantidad pedida'))
        recibido_qty = sum(it.received_qty for it in p.items) if p.items else _parse_qty(p.notes, 'Cantidad facturada')

        total_facturado = 0
        total_remitido = 0
        for f in facturas:
            qty = sum(it.quantity for it in f.items) if f.items else _parse_qty(f.notes, 'Cantidad factura')
            total_facturado += qty
        for r in remitos:
            qty = sum(it.quantity for it in r.items) if r.items else _parse_qty(r.notes, 'Cantidad factura')
            total_remitido += qty

        diferencia = pedido_qty - total_facturado if total_facturado > 0 else 0

        def _serialize_ing(i):
            qty = sum(it.quantity for it in i.items) if i.items else _parse_qty(i.notes, 'Cantidad factura')
            # Parse structured fields from notes
            rv = None
            np_ref = None
            rc = None
            items_count = 0
            items_pdf = []
            if i.notes:
                rv_m = _re.search(r'Remito venta:\s*(.+?)(?:\n|$)', i.notes)
                rv = rv_m.group(1).strip() if rv_m else None
                np_m = _re.search(r'Nota de pedido:\s*(.+?)(?:\n|$)', i.notes)
                np_ref = np_m.group(1).strip() if np_m else None
                rc_m = _re.search(r'Remito compra:\s*(.+?)(?:\n|$)', i.notes)
                rc = rc_m.group(1).strip() if rc_m else None
                items_m = _re.search(r'Items:\s*(\d+)', i.notes)
                items_count = int(items_m.group(1)) if items_m else 0
            # Enrich with PDF items from matching PurchaseInvoice
            pi = pi_by_number.get(i.number)
            if pi and pi.items:
                items_pdf = [
                    {
                        "code": it.code,
                        "description": it.description,
                        "size": it.size,
                        "color": it.color,
                        "qty": it.quantity_invoiced,
                    }
                    for it in pi.items
                    if it.code or it.description or it.quantity_invoiced > 0
                ]
                # Use RV from PurchaseInvoice if not in notes
                if not rv and pi.remito_venta_number:
                    rv = pi.remito_venta_number
            return {
                "id": i.id,
                "type": i.type.value,
                "number": i.number,
                "date": str(i.date),
                "status": i.status.value,
                "quantity": qty,
                "total": float(i.total) if i.total else None,
                "notes": i.notes,
                "remito_venta_number": rv,
                "np_ref": np_ref,
                "remito_compra": rc,
                "items_count": items_count,
                "items_pdf": items_pdf,
            }

        # Parse extra fields from notes
        def _parse_field(notes, key):
            if not notes:
                return None
            import re
            m = re.search(rf'{key}:\s*(.+?)(?:\n|$)', notes)
            return m.group(1).strip() if m else None

        local = _parse_field(p.notes, 'Local')
        tipo = _parse_field(p.notes, 'Tipo')

        result.append({
            "id": p.id,
            "number": p.number,
            "date": str(p.date),
            "expected_date": str(p.expected_date) if p.expected_date else None,
            "status": p.status.value,
            "notes": p.notes,
            "provider_id": p.provider_id,
            "provider_name": p.provider.name if p.provider else None,
            "local": local,
            "tipo": tipo,
            "pedido_qty": pedido_qty,
            "recibido_qty": recibido_qty,
            "total_facturado": total_facturado,
            "total_remitido": total_remitido,
            "diferencia": diferencia,
            "facturas": [_serialize_ing(f) for f in facturas],
            "remitos": [_serialize_ing(r) for r in remitos],
            "total_docs": len(facturas) + len(remitos),
        })

    return result
