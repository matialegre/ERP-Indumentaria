"""CRM Content Posts — Content calendar."""

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmContentPost(Base, TimestampMixin):
    __tablename__ = "crm_content_posts"
    __table_args__ = (
        Index("ix_crm_content_company_date", "company_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False,
    )
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brands: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    branches: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    channels: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    copies: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    assets: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    metrics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
