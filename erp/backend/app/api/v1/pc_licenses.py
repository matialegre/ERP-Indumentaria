"""
Licencias por PC — validación pública y CRUD para ADMIN/SUPERADMIN
"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
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


# ══════════════════════════════════════════════════════════════════════════════
# SOLICITUDES DE LICENCIA — para PCs sin serial que piden al admin
# ══════════════════════════════════════════════════════════════════════════════

class LicenseRequestCreate(BaseModel):
    machine_id: str
    hostname: str = ""
    os_info: str = ""


class LicenseRequestOut(BaseModel):
    id: int
    machine_id: str
    hostname: Optional[str] = None
    os_info: Optional[str] = None
    status: str
    approved_key: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class ApproveRequest(BaseModel):
    local_id: int
    description: str = ""
    note: str = ""


@router.post("/request", status_code=201)
def request_license(
    body: LicenseRequestCreate,
    db: Session = Depends(get_db),
):
    """
    Endpoint público — una PC sin licencia solicita una al administrador.
    Crea o actualiza la solicitud con machine_id + hostname.
    """
    machine_id = body.machine_id.strip()
    if not machine_id or len(machine_id) < 8:
        raise HTTPException(400, "machine_id inválido")

    # Check if already has an approved request → return the key
    row = db.execute(text(
        "SELECT id, status, approved_key FROM license_requests WHERE machine_id = :m"
    ), {"m": machine_id}).fetchone()

    if row:
        if row.status == "approved" and row.approved_key:
            return {"status": "approved", "key": row.approved_key, "message": "Ya aprobado"}
        if row.status == "rejected":
            return {"status": "rejected", "message": "Solicitud rechazada por el administrador"}
        # pending — update hostname/os
        db.execute(text("""
            UPDATE license_requests
            SET hostname=:h, os_info=:o, updated_at=NOW()
            WHERE machine_id=:m
        """), {"h": body.hostname, "o": body.os_info, "m": machine_id})
        db.commit()
        return {"status": "pending", "message": "Solicitud ya existente — el administrador verá tu pedido"}

    # New request
    db.execute(text("""
        INSERT INTO license_requests (machine_id, hostname, os_info, status, company_id)
        VALUES (:m, :h, :o, 'pending', 3)
    """), {"m": machine_id, "h": body.hostname, "o": body.os_info})
    db.commit()
    return {"status": "pending", "message": "Solicitud enviada. El administrador recibirá tu pedido y te asignará una licencia."}


@router.get("/poll/{machine_id}")
def poll_license(machine_id: str, db: Session = Depends(get_db)):
    """
    Polling público — PC consulta si su solicitud fue aprobada.
    Devuelve la clave cuando el admin aprueba.
    """
    row = db.execute(text(
        "SELECT status, approved_key, note FROM license_requests WHERE machine_id = :m"
    ), {"m": machine_id}).fetchone()

    if not row:
        return {"status": "not_found"}
    if row.status == "approved" and row.approved_key:
        return {"status": "approved", "key": row.approved_key}
    if row.status == "rejected":
        return {"status": "rejected", "message": row.note or "Rechazado por el administrador"}
    return {"status": "pending"}


@router.get("/requests")
def list_license_requests(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Lista solicitudes de licencia (para el panel de admin)."""
    q = "SELECT id, machine_id, hostname, os_info, status, approved_key, note, created_at, updated_at FROM license_requests"
    params: dict = {}
    if status_filter:
        q += " WHERE status = :s"
        params["s"] = status_filter
    q += " ORDER BY created_at DESC LIMIT 200"
    rows = db.execute(text(q), params).fetchall()
    return [{
        "id": r.id,
        "machine_id": r.machine_id,
        "hostname": r.hostname,
        "os_info": r.os_info,
        "status": r.status,
        "approved_key": r.approved_key,
        "note": r.note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    } for r in rows]


@router.post("/requests/{req_id}/approve", response_model=PCLicenseOut, status_code=201)
def approve_license_request(
    req_id: int,
    body: ApproveRequest,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """
    El admin aprueba una solicitud:
    - Crea una PCLicense nueva pre-vinculada al machine_id
    - Actualiza la solicitud con la clave generada
    """
    row = db.execute(text(
        "SELECT id, machine_id, hostname FROM license_requests WHERE id = :i"
    ), {"i": req_id}).fetchone()
    if not row:
        raise HTTPException(404, "Solicitud no encontrada")

    # Validate local
    local = db.query(Local).filter(Local.id == body.local_id).first()
    if not local:
        raise HTTPException(404, "Local no encontrado")
    company_id = current_user.company_id or local.company_id

    # Generate a unique key
    key = "PC-" + "-".join(secrets.token_hex(3).upper() for _ in range(4))

    # Create license pre-bound to machine_id
    lic = PCLicense(
        key=key,
        description=body.description or f"PC: {row.hostname or row.machine_id[:12]}",
        local_id=body.local_id,
        company_id=company_id,
        machine_id=row.machine_id,
        activated_at=datetime.utcnow(),
    )
    db.add(lic)

    # Update request
    db.execute(text("""
        UPDATE license_requests
        SET status='approved', approved_key=:k, note=:n, updated_at=NOW()
        WHERE id=:i
    """), {"k": key, "n": body.note, "i": req_id})

    db.commit()
    db.refresh(lic)
    return lic


@router.post("/requests/{req_id}/reject", status_code=200)
def reject_license_request(
    req_id: int,
    note: str = "",
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """El admin rechaza una solicitud."""
    db.execute(text("""
        UPDATE license_requests SET status='rejected', note=:n, updated_at=NOW()
        WHERE id=:i
    """), {"n": note, "i": req_id})
    db.commit()
    return {"ok": True}

