"""
Router RFID — endpoints para gestión de etiquetas, lectores, escaneos e inventario RFID.
Sistema completo de captura, alertas y reconciliación.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid
import json

from app.db.session import get_db
from app.models.rfid import (
    RFIDTag, RFIDReader, RFIDScan, RFIDScanSession, RFIDAlert,
    RFIDInventorySnapshot, RFIDMetrics,
    RFIDTagStatus, RFIDReaderType, RFIDScanType, RFIDAlertType,
)
from app.models.local import Local
from app.models.stock_movement import StockMovement, MovementType
from app.api.deps import get_current_user, require_roles
from app.api.module_guard import RequireModule

router = APIRouter(prefix="/rfid", tags=["RFID"])


# ── Schemas ────────────────────────────────────────────────────────────────


class RFIDTagOut(BaseModel):
    id: int
    epc: str
    product_variant_id: int | None = None
    local_id: int | None = None
    status: str
    location: str | None = None
    scan_count: int
    last_scan_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RFIDReaderOut(BaseModel):
    id: int
    device_id: str
    reader_type: str
    name: str
    model: str | None = None
    local_id: int | None = None
    read_range_meters: float
    is_online: bool
    firmware_version: str | None = None
    total_scans: int
    error_count: int
    last_online_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RFIDScanCreate(BaseModel):
    tag_epc: str
    reader_device_id: str
    scan_type: str
    location: str | None = None
    rssi: int | None = None
    is_valid: bool = True


class RFIDScanOut(BaseModel):
    id: int
    tag_id: int
    reader_id: int
    scan_type: str
    local_id: int | None = None
    location: str | None = None
    rssi: int | None = None
    is_valid: bool
    timestamp: datetime

    model_config = {"from_attributes": True}


class RFIDAlertOut(BaseModel):
    id: int
    alert_type: str
    tag_id: int | None = None
    local_id: int | None = None
    title: str
    description: str | None = None
    severity: str
    is_resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RFIDInventoryResultOut(BaseModel):
    local_id: int
    total_variants: int
    total_physical: int
    total_system: int
    total_discrepancies: int
    accuracy_percentage: float


# ── Tags (Etiquetas) ────────────────────────────────────────────────────────


@router.post("/tags/activate", )
async def activate_tags(
    epcs: List[str],
    variant_id: int,
    local_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Activar etiquetas nuevas (recepción CD)."""
    if len(epcs) > 50000:
        raise HTTPException(status_code=400, detail="Máximo 50K etiquetas por lote")
    
    created = 0
    for epc in epcs:
        existing = db.query(RFIDTag).filter_by(epc=epc, company_id=user.company_id).first()
        if not existing:
            tag = RFIDTag(
                company_id=user.company_id,
                epc=epc,
                product_variant_id=variant_id,
                local_id=local_id,
                status=RFIDTagStatus.ACTIVE,
            )
            db.add(tag)
            created += 1
    
    db.commit()
    return {"created": created, "message": f"{created} etiquetas activadas"}


@router.get("/tags", )
async def list_tags(
    status: str = Query(None),
    local_id: int = Query(None),
    limit: int = Query(100, le=1000),
    skip: int = Query(0),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Listar etiquetas."""
    query = db.query(RFIDTag).filter_by(company_id=user.company_id)
    
    if status:
        query = query.filter_by(status=status)
    if local_id:
        query = query.filter_by(local_id=local_id)
    
    total = query.count()
    tags = query.order_by(desc(RFIDTag.last_scan_at)).limit(limit).offset(skip).all()
    
    return {"total": total, "data": [RFIDTagOut.from_orm(t) for t in tags]}


@router.get("/tags/{tag_id}", )
async def get_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Detalle de etiqueta."""
    tag = db.query(RFIDTag).filter_by(id=tag_id, company_id=user.company_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Etiqueta no encontrada")
    return RFIDTagOut.from_orm(tag)


# ── Readers (Lectores) ────────────────────────────────────────────────────


@router.post("/readers", )
async def create_reader(
    device_id: str,
    reader_type: str,
    name: str,
    local_id: int | None = None,
    model: str | None = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Registrar nuevo lector RFID."""
    existing = db.query(RFIDReader).filter_by(device_id=device_id, company_id=user.company_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Lector ya registrado")
    
    reader = RFIDReader(
        company_id=user.company_id,
        device_id=device_id,
        reader_type=reader_type,
        name=name,
        local_id=local_id,
        model=model,
    )
    db.add(reader)
    db.commit()
    db.refresh(reader)
    return RFIDReaderOut.from_orm(reader)


@router.get("/readers", )
async def list_readers(
    local_id: int = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Listar lectores."""
    query = db.query(RFIDReader).filter_by(company_id=user.company_id)
    
    if local_id:
        query = query.filter_by(local_id=local_id)
    
    readers = query.all()
    return [RFIDReaderOut.from_orm(r) for r in readers]


@router.put("/readers/{reader_id}/heartbeat", )
async def reader_heartbeat(
    reader_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Actualizar estado online del lector."""
    reader = db.query(RFIDReader).filter_by(id=reader_id, company_id=user.company_id).first()
    if not reader:
        raise HTTPException(status_code=404, detail="Lector no encontrado")
    
    reader.last_online_at = datetime.utcnow()
    reader.is_online = True
    db.commit()
    
    return {"status": "online", "last_online_at": reader.last_online_at}


# ── Scans (Escaneos) ────────────────────────────────────────────────────


@router.post("/scans", )
async def record_scan(
    payload: RFIDScanCreate,
    local_id: int | None = None,
    session_id: str | None = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Registrar escaneo de etiqueta RFID."""
    
    # Buscar tag y reader
    tag = db.query(RFIDTag).filter_by(epc=payload.tag_epc, company_id=user.company_id).first()
    reader = db.query(RFIDReader).filter_by(device_id=payload.reader_device_id, company_id=user.company_id).first()
    
    if not tag:
        raise HTTPException(status_code=404, detail="Etiqueta no encontrada")
    if not reader:
        raise HTTPException(status_code=404, detail="Lector no encontrado")
    
    scan = RFIDScan(
        company_id=user.company_id,
        tag_id=tag.id,
        reader_id=reader.id,
        scan_type=payload.scan_type,
        session_id=session_id,
        local_id=local_id or reader.local_id,
        location=payload.location,
        rssi=payload.rssi,
        is_valid=payload.is_valid,
        user_id=user.id,
    )
    db.add(scan)
    tag.last_scan_at = datetime.utcnow()
    tag.scan_count += 1
    
    # Actualizar reader stats
    reader.total_scans += 1
    
    db.commit()
    db.refresh(scan)
    return RFIDScanOut.from_orm(scan)


@router.get("/scans", )
async def list_scans(
    local_id: int = Query(None),
    scan_type: str = Query(None),
    limit: int = Query(100, le=1000),
    skip: int = Query(0),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Listar escaneos recientes."""
    query = db.query(RFIDScan).filter_by(company_id=user.company_id)
    
    if local_id:
        query = query.filter_by(local_id=local_id)
    if scan_type:
        query = query.filter_by(scan_type=scan_type)
    
    total = query.count()
    scans = query.order_by(desc(RFIDScan.timestamp)).limit(limit).offset(skip).all()
    
    return {"total": total, "data": [RFIDScanOut.from_orm(s) for s in scans]}


# ── Sessions (Sesiones de Inventario) ────────────────────────────────


@router.post("/sessions", )
async def start_session(
    local_id: int,
    scan_type: str,
    reader_id: int | None = None,
    description: str | None = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Iniciar sesión de escaneo."""
    
    local = db.query(Local).filter_by(id=local_id, company_id=user.company_id).first()
    if not local:
        raise HTTPException(status_code=404, detail="Local no encontrado")
    
    session = RFIDScanSession(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        local_id=local_id,
        reader_id=reader_id,
        scan_type=scan_type,
        description=description,
        user_id=user.id,
    )
    db.add(session)
    db.commit()
    
    return {"session_id": session.id, "local_id": local_id, "started_at": session.started_at}


@router.put("/sessions/{session_id}/complete", )
async def complete_session(
    session_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Finalizar sesión de escaneo."""
    
    session = db.query(RFIDScanSession).filter_by(id=session_id, company_id=user.company_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    session.is_completed = True
    session.completed_at = datetime.utcnow()
    session.duration_seconds = int((session.completed_at - session.started_at).total_seconds())
    
    # Contar tags únicos y totales
    scans = db.query(RFIDScan).filter_by(session_id=session_id).all()
    session.total_tags_read = len(scans)
    session.unique_tags = len(set(s.tag_id for s in scans))
    session.errors_count = sum(1 for s in scans if not s.is_valid)
    
    db.commit()
    
    return {"status": "completed", "total_tags": session.total_tags_read, "duration": session.duration_seconds}


# ── Alerts (Alertas) ────────────────────────────────────────────────────


@router.get("/alerts", )
async def list_alerts(
    local_id: int = Query(None),
    is_resolved: bool = Query(False),
    alert_type: str = Query(None),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Listar alertas RFID."""
    query = db.query(RFIDAlert).filter_by(
        company_id=user.company_id,
        is_resolved=is_resolved,
    )
    
    if local_id:
        query = query.filter_by(local_id=local_id)
    if alert_type:
        query = query.filter_by(alert_type=alert_type)
    
    alerts = query.order_by(desc(RFIDAlert.created_at)).limit(limit).all()
    return [RFIDAlertOut.from_orm(a) for a in alerts]


@router.put("/alerts/{alert_id}/resolve", )
async def resolve_alert(
    alert_id: int,
    resolution_notes: str | None = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Resolver alerta."""
    
    alert = db.query(RFIDAlert).filter_by(id=alert_id, company_id=user.company_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by_id = user.id
    alert.resolution_notes = resolution_notes
    db.commit()
    
    return {"status": "resolved"}


# ── Dashboard ────────────────────────────────────────────────────


@router.get("/dashboard", )
async def get_dashboard(
    local_id: int = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Dashboard RFID — KPIs y status general."""
    
    # Total de etiquetas
    tags_query = db.query(RFIDTag).filter_by(company_id=user.company_id)
    if local_id:
        tags_query = tags_query.filter_by(local_id=local_id)
    
    total_tags = tags_query.count()
    active_tags = tags_query.filter_by(status=RFIDTagStatus.ACTIVE).count()
    damaged_tags = tags_query.filter_by(status=RFIDTagStatus.DAMAGED).count()
    lost_tags = tags_query.filter_by(status=RFIDTagStatus.LOST).count()
    
    # Lectores online
    readers_query = db.query(RFIDReader).filter_by(company_id=user.company_id)
    if local_id:
        readers_query = readers_query.filter_by(local_id=local_id)
    
    total_readers = readers_query.count()
    online_readers = readers_query.filter_by(is_online=True).count()
    
    # Alertas sin resolver
    unresolved_alerts = db.query(RFIDAlert).filter_by(
        company_id=user.company_id,
        is_resolved=False,
    ).count()
    
    # Escaneos últimas 24h
    since = datetime.utcnow() - timedelta(hours=24)
    recent_scans = db.query(func.count(RFIDScan.id)).filter(
        RFIDScan.company_id == user.company_id,
        RFIDScan.timestamp >= since,
    ).scalar() or 0
    
    # Métrica últimas 24h
    latest_metric = db.query(RFIDMetrics).filter_by(company_id=user.company_id).order_by(
        desc(RFIDMetrics.created_at)
    ).first()
    
    return {
        "tags": {
            "total": total_tags,
            "active": active_tags,
            "damaged": damaged_tags,
            "lost": lost_tags,
        },
        "readers": {
            "total": total_readers,
            "online": online_readers,
        },
        "alerts": {
            "unresolved": unresolved_alerts,
        },
        "activity": {
            "scans_24h": recent_scans,
        },
        "latest_metric": latest_metric.model_dump() if latest_metric else None,
    }


# ── Propuesta / Información ────────────────────────────────────────


@router.get("/propuesta", )
async def get_propuesta():
    """Retorna los datos de la propuesta RFID para mostrar en el frontend."""
    return {
        "titulo": "Propuesta RFID — Mundo Outdoor 2026",
        "costo_inicial": 331000,
        "costo_anual": 65000,
        "beneficio_anual": 630000,
        "roi_meses": 9,
        "beneficio_por_dolar": 4.8,
        "locales": 30,
        "cd_units": 1,
        "tags_anuales": 500000,
        "tag_cost_usd": 0.07,
        "tag_benefit_usd": 1.22,
        "precision_actual": "65-75%",
        "precision_con_rfid": "98-99.9%",
        "tiempo_inventario_actual": "8 horas",
        "tiempo_inventario_rfid": "30 minutos",
    }
