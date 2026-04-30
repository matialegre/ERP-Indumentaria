"""
Router del módulo CLINK API — proxy a la API pública de Clinkbox.

Mantiene la API key en el servidor (env CLINK_API_KEY) y expone solo
endpoints autenticados del ERP. Rate limit upstream: 50 req/min.

Endpoints:
- GET /clink/locales
- GET /clink/movimientos?codLocal=&fechaDesde=&fechaHasta=
"""

from __future__ import annotations

from datetime import date
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import require_roles
from app.core.config import get_settings
from app.models.user import User, UserRole


router = APIRouter(prefix="/clink", tags=["Clink API"])


def _settings_clink() -> tuple[str, str]:
    s = get_settings()
    base = (s.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
    key = s.CLINK_API_KEY
    if not key:
        raise HTTPException(500, "CLINK_API_KEY no configurada en el servidor")
    return base, key


def _headers(key: str) -> dict[str, str]:
    return {"x-api-key": key, "accept": "application/json"}


@router.get("/locales")
def list_locales(
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION, UserRole.GESTION_PAGOS,
    )),
):
    """Devuelve los locales habilitados de Clinkbox."""
    base, key = _settings_clink()
    try:
        with httpx.Client(timeout=15.0) as cli:
            r = cli.get(f"{base}/api/v1/Locales", headers=_headers(key))
    except httpx.HTTPError as e:
        raise HTTPException(503, f"No se pudo contactar a Clinkbox: {e}")

    if r.status_code == 401:
        raise HTTPException(401, "x-api-key inválida o faltante")
    if r.status_code == 429:
        raise HTTPException(429, "Rate limit superado (50 req/min). Esperá 60s.")
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Clinkbox respondió {r.status_code}: {r.text[:200]}")
    return r.json()


@router.get("/movimientos")
def list_movimientos(
    codLocal: str = Query(..., description="Código del local (de /locales)"),
    fechaDesde: date = Query(..., description="YYYY-MM-DD"),
    fechaHasta: date = Query(..., description="YYYY-MM-DD"),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION, UserRole.GESTION_PAGOS,
    )),
):
    """Movimientos de caja Clinkbox para un local + rango de fechas."""
    if fechaDesde > fechaHasta:
        raise HTTPException(400, "fechaDesde no puede ser posterior a fechaHasta")

    base, key = _settings_clink()
    params = {
        "codLocal": codLocal,
        "fechaDesde": fechaDesde.isoformat(),
        "fechaHasta": fechaHasta.isoformat(),
    }
    try:
        with httpx.Client(timeout=20.0) as cli:
            r = cli.get(f"{base}/api/v1/Movimientos",
                        headers=_headers(key), params=params)
    except httpx.HTTPError as e:
        raise HTTPException(503, f"No se pudo contactar a Clinkbox: {e}")

    if r.status_code == 400:
        raise HTTPException(400, f"Clinkbox 400: {r.text[:300]}")
    if r.status_code == 401:
        raise HTTPException(401, "x-api-key inválida")
    if r.status_code == 403:
        raise HTTPException(403, f"codLocal={codLocal} no pertenece a tu cuenta")
    if r.status_code == 429:
        raise HTTPException(429, "Rate limit superado (50 req/min)")
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Clinkbox respondió {r.status_code}: {r.text[:200]}")
    return r.json()
