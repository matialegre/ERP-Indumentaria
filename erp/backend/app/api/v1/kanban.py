"""
Router para Kanban — Tableros, Columnas y Tarjetas
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.kanban import KanbanBoard, KanbanColumn, KanbanCard, KanbanCardPriority
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


# ── Schemas ────────────────────────────────────────────

class KanbanCardOut(BaseModel):
    id: int
    column_id: int
    title: str
    description: str | None = None
    priority: str
    color: str | None = None
    position: int
    is_completed: bool
    due_date: datetime.date | None = None
    labels: str | None = None
    assigned_to_id: int | None = None
    assigned_to_name: str | None = None
    created_by_id: int
    model_config = {"from_attributes": True}


class KanbanColumnOut(BaseModel):
    id: int
    board_id: int
    name: str
    position: int
    color: str | None = None
    cards: list[KanbanCardOut] = []
    model_config = {"from_attributes": True}


class KanbanBoardOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    color: str
    is_active: bool
    company_id: int
    created_by_id: int
    columns: list[KanbanColumnOut] = []
    model_config = {"from_attributes": True}


class KanbanBoardCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#3B82F6"
    columns: list[str] = []


class KanbanColumnCreate(BaseModel):
    name: str
    color: str | None = None


class KanbanCardCreate(BaseModel):
    column_id: int
    title: str
    description: str | None = None
    priority: str = "MEDIA"
    color: str | None = None
    due_date: datetime.date | None = None
    labels: str | None = None
    assigned_to_id: int | None = None


class KanbanCardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    color: str | None = None
    due_date: datetime.date | None = None
    labels: str | None = None
    assigned_to_id: int | None = None


class KanbanCardMove(BaseModel):
    column_id: int
    position: int


router = APIRouter(prefix="/kanban", tags=["Kanban"])


# ── Serialize helpers ──────────────────────────────────

def _serialize_card(card: KanbanCard) -> dict:
    return {
        "id": card.id,
        "column_id": card.column_id,
        "title": card.title,
        "description": card.description,
        "priority": card.priority.value if card.priority else "MEDIA",
        "color": card.color,
        "position": card.position,
        "is_completed": card.is_completed,
        "due_date": card.due_date,
        "labels": card.labels,
        "assigned_to_id": card.assigned_to_id,
        "assigned_to_name": card.assigned_to.full_name if card.assigned_to else None,
        "created_by_id": card.created_by_id,
    }


def _serialize_board(board: KanbanBoard) -> dict:
    columns = []
    for col in sorted(board.columns, key=lambda c: c.position):
        columns.append({
            "id": col.id,
            "board_id": col.board_id,
            "name": col.name,
            "position": col.position,
            "color": col.color,
            "cards": [_serialize_card(c) for c in sorted(col.cards, key=lambda c: c.position)],
        })
    return {
        "id": board.id,
        "name": board.name,
        "description": board.description,
        "color": board.color,
        "is_active": board.is_active,
        "company_id": board.company_id,
        "created_by_id": board.created_by_id,
        "columns": columns,
    }


def _apply_company_filter(q, model, current_user: User):
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(model.company_id == current_user.company_id)
    return q


# ── Boards ─────────────────────────────────────────────

@router.get("/boards/")
def list_boards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(KanbanBoard).filter(KanbanBoard.is_active == True)
    q = _apply_company_filter(q, KanbanBoard, current_user)
    q = q.order_by(KanbanBoard.id.desc())
    boards = q.all()
    return [{"id": b.id, "name": b.name, "description": b.description,
             "color": b.color, "is_active": b.is_active,
             "company_id": b.company_id, "created_by_id": b.created_by_id} for b in boards]


@router.get("/boards/{board_id}")
def get_board(
    board_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = db.query(KanbanBoard).filter(KanbanBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Tablero no encontrado")
    return _serialize_board(board)


@router.post("/boards/", status_code=201)
def create_board(
    body: KanbanBoardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = current_user.company_id
    if not company_id and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Usuario sin company asignada")

    board = KanbanBoard(
        name=body.name,
        description=body.description,
        color=body.color,
        is_active=True,
        company_id=company_id,
        created_by_id=current_user.id,
    )
    db.add(board)
    db.flush()

    for idx, col_name in enumerate(body.columns):
        col = KanbanColumn(
            board_id=board.id,
            name=col_name,
            position=idx,
        )
        db.add(col)

    db.commit()
    db.refresh(board)
    return _serialize_board(board)


@router.delete("/boards/{board_id}", status_code=204)
def delete_board(
    board_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    board = db.query(KanbanBoard).filter(KanbanBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Tablero no encontrado")
    db.delete(board)
    db.commit()


# ── Columns ────────────────────────────────────────────

@router.post("/boards/{board_id}/columns/", status_code=201)
def add_column(
    board_id: int,
    body: KanbanColumnCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    board = db.query(KanbanBoard).filter(KanbanBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Tablero no encontrado")

    max_pos = db.query(KanbanColumn).filter(KanbanColumn.board_id == board_id).count()
    col = KanbanColumn(
        board_id=board_id,
        name=body.name,
        color=body.color,
        position=max_pos,
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return {"id": col.id, "board_id": col.board_id, "name": col.name,
            "position": col.position, "color": col.color, "cards": []}


@router.delete("/columns/{column_id}", status_code=204)
def delete_column(
    column_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    col = db.query(KanbanColumn).filter(KanbanColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Columna no encontrada")
    db.delete(col)
    db.commit()


# ── Cards ──────────────────────────────────────────────

@router.post("/cards/", status_code=201)
def create_card(
    body: KanbanCardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = db.query(KanbanColumn).filter(KanbanColumn.id == body.column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Columna no encontrada")

    try:
        priority = KanbanCardPriority(body.priority)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Prioridad inválida: {body.priority}")

    max_pos = db.query(KanbanCard).filter(KanbanCard.column_id == body.column_id).count()
    card = KanbanCard(
        column_id=body.column_id,
        title=body.title,
        description=body.description,
        priority=priority,
        color=body.color,
        position=max_pos,
        is_completed=False,
        due_date=body.due_date,
        labels=body.labels,
        assigned_to_id=body.assigned_to_id,
        created_by_id=current_user.id,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.put("/cards/{card_id}")
def update_card(
    card_id: int,
    body: KanbanCardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(KanbanCard).filter(KanbanCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")

    update_data = body.model_dump(exclude_unset=True)
    if "priority" in update_data:
        try:
            update_data["priority"] = KanbanCardPriority(update_data["priority"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Prioridad inválida: {update_data['priority']}")

    for key, val in update_data.items():
        setattr(card, key, val)
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.post("/cards/{card_id}/move")
def move_card(
    card_id: int,
    body: KanbanCardMove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(KanbanCard).filter(KanbanCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")

    col = db.query(KanbanColumn).filter(KanbanColumn.id == body.column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Columna destino no encontrada")

    card.column_id = body.column_id
    card.position = body.position
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.post("/cards/{card_id}/complete")
def toggle_card_complete(
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(KanbanCard).filter(KanbanCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    card.is_completed = not card.is_completed
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(KanbanCard).filter(KanbanCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    db.delete(card)
    db.commit()
