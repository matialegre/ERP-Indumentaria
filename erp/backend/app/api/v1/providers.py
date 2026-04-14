"""
Router CRUD de Proveedores
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.models.provider import Provider
from app.models.provider_contact import ProviderContact
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.purchase_invoice import PurchaseInvoice
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.v1.export_utils import export_csv, export_xlsx


class ProviderOut(BaseModel):
    id: int
    name: str
    cuit: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool
    company_id: int
    model_config = {"from_attributes": True}


class ProviderCreate(BaseModel):
    name: str
    cuit: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None


class ProviderContactCreate(BaseModel):
    name: str
    role: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_primary: bool = False


class ProviderContactUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_primary: bool | None = None


class ProviderContactOut(BaseModel):
    id: int
    provider_id: int
    name: str
    role: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_primary: bool
    model_config = {"from_attributes": True}


router = APIRouter(prefix="/providers", tags=["Proveedores"])


@router.get("/")
def list_providers(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Provider)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(Provider.company_id == current_user.company_id)
    if search:
        q = q.filter(
            (Provider.name.ilike(f"%{search}%"))
            | (Provider.cuit.ilike(f"%{search}%"))
        )
    q = q.order_by(Provider.name)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/export")
def export_providers(
    format: str = Query("xlsx", pattern="^(csv|xlsx)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export providers as CSV or XLSX."""
    q = db.query(Provider)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(Provider.company_id == current_user.company_id)
    q = q.order_by(Provider.name)
    providers = q.all()

    data = []
    for p in providers:
        data.append({
            "nombre": p.name or "",
            "cuit": p.cuit or "",
            "razon_social": p.legal_name or "",
            "condicion_iva": p.tax_condition or "",
            "domicilio": p.domicilio or "",
            "localidad": p.localidad or "",
            "provincia": p.provincia or "",
            "telefono": p.phone or "",
            "email": p.email or "",
            "ret_iva": float(p.ret_iva_pct) if p.ret_iva_pct else 0,
            "ret_iibb": float(p.ret_iibb_pct) if p.ret_iibb_pct else 0,
            "ret_ganancias": float(p.ret_ganancias_pct) if p.ret_ganancias_pct else 0,
            "ret_suss": float(p.ret_suss_pct) if p.ret_suss_pct else 0,
        })

    columns = ["nombre", "cuit", "razon_social", "condicion_iva", "domicilio", "localidad", "provincia", "telefono", "email", "ret_iva", "ret_iibb", "ret_ganancias", "ret_suss"]
    headers = ["Nombre", "CUIT", "Razón Social", "Condición IVA", "Domicilio", "Localidad", "Provincia", "Teléfono", "Email", "Ret. IVA %", "Ret. IIBB %", "Ret. Ganancias %", "Ret. SUSS %"]

    if format == "csv":
        return export_csv(data, "proveedores", columns)
    return export_xlsx(data, "proveedores", columns, headers)


@router.post("/", response_model=ProviderOut, status_code=201)
def create_provider(
    body: ProviderCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")
    provider = Provider(**body.model_dump(), company_id=company_id, is_active=True)
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/ranking")
def providers_ranking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ranking de proveedores por volumen, monto y tiempo de entrega."""
    company_id = current_user.company_id if current_user.role != UserRole.SUPERADMIN else None
    co = [PurchaseOrder.company_id == company_id] if company_id else []
    ci = [PurchaseInvoice.company_id == company_id] if company_id else []

    # por_volumen: total units ordered per provider
    vol_rows = (
        db.query(
            Provider.id,
            Provider.name,
            func.coalesce(func.sum(PurchaseOrderItem.quantity_ordered), 0).label('total_unidades'),
            func.count(func.distinct(PurchaseOrder.id)).label('total_notas'),
        )
        .join(PurchaseOrder, PurchaseOrder.provider_id == Provider.id)
        .join(PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .filter(*co)
        .group_by(Provider.id, Provider.name)
        .order_by(func.sum(PurchaseOrderItem.quantity_ordered).desc())
        .all()
    )
    por_volumen = [
        {"id": r.id, "name": r.name, "total_unidades": int(r.total_unidades), "total_notas": r.total_notas}
        for r in vol_rows
    ]

    # por_monto: total amount from invoices per provider
    monto_rows = (
        db.query(
            Provider.id,
            Provider.name,
            func.coalesce(func.sum(PurchaseInvoice.amount), 0).label('total_monto'),
            func.count(PurchaseInvoice.id).label('total_facturas'),
        )
        .join(PurchaseInvoice, PurchaseInvoice.provider_id == Provider.id)
        .filter(*ci)
        .group_by(Provider.id, Provider.name)
        .order_by(func.sum(PurchaseInvoice.amount).desc())
        .all()
    )
    por_monto = [
        {"id": r.id, "name": r.name, "total_monto": float(r.total_monto), "total_facturas": r.total_facturas}
        for r in monto_rows
    ]

    # por_tiempo_entrega: avg/min/max days between PO.date and Invoice.date
    day_diff = (
        func.extract('epoch', func.cast(PurchaseInvoice.date, func.DATE))
        - func.extract('epoch', func.cast(PurchaseOrder.date, func.DATE))
    )
    tiempo_rows = (
        db.query(
            Provider.id,
            Provider.name,
            func.avg(day_diff).label('avg_seconds'),
            func.min(day_diff).label('min_seconds'),
            func.max(day_diff).label('max_seconds'),
        )
        .join(PurchaseInvoice, PurchaseInvoice.provider_id == Provider.id)
        .join(PurchaseOrder, PurchaseInvoice.purchase_order_id == PurchaseOrder.id)
        .filter(
            PurchaseInvoice.date != None,
            PurchaseOrder.date != None,
            *ci,
        )
        .group_by(Provider.id, Provider.name)
        .order_by(func.avg(day_diff))
        .all()
    )
    por_tiempo_entrega = [
        {
            "id": r.id,
            "name": r.name,
            "promedio_dias": round(r.avg_seconds / 86400, 1) if r.avg_seconds else 0,
            "min_dias": round(r.min_seconds / 86400, 1) if r.min_seconds else 0,
            "max_dias": round(r.max_seconds / 86400, 1) if r.max_seconds else 0,
        }
        for r in tiempo_rows
    ]

    return {
        "por_volumen": por_volumen,
        "por_monto": por_monto,
        "por_tiempo_entrega": por_tiempo_entrega,
    }


@router.get("/{provider_id}/contacts", response_model=list[ProviderContactOut])
def list_contacts(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = db.query(Provider).filter(
        Provider.id == provider_id,
        Provider.company_id == current_user.company_id,
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return db.query(ProviderContact).filter(ProviderContact.provider_id == provider_id).all()


@router.post("/{provider_id}/contacts", response_model=ProviderContactOut, status_code=201)
def create_contact(
    provider_id: int,
    body: ProviderContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = db.query(Provider).filter(
        Provider.id == provider_id,
        Provider.company_id == current_user.company_id,
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if body.is_primary:
        db.query(ProviderContact).filter(ProviderContact.provider_id == provider_id).update({"is_primary": False})
    contact = ProviderContact(provider_id=provider_id, **body.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{provider_id}/contacts/{contact_id}", response_model=ProviderContactOut)
def update_contact(
    provider_id: int,
    contact_id: int,
    body: ProviderContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(ProviderContact).join(Provider).filter(
        ProviderContact.id == contact_id,
        ProviderContact.provider_id == provider_id,
        Provider.company_id == current_user.company_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    if body.is_primary:
        db.query(ProviderContact).filter(ProviderContact.provider_id == provider_id).update({"is_primary": False})
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(contact, k, v)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{provider_id}/contacts/{contact_id}", status_code=204)
def delete_contact(
    provider_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(ProviderContact).join(Provider).filter(
        ProviderContact.id == contact_id,
        ProviderContact.provider_id == provider_id,
        Provider.company_id == current_user.company_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    db.delete(contact)
    db.commit()


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: int,
    body: ProviderCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for key, val in body.model_dump().items():
        setattr(provider, key, val)
    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/{provider_id}", status_code=204)
def delete_provider(
    provider_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    db.delete(provider)
    db.commit()


@router.get("/{provider_id}/historia/export", summary="Exportar historia del proveedor")
def export_provider_historia(
    provider_id: int,
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type

    q_provider = db.query(Provider).filter(Provider.id == provider_id)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q_provider = q_provider.filter(Provider.company_id == current_user.company_id)
    provider = q_provider.first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    company_id = current_user.company_id if current_user.role != UserRole.SUPERADMIN else provider.company_id

    q = db.query(PurchaseOrder).filter(
        PurchaseOrder.provider_id == provider_id,
        PurchaseOrder.company_id == company_id,
    )
    if date_from:
        try:
            q = q.filter(PurchaseOrder.date >= date_type.fromisoformat(date_from))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato inválido para 'date_from' (YYYY-MM-DD)")
    if date_to:
        try:
            q = q.filter(PurchaseOrder.date <= date_type.fromisoformat(date_to))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato inválido para 'date_to' (YYYY-MM-DD)")

    orders = q.order_by(PurchaseOrder.date.desc()).limit(500).all()

    rows = []
    for order in orders:
        invoices = [inv for inv in (order.invoices or []) if inv.status.value != "ANULADO"]
        facturas = [inv for inv in invoices if inv.type.value in ("FACTURA", "REMITO_FACTURA")]
        rows.append({
            "Fecha": order.date.isoformat() if order.date else "",
            "Tipo": order.type.value if order.type else "",
            "Número": f"{order.prefix}-{order.number}" if order.prefix else (order.number or ""),
            "Estado": order.status.value if order.status else "",
            "Local": order.local.name if order.local else "",
            "Cant. Pedida": sum(it.quantity_ordered for it in order.items),
            "Cant. Recibida": sum(it.quantity_received for it in order.items),
            "N° Facturas": ", ".join(f.number or "" for f in facturas if f.number),
            "RV": ", ".join(set(inv.remito_venta_number for inv in invoices if inv.remito_venta_number)),
            "Importe": round(sum(float(inv.amount or 0) for inv in facturas), 2),
            "Notas": order.notes or "",
        })

    columns = ["Fecha", "Tipo", "Número", "Estado", "Local", "Cant. Pedida", "Cant. Recibida", "N° Facturas", "RV", "Importe", "Notas"]
    filename = f"historia_{provider.name.replace(' ', '_')}_{date_type.today()}"
    if format == "xlsx":
        return export_xlsx(rows, filename, columns, columns)
    return export_csv(rows, filename, columns)


@router.get("/{provider_id}/historia", summary="Historia completa del proveedor")
def get_provider_historia(
    provider_id: int,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    desde: Optional[str] = Query(None, description="Alias de date_from"),
    hasta: Optional[str] = Query(None, description="Alias de date_to"),
    status: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from datetime import date as date_type
    from app.models.payment import PaymentVoucher, PaymentInvoiceLink

    # Support both old (desde/hasta) and new (date_from/date_to) param names
    effective_from = date_from or desde
    effective_to = date_to or hasta

    q_provider = db.query(Provider).filter(Provider.id == provider_id)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q_provider = q_provider.filter(Provider.company_id == current_user.company_id)
    provider = q_provider.first()
    if not provider:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    company_id = current_user.company_id if current_user.role != UserRole.SUPERADMIN else provider.company_id

    q = db.query(PurchaseOrder).filter(
        PurchaseOrder.provider_id == provider_id,
        PurchaseOrder.company_id == company_id,
    )
    if effective_from:
        try:
            q = q.filter(PurchaseOrder.date >= date_type.fromisoformat(effective_from))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato inválido para 'date_from' (YYYY-MM-DD)")
    if effective_to:
        try:
            q = q.filter(PurchaseOrder.date <= date_type.fromisoformat(effective_to))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato inválido para 'date_to' (YYYY-MM-DD)")
    if status:
        q = q.filter(PurchaseOrder.status == status)

    # Fetch chronologically (oldest first) to compute running balance correctly
    orders = q.order_by(PurchaseOrder.date.asc()).limit(limit).all()

    result = []
    saldo_acum = 0.0

    for order in orders:
        invoices = [inv for inv in (order.invoices or []) if inv.status.value != "ANULADO"]
        facturas = [inv for inv in invoices if inv.type.value in ("FACTURA", "REMITO_FACTURA")]
        remitos = [inv for inv in invoices if inv.type.value in ("REMITO", "REMITO_FACTURA")]

        qty_ordered = sum(it.quantity_ordered for it in order.items)
        qty_received = sum(it.quantity_received for it in order.items)
        amount_facturas = sum(float(inv.amount or 0) for inv in facturas)
        saldo_acum += amount_facturas

        # Get payment vouchers linked to this order's invoices
        invoice_ids = [inv.id for inv in invoices]
        linked_payments = []
        if invoice_ids:
            linked_payments = (
                db.query(PaymentVoucher)
                .join(PaymentInvoiceLink, PaymentVoucher.id == PaymentInvoiceLink.payment_voucher_id)
                .filter(PaymentInvoiceLink.purchase_invoice_id.in_(invoice_ids))
                .all()
            )

        amount_paid = sum(float(v.amount_paid or 0) for v in linked_payments)
        saldo_acum -= amount_paid

        result.append({
            "id": order.id,
            "fecha": order.date.isoformat() if order.date else None,
            "tipo": order.type.value if order.type else None,
            "numero": order.number,
            "prefix": order.prefix,
            "estado": order.status.value if order.status else None,
            "local_id": order.local_id,
            "local_name": order.local.name if order.local else None,
            "facturas_count": len(facturas),
            "remitos_count": len(remitos),
            "nums_facturas": ", ".join(f.number or "" for f in facturas if f.number),
            "nums_remitos": ", ".join(r.number or "" for r in remitos if r.number),
            "rvs": ", ".join(set(inv.remito_venta_number for inv in invoices if inv.remito_venta_number)),
            "vto_pago": min((inv.due_date.isoformat() for inv in facturas if inv.due_date), default=None),
            "cant_pedida": qty_ordered,
            "cant_recibida": qty_received,
            "importe_bruto": round(amount_facturas, 2),
            "importe_total": round(amount_facturas, 2),
            "pagado": round(amount_paid, 2),
            "saldo_acum": round(saldo_acum, 2),
            "ret_iva": round(sum(float(v.amount_iva or 0) for v in linked_payments), 2),
            "ret_iibb": round(sum(float(v.amount_iibb or 0) for v in linked_payments), 2),
            "ret_ganancias": round(sum(float(v.amount_ganancias or 0) for v in linked_payments), 2),
            "ret_suss": round(sum(float(v.amount_suss or 0) for v in linked_payments), 2),
            "obs_compras": "; ".join(inv.compras_obs for inv in invoices if inv.compras_obs),
            "obs_locales": "; ".join(inv.local_obs for inv in invoices if inv.local_obs),
            "accepted_difference": order.accepted_difference,
            "notes": order.notes,
            "dias_entrega": (order.date - order.expected_date).days if order.date and order.expected_date else None,
        })

    result.reverse()  # Most recent first for display

    return {
        "provider_id": provider.id,
        "provider_name": provider.name,
        "total": len(result),
        "saldo_total": round(saldo_acum, 2),
        "items": result,
    }
