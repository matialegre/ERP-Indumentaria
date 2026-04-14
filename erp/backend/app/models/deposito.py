"""
Modelos DEPOSITO — Gestión de depósito para indumentaria

Tablas:
  stock_by_local      — stock de cada variante por local/sucursal
  transferencias      — documentos de traslado entre locales / depósito central
  transferencia_items — detalle de unidades por variante en cada transferencia
  conteos_inventario  — cabecera de un conteo físico
  conteo_items        — ítem de conteo: stock_sistema vs stock_fisico
"""

import enum
from sqlalchemy import String, ForeignKey, Text, Enum, Integer, Boolean, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


# ══════════════════════════════════════════════════════
#  ENUMS
# ══════════════════════════════════════════════════════

class TransferenciaEstado(str, enum.Enum):
    BORRADOR    = "BORRADOR"     # en preparación
    CONFIRMADA  = "CONFIRMADA"   # enviada (stock descontado del origen)
    RECIBIDA    = "RECIBIDA"     # recibida en destino (stock sumado)
    ANULADA     = "ANULADA"      # cancelada


class ConteoEstado(str, enum.Enum):
    EN_CURSO  = "EN_CURSO"   # operario ingresando cantidades
    APLICADO  = "APLICADO"   # diferencias aplicadas al stock
    CANCELADO = "CANCELADO"


# ══════════════════════════════════════════════════════
#  STOCK POR LOCAL
# ══════════════════════════════════════════════════════

class StockLocal(Base, TimestampMixin):
    """
    Stock de una variante en una ubicación específica.

    local_id = None → DEPÓSITO CENTRAL (stock sin asignar a sucursal)

    La suma de todas las StockLocal de una variante debería coincidir
    con ProductVariant.stock (stock global).
    """
    __tablename__ = "stock_by_local"

    id:         Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False, index=True)
    local_id:   Mapped[int | None] = mapped_column(ForeignKey("locals.id"), nullable=True, index=True)  # None = depósito central
    cantidad:   Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Multi-tenant
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Relaciones
    variant = relationship("ProductVariant", lazy="selectin")
    local   = relationship("Local", lazy="selectin")


# ══════════════════════════════════════════════════════
#  TRANSFERENCIAS
# ══════════════════════════════════════════════════════

class Transferencia(Base, TimestampMixin):
    """
    Documento de traslado de mercadería entre dos ubicaciones.

    origen_local_id / destino_local_id = None → DEPÓSITO CENTRAL.
    """
    __tablename__ = "transferencias"

    id:                  Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    numero:              Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # TRF-00001
    estado:              Mapped[TransferenciaEstado] = mapped_column(
                             Enum(TransferenciaEstado, name="transferencia_estado"),
                             default=TransferenciaEstado.BORRADOR,
                             nullable=False,
                         )

    # Origen y destino (None = depósito central)
    origen_local_id:     Mapped[int | None] = mapped_column(ForeignKey("locals.id"), nullable=True)
    destino_local_id:    Mapped[int | None] = mapped_column(ForeignKey("locals.id"), nullable=True)

    notas:               Mapped[str | None] = mapped_column(Text)

    # Multi-tenant y auditoría
    company_id:          Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    creado_por_id:       Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    confirmado_por_id:   Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    recibido_por_id:     Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Relaciones
    origen_local     = relationship("Local", foreign_keys=[origen_local_id],  lazy="selectin")
    destino_local    = relationship("Local", foreign_keys=[destino_local_id], lazy="selectin")
    creado_por       = relationship("User",  foreign_keys=[creado_por_id],    lazy="selectin")
    confirmado_por   = relationship("User",  foreign_keys=[confirmado_por_id],lazy="selectin")
    recibido_por     = relationship("User",  foreign_keys=[recibido_por_id],  lazy="selectin")
    items            = relationship("TransferenciaItem", back_populates="transferencia",
                                   lazy="selectin", cascade="all, delete-orphan")


class TransferenciaItem(Base):
    """Detalle de una transferencia: qué variante y cuántas unidades."""
    __tablename__ = "transferencia_items"

    id:                  Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transferencia_id:    Mapped[int] = mapped_column(ForeignKey("transferencias.id"), nullable=False, index=True)
    variant_id:          Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    cantidad_enviada:    Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad_recibida:   Mapped[int | None] = mapped_column(Integer, nullable=True)  # se completa al recibir
    notas_item:          Mapped[str | None] = mapped_column(String(300))

    # Relaciones
    transferencia = relationship("Transferencia", back_populates="items")
    variant       = relationship("ProductVariant", lazy="selectin")


# ══════════════════════════════════════════════════════
#  CONTEO FÍSICO DE INVENTARIO
# ══════════════════════════════════════════════════════

class ConteoInventario(Base, TimestampMixin):
    """
    Cabecera de un conteo físico de inventario.
    Se puede hacer por local (local_id) o para el depósito central (local_id=None).
    """
    __tablename__ = "conteos_inventario"

    id:           Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    local_id:     Mapped[int | None] = mapped_column(ForeignKey("locals.id"), nullable=True)
    estado:       Mapped[ConteoEstado] = mapped_column(
                      Enum(ConteoEstado, name="conteo_estado"),
                      default=ConteoEstado.EN_CURSO,
                      nullable=False,
                  )
    notas:        Mapped[str | None] = mapped_column(Text)

    # Multi-tenant y auditoría
    company_id:   Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    creado_por_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    aplicado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Relaciones
    local        = relationship("Local", foreign_keys=[local_id], lazy="selectin")
    creado_por   = relationship("User",  foreign_keys=[creado_por_id],    lazy="selectin")
    aplicado_por = relationship("User",  foreign_keys=[aplicado_por_id],  lazy="selectin")
    items        = relationship("ConteoItem", back_populates="conteo",
                                lazy="selectin", cascade="all, delete-orphan")


class ConteoItem(Base):
    """
    Ítem de un conteo físico.
    stock_sistema = stock al momento de iniciar el conteo.
    stock_fisico  = lo que el operario contó en el depósito.
    diferencia    = stock_fisico - stock_sistema (calculado en apply).
    """
    __tablename__ = "conteo_items"

    id:            Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    conteo_id:     Mapped[int] = mapped_column(ForeignKey("conteos_inventario.id"), nullable=False, index=True)
    variant_id:    Mapped[int] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    stock_sistema: Mapped[int] = mapped_column(Integer, nullable=False)   # snapshot al iniciar
    stock_fisico:  Mapped[int | None] = mapped_column(Integer, nullable=True)  # ingresado por operario
    diferencia:    Mapped[int | None] = mapped_column(Integer, nullable=True)  # calculado al aplicar
    ajustado:      Mapped[bool] = mapped_column(Boolean, default=False)

    # Relaciones
    conteo  = relationship("ConteoInventario", back_populates="items")
    variant = relationship("ProductVariant", lazy="selectin")
