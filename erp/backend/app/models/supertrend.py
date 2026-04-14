"""
Modelo SUPERTREND — análisis de competencia y tendencias de mercado.

Dos entidades principales:
- CompetitorEntry: precio de un competidor para un producto/servicio
- TrendIndicator: indicador de tendencia de una categoría/producto
"""

import enum
from decimal import Decimal
from sqlalchemy import (
    String, Text, ForeignKey, Enum, Numeric, Boolean, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class TrendDirection(str, enum.Enum):
    UP   = "UP"     # Tendencia creciente
    STABLE = "STABLE"  # Estable
    DOWN = "DOWN"   # Tendencia bajista


class CompetitorEntry(Base, TimestampMixin):
    """
    Precio registrado de un competidor para un producto o servicio.
    Permite comparar nuestro precio vs mercado.
    """
    __tablename__ = "supertrend_competitors"

    id:           Mapped[int]  = mapped_column(primary_key=True, autoincrement=True)
    company_id:   Mapped[int]  = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Identificación del competidor
    competitor_name: Mapped[str]       = mapped_column(String(200), nullable=False)
    competitor_url:  Mapped[str | None] = mapped_column(String(500))

    # Producto o servicio analizado
    product_name:    Mapped[str]       = mapped_column(String(300), nullable=False)
    category:        Mapped[str | None] = mapped_column(String(150))
    sku_reference:   Mapped[str | None] = mapped_column(String(100))  # SKU del competitor

    # Precios
    competitor_price: Mapped[Decimal]       = mapped_column(Numeric(14, 2), nullable=False)
    our_price:        Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency:         Mapped[str]           = mapped_column(String(10), default="ARS", nullable=False)

    # Notas y contexto
    notes:     Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool]       = mapped_column(Boolean, default=True, nullable=False)

    company = relationship("Company", lazy="select")

    __table_args__ = (
        Index("ix_supertrend_competitors_company", "company_id"),
    )


class TrendIndicator(Base, TimestampMixin):
    """
    Indicador de tendencia de una categoría, producto o servicio.
    Permite marcar qué está creciendo, estable o en baja en el mercado.
    """
    __tablename__ = "supertrend_trends"

    id:         Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Qué se está analizando
    name:        Mapped[str]       = mapped_column(String(300), nullable=False)
    category:    Mapped[str | None] = mapped_column(String(150))
    business_type: Mapped[str | None] = mapped_column(String(100))  # e.g. "outdoor", "taller", "indumentaria"

    # Indicador
    direction:   Mapped[TrendDirection] = mapped_column(
        Enum(TrendDirection, name="trend_direction"), nullable=False, default=TrendDirection.STABLE
    )
    relevance:   Mapped[int]  = mapped_column(default=3, nullable=False)  # 1-5 estrellas
    source:      Mapped[str | None] = mapped_column(String(300))  # "Instagram", "Google Trends", "Feria", etc.

    # Descripción e impacto
    description: Mapped[str | None] = mapped_column(Text)
    action:      Mapped[str | None] = mapped_column(Text)  # Qué acción tomar
    is_active:   Mapped[bool]       = mapped_column(Boolean, default=True, nullable=False)

    company = relationship("Company", lazy="select")

    __table_args__ = (
        Index("ix_supertrend_trends_company", "company_id"),
    )
