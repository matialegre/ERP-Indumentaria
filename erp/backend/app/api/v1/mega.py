"""
Router Mega — gestión global de la plataforma (solo MEGAADMIN)
"""

import os
import base64

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.company import Company, IndustryType
from app.models.user import User, UserRole
from app.models.local import Local
from app.models.module import CompanyModule, MODULES_CATALOG
from app.api.deps import require_mega_admin


def _ensure_modules_seeded(db: Session, company_id: int):
    existing = {m.module_slug for m in db.query(CompanyModule).filter_by(company_id=company_id).all()}
    added = False
    for mod in MODULES_CATALOG:
        if mod["slug"] not in existing:
            db.add(CompanyModule(company_id=company_id, module_slug=mod["slug"], is_active=False))
            added = True
    if added:
        db.commit()
from app.core.security import hash_password, create_access_token

router = APIRouter(prefix="/mega", tags=["Mega Admin"])


# ── Schemas ──────────────────────────────────────────────────


class CompanyListItem(BaseModel):
    id: int
    name: str
    cuit: str
    industry_type: Optional[IndustryType] = None
    is_active: bool
    user_count: int = 0
    local_count: int = 0
    module_count: int = 0
    app_name: Optional[str] = None
    primary_color: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: UserRole
    is_active: bool
    modules_override: Optional[list] = None

    model_config = {"from_attributes": True}


class LocalBrief(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool

    model_config = {"from_attributes": True}


class ModuleBrief(BaseModel):
    id: int
    module_slug: str
    is_active: bool
    custom_name: Optional[str] = None

    model_config = {"from_attributes": True}


class CompanyDetail(BaseModel):
    id: int
    name: str
    cuit: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    app_name: Optional[str] = None
    short_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    favicon_url: Optional[str] = None
    industry_type: Optional[IndustryType] = None
    welcome_message: Optional[str] = None
    icon_data: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    users: list[UserBrief] = []
    modules: list[ModuleBrief] = []
    locals: list[LocalBrief] = []

    model_config = {"from_attributes": True}


class AdminUserInput(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None


class CompanyCreateFull(BaseModel):
    name: str
    cuit: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    app_name: Optional[str] = None
    short_name: Optional[str] = None
    primary_color: Optional[str] = "#1e40af"
    secondary_color: Optional[str] = "#3b82f6"
    favicon_url: Optional[str] = None
    industry_type: Optional[IndustryType] = None
    welcome_message: Optional[str] = None
    module_slugs: list[str] = []
    admin_user: AdminUserInput


class CompanyUpdateBody(BaseModel):
    name: Optional[str] = None
    cuit: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    app_name: Optional[str] = None
    short_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    favicon_url: Optional[str] = None
    industry_type: Optional[IndustryType] = None
    welcome_message: Optional[str] = None


class ModulesUpdateBody(BaseModel):
    module_slugs: list[str]


class ImpersonateOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    company_id: Optional[int] = None


class CompanyStats(BaseModel):
    id: int
    name: str
    is_active: bool
    user_count: int = 0
    local_count: int = 0
    module_count: int = 0

    model_config = {"from_attributes": True}


class PlatformStats(BaseModel):
    total_companies: int
    total_users: int
    total_active_companies: int
    companies: list[CompanyStats] = []


# ── Helpers ──────────────────────────────────────────────────


def _company_or_404(db: Session, company_id: int) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


# ── Endpoints ────────────────────────────────────────────────


@router.get("/stats", response_model=PlatformStats)
def get_platform_stats(
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    companies = db.query(Company).all()
    total_users = db.query(func.count(User.id)).scalar() or 0

    stats_list = []
    for c in companies:
        user_count = db.query(func.count(User.id)).filter(User.company_id == c.id).scalar() or 0
        local_count = db.query(func.count(Local.id)).filter(Local.company_id == c.id).scalar() or 0
        module_count = (
            db.query(func.count(CompanyModule.id))
            .filter(CompanyModule.company_id == c.id, CompanyModule.is_active == True)
            .scalar() or 0
        )
        stats_list.append(CompanyStats(
            id=c.id, name=c.name, is_active=c.is_active,
            user_count=user_count, local_count=local_count, module_count=module_count,
        ))

    return PlatformStats(
        total_companies=len(companies),
        total_users=total_users,
        total_active_companies=sum(1 for c in companies if c.is_active),
        companies=stats_list,
    )


@router.get("/companies", response_model=list[CompanyListItem])
def list_all_companies(
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    companies = db.query(Company).order_by(Company.name).all()
    result = []
    for c in companies:
        user_count = db.query(func.count(User.id)).filter(User.company_id == c.id).scalar() or 0
        local_count = db.query(func.count(Local.id)).filter(Local.company_id == c.id).scalar() or 0
        module_count = (
            db.query(func.count(CompanyModule.id))
            .filter(CompanyModule.company_id == c.id, CompanyModule.is_active == True)
            .scalar() or 0
        )
        result.append(CompanyListItem(
            id=c.id, name=c.name, cuit=c.cuit,
            industry_type=c.industry_type, is_active=c.is_active,
            user_count=user_count, local_count=local_count, module_count=module_count,
            app_name=c.app_name, primary_color=c.primary_color,
            created_at=c.created_at,
        ))
    return result


@router.get("/companies/{company_id}", response_model=CompanyDetail)
def get_company_detail(
    company_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    company = _company_or_404(db, company_id)
    _ensure_modules_seeded(db, company_id)
    users = db.query(User).filter(User.company_id == company_id).all()
    modules = db.query(CompanyModule).filter(CompanyModule.company_id == company_id).all()
    locals_ = db.query(Local).filter(Local.company_id == company_id).all()

    return CompanyDetail(
        id=company.id, name=company.name, cuit=company.cuit,
        address=company.address, phone=company.phone, email=company.email,
        logo_url=company.logo_url, is_active=company.is_active,
        app_name=company.app_name, short_name=company.short_name,
        primary_color=company.primary_color, secondary_color=company.secondary_color,
        favicon_url=company.favicon_url, industry_type=company.industry_type,
        welcome_message=company.welcome_message, icon_data=company.icon_data,
        created_at=company.created_at, updated_at=company.updated_at,
        users=[UserBrief.model_validate(u) for u in users],
        modules=[ModuleBrief.model_validate(m) for m in modules],
        locals=[LocalBrief.model_validate(l) for l in locals_],
    )


@router.post("/companies/create-full", response_model=CompanyDetail, status_code=201)
def create_company_full(
    body: CompanyCreateFull,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    if db.query(Company).filter(Company.cuit == body.cuit).first():
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CUIT")
    if db.query(User).filter(User.username == body.admin_user.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso")

    valid_slugs = {m["slug"] for m in MODULES_CATALOG}
    invalid = set(body.module_slugs) - valid_slugs
    if invalid:
        raise HTTPException(status_code=400, detail=f"Módulos inválidos: {', '.join(invalid)}")

    company = Company(
        name=body.name, cuit=body.cuit, address=body.address,
        phone=body.phone, email=body.email, logo_url=body.logo_url,
        app_name=body.app_name, short_name=body.short_name,
        primary_color=body.primary_color, secondary_color=body.secondary_color,
        favicon_url=body.favicon_url, industry_type=body.industry_type,
        welcome_message=body.welcome_message,
    )
    db.add(company)
    db.flush()

    for slug in body.module_slugs:
        db.add(CompanyModule(company_id=company.id, module_slug=slug, is_active=True))

    admin = User(
        username=body.admin_user.username,
        hashed_password=hash_password(body.admin_user.password),
        full_name=body.admin_user.full_name,
        email=body.admin_user.email,
        role=UserRole.ADMIN,
        company_id=company.id,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(company)

    users = db.query(User).filter(User.company_id == company.id).all()
    modules = db.query(CompanyModule).filter(CompanyModule.company_id == company.id).all()
    locals_ = db.query(Local).filter(Local.company_id == company.id).all()

    return CompanyDetail(
        id=company.id, name=company.name, cuit=company.cuit,
        address=company.address, phone=company.phone, email=company.email,
        logo_url=company.logo_url, is_active=company.is_active,
        app_name=company.app_name, short_name=company.short_name,
        primary_color=company.primary_color, secondary_color=company.secondary_color,
        favicon_url=company.favicon_url, industry_type=company.industry_type,
        welcome_message=company.welcome_message, icon_data=company.icon_data,
        created_at=company.created_at, updated_at=company.updated_at,
        users=[UserBrief.model_validate(u) for u in users],
        modules=[ModuleBrief.model_validate(m) for m in modules],
        locals=[LocalBrief.model_validate(l) for l in locals_],
    )


@router.patch("/companies/{company_id}", response_model=CompanyDetail)
def update_company(
    company_id: int,
    body: CompanyUpdateBody,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    company = _company_or_404(db, company_id)

    if body.cuit and body.cuit != company.cuit:
        if db.query(Company).filter(Company.cuit == body.cuit, Company.id != company.id).first():
            raise HTTPException(status_code=400, detail="Ya existe una empresa con ese CUIT")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)

    db.commit()
    db.refresh(company)

    users = db.query(User).filter(User.company_id == company_id).all()
    modules = db.query(CompanyModule).filter(CompanyModule.company_id == company_id).all()
    locals_ = db.query(Local).filter(Local.company_id == company_id).all()

    return CompanyDetail(
        id=company.id, name=company.name, cuit=company.cuit,
        address=company.address, phone=company.phone, email=company.email,
        logo_url=company.logo_url, is_active=company.is_active,
        app_name=company.app_name, short_name=company.short_name,
        primary_color=company.primary_color, secondary_color=company.secondary_color,
        favicon_url=company.favicon_url, industry_type=company.industry_type,
        welcome_message=company.welcome_message, icon_data=company.icon_data,
        created_at=company.created_at, updated_at=company.updated_at,
        users=[UserBrief.model_validate(u) for u in users],
        modules=[ModuleBrief.model_validate(m) for m in modules],
        locals=[LocalBrief.model_validate(l) for l in locals_],
    )


@router.patch("/companies/{company_id}/toggle")
def toggle_company(
    company_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    company = _company_or_404(db, company_id)
    company.is_active = not company.is_active
    db.commit()
    db.refresh(company)
    return {"id": company.id, "name": company.name, "is_active": company.is_active}


@router.patch("/companies/{company_id}/modules")
def update_company_modules(
    company_id: int,
    body: ModulesUpdateBody,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    _company_or_404(db, company_id)

    valid_slugs = {m["slug"] for m in MODULES_CATALOG}
    invalid = set(body.module_slugs) - valid_slugs
    if invalid:
        raise HTTPException(status_code=400, detail=f"Módulos inválidos: {', '.join(invalid)}")

    existing = db.query(CompanyModule).filter(CompanyModule.company_id == company_id).all()
    existing_map = {m.module_slug: m for m in existing}

    # Activate requested modules, deactivate the rest
    for slug in valid_slugs:
        if slug in existing_map:
            existing_map[slug].is_active = slug in body.module_slugs
        elif slug in body.module_slugs:
            db.add(CompanyModule(company_id=company_id, module_slug=slug, is_active=True))

    db.commit()

    modules = db.query(CompanyModule).filter(CompanyModule.company_id == company_id).all()
    return {"company_id": company_id, "modules": [ModuleBrief.model_validate(m) for m in modules]}


@router.get("/users/{user_id}", response_model=UserBrief)
def get_user_mega(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserBrief.model_validate(user)


@router.patch("/users/{user_id}/modules")
def set_user_modules_mega(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    """Establece qué módulos puede ver un usuario (override). modules_override=null = sin restricción."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    modules_override = body.get("modules_override")  # None or list of slugs
    user.modules_override = modules_override
    db.commit()
    db.refresh(user)
    return UserBrief.model_validate(user)


@router.post("/impersonate/{user_id}", response_model=ImpersonateOut)
def impersonate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_mega_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    token = create_access_token(data={"sub": user.username})
    return ImpersonateOut(
        access_token=token,
        user_id=user.id,
        username=user.username,
        company_id=user.company_id,
    )


@router.get("/available-updates")
def list_available_updates(
    current_user: User = Depends(require_mega_admin),
):
    """List ZIP files available in DISTRIBUIBLES for download"""
    # mega.py → v1/ → api/ → app/ → backend/ → erp/ → ERP MUNDO OUTDOOR/
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))))
    dist_dir = os.path.join(base, "DISTRIBUIBLES")

    if not os.path.isdir(dist_dir):
        return {"files": []}

    files = []
    for f in os.listdir(dist_dir):
        if f.endswith(".zip"):
            fp = os.path.join(dist_dir, f)
            files.append({
                "filename": f,
                "size_mb": round(os.path.getsize(fp) / 1048576, 1),
                "download_url": f"/api/v1/system/download/{f}",
                "modified": os.path.getmtime(fp),
            })

    return {"files": files}


@router.post("/companies/{company_id}/icon")
async def upload_company_icon(
    company_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_mega_admin),
    db: Session = Depends(get_db),
):
    """Upload icon/logo for a company. Accepts PNG, JPG, SVG. Max 2MB."""
    company = _company_or_404(db, company_id)

    allowed_types = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"Tipo de archivo no permitido: {file.content_type}. Usar PNG, JPG o SVG.")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(400, "El archivo es demasiado grande (máx 2MB)")

    b64 = base64.b64encode(content).decode('utf-8')
    mime = file.content_type
    company.icon_data = f"data:{mime};base64,{b64}"
    db.commit()

    return {"status": "ok", "company_id": company_id, "icon_size": len(content)}


@router.delete("/companies/{company_id}/icon")
def delete_company_icon(
    company_id: int,
    current_user: User = Depends(require_mega_admin),
    db: Session = Depends(get_db),
):
    """Remove company icon"""
    company = _company_or_404(db, company_id)
    company.icon_data = None
    db.commit()
    return {"status": "ok"}
