"""
Router para Listas de Precios — archivos y artículos
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.price_list import PriceListFile, PriceListItem
from app.models.provider import Provider
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class PriceListFileOut(BaseModel):
    id: int
    filename: str
    stored_filename: str
    upload_date: datetime.date
    provider_id: int | None = None
    provider_name: str | None = None
    season: str | None = None
    version: str | None = None
    notes: str | None = None
    item_count: int
    company_id: int
    created_by_id: int
    model_config = {"from_attributes": True}


class PriceListFileCreate(BaseModel):
    filename: str
    stored_filename: str
    upload_date: datetime.date
    provider_id: int | None = None
    season: str | None = None
    version: str | None = None
    notes: str | None = None


class PriceListItemOut(BaseModel):
    id: int
    price_list_file_id: int
    code: str | None = None
    description: str | None = None
    brand: str | None = None
    category: str | None = None
    size: str | None = None
    color: str | None = None
    price: float | None = None
    cost: float | None = None
    currency: str
    model_config = {"from_attributes": True}


class PriceListItemCreate(BaseModel):
    code: str | None = None
    description: str | None = None
    brand: str | None = None
    category: str | None = None
    size: str | None = None
    color: str | None = None
    price: float | None = None
    cost: float | None = None
    currency: str = "ARS"


class PriceListSearch(BaseModel):
    query: str
    provider_id: int | None = None
    price_list_file_id: int | None = None


router = APIRouter(prefix="/price-lists", tags=["Listas de Precios"])


# ── Helpers ────────────────────────────────────────────

def _serialize_file(f: PriceListFile) -> dict:
    return {
        "id": f.id,
        "filename": f.filename,
        "stored_filename": f.stored_filename,
        "upload_date": f.upload_date,
        "provider_id": f.provider_id,
        "provider_name": f.provider.name if f.provider else None,
        "season": f.season,
        "version": f.version,
        "notes": f.notes,
        "item_count": f.item_count,
        "company_id": f.company_id,
        "created_by_id": f.created_by_id,
    }


def _apply_company_filter(q, model, current_user: User):
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(model.company_id == current_user.company_id)
    return q


# ── Price List Files ───────────────────────────────────

@router.get("/")
def list_price_list_files(
    provider_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(PriceListFile)
    q = _apply_company_filter(q, PriceListFile, current_user)
    if provider_id:
        q = q.filter(PriceListFile.provider_id == provider_id)
    q = q.order_by(PriceListFile.upload_date.desc(), PriceListFile.id.desc())
    return [_serialize_file(f) for f in q.all()]


@router.get("/{file_id}")
def get_price_list_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    f = db.query(PriceListFile).filter(PriceListFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")
    return _serialize_file(f)


@router.post("/", status_code=201)
def create_price_list_file(
    body: PriceListFileCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    f = PriceListFile(
        **body.model_dump(),
        item_count=0,
        company_id=company_id,
        created_by_id=current_user.id,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return _serialize_file(f)


@router.delete("/{file_id}", status_code=204)
def delete_price_list_file(
    file_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    f = db.query(PriceListFile).filter(PriceListFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")
    # Cascade delete of items handled by DB relationship or explicit delete
    db.query(PriceListItem).filter(PriceListItem.price_list_file_id == file_id).delete()
    db.delete(f)
    db.commit()


# ── Price List Items ───────────────────────────────────

@router.get("/{file_id}/items")
def list_price_list_items(
    file_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    f = db.query(PriceListFile).filter(PriceListFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")

    q = db.query(PriceListItem).filter(PriceListItem.price_list_file_id == file_id)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {
        "items": [PriceListItemOut.model_validate(i) for i in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/{file_id}/items/bulk", status_code=201)
def bulk_insert_items(
    file_id: int,
    body: list[PriceListItemCreate],
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS
    )),
    db: Session = Depends(get_db),
):
    f = db.query(PriceListFile).filter(PriceListFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")

    new_items = [
        PriceListItem(price_list_file_id=file_id, **item.model_dump())
        for item in body
    ]
    db.bulk_save_objects(new_items)
    db.flush()

    # Update item_count
    total = db.query(PriceListItem).filter(PriceListItem.price_list_file_id == file_id).count()
    f.item_count = total
    db.commit()
    return {"inserted": len(new_items), "item_count": total}


# ── Search ─────────────────────────────────────────────

@router.post("/search")
def search_price_list_items(
    body: PriceListSearch,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(PriceListItem).join(
        PriceListFile, PriceListItem.price_list_file_id == PriceListFile.id
    )
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(PriceListFile.company_id == current_user.company_id)

    pattern = f"%{body.query}%"
    q = q.filter(
        or_(
            PriceListItem.code.ilike(pattern),
            PriceListItem.description.ilike(pattern),
        )
    )

    if body.provider_id:
        q = q.filter(PriceListFile.provider_id == body.provider_id)
    if body.price_list_file_id:
        q = q.filter(PriceListItem.price_list_file_id == body.price_list_file_id)

    items = q.limit(limit).all()
    return [PriceListItemOut.model_validate(i) for i in items]
