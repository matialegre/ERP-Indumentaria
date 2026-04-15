"""CRM Integrations, Reports, Events, and Ads models."""

from typing import Optional

from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmIntegrationRecord(Base, TimestampMixin):
    __tablename__ = "crm_integrations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    kind: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")


class CrmReportDefinition(Base, TimestampMixin):
    __tablename__ = "crm_report_definitions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)


class CrmReportRun(Base, TimestampMixin):
    __tablename__ = "crm_report_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    definition_id: Mapped[int] = mapped_column(
        ForeignKey("crm_report_definitions.id"), nullable=False, index=True,
    )
    params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="completed")


class CrmEvent(Base, TimestampMixin):
    __tablename__ = "crm_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    kind: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")


class CrmAdsMeta(Base, TimestampMixin):
    __tablename__ = "crm_ads_meta"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)


class CrmAdsGoogle(Base, TimestampMixin):
    __tablename__ = "crm_ads_google"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
