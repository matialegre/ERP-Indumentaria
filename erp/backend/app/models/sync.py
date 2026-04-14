"""
Modelos de sincronización, AFIP, storage, WhatsApp y MercadoPago.
Event Sourcing + CRDT Hybrid para offline-first.
"""

import enum
from sqlalchemy import (
    String, Boolean, ForeignKey, Numeric, Text, Date, Enum,
    Integer, BigInteger, JSON, DateTime, Index, UniqueConstraint,
    Sequence,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, date
from typing import Optional
from app.db.base import Base, TimestampMixin


# ── Enums ──────────────────────────────────────────────

class DeviceType(str, enum.Enum):
    PC = "PC"
    TABLET = "TABLET"
    PHONE = "PHONE"
    SERVER = "SERVER"


class ConflictType(str, enum.Enum):
    STOCK_NEGATIVE = "STOCK_NEGATIVE"
    DUPLICATE_SALE_NUMBER = "DUPLICATE_SALE_NUMBER"
    FIELD_COLLISION = "FIELD_COLLISION"
    STALE_UPDATE = "STALE_UPDATE"


class ConflictResolution(str, enum.Enum):
    AUTO_RESOLVED = "AUTO_RESOLVED"
    MANUAL_PENDING = "MANUAL_PENDING"
    MANUAL_RESOLVED = "MANUAL_RESOLVED"
    IGNORED = "IGNORED"


class AfipAmbiente(str, enum.Enum):
    TESTING = "TESTING"
    PRODUCCION = "PRODUCCION"


class AfipQueueStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CONTINGENCY = "CONTINGENCY"


class StorageBackend(str, enum.Enum):
    LOCAL = "LOCAL"
    S3 = "S3"
    CLOUDFLARE = "CLOUDFLARE"


class SyncPriority(str, enum.Enum):
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


class WAMessageStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"
    DISABLED = "DISABLED"


class MPTransactionStatus(str, enum.Enum):
    CREATED = "CREATED"
    QR_GENERATED = "QR_GENERATED"
    LINK_SENT = "LINK_SENT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REFUNDED = "REFUNDED"


# ── Modelos ────────────────────────────────────────────

server_sequence_seq = Sequence("sync_events_server_sequence_seq")


class SyncEvent(Base, TimestampMixin):
    """Immutable event log — core of the event sourcing system"""
    __tablename__ = "sync_events"
    __table_args__ = (
        Index("ix_sync_company_server_seq", "company_id", "server_sequence"),
        Index("ix_sync_device_seq", "device_id", "sequence_num"),
        Index("ix_sync_aggregate", "aggregate_type", "aggregate_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    aggregate_type: Mapped[str] = mapped_column(String(50), nullable=False)
    aggregate_id: Mapped[str] = mapped_column(String(200), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # GAP-4: before-state (None for INSERT), required for field-level merge
    payload_antes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # GAP-4: list of field names that changed (None = unknown / full replace)
    campos_modificados: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True,
    )
    # GAP-4: catalog version on the device when event was emitted — detects stale devices
    version_catalogo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    device_id: Mapped[str] = mapped_column(String(100), nullable=False)
    sequence_num: Mapped[int] = mapped_column(BigInteger, nullable=False)

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    local_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locals.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    server_sequence: Mapped[int] = mapped_column(
        BigInteger, server_sequence_seq, server_default=server_sequence_seq.next_value(),
        nullable=False,
    )
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    company = relationship("Company", lazy="select")
    user = relationship("User", lazy="selectin")


class DeviceRegistry(Base, TimestampMixin):
    """Registered devices that can sync"""
    __tablename__ = "device_registry"
    __table_args__ = (
        Index("ix_device_company", "company_id"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    device_type: Mapped[DeviceType] = mapped_column(
        Enum(DeviceType, name="device_type_enum"), nullable=False,
    )

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    local_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locals.id"))
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_sync_sequence: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    app_version: Mapped[Optional[str]] = mapped_column(String(50))
    os_info: Mapped[Optional[str]] = mapped_column(String(200))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    company = relationship("Company", lazy="select")
    local = relationship("Local", lazy="selectin")
    user = relationship("User", lazy="selectin")


class SyncConflict(Base, TimestampMixin):
    """Records of conflicts detected during sync"""
    __tablename__ = "sync_conflicts"
    __table_args__ = (
        Index("ix_conflict_company_resolution", "company_id", "resolution"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sync_events.id"), nullable=False,
    )
    conflicting_event_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("sync_events.id"),
    )

    conflict_type: Mapped[ConflictType] = mapped_column(
        Enum(ConflictType, name="conflict_type_enum"), nullable=False,
    )
    aggregate_type: Mapped[str] = mapped_column(String(50), nullable=False)
    aggregate_id: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str] = mapped_column(Text, nullable=False)
    resolution: Mapped[ConflictResolution] = mapped_column(
        Enum(ConflictResolution, name="conflict_resolution_enum"),
        default=ConflictResolution.MANUAL_PENDING, nullable=False,
    )
    resolution_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    resolved_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    # Relationships
    event = relationship("SyncEvent", foreign_keys=[event_id], lazy="selectin")
    conflicting_event = relationship(
        "SyncEvent", foreign_keys=[conflicting_event_id], lazy="select",
    )
    resolved_by = relationship("User", lazy="select")


class AfipConfig(Base, TimestampMixin):
    """AFIP configuration per company"""
    __tablename__ = "afip_configs"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_afip_company"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    cuit: Mapped[str] = mapped_column(String(13), nullable=False)
    punto_venta: Mapped[int] = mapped_column(Integer, nullable=False)
    ambiente: Mapped[AfipAmbiente] = mapped_column(
        Enum(AfipAmbiente, name="afip_ambiente_enum"),
        default=AfipAmbiente.TESTING, nullable=False,
    )

    cert_path: Mapped[Optional[str]] = mapped_column(String(500))
    key_path: Mapped[Optional[str]] = mapped_column(String(500))
    cert_expiry: Mapped[Optional[date]] = mapped_column(Date)

    # WSAA token cache
    token: Mapped[Optional[str]] = mapped_column(Text)
    sign: Mapped[Optional[str]] = mapped_column(Text)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Contingency series [DN-3]
    contingency_prefix: Mapped[str] = mapped_column(
        String(5), default="C", nullable=False,
    )
    contingency_next_number: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    company = relationship("Company", lazy="select")


class AfipQueue(Base, TimestampMixin):
    """Queue for AFIP submission — handles retries and contingency [DN-3]"""
    __tablename__ = "afip_queue"
    __table_args__ = (
        Index("ix_afip_queue_company_status", "company_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    status: Mapped[AfipQueueStatus] = mapped_column(
        Enum(AfipQueueStatus, name="afip_queue_status_enum"),
        default=AfipQueueStatus.PENDING, nullable=False,
    )

    # AFIP response
    cae: Mapped[Optional[str]] = mapped_column(String(20))
    cae_expiry: Mapped[Optional[date]] = mapped_column(Date)
    cbte_nro: Mapped[Optional[int]] = mapped_column(Integer)

    # Contingency [DN-3]
    contingency_number: Mapped[Optional[str]] = mapped_column(String(20))
    is_contingency: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    regularized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    regularized_sale_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales.id"))

    # Retry logic
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    sale = relationship("Sale", foreign_keys=[sale_id], lazy="selectin")
    regularized_sale = relationship("Sale", foreign_keys=[regularized_sale_id], lazy="select")
    company = relationship("Company", lazy="select")


class StorageFile(Base, TimestampMixin):
    """Abstract file storage — local fs now, S3/Cloudflare later [DN-4]"""
    __tablename__ = "storage_files"
    __table_args__ = (
        Index("ix_storage_entity", "entity_type", "entity_id"),
        Index("ix_storage_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    storage_backend: Mapped[StorageBackend] = mapped_column(
        Enum(StorageBackend, name="storage_backend_enum"),
        default=StorageBackend.LOCAL, nullable=False,
    )

    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Linked entity
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    category: Mapped[Optional[str]] = mapped_column(String(50))

    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Sync
    is_synced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sync_priority: Mapped[SyncPriority] = mapped_column(
        Enum(SyncPriority, name="sync_priority_enum"),
        default=SyncPriority.NORMAL, nullable=False,
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    company = relationship("Company", lazy="select")
    uploaded_by = relationship("User", lazy="selectin")


class WhatsAppMessage(Base, TimestampMixin):
    """WhatsApp message queue — STUB, not sending until API configured [DN-6]"""
    __tablename__ = "whatsapp_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
    template_params: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[WAMessageStatus] = mapped_column(
        Enum(WAMessageStatus, name="wa_message_status_enum"),
        default=WAMessageStatus.DISABLED, nullable=False,
    )

    # Reference
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)

    # API response (when implemented)
    wa_message_id: Mapped[Optional[str]] = mapped_column(String(100))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    company = relationship("Company", lazy="select")


class MercadoPagoConfig(Base, TimestampMixin):
    """Mercado Pago config per company"""
    __tablename__ = "mercadopago_configs"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_mp_company"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)

    access_token: Mapped[Optional[str]] = mapped_column(Text)
    public_key: Mapped[Optional[str]] = mapped_column(String(200))

    # Webhook
    webhook_secret: Mapped[Optional[str]] = mapped_column(String(200))
    webhook_url: Mapped[Optional[str]] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    company = relationship("Company", lazy="select")


class MercadoPagoTransaction(Base, TimestampMixin):
    """MP transaction tracking"""
    __tablename__ = "mercadopago_transactions"
    __table_args__ = (
        Index("ix_mp_tx_company", "company_id"),
        Index("ix_mp_tx_sale", "sale_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    sale_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales.id"))

    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(100))
    mp_status: Mapped[Optional[str]] = mapped_column(String(30))
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    qr_data: Mapped[Optional[str]] = mapped_column(Text)
    payment_link: Mapped[Optional[str]] = mapped_column(String(500))

    status: Mapped[MPTransactionStatus] = mapped_column(
        Enum(MPTransactionStatus, name="mp_tx_status_enum"),
        default=MPTransactionStatus.CREATED, nullable=False,
    )

    webhook_received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    webhook_data: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Relationships
    sale = relationship("Sale", lazy="selectin")
    company = relationship("Company", lazy="select")


# ══════════════════════════════════════════════════════
# GAP-8: COLA DE REINTENTOS GENÉRICA
# ══════════════════════════════════════════════════════

class SyncRetryQueueStatus(str, enum.Enum):
    PENDIENTE   = "PENDIENTE"
    PROCESANDO  = "PROCESANDO"
    COMPLETADO  = "COMPLETADO"
    FALLIDO     = "FALLIDO"    # Superó max_intentos o error no reintentable


class SyncRetryErrorType(str, enum.Enum):
    RED         = "RED"          # Timeout / connection error → reintentar
    SERVIDOR    = "SERVIDOR"     # 5xx del propio servidor → reintentar
    CONFLICTO   = "CONFLICTO"    # Conflict lógico → requiere intervención
    VALIDACION  = "VALIDACION"   # Payload inválido → no reintentar
    DESCONOCIDO = "DESCONOCIDO"  # Otros errores → reintentar con backoff largo


class SyncRetryQueue(Base, TimestampMixin):
    """
    Cola de reintentos para eventos de sync que fallaron en push_events.

    Política de reintentos (ref: docs/conflict-resolution.md §6):
      - RED, SERVIDOR    → backoff exponencial, máx max_intentos
      - CONFLICTO        → no reintentar automáticamente (requiere intervención)
      - VALIDACION       → no reintentar (payload inválido desde el origen)
      - DESCONOCIDO      → backoff exponencial largo

    Compatible con la tabla cola_sync definida en schema/002_sync.sql.
    """
    __tablename__ = "sync_retry_queue"
    __table_args__ = (
        Index("ix_retry_queue_status", "status"),
        Index("ix_retry_queue_next_retry", "next_retry_at"),
        Index("ix_retry_queue_event", "event_id"),
        Index("ix_retry_queue_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # El evento que falló (puede ser None si el fallo fue antes de insertar el evento)
    event_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("sync_events.id", ondelete="SET NULL"), nullable=True,
    )
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False)

    # El payload original del EventIn (serializado) para poder reintentar
    event_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)

    status: Mapped[SyncRetryQueueStatus] = mapped_column(
        Enum(SyncRetryQueueStatus, name="sync_retry_status_enum"),
        default=SyncRetryQueueStatus.PENDIENTE, nullable=False,
    )
    error_type: Mapped[SyncRetryErrorType] = mapped_column(
        Enum(SyncRetryErrorType, name="sync_retry_error_type_enum"),
        default=SyncRetryErrorType.DESCONOCIDO, nullable=False,
    )

    intentos:       Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_intentos:   Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    ultimo_error:   Mapped[Optional[str]] = mapped_column(Text)
    next_retry_at:  Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    event   = relationship("SyncEvent", lazy="select")
    company = relationship("Company", lazy="select")
