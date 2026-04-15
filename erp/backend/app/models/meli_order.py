"""
Modelo para órdenes de MercadoLibre sincronizadas al ERP.
Replica la lógica de la tabla orders_meli del sistema standalone (SQL Server),
adaptada a PostgreSQL con multi-tenant (company_id).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, BigInteger, JSON
from app.db.base import Base


class MeliOrder(Base):
    __tablename__ = "meli_orders"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)

    # ── Identificadores ML ─────────────────────────────────────────────────
    order_id = Column(BigInteger, nullable=False, index=True)
    pack_id = Column(BigInteger, nullable=True, index=True)
    item_id = Column(String(50), nullable=True)
    shipment_id = Column(BigInteger, nullable=True)
    variation_id = Column(String(50), nullable=True)

    # ── Producto ──────────────────────────────────────────────────────────
    item_title = Column(String(500), nullable=True)
    sku = Column(String(100), nullable=True, index=True)
    sku_real = Column(String(100), nullable=True)  # SKU resuelto (sin sufijo -OUT)
    barcode = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=True, default=1)
    unit_price = Column(Float, nullable=True)
    talle = Column(String(50), nullable=True)
    color = Column(String(100), nullable=True)

    # ── Comprador ─────────────────────────────────────────────────────────
    buyer_nickname = Column(String(200), nullable=True)
    buyer_id = Column(BigInteger, nullable=True)

    # ── Envío ─────────────────────────────────────────────────────────────
    shipping_status = Column(String(100), nullable=True)
    shipping_substatus = Column(String(100), nullable=True)
    split_status = Column(String(50), nullable=True)
    fulfillment = Column(String(50), nullable=True)  # full | flex | drop_off | xd | etc

    # ── Orden ─────────────────────────────────────────────────────────────
    order_status = Column(String(50), nullable=True, index=True)   # paid | confirmed | cancelled
    tags = Column(Text, nullable=True)       # JSON list
    nota = Column(Text, nullable=True)       # nota del vendedor en ML
    comentario = Column(Text, nullable=True) # comentario interno ERP
    venta_tipo = Column(String(50), nullable=True)  # single | pack

    # ── Stock por depósito (snapshot al sync) ─────────────────────────────
    stock_dep = Column(Integer, nullable=True)
    stock_mundoal = Column(Integer, nullable=True)
    stock_monbahia = Column(Integer, nullable=True)
    stock_mtgbbps = Column(Integer, nullable=True)
    stock_mundocab = Column(Integer, nullable=True)
    stock_nqnshop = Column(Integer, nullable=True)
    stock_mtgcom = Column(Integer, nullable=True)
    stock_mtgroca = Column(Integer, nullable=True)
    stock_mundoroc = Column(Integer, nullable=True)
    stock_nqnalb = Column(Integer, nullable=True)
    stock_real = Column(Integer, nullable=True)
    stock_reservado = Column(Integer, nullable=True)
    resultante = Column(Integer, nullable=True)

    # ── Depósito / Asignación ─────────────────────────────────────────────
    deposito_asignado = Column(String(100), nullable=True)
    asignacion_detalle = Column(JSON, nullable=True)  # audit trail JSON
    asignado_flag = Column(Boolean, default=False)
    fecha_asignacion = Column(DateTime, nullable=True)

    # ── Movimiento Dragonfish ─────────────────────────────────────────────
    movimiento_realizado = Column(Boolean, default=False)
    numero_movimiento = Column(Integer, nullable=True)
    observacion_movimiento = Column(Text, nullable=True)

    # ── Flags ─────────────────────────────────────────────────────────────
    agotamiento_flag = Column(Boolean, default=False)
    ready_to_print = Column(Boolean, default=False)

    # ── Estado de picking ─────────────────────────────────────────────────
    # PENDIENTE | PICKEADO | FALLADO | CANCELADO
    estado_picking = Column(String(20), nullable=False, default="PENDIENTE", index=True)
    motivo_falla = Column(String(500), nullable=True)
    printed = Column(Boolean, nullable=False, default=False)

    # ── Multi-cuenta ─────────────────────────────────────────────────────
    meli_account = Column(String(20), nullable=True)  # "1" o "2"
    seller_id = Column(String(50), nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────
    fecha_orden = Column(DateTime, nullable=True)    # date_created en ML
    fecha_sync = Column(DateTime, nullable=True)     # última vez que se sincronizó
    fecha_picking = Column(DateTime, nullable=True)  # cuándo se pickeó
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
