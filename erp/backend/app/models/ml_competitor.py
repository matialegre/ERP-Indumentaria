"""
Modelos para seguimiento de competencia en MercadoLibre Argentina.

MLTrackedSeller  — vendedor de ML que queremos rastrear
MLCompetitorSnapshot — snapshot periódico de sus publicaciones activas
"""

from datetime import datetime
from sqlalchemy import String, Text, Boolean, Integer, Numeric, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class MLTrackedSeller(Base, TimestampMixin):
    """Vendedor de MercadoLibre que la empresa quiere monitorear."""
    __tablename__ = "ml_tracked_sellers"

    id:          Mapped[int]  = mapped_column(primary_key=True, autoincrement=True)
    company_id:  Mapped[int]  = mapped_column(ForeignKey("companies.id"), nullable=False)
    seller_id:   Mapped[str]  = mapped_column(String(50), nullable=False)  # ML user_id numérico
    nickname:    Mapped[str | None] = mapped_column(String(200))            # nickname ML (auto-fetch)
    notes:       Mapped[str | None] = mapped_column(Text)
    is_active:   Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    check_interval_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    company   = relationship("Company", lazy="select")
    snapshots = relationship("MLCompetitorSnapshot", back_populates="seller_ref",
                             cascade="all, delete-orphan", lazy="select")

    __table_args__ = (
        UniqueConstraint("company_id", "seller_id", name="uq_ml_tracked_seller"),
        Index("ix_ml_tracked_sellers_company", "company_id"),
    )


class MLCompetitorSnapshot(Base):
    """
    Snapshot de una publicación de un competidor en un momento dado.
    Cada escaneo genera un registro por publicación activa.
    """
    __tablename__ = "ml_competitor_snapshots"

    id:                Mapped[int]   = mapped_column(primary_key=True, autoincrement=True)
    company_id:        Mapped[int]   = mapped_column(ForeignKey("companies.id"), nullable=False)
    tracked_seller_id: Mapped[int]   = mapped_column(ForeignKey("ml_tracked_sellers.id", ondelete="CASCADE"), nullable=False)
    seller_id:         Mapped[str]   = mapped_column(String(50), nullable=False)
    item_id:           Mapped[str]   = mapped_column(String(50), nullable=False)
    title:             Mapped[str]   = mapped_column(String(500), nullable=False)
    price:             Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    sold_quantity:     Mapped[int]   = mapped_column(Integer, default=0, nullable=False)
    available_quantity: Mapped[int]  = mapped_column(Integer, default=0, nullable=False)
    thumbnail:         Mapped[str | None] = mapped_column(String(500))
    permalink:         Mapped[str | None] = mapped_column(String(500))
    scanned_at:        Mapped[datetime]   = mapped_column(DateTime(timezone=True), nullable=False)

    # Campos calculados al insertar (diff respecto al snapshot anterior)
    price_prev:       Mapped[float | None] = mapped_column(Numeric(14, 2))
    price_changed:    Mapped[bool]         = mapped_column(Boolean, default=False, nullable=False)
    sales_since_last: Mapped[int]          = mapped_column(Integer, default=0, nullable=False)

    original_price:    Mapped[float | None] = mapped_column(Numeric(14, 2))
    status:            Mapped[str | None]   = mapped_column(String(50))  # active, paused, closed
    catalog_listing:   Mapped[bool]         = mapped_column(Boolean, default=False, nullable=False)

    seller_ref = relationship("MLTrackedSeller", back_populates="snapshots")
    variants = relationship("MLCompetitorVariantSnapshot", cascade="all, delete-orphan", lazy="select",
                           foreign_keys="MLCompetitorVariantSnapshot.snapshot_id")

    __table_args__ = (
        Index("ix_ml_snapshots_seller_item", "tracked_seller_id", "item_id"),
        Index("ix_ml_snapshots_scanned_at", "scanned_at"),
        Index("ix_ml_snapshots_company", "company_id"),
    )


class MLCompetitorVariantSnapshot(Base):
    """Snapshot de una variante específica de un item de un competidor."""
    __tablename__ = "ml_competitor_variant_snapshots"

    id:                Mapped[int]   = mapped_column(primary_key=True, autoincrement=True)
    snapshot_id:       Mapped[int]   = mapped_column(ForeignKey("ml_competitor_snapshots.id", ondelete="CASCADE"), nullable=False)
    company_id:        Mapped[int]   = mapped_column(ForeignKey("companies.id"), nullable=False)
    item_id:           Mapped[str]   = mapped_column(String(50), nullable=False)
    variation_id:      Mapped[str]   = mapped_column(String(50), nullable=False)
    attributes_json:   Mapped[str | None] = mapped_column(Text)  # JSON: {"Talle": "M", "Color": "Negro"}
    available_quantity: Mapped[int]  = mapped_column(Integer, default=0, nullable=False)
    price:             Mapped[float | None] = mapped_column(Numeric(14, 2))
    scanned_at:        Mapped[datetime]   = mapped_column(DateTime(timezone=True), nullable=False)

    # Diff vs previous
    stock_prev:        Mapped[int | None] = mapped_column(Integer)
    stock_changed:     Mapped[bool]       = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_ml_var_snapshots_snapshot", "snapshot_id"),
        Index("ix_ml_var_snapshots_item_var", "item_id", "variation_id"),
        Index("ix_ml_var_snapshots_company", "company_id"),
    )
