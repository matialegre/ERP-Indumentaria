"""
Modelo Customer / CRM — Clientes, cuenta corriente, vehículos.

Arquitectura:
  - Customer: datos personales COMPARTIDOS (master data)
  - CustomerCompany: relación comercial POR EMPRESA (crédito, plazo, descuento)
  - Vehicle: vehículos del cliente (para OT/Taller)
  - AccountMovement: movimientos de cuenta corriente
"""

import enum
from sqlalchemy import (
    String, Boolean, ForeignKey, Numeric, Text, Date, Enum,
    Integer, JSON, Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import date
from typing import Optional
from app.db.base import Base, TimestampMixin


# ── Enums ──────────────────────────────────────────────

class CustomerType(str, enum.Enum):
    PERSONA_FISICA = "PERSONA_FISICA"
    PERSONA_JURIDICA = "PERSONA_JURIDICA"
    CONSUMIDOR_FINAL = "CONSUMIDOR_FINAL"


class TaxCondition(str, enum.Enum):
    RESPONSABLE_INSCRIPTO = "RESPONSABLE_INSCRIPTO"
    MONOTRIBUTISTA = "MONOTRIBUTISTA"
    CONSUMIDOR_FINAL = "CONSUMIDOR_FINAL"
    EXENTO = "EXENTO"


class FuelType(str, enum.Enum):
    NAFTA = "NAFTA"
    DIESEL = "DIESEL"
    GNC = "GNC"
    ELECTRICO = "ELECTRICO"
    HIBRIDO = "HIBRIDO"


class MovementType(str, enum.Enum):
    FACTURA = "FACTURA"
    PAGO = "PAGO"
    NOTA_CREDITO = "NOTA_CREDITO"
    AJUSTE = "AJUSTE"


# ── Modelos ────────────────────────────────────────────

class Customer(Base, TimestampMixin):
    """Datos personales compartidos (master data)"""
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customer_cuit_dni", "cuit_dni"),
        Index("ix_customer_display_name", "display_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cuit_dni: Mapped[str] = mapped_column(String(13), unique=True, nullable=False)

    customer_type: Mapped[CustomerType] = mapped_column(
        Enum(CustomerType, name="customer_type"),
        default=CustomerType.CONSUMIDOR_FINAL, nullable=False,
    )
    tax_condition: Mapped[Optional[TaxCondition]] = mapped_column(
        Enum(TaxCondition, name="tax_condition"), nullable=True,
    )

    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    business_name: Mapped[Optional[str]] = mapped_column(String(200))
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)

    phone: Mapped[Optional[str]] = mapped_column(String(50))
    phone2: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    address: Mapped[Optional[str]] = mapped_column(String(500))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    province: Mapped[Optional[str]] = mapped_column(String(100))
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))

    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    company_data = relationship(
        "CustomerCompany", back_populates="customer",
        lazy="selectin", cascade="all, delete-orphan",
    )
    vehicles = relationship(
        "Vehicle", back_populates="customer",
        lazy="selectin", cascade="all, delete-orphan",
    )


class CustomerCompany(Base, TimestampMixin):
    """Relación comercial por empresa (crédito, plazo, cuenta corriente)"""
    __tablename__ = "customer_companies"
    __table_args__ = (
        UniqueConstraint("customer_id", "company_id", name="uq_customer_company"),
        Index("ix_custcomp_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Condiciones comerciales
    credit_limit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    price_list_id: Mapped[Optional[int]] = mapped_column(ForeignKey("price_list_files.id"))
    discount_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    # Cuenta corriente
    balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    # Datos extra por industria (JSONB flexible)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    customer = relationship("Customer", back_populates="company_data")
    company = relationship("Company", lazy="selectin")
    movements = relationship(
        "AccountMovement", back_populates="customer_company",
        lazy="noload", cascade="all, delete-orphan",
        order_by="AccountMovement.date.desc()",
    )


class Vehicle(Base, TimestampMixin):
    """Vehículo del cliente — usado para OT/Taller"""
    __tablename__ = "vehicles"
    __table_args__ = (
        Index("ix_vehicle_plate", "plate"),
        Index("ix_vehicle_customer", "customer_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)

    plate: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[Optional[int]] = mapped_column(Integer)
    color: Mapped[Optional[str]] = mapped_column(String(50))
    vin: Mapped[Optional[str]] = mapped_column(String(30), unique=True)
    engine_number: Mapped[Optional[str]] = mapped_column(String(50))
    fuel_type: Mapped[Optional[FuelType]] = mapped_column(
        Enum(FuelType, name="fuel_type"), nullable=True,
    )

    last_km: Mapped[Optional[int]] = mapped_column(Integer)
    last_service_date: Mapped[Optional[date]] = mapped_column(Date)
    next_service_km: Mapped[Optional[int]] = mapped_column(Integer)
    next_service_date: Mapped[Optional[date]] = mapped_column(Date)
    vtv_expiry: Mapped[Optional[date]] = mapped_column(Date)

    insurance_company: Mapped[Optional[str]] = mapped_column(String(100))
    insurance_policy: Mapped[Optional[str]] = mapped_column(String(50))
    insurance_expiry: Mapped[Optional[date]] = mapped_column(Date)

    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    customer = relationship("Customer", back_populates="vehicles")


class AccountMovement(Base, TimestampMixin):
    """Movimiento de cuenta corriente"""
    __tablename__ = "account_movements"
    __table_args__ = (
        Index("ix_accmov_custcomp", "customer_company_id"),
        Index("ix_accmov_date", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_company_id: Mapped[int] = mapped_column(
        ForeignKey("customer_companies.id"), nullable=False,
    )

    movement_type: Mapped[MovementType] = mapped_column(
        Enum(MovementType, name="account_movement_type"), nullable=False,
    )
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[int]] = mapped_column(Integer)

    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    balance_after: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Relationships
    customer_company = relationship("CustomerCompany", back_populates="movements")
    created_by = relationship("User", lazy="selectin")
