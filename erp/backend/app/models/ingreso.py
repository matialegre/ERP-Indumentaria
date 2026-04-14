"""
Modelo Ingreso — remitos y facturas de compra
"""

import enum
from sqlalchemy import String, ForeignKey, Numeric, Text, Date, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from app.db.base import Base, TimestampMixin


class IngresoStatus(str, enum.Enum):
    BORRADOR = "BORRADOR"
    CONFIRMADO = "CONFIRMADO"
    ANULADO = "ANULADO"


class IngresoType(str, enum.Enum):
    REMITO = "REMITO"
    FACTURA = "FACTURA"


class Ingreso(Base, TimestampMixin):
    """Cabecera de un ingreso de mercadería (remito o factura de compra)"""
    __tablename__ = "ingresos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[IngresoType] = mapped_column(
        Enum(IngresoType, name="ingreso_type"), nullable=False
    )
    number: Mapped[str] = mapped_column(String(50), nullable=False)  # Nro de remito/factura
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[IngresoStatus] = mapped_column(
        Enum(IngresoStatus, name="ingreso_status"),
        default=IngresoStatus.BORRADOR,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    total: Mapped[float | None] = mapped_column(Numeric(14, 2))

    # Relaciones
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    pedido_id: Mapped[int | None] = mapped_column(ForeignKey("pedidos.id"), nullable=True)

    provider = relationship("Provider", lazy="selectin")
    created_by = relationship("User", lazy="selectin")
    pedido = relationship("Pedido", backref="ingresos", lazy="selectin")
    items = relationship("IngresoItem", back_populates="ingreso", lazy="selectin", cascade="all, delete-orphan")


class IngresoItem(Base, TimestampMixin):
    """Línea de detalle de un ingreso"""
    __tablename__ = "ingreso_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ingreso_id: Mapped[int] = mapped_column(ForeignKey("ingresos.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # Relaciones
    ingreso = relationship("Ingreso", back_populates="items")
    variant = relationship("ProductVariant", lazy="selectin")
