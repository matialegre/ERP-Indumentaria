"""
Modelo StockMovement — historial de movimientos de inventario
"""

import enum
from sqlalchemy import String, ForeignKey, Text, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class MovementType(str, enum.Enum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"
    AJUSTE = "AJUSTE"
    TRANSFERENCIA = "TRANSFERENCIA"


class StockMovement(Base, TimestampMixin):
    """Registro de cada movimiento de stock"""
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[MovementType] = mapped_column(
        Enum(MovementType, name="movement_type"), nullable=False
    )
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # + or -
    reference: Mapped[str | None] = mapped_column(String(200))  # e.g. "Ingreso #12"
    notes: Mapped[str | None] = mapped_column(Text)

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    variant = relationship("ProductVariant", lazy="selectin")
    created_by = relationship("User", lazy="selectin")
