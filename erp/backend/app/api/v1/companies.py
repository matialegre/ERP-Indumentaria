"""
Router Companies — gestión de empresas (solo SUPERADMIN)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.company import Company
from app.models.user import UserRole
from app.api.deps import require_roles, get_current_user

router = APIRouter(prefix="/companies", tags=["Companies"])


class CompanyOut(BaseModel):
    id: int
    name: str
    cuit: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyCreate(BaseModel):
    name: str
    cuit: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    cuit: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/me", response_model=CompanyOut)
def get_my_company(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.company_id:
        raise HTTPException(status_code=404, detail="No tenés empresa asignada")
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.put("/me", response_model=CompanyOut)
def update_my_company(
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    if not current_user.company_id:
        raise HTTPException(status_code=404, detail="No tenés empresa asignada")
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if body.cuit and body.cuit != company.cuit:
        if db.query(Company).filter(Company.cuit == body.cuit, Company.id != company.id).first():
            raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CUIT")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.get("")
def list_companies(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.SUPERADMIN)),
):
    q = db.query(Company)
    if search:
        q = q.filter(Company.name.ilike(f"%{search}%") | Company.cuit.ilike(f"%{search}%"))
    q = q.order_by(Company.name)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(
    body: CompanyCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.SUPERADMIN)),
):
    if db.query(Company).filter(Company.cuit == body.cuit).first():
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CUIT")
    company = Company(**body.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.SUPERADMIN)),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.SUPERADMIN)),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if body.cuit and body.cuit != company.cuit:
        if db.query(Company).filter(Company.cuit == body.cuit).first():
            raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CUIT")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.SUPERADMIN)),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    # Soft delete
    company.is_active = False
    db.commit()
