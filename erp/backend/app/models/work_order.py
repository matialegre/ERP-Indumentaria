"""
Modelo WorkOrder — Órdenes de Trabajo (OT)
Soporta talleres mecánicos y otros rubros.
"""

import enum
from sqlalchemy import (
    String, Boolean, ForeignKey, Numeric, Text, Date, Enum,
    Integer, Float, JSON, DateTime, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from typing import Optional
from app.db.base import Base, TimestampMixin


# ── Enums ──────────────────────────────────────────────

class WOStatus(str, enum.Enum):
    RECEPCION = "RECEPCION"
    DIAGNOSTICO = "DIAGNOSTICO"
    PRESUPUESTO = "PRESUPUESTO"
    APROBACION_CLIENTE = "APROBACION_CLIENTE"
    EN_EJECUCION = "EN_EJECUCION"
    CONTROL_CALIDAD = "CONTROL_CALIDAD"
    ENTREGA = "ENTREGA"
    FACTURADO = "FACTURADO"
    CERRADO = "CERRADO"
    CANCELADO = "CANCELADO"


class WOPriority(str, enum.Enum):
    BAJA = "BAJA"
    NORMAL = "NORMAL"
    ALTA = "ALTA"
    URGENTE = "URGENTE"


class WOItemType(str, enum.Enum):
    REPUESTO = "REPUESTO"
    MANO_DE_OBRA = "MANO_DE_OBRA"
    SERVICIO_EXTERNO = "SERVICIO_EXTERNO"


class WOItemStatus(str, enum.Enum):
    PRESUPUESTADO = "PRESUPUESTADO"
    APROBADO = "APROBADO"
    USADO = "USADO"
    DEVUELTO = "DEVUELTO"


# Transiciones válidas de estado
WO_TRANSITIONS = {
    WOStatus.RECEPCION:          WOStatus.DIAGNOSTICO,
    WOStatus.DIAGNOSTICO:        WOStatus.PRESUPUESTO,
    WOStatus.PRESUPUESTO:        WOStatus.APROBACION_CLIENTE,
    WOStatus.APROBACION_CLIENTE: WOStatus.EN_EJECUCION,
    WOStatus.EN_EJECUCION:       WOStatus.CONTROL_CALIDAD,
    WOStatus.CONTROL_CALIDAD:    WOStatus.ENTREGA,
    WOStatus.ENTREGA:            WOStatus.FACTURADO,
    WOStatus.FACTURADO:          WOStatus.CERRADO,
}


# ── Modelos ────────────────────────────────────────────

class WorkOrder(Base, TimestampMixin):
    """Orden de Trabajo principal"""
    __tablename__ = "work_orders"
    __table_args__ = (
        Index("ix_wo_company_status", "company_id", "status"),
        Index("ix_wo_plate", "plate"),
        Index("ix_wo_number", "company_id", "number", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(20), nullable=False)

    status: Mapped[WOStatus] = mapped_column(
        Enum(WOStatus, name="wo_status"),
        default=WOStatus.RECEPCION, nullable=False,
    )
    priority: Mapped[WOPriority] = mapped_column(
        Enum(WOPriority, name="wo_priority"),
        default=WOPriority.NORMAL, nullable=False,
    )

    # ── Fechas de hitos ──
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    diagnosed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    quoted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    invoiced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # ── Datos del vehículo / objeto de trabajo ──
    plate: Mapped[Optional[str]] = mapped_column(String(20))
    vin: Mapped[Optional[str]] = mapped_column(String(30))
    brand: Mapped[Optional[str]] = mapped_column(String(100))
    model: Mapped[Optional[str]] = mapped_column(String(100))
    year: Mapped[Optional[int]] = mapped_column(Integer)
    km_in: Mapped[Optional[int]] = mapped_column(Integer)
    km_out: Mapped[Optional[int]] = mapped_column(Integer)
    fuel_level: Mapped[Optional[str]] = mapped_column(String(20))
    color: Mapped[Optional[str]] = mapped_column(String(50))

    # ── Datos del cliente ──
    customer_name: Mapped[Optional[str]] = mapped_column(String(200))
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50))
    customer_email: Mapped[Optional[str]] = mapped_column(String(200))
    customer_cuit: Mapped[Optional[str]] = mapped_column(String(13))
    customer_address: Mapped[Optional[str]] = mapped_column(String(300))

    # ── Observaciones ──
    reception_notes: Mapped[Optional[str]] = mapped_column(Text)
    diagnosis_notes: Mapped[Optional[str]] = mapped_column(Text)
    delivery_notes: Mapped[Optional[str]] = mapped_column(Text)

    # ── Fotos (JSON array de URLs/paths) ──
    reception_photos: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    delivery_photos: Mapped[Optional[dict]] = mapped_column(JSON, default=list)

    # ── Financiero ──
    estimated_total: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    final_total: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    discount_pct: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), default=0)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50))

    # ── Cancelación ──
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text)

    # ── Relaciones FK ──
    local_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locals.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_mechanic_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    # ── Offline / sync ──
    offline_id: Mapped[Optional[str]] = mapped_column(String(36))
    device_id: Mapped[Optional[str]] = mapped_column(String(100))
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # ── Relationships ──
    local = relationship("Local", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    assigned_mechanic = relationship("User", foreign_keys=[assigned_mechanic_id], lazy="selectin")
    items = relationship(
        "WorkOrderItem", back_populates="work_order",
        lazy="selectin", cascade="all, delete-orphan",
    )
    history = relationship(
        "WorkOrderHistory", back_populates="work_order",
        lazy="selectin", cascade="all, delete-orphan",
        order_by="WorkOrderHistory.timestamp",
    )
    checklists = relationship(
        "WorkOrderChecklist", back_populates="work_order",
        lazy="selectin", cascade="all, delete-orphan",
    )


class WorkOrderItem(Base, TimestampMixin):
    """Línea de detalle: repuesto, mano de obra o servicio externo"""
    __tablename__ = "work_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"), nullable=False)

    type: Mapped[WOItemType] = mapped_column(
        Enum(WOItemType, name="wo_item_type"), nullable=False,
    )
    status: Mapped[WOItemStatus] = mapped_column(
        Enum(WOItemStatus, name="wo_item_status"),
        default=WOItemStatus.PRESUPUESTADO, nullable=False,
    )

    # Para REPUESTO
    variant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("product_variants.id"))
    quantity: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    unit_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))

    # Para MANO_DE_OBRA
    description: Mapped[Optional[str]] = mapped_column(Text)
    hours: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    hourly_rate: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    mechanic_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    # Para SERVICIO_EXTERNO
    provider_name: Mapped[Optional[str]] = mapped_column(String(200))
    cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))

    stock_decremented: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Offline
    offline_id: Mapped[Optional[str]] = mapped_column(String(36))

    # Relationships
    work_order = relationship("WorkOrder", back_populates="items")
    variant = relationship("ProductVariant", lazy="selectin")
    mechanic = relationship("User", foreign_keys=[mechanic_id], lazy="selectin")


class WorkOrderHistory(Base):
    """Registro de auditoría de cambios de estado"""
    __tablename__ = "work_order_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    from_status: Mapped[Optional[str]] = mapped_column(String(30))
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    device_id: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    work_order = relationship("WorkOrder", back_populates="history")
    user = relationship("User", lazy="selectin")


class WorkOrderChecklist(Base, TimestampMixin):
    """Ítems de checklist de control de calidad"""
    __tablename__ = "work_order_checklists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"), nullable=False)
    item_text: Mapped[str] = mapped_column(String(300), nullable=False)
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checked_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    work_order = relationship("WorkOrder", back_populates="checklists")
    checked_by = relationship("User", lazy="selectin")


class MechanicRate(Base, TimestampMixin):
    """Tarifa horaria por mecánico / técnico"""
    __tablename__ = "mechanic_rates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    hourly_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    speciality: Mapped[Optional[str]] = mapped_column(String(200))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    user = relationship("User", lazy="selectin")
