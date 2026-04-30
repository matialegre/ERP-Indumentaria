"""
Modelo Product — artículos con variantes talle/color
"""

from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    brand: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str | None] = mapped_column(String(100))
    base_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    gender: Mapped[str | None] = mapped_column(String(50))
    season: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Multi-tenant
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Relaciones
    variants = relationship("ProductVariant", back_populates="product", lazy="selectin", cascade="all, delete-orphan")


class ProductVariant(Base, TimestampMixin):
    """Variante de producto: combinación talle + color"""
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    size: Mapped[str] = mapped_column(String(20), nullable=False)  # S, M, L, XL, 38, 40...
    color: Mapped[str] = mapped_column(String(50), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    barcode: Mapped[str | None] = mapped_column(String(50))
    stock: Mapped[int] = mapped_column(default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relaciones
    product = relationship("Product", back_populates="variants", lazy="selectin")
