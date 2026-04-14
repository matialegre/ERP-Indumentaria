"""Sistema de notificaciones internas entre roles"""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class NotificationType(str, enum.Enum):
    INFO = "INFO"
    ALERTA = "ALERTA"
    URGENTE = "URGENTE"


class NotificationStatus(str, enum.Enum):
    LEIDA = "LEIDA"
    NO_LEIDA = "NO_LEIDA"


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notificationtype", create_constraint=True),
        default=NotificationType.INFO,
        nullable=False,
    )
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notificationstatus", create_constraint=True),
        default=NotificationStatus.NO_LEIDA,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    from_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    to_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    to_role: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    related_invoice_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("purchase_invoices.id"), nullable=True)
    related_order_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    # GAP-6: link a sync event y dispositivo origen (para filtrar por dispositivo_id)
    related_sync_event_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("sync_events.id", ondelete="SET NULL"), nullable=True,
    )
    device_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)

    from_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[from_user_id])
    to_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[to_user_id])
    company: Mapped["Company"] = relationship("Company")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    old_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[Optional["User"]] = relationship("User", lazy="selectin")
    company: Mapped["Company"] = relationship("Company")
