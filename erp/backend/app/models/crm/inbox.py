"""CRM Inbox — Unified inbox threads, tags, and customer-tag associations."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String, Integer, DateTime, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmInboxThread(Base, TimestampMixin):
    __tablename__ = "crm_inbox_threads"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "customer_id",
            name="uq_crm_inbox_thread_customer",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True,
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    assignee_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )


class CrmTag(Base, TimestampMixin):
    __tablename__ = "crm_tags"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_crm_tag_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class CrmCustomerTag(Base):
    __tablename__ = "crm_customer_tags"
    __table_args__ = (
        UniqueConstraint("customer_id", "tag_id", name="uq_crm_customer_tag"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True,
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("crm_tags.id"), nullable=False, index=True,
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
