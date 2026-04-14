"""Configuración de alertas de email por empresa"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class MailConfig(Base, TimestampMixin):
    __tablename__ = "mail_configs"
    __table_args__ = (UniqueConstraint("company_id", name="uq_mail_configs_company_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    days_max_sin_rv: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    days_max_sin_confirmacion: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    days_max_sin_pago: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    smtp_host: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    smtp_port: Mapped[int] = mapped_column(Integer, default=587, nullable=False)
    smtp_user: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    smtp_password: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    smtp_from: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)

    company: Mapped["Company"] = relationship("Company")
