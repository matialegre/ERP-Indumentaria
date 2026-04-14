"""
Router de Planes y Suscripciones — gestión de licencias multi-tenant
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.plan import Plan, CompanySubscription, PlanTier, SubscriptionStatus, _gen_serial
from app.models.company import Company
from app.models.user import UserRole
from app.api.deps import get_current_user, require_mega_admin

router = APIRouter(prefix="/plans", tags=["Planes"])


# ── Schemas ──────────────────────────────────────────────────

class PlanOut(BaseModel):
    id: int
    name: str
    tier: PlanTier
    description: Optional[str] = None
    max_users: int
    max_locals: int
    max_products: int
    max_modules: int
    price_monthly: float
    price_currency: str
    is_active: bool
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanCreate(BaseModel):
    name: str
    tier: PlanTier
    description: Optional[str] = None
    max_users: int = 5
    max_locals: int = 1
    max_products: int = 500
    max_modules: int = 5
    price_monthly: float = 0
    price_currency: str = "ARS"
    is_default: bool = False


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    tier: Optional[PlanTier] = None
    description: Optional[str] = None
    max_users: Optional[int] = None
    max_locals: Optional[int] = None
    max_products: Optional[int] = None
    max_modules: Optional[int] = None
    price_monthly: Optional[float] = None
    price_currency: Optional[str] = None
    is_default: Optional[bool] = None


class SubscriptionOut(BaseModel):
    id: int
    company_id: int
    plan_id: int
    status: SubscriptionStatus
    serial_number: Optional[str] = None
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    plan: Optional[PlanOut] = None

    model_config = {"from_attributes": True}


class SubscribeBody(BaseModel):
    company_id: int
    plan_id: int
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


class SubscriptionUpdateBody(BaseModel):
    status: Optional[SubscriptionStatus] = None
    plan_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────

@router.get("/", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    """Listar todos los planes activos (público para pricing page)"""
    return db.query(Plan).filter(Plan.is_active == True).order_by(Plan.price_monthly).all()


@router.post("/", response_model=PlanOut, status_code=201)
def create_plan(
    body: PlanCreate,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Crear un nuevo plan (MEGAADMIN)"""
    # Si se marca como default, quitar default de los demás
    if body.is_default:
        db.query(Plan).filter(Plan.is_default == True).update({"is_default": False})

    plan = Plan(**body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/{plan_id}", response_model=PlanOut)
def update_plan(
    plan_id: int,
    body: PlanUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Actualizar un plan existente (MEGAADMIN)"""
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    update_data = body.model_dump(exclude_none=True)

    # Si se marca como default, quitar default de los demás
    if update_data.get("is_default"):
        db.query(Plan).filter(Plan.is_default == True, Plan.id != plan_id).update({"is_default": False})

    for field, value in update_data.items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
def deactivate_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Desactivar un plan (soft delete) (MEGAADMIN)"""
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    plan.is_active = False
    db.commit()
    return {"detail": "Plan desactivado", "id": plan_id}


@router.post("/subscribe", response_model=SubscriptionOut, status_code=201)
def subscribe_company(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Asignar un plan a una empresa (MEGAADMIN)"""
    company = db.query(Company).filter(Company.id == body.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    plan = db.query(Plan).filter(Plan.id == body.plan_id, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado o inactivo")

    # Cancelar suscripciones activas anteriores
    db.query(CompanySubscription).filter(
        CompanySubscription.company_id == body.company_id,
        CompanySubscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]),
    ).update({"status": SubscriptionStatus.CANCELLED}, synchronize_session="fetch")

    sub = CompanySubscription(
        company_id=body.company_id,
        plan_id=body.plan_id,
        status=body.status,
        expires_at=body.expires_at,
        notes=body.notes,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.get("/subscription/{company_id}", response_model=Optional[SubscriptionOut])
def get_company_subscription(
    company_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Obtener suscripción activa de una empresa (MEGAADMIN o ADMIN de la empresa)"""
    if current_user.role != UserRole.MEGAADMIN:
        if current_user.company_id != company_id:
            raise HTTPException(status_code=403, detail="No tenés acceso a esta empresa")
        if current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
            raise HTTPException(status_code=403, detail="Solo administradores pueden ver la suscripción")

    sub = (
        db.query(CompanySubscription)
        .filter(
            CompanySubscription.company_id == company_id,
            CompanySubscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]),
        )
        .order_by(CompanySubscription.created_at.desc())
        .first()
    )
    if not sub:
        return None
    return sub


@router.patch("/subscription/{subscription_id}", response_model=SubscriptionOut)
def update_subscription(
    subscription_id: int,
    body: SubscriptionUpdateBody,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Actualizar estado de suscripción (MEGAADMIN)"""
    sub = db.query(CompanySubscription).filter(CompanySubscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada")

    update_data = body.model_dump(exclude_none=True)

    if "plan_id" in update_data:
        plan = db.query(Plan).filter(Plan.id == update_data["plan_id"], Plan.is_active == True).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan no encontrado o inactivo")

    for field, value in update_data.items():
        setattr(sub, field, value)

    db.commit()
    db.refresh(sub)
    return sub


# ── Gestión de licencias / seriales ──────────────────────────────────────────

class LicenseOut(BaseModel):
    sub_id: int
    company_id: int
    company_name: str
    serial_number: Optional[str] = None
    status: SubscriptionStatus
    plan_name: Optional[str] = None
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("/licenses", response_model=list[LicenseOut])
def list_all_licenses(
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Lista todas las suscripciones con serial (MEGAADMIN)."""
    subs = (
        db.query(CompanySubscription)
        .order_by(CompanySubscription.company_id, CompanySubscription.created_at.desc())
        .all()
    )
    result = []
    seen_companies = set()
    for s in subs:
        # Solo la más reciente por empresa
        if s.company_id in seen_companies:
            continue
        seen_companies.add(s.company_id)
        company = db.query(Company).filter(Company.id == s.company_id).first()
        plan = db.query(Plan).filter(Plan.id == s.plan_id).first()
        result.append(LicenseOut(
            sub_id=s.id,
            company_id=s.company_id,
            company_name=company.name if company else f"Empresa #{s.company_id}",
            serial_number=s.serial_number,
            status=s.status,
            plan_name=plan.name if plan else None,
            started_at=s.started_at,
            expires_at=s.expires_at,
            notes=s.notes,
            updated_at=s.updated_at,
        ))
    return result


@router.patch("/licenses/{subscription_id}/status")
def set_license_status(
    subscription_id: int,
    body: SubscriptionUpdateBody,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """
    Cambia el estado de una suscripción (MEGAADMIN).
    Úsalo para suspender, reactivar o cancelar una licencia.
    """
    sub = db.query(CompanySubscription).filter(CompanySubscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(404, "Suscripción no encontrada")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(sub, field, value)

    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": sub.status, "serial_number": sub.serial_number}


@router.post("/licenses/{subscription_id}/regenerate-serial")
def regenerate_serial(
    subscription_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Regenera el número de serie de una suscripción (MEGAADMIN)."""
    sub = db.query(CompanySubscription).filter(CompanySubscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(404, "Suscripción no encontrada")

    sub.serial_number = _gen_serial()
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "serial_number": sub.serial_number}

