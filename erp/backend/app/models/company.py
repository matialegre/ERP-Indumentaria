"""
Modelo Company — base multi-tenant con branding white-label
"""

import enum
from sqlalchemy import String, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class IndustryType(str, enum.Enum):
    INDUMENTARIA = "INDUMENTARIA"
    KIOSCO = "KIOSCO"
    MECANICO = "MECANICO"
    DEPOSITO = "DEPOSITO"
    RESTAURANTE = "RESTAURANTE"
    FERRETERIA = "FERRETERIA"
    FARMACIA = "FARMACIA"
    LIBRERIA = "LIBRERIA"
    OTRO = "OTRO"


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cuit: Mapped[str] = mapped_column(String(13), unique=True, nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))
    logo_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Branding white-label ──
    app_name: Mapped[str | None] = mapped_column(String(200))
    short_name: Mapped[str | None] = mapped_column(String(10))
    primary_color: Mapped[str | None] = mapped_column(String(7), default="#1e40af")
    secondary_color: Mapped[str | None] = mapped_column(String(7), default="#3b82f6")
    favicon_url: Mapped[str | None] = mapped_column(Text)
    industry_type: Mapped[IndustryType | None] = mapped_column(
        SAEnum(IndustryType, name="industry_type", create_constraint=True),
        nullable=True, default=None,
    )
    welcome_message: Mapped[str | None] = mapped_column(Text)
    icon_data: Mapped[str | None] = mapped_column(Text)

    # Relaciones
    users = relationship("User", back_populates="company", lazy="selectin")
    locals_ = relationship("Local", back_populates="company", lazy="selectin")
    providers = relationship("Provider", back_populates="company", lazy="selectin")
