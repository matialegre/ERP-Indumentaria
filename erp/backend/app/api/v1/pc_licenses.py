"""
Licencias por PC — validación pública y CRUD para MEGAADMIN
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.plan import PCLicense

router = APIRouter(prefix="/pc-licenses", tags=["PC Licenses"])


class ValidateRequest(BaseModel):
    key: str
    machine_id: str


class ValidateResponse(BaseModel):
    valid: bool
    company_id: Optional[int] = None
    message: str


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
    return ValidateResponse(valid=True, company_id=lic.company_id, message="OK")
