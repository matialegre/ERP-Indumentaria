"""
modules.py — CRUD de módulos activables por empresa
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_roles
from app.models import CompanyModule, MODULES_CATALOG
from app.models.user import User, UserRole

router = APIRouter(prefix="/modules", tags=["modules"])


class ModuleOut(BaseModel):
    slug:        str
    nombre:      str
    descripcion: str
    rutas:       list[str]
    icono:       str
    color:       str
    is_active:   bool
    custom_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ModuleToggle(BaseModel):
    is_active:   bool
    custom_name: Optional[str] = None


def _get_company_id(user: User) -> int:
    if user.company_id is None:
        raise HTTPException(400, "Usuario sin empresa asignada")
    return user.company_id


def _ensure_modules_seeded(db: Session, company_id: int):
    """Crea las filas de company_modules si no existen (inactivas por default — Super Admin las activa)"""
    existing = {m.module_slug for m in db.query(CompanyModule).filter_by(company_id=company_id).all()}
    added = False
    for mod in MODULES_CATALOG:
        if mod["slug"] not in existing:
            db.add(CompanyModule(company_id=company_id, module_slug=mod["slug"], is_active=False))
            added = True
    if added:
        db.commit()


@router.get("", response_model=list[ModuleOut])
def list_modules(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Lista todos los módulos con su estado activo/inactivo para la empresa del usuario"""
    if user.role in (UserRole.MEGAADMIN, UserRole.SUPERADMIN) and user.company_id is None:
        # MEGAADMIN / SUPERADMIN sin empresa ve todos los módulos activos
        return [
            ModuleOut(
                slug=m["slug"], nombre=m["nombre"], descripcion=m["descripcion"],
                rutas=m["rutas"], icono=m["icono"], color=m["color"],
                is_active=True,
            )
            for m in MODULES_CATALOG
        ]

    company_id = _get_company_id(user)
    _ensure_modules_seeded(db, company_id)

    rows = {m.module_slug: m for m in db.query(CompanyModule).filter_by(company_id=company_id).all()}

    # Si el usuario tiene modules_override, filtrar solo esos slugs
    user_override: set | None = None
    if user.modules_override is not None:
        user_override = set(s.upper() for s in user.modules_override)

    result = []
    for cat in MODULES_CATALOG:
        row = rows.get(cat["slug"])
        company_active = row.is_active if row else False
        # Si hay override de usuario, el módulo solo es visible si está en su lista
        if user_override is not None and cat["slug"] not in user_override:
            continue
        result.append(ModuleOut(
            slug=cat["slug"],
            nombre=cat["nombre"],
            descripcion=cat["descripcion"],
            rutas=cat["rutas"],
            icono=cat["icono"],
            color=cat["color"],
            is_active=company_active,
            custom_name=row.custom_name if row else None,
        ))
    return result


@router.get("/catalog", response_model=list[ModuleOut])
def list_catalog(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    """Devuelve TODOS los módulos del catálogo con su estado activo/inactivo para la empresa.
    Nunca filtra por modules_override del usuario — usado por admins para configurar otros usuarios."""
    if user.company_id is None:
        return [
            ModuleOut(
                slug=m["slug"], nombre=m["nombre"], descripcion=m["descripcion"],
                rutas=m["rutas"], icono=m["icono"], color=m["color"],
                is_active=True,
            )
            for m in MODULES_CATALOG
        ]

    company_id = user.company_id
    _ensure_modules_seeded(db, company_id)
    rows = {m.module_slug: m for m in db.query(CompanyModule).filter_by(company_id=company_id).all()}

    return [
        ModuleOut(
            slug=cat["slug"],
            nombre=cat["nombre"],
            descripcion=cat["descripcion"],
            rutas=cat["rutas"],
            icono=cat["icono"],
            color=cat["color"],
            is_active=(rows[cat["slug"]].is_active if cat["slug"] in rows else False),
            custom_name=(rows[cat["slug"]].custom_name if cat["slug"] in rows else None),
        )
        for cat in MODULES_CATALOG
    ]


@router.patch("/{slug}", response_model=ModuleOut)
def toggle_module(
    slug:    str,
    payload: ModuleToggle,
    db:      Session = Depends(get_db),
    user:    User    = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    cat = next((m for m in MODULES_CATALOG if m["slug"] == slug), None)
    if not cat:
        raise HTTPException(404, f"Módulo '{slug}' no existe")

    company_id = _get_company_id(user)
    _ensure_modules_seeded(db, company_id)

    row = db.query(CompanyModule).filter_by(company_id=company_id, module_slug=slug).first()
    if not row:
        raise HTTPException(404, "Módulo no encontrado para esta empresa")

    row.is_active   = payload.is_active
    row.custom_name = payload.custom_name
    db.commit()
    db.refresh(row)

    return ModuleOut(
        slug=slug, nombre=cat["nombre"], descripcion=cat["descripcion"],
        rutas=cat["rutas"], icono=cat["icono"], color=cat["color"],
        is_active=row.is_active, custom_name=row.custom_name,
    )


@router.post("/seed")
def seed_modules(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    """Inicializa filas base de módulos para la empresa (inactivos por default)"""
    company_id = _get_company_id(user)
    _ensure_modules_seeded(db, company_id)
    return {"ok": True, "msg": f"Módulos inicializados para company {company_id}"}
