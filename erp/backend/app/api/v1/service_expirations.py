from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime, timezone
import os
import base64
import uuid

from app.db.session import get_db
from app.models.service_expiration import ServiceExpiration
from app.api.deps import get_current_user, require_roles
from app.models.user import User, UserRole

router = APIRouter(prefix="/service-expirations", tags=["service-expirations"])

VENCIMIENTOS_IMAGES_DIR = r"D:\ERP MUNDO OUTDOOR\erp\vencimientos_images"
os.makedirs(VENCIMIENTOS_IMAGES_DIR, exist_ok=True)


def _save_base64_image(data_url: str, record_id: int, index: int) -> str:
    try:
        header, b64data = data_url.split(",", 1)
        ext = "png"
        if "image/jpeg" in header:
            ext = "jpg"
        elif "image/webp" in header:
            ext = "webp"
        filename = f"venc_{record_id}_{index}_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(VENCIMIENTOS_IMAGES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(b64data))
        return f"/vencimientos-img/{filename}"
    except Exception:
        return data_url


def _process_images(images: List[str], record_id: int) -> List[str]:
    result = []
    for i, img in enumerate(images):
        if img.startswith("data:image/"):
            result.append(_save_base64_image(img, record_id, i))
        else:
            result.append(img)
    return result


class ExpirationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    due_date: date
    amount: Optional[float] = None
    images: List[str] = []


class ExpirationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    amount: Optional[float] = None
    images: Optional[List[str]] = None


class ExpirationOut(BaseModel):
    id: int
    company_id: int
    name: str
    description: Optional[str] = None
    due_date: date
    amount: Optional[float] = None
    images: List[str] = []
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[ExpirationOut])
def list_expirations(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ServiceExpiration)
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN):
        q = q.filter(ServiceExpiration.company_id == current_user.company_id)
    if year:
        from sqlalchemy import extract
        q = q.filter(extract("year", ServiceExpiration.due_date) == year)
    if month:
        from sqlalchemy import extract
        q = q.filter(extract("month", ServiceExpiration.due_date) == month)
    return q.order_by(ServiceExpiration.due_date.asc()).all()


@router.post("/", response_model=ExpirationOut)
def create_expiration(
    body: ExpirationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION
    )),
):
    record = ServiceExpiration(
        company_id=current_user.company_id,
        name=body.name,
        description=body.description,
        due_date=body.due_date,
        amount=body.amount,
        images=[],
        created_by_id=current_user.id,
    )
    db.add(record)
    db.flush()
    record.images = _process_images(body.images, record.id)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{expiration_id}", response_model=ExpirationOut)
def update_expiration(
    expiration_id: int,
    body: ExpirationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION
    )),
):
    record = db.query(ServiceExpiration).filter(ServiceExpiration.id == expiration_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Vencimiento no encontrado")
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN):
        if record.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Sin acceso")

    if body.name is not None:
        record.name = body.name
    if body.description is not None:
        record.description = body.description
    if body.due_date is not None:
        record.due_date = body.due_date
    if body.amount is not None:
        record.amount = body.amount
    if body.images is not None:
        record.images = _process_images(body.images, record.id)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{expiration_id}")
def delete_expiration(
    expiration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION
    )),
):
    record = db.query(ServiceExpiration).filter(ServiceExpiration.id == expiration_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Vencimiento no encontrado")
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN):
        if record.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Sin acceso")
    db.delete(record)
    db.commit()
    return {"ok": True}
