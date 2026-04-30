"""
Router para Calendario de Eventos — feriados, promociones, fechas importantes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.calendar_event import CalendarEvent, EventType
from app.models.user import User, UserRole
from app.api.deps import get_current_user

router = APIRouter(prefix="/calendar-events", tags=["Calendario de Eventos"])


# ── Schemas ────────────────────────────────────────────

class CalendarEventOut(BaseModel):
    id: int
    company_id: int
    title: str
    description: str | None = None
    event_date: datetime.date
    end_date: datetime.date | None = None
    event_type: str
    color: str | None = None
    is_all_day: bool
    created_by_id: int
    created_by_name: str | None = None
    created_at: datetime.datetime | None = None
    updated_at: datetime.datetime | None = None
    model_config = {"from_attributes": True}


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    event_date: datetime.date
    end_date: datetime.date | None = None
    event_type: str
    color: str | None = None
    is_all_day: bool = True


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: datetime.date | None = None
    end_date: datetime.date | None = None
    event_type: str | None = None
    color: str | None = None
    is_all_day: bool | None = None


# ── Helpers ────────────────────────────────────────────

def _is_superuser(user: User) -> bool:
    return user.role in (UserRole.MEGAADMIN, UserRole.SUPERADMIN)


def _event_to_out(ev: CalendarEvent) -> CalendarEventOut:
    return CalendarEventOut(
        id=ev.id,
        company_id=ev.company_id,
        title=ev.title,
        description=ev.description,
        event_date=ev.event_date,
        end_date=ev.end_date,
        event_type=ev.event_type.value if ev.event_type else None,
        color=ev.color,
        is_all_day=ev.is_all_day,
        created_by_id=ev.created_by_id,
        created_by_name=ev.created_by.full_name if ev.created_by else None,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
    )


# ── Endpoints ──────────────────────────────────────────

@router.get("/", response_model=list[CalendarEventOut])
def list_events(
    event_type: Optional[str] = Query(None),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CalendarEvent)
    if _is_superuser(current_user):
        pass
    else:
        q = q.filter(CalendarEvent.company_id == current_user.company_id)

    if event_type:
        q = q.filter(CalendarEvent.event_type == event_type)
    if date_from:
        q = q.filter(CalendarEvent.event_date >= date_from)
    if date_to:
        q = q.filter(CalendarEvent.event_date <= date_to)
    if year:
        q = q.filter(
            CalendarEvent.event_date >= datetime.date(year, 1, 1),
            CalendarEvent.event_date <= datetime.date(year, 12, 31),
        )

    events = q.order_by(CalendarEvent.event_date.asc()).all()
    return [_event_to_out(ev) for ev in events]


@router.post("/", response_model=CalendarEventOut, status_code=201)
def create_event(
    body: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        et = EventType(body.event_type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"event_type inválido: {body.event_type}")

    company_id = current_user.company_id
    if _is_superuser(current_user) and company_id is None:
        raise HTTPException(status_code=400, detail="MEGAADMIN debe tener company_id para crear eventos")

    ev = CalendarEvent(
        company_id=company_id,
        title=body.title,
        description=body.description,
        event_date=body.event_date,
        end_date=body.end_date,
        event_type=et,
        color=body.color,
        is_all_day=body.is_all_day,
        created_by_id=current_user.id,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _event_to_out(ev)


@router.put("/{event_id}", response_model=CalendarEventOut)
def update_event(
    event_id: int,
    body: CalendarEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not _is_superuser(current_user) and ev.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    if body.title is not None:
        ev.title = body.title
    if body.description is not None:
        ev.description = body.description
    if body.event_date is not None:
        ev.event_date = body.event_date
    if body.end_date is not None:
        ev.end_date = body.end_date
    if body.event_type is not None:
        try:
            ev.event_type = EventType(body.event_type)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"event_type inválido: {body.event_type}")
    if body.color is not None:
        ev.color = body.color
    if body.is_all_day is not None:
        ev.is_all_day = body.is_all_day

    db.commit()
    db.refresh(ev)
    return _event_to_out(ev)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not _is_superuser(current_user) and ev.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    db.delete(ev)
    db.commit()
