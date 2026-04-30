"""
Caja — caja de efectivo agrupada por ciudad.

Cada ciudad tiene UNA caja en común (ej. Bahía Blanca = 5 locales → 1 caja).
Los movimientos suman/restan al saldo solo cuando están en estado ACEPTADO.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    String, ForeignKey, Numeric, Text, Date, DateTime, Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.local import Local
    from app.models.company import Company
    from app.models.user import User


class MovimientoTipo(str, enum.Enum):
    INGRESO = "INGRESO"
    EGRESO_GASTO = "EGRESO_GASTO"
    TRASPASO_IN = "TRASPASO_IN"
    TRASPASO_OUT = "TRASPASO_OUT"


class MovimientoEstado(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ACEPTADO = "ACEPTADO"
    RECHAZADO = "RECHAZADO"


class Caja(Base, TimestampMixin):
    """Una caja por ciudad. Saldo = saldo_inicial + suma firmada de movimientos ACEPTADOS."""

    __tablename__ = "cajas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ciudad: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    saldo_inicial: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    movimientos: Mapped[list["CajaMovimiento"]] = relationship(
        "CajaMovimiento", back_populates="caja", cascade="all, delete-orphan"
    )


class CajaMovimiento(Base, TimestampMixin):
    """Movimiento de caja. Sign del impacto en saldo lo determina `tipo`."""

    __tablename__ = "caja_movimientos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    caja_id: Mapped[int] = mapped_column(ForeignKey("cajas.id"), nullable=False, index=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    tipo: Mapped[MovimientoTipo] = mapped_column(
        String(20), nullable=False, index=True
    )
    local_id: Mapped[int | None] = mapped_column(ForeignKey("locals.id"), nullable=True)
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    motivo: Mapped[str | None] = mapped_column(Text, nullable=True)
    numero: Mapped[str | None] = mapped_column(String(50), nullable=True)
    comprobante_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    estado: Mapped[MovimientoEstado] = mapped_column(
        String(15), nullable=False, default=MovimientoEstado.PENDIENTE, index=True
    )
    aceptado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    aceptado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transfer_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    caja: Mapped[Caja] = relationship("Caja", back_populates="movimientos")
    local: Mapped["Local | None"] = relationship("Local", lazy="joined")
    aceptado_por: Mapped["User | None"] = relationship("User", foreign_keys=[aceptado_por_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
