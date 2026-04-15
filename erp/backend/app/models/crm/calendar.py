"""CRM Calendar Items & Resources."""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmCalendarItem(Base, TimestampMixin):
    __tablename__ = "crm_calendar_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    scope: Mapped[str] = mapped_column(String(30), nullable=False)


class CrmResource(Base, TimestampMixin):
    __tablename__ = "crm_resources"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    scope: Mapped[str] = mapped_column(String(30), nullable=False)
