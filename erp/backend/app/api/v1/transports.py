"""
Router para Transportes y Envíos/Remesas
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.transport import Transport, Shipment
from app.models.local import Local
from app.models.user import User, UserRole
from app.models.purchase_invoice import PurchaseInvoice
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class TransportOut(BaseModel):
    id: int
    name: str
    contact: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_active: bool
    company_id: int
    model_config = {"from_attributes": True}


class TransportCreate(BaseModel):
    name: str
    contact: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class TransportUpdate(BaseModel):
    name: str | None = None
    contact: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ShipmentOut(BaseModel):
    id: int
    transport_id: int
    transport_name: str | None = None
    tracking_number: str | None = None
    sender: str | None = None
    destination_local_id: int | None = None
    destination_local_name: str | None = None
    date_sent: datetime.date | None = None
    date_arrived: datetime.date | None = None
    status: str
    notes: str | None = None
    image_file: str | None = None
    purchase_invoice_id: int | None = None
    company_id: int
    model_config = {"from_attributes": True}


class ShipmentCreate(BaseModel):
    transport_id: int
    tracking_number: str | None = None
    sender: str | None = None
    destination_local_id: int | None = None
    date_sent: datetime.date | None = None
    notes: str | None = None
    purchase_invoice_id: int | None = None
    status: str = "ENVIADO"


class ShipmentUpdate(BaseModel):
    status: str | None = None
    date_arrived: datetime.date | None = None
    notes: str | None = None
    tracking_number: str | None = None
    image_file: str | None = None


router = APIRouter(prefix="/transports", tags=["Transportes"])


# ── Helpers ────────────────────────────────────────────

def _apply_company_filter(q, model, current_user: User):
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(model.company_id == current_user.company_id)
    return q


def _serialize_shipment(s: Shipment) -> dict:
    return {
        "id": s.id,
        "transport_id": s.transport_id,
        "transport_name": s.transport.name if s.transport else None,
        "tracking_number": s.tracking_number,
        "sender": s.sender,
        "destination_local_id": s.destination_local_id,
        "destination_local_name": s.destination_local.name if s.destination_local else None,
        "date_sent": s.date_sent,
        "date_arrived": s.date_arrived,
        "status": s.status,
        "notes": s.notes,
        "image_file": s.image_file,
        "purchase_invoice_id": s.purchase_invoice_id,
        "company_id": s.company_id,
    }


# ── Transports ─────────────────────────────────────────

@router.get("/")
def list_transports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Transport).filter(Transport.is_active == True)
    q = _apply_company_filter(q, Transport, current_user)
    q = q.order_by(Transport.name)
    return [TransportOut.model_validate(t) for t in q.all()]


@router.post("/", status_code=201)
def create_transport(
    body: TransportCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    transport = Transport(**body.model_dump(), is_active=True, company_id=company_id)
    db.add(transport)
    db.commit()
    db.refresh(transport)
    return TransportOut.model_validate(transport)


@router.put("/{transport_id}")
def update_transport(
    transport_id: int,
    body: TransportUpdate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    transport = db.query(Transport).filter(Transport.id == transport_id).first()
    if not transport:
        raise HTTPException(status_code=404, detail="Transporte no encontrado")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(transport, key, val)
    db.commit()
    db.refresh(transport)
    return TransportOut.model_validate(transport)


# ── Shipments ──────────────────────────────────────────

@router.get("/shipments/")
def list_shipments(
    status: Optional[str] = None,
    transport_id: Optional[int] = None,
    local_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Shipment)
    q = _apply_company_filter(q, Shipment, current_user)
    if status:
        q = q.filter(Shipment.status == status)
    if transport_id:
        q = q.filter(Shipment.transport_id == transport_id)
    if local_id:
        q = q.filter(Shipment.destination_local_id == local_id)
    q = q.order_by(Shipment.date_sent.desc(), Shipment.id.desc())
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": [_serialize_shipment(s) for s in items], "total": total, "skip": skip, "limit": limit}


@router.get("/shipments/{shipment_id}")
def get_shipment(
    shipment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return _serialize_shipment(s)


@router.post("/shipments/", status_code=201)
def create_shipment(
    body: ShipmentCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.DEPOSITO
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    shipment = Shipment(**body.model_dump(), company_id=company_id)
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return _serialize_shipment(shipment)


@router.put("/shipments/{shipment_id}")
def update_shipment(
    shipment_id: int,
    body: ShipmentUpdate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.DEPOSITO
    )),
    db: Session = Depends(get_db),
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Envío no encontrado")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(s, key, val)
    db.commit()
    db.refresh(s)
    return _serialize_shipment(s)


@router.post("/shipments/{shipment_id}/delivered")
def mark_shipment_delivered(
    shipment_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.DEPOSITO, UserRole.LOCAL
    )),
    db: Session = Depends(get_db),
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    if s.status == "ENTREGADO":
        raise HTTPException(status_code=400, detail="El envío ya fue marcado como entregado")

    s.status = "ENTREGADO"
    s.date_arrived = datetime.date.today()
    db.commit()
    db.refresh(s)
    return _serialize_shipment(s)
