"""
Router para Comprobantes de Pago, Cuentas Bancarias y Notas de Crédito
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.payment import BankAccount, PaymentVoucher, PaymentInvoiceLink, CreditNote, PaymentStatus, PaymentMethod
from app.models.provider import Provider
from app.models.purchase_invoice import PurchaseInvoice
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class BankAccountOut(BaseModel):
    id: int
    provider_id: int
    bank_name: str | None = None
    account_type: str | None = None
    cbu: str | None = None
    alias: str | None = None
    cuit: str | None = None
    is_active: bool
    model_config = {"from_attributes": True}


class BankAccountCreate(BaseModel):
    provider_id: int
    bank_name: str | None = None
    account_type: str | None = None
    cbu: str | None = None
    alias: str | None = None
    cuit: str | None = None


class PaymentVoucherOut(BaseModel):
    id: int
    number: str | None = None
    date: datetime.date
    status: str
    amount_gross: float
    amount_iibb: float
    amount_ganancias: float
    amount_iva: float
    amount_suss: float
    amount_net: float
    amount_paid: float
    payment_date: datetime.date | None = None
    notes: str | None = None
    payment_method: str | None = None
    due_date: datetime.date | None = None
    provider_id: int
    provider_name: str | None = None
    bank_account_id: int | None = None
    company_id: int
    created_by_id: int
    model_config = {"from_attributes": True}


class PaymentVoucherCreate(BaseModel):
    number: str | None = None
    date: datetime.date
    amount_gross: float
    amount_iibb: float = 0
    amount_ganancias: float = 0
    amount_iva: float = 0
    amount_suss: float = 0
    amount_net: float
    provider_id: int
    bank_account_id: int | None = None
    notes: str | None = None
    payment_method: str | None = None
    due_date: datetime.date | None = None
    invoice_ids: list[int] = []


class CreditNoteOut(BaseModel):
    id: int
    number: str
    date: datetime.date | None = None
    amount: float
    applied: bool
    notes: str | None = None
    provider_id: int
    provider_name: str | None = None
    company_id: int
    model_config = {"from_attributes": True}


class CreditNoteCreate(BaseModel):
    number: str
    date: datetime.date | None = None
    amount: float
    notes: str | None = None
    provider_id: int


router = APIRouter(prefix="/payments", tags=["Pagos"])


# ── Helpers ────────────────────────────────────────────

def _apply_company_filter(q, model, current_user: User):
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(model.company_id == current_user.company_id)
    return q


def _serialize_voucher(v: PaymentVoucher) -> dict:
    return {
        "id": v.id,
        "number": v.number,
        "date": v.date,
        "status": v.status.value if v.status else None,
        "amount_gross": float(v.amount_gross or 0),
        "amount_iibb": float(v.amount_iibb or 0),
        "amount_ganancias": float(v.amount_ganancias or 0),
        "amount_iva": float(v.amount_iva or 0),
        "amount_suss": float(v.amount_suss or 0),
        "amount_net": float(v.amount_net or 0),
        "amount_paid": float(v.amount_paid or 0),
        "payment_date": v.payment_date,
        "notes": v.notes,
        "payment_method": v.payment_method.value if v.payment_method else None,
        "due_date": v.due_date,
        "provider_id": v.provider_id,
        "provider_name": v.provider.name if v.provider else None,
        "bank_account_id": v.bank_account_id,
        "company_id": v.company_id,
        "created_by_id": v.created_by_id,
    }


def _serialize_credit_note(cn: CreditNote) -> dict:
    return {
        "id": cn.id,
        "number": cn.number,
        "date": cn.date,
        "amount": float(cn.amount or 0),
        "applied": cn.applied,
        "notes": cn.notes,
        "provider_id": cn.provider_id,
        "provider_name": cn.provider.name if cn.provider else None,
        "company_id": cn.company_id,
    }


# ── Bank Accounts ──────────────────────────────────────

@router.get("/bank-accounts/")
def list_bank_accounts(
    provider_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(BankAccount).filter(BankAccount.is_active == True)
    if provider_id:
        q = q.filter(BankAccount.provider_id == provider_id)
    return [BankAccountOut.model_validate(a) for a in q.all()]


@router.post("/bank-accounts/", status_code=201)
def create_bank_account(
    body: BankAccountCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS
    )),
    db: Session = Depends(get_db),
):
    account = BankAccount(**body.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return BankAccountOut.model_validate(account)


@router.delete("/bank-accounts/{account_id}", status_code=204)
def delete_bank_account(
    account_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    account.is_active = False
    db.commit()


# ── Payment Vouchers ───────────────────────────────────

@router.get("/vouchers/")
def list_vouchers(
    provider_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(PaymentVoucher)
    q = _apply_company_filter(q, PaymentVoucher, current_user)
    if provider_id:
        q = q.filter(PaymentVoucher.provider_id == provider_id)
    if status:
        try:
            q = q.filter(PaymentVoucher.status == PaymentStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    q = q.order_by(PaymentVoucher.date.desc(), PaymentVoucher.id.desc())
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": [_serialize_voucher(v) for v in items], "total": total, "skip": skip, "limit": limit}


@router.post("/vouchers/{voucher_id}/undo", summary="Deshacer pago")
def undo_payment(
    voucher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "ADMIN", "GESTION_PAGOS")),
):
    voucher = db.query(PaymentVoucher).filter(
        PaymentVoucher.id == voucher_id,
        PaymentVoucher.company_id == current_user.company_id,
    ).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    if voucher.status != PaymentStatus.PAGADO:
        raise HTTPException(status_code=400, detail="Solo se puede deshacer el pago de comprobantes PAGADO")
    voucher.status = PaymentStatus.POR_PAGAR
    voucher.amount_paid = 0
    voucher.payment_date = None
    db.commit()
    return {"ok": True, "message": "Pago deshecho. Comprobante vuelto a POR_PAGAR."}


@router.get("/vouchers/{voucher_id}")
def get_voucher(
    voucher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.query(PaymentVoucher).filter(PaymentVoucher.id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Comprobante de pago no encontrado")
    return _serialize_voucher(v)


@router.post("/vouchers/", status_code=201)
def create_voucher(
    body: PaymentVoucherCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    voucher = PaymentVoucher(
        number=body.number,
        date=body.date,
        amount_gross=body.amount_gross,
        amount_iibb=body.amount_iibb,
        amount_ganancias=body.amount_ganancias,
        amount_iva=body.amount_iva,
        amount_suss=body.amount_suss,
        amount_net=body.amount_net,
        amount_paid=body.amount_net,
        provider_id=body.provider_id,
        bank_account_id=body.bank_account_id,
        notes=body.notes,
        status=PaymentStatus.PENDIENTE,
        company_id=company_id,
        created_by_id=current_user.id,
    )
    db.add(voucher)
    db.flush()

    for inv_id in body.invoice_ids:
        link = PaymentInvoiceLink(voucher_id=voucher.id, invoice_id=inv_id)
        db.add(link)

    db.commit()
    db.refresh(voucher)
    return _serialize_voucher(voucher)


@router.post("/vouchers/{voucher_id}/mark-paid")
def mark_voucher_paid(
    voucher_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS
    )),
    db: Session = Depends(get_db),
):
    v = db.query(PaymentVoucher).filter(PaymentVoucher.id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Comprobante de pago no encontrado")
    if v.status == PaymentStatus.PAGADO:
        raise HTTPException(status_code=400, detail="El comprobante ya está marcado como pagado")
    v.status = PaymentStatus.PAGADO
    v.payment_date = datetime.date.today()
    db.commit()
    db.refresh(v)
    return _serialize_voucher(v)


# ── Credit Notes ───────────────────────────────────────

@router.get("/credit-notes/")
def list_credit_notes(
    provider_id: Optional[int] = None,
    applied: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CreditNote)
    q = _apply_company_filter(q, CreditNote, current_user)
    if provider_id:
        q = q.filter(CreditNote.provider_id == provider_id)
    if applied is not None:
        q = q.filter(CreditNote.applied == applied)
    q = q.order_by(CreditNote.id.desc())
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": [_serialize_credit_note(cn) for cn in items], "total": total, "skip": skip, "limit": limit}


@router.post("/credit-notes/", status_code=201)
def create_credit_note(
    body: CreditNoteCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    cn = CreditNote(
        number=body.number,
        date=body.date,
        amount=body.amount,
        notes=body.notes,
        provider_id=body.provider_id,
        applied=False,
        company_id=company_id,
    )
    db.add(cn)
    db.commit()
    db.refresh(cn)
    return _serialize_credit_note(cn)


@router.post("/credit-notes/{note_id}/apply")
def apply_credit_note(
    note_id: int,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS
    )),
    db: Session = Depends(get_db),
):
    cn = db.query(CreditNote).filter(CreditNote.id == note_id).first()
    if not cn:
        raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")
    if cn.applied:
        raise HTTPException(status_code=400, detail="La nota de crédito ya fue aplicada")
    cn.applied = True
    db.commit()
    db.refresh(cn)
    return _serialize_credit_note(cn)
