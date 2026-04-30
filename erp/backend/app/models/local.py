"""
Modelo Local — puntos de venta / sucursales
"""

from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Local(Base, TimestampMixin):
    __tablename__ = "locals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    empresa: Mapped[str | None] = mapped_column(String(50))
    ciudad: Mapped[str | None] = mapped_column(String(50))
    clink_cod_local: Mapped[str | None] = mapped_column(String(20))

    # Multi-tenant
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False
    )

    # Relaciones
    company = relationship("Company", back_populates="locals_")
