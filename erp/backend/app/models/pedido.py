"""
Modelo PurchaseOrder (Pedido a Proveedor)
"""

import enum
from sqlalchemy import String, ForeignKey, Numeric, Text, Date, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from app.db.base import Base, TimestampMixin


class PedidoStatus(str, enum.Enum):
    BORRADOR = "BORRADOR"
    ENVIADO = "ENVIADO"
    RECIBIDO_PARCIAL = "RECIBIDO_PARCIAL"
    RECIBIDO = "RECIBIDO"
    ANULADO = "ANULADO"


class Pedido(Base, TimestampMixin):
    """Nota de pedido a proveedor"""
    __tablename__ = "pedidos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(50), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[PedidoStatus] = mapped_column(
        Enum(PedidoStatus, name="pedido_status"),
        default=PedidoStatus.BORRADOR,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)
    total: Mapped[float | None] = mapped_column(Numeric(14, 2))
    excel_file: Mapped[str | None] = mapped_column(String(500))

    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    provider = relationship("Provider", lazy="selectin")
    created_by = relationship("User", lazy="selectin")
    items = relationship("PedidoItem", back_populates="pedido", lazy="selectin", cascade="all, delete-orphan")


class PedidoItem(Base, TimestampMixin):
    """Línea de detalle de un pedido"""
    __tablename__ = "pedido_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    received_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))

    pedido = relationship("Pedido", back_populates="items")
    variant = relationship("ProductVariant", lazy="selectin")
