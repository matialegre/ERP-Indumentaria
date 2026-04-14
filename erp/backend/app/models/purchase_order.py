"""
Notas de Pedido — órdenes de compra a proveedores.
Workflow: BORRADOR → ENVIADO → RECIBIDO → COMPLETADO | ANULADO
"""

from __future__ import annotations

import enum
from datetime import date
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import String, ForeignKey, Numeric, Text, Date, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.purchase_invoice import PurchaseInvoice
    from app.models.product import ProductVariant
    from app.models.provider import Provider
    from app.models.local import Local
    from app.models.company import Company
    from app.models.user import User


class PurchaseOrderStatus(str, enum.Enum):
    BORRADOR = "BORRADOR"
    ENVIADO = "ENVIADO"
    RECIBIDO = "RECIBIDO"
    COMPLETADO = "COMPLETADO"
    ANULADO = "ANULADO"


class PurchaseOrderType(str, enum.Enum):
    PRECOMPRA = "PRECOMPRA"
    REPOSICION = "REPOSICION"
    CAMBIO = "CAMBIO"


class PurchaseOrder(Base, TimestampMixin):
    """Cabecera de una nota de pedido / orden de compra a proveedor."""

    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(100), nullable=False)
    prefix: Mapped[str | None] = mapped_column(String(20))
    type: Mapped[PurchaseOrderType] = mapped_column(
        sa.Enum(PurchaseOrderType, name="purchase_order_type", create_constraint=True),
        default=PurchaseOrderType.REPOSICION,
        nullable=False,
    )
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        sa.Enum(PurchaseOrderStatus, name="purchase_order_status", create_constraint=True),
        default=PurchaseOrderStatus.BORRADOR,
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[str | None] = mapped_column(Text)
    total_ordered: Mapped[float | None] = mapped_column(Numeric(14, 2))
    total_received: Mapped[float | None] = mapped_column(Numeric(14, 2))
    accepted_difference: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accepted_difference_obs: Mapped[str | None] = mapped_column(Text)

    provider_id:Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    local_id: Mapped[int | None] = mapped_column(ForeignKey("locals.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    excel_file: Mapped[str | None] = mapped_column(String(500))
    pdf_file: Mapped[str | None] = mapped_column(String(500))

    # Relaciones
    provider: Mapped[Provider] = relationship("Provider", lazy="selectin")
    local: Mapped[Local | None] = relationship("Local", lazy="selectin")
    company: Mapped[Company] = relationship("Company")
    created_by: Mapped[User] = relationship("User")
    items: Mapped[list[PurchaseOrderItem]] = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    invoices: Mapped[list[PurchaseInvoice]] = relationship(
        "PurchaseInvoice",
        back_populates="purchase_order",
        lazy="selectin",
    )


class PurchaseOrderItem(Base, TimestampMixin):
    """Línea de detalle de una nota de pedido."""

    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id"), nullable=False
    )
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variants.id"), nullable=False
    )
    code: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(300))
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # Relaciones
    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="items"
    )
    variant: Mapped[ProductVariant] = relationship("ProductVariant", lazy="selectin")
