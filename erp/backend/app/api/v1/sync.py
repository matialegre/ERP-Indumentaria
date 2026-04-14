"""
Router de Sincronización + Storage
Event sourcing push/pull, device registry, conflict resolution, file storage.

GAP-1 fix: cada evento se procesa en su propia transacción SERIALIZABLE con retry.
GAP-2 fix: detección de stock lee desde la DB, no del payload del cliente.
GAP-4 fix: EventIn incluye payload_antes, campos_modificados, version_catalogo.
GAP-5 fix: HANDLERS routing table en app/services/sync_handlers.py.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import time
import uuid
import os

from app.db.session import get_db
from app.models.sync import (
    SyncEvent, DeviceRegistry, SyncConflict, StorageFile,
    DeviceType, ConflictType, ConflictResolution, StorageBackend, SyncPriority,
)
from app.services.sync_handlers import HANDLERS, HandlerResult
from app.services.sync_queue import enqueue as enqueue_retry

logger = logging.getLogger(__name__)
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.module_guard import RequireModule


# ── Storage base path ─────────────────────────────────

STORAGE_ROOT = r"D:\ERP MUNDO OUTDOOR\storage"


# ══════════════════════════════════════════════════════
# SYNC ROUTER
# ══════════════════════════════════════════════════════

sync_router = APIRouter(
    prefix="/sync",
    tags=["Sincronización"],
    dependencies=[Depends(RequireModule("SYNC"))],
)


# ── Schemas ────────────────────────────────────────────

class EventIn(BaseModel):
    event_id: str
    aggregate_type: str
    aggregate_id: str
    event_type: str
    # GAP-4: state BEFORE the change (None for INSERT events)
    payload_antes: Optional[dict] = None
    payload: dict
    # GAP-4: list of field names that changed (None = full replace / unknown)
    campos_modificados: Optional[list[str]] = None
    metadata: Optional[dict] = None
    sequence_num: int
    # GAP-4: catalog version the device had when it emitted this event
    version_catalogo: int = 0


class PushEventsIn(BaseModel):
    device_id: str
    events: list[EventIn]


class ConflictOut(BaseModel):
    id: int
    event_id: str
    conflicting_event_id: str | None
    conflict_type: str
    aggregate_type: str
    aggregate_id: str
    description: str
    resolution: str
    resolved_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PushEventsOut(BaseModel):
    processed: int
    duplicates: int
    queued_for_retry: int    # GAP-8: eventos que fallaron y quedaron en cola de reintentos
    conflicts: list[ConflictOut]
    server_sequence: int


class EventOut(BaseModel):
    id: str
    aggregate_type: str
    aggregate_id: str
    event_type: str
    payload: dict
    metadata: dict | None = None
    device_id: str
    sequence_num: int
    server_sequence: int
    user_id: int
    local_id: int | None
    is_processed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceRegisterIn(BaseModel):
    device_id: str
    name: str
    device_type: str  # PC | TABLET | PHONE | SERVER
    local_id: int | None = None


class DeviceOut(BaseModel):
    id: str
    name: str
    device_type: str
    company_id: int
    local_id: int | None
    user_id: int | None
    last_sync_at: datetime | None
    last_sync_sequence: int
    app_version: str | None
    os_info: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SyncStatusOut(BaseModel):
    device_id: str
    last_sync_at: datetime | None
    last_sync_sequence: int
    pending_events: int
    conflicts_pending: int


class ConflictResolveIn(BaseModel):
    resolution: str  # AUTO_RESOLVED | MANUAL_RESOLVED | IGNORED
    resolution_data: dict | None = None


# ── Endpoints ──────────────────────────────────────────

@sync_router.post("/events", response_model=PushEventsOut)
def push_events(
    body: PushEventsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Receive batch of events from a device.

    GAP-1: each event is processed in its own SERIALIZABLE transaction with
    automatic retry on serialization failures (up to 3 attempts).

    GAP-2: stock calculations are always performed against the DB — the
    client's payload.resulting_stock is never trusted.

    GAP-5: events are routed to entity-specific handlers via HANDLERS table.
    """
    # ── Validate device (READ COMMITTED is fine here) ────────────────────
    device = db.query(DeviceRegistry).filter(
        DeviceRegistry.id == body.device_id,
        DeviceRegistry.is_active == True,
    ).first()
    if not device:
        raise HTTPException(404, "Dispositivo no registrado o inactivo")
    if device.company_id != current_user.company_id:
        raise HTTPException(403, "Dispositivo no pertenece a tu empresa")

    # Commit device validation so the next per-event TX starts clean
    db.commit()

    processed = 0
    duplicates = 0
    queued_for_retry = 0
    all_conflicts: list[SyncConflict] = []

    for ev in body.events:
        outcome = _process_single_event(ev, device, current_user, db)
        if outcome.get("duplicate"):
            duplicates += 1
        elif outcome.get("queued_for_retry"):
            queued_for_retry += 1
        else:
            processed += 1
            all_conflicts.extend(outcome["conflicts"])

    # ── Update device watermark (outside per-event TXs) ──────────────────
    latest_seq = db.execute(
        text("SELECT MAX(server_sequence) FROM sync_events WHERE company_id = :cid"),
        {"cid": current_user.company_id},
    ).scalar() or 0

    db.execute(
        text("""
            UPDATE device_registry
            SET last_sync_at = NOW(), last_sync_sequence = :seq, user_id = :uid
            WHERE id = :did
        """),
        {"seq": latest_seq, "uid": current_user.id, "did": device.id},
    )
    db.commit()

    conflict_outs = [
        ConflictOut(
            id=c.id,
            event_id=c.event_id,
            conflicting_event_id=c.conflicting_event_id,
            conflict_type=c.conflict_type.value,
            aggregate_type=c.aggregate_type,
            aggregate_id=c.aggregate_id,
            description=c.description,
            resolution=c.resolution.value,
            resolved_at=c.resolved_at,
            created_at=c.created_at,
        )
        for c in all_conflicts
    ]

    return PushEventsOut(
        processed=processed,
        duplicates=duplicates,
        queued_for_retry=queued_for_retry,
        conflicts=conflict_outs,
        server_sequence=latest_seq,
    )


def _process_single_event(
    ev: EventIn,
    device: DeviceRegistry,
    user: "User",
    db: Session,
    max_retries: int = 3,
) -> dict:
    """
    Process ONE event in its own SERIALIZABLE transaction.

    GAP-1: SERIALIZABLE isolation prevents two simultaneous devices from
    both seeing stock >= 0 before either commits the deduction.

    GAP-2: handlers read current stock from the DB (not from ev.payload).

    Returns {"duplicate": bool, "conflicts": list[SyncConflict]}.
    Raises on non-serialization errors (caller handles).
    """
    for attempt in range(max_retries):
        try:
            # SET TRANSACTION must be the FIRST statement in the transaction.
            # After db.commit() the session starts a new implicit transaction
            # on the next execute(), so this is safe.
            db.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))

            # ── Idempotency: never process the same event twice ───────────
            existing = db.execute(
                text("SELECT id FROM sync_events WHERE id = :eid"),
                {"eid": ev.event_id},
            ).fetchone()
            if existing:
                db.rollback()
                return {"duplicate": True, "conflicts": []}

            # ── Insert the event record ───────────────────────────────────
            sync_event = SyncEvent(
                id=ev.event_id,
                aggregate_type=ev.aggregate_type,
                aggregate_id=ev.aggregate_id,
                event_type=ev.event_type,
                payload=ev.payload,
                payload_antes=ev.payload_antes,
                campos_modificados=ev.campos_modificados,
                metadata_=ev.metadata,
                version_catalogo=ev.version_catalogo,
                device_id=device.id,
                sequence_num=ev.sequence_num,
                company_id=user.company_id,
                local_id=device.local_id,
                user_id=user.id,
                is_processed=False,
            )
            db.add(sync_event)
            db.flush()  # get server_sequence assigned

            # ── Route to entity-specific handler ─────────────────────────
            handler = HANDLERS.get((ev.aggregate_type, ev.event_type))
            if handler:
                handler_result: HandlerResult = handler(ev, sync_event, device, user, db)
            else:
                # No specific handler — log the event generically
                handler_result = HandlerResult(accion_tomada="generic_logged")

            sync_event.is_processed = True
            db.commit()

            if handler_result.warnings:
                for w in handler_result.warnings:
                    logger.warning("sync handler warning [%s/%s]: %s", ev.aggregate_type, ev.event_type, w)

            return {"duplicate": False, "conflicts": handler_result.conflicts}

        except Exception as exc:
            db.rollback()
            exc_str = str(exc).lower()
            is_serialization_err = (
                "serializ" in exc_str
                or "40001" in exc_str   # PostgreSQL serialization_failure
                or "could not serialize" in exc_str
            )
            if is_serialization_err and attempt < max_retries - 1:
                wait_s = 0.05 * (attempt + 1)
                logger.info(
                    "Serialization conflict on event %s (attempt %d/%d) — retrying in %.2fs",
                    ev.event_id, attempt + 1, max_retries, wait_s,
                )
                time.sleep(wait_s)
                continue

            # GAP-8: non-serialization error (or serialization after max retries) →
            # enqueue for async retry instead of propagating the exception.
            logger.error(
                "Failed to process event %s after %d attempts: %s — enqueueing for retry",
                ev.event_id, attempt + 1, exc,
            )
            try:
                # db was rolled back, so we can use it for the enqueue INSERT
                event_payload = {
                    "event_id": ev.event_id,
                    "aggregate_type": ev.aggregate_type,
                    "aggregate_id": ev.aggregate_id,
                    "event_type": ev.event_type,
                    "payload": ev.payload,
                    "payload_antes": ev.payload_antes,
                    "campos_modificados": ev.campos_modificados,
                    "metadata": ev.metadata,
                    "sequence_num": ev.sequence_num,
                    "version_catalogo": ev.version_catalogo,
                }
                enqueue_retry(
                    event_payload=event_payload,
                    device_id=device.id,
                    company_id=user.company_id,
                    exc=exc,
                    event_id=ev.event_id,
                    db=db,
                )
                db.commit()
            except Exception as eq_exc:
                logger.error("Failed to enqueue retry for event %s: %s", ev.event_id, eq_exc)
                db.rollback()

            # Return as processed=0, duplicate=0 — the event is queued, not lost
            return {"duplicate": False, "conflicts": [], "queued_for_retry": True}


@sync_router.get("/pull", response_model=list[EventOut])
def pull_events(
    since: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pull events since last sync, ordered by server_sequence"""
    events = db.query(SyncEvent).filter(
        SyncEvent.company_id == current_user.company_id,
        SyncEvent.server_sequence > since,
    ).order_by(SyncEvent.server_sequence).limit(limit).all()

    results = []
    for ev in events:
        results.append(EventOut(
            id=ev.id,
            aggregate_type=ev.aggregate_type,
            aggregate_id=ev.aggregate_id,
            event_type=ev.event_type,
            payload=ev.payload,
            metadata=ev.metadata_,
            device_id=ev.device_id,
            sequence_num=ev.sequence_num,
            server_sequence=ev.server_sequence,
            user_id=ev.user_id,
            local_id=ev.local_id,
            is_processed=ev.is_processed,
            created_at=ev.created_at,
        ))
    return results


@sync_router.post("/register-device", response_model=DeviceOut)
def register_device(
    body: DeviceRegisterIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register or update a device for sync"""
    try:
        dtype = DeviceType(body.device_type)
    except ValueError:
        raise HTTPException(400, f"device_type inválido: {body.device_type}")

    device = db.query(DeviceRegistry).filter(
        DeviceRegistry.id == body.device_id,
    ).first()

    if device:
        device.name = body.name
        device.device_type = dtype
        device.user_id = current_user.id
        if body.local_id is not None:
            device.local_id = body.local_id
    else:
        device = DeviceRegistry(
            id=body.device_id,
            name=body.name,
            device_type=dtype,
            company_id=current_user.company_id,
            local_id=body.local_id,
            user_id=current_user.id,
            last_sync_sequence=0,
            is_active=True,
        )
        db.add(device)

    db.commit()
    db.refresh(device)
    return device


@sync_router.get("/status", response_model=SyncStatusOut)
def sync_status(
    device_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync status for a specific device"""
    device = db.query(DeviceRegistry).filter(
        DeviceRegistry.id == device_id,
        DeviceRegistry.company_id == current_user.company_id,
    ).first()
    if not device:
        raise HTTPException(404, "Dispositivo no encontrado")

    pending = db.query(func.count(SyncEvent.id)).filter(
        SyncEvent.company_id == current_user.company_id,
        SyncEvent.server_sequence > device.last_sync_sequence,
    ).scalar() or 0

    conflicts_pending = db.query(func.count(SyncConflict.id)).filter(
        SyncConflict.company_id == current_user.company_id,
        SyncConflict.resolution == ConflictResolution.MANUAL_PENDING,
    ).scalar() or 0

    return SyncStatusOut(
        device_id=device.id,
        last_sync_at=device.last_sync_at,
        last_sync_sequence=device.last_sync_sequence,
        pending_events=pending,
        conflicts_pending=conflicts_pending,
    )


@sync_router.get("/conflicts", response_model=list[ConflictOut])
def list_conflicts(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List sync conflicts for current company"""
    q = db.query(SyncConflict).filter(
        SyncConflict.company_id == current_user.company_id,
    )
    if status:
        try:
            res = ConflictResolution(status)
            q = q.filter(SyncConflict.resolution == res)
        except ValueError:
            raise HTTPException(400, f"Estado inválido: {status}")

    conflicts = q.order_by(SyncConflict.created_at.desc()).limit(limit).all()
    return conflicts


@sync_router.post("/conflicts/{conflict_id}/resolve", response_model=ConflictOut)
def resolve_conflict(
    conflict_id: int,
    body: ConflictResolveIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually resolve a sync conflict"""
    conflict = db.query(SyncConflict).filter(
        SyncConflict.id == conflict_id,
        SyncConflict.company_id == current_user.company_id,
    ).first()
    if not conflict:
        raise HTTPException(404, "Conflicto no encontrado")

    try:
        res = ConflictResolution(body.resolution)
    except ValueError:
        raise HTTPException(400, f"Resolución inválida: {body.resolution}")

    conflict.resolution = res
    conflict.resolution_data = body.resolution_data
    conflict.resolved_by_id = current_user.id
    conflict.resolved_at = func.now()

    db.commit()
    db.refresh(conflict)
    return conflict


@sync_router.get("/devices", response_model=list[DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List registered devices for current company"""
    devices = db.query(DeviceRegistry).filter(
        DeviceRegistry.company_id == current_user.company_id,
    ).order_by(DeviceRegistry.name).all()
    return devices


# ══════════════════════════════════════════════════════
# GAP-3: ENDPOINT DE DATOS CRÍTICOS (FASE 1 DEL PROTOCOLO DE SYNC)
# ══════════════════════════════════════════════════════

class CriticalPrecioOut(BaseModel):
    product_id: int
    product_name: str
    base_cost: float | None
    updated_at: datetime

class CriticalDiscontinuadoOut(BaseModel):
    variant_id: int
    sku: str
    product_name: str
    updated_at: datetime

class CriticalClienteBloqueadoOut(BaseModel):
    customer_id: int
    display_name: str
    cuit_dni: str
    motivo: str

class CriticalConflictoOut(BaseModel):
    id: int
    conflict_type: str
    aggregate_type: str
    aggregate_id: str
    description: str
    created_at: datetime

class CriticosOut(BaseModel):
    """
    Respuesta de la Fase 1 del protocolo de sync.
    El dispositivo debe procesar esto ANTES de comenzar a trabajar offline.
    """
    precios_cambiados:     list[CriticalPrecioOut]
    productos_discontinuados: list[CriticalDiscontinuadoOut]
    clientes_bloqueados:   list[CriticalClienteBloqueadoOut]
    conflictos_pendientes: list[CriticalConflictoOut]
    timestamp_consulta:    datetime
    device_last_sync_at:   datetime | None


@sync_router.get("/criticos", response_model=CriticosOut)
def get_datos_criticos(
    dispositivo_id: str = Query(..., description="ID del dispositivo que solicita datos críticos"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GAP-3 — Fase 1 del protocolo de sync: datos críticos antes de trabajar offline.

    Retorna todo lo que el dispositivo necesita saber para operar correctamente:
    - Precios que cambiaron desde el último sync del dispositivo
    - Productos/variantes discontinuados
    - Clientes bloqueados por deuda (CustomerCompany.is_active = False)
    - Conflictos pendientes de resolución manual

    El dispositivo DEBE llamar a este endpoint al reconectarse y ANTES de
    hacer push de eventos pendientes. Si hay clientes bloqueados, debe alertar
    al cajero antes de procesar ventas.

    Ref: docs/conflict-resolution.md §5 — Dispositivo 7 días offline
    """
    from app.models.product import Product, ProductVariant
    from app.models.customer import Customer, CustomerCompany

    # ── Buscar el dispositivo para conocer su último sync ─────────────────
    device = db.query(DeviceRegistry).filter(
        DeviceRegistry.id == dispositivo_id,
        DeviceRegistry.company_id == current_user.company_id,
    ).first()
    if not device:
        raise HTTPException(404, "Dispositivo no registrado")

    since = device.last_sync_at  # Puede ser None (primer sync)
    company_id = current_user.company_id
    ahora = datetime.utcnow().replace(tzinfo=None)  # naive para comparar con ORM

    # ── 1. Precios cambiados ─────────────────────────────────────────────
    # Product.base_cost cambió desde el último sync.
    # ProductVariant no tiene precio propio — el precio vive en Product.
    precio_q = db.query(Product).filter(Product.company_id == company_id)
    if since:
        precio_q = precio_q.filter(Product.updated_at >= since)
    precio_q = precio_q.order_by(Product.updated_at.desc()).limit(500)

    precios_cambiados = [
        CriticalPrecioOut(
            product_id=p.id,
            product_name=p.name,
            base_cost=float(p.base_cost) if p.base_cost else None,
            updated_at=p.updated_at,
        )
        for p in precio_q.all()
    ]

    # ── 2. Productos/variantes discontinuados ─────────────────────────────
    # ProductVariant.is_active = False → no disponible para venta
    disc_q = db.query(ProductVariant).join(Product).filter(
        Product.company_id == company_id,
        ProductVariant.is_active == False,
    )
    if since:
        disc_q = disc_q.filter(ProductVariant.updated_at >= since)
    disc_q = disc_q.order_by(ProductVariant.updated_at.desc()).limit(200)

    productos_discontinuados = [
        CriticalDiscontinuadoOut(
            variant_id=v.id,
            sku=v.sku,
            product_name=v.product.name if v.product else "—",
            updated_at=v.updated_at,
        )
        for v in disc_q.all()
    ]

    # ── 3. Clientes bloqueados ─────────────────────────────────────────────
    # CustomerCompany.is_active = False → cliente bloqueado para esta empresa
    # También incluye clientes con balance > credit_limit (deuda excede límite)
    bloq_q = db.query(CustomerCompany).join(Customer).filter(
        CustomerCompany.company_id == company_id,
    ).filter(
        (CustomerCompany.is_active == False)
        | (
            (CustomerCompany.credit_limit > 0)
            & (CustomerCompany.balance > CustomerCompany.credit_limit)
        )
    )

    clientes_bloqueados = []
    for cc in bloq_q.limit(200).all():
        if not cc.customer:
            continue
        if not cc.is_active:
            motivo = "Bloqueado manualmente"
        else:
            motivo = f"Deuda ${cc.balance:.0f} supera límite ${cc.credit_limit:.0f}"

        clientes_bloqueados.append(CriticalClienteBloqueadoOut(
            customer_id=cc.customer_id,
            display_name=cc.customer.display_name,
            cuit_dni=cc.customer.cuit_dni,
            motivo=motivo,
        ))

    # ── 4. Conflictos pendientes de resolución manual ─────────────────────
    conf_q = db.query(SyncConflict).filter(
        SyncConflict.company_id == company_id,
        SyncConflict.resolution == ConflictResolution.MANUAL_PENDING,
    ).order_by(SyncConflict.created_at.desc()).limit(50)

    conflictos_pendientes = [
        CriticalConflictoOut(
            id=c.id,
            conflict_type=c.conflict_type.value,
            aggregate_type=c.aggregate_type,
            aggregate_id=c.aggregate_id,
            description=c.description,
            created_at=c.created_at,
        )
        for c in conf_q.all()
    ]

    return CriticosOut(
        precios_cambiados=precios_cambiados,
        productos_discontinuados=productos_discontinuados,
        clientes_bloqueados=clientes_bloqueados,
        conflictos_pendientes=conflictos_pendientes,
        timestamp_consulta=ahora,
        device_last_sync_at=device.last_sync_at,
    )



# ══════════════════════════════════════════════════════
# TAREA 2: GET /sync/bootstrap — Estado inicial completo
# ══════════════════════════════════════════════════════

class VariantBootstrap(BaseModel):
    id: int
    sku: str
    size: str | None
    color: str | None
    barcode: str | None
    stock: int
    is_active: bool

class ProductBootstrap(BaseModel):
    id: int
    code: str | None
    name: str
    brand: str | None
    category: str | None
    base_cost: float | None
    is_active: bool
    variants: list[VariantBootstrap]

    model_config = {"from_attributes": True}

class ClienteBootstrap(BaseModel):
    id: int
    cuit_dni: str
    display_name: str
    customer_type: str
    phone: str | None
    email: str | None
    # Datos de relación con la empresa
    credit_limit: float
    balance: float
    discount_pct: float
    is_active: bool  # False = bloqueado

    model_config = {"from_attributes": True}

class PrecioBootstrap(BaseModel):
    id: int
    code: str | None
    description: str
    brand: str | None
    category: str | None
    size: str | None
    color: str | None
    price: float
    cost: float | None
    currency: str

    model_config = {"from_attributes": True}

class ConfigBootstrap(BaseModel):
    empresa_id: int
    nombre: str
    cuit: str | None
    address: str | None
    phone: str | None
    logo_url: str | None
    primary_color: str | None
    industry_type: str | None

class BootstrapOut(BaseModel):
    # Paginación (sólo afecta productos y clientes — los precios se devuelven completos)
    page: int
    page_size: int
    total_productos: int
    total_clientes: int
    productos: list[ProductBootstrap]
    clientes: list[ClienteBootstrap]
    precios: list[PrecioBootstrap]
    config: ConfigBootstrap
    timestamp_servidor: datetime


@sync_router.get("/bootstrap", response_model=BootstrapOut)
def bootstrap(
    empresa_id: int = Query(..., description="ID de la empresa"),
    dispositivo_id: str = Query(..., description="ID del dispositivo"),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=10, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Estado inicial completo para un dispositivo que se conecta por primera vez
    o después de mucho tiempo offline. El frontend guarda este payload en IndexedDB.

    Paginado por productos y clientes (page / page_size).
    Los precios se devuelven completos (máx 2000 ítems del listado más reciente).
    La config de empresa es siempre completa.

    El dispositivo debe llamar repetidamente incrementando `page` hasta que
    la cantidad de productos/clientes recibidos sea menor que page_size.
    """
    from app.models.product import Product, ProductVariant
    from app.models.customer import Customer, CustomerCompany
    from app.models.company import Company
    from app.models.price_list import PriceListItem, PriceListFile

    # Validar empresa
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id != empresa_id:
        raise HTTPException(403, "No tenés acceso a esa empresa")

    company_id = empresa_id
    offset = (page - 1) * page_size
    ahora = datetime.utcnow()

    # ── Config empresa ─────────────────────────────────────────────────────
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "Empresa no encontrada")

    config = ConfigBootstrap(
        empresa_id=company.id,
        nombre=company.name,
        cuit=company.cuit,
        address=company.address,
        phone=company.phone,
        logo_url=company.logo_url,
        primary_color=company.primary_color,
        industry_type=company.industry_type,
    )

    # ── Productos activos (paginados) ──────────────────────────────────────
    prod_base = db.query(Product).filter(
        Product.company_id == company_id,
        Product.is_active == True,
    )
    total_productos = prod_base.count()
    prods = prod_base.order_by(Product.id).offset(offset).limit(page_size).all()

    productos = []
    for p in prods:
        variants = [
            VariantBootstrap(
                id=v.id, sku=v.sku, size=v.size, color=v.color,
                barcode=v.barcode, stock=v.stock, is_active=v.is_active,
            )
            for v in p.variants
        ]
        productos.append(ProductBootstrap(
            id=p.id, code=p.code, name=p.name, brand=p.brand,
            category=p.category,
            base_cost=float(p.base_cost) if p.base_cost else None,
            is_active=p.is_active, variants=variants,
        ))

    # ── Clientes activos de la empresa (paginados) ─────────────────────────
    cc_base = (
        db.query(CustomerCompany)
        .join(Customer)
        .filter(CustomerCompany.company_id == company_id)
    )
    total_clientes = cc_base.count()
    cc_rows = cc_base.order_by(CustomerCompany.id).offset(offset).limit(page_size).all()

    clientes = []
    for cc in cc_rows:
        c = cc.customer
        if not c:
            continue
        clientes.append(ClienteBootstrap(
            id=c.id, cuit_dni=c.cuit_dni, display_name=c.display_name,
            customer_type=c.customer_type,
            phone=c.phone, email=c.email,
            credit_limit=float(cc.credit_limit or 0),
            balance=float(cc.balance or 0),
            discount_pct=float(cc.discount_pct or 0),
            is_active=cc.is_active,
        ))

    # ── Lista de precios vigente (archivo más reciente de la empresa) ──────
    latest_file = (
        db.query(PriceListFile)
        .filter(PriceListFile.company_id == company_id)
        .order_by(PriceListFile.upload_date.desc())
        .first()
    )
    precios = []
    if latest_file:
        items = (
            db.query(PriceListItem)
            .filter(PriceListItem.price_list_file_id == latest_file.id)
            .order_by(PriceListItem.id)
            .limit(2000)
            .all()
        )
        precios = [
            PrecioBootstrap(
                id=item.id,
                code=item.code,
                description=item.description,
                brand=item.brand,
                category=item.category,
                size=item.size,
                color=item.color,
                price=float(item.price or 0),
                cost=float(item.cost) if item.cost else None,
                currency=item.currency or "ARS",
            )
            for item in items
        ]

    # ── Actualizar last_sync_at del dispositivo si es página 1 ────────────
    if page == 1:
        device = db.query(DeviceRegistry).filter(
            DeviceRegistry.id == dispositivo_id,
            DeviceRegistry.company_id == company_id,
        ).first()
        if device:
            device.last_sync_at = ahora
            db.commit()

    return BootstrapOut(
        page=page,
        page_size=page_size,
        total_productos=total_productos,
        total_clientes=total_clientes,
        productos=productos,
        clientes=clientes,
        precios=precios,
        config=config,
        timestamp_servidor=ahora,
    )


# ══════════════════════════════════════════════════════
# TAREA 3: GET /sync/delta — Cambios incrementales
# ══════════════════════════════════════════════════════

class ProductDelta(BaseModel):
    id: int
    code: str | None
    name: str
    brand: str | None
    category: str | None
    base_cost: float | None
    is_active: bool
    updated_at: datetime
    variants: list[VariantBootstrap]

class ClienteDelta(BaseModel):
    id: int
    cuit_dni: str
    display_name: str
    customer_type: str
    phone: str | None
    email: str | None
    credit_limit: float
    balance: float
    is_active: bool
    updated_at: datetime

class PrecioDelta(BaseModel):
    id: int
    code: str | None
    description: str
    brand: str | None
    price: float
    cost: float | None
    updated_at: datetime

class ConflictoDelta(BaseModel):
    id: int
    conflict_type: str
    aggregate_type: str
    aggregate_id: str
    description: str
    resolution: str
    created_at: datetime

class DeltaOut(BaseModel):
    productos_modificados: list[ProductDelta]
    clientes_modificados: list[ClienteDelta]
    precios_modificados: list[PrecioDelta]
    conflictos_pendientes: list[ConflictoDelta]
    timestamp_servidor: datetime
    # Indica si hay más cambios (límite de seguridad alcanzado)
    truncated: bool = False


@sync_router.get("/delta", response_model=DeltaOut)
def delta_sync(
    dispositivo_id: str = Query(..., description="ID del dispositivo"),
    desde: datetime = Query(..., description="Timestamp del último sync (ISO 8601)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cambios incrementales desde el último sync del dispositivo.

    Mucho más liviano que /bootstrap. El frontend llama a este endpoint
    cada vez que reconecta después de estar offline.

    Límite de seguridad: máx 500 productos, 500 clientes, 1000 precios.
    Si `truncated=true` en la respuesta, llamar a /bootstrap en su lugar.
    """
    from app.models.product import Product, ProductVariant
    from app.models.customer import Customer, CustomerCompany
    from app.models.price_list import PriceListItem, PriceListFile

    company_id = current_user.company_id
    ahora = datetime.utcnow()
    LIMIT = 500

    # Normalizar timezone: comparar naive vs naive UTC
    desde_naive = desde.replace(tzinfo=None) if desde.tzinfo else desde

    # ── Productos modificados ──────────────────────────────────────────────
    prods = (
        db.query(Product)
        .filter(
            Product.company_id == company_id,
            Product.updated_at >= desde_naive,
        )
        .order_by(Product.updated_at.asc())
        .limit(LIMIT + 1)
        .all()
    )
    truncated = len(prods) > LIMIT
    prods = prods[:LIMIT]

    productos_modificados = []
    for p in prods:
        # Cargar variantes (todas, activas e inactivas — el cliente decide qué hacer)
        variants_data = [
            VariantBootstrap(
                id=v.id, sku=v.sku, size=v.size, color=v.color,
                barcode=v.barcode, stock=v.stock, is_active=v.is_active,
            )
            for v in p.variants
        ]
        productos_modificados.append(ProductDelta(
            id=p.id, code=p.code, name=p.name, brand=p.brand,
            category=p.category,
            base_cost=float(p.base_cost) if p.base_cost else None,
            is_active=p.is_active, updated_at=p.updated_at,
            variants=variants_data,
        ))

    # ── Clientes modificados ───────────────────────────────────────────────
    cc_rows = (
        db.query(CustomerCompany)
        .join(Customer)
        .filter(
            CustomerCompany.company_id == company_id,
            CustomerCompany.updated_at >= desde_naive,
        )
        .order_by(CustomerCompany.updated_at.asc())
        .limit(LIMIT + 1)
        .all()
    )
    if len(cc_rows) > LIMIT:
        truncated = True
    cc_rows = cc_rows[:LIMIT]

    clientes_modificados = []
    for cc in cc_rows:
        c = cc.customer
        if not c:
            continue
        clientes_modificados.append(ClienteDelta(
            id=c.id, cuit_dni=c.cuit_dni, display_name=c.display_name,
            customer_type=c.customer_type,
            phone=c.phone, email=c.email,
            credit_limit=float(cc.credit_limit or 0),
            balance=float(cc.balance or 0),
            is_active=cc.is_active,
            updated_at=cc.updated_at,
        ))

    # ── Precios modificados (del listado más reciente) ─────────────────────
    latest_file = (
        db.query(PriceListFile)
        .filter(PriceListFile.company_id == company_id)
        .order_by(PriceListFile.upload_date.desc())
        .first()
    )
    precios_modificados = []
    if latest_file:
        price_rows = (
            db.query(PriceListItem)
            .filter(
                PriceListItem.price_list_file_id == latest_file.id,
                PriceListItem.updated_at >= desde_naive,
            )
            .order_by(PriceListItem.updated_at.asc())
            .limit(1001)
            .all()
        )
        if len(price_rows) > 1000:
            truncated = True
        for item in price_rows[:1000]:
            precios_modificados.append(PrecioDelta(
                id=item.id,
                code=item.code,
                description=item.description,
                brand=item.brand,
                price=float(item.price or 0),
                cost=float(item.cost) if item.cost else None,
                updated_at=item.updated_at,
            ))

    # ── Conflictos pendientes del dispositivo ─────────────────────────────
    conf_q = (
        db.query(SyncConflict)
        .filter(
            SyncConflict.company_id == company_id,
            SyncConflict.resolution == ConflictResolution.MANUAL_PENDING,
        )
        .order_by(SyncConflict.created_at.desc())
        .limit(50)
        .all()
    )

    conflictos_pendientes = [
        ConflictoDelta(
            id=c.id,
            conflict_type=c.conflict_type.value,
            aggregate_type=c.aggregate_type,
            aggregate_id=c.aggregate_id,
            description=c.description,
            resolution=c.resolution.value,
            created_at=c.created_at,
        )
        for c in conf_q
    ]

    # ── Actualizar last_sync_at del dispositivo ────────────────────────────
    device = db.query(DeviceRegistry).filter(
        DeviceRegistry.id == dispositivo_id,
        DeviceRegistry.company_id == company_id,
    ).first()
    if device:
        device.last_sync_at = ahora
        db.commit()

    return DeltaOut(
        productos_modificados=productos_modificados,
        clientes_modificados=clientes_modificados,
        precios_modificados=precios_modificados,
        conflictos_pendientes=conflictos_pendientes,
        timestamp_servidor=ahora,
        truncated=truncated,
    )




class RetryQueueStatsOut(BaseModel):
    procesados: int
    completados: int
    fallidos: int
    reintentados: int


@sync_router.post("/retry/process", response_model=RetryQueueStatsOut)
def process_retry_queue(
    limit: int = Query(50, ge=1, le=200, description="Máximo de entradas a procesar"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN)),
):
    """
    GAP-8 — Procesa manualmente la cola de reintentos de sync.

    Normalmente esto lo ejecuta un job periódico.
    Este endpoint permite al admin dispararlo manualmente.
    Solo ADMIN y SUPERADMIN pueden ejecutarlo.
    """
    from app.services.sync_queue import process_pending
    stats = process_pending(db=db, limit=limit)
    return RetryQueueStatsOut(**stats)


@sync_router.get("/retry/pending")
def list_retry_pending(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN)),
):
    """Lista las entradas pendientes/fallidas de la cola de reintentos."""
    from app.models.sync import SyncRetryQueue, SyncRetryQueueStatus
    items = db.execute(
        text("""
            SELECT id, event_id, device_id, status, error_type,
                   intentos, max_intentos, ultimo_error, next_retry_at, created_at
            FROM sync_retry_queue
            WHERE company_id = :cid
              AND status IN ('PENDIENTE', 'FALLIDO', 'PROCESANDO')
            ORDER BY created_at DESC
            LIMIT :lim
        """),
        {"cid": current_user.company_id, "lim": limit},
    ).fetchall()
    return [dict(r._mapping) for r in items]


# ══════════════════════════════════════════════════════
# STORAGE ROUTER
# ══════════════════════════════════════════════════════

storage_router = APIRouter(
    prefix="/storage",
    tags=["Storage"],
)


# ── Schemas ────────────────────────────────────────────

class StorageFileOut(BaseModel):
    id: int
    company_id: int
    storage_backend: str
    original_name: str
    stored_path: str
    mime_type: str
    size_bytes: int
    entity_type: str | None
    entity_id: int | None
    category: str | None
    uploaded_by_id: int
    is_synced: bool
    sync_priority: str
    url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────

@storage_router.post("/upload", response_model=StorageFileOut)
async def upload_file(
    file: UploadFile = File(...),
    entity_type: str | None = Form(None),
    entity_id: int | None = Form(None),
    category: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file to local storage [DN-4]"""
    now = datetime.now()
    date_folder = now.strftime("%Y-%m")
    company_id = current_user.company_id or 0

    # Build storage path
    entity_folder = entity_type or "general"
    rel_dir = os.path.join(str(company_id), entity_folder, date_folder)
    abs_dir = os.path.join(STORAGE_ROOT, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    # Unique filename
    ext = os.path.splitext(file.filename or "file")[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(abs_dir, stored_name)
    rel_path = os.path.join(rel_dir, stored_name)

    # Write file
    content = await file.read()
    with open(abs_path, "wb") as f:
        f.write(content)

    storage_file = StorageFile(
        company_id=company_id,
        storage_backend=StorageBackend.LOCAL,
        original_name=file.filename or "unknown",
        stored_path=rel_path,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        entity_type=entity_type,
        entity_id=entity_id,
        category=category,
        uploaded_by_id=current_user.id,
        is_synced=True,
    )
    db.add(storage_file)
    db.commit()
    db.refresh(storage_file)

    return _file_to_out(storage_file)


@storage_router.get("/{file_id}", response_class=FileResponse)
def serve_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve a stored file"""
    sf = _get_storage_file(db, file_id, current_user)
    abs_path = os.path.join(STORAGE_ROOT, sf.stored_path)
    if not os.path.exists(abs_path):
        raise HTTPException(404, "Archivo no encontrado en disco")
    return FileResponse(abs_path, media_type=sf.mime_type, filename=sf.original_name)


@storage_router.get("/{file_id}/download", response_class=FileResponse)
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a stored file"""
    sf = _get_storage_file(db, file_id, current_user)
    abs_path = os.path.join(STORAGE_ROOT, sf.stored_path)
    if not os.path.exists(abs_path):
        raise HTTPException(404, "Archivo no encontrado en disco")
    return FileResponse(
        abs_path,
        media_type="application/octet-stream",
        filename=sf.original_name,
        headers={"Content-Disposition": f'attachment; filename="{sf.original_name}"'},
    )


@storage_router.delete("/{file_id}", response_model=StorageFileOut)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a stored file"""
    sf = _get_storage_file(db, file_id, current_user)
    sf.is_deleted = True
    db.commit()
    db.refresh(sf)
    return _file_to_out(sf)


@storage_router.get("/entity/{entity_type}/{entity_id}", response_model=list[StorageFileOut])
def list_entity_files(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List files linked to a specific entity"""
    files = db.query(StorageFile).filter(
        StorageFile.company_id == current_user.company_id,
        StorageFile.entity_type == entity_type,
        StorageFile.entity_id == entity_id,
        StorageFile.is_deleted == False,
    ).order_by(StorageFile.created_at.desc()).all()
    return [_file_to_out(f) for f in files]


# ── Helpers ────────────────────────────────────────────

def _get_storage_file(db: Session, file_id: int, user: User) -> StorageFile:
    sf = db.query(StorageFile).filter(
        StorageFile.id == file_id,
        StorageFile.company_id == user.company_id,
        StorageFile.is_deleted == False,
    ).first()
    if not sf:
        raise HTTPException(404, "Archivo no encontrado")
    return sf


def _file_to_out(sf: StorageFile) -> StorageFileOut:
    return StorageFileOut(
        id=sf.id,
        company_id=sf.company_id,
        storage_backend=sf.storage_backend.value,
        original_name=sf.original_name,
        stored_path=sf.stored_path,
        mime_type=sf.mime_type,
        size_bytes=sf.size_bytes,
        entity_type=sf.entity_type,
        entity_id=sf.entity_id,
        category=sf.category,
        uploaded_by_id=sf.uploaded_by_id,
        is_synced=sf.is_synced,
        sync_priority=sf.sync_priority.value,
        url=f"/api/v1/storage/{sf.id}",
        created_at=sf.created_at,
    )
