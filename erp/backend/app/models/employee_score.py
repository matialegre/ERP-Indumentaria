"""
EmployeeScore — modelo para el módulo de Puntuación de Empleados
"""

from sqlalchemy import String, Integer, Text, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from app.db.base import Base, TimestampMixin


CATEGORIAS_DEFAULT = [
    "Puntualidad",
    "Actitud",
    "Ventas",
    "Trabajo en equipo",
    "Atención al cliente",
    "Orden y limpieza",
]


class EmployeeScore(Base, TimestampMixin):
    __tablename__ = "employee_scores"

    id:            Mapped[int]          = mapped_column(primary_key=True, autoincrement=True)
    company_id:    Mapped[int]          = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    employee_id:   Mapped[int]          = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    scored_by_id:  Mapped[int]          = mapped_column(ForeignKey("users.id"), nullable=False)
    categoria:     Mapped[str]          = mapped_column(String(100), nullable=False)
    puntuacion:    Mapped[int]          = mapped_column(Integer, nullable=False)   # 1–10
    comentario:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    periodo:       Mapped[str]          = mapped_column(String(7), nullable=False, index=True)  # "YYYY-MM"

    employee   = relationship("User", foreign_keys=[employee_id],  lazy="selectin")
    scored_by  = relationship("User", foreign_keys=[scored_by_id], lazy="selectin")
