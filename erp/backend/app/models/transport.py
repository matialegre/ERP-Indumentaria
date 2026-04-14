"""Transportes y registro de envíos"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Transport(Base, TimestampMixin):
    __tablename__ = "transports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)

    company: Mapped["Company"] = relationship("Company")
    shipments: Mapped[List["Shipment"]] = relationship("Shipment", back_populates="transport")


class Shipment(Base, TimestampMixin):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transport_id: Mapped[int] = mapped_column(Integer, ForeignKey("transports.id"), nullable=False)
    tracking_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sender: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    destination_local_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("locals.id"), nullable=True)
    date_sent: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_arrived: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ENVIADO", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_file: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    purchase_invoice_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("purchase_invoices.id"), nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    transport: Mapped["Transport"] = relationship("Transport", back_populates="shipments", lazy="selectin")
    destination_local: Mapped[Optional["Local"]] = relationship("Local", lazy="selectin")
    purchase_invoice: Mapped[Optional["PurchaseInvoice"]] = relationship("PurchaseInvoice", lazy="selectin")
    company: Mapped["Company"] = relationship("Company")
    created_by: Mapped["User"] = relationship("User")
