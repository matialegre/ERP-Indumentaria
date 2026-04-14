"""Listas de precios de proveedores — Excel importados para comparación"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class PriceListFile(Base, TimestampMixin):
    __tablename__ = "price_list_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    upload_date: Mapped[date] = mapped_column(Date, nullable=False)
    provider_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("providers.id"), nullable=True)
    season: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    item_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    provider: Mapped[Optional["Provider"]] = relationship("Provider", lazy="selectin")
    company: Mapped["Company"] = relationship("Company")
    created_by: Mapped["User"] = relationship("User")
    items: Mapped[List["PriceListItem"]] = relationship(
        "PriceListItem",
        back_populates="price_list_file",
        cascade="all, delete-orphan",
    )


class PriceListItem(Base, TimestampMixin):
    __tablename__ = "price_list_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    price_list_file_id: Mapped[int] = mapped_column(Integer, ForeignKey("price_list_files.id"), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    cost: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(5), default="ARS", nullable=False)

    price_list_file: Mapped["PriceListFile"] = relationship("PriceListFile", back_populates="items")
