"""CRM Messages & Conversations."""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmConversation(Base, TimestampMixin):
    __tablename__ = "crm_conversations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True,
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )


class CrmMessage(Base, TimestampMixin):
    __tablename__ = "crm_messages"
    __table_args__ = (
        Index("ix_crm_msg_customer_created", "customer_id", "created_at"),
        Index("ix_crm_msg_channel_created", "channel", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False,
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    conversation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("crm_conversations.id"), nullable=True, index=True,
    )
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    sim: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    direction: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
