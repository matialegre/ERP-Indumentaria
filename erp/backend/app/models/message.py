from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    is_broadcast: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    from_user: Mapped["User"] = relationship("User", foreign_keys=[from_user_id], lazy="selectin")
    to_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[to_user_id], lazy="selectin")
    company: Mapped["Company"] = relationship("Company")
