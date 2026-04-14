"""
Facturas de compra — documentos de proveedor vinculados a Notas de Pedido.
Tipos: FACTURA, REMITO, REMITO_FACTURA
Estados semáforo: VERDE (completo), ROJO (pendiente), ALERTA (alerta repo)
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text, Date, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.purchase_order import PurchaseOrder
    from app.models.provider import Provider
    from app.models.local import Local
    from app.models.company import Company
    from app.models.user import User


class PurchaseInvoiceType(str, enum.Enum):
    FACTURA = "FACTURA"
    REMITO = "REMITO"
    REMITO_FACTURA = "REMITO_FACTURA"


class PurchaseInvoiceStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    VERDE = "VERDE"
    ROJO = "ROJO"
    ALERTA_REPO = "ALERTA_REPO"
    ANULADO = "ANULADO"


class IngresoStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    PARCIAL = "PARCIAL"
    COMPLETO = "COMPLETO"
    NO = "NO"


class SemaforoEstado(str, enum.Enum):
    ROJO = "ROJO"           # Sin RV o sin ingreso
    AMARILLO = "AMARILLO"   # Tiene RV, ingreso parcial o no confirmado admin
    VERDE = "VERDE"         # RV + ingreso COMPLETO confirmado admin


class PurchaseInvoice(Base, TimestampMixin):
    """Factura / remito de compra vinculado a una nota de pedido."""

    __tablename__ = "purchase_invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str | None] = mapped_column(String(100))
    type: Mapped[PurchaseInvoiceType] = mapped_column(
        sa.Enum(PurchaseInvoiceType, name="purchase_invoice_type", create_constraint=True),
        nullable=False,
    )
    status: Mapped[PurchaseInvoiceStatus] = mapped_column(
        sa.Enum(PurchaseInvoiceStatus, name="purchase_invoice_status", create_constraint=True),
        default=PurchaseInvoiceStatus.ROJO,
        nullable=False,
    )
    date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[float | None] = mapped_column(Numeric(14, 2))
    remito_venta_number: Mapped[str | None] = mapped_column(String(100))

    linked_to_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_invoices.id"))

    pdf_file: Mapped[str | None] = mapped_column(String(500))
    pdf_parsed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    observations: Mapped[str | None] = mapped_column(Text)
    local_obs: Mapped[str | None] = mapped_column(Text)
    compras_obs: Mapped[str | None] = mapped_column(Text)
    is_partial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ingreso_status: Mapped[IngresoStatus] = mapped_column(
        sa.Enum(IngresoStatus, name="purchase_invoice_ingreso_status", create_constraint=True),
        default=IngresoStatus.PENDIENTE,
        nullable=False,
    )
    ingreso_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingreso_photo: Mapped[str | None] = mapped_column(String(500))

    # Semáforo de aprobación 2 niveles
    estado_semaforo: Mapped[SemaforoEstado] = mapped_column(
        sa.Enum(SemaforoEstado, name="semaforo_estado", create_constraint=True),
        default=SemaforoEstado.ROJO,
        nullable=False,
    )
    confirmado_local_at: Mapped[datetime | None] = mapped_column(DateTime)
    confirmado_admin_at: Mapped[datetime | None] = mapped_column(DateTime)
    confirmado_local_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    confirmado_admin_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id"), nullable=False
    )
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    local_id: Mapped[int | None] = mapped_column(ForeignKey("locals.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Relaciones
    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="invoices", lazy="selectin"
    )
    provider: Mapped[Provider] = relationship("Provider", lazy="selectin")
    local: Mapped[Local | None] = relationship("Local", lazy="selectin")
    company: Mapped[Company] = relationship("Company")
    created_by: Mapped[User] = relationship("User", foreign_keys="[PurchaseInvoice.created_by_id]")
    linked_to: Mapped[PurchaseInvoice | None] = relationship(
        "PurchaseInvoice",
        remote_side="PurchaseInvoice.id",
        foreign_keys=[linked_to_id],
        back_populates="linked_invoices",
    )
    linked_invoices: Mapped[list[PurchaseInvoice]] = relationship(
        "PurchaseInvoice",
        foreign_keys="PurchaseInvoice.linked_to_id",
        back_populates="linked_to",
    )
    items: Mapped[list[PurchaseInvoiceItem]] = relationship(
        "PurchaseInvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PurchaseInvoiceItem(Base, TimestampMixin):
    """Línea de detalle de una factura / remito de compra."""

    __tablename__ = "purchase_invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_invoice_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_invoices.id"), nullable=False
    )
    code: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(String(300))
    size: Mapped[str | None] = mapped_column(String(20))
    color: Mapped[str | None] = mapped_column(String(50))
    quantity_invoiced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    list_price: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # Relaciones
    invoice: Mapped[PurchaseInvoice] = relationship(
        "PurchaseInvoice", back_populates="items"
    )
