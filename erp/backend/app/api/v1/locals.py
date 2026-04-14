"""
Router CRUD de Locales
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.models.local import Local
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


class LocalOut(BaseModel):
    id: int
    name: str
    code: str
    address: str | None = None
    phone: str | None = None
    is_active: bool
    company_id: int
    model_config = {"from_attributes": True}


class LocalCreate(BaseModel):
    name: str
    code: str
    address: str | None = None
    phone: str | None = None


router = APIRouter(prefix="/locals", tags=["Locales"])


@router.get("/")
def list_locals(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Local)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(Local.company_id == current_user.company_id)
    if search:
        q = q.filter(
            (Local.name.ilike(f"%{search}%")) | (Local.code.ilike(f"%{search}%"))
        )
    q = q.order_by(Local.name)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("/", response_model=LocalOut, status_code=201)
def create_local(
    body: LocalCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    if db.query(Local).filter(Local.code == body.code).first():
        raise HTTPException(status_code=409, detail="El código ya existe")
    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")
    local = Local(**body.model_dump(), company_id=company_id, is_active=True)
    db.add(local)
    db.commit()
    db.refresh(local)
    return local


@router.put("/{local_id}", response_model=LocalOut)
def update_local(
    local_id: int,
    body: LocalCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    local = db.query(Local).filter(Local.id == local_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")
    existing = db.query(Local).filter(Local.code == body.code, Local.id != local_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Código ya existe")
    for key, val in body.model_dump().items():
        setattr(local, key, val)
    db.commit()
    db.refresh(local)
    return local


@router.delete("/{local_id}", status_code=204)
def delete_local(
    local_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    local = db.query(Local).filter(Local.id == local_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")
    db.delete(local)
    db.commit()
