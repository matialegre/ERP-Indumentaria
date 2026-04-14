"""
Gestión de pagos — comprobantes, retenciones, cuentas bancarias, notas de crédito.
"""

from __future__ import annotations

import enum
from datetime import date
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.purchase_invoice import PurchaseInvoice
    from app.models.provider import Provider
    from app.models.company import Company
    from app.models.user import User


class PaymentMethod(str, enum.Enum):
    TRANSFERENCIA = "TRANSFERENCIA"
    CHEQUE = "CHEQUE"
    EFECTIVO = "EFECTIVO"
    DEPOSITO = "DEPOSITO"
    DEBITO_DIRECTO = "DEBITO_DIRECTO"
    OTRO = "OTRO"


class PaymentStatus(str, enum.Enum):
    POR_PAGAR = "POR_PAGAR"
    PARCIAL = "PARCIAL"
    PAGADO = "PAGADO"
    VENCIDO = "VENCIDO"
    ANULADO = "ANULADO"


class BankAccount(Base, TimestampMixin):
    """Cuenta bancaria de un proveedor."""

    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    bank_name: Mapped[str | None] = mapped_column(String(100))
    account_type: Mapped[str | None] = mapped_column(String(50))
    cbu: Mapped[str | None] = mapped_column(String(22))
    alias: Mapped[str | None] = mapped_column(String(100))
    cuit: Mapped[str | None] = mapped_column(String(13))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Relaciones
    provider: Mapped[Provider] = relationship("Provider")
    company: Mapped[Company] = relationship("Company")


class PaymentVoucher(Base, TimestampMixin):
    """Comprobante / minuta de pago con retenciones impositivas."""

    __tablename__ = "payment_vouchers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str | None] = mapped_column(String(50))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        sa.Enum(PaymentStatus, name="payment_status", create_constraint=True),
        default=PaymentStatus.POR_PAGAR,
        nullable=False,
    )

    amount_gross: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    amount_iibb: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    amount_ganancias: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    amount_iva: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    amount_suss: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    amount_net: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    payment_date: Mapped[date | None] = mapped_column(Date)
    bank_account_id: Mapped[int | None] = mapped_column(ForeignKey("bank_accounts.id"))
    notes: Mapped[str | None] = mapped_column(Text)
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        sa.Enum(PaymentMethod, name="payment_method", create_constraint=True),
        nullable=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    pdf_file: Mapped[str | None] = mapped_column(String(500))

    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Relaciones
    provider: Mapped[Provider] = relationship("Provider", lazy="selectin")
    bank_account: Mapped[BankAccount | None] = relationship("BankAccount", lazy="selectin")
    company: Mapped[Company] = relationship("Company")
    created_by: Mapped[User] = relationship("User")
    invoice_links: Mapped[list[PaymentInvoiceLink]] = relationship(
        "PaymentInvoiceLink",
        back_populates="payment_voucher",
        cascade="all, delete-orphan",
    )


class PaymentInvoiceLink(Base, TimestampMixin):
    """Vínculo M2M entre comprobante de pago y factura de compra."""

    __tablename__ = "payment_invoice_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payment_voucher_id: Mapped[int] = mapped_column(
        ForeignKey("payment_vouchers.id"), nullable=False
    )
    purchase_invoice_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_invoices.id"), nullable=False
    )
    amount: Mapped[float | None] = mapped_column(Numeric(14, 2))

    # Relaciones
    payment_voucher: Mapped[PaymentVoucher] = relationship(
        "PaymentVoucher", back_populates="invoice_links"
    )
    purchase_invoice: Mapped[PurchaseInvoice] = relationship("PurchaseInvoice")


class CreditNote(Base, TimestampMixin):
    """Nota de crédito de proveedor."""

    __tablename__ = "credit_notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Relaciones
    provider: Mapped[Provider] = relationship("Provider", lazy="selectin")
    company: Mapped[Company] = relationship("Company")
    created_by: Mapped[User] = relationship("User")
