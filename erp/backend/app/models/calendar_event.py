"""Calendario de Eventos — feriados, promociones, fechas importantes"""
from __future__ import annotations

import enum
from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class EventType(str, enum.Enum):
    PROMOCION_LIQUIDACION = "PROMOCION_LIQUIDACION"
    FERIADO_FECHA_IMPORTANTE = "FERIADO_FECHA_IMPORTANTE"


class CalendarEvent(Base, TimestampMixin):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="eventtype", create_constraint=True),
        nullable=False,
    )
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_all_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    company: Mapped["Company"] = relationship("Company")
    created_by: Mapped["User"] = relationship("User")
