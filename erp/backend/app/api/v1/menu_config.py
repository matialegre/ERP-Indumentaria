"""
Router de configuración de menú — guarda/lee la estructura de solapas del Configurador de Menú.
Almacenamiento en archivo JSON por company (o "global" para SUPERADMIN sin company).
Cualquier usuario autenticado puede leer; SUPERADMIN y ADMIN pueden modificar.
Incluye SSE endpoint para notificar a clientes conectados cuando se guarda el menú.
"""

import asyncio
import json
import pathlib
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any

from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.core.security import decode_access_token

router = APIRouter(prefix="/menu-config", tags=["Configurador de Menú"])

# Directorio donde se guardan los JSON de configuración de menú
DATA_DIR = pathlib.Path(__file__).resolve().parent.parent.parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# In-memory SSE subscribers: company_key → list of asyncio.Queue
_subscribers: dict[str, list[asyncio.Queue]] = {}


def _company_key(company_id: int | None) -> str:
    return str(company_id) if company_id else "global"


def _broadcast(key: str) -> None:
    """Push notification to all SSE clients for this company key."""
    payload = json.dumps({"key": key})
    for q in list(_subscribers.get(key, [])):
        try:
            q.put_nowait(payload)
        except Exception:
            pass


def _config_path(company_id: int | None) -> pathlib.Path:
    key = _company_key(company_id)
    return DATA_DIR / f"menu_config_{key}.json"


def _read_config(path: pathlib.Path) -> list:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_config(path: pathlib.Path, data: list) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class MenuConfigBody(BaseModel):
    tree: list[Any]


@router.get("")
def get_menu_config(
    current_user: User = Depends(get_current_user),
):
    """Devuelve la estructura de menú guardada para la empresa del usuario."""
    path = _config_path(current_user.company_id)
    return {"tree": _read_config(path)}


@router.get("/events")
async def menu_config_events(
    token: str = Query(..., description="JWT token (EventSource can't send headers)"),
    db: Session = Depends(get_db),
):
    """SSE stream — emits 'menu-config-updated' when another client saves the menu."""
    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inactivo")

    key = _company_key(user.company_id)
    queue: asyncio.Queue = asyncio.Queue(maxsize=20)

    if key not in _subscribers:
        _subscribers[key] = []
    _subscribers[key].append(queue)

    async def event_stream():
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=25)
                    yield f"event: menu-config-updated\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            subs = _subscribers.get(key, [])
            if queue in subs:
                subs.remove(queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.put("")
async def put_menu_config(
    body: MenuConfigBody,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    """Guarda la estructura de menú. Solo SUPERADMIN o ADMIN pueden modificarla."""
    path = _config_path(current_user.company_id)
    _write_config(path, body.tree)
    _broadcast(_company_key(current_user.company_id))
    return {"ok": True, "tree": body.tree}
