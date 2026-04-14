"""
Router para Notificaciones y Auditoría
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.notification import Notification, AuditLog, NotificationType, NotificationStatus
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    type: str
    status: str
    title: str
    message: str
    from_user_id: int | None = None
    to_user_id: int | None = None
    to_role: str | None = None
    related_invoice_id: int | None = None
    related_order_id: int | None = None
    # GAP-6: sync event and device context
    related_sync_event_id: str | None = None
    device_id: str | None = None
    company_id: int
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    type: str = "INFO"
    title: str
    message: str
    to_user_id: int | None = None
    to_role: str | None = None
    related_invoice_id: int | None = None
    related_order_id: int | None = None


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str | None = None
    entity_id: int | None = None
    description: str | None = None
    user_id: int | None = None
    company_id: int
    created_at: datetime.datetime
    username: str | None = None
    model_config = {"from_attributes": True}


router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


# ── Helpers ────────────────────────────────────────────

def _serialize_notification(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type.value if n.type else None,
        "status": n.status.value if n.status else None,
        "title": n.title,
        "message": n.message,
        "from_user_id": n.from_user_id,
        "to_user_id": n.to_user_id,
        "to_role": n.to_role,
        "related_invoice_id": n.related_invoice_id,
        "related_order_id": n.related_order_id,
        "related_sync_event_id": n.related_sync_event_id,  # GAP-6
        "device_id": n.device_id,                           # GAP-6
        "company_id": n.company_id,
        "created_at": n.created_at,
    }


def _serialize_audit(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "description": log.description,
        "user_id": log.user_id,
        "company_id": log.company_id,
        "created_at": log.created_at,
        "username": log.user.username if log.user else None,
    }


# ── Notifications ──────────────────────────────────────

@router.get("/")
def get_my_notifications(
    dispositivo_id: Optional[str] = Query(None, description="GAP-6: filtrar notificaciones de un dispositivo específico"),
    unread_only: bool = Query(False, description="Solo notificaciones no leídas"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Obtiene las notificaciones del usuario actual.

    GAP-6: soporta filtro por dispositivo_id para que un dispositivo
    pueda obtener sus propias alertas de sync (e.g. sobreventas).
    """
    role_str = current_user.role.value if current_user.role else None
    q = db.query(Notification).filter(
        Notification.company_id == current_user.company_id
    )

    if dispositivo_id:
        # Notificaciones específicas del dispositivo (e.g. alertas de sobreventa)
        # O las del usuario/rol del dispositivo
        q = q.filter(
            (Notification.device_id == dispositivo_id)
            | (Notification.to_user_id == current_user.id)
            | (Notification.to_role == role_str)
        )
    else:
        q = q.filter(
            (Notification.to_user_id == current_user.id)
            | (Notification.to_role == role_str)
        )

    if unread_only:
        q = q.filter(Notification.status == NotificationStatus.NO_LEIDA)

    q = q.order_by(Notification.created_at.desc()).limit(50)
    return [_serialize_notification(n) for n in q.all()]


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role_str = current_user.role.value if current_user.role else None
    count = db.query(Notification).filter(
        Notification.company_id == current_user.company_id,
        Notification.status == NotificationStatus.NO_LEIDA,
    ).filter(
        (Notification.to_user_id == current_user.id) |
        (Notification.to_role == role_str)
    ).count()
    return {"unread_count": count}


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    n.status = NotificationStatus.LEIDA
    db.commit()
    db.refresh(n)
    return _serialize_notification(n)


@router.post("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role_str = current_user.role.value if current_user.role else None
    db.query(Notification).filter(
        Notification.company_id == current_user.company_id,
        Notification.status == NotificationStatus.NO_LEIDA,
    ).filter(
        (Notification.to_user_id == current_user.id) |
        (Notification.to_role == role_str)
    ).update({"status": NotificationStatus.LEIDA}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.post("/", status_code=201)
def create_notification(
    body: NotificationCreate,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION
    )),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    try:
        notif_type = NotificationType(body.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Tipo de notificación inválido: {body.type}")

    n = Notification(
        type=notif_type,
        status=NotificationStatus.NO_LEIDA,
        title=body.title,
        message=body.message,
        from_user_id=current_user.id,
        to_user_id=body.to_user_id,
        to_role=body.to_role,
        related_invoice_id=body.related_invoice_id,
        related_order_id=body.related_order_id,
        company_id=company_id,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return _serialize_notification(n)


# ── Audit Logs ─────────────────────────────────────────

@router.get("/audit/")
def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(AuditLog.company_id == current_user.company_id)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)
    if user_id is not None:
        q = q.filter(AuditLog.user_id == user_id)
    q = q.order_by(AuditLog.created_at.desc())
    total = q.count()
    logs = q.offset(skip).limit(limit).all()
    return {"items": [_serialize_audit(log) for log in logs], "total": total, "skip": skip, "limit": limit}
