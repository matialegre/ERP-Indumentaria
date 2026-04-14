"""TrellOutdoor — Kanban board para gestión de tareas internas"""
from __future__ import annotations

import enum
from datetime import date
from typing import List, Optional

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class KanbanCardPriority(str, enum.Enum):
    BAJA = "BAJA"
    MEDIA = "MEDIA"
    ALTA = "ALTA"
    URGENTE = "URGENTE"


class KanbanBoard(Base, TimestampMixin):
    __tablename__ = "kanban_boards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#3B82F6", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    company: Mapped["Company"] = relationship("Company")
    created_by: Mapped["User"] = relationship("User")
    columns: Mapped[List["KanbanColumn"]] = relationship(
        "KanbanColumn",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="KanbanColumn.position",
        lazy="selectin",
    )


class KanbanColumn(Base, TimestampMixin):
    __tablename__ = "kanban_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    board_id: Mapped[int] = mapped_column(Integer, ForeignKey("kanban_boards.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    board: Mapped["KanbanBoard"] = relationship("KanbanBoard", back_populates="columns")
    cards: Mapped[List["KanbanCard"]] = relationship(
        "KanbanCard",
        back_populates="column",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class KanbanCard(Base, TimestampMixin):
    __tablename__ = "kanban_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    column_id: Mapped[int] = mapped_column(Integer, ForeignKey("kanban_columns.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[KanbanCardPriority] = mapped_column(
        Enum(KanbanCardPriority, name="kanbancardpriority", create_constraint=True),
        default=KanbanCardPriority.MEDIA,
        nullable=False,
    )
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    image_file: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    labels: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_to_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    column: Mapped["KanbanColumn"] = relationship("KanbanColumn", back_populates="cards")
    assigned_to: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_to_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
