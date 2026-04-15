from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import datetime

from app.db.session import get_db
from app.models.message import Message
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/messages", tags=["Mensajería"])


class MessageOut(BaseModel):
    id: int
    from_user_id: int
    from_user_name: str
    to_user_id: Optional[int] = None
    to_user_name: Optional[str] = None
    is_broadcast: bool
    subject: str
    content: str
    is_read: bool
    company_id: int
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    to_user_id: Optional[int] = None
    is_broadcast: bool = False
    subject: str
    content: str


def _serialize(m: Message) -> dict:
    return {
        "id": m.id,
        "from_user_id": m.from_user_id,
        "from_user_name": m.from_user.full_name if m.from_user else "",
        "to_user_id": m.to_user_id,
        "to_user_name": m.to_user.full_name if m.to_user else None,
        "is_broadcast": m.is_broadcast,
        "subject": m.subject,
        "content": m.content,
        "is_read": m.is_read,
        "company_id": m.company_id,
        "created_at": m.created_at,
    }


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.is_read == False,
        Message.from_user_id != current_user.id,
        (Message.to_user_id == current_user.id) | (Message.is_broadcast == True),
    ).count()
    return {"unread_count": count}


@router.get("/users")
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(
        User.company_id == current_user.company_id,
        User.is_active == True,
        User.id != current_user.id,
    ).all()
    return [{"id": u.id, "full_name": u.full_name, "role": u.role.value if u.role else ""} for u in users]


@router.get("/")
def get_inbox(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.from_user_id != current_user.id,
        (Message.to_user_id == current_user.id) | (Message.is_broadcast == True),
    ).order_by(Message.created_at.desc()).offset(skip).limit(limit)
    return [_serialize(m) for m in q.all()]


@router.get("/sent")
def get_sent(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.from_user_id == current_user.id,
    ).order_by(Message.created_at.desc()).offset(skip).limit(limit)
    return [_serialize(m) for m in q.all()]


@router.post("/", status_code=201)
def send_message(
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.is_broadcast and body.to_user_id is None:
        raise HTTPException(status_code=400, detail="Debe especificar destinatario o enviar como difusión")
    if not body.subject.strip():
        raise HTTPException(status_code=400, detail="El asunto no puede estar vacío")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío")

    company_id = current_user.company_id

    if body.is_broadcast:
        recipients = db.query(User).filter(
            User.company_id == company_id,
            User.is_active == True,
            User.id != current_user.id,
        ).all()
        created = []
        for recipient in recipients:
            m = Message(
                from_user_id=current_user.id,
                to_user_id=recipient.id,
                is_broadcast=True,
                subject=body.subject,
                content=body.content,
                is_read=False,
                company_id=company_id,
            )
            db.add(m)
            created.append(m)
        db.commit()
        for m in created:
            db.refresh(m)
        return {"sent": len(created), "message": "Difusión enviada"}
    else:
        recipient = db.query(User).filter(User.id == body.to_user_id, User.company_id == company_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Destinatario no encontrado")
        m = Message(
            from_user_id=current_user.id,
            to_user_id=body.to_user_id,
            is_broadcast=False,
            subject=body.subject,
            content=body.content,
            is_read=False,
            company_id=company_id,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        return _serialize(m)


@router.post("/{message_id}/read")
def mark_as_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = db.query(Message).filter(
        Message.id == message_id,
        Message.company_id == current_user.company_id,
        (Message.to_user_id == current_user.id) | (Message.is_broadcast == True),
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    m.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Message).filter(
        Message.company_id == current_user.company_id,
        Message.is_read == False,
        Message.from_user_id != current_user.id,
        (Message.to_user_id == current_user.id) | (Message.is_broadcast == True),
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = db.query(Message).filter(
        Message.id == message_id,
        Message.company_id == current_user.company_id,
    ).filter(
        (Message.from_user_id == current_user.id) |
        (Message.to_user_id == current_user.id)
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    db.delete(m)
    db.commit()
    return {"ok": True}
