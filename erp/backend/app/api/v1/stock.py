"""
Router — Stock: consulta de inventario, movimientos, ajustes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.models.product import Product, ProductVariant
from app.models.stock_movement import StockMovement, MovementType
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.v1.export_utils import export_csv, export_xlsx


# ── Schemas ────────────────────────────────────────────

class StockItemOut(BaseModel):
    variant_id: int
    sku: str
    barcode: str | None = None
    size: str
    color: str
    stock: int
    is_active: bool
    product_id: int
    product_code: str
    product_name: str
    brand: str | None = None
    category: str | None = None
    model_config = {"from_attributes": True}


class StockAdjust(BaseModel):
    variant_id: int
    quantity: int  # positive = add, negative = subtract
    notes: str | None = None


class MovementOut(BaseModel):
    id: int
    type: str
    variant_id: int
    variant_sku: str | None = None
    product_name: str | None = None
    quantity: int
    reference: str | None = None
    notes: str | None = None
    created_by_name: str | None = None
    created_at: str
    model_config = {"from_attributes": True}


class StockSummary(BaseModel):
    total_products: int
    total_variants: int
    total_units: int
    low_stock_count: int  # variants with stock < 5
    out_of_stock_count: int


class BrandSummaryItem(BaseModel):
    brand: str
    total_variants: int


router = APIRouter(prefix="/stock", tags=["stock"])


@router.get("")
def list_stock(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    out_of_stock: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ProductVariant).join(Product)
    if user.company_id:
        q = q.filter(Product.company_id == user.company_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (Product.name.ilike(term)) |
            (Product.code.ilike(term)) |
            (ProductVariant.sku.ilike(term))
        )
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    if brand:
        q = q.filter(Product.brand.ilike(f"%{brand}%"))
    if low_stock:
        q = q.filter(ProductVariant.stock < 5, ProductVariant.stock > 0)
    if out_of_stock:
        q = q.filter(ProductVariant.stock <= 0)
    q = q.order_by(Product.name, ProductVariant.size)
    total = q.count()
    variants = q.offset(skip).limit(limit).all()
    items = [
        StockItemOut(
            variant_id=v.id,
            sku=v.sku,
            barcode=v.barcode,
            size=v.size,
            color=v.color,
            stock=v.stock,
            is_active=v.is_active,
            product_id=v.product.id,
            product_code=v.product.code,
            product_name=v.product.name,
            brand=v.product.brand,
            category=v.product.category,
        )
        for v in variants
    ]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/export")
def export_stock(
    format: str = Query("xlsx", pattern="^(csv|xlsx)$"),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export stock as CSV or XLSX."""
    q = db.query(ProductVariant).join(Product)
    if current_user.company_id:
        q = q.filter(Product.company_id == current_user.company_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (Product.name.ilike(term)) |
            (Product.code.ilike(term)) |
            (ProductVariant.sku.ilike(term))
        )
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    if brand:
        q = q.filter(Product.brand.ilike(f"%{brand}%"))
    q = q.order_by(Product.name, ProductVariant.size)
    variants = q.all()

    data = []
    for v in variants:
        data.append({
            "producto": v.product.name if v.product else "",
            "codigo": v.product.code if v.product else "",
            "sku": v.sku or "",
            "talle": v.size or "",
            "color": v.color or "",
            "marca": v.product.brand if v.product else "",
            "stock": v.stock,
            "estado": "Activo" if v.is_active else "Inactivo",
        })

    columns = ["producto", "codigo", "sku", "talle", "color", "marca", "stock", "estado"]
    headers = ["Producto", "Código", "SKU", "Talle", "Color", "Marca", "Stock", "Estado"]

    if format == "csv":
        return export_csv(data, "stock", columns)
    return export_xlsx(data, "stock", columns, headers)


@router.get("/summary", response_model=StockSummary)
def stock_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = db.query(ProductVariant).join(Product)
    if user.company_id:
        base = base.filter(Product.company_id == user.company_id)

    total_variants = base.count()
    total_products = db.query(func.count(func.distinct(Product.id))).select_from(ProductVariant).join(Product)
    if user.company_id:
        total_products = total_products.filter(Product.company_id == user.company_id)
    total_products = total_products.scalar() or 0

    total_units = base.with_entities(func.coalesce(func.sum(ProductVariant.stock), 0)).scalar()
    low_stock = base.filter(ProductVariant.stock < 5, ProductVariant.stock > 0).count()
    out_of_stock = base.filter(ProductVariant.stock <= 0).count()

    return StockSummary(
        total_products=total_products,
        total_variants=total_variants,
        total_units=total_units,
        low_stock_count=low_stock,
        out_of_stock_count=out_of_stock,
    )


@router.get("/brands-summary")
def stock_brands_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        db.query(Product.brand, func.count(ProductVariant.id).label("total_variants"))
        .join(ProductVariant, Product.id == ProductVariant.product_id)
    )
    if user.company_id:
        q = q.filter(Product.company_id == user.company_id)
    rows = q.group_by(Product.brand).order_by(Product.brand).all()
    return [
        BrandSummaryItem(brand=row.brand or "Sin marca", total_variants=row.total_variants)
        for row in rows
    ]


@router.post("/adjust")
def adjust_stock(
    data: StockAdjust,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPOSITO)),
):
    variant = db.query(ProductVariant).get(data.variant_id)
    if not variant:
        raise HTTPException(404, "Variante no encontrada")

    product = db.query(Product).get(variant.product_id)
    if user.company_id and product.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")

    new_stock = variant.stock + data.quantity
    if new_stock < 0:
        raise HTTPException(400, f"Stock resultante negativo ({new_stock})")

    variant.stock = new_stock

    mov = StockMovement(
        type=MovementType.AJUSTE,
        variant_id=variant.id,
        quantity=data.quantity,
        reference=f"Ajuste manual",
        notes=data.notes,
        company_id=product.company_id,
        created_by_id=user.id,
    )
    db.add(mov)
    db.commit()
    return {"ok": True, "new_stock": new_stock}


@router.get("/movements")
def list_movements(
    variant_id: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(StockMovement)
    if user.company_id:
        q = q.filter(StockMovement.company_id == user.company_id)
    if variant_id:
        q = q.filter(StockMovement.variant_id == variant_id)
    if type:
        q = q.filter(StockMovement.type == type)
    q = q.order_by(StockMovement.created_at.desc())
    total = q.count()
    movements = q.offset(skip).limit(limit).all()
    items = [
        MovementOut(
            id=m.id,
            type=m.type.value,
            variant_id=m.variant_id,
            variant_sku=m.variant.sku if m.variant else None,
            product_name=m.variant.product.name if m.variant and m.variant.product else None,
            quantity=m.quantity,
            reference=m.reference,
            notes=m.notes,
            created_by_name=m.created_by.full_name if m.created_by else None,
            created_at=m.created_at.isoformat(),
        )
        for m in movements
    ]
    return {"items": items, "total": total, "skip": skip, "limit": limit}
