"""
Módulo Fichaje — check-in/out con reconocimiento facial y geolocalización.
El reconocimiento facial se hace 100% en el frontend (face-api.js).
El backend almacena descriptores faciales y registros de fichaje.
"""

import math
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole

router = APIRouter(prefix="/fichaje", tags=["Fichaje"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class RegisterFaceBody(BaseModel):
    user_id: int
    descriptor: list[float]  # 128 floats from face-api.js


class CheckinBody(BaseModel):
    checkin_type: str = "ENTRADA"  # ENTRADA | SALIDA
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    face_descriptor: Optional[list[float]] = None  # 128 floats
    local_id: Optional[int] = None


class SetLocalCoordsBody(BaseModel):
    latitude: float
    longitude: float
    geofence_radius: int = 300  # metros


# ─── Utils ────────────────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2) -> float:
    """Distancia en metros entre dos coordenadas GPS."""
    R = 6371000  # radio de la Tierra en metros
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def euclidean_distance(d1: list[float], d2: list[float]) -> float:
    """Distancia euclidiana entre dos descriptores faciales (128 floats)."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(d1, d2)))


FACE_MATCH_THRESHOLD = 0.6  # < 0.6 = misma persona (face-api.js standard)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register-face")
def register_face(
    body: RegisterFaceBody,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Registra el descriptor facial de un empleado (solo ADMIN)."""
    if len(body.descriptor) != 128:
        raise HTTPException(status_code=400, detail="El descriptor debe tener exactamente 128 valores")

    db.execute(text("""
        UPDATE users
        SET face_descriptor = :desc, face_registered_at = NOW()
        WHERE id = :uid
    """), {"desc": str(body.descriptor), "uid": body.user_id})
    db.commit()
    return {"ok": True, "user_id": body.user_id}


@router.delete("/face/{user_id}")
def delete_face(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Elimina el descriptor facial de un empleado."""
    db.execute(text("""
        UPDATE users SET face_descriptor = NULL, face_registered_at = NULL WHERE id = :uid
    """), {"uid": user_id})
    db.commit()
    return {"ok": True}


@router.post("/set-local-coords/{local_id}")
def set_local_coords(
    local_id: int,
    body: SetLocalCoordsBody,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Guarda las coordenadas GPS de un local/tienda."""
    db.execute(text("""
        UPDATE locals
        SET latitude = :lat, longitude = :lon, geofence_radius = :radius
        WHERE id = :lid AND (:cid IS NULL OR company_id = :cid)
    """), {
        "lat": body.latitude, "lon": body.longitude,
        "radius": body.geofence_radius, "lid": local_id,
        "cid": current_user.company_id,
    })
    db.commit()
    return {"ok": True}


@router.post("/checkin")
def do_checkin(
    body: CheckinBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra un fichaje del usuario actual."""
    face_verified = False
    face_match_score = None
    location_verified = False
    distance_to_local = None
    status = "OK"

    # ── Verificación facial ──────────────────────────────────────────────────
    if body.face_descriptor:
        if len(body.face_descriptor) != 128:
            raise HTTPException(status_code=400, detail="Descriptor facial inválido (requiere 128 valores)")

        stored_raw = db.execute(text(
            "SELECT face_descriptor FROM users WHERE id = :uid"
        ), {"uid": current_user.id}).scalar()

        if stored_raw:
            import json
            stored = json.loads(stored_raw) if isinstance(stored_raw, str) else stored_raw
            dist = euclidean_distance(body.face_descriptor, stored)
            face_match_score = round(1 - dist, 4)  # 1 = idéntico, más cercano a 0 = diferente
            face_verified = dist < FACE_MATCH_THRESHOLD
            if not face_verified:
                status = "FACE_FAIL"
        else:
            # No tiene cara registrada, se permite pero sin verificación
            face_match_score = None

    # ── Verificación de ubicación ─────────────────────────────────────────────
    local_id = body.local_id or current_user.local_id
    if body.latitude and body.longitude and local_id:
        local_row = db.execute(text(
            "SELECT latitude, longitude, geofence_radius FROM locals WHERE id = :lid"
        ), {"lid": local_id}).mappings().fetchone()

        if local_row and local_row["latitude"] and local_row["longitude"]:
            distance_to_local = round(haversine(
                body.latitude, body.longitude,
                local_row["latitude"], local_row["longitude"]
            ), 1)
            radius = local_row["geofence_radius"] or 300
            location_verified = distance_to_local <= radius
            if not location_verified and status == "OK":
                status = "LOCATION_FAIL"
        else:
            # Local sin coordenadas registradas, no se puede verificar
            location_verified = None

    # ── Insertar registro ─────────────────────────────────────────────────────
    result = db.execute(text("""
        INSERT INTO employee_checkins
            (user_id, local_id, company_id, checkin_type,
             latitude, longitude, distance_to_local,
             face_match_score, face_verified, location_verified, status)
        VALUES
            (:uid, :lid, :cid, :type,
             :lat, :lon, :dist,
             :fms, :fv, :lv, :status)
        RETURNING id, created_at
    """), {
        "uid": current_user.id,
        "lid": local_id,
        "cid": current_user.company_id,
        "type": body.checkin_type,
        "lat": body.latitude,
        "lon": body.longitude,
        "dist": distance_to_local,
        "fms": face_match_score,
        "fv": face_verified,
        "lv": location_verified,
        "status": status,
    })
    row = result.mappings().fetchone()
    db.commit()

    return {
        "ok": True,
        "id": row["id"],
        "status": status,
        "face_verified": face_verified,
        "face_match_score": face_match_score,
        "location_verified": location_verified,
        "distance_to_local": distance_to_local,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.get("/today")
def get_today(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fichajes de hoy para la empresa del usuario."""
    rows = db.execute(text("""
        SELECT
            ec.id, ec.checkin_type, ec.status, ec.created_at,
            ec.face_verified, ec.location_verified,
            ec.face_match_score, ec.distance_to_local,
            u.full_name, u.username, u.role,
            l.name as local_name
        FROM employee_checkins ec
        JOIN users u ON ec.user_id = u.id
        LEFT JOIN locals l ON ec.local_id = l.id
        WHERE (:cid IS NULL OR ec.company_id = :cid)
          AND DATE(ec.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE
        ORDER BY ec.created_at DESC
    """), {"cid": current_user.company_id}).mappings().fetchall()
    return {"fichajes": [dict(r) for r in rows]}


@router.get("/history")
def get_history(
    user_id: Optional[int] = None,
    local_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historial de fichajes con filtros."""
    # Empleados solo ven sus propios fichajes
    if current_user.role in (UserRole.VENDEDOR, UserRole.DEPOSITO, UserRole.LOCAL):
        user_id = current_user.id

    conditions = ["(:cid IS NULL OR ec.company_id = :cid)"]
    params: dict = {"cid": current_user.company_id, "limit": limit}

    if user_id:
        conditions.append("ec.user_id = :uid")
        params["uid"] = user_id
    if local_id:
        conditions.append("ec.local_id = :lid")
        params["lid"] = local_id
    if date_from:
        conditions.append("DATE(ec.created_at) >= :df")
        params["df"] = date_from
    if date_to:
        conditions.append("DATE(ec.created_at) <= :dt")
        params["dt"] = date_to

    where = " AND ".join(conditions)
    rows = db.execute(text(f"""
        SELECT
            ec.id, ec.checkin_type, ec.status, ec.created_at,
            ec.face_verified, ec.location_verified,
            ec.face_match_score, ec.distance_to_local,
            u.full_name, u.username, u.role,
            l.name as local_name
        FROM employee_checkins ec
        JOIN users u ON ec.user_id = u.id
        LEFT JOIN locals l ON ec.local_id = l.id
        WHERE {where}
        ORDER BY ec.created_at DESC
        LIMIT :limit
    """), params).mappings().fetchall()
    return {"fichajes": [dict(r) for r in rows]}


@router.get("/employees")
def get_employees_status(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Lista de empleados con estado de registro facial y último fichaje."""
    rows = db.execute(text("""
        SELECT
            u.id, u.username, u.full_name, u.role,
            u.face_registered_at,
            u.face_descriptor IS NOT NULL as has_face,
            l.name as local_name,
            last_ec.checkin_type as last_type,
            last_ec.created_at as last_checkin,
            last_ec.status as last_status
        FROM users u
        LEFT JOIN locals l ON u.local_id = l.id
        LEFT JOIN LATERAL (
            SELECT checkin_type, created_at, status
            FROM employee_checkins
            WHERE user_id = u.id
            ORDER BY created_at DESC
            LIMIT 1
        ) last_ec ON true
        WHERE u.is_active = true
          AND (:cid IS NULL OR u.company_id = :cid)
          AND u.role NOT IN ('SUPERADMIN', 'MEGAADMIN')
        ORDER BY u.full_name
    """), {"cid": current_user.company_id}).mappings().fetchall()
    return {"employees": [dict(r) for r in rows]}


@router.get("/my-today")
def get_my_today(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fichajes de hoy del usuario actual."""
    rows = db.execute(text("""
        SELECT id, checkin_type, status, created_at,
               face_verified, location_verified, face_match_score, distance_to_local
        FROM employee_checkins
        WHERE user_id = :uid
          AND DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = CURRENT_DATE
        ORDER BY created_at DESC
    """), {"uid": current_user.id}).mappings().fetchall()
    return {"fichajes": [dict(r) for r in rows]}
