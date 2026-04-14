"""
sync_queue.py — Cola de reintentos genérica para eventos de sync fallidos.

GAP-8: Cuando push_events falla al procesar un evento (por error de red,
timeout, error de lógica no serialization), el evento se encola aquí para
ser reintentado con backoff exponencial.

Política de reintentos:
  - RED, SERVIDOR    → backoff exp: 1min, 5min, 15min, 1h, 4h, 24h…
  - DESCONOCIDO      → mismo backoff, pero más largo
  - CONFLICTO        → no reintenta automáticamente; queda en PENDIENTE para admin
  - VALIDACION       → no reintenta; pasa directamente a FALLIDO

Ref: docs/conflict-resolution.md §6 — pseudocódigo proceso de eventos
Ref: schema/002_sync.sql — tabla cola_sync
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.sync import (
    SyncRetryQueue,
    SyncRetryQueueStatus,
    SyncRetryErrorType,
)

logger = logging.getLogger(__name__)


# ── Backoff schedule ──────────────────────────────────
# Índice = número de intentos ya realizados.
# Si intentos >= len(BACKOFF_MINUTES), usa el último valor.
BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440]   # 1m, 5m, 15m, 1h, 4h, 12h, 24h

# Tipos de error que NO se reintentan automáticamente
_NO_RETRY_TYPES = {SyncRetryErrorType.CONFLICTO, SyncRetryErrorType.VALIDACION}


def _classify_error(exc: Exception) -> SyncRetryErrorType:
    """
    Clasifica una excepción en un SyncRetryErrorType.
    Determina si el error es reintentable y con qué prioridad.
    """
    msg = str(exc).lower()

    if any(k in msg for k in ("timeout", "connection", "network", "refused", "reset")):
        return SyncRetryErrorType.RED

    if any(k in msg for k in ("500", "503", "502", "internal server", "service unavailable")):
        return SyncRetryErrorType.SERVIDOR

    if any(k in msg for k in ("conflict", "conflicto", "constraint", "unique")):
        return SyncRetryErrorType.CONFLICTO

    if any(k in msg for k in ("validation", "validacion", "invalid", "pydantic", "400")):
        return SyncRetryErrorType.VALIDACION

    return SyncRetryErrorType.DESCONOCIDO


def _next_retry_time(intentos: int, error_type: SyncRetryErrorType) -> Optional[datetime]:
    """
    Calcula cuándo debe intentarse el próximo retry.
    Retorna None para tipos no reintentables.
    """
    if error_type in _NO_RETRY_TYPES:
        return None

    # Para DESCONOCIDO usar backoff más lento (×2 del schedule base)
    factor = 2 if error_type == SyncRetryErrorType.DESCONOCIDO else 1
    idx = min(intentos, len(BACKOFF_MINUTES) - 1)
    minutes = BACKOFF_MINUTES[idx] * factor

    return datetime.now(tz=timezone.utc) + timedelta(minutes=minutes)


def enqueue(
    event_payload: dict,
    device_id: str,
    company_id: int,
    exc: Exception,
    event_id: Optional[str] = None,
    db: Session = None,
) -> SyncRetryQueue:
    """
    Agrega un evento fallido a la cola de reintentos.

    Llamar desde _process_single_event cuando el handler falla
    con un error NO de serialización (los de serialización se
    reintentan inline con retry en push_events).

    Args:
        event_payload: El diccionario completo del EventIn (ev.__dict__ o ev.model_dump()).
        device_id:     ID del dispositivo origen.
        company_id:    ID de la empresa.
        exc:           La excepción que causó el fallo.
        event_id:      El ID del sync_event si ya fue insertado antes del fallo.
        db:            La sesión SQLAlchemy. NOTA: debe estar en estado limpio
                       (después de rollback, antes de commit).

    Returns:
        La entrada SyncRetryQueue creada y flusheada.
    """
    error_type = _classify_error(exc)
    next_retry = _next_retry_time(0, error_type)

    # Para tipos no reintentables, pasar directo a FALLIDO
    if error_type in _NO_RETRY_TYPES:
        status = SyncRetryQueueStatus.FALLIDO
    else:
        status = SyncRetryQueueStatus.PENDIENTE

    entry = SyncRetryQueue(
        event_id=event_id,
        company_id=company_id,
        device_id=device_id,
        event_payload=event_payload,
        status=status,
        error_type=error_type,
        intentos=0,
        ultimo_error=f"{type(exc).__name__}: {exc}",
        next_retry_at=next_retry,
    )
    db.add(entry)
    db.flush()

    logger.info(
        "Evento encolado para retry: event_id=%s device=%s error_type=%s next_retry=%s",
        event_id, device_id, error_type.value,
        next_retry.isoformat() if next_retry else "NUNCA",
    )
    return entry


def process_pending(db: Session, limit: int = 50) -> dict:
    """
    Procesa los eventos pendientes de la cola de reintentos.

    Este método está diseñado para ser llamado por un job periódico
    (APScheduler, Celery beat, o endpoint admin manual).

    Por cada entrada PENDIENTE con next_retry_at <= NOW():
      1. Marca como PROCESANDO.
      2. Re-importa y ejecuta el handler correspondiente.
      3. Si falla: incrementa intentos, recalcula next_retry_at o marca FALLIDO.
      4. Si éxito: marca COMPLETADO.

    Returns:
        {"procesados": N, "completados": N, "fallidos": N, "reintentados": N}
    """
    from app.services.sync_handlers import HANDLERS

    now = datetime.now(tz=timezone.utc)
    stats = {"procesados": 0, "completados": 0, "fallidos": 0, "reintentados": 0}

    # Buscar entradas elegibles para reintento
    pending = db.query(SyncRetryQueue).filter(
        SyncRetryQueue.status == SyncRetryQueueStatus.PENDIENTE,
        SyncRetryQueue.next_retry_at <= now,
    ).order_by(SyncRetryQueue.next_retry_at).limit(limit).all()

    for entry in pending:
        stats["procesados"] += 1
        entry.status = SyncRetryQueueStatus.PROCESANDO
        db.flush()

        try:
            # Reconstruir el EventIn desde el payload guardado
            from app.api.v1.sync import EventIn
            ev = EventIn(**entry.event_payload)

            # Re-buscar el handler
            handler = HANDLERS.get((ev.aggregate_type, ev.event_type))
            if not handler:
                logger.warning(
                    "retry: no handler for (%s, %s) — marcando FALLIDO",
                    ev.aggregate_type, ev.event_type,
                )
                entry.status = SyncRetryQueueStatus.FALLIDO
                entry.ultimo_error = f"No handler for ({ev.aggregate_type}, {ev.event_type})"
                db.flush()
                stats["fallidos"] += 1
                continue

            # El sync_event puede o no existir (si falló antes del INSERT)
            sync_event = None
            if entry.event_id:
                from app.models.sync import SyncEvent
                sync_event = db.query(SyncEvent).filter(SyncEvent.id == entry.event_id).first()

            if not sync_event:
                # El evento no fue insertado — no podemos reintentarlo sin más contexto
                logger.warning(
                    "retry: sync_event %s no encontrado — marcando FALLIDO",
                    entry.event_id,
                )
                entry.status = SyncRetryQueueStatus.FALLIDO
                entry.ultimo_error = f"sync_event {entry.event_id} no encontrado en DB"
                db.flush()
                stats["fallidos"] += 1
                continue

            # Reconstruir device y user mínimos desde el sync_event
            from app.models.sync import DeviceRegistry
            from app.models.user import User
            device = db.query(DeviceRegistry).filter(
                DeviceRegistry.id == entry.device_id,
            ).first()
            user = db.query(User).filter(User.id == sync_event.user_id).first()

            if not device or not user:
                entry.status = SyncRetryQueueStatus.FALLIDO
                entry.ultimo_error = "Device o User no encontrado para retry"
                db.flush()
                stats["fallidos"] += 1
                continue

            # SET TRANSACTION SERIALIZABLE para el reintento también
            db.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))

            result = handler(ev, sync_event, device, user, db)
            sync_event.is_processed = True

            entry.status = SyncRetryQueueStatus.COMPLETADO
            entry.intentos += 1
            db.commit()
            stats["completados"] += 1

            logger.info("retry completado: queue_id=%s event_id=%s", entry.id, entry.event_id)

        except Exception as exc:
            db.rollback()
            entry.intentos += 1
            error_type = _classify_error(exc)

            if entry.intentos >= entry.max_intentos or error_type in _NO_RETRY_TYPES:
                entry.status = SyncRetryQueueStatus.FALLIDO
                stats["fallidos"] += 1
                logger.error(
                    "retry FALLIDO definitivo: queue_id=%s event_id=%s intentos=%d error=%s",
                    entry.id, entry.event_id, entry.intentos, exc,
                )
            else:
                next_retry = _next_retry_time(entry.intentos, error_type)
                entry.status = SyncRetryQueueStatus.PENDIENTE
                entry.next_retry_at = next_retry
                stats["reintentados"] += 1
                logger.warning(
                    "retry fallido (intento %d/%d): queue_id=%s event_id=%s next=%s error=%s",
                    entry.intentos, entry.max_intentos, entry.id, entry.event_id,
                    next_retry.isoformat() if next_retry else "N/A", exc,
                )

            entry.ultimo_error = f"{type(exc).__name__}: {exc}"
            db.add(entry)
            db.commit()

    return stats
