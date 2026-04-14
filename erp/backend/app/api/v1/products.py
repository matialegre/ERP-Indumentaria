"""
Router CRUD de Productos y Variantes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import io

from app.db.session import get_db
from app.models.product import Product, ProductVariant
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class VariantOut(BaseModel):
    id: int
    size: str
    color: str
    sku: str
    barcode: str | None = None
    stock: int
    is_active: bool
    model_config = {"from_attributes": True}


class VariantCreate(BaseModel):
    size: str
    color: str
    sku: str
    barcode: str | None = None


class ProductOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    brand: str | None = None
    category: str | None = None
    base_cost: float | None = None
    is_active: bool
    company_id: int
    variants: list[VariantOut] = []
    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    brand: str | None = None
    category: str | None = None
    base_cost: float | None = None
    variants: list[VariantCreate] = []


class ProductUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    brand: str | None = None
    category: str | None = None
    base_cost: float | None = None


router = APIRouter(prefix="/products", tags=["Productos"])


# ── Productos ──────────────────────────────────────────

@router.get("/")
def list_products(
    search: Optional[str] = None,
    brand: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(Product.company_id == current_user.company_id)
    if search:
        q = q.filter(
            (Product.name.ilike(f"%{search}%"))
            | (Product.code.ilike(f"%{search}%"))
            | (Product.brand.ilike(f"%{search}%"))
        )
    if brand:
        q = q.filter(Product.brand.ilike(f"%{brand}%"))
    if category:
        q = q.filter(Product.category == category)
    q = q.order_by(Product.name)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.post("/", response_model=ProductOut, status_code=201)
def create_product(
    body: ProductCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")
    # Verificar código único dentro de la company
    existing = db.query(Product).filter(
        Product.code == body.code, Product.company_id == company_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe un producto con código '{body.code}'")

    variants_data = body.variants
    product_data = body.model_dump(exclude={"variants"})
    product = Product(**product_data, company_id=company_id, is_active=True)
    db.add(product)
    db.flush()

    for v in variants_data:
        variant = ProductVariant(**v.model_dump(), product_id=product.id, is_active=True)
        db.add(variant)

    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    body: ProductUpdate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    update_data = body.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(product, key, val)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.delete(product)
    db.commit()


@router.patch("/{product_id}/toggle", response_model=ProductOut)
def toggle_product(
    product_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    product.is_active = not product.is_active
    db.commit()
    db.refresh(product)
    return product


# ── Variantes ──────────────────────────────────────────

@router.post("/{product_id}/variants", response_model=VariantOut, status_code=201)
def add_variant(
    product_id: int,
    body: VariantCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    existing = db.query(ProductVariant).filter(ProductVariant.sku == body.sku).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Ya existe variante con SKU '{body.sku}'")
    variant = ProductVariant(**body.model_dump(), product_id=product_id, is_active=True)
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.put("/{product_id}/variants/{variant_id}", response_model=VariantOut)
def update_variant(
    product_id: int,
    variant_id: int,
    body: VariantCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    variant = db.query(ProductVariant).filter(
        ProductVariant.id == variant_id, ProductVariant.product_id == product_id
    ).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    for key, val in body.model_dump().items():
        setattr(variant, key, val)
    db.commit()
    db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=204)
def delete_variant(
    product_id: int,
    variant_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    variant = db.query(ProductVariant).filter(
        ProductVariant.id == variant_id, ProductVariant.product_id == product_id
    ).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    db.delete(variant)
    db.commit()


# ── Import masivo desde Excel ──────────────────────────
#
# Formato esperado del Excel:
# Columnas: codigo | nombre | descripcion | marca | categoria | precio_costo | talle | color | sku | barcode
# - Una fila por variante; si "codigo" se repite, se agrupan en el mismo producto
# - Columnas mínimas obligatorias: codigo, nombre, talle, color, sku

@router.post("/import-excel", status_code=201)
def import_products_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo debe ser .xlsx o .xls")

    try:
        import openpyxl
        content = file.file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Parse header (case-insensitive, strip whitespace)
    header = [str(h).strip().lower() if h is not None else "" for h in rows[0]]

    def col(row, name):
        if name in header:
            v = row[header.index(name)]
            return str(v).strip() if v is not None else ""
        return ""

    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="Usuario sin empresa asignada")

    created_products = 0
    created_variants = 0
    skipped_variants = 0
    errors = []

    for i, row in enumerate(rows[1:], start=2):
        codigo = col(row, "codigo")
        nombre = col(row, "nombre")
        talle = col(row, "talle")
        color = col(row, "color")
        sku = col(row, "sku")

        if not codigo or not nombre:
            errors.append(f"Fila {i}: código y nombre son obligatorios")
            continue
        if not talle or not color or not sku:
            errors.append(f"Fila {i}: talle, color y sku son obligatorios")
            continue

        # Get or create product
        product = db.query(Product).filter(
            Product.code == codigo, Product.company_id == company_id
        ).first()
        if not product:
            marca = col(row, "marca") or None
            categoria = col(row, "categoria") or None
            precio_raw = col(row, "precio_costo")
            precio = None
            if precio_raw:
                try:
                    precio = float(precio_raw.replace(",", "."))
                except ValueError:
                    pass
            product = Product(
                code=codigo, name=nombre,
                description=col(row, "descripcion") or None,
                brand=marca, category=categoria,
                base_cost=precio, company_id=company_id, is_active=True,
            )
            db.add(product)
            db.flush()
            created_products += 1

        # Add variant if SKU doesn't exist
        existing_variant = db.query(ProductVariant).filter(ProductVariant.sku == sku).first()
        if existing_variant:
            skipped_variants += 1
            continue

        barcode = col(row, "barcode") or None
        variant = ProductVariant(
            product_id=product.id, size=talle, color=color,
            sku=sku, barcode=barcode, is_active=True,
        )
        db.add(variant)
        created_variants += 1

    db.commit()

    return {
        "created_products": created_products,
        "created_variants": created_variants,
        "skipped_variants": skipped_variants,
        "errors": errors[:20],  # max 20 errors in response
        "total_rows_processed": len(rows) - 1,
    }

