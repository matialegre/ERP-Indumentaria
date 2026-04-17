"""
Licencias por PC — validación pública y CRUD para ADMIN/SUPERADMIN
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_db
from app.models.plan import PCLicense
from app.models.local import Local
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/pc-licenses", tags=["PC Licenses"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ValidateRequest(BaseModel):
    key: str
    machine_id: str


class ValidateResponse(BaseModel):
    valid: bool
    company_id: Optional[int] = None
    local_id: Optional[int] = None
    local_name: Optional[str] = None
    local_server_url: Optional[str] = None  # URL del servidor local LAN
    message: str


class PCLicenseOut(BaseModel):
    id: int
    key: str
    description: str
    is_active: bool
    local_id: Optional[int] = None
    company_id: int
    machine_id: Optional[str] = None
    local_server_url: Optional[str] = None
    activated_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    deactivated_reason: Optional[str] = None
    model_config = {"from_attributes": True}


class PCLicenseCreate(BaseModel):
    description: str = ""
    local_id: int
    local_server_url: Optional[str] = None


class PCLicenseUpdate(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None
    deactivated_reason: Optional[str] = None
    local_id: Optional[int] = None
    local_server_url: Optional[str] = None


# ── Validación pública (usada por Electron al arrancar) ───────────────────────

@router.post("/validate", response_model=ValidateResponse)
def validate_license(body: ValidateRequest, db: Session = Depends(get_db)):
    lic = db.query(PCLicense).filter(PCLicense.key == body.key.strip()).first()
    if not lic:
        return ValidateResponse(valid=False, message="Licencia no encontrada")
    if not lic.is_active:
        reason = lic.deactivated_reason or "Licencia desactivada por el administrador"
        return ValidateResponse(valid=False, message=reason)
    if lic.machine_id and lic.machine_id != body.machine_id:
        return ValidateResponse(
            valid=False,
            message="Licencia vinculada a otro equipo. Contactá al administrador para resetearla."
        )
    if not lic.machine_id:
        lic.machine_id = body.machine_id
        lic.activated_at = datetime.utcnow()
    lic.last_seen_at = datetime.utcnow()
    db.commit()

    local_name = lic.local.name if lic.local else None
    return ValidateResponse(
        valid=True,
        company_id=lic.company_id,
        local_id=lic.local_id,
        local_name=local_name,
        local_server_url=lic.local_server_url,
        message="OK",
    )


# ── CRUD (requiere ADMIN o superior) ─────────────────────────────────────────

@router.get("/", response_model=List[PCLicenseOut])
def list_all_licenses(
    local_id: Optional[int] = None,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    q = db.query(PCLicense)
    if current_user.company_id:
        q = q.filter(PCLicense.company_id == current_user.company_id)
    if local_id is not None:
        q = q.filter(PCLicense.local_id == local_id)
    return q.order_by(PCLicense.local_id, PCLicense.id).all()


@router.post("/", response_model=PCLicenseOut, status_code=201)
def create_license(
    body: PCLicenseCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    local = db.query(Local).filter(Local.id == body.local_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")
    if current_user.company_id and local.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Local de otra empresa")

    company_id = current_user.company_id or local.company_id
    lic = PCLicense(
        description=body.description,
        local_id=body.local_id,
        company_id=company_id,
        local_server_url=body.local_server_url,
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return lic


@router.patch("/{lic_id}", response_model=PCLicenseOut)
def update_license(
    lic_id: int,
    body: PCLicenseUpdate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    lic = db.query(PCLicense).filter(PCLicense.id == lic_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(lic, field, val)
    db.commit()
    db.refresh(lic)
    return lic


@router.post("/{lic_id}/reset-machine", response_model=PCLicenseOut)
def reset_machine_binding(
    lic_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Libera el vínculo con el equipo actual para que pueda activarse en otro."""
    lic = db.query(PCLicense).filter(PCLicense.id == lic_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    lic.machine_id = None
    lic.activated_at = None
    db.commit()
    db.refresh(lic)
    return lic


@router.delete("/{lic_id}", status_code=204)
def delete_license(
    lic_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    lic = db.query(PCLicense).filter(PCLicense.id == lic_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    db.delete(lic)
    db.commit()

