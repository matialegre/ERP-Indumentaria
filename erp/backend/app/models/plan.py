"""
Modelo de planes/licencias para empresas
"""

from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.db.base import Base


class PlanTier(str, enum.Enum):
    FREE = "FREE"
    STARTER = "STARTER"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    tier = Column(SAEnum(PlanTier), nullable=False, default=PlanTier.STARTER)
    description = Column(Text)

    # Límites
    max_users = Column(Integer, default=5)
    max_locals = Column(Integer, default=1)
    max_products = Column(Integer, default=500)
    max_modules = Column(Integer, default=5)

    # Precio (referencial — facturación externa)
    price_monthly = Column(Float, default=0)
    price_currency = Column(String(3), default="ARS")

    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)  # Plan asignado a nuevas empresas

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    subscriptions = relationship("CompanySubscription", back_populates="plan")


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    TRIAL = "TRIAL"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"
    CANCELLED = "CANCELLED"


def _gen_serial() -> str:
    """Genera número de serie: MO-XXXX-XXXX-XXXX (letras/dígitos mayúsculas)."""
    raw = uuid.uuid4().hex.upper()
    return f"MO-{raw[0:4]}-{raw[4:8]}-{raw[8:12]}"


class CompanySubscription(Base):
    __tablename__ = "company_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    status = Column(SAEnum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)

    # Número de serie único — identifica esta instalación del ERP
    serial_number = Column(String(64), unique=True, nullable=False, default=lambda: _gen_serial())

    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # null = sin vencimiento

    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", backref="subscriptions")
    plan = relationship("Plan", back_populates="subscriptions")


def _gen_pc_key() -> str:
    """Genera clave de licencia PC: PC-XXXX-XXXX-XXXX-XXXX"""
    raw = uuid.uuid4().hex.upper()
    return f"PC-{raw[0:4]}-{raw[4:8]}-{raw[8:12]}-{raw[12:16]}"


class PCLicense(Base):
    __tablename__ = "pc_licenses"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True, nullable=False, default=_gen_pc_key)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    description = Column(String(200), nullable=False, default="")
    is_active = Column(Boolean, default=True)
    machine_id = Column(String(300), nullable=True)  # se fija en el primer uso

    created_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime, nullable=True)   # cuando se vinculó al primer equipo
    last_seen_at = Column(DateTime, nullable=True)
    deactivated_reason = Column(String(500), nullable=True)

    company = relationship("Company", backref="pc_licenses")
