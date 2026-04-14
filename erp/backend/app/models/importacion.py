"""
Módulo IMPORTACION — órdenes de importación internacional.
Diseñado para el rubro INDUMENTARIA / OUTDOOR.

Workflow de estados:
  BORRADOR → CONFIRMADO → EMBARCADO → EN_TRANSITO → EN_ADUANA → DISPONIBLE
                                                              ↘ ANULADO
Características:
- Tracking de embarque por BL/AWB, factura comercial y DUA
- Costos en USD (FOB, flete, seguro) + costos ARS (derechos, IVA, estadística,
  percepciones, honorarios despachante)
- Liquidación automática: costo_landing_unit = (FOB + flete + seguro) / total unidades
- Ítems vinculados a variantes de producto (talle/color)
"""

from __future__ import annotations

import enum
from datetime import date
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import (
    String, ForeignKey, Numeric, Text, Date, Integer, Boolean
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.product import ProductVariant
    from app.models.provider import Provider
    from app.models.company import Company
    from app.models.user import User


class ImportOrderStatus(str, enum.Enum):
    BORRADOR    = "BORRADOR"
    CONFIRMADO  = "CONFIRMADO"
    EMBARCADO   = "EMBARCADO"
    EN_TRANSITO = "EN_TRANSITO"
    EN_ADUANA   = "EN_ADUANA"
    DISPONIBLE  = "DISPONIBLE"
    ANULADO     = "ANULADO"


class ImportOrderType(str, enum.Enum):
    MARITIMO   = "MARITIMO"
    AEREO      = "AEREO"
    TERRESTRE  = "TERRESTRE"


class ImportOrder(Base, TimestampMixin):
    """
    Cabecera de una orden de importación.
    Cada orden agrupa un lote de mercadería adquirida al exterior con su
    liquidación de costos de internación.
    """

    __tablename__ = "import_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Identificación
    numero: Mapped[str] = mapped_column(String(50), nullable=False)  # ej: IMP-2026-001
    referencia: Mapped[str | None] = mapped_column(String(200))      # ej: "Temporada OI 2026"

    # Tipo y estado
    tipo: Mapped[ImportOrderType] = mapped_column(
        sa.Enum(ImportOrderType, name="import_order_type", create_constraint=True),
        default=ImportOrderType.MARITIMO,
        nullable=False,
    )
    estado: Mapped[ImportOrderStatus] = mapped_column(
        sa.Enum(ImportOrderStatus, name="import_order_status", create_constraint=True),
        default=ImportOrderStatus.BORRADOR,
        nullable=False,
    )

    # Relaciones
    company_id:    Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    provider_id:   Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"),    nullable=False)

    # Origen / destino
    pais_origen:    Mapped[str | None] = mapped_column(String(100))  # ej: China, Brasil
    ciudad_origen:  Mapped[str | None] = mapped_column(String(100))  # ej: Guangzhou
    puerto_origen:  Mapped[str | None] = mapped_column(String(100))  # ej: Shanghai
    puerto_destino: Mapped[str | None] = mapped_column(String(100))  # ej: Buenos Aires
    incoterm:       Mapped[str | None] = mapped_column(String(10))   # FOB / CIF / EXW

    # Documentos
    numero_bl:               Mapped[str | None] = mapped_column(String(100))  # Bill of Lading / AWB
    numero_factura_proveedor:Mapped[str | None] = mapped_column(String(100))
    numero_dua:              Mapped[str | None] = mapped_column(String(100))  # DUA / MIC-DTA

    # Fechas
    fecha_orden:           Mapped[date | None] = mapped_column(Date)
    fecha_embarque:        Mapped[date | None] = mapped_column(Date)
    fecha_eta:             Mapped[date | None] = mapped_column(Date)  # ETA estimada
    fecha_arribo_real:     Mapped[date | None] = mapped_column(Date)
    fecha_despacho_aduana: Mapped[date | None] = mapped_column(Date)
    fecha_disponible:      Mapped[date | None] = mapped_column(Date)

    # ── Costos en USD ────────────────────────────────────────────────────────
    valor_fob_usd:       Mapped[float | None] = mapped_column(Numeric(14, 2))
    flete_usd:           Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    seguro_usd:          Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    otros_gastos_usd:    Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)

    # ── Costos en ARS (liquidación de importación) ───────────────────────────
    tipo_cambio:                 Mapped[float | None] = mapped_column(Numeric(10, 4))  # USD → ARS
    derechos_aduana_ars:         Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    iva_importacion_ars:         Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)   # 10.5% / 21%
    estadistica_ars:             Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)   # 3% sobre FOB+flete
    percepciones_ars:            Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    honorarios_despachante_ars:  Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    otros_costos_ars:            Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)

    # ── Resultado de liquidación ─────────────────────────────────────────────
    # Calculados automáticamente al confirmar la liquidación
    total_unidades:         Mapped[int | None]     = mapped_column(Integer)
    costo_landing_total_usd:Mapped[float | None]   = mapped_column(Numeric(14, 2))  # FOB+flete+seguro
    costo_unit_usd:         Mapped[float | None]   = mapped_column(Numeric(14, 4))  # por unidad
    liquidacion_confirmada: Mapped[bool]            = mapped_column(Boolean, default=False, nullable=False)

    notas: Mapped[str | None] = mapped_column(Text)

    # ── Relaciones ORM ───────────────────────────────────────────────────────
    items:      Mapped[list[ImportOrderItem]] = relationship(
        "ImportOrderItem", back_populates="import_order",
        cascade="all, delete-orphan", lazy="selectin"
    )
    provider:   Mapped[Provider]  = relationship("Provider",  lazy="selectin")
    company:    Mapped[Company]   = relationship("Company")
    created_by: Mapped[User]      = relationship("User")

    @property
    def cif_usd(self) -> float:
        """CIF = FOB + flete + seguro"""
        return (self.valor_fob_usd or 0) + (self.flete_usd or 0) + (self.seguro_usd or 0)

    @property
    def total_costos_ars(self) -> float:
        return (
            (self.derechos_aduana_ars or 0)
            + (self.iva_importacion_ars or 0)
            + (self.estadistica_ars or 0)
            + (self.percepciones_ars or 0)
            + (self.honorarios_despachante_ars or 0)
            + (self.otros_costos_ars or 0)
        )


class ImportOrderItem(Base, TimestampMixin):
    """
    Ítem de una orden de importación — un artículo / variante.
    El `costo_landing_unit_usd` se calcula al liquidar la orden.
    """

    __tablename__ = "import_order_items"

    id:              Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    import_order_id: Mapped[int] = mapped_column(ForeignKey("import_orders.id"), nullable=False)

    # Producto (puede ser None si aún no existe la variante en el sistema)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("product_variants.id"))

    # Datos de la factura comercial del proveedor
    codigo_comercial:       Mapped[str | None] = mapped_column(String(100))
    descripcion_comercial:  Mapped[str]         = mapped_column(String(500), nullable=False)
    posicion_arancelaria:   Mapped[str | None] = mapped_column(String(20))   # ej: 6109.10.00

    cantidad:               Mapped[int]   = mapped_column(Integer, nullable=False)
    precio_unitario_usd:    Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    subtotal_usd:           Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # cantidad * precio

    # Calculado al liquidar
    costo_landing_unit_usd: Mapped[float | None] = mapped_column(Numeric(14, 4))

    # Relaciones
    import_order: Mapped[ImportOrder]     = relationship("ImportOrder", back_populates="items")
    variant:      Mapped[ProductVariant | None] = relationship("ProductVariant", lazy="selectin")
