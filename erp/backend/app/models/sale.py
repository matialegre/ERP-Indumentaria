"""
Modelo Sale (Facturación / Ventas)
"""

import enum
from sqlalchemy import String, ForeignKey, Numeric, Text, Date, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from app.db.base import Base, TimestampMixin


class SaleType(str, enum.Enum):
    FACTURA_A = "FACTURA_A"
    FACTURA_B = "FACTURA_B"
    TICKET = "TICKET"
    NOTA_CREDITO = "NOTA_CREDITO"


class SaleStatus(str, enum.Enum):
    BORRADOR = "BORRADOR"
    EMITIDA = "EMITIDA"
    PAGADA = "PAGADA"
    ANULADA = "ANULADA"


class Sale(Base, TimestampMixin):
    """Comprobante de venta"""
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[SaleType] = mapped_column(
        Enum(SaleType, name="sale_type"), nullable=False
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[SaleStatus] = mapped_column(
        Enum(SaleStatus, name="sale_status"),
        default=SaleStatus.BORRADOR,
        nullable=False,
    )
    customer_name: Mapped[str | None] = mapped_column(String(200))
    customer_cuit: Mapped[str | None] = mapped_column(String(13))
    notes: Mapped[str | None] = mapped_column(Text)
    subtotal: Mapped[float | None] = mapped_column(Numeric(14, 2))
    tax: Mapped[float | None] = mapped_column(Numeric(14, 2))
    total: Mapped[float | None] = mapped_column(Numeric(14, 2))

    local_id: Mapped[int | None] = mapped_column(ForeignKey("locals.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    local = relationship("Local", lazy="selectin")
    created_by = relationship("User", lazy="selectin")
    items = relationship("SaleItem", back_populates="sale", lazy="selectin", cascade="all, delete-orphan")


class SaleItem(Base, TimestampMixin):
    """Línea de detalle de una venta"""
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)

    sale = relationship("Sale", back_populates="items")
    variant = relationship("ProductVariant", lazy="selectin")
