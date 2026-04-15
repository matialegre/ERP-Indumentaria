"""CRM Club — Loyalty program (points & coupons)."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String, Integer, Boolean, Text, DateTime, ForeignKey,
    Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmPointsTransaction(Base, TimestampMixin):
    __tablename__ = "crm_points_transactions"
    __table_args__ = (
        Index("ix_crm_points_customer_created", "customer_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False,
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)


class CrmClubCoupon(Base, TimestampMixin):
    __tablename__ = "crm_club_coupons"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_crm_coupon_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    points_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(20), nullable=False)
    discount_value: Mapped[int] = mapped_column(Integer, nullable=False)
    min_purchase: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
