"""
Router del módulo Control de Cajas.

Modelo:
- 1 caja por ciudad (6 cajas: BB, NQN, Roca, MdP, VM, CABA)
- caja_movimientos suman/restan al saldo SOLO si están en estado ACEPTADO

Endpoints:
- GET    /cajas
- GET    /cajas/{caja_id}/movimientos
- POST   /cajas/movimientos/{mov_id}/aceptar
- POST   /cajas/movimientos/{mov_id}/rechazar
- POST   /cajas/traspaso
- POST   /cajas/egreso  (multipart, comprobante opcional)
- POST   /cajas/movimientos/{mov_id}/comprobante (subir comprobante post-creación)
- GET    /cajas/{caja_id}/export-pdf
- GET    /cajas/gastos-locales (vista plana de tipo=EGRESO_GASTO)
"""

from __future__ import annotations

import io
import os
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.caja import Caja, CajaMovimiento, MovimientoEstado, MovimientoTipo
from app.models.local import Local
from app.models.user import User, UserRole


router = APIRouter(prefix="/cajas", tags=["Control de Cajas"])


# ─── File storage (mismo patrón que pedidos_files) ──────────────────────────

CAJAS_FILES_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..", "..", "erp", "cajas_files"
))
os.makedirs(CAJAS_FILES_DIR, exist_ok=True)
ALLOWED_COMP_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_COMP_SIZE = 10 * 1024 * 1024  # 10 MB


def _save_comprobante(file: UploadFile, mov_id: int) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_COMP_EXT:
        raise HTTPException(400, f"Comprobante: tipo no permitido ({ext})")
    content = file.file.read()
    if len(content) > MAX_COMP_SIZE:
        raise HTTPException(400, "El comprobante supera 10 MB")
    fname = f"mov_{mov_id}_{uuid.uuid4().hex[:8]}{ext}"
    fpath = os.path.join(CAJAS_FILES_DIR, fname)
    with open(fpath, "wb") as f:
        f.write(content)
    return f"/cajas-files/{fname}"


# ─── Schemas ────────────────────────────────────────────────────────────────


class CajaOut(BaseModel):
    id: int
    ciudad: str
    nombre: str
    saldo_inicial: float
    saldo: float
    locales_count: int
    movimientos_pendientes: int


class MovimientoOut(BaseModel):
    id: int
    caja_id: int
    fecha: date
    tipo: str
    local_id: Optional[int] = None
    local_name: Optional[str] = None
    monto: float
    motivo: Optional[str] = None
    comprobante_url: Optional[str] = None
    estado: str
    aceptado_at: Optional[datetime] = None
    aceptado_por_name: Optional[str] = None
    transfer_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime


class TraspasoIn(BaseModel):
    caja_origen_id: int
    caja_destino_id: int
    monto: float
    motivo: Optional[str] = None
    fecha: Optional[date] = None


# ─── Helpers ────────────────────────────────────────────────────────────────


def _saldo_subq():
    """Subquery que calcula saldo aceptado por caja."""
    sign = case(
        (CajaMovimiento.tipo.in_([MovimientoTipo.INGRESO.value, MovimientoTipo.TRASPASO_IN.value]),
         CajaMovimiento.monto),
        (CajaMovimiento.tipo.in_([MovimientoTipo.EGRESO_GASTO.value, MovimientoTipo.TRASPASO_OUT.value]),
         -CajaMovimiento.monto),
        else_=0,
    )
    return sign


def _serialize_mov(m: CajaMovimiento) -> dict:
    return {
        "id": m.id,
        "caja_id": m.caja_id,
        "fecha": m.fecha,
        "tipo": m.tipo if isinstance(m.tipo, str) else m.tipo.value,
        "local_id": m.local_id,
        "local_name": m.local.name if m.local else None,
        "monto": float(m.monto),
        "motivo": m.motivo,
        "numero": m.numero,
        "comprobante_url": m.comprobante_url,
        "estado": m.estado if isinstance(m.estado, str) else m.estado.value,
        "aceptado_at": m.aceptado_at,
        "aceptado_por_name": m.aceptado_por.full_name if m.aceptado_por else None,
        "transfer_id": m.transfer_id,
        "created_by_name": m.created_by.full_name if m.created_by else None,
        "created_at": m.created_at,
    }


def _get_company_id(current_user: User, db: Session) -> int:
    if current_user.company_id:
        return current_user.company_id
    from app.models.company import Company
    first = db.query(Company).order_by(Company.id.asc()).first()
    if not first:
        raise HTTPException(400, "No hay empresa configurada")
    return first.id


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("")
@router.get("/")
def list_cajas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista las 6 cajas con saldo computado y contador de pendientes."""
    sign = _saldo_subq()
    # Saldo por caja (movimientos ACEPTADOS)
    saldos = dict(
        db.query(
            CajaMovimiento.caja_id,
            func.coalesce(func.sum(sign), 0)
        )
        .filter(CajaMovimiento.estado == MovimientoEstado.ACEPTADO.value)
        .group_by(CajaMovimiento.caja_id)
        .all()
    )
    # Pendientes — count + suma signed (delta si se aceptan todos)
    pendientes = dict(
        db.query(CajaMovimiento.caja_id, func.count(CajaMovimiento.id))
        .filter(CajaMovimiento.estado == MovimientoEstado.PENDIENTE.value)
        .group_by(CajaMovimiento.caja_id)
        .all()
    )
    pendientes_signed = dict(
        db.query(
            CajaMovimiento.caja_id,
            func.coalesce(func.sum(sign), 0)
        )
        .filter(CajaMovimiento.estado == MovimientoEstado.PENDIENTE.value)
        .group_by(CajaMovimiento.caja_id)
        .all()
    )
    pendientes_monto_total = dict(
        db.query(
            CajaMovimiento.caja_id,
            func.coalesce(func.sum(CajaMovimiento.monto), 0)
        )
        .filter(CajaMovimiento.estado == MovimientoEstado.PENDIENTE.value)
        .group_by(CajaMovimiento.caja_id)
        .all()
    )
    # Locales por ciudad
    locales_por_ciudad = dict(
        db.query(Local.ciudad, func.count(Local.id))
        .filter(Local.is_active == True, Local.ciudad.isnot(None))
        .group_by(Local.ciudad)
        .all()
    )

    out = []
    for c in db.query(Caja).order_by(Caja.id).all():
        out.append({
            "id": c.id,
            "ciudad": c.ciudad,
            "nombre": c.nombre,
            "saldo_inicial": float(c.saldo_inicial),
            "saldo": float(c.saldo_inicial) + float(saldos.get(c.id, 0) or 0),
            "locales_count": int(locales_por_ciudad.get(c.ciudad, 0)),
            "movimientos_pendientes": int(pendientes.get(c.id, 0)),
            "pendiente_a_acreditar": float(pendientes_signed.get(c.id, 0) or 0),
            "pendiente_monto_total": float(pendientes_monto_total.get(c.id, 0) or 0),
        })
    return out


@router.get("/{caja_id}/movimientos")
def list_movimientos(
    caja_id: int,
    estado: Optional[str] = Query(None, description="PENDIENTE / ACEPTADO / RECHAZADO"),
    tipo: Optional[str] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    incluir_gastos: bool = Query(False, description="Si false, oculta gastos operativos (compras/cadete) — esos van a Gastos Locales"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Movimientos de una caja fuerte. Por default solo retiros + traspasos +
    ingresos (los gastos operativos se ven en /gastos-locales)."""
    from sqlalchemy import or_, and_, not_
    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    q = (db.query(CajaMovimiento)
         .options(selectinload(CajaMovimiento.local),
                  selectinload(CajaMovimiento.aceptado_por),
                  selectinload(CajaMovimiento.created_by))
         .filter(CajaMovimiento.caja_id == caja_id))
    if not incluir_gastos:
        # Excluir EGRESO_GASTO que NO sean retiros (compras, cadete, etc → módulo Gastos)
        q = q.filter(or_(
            CajaMovimiento.tipo != MovimientoTipo.EGRESO_GASTO.value,
            CajaMovimiento.motivo.ilike("%RETIRO DE%"),
            CajaMovimiento.motivo.ilike("%RETIRO DOLARES%"),
        ))
    if estado:
        q = q.filter(CajaMovimiento.estado == estado.upper())
    if tipo:
        q = q.filter(CajaMovimiento.tipo == tipo.upper())
    if desde:
        q = q.filter(CajaMovimiento.fecha >= desde)
    if hasta:
        q = q.filter(CajaMovimiento.fecha <= hasta)
    rows = q.order_by(CajaMovimiento.fecha.desc(), CajaMovimiento.id.desc()).all()
    return [_serialize_mov(m) for m in rows]


class AceptarLiveIn(BaseModel):
    local_id: Optional[int] = None
    fecha: date
    numero: Optional[str] = None
    descripcion: Optional[str] = None
    monto: float


class AceptarGastoLiveIn(BaseModel):
    local_id: int
    fecha: date
    descripcion: str
    monto: float


@router.post("/aceptar-gasto-live")
def aceptar_gasto_live(
    body: AceptarGastoLiveIn,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Acepta un gasto live (Clink/SQL) → lo crea como EGRESO_GASTO ACEPTADO
    en la caja fuerte de la ciudad correspondiente al local."""
    local = db.query(Local).filter(Local.id == body.local_id).first()
    if not local:
        raise HTTPException(404, "Local no encontrado")
    caja = db.query(Caja).filter(Caja.ciudad == local.ciudad).first()
    if not caja:
        raise HTTPException(404, f"No hay caja para la ciudad {local.ciudad}")
    monto_abs = abs(float(body.monto))
    if monto_abs <= 0:
        raise HTTPException(400, "Monto inválido")
    # Idempotencia
    existing = (db.query(CajaMovimiento)
                .filter(CajaMovimiento.caja_id == caja.id,
                        CajaMovimiento.fecha == body.fecha,
                        CajaMovimiento.local_id == body.local_id,
                        CajaMovimiento.monto == monto_abs,
                        CajaMovimiento.motivo == body.descripcion)
                .first())
    if existing:
        return _serialize_mov(existing)
    company_id = _get_company_id(current_user, db)
    m = CajaMovimiento(
        caja_id=caja.id, fecha=body.fecha, tipo=MovimientoTipo.EGRESO_GASTO.value,
        local_id=body.local_id, monto=monto_abs, motivo=body.descripcion,
        estado=MovimientoEstado.ACEPTADO.value,
        aceptado_por_id=current_user.id,
        aceptado_at=datetime.now(timezone.utc),
        created_by_id=current_user.id, company_id=company_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/{caja_id}/aceptar-live-retiro")
def aceptar_live_retiro(
    caja_id: int,
    body: AceptarLiveIn,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Acepta un retiro proveniente del registradoras (live Clink/SQL).

    Crea un INGRESO ACEPTADO en la caja fuerte con monto absoluto.
    Idempotente: si ya hay un movimiento mismo monto+fecha+numero+local lo
    devuelve sin duplicar.
    """
    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    monto_abs = abs(float(body.monto))
    if monto_abs <= 0:
        raise HTTPException(400, "Monto inválido")

    # Idempotencia: buscar mismo (caja, fecha, numero, local, monto)
    existing = (db.query(CajaMovimiento)
                .filter(CajaMovimiento.caja_id == caja_id,
                        CajaMovimiento.fecha == body.fecha,
                        CajaMovimiento.monto == monto_abs)
                .filter(CajaMovimiento.numero == body.numero if body.numero else CajaMovimiento.numero.is_(None))
                .filter(CajaMovimiento.local_id == body.local_id if body.local_id else CajaMovimiento.local_id.is_(None))
                .first())
    if existing:
        return _serialize_mov(existing)

    company_id = _get_company_id(current_user, db)
    motivo = body.descripcion or "Retiro de caja registradora"
    m = CajaMovimiento(
        caja_id=caja_id, fecha=body.fecha, tipo=MovimientoTipo.INGRESO.value,
        local_id=body.local_id, monto=monto_abs, motivo=motivo, numero=body.numero,
        estado=MovimientoEstado.ACEPTADO.value,
        aceptado_por_id=current_user.id,
        aceptado_at=datetime.now(timezone.utc),
        created_by_id=current_user.id, company_id=company_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/movimientos/{mov_id}/cancelar")
def cancelar_movimiento(
    mov_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Cancela un movimiento (manual o aceptado) → estado RECHAZADO. Si es
    traspaso, cancela también el otro lado (mismo transfer_id)."""
    m = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not m:
        raise HTTPException(404, "Movimiento no encontrado")
    if m.estado == MovimientoEstado.RECHAZADO.value:
        return _serialize_mov(m)
    now_dt = datetime.now(timezone.utc)
    m.estado = MovimientoEstado.RECHAZADO.value
    m.aceptado_por_id = current_user.id
    m.aceptado_at = now_dt
    # Cancelar el otro lado del traspaso si existe
    if m.transfer_id:
        otros = (db.query(CajaMovimiento)
                 .filter(CajaMovimiento.transfer_id == m.transfer_id,
                         CajaMovimiento.id != m.id,
                         CajaMovimiento.estado != MovimientoEstado.RECHAZADO.value)
                 .all())
        for o in otros:
            o.estado = MovimientoEstado.RECHAZADO.value
            o.aceptado_por_id = current_user.id
            o.aceptado_at = now_dt
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/movimientos/{mov_id}/aceptar")
def aceptar_movimiento(
    mov_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    m = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not m:
        raise HTTPException(404, "Movimiento no encontrado")
    if m.estado == MovimientoEstado.ACEPTADO.value:
        return _serialize_mov(m)
    m.estado = MovimientoEstado.ACEPTADO.value
    m.aceptado_por_id = current_user.id
    m.aceptado_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/movimientos/{mov_id}/rechazar")
def rechazar_movimiento(
    mov_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    m = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not m:
        raise HTTPException(404, "Movimiento no encontrado")
    m.estado = MovimientoEstado.RECHAZADO.value
    m.aceptado_por_id = current_user.id
    m.aceptado_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/traspaso")
def crear_traspaso(
    body: TraspasoIn,
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS,
    )),
    db: Session = Depends(get_db),
):
    if body.caja_origen_id == body.caja_destino_id:
        raise HTTPException(400, "Origen y destino deben ser cajas distintas")
    if body.monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    co = db.query(Caja).filter(Caja.id == body.caja_origen_id).first()
    cd = db.query(Caja).filter(Caja.id == body.caja_destino_id).first()
    if not co or not cd:
        raise HTTPException(404, "Caja no encontrada")

    company_id = _get_company_id(current_user, db)
    fecha = body.fecha or date.today()
    tid = uuid.uuid4().hex[:32]

    now_dt = datetime.now(timezone.utc)
    m_out = CajaMovimiento(
        caja_id=co.id, fecha=fecha, tipo=MovimientoTipo.TRASPASO_OUT.value,
        monto=body.monto, motivo=body.motivo or f"Traspaso a {cd.ciudad}",
        estado=MovimientoEstado.ACEPTADO.value, transfer_id=tid,
        aceptado_por_id=current_user.id, aceptado_at=now_dt,
        created_by_id=current_user.id, company_id=company_id,
    )
    m_in = CajaMovimiento(
        caja_id=cd.id, fecha=fecha, tipo=MovimientoTipo.TRASPASO_IN.value,
        monto=body.monto, motivo=body.motivo or f"Traspaso desde {co.ciudad}",
        estado=MovimientoEstado.ACEPTADO.value, transfer_id=tid,
        aceptado_por_id=current_user.id, aceptado_at=now_dt,
        created_by_id=current_user.id, company_id=company_id,
    )
    db.add_all([m_out, m_in])
    db.commit()
    db.refresh(m_out)
    db.refresh(m_in)
    return {"transfer_id": tid, "out": _serialize_mov(m_out), "in": _serialize_mov(m_in)}


@router.post("/ingreso")
async def crear_ingreso(
    caja_id: int = Form(...),
    monto: float = Form(...),
    motivo: str = Form(...),
    numero: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
    comprobante: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS, UserRole.LOCAL,
    )),
    db: Session = Depends(get_db),
):
    """Ingreso manual a la caja fuerte (siempre va a la caja principal de la
    ciudad, sin local). Comprobante opcional."""
    if monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    f = date.fromisoformat(fecha) if fecha else date.today()
    company_id = _get_company_id(current_user, db)
    m = CajaMovimiento(
        caja_id=caja_id, fecha=f, tipo=MovimientoTipo.INGRESO.value,
        monto=monto, motivo=motivo, numero=numero,
        estado=MovimientoEstado.ACEPTADO.value,
        aceptado_por_id=current_user.id,
        aceptado_at=datetime.now(timezone.utc),
        created_by_id=current_user.id, company_id=company_id,
    )
    db.add(m)
    db.flush()
    if comprobante is not None and comprobante.filename:
        m.comprobante_url = _save_comprobante(comprobante, m.id)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/egreso")
async def crear_egreso(
    caja_id: int = Form(...),
    monto: float = Form(...),
    motivo: str = Form(...),
    numero: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
    comprobante: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS, UserRole.LOCAL,
    )),
    db: Session = Depends(get_db),
):
    """Egreso/retiro manual de la caja fuerte (siempre de la caja principal,
    sin local). Comprobante opcional."""
    if monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")
    f = date.fromisoformat(fecha) if fecha else date.today()
    company_id = _get_company_id(current_user, db)
    m = CajaMovimiento(
        caja_id=caja_id, fecha=f, tipo=MovimientoTipo.EGRESO_GASTO.value,
        monto=monto, motivo=motivo, numero=numero,
        estado=MovimientoEstado.ACEPTADO.value,
        aceptado_por_id=current_user.id,
        aceptado_at=datetime.now(timezone.utc),
        created_by_id=current_user.id, company_id=company_id,
    )
    db.add(m)
    db.flush()
    if comprobante is not None and comprobante.filename:
        m.comprobante_url = _save_comprobante(comprobante, m.id)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.post("/movimientos/{mov_id}/comprobante")
async def subir_comprobante(
    mov_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS, UserRole.LOCAL,
    )),
    db: Session = Depends(get_db),
):
    m = db.query(CajaMovimiento).filter(CajaMovimiento.id == mov_id).first()
    if not m:
        raise HTTPException(404, "Movimiento no encontrado")
    m.comprobante_url = _save_comprobante(file, m.id)
    db.commit()
    db.refresh(m)
    return _serialize_mov(m)


@router.get("/{caja_id}/export-pdf")
def export_pdf(
    caja_id: int,
    estado: str = Query("ACEPTADO"),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    current_user: User = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.GESTION_PAGOS,
    )),
    db: Session = Depends(get_db),
):
    """Genera PDF con los movimientos del estado dado (default ACEPTADO)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    )

    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")

    q = (db.query(CajaMovimiento)
         .options(selectinload(CajaMovimiento.local))
         .filter(CajaMovimiento.caja_id == caja_id,
                 CajaMovimiento.estado == estado.upper()))
    if desde:
        q = q.filter(CajaMovimiento.fecha >= desde)
    if hasta:
        q = q.filter(CajaMovimiento.fecha <= hasta)
    rows = q.order_by(CajaMovimiento.fecha.desc()).all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm,
    )
    styles = getSampleStyleSheet()
    story = []
    title = f"Caja {caja.ciudad} — Movimientos {estado.upper()}"
    if desde or hasta:
        title += f" ({desde or '...'} → {hasta or '...'})"
    story.append(Paragraph(f"<b>{title}</b>", styles["Title"]))
    story.append(Paragraph(
        f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        styles["Normal"],
    ))
    story.append(Spacer(1, 6*mm))

    es_pendientes = estado.upper() == "PENDIENTE"
    if es_pendientes:
        # Formato simple para pendientes: Fecha | Número | Monto | ☐
        data = [["Fecha", "Número", "Monto", "Tilde"]]
        total = 0.0
        for m in rows:
            data.append([
                m.fecha.isoformat(),
                m.numero or f"#{m.id}",
                f"$ {float(m.monto):,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
                "[   ]",
            ])
            total += float(m.monto)
        col_widths = [40*mm, 60*mm, 50*mm, 30*mm]
    else:
        data = [["Fecha", "Tipo", "Local", "Motivo", "Monto", "Estado"]]
        total = 0.0
        for m in rows:
            data.append([
                m.fecha.isoformat(),
                (m.tipo if isinstance(m.tipo, str) else m.tipo.value).replace("_", " "),
                m.local.name if m.local else "—",
                (m.motivo or "—")[:60],
                f"$ {float(m.monto):,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
                m.estado if isinstance(m.estado, str) else m.estado.value,
            ])
            sign = -1 if (m.tipo in (MovimientoTipo.EGRESO_GASTO.value, MovimientoTipo.TRASPASO_OUT.value)) else 1
            total += sign * float(m.monto)
        col_widths = [25*mm, 35*mm, 50*mm, 80*mm, 30*mm, 30*mm]

    t = Table(data, repeatRows=1, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (4, 1), (4, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        f"<b>Total movimientos:</b> {len(rows)} &nbsp;&nbsp; "
        f"<b>Saldo neto:</b> $ {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
        styles["Normal"],
    ))

    doc.build(story)
    buf.seek(0)
    fname = f"caja_{caja.ciudad.replace(' ', '_')}_{estado}_{date.today().isoformat()}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/registradoras")
async def list_registradoras(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Saldo de hoy de cada caja REGISTRADORA por local.

    Fuente principal: Clinkbox API (1 GET /Movimientos por local con
    `clink_cod_local` configurado). Si Clink falla (timeout, 5xx, 4xx),
    cae en SQL Server (DATOS.CAJAS) automáticamente.

    Solo cuenta movimientos en efectivo (`fpCodigo='E'` en Clink, o
    `FPCodigo IN ('E','None')` en SQL Server). Los egresos vienen
    signados negativos en ambos sistemas.
    """
    import asyncio
    import httpx
    from app.core.config import get_settings

    locales = (db.query(Local)
               .filter(Local.is_active == True, Local.ciudad.isnot(None))
               .order_by(Local.ciudad, Local.name)
               .all())

    today = date.today().isoformat()
    settings = get_settings()
    saldos: dict[int, Optional[float]] = {}
    fuente_por_local: dict[int, Optional[str]] = {}
    needs_sql: set[int] = set()

    # ── 1. Intento Clink en paralelo (per-local, fallback parcial) ────
    if settings.CLINK_API_KEY:
        base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
        headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}
        targets = [l for l in locales if l.clink_cod_local]

        async def _fetch(cli, l):
            r = await cli.get(
                f"{base}/api/v1/Movimientos",
                params={"codLocal": l.clink_cod_local,
                        "fechaDesde": today, "fechaHasta": today},
                headers=headers,
            )
            r.raise_for_status()
            data = r.json().get("data") or []
            return l.id, sum(
                float(m.get("total") or 0) for m in data
                if (m.get("fpCodigo") or "").upper() == "E"
            )

        try:
            # Timeout corto: si un local tarda >5s asumimos que está
            # caído (Clink devuelve 500 después de ~15s normalmente)
            async with httpx.AsyncClient(timeout=5.0) as cli:
                results = await asyncio.gather(
                    *[_fetch(cli, l) for l in targets],
                    return_exceptions=True,
                )
            for l, r in zip(targets, results):
                if isinstance(r, Exception):
                    needs_sql.add(l.id)
                else:
                    _, total = r
                    saldos[l.id] = total
                    fuente_por_local[l.id] = "CLINK"
        except Exception:
            for l in targets:
                needs_sql.add(l.id)

    # Locales sin clink_cod_local → siempre SQL
    for l in locales:
        if not l.clink_cod_local:
            needs_sql.add(l.id)

    # ── 2. Fallback SQL Server (solo para los que faltan) ────────────
    if needs_sql:
        LEGACY_BY_PG = {"MDQ": "MTGMDQ", "MUNDOROC": "MUNDOROCA"}
        sql_rows: dict[str, float] = {}
        sql_ok = True
        try:
            import pyodbc
            conn = pyodbc.connect(
                "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
                "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126",
                timeout=8,
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT LOCAL, SUM(MCImporte)
                FROM CAJAS
                WHERE CAST(FechaActualizacion AS DATE) = CAST(GETDATE() AS DATE)
                  AND (FPCodigo = 'E' OR FPCodigo = 'None')
                GROUP BY LOCAL
            """)
            sql_rows = {r[0].strip(): float(r[1] or 0) for r in cur.fetchall()}
            conn.close()
        except Exception:
            sql_ok = False
        for lid in needs_sql:
            if not sql_ok:
                saldos[lid] = None
                fuente_por_local[lid] = None
                continue
            l = next(x for x in locales if x.id == lid)
            legacy = LEGACY_BY_PG.get(l.code, l.code)
            saldos[lid] = sql_rows.get(legacy, 0.0) if legacy else 0.0
            fuente_por_local[lid] = "SQL"

    # ── 3. Build response ─────────────────────────────────────────────
    fuentes_set = {fuente_por_local.get(l.id) for l in locales}
    fuentes_set.discard(None)
    if fuentes_set == {"CLINK"}:
        fuente_principal = "CLINK"
    elif fuentes_set == {"SQL"}:
        fuente_principal = "SQL"
    elif fuentes_set:
        fuente_principal = "MIXED"
    else:
        fuente_principal = "ERROR"

    out = []
    for l in locales:
        out.append({
            "local_id": l.id,
            "local_code": l.code,
            "local_name": l.name,
            "ciudad": l.ciudad,
            "clink_cod_local": l.clink_cod_local,
            "saldo_dia": saldos.get(l.id),
            "fuente": fuente_por_local.get(l.id),
        })
    return {
        "fuente": fuente_principal,
        "sql_disponible": fuente_principal != "ERROR",
        "items": out,
    }


@router.get("/{caja_id}/movimientos-live")
async def movimientos_live(
    caja_id: int,
    fecha: Optional[date] = Query(None, description="YYYY-MM-DD, default hoy"),
    incluir_ventas: bool = Query(False, description="Si false, solo retiros (no cobros/sobrantes/cambios)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista detallada de movimientos del día (no agregada) para todos los
    locales de la ciudad de la caja. Fuente: Clink primary, SQL fallback
    per-local.

    Por default solo trae RETIROS y traspasos (excluye cobros, sobrantes,
    cambios — esos son ruido para la caja fuerte).
    """
    RETIRO_DESCS = {
        "RETIRO DE EFECTIVO",
        "RETIRO DE DINERO",
        "RETIRO DOLARES",
        "Transferencia a otra caja",
        "Aportes de otra caja",
        "Aportes de otra caja sin justificar",
        "ENVIO DE DINERO A CAJA TESORO",
        "ENVIO DE DINERO A OTRA CAJA",
        "ENVIO DE DINERO",
    }
    def _es_retiro(desc: str) -> bool:
        if not desc:
            return False
        d = desc.strip().upper()
        return d in {x.upper() for x in RETIRO_DESCS} or "RETIRO" in d
    import asyncio
    import httpx
    from app.core.config import get_settings

    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")

    target_fecha = fecha or date.today()
    fecha_iso = target_fecha.isoformat()

    locales = (db.query(Local)
               .filter(Local.is_active == True, Local.ciudad == caja.ciudad)
               .order_by(Local.name)
               .all())
    by_local_id = {l.id: l for l in locales}
    by_clink = {l.clink_cod_local: l for l in locales if l.clink_cod_local}
    LEGACY_BY_PG = {"MDQ": "MTGMDQ", "MUNDOROC": "MUNDOROCA"}
    by_legacy = {LEGACY_BY_PG.get(l.code, l.code): l for l in locales}

    items: list[dict] = []
    needs_sql_for_local_ids: set[int] = set()
    settings = get_settings()

    # ── 1. Clink primero ─────────────────────────────────────────────
    if settings.CLINK_API_KEY:
        base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
        headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}

        async def _fetch(cli, l):
            r = await cli.get(
                f"{base}/api/v1/Movimientos",
                params={"codLocal": l.clink_cod_local,
                        "fechaDesde": fecha_iso, "fechaHasta": fecha_iso},
                headers=headers,
            )
            r.raise_for_status()
            return l.id, r.json().get("data") or []

        targets = [l for l in locales if l.clink_cod_local]
        try:
            async with httpx.AsyncClient(timeout=5.0) as cli:
                results = await asyncio.gather(
                    *[_fetch(cli, l) for l in targets],
                    return_exceptions=True,
                )
            for l, r in zip(targets, results):
                if isinstance(r, Exception):
                    needs_sql_for_local_ids.add(l.id)
                    continue
                _, raw = r
                for m in raw:
                    desc = m.get("descripcion") or ""
                    if not incluir_ventas and not _es_retiro(desc):
                        continue
                    items.append({
                        "local_id": l.id,
                        "local_name": l.name,
                        "fecha": m.get("fechaActualizacion"),
                        "tipo_mov": m.get("tipoMov"),
                        "descripcion": desc,
                        "fp_codigo": m.get("fpCodigo"),
                        "fp_descrip": m.get("fpDescrip"),
                        "total": float(m.get("total") or 0),
                        "descuentos": float(m.get("descuentos") or 0),
                        "vendedor": m.get("apellido"),
                        "fuente": "CLINK",
                    })
        except Exception:
            for l in targets:
                needs_sql_for_local_ids.add(l.id)

    # Locales sin clink_cod_local → SQL
    for l in locales:
        if not l.clink_cod_local:
            needs_sql_for_local_ids.add(l.id)

    # ── 2. SQL fallback ──────────────────────────────────────────────
    if needs_sql_for_local_ids:
        target_codes = [LEGACY_BY_PG.get(by_local_id[lid].code, by_local_id[lid].code)
                        for lid in needs_sql_for_local_ids]
        target_codes = [c for c in target_codes if c]
        if target_codes:
            try:
                import pyodbc
                conn = pyodbc.connect(
                    "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
                    "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126",
                    timeout=8,
                )
                cur = conn.cursor()
                placeholders = ",".join("?" for _ in target_codes)
                cur.execute(f"""
                    SELECT LOCAL, FechaActualizacion, DescripcionMovimiento,
                           FPCodigo, MCImporte, TipoMovimiento
                    FROM CAJAS
                    WHERE CAST(FechaActualizacion AS DATE) = ?
                      AND LOCAL IN ({placeholders})
                    ORDER BY FechaActualizacion DESC
                """, [fecha_iso] + target_codes)
                for row in cur.fetchall():
                    legacy_code = (row[0] or "").strip()
                    l = by_legacy.get(legacy_code)
                    if not l:
                        continue
                    desc = row[2] or ""
                    if not incluir_ventas and not _es_retiro(desc):
                        continue
                    importe = float(row[4] or 0)
                    items.append({
                        "local_id": l.id,
                        "local_name": l.name,
                        "fecha": str(row[1]) if row[1] else None,
                        "tipo_mov": "Ingreso" if importe >= 0 else "Egreso",
                        "descripcion": desc,
                        "fp_codigo": row[3],
                        "fp_descrip": None,
                        "total": importe,
                        "descuentos": 0.0,
                        "vendedor": None,
                        "fuente": "SQL",
                    })
                conn.close()
            except Exception:
                pass  # silently skip; partial Clink data still returns

    # Sort por fecha desc
    items.sort(key=lambda x: x.get("fecha") or "", reverse=True)
    return {
        "fecha": fecha_iso,
        "ciudad": caja.ciudad,
        "items": items,
        "total_items": len(items),
    }


@router.get("/{caja_id}/raw-clink")
async def raw_clink(
    caja_id: int,
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve TODOS los movimientos crudos de Clinkbox (sin filtros) para
    los locales de la ciudad de la caja. Pensado para vista comparativa."""
    import asyncio
    import httpx
    from app.core.config import get_settings

    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")

    f_desde = fecha_desde or date.today()
    f_hasta = fecha_hasta or date.today()

    locales = (db.query(Local)
               .filter(Local.is_active == True, Local.ciudad == caja.ciudad,
                       Local.clink_cod_local.isnot(None))
               .all())

    settings = get_settings()
    if not settings.CLINK_API_KEY:
        return {"items": [], "errores": ["sin_api_key"]}

    base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
    headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}

    async def _fetch(cli, l):
        try:
            r = await cli.get(
                f"{base}/api/v1/Movimientos",
                params={"codLocal": l.clink_cod_local,
                        "fechaDesde": f_desde.isoformat(),
                        "fechaHasta": f_hasta.isoformat()},
                headers=headers,
            )
            r.raise_for_status()
            return l, r.json().get("data") or [], None
        except Exception as e:
            return l, None, str(e)[:100]

    items = []
    errores = []
    if not locales:
        return {"items": [], "errores": ["sin_locales_con_clink_cod"]}
    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            tasks = [_fetch(cli, l) for l in locales]
            results = await asyncio.gather(*tasks)
        for entry in results:
            try:
                l, raw, err = entry
            except Exception:
                errores.append(f"unpack_error: {entry!r}"[:200])
                continue
            if err:
                errores.append(f"{l.name if l else '?'}: {err}")
                continue
            for m in (raw or []):
                items.append({
                    "local_id": l.id,
                    "local_name": l.name,
                    "local_code": l.code,
                    "fecha": m.get("fechaActualizacion"),
                    "tipo_mov": m.get("tipoMov"),
                    "descripcion": m.get("descripcion"),
                    "fp_codigo": m.get("fpCodigo"),
                    "fp_descrip": m.get("fpDescrip"),
                    "total": float(m.get("total") or 0),
                    "vendedor": m.get("apellido"),
                })
    except Exception as e:
        errores.append(f"general[{type(e).__name__}]: {str(e)[:200]}")

    return {"items": items, "errores": errores}


@router.get("/{caja_id}/raw-sql")
def raw_sql(
    caja_id: int,
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve TODOS los movimientos crudos de SQL Server (DATOS.CAJAS) para
    los locales de la ciudad de la caja."""
    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")

    f_desde = fecha_desde or date.today()
    f_hasta = fecha_hasta or date.today()

    LEGACY_BY_PG = {"MDQ": "MTGMDQ", "MUNDOROC": "MUNDOROCA"}
    locales = (db.query(Local)
               .filter(Local.is_active == True, Local.ciudad == caja.ciudad)
               .all())
    legacy_codes = [LEGACY_BY_PG.get(l.code, l.code) for l in locales if l.code]
    legacy_codes = [c for c in legacy_codes if c]
    by_legacy = {LEGACY_BY_PG.get(l.code, l.code): l for l in locales}

    items = []
    errores = []
    if not legacy_codes:
        return {"items": [], "errores": ["sin_locales_con_code"]}
    try:
        import pyodbc
        conn = pyodbc.connect(
            "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
            "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126",
            timeout=8,
        )
        cur = conn.cursor()
        placeholders = ",".join("?" for _ in legacy_codes)
        cur.execute(f"""
            SELECT LOCAL, FechaActualizacion, DescripcionMovimiento,
                   FPCodigo, MCImporte, TipoMovimiento, Id
            FROM CAJAS
            WHERE CAST(FechaActualizacion AS DATE) BETWEEN ? AND ?
              AND LOCAL IN ({placeholders})
            ORDER BY FechaActualizacion DESC
        """, [f_desde.isoformat(), f_hasta.isoformat()] + legacy_codes)
        for row in cur.fetchall():
            legacy_code = (row[0] or "").strip()
            l = by_legacy.get(legacy_code)
            items.append({
                "local_id": l.id if l else None,
                "local_name": l.name if l else legacy_code,
                "local_code": l.code if l else legacy_code,
                "fecha": str(row[1]) if row[1] else None,
                "descripcion": row[2],
                "fp_codigo": row[3],
                "total": float(row[4] or 0),
                "tipo_mov_int": row[5],
                "id_legacy": row[6],
            })
        conn.close()
    except Exception as e:
        errores.append(f"sql: {str(e)[:200]}")

    return {"items": items, "errores": errores}


@router.get("/{caja_id}/registradoras-comparado")
async def registradoras_comparado(
    caja_id: int,
    fecha: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Por cada local de la ciudad de la caja, saldo del día sumado por
    ambas fuentes (CLINK + SQL) — devuelve los dos lado a lado, no fallback.
    """
    import asyncio
    import httpx
    from app.core.config import get_settings

    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")

    f = fecha or date.today()
    f_iso = f.isoformat()

    locales = (db.query(Local)
               .filter(Local.is_active == True, Local.ciudad == caja.ciudad)
               .order_by(Local.name)
               .all())

    # ── Clink ──
    settings = get_settings()
    clink_by_local: dict[int, Optional[float]] = {}
    clink_efectivo_by_local: dict[int, Optional[float]] = {}
    if settings.CLINK_API_KEY:
        base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
        headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}
        targets = [l for l in locales if l.clink_cod_local]

        async def _fetch(cli, l):
            try:
                r = await cli.get(
                    f"{base}/api/v1/Movimientos",
                    params={"codLocal": l.clink_cod_local,
                            "fechaDesde": f_iso, "fechaHasta": f_iso},
                    headers=headers,
                )
                r.raise_for_status()
                return l.id, r.json().get("data") or []
            except Exception:
                return l.id, None

        try:
            async with httpx.AsyncClient(timeout=5.0) as cli:
                results = await asyncio.gather(*[_fetch(cli, l) for l in targets])
            for lid, data in results:
                if data is None:
                    clink_by_local[lid] = None
                    clink_efectivo_by_local[lid] = None
                else:
                    clink_by_local[lid] = sum(float(m.get("total") or 0) for m in data)
                    clink_efectivo_by_local[lid] = sum(
                        float(m.get("total") or 0) for m in data
                        if (m.get("fpCodigo") or "").upper() == "E"
                    )
        except Exception:
            pass

    # ── SQL ──
    sql_by_local: dict[int, Optional[float]] = {}
    sql_efectivo_by_local: dict[int, Optional[float]] = {}
    LEGACY_BY_PG = {"MDQ": "MTGMDQ", "MUNDOROC": "MUNDOROCA"}
    by_legacy = {LEGACY_BY_PG.get(l.code, l.code): l for l in locales}
    try:
        import pyodbc
        conn = pyodbc.connect(
            "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
            "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126",
            timeout=8,
        )
        cur = conn.cursor()
        cur.execute("""
            SELECT LOCAL,
                   SUM(MCImporte) AS total,
                   SUM(CASE WHEN FPCodigo='E' OR FPCodigo='None' THEN MCImporte ELSE 0 END) AS efectivo
            FROM CAJAS
            WHERE CAST(FechaActualizacion AS DATE) = ?
            GROUP BY LOCAL
        """, [f_iso])
        for row in cur.fetchall():
            legacy_code = (row[0] or "").strip()
            l = by_legacy.get(legacy_code)
            if l:
                sql_by_local[l.id] = float(row[1] or 0)
                sql_efectivo_by_local[l.id] = float(row[2] or 0)
        conn.close()
    except Exception:
        pass

    out = []
    for l in locales:
        out.append({
            "local_id": l.id,
            "local_code": l.code,
            "local_name": l.name,
            "ciudad": l.ciudad,
            "clink_cod_local": l.clink_cod_local,
            "clink_total": clink_by_local.get(l.id) if l.id in clink_by_local else None,
            "clink_efectivo": clink_efectivo_by_local.get(l.id) if l.id in clink_efectivo_by_local else None,
            "sql_total": sql_by_local.get(l.id) if l.id in sql_by_local else None,
            "sql_efectivo": sql_efectivo_by_local.get(l.id) if l.id in sql_efectivo_by_local else None,
        })
    return {"items": out, "fecha": f_iso}


@router.get("/{caja_id}/movimientos-comparado")
async def movimientos_comparado(
    caja_id: int,
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve TODOS los movimientos cruzados de PG + CLINK + SQL para los
    locales de la ciudad. Cada fila tiene los 3 montos (o NON si falta).

    Match key: (local_id, fecha-truncada-min, descripción upper, monto-abs).
    """
    import asyncio
    import httpx
    from app.core.config import get_settings

    caja = db.query(Caja).filter(Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(404, "Caja no encontrada")

    f_desde = fecha_desde or date.today()
    f_hasta = fecha_hasta or date.today()

    locales = (db.query(Local)
               .filter(Local.is_active == True, Local.ciudad == caja.ciudad)
               .all())
    by_id = {l.id: l for l in locales}
    LEGACY_BY_PG = {"MDQ": "MTGMDQ", "MUNDOROC": "MUNDOROCA"}
    by_legacy = {LEGACY_BY_PG.get(l.code, l.code): l for l in locales}

    fuentes = {"clink_ok": False, "sql_ok": False, "errores": []}

    # ── 1. PG (caja_movimientos manuales) ──
    pg_rows = (db.query(CajaMovimiento)
               .options(selectinload(CajaMovimiento.local),
                        selectinload(CajaMovimiento.aceptado_por),
                        selectinload(CajaMovimiento.created_by))
               .filter(CajaMovimiento.caja_id == caja_id,
                       CajaMovimiento.fecha >= f_desde,
                       CajaMovimiento.fecha <= f_hasta)
               .order_by(CajaMovimiento.fecha.desc())
               .all())

    # ── 2. Clink ──
    clink_items: list[dict] = []
    settings = get_settings()
    if settings.CLINK_API_KEY:
        base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
        headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}
        targets = [l for l in locales if l.clink_cod_local]

        async def _fetch(cli, l):
            try:
                r = await cli.get(
                    f"{base}/api/v1/Movimientos",
                    params={"codLocal": l.clink_cod_local,
                            "fechaDesde": f_desde.isoformat(),
                            "fechaHasta": f_hasta.isoformat()},
                    headers=headers,
                )
                r.raise_for_status()
                return l, r.json().get("data") or [], None
            except Exception as e:
                return l, None, str(e)[:80]

        try:
            async with httpx.AsyncClient(timeout=8.0) as cli:
                results = await asyncio.gather(*[_fetch(cli, l) for l in targets])
            had_ok = False
            for l, raw, err in results:
                if err:
                    fuentes["errores"].append(f"clink/{l.name}: {err}")
                    continue
                had_ok = True
                for m in (raw or []):
                    clink_items.append({
                        "local_id": l.id,
                        "fecha": m.get("fechaActualizacion"),
                        "descripcion": m.get("descripcion") or "",
                        "tipo_mov": m.get("tipoMov"),
                        "fp_codigo": m.get("fpCodigo"),
                        "fp_descrip": m.get("fpDescrip"),
                        "total": float(m.get("total") or 0),
                        "vendedor": m.get("apellido"),
                    })
            fuentes["clink_ok"] = had_ok
        except Exception as e:
            fuentes["errores"].append(f"clink/general: {str(e)[:80]}")

    # ── 3. SQL ──
    sql_items: list[dict] = []
    legacy_codes = [LEGACY_BY_PG.get(l.code, l.code) for l in locales if l.code]
    legacy_codes = [c for c in legacy_codes if c]
    if legacy_codes:
        try:
            import pyodbc
            conn = pyodbc.connect(
                "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
                "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126",
                timeout=8,
            )
            cur = conn.cursor()
            placeholders = ",".join("?" for _ in legacy_codes)
            cur.execute(f"""
                SELECT LOCAL, FechaActualizacion, DescripcionMovimiento,
                       FPCodigo, MCImporte, Id
                FROM CAJAS
                WHERE CAST(FechaActualizacion AS DATE) BETWEEN ? AND ?
                  AND LOCAL IN ({placeholders})
                ORDER BY FechaActualizacion DESC
            """, [f_desde.isoformat(), f_hasta.isoformat()] + legacy_codes)
            for row in cur.fetchall():
                legacy_code = (row[0] or "").strip()
                l = by_legacy.get(legacy_code)
                if not l:
                    continue
                imp = float(row[4] or 0)
                sql_items.append({
                    "local_id": l.id,
                    "fecha": str(row[1]) if row[1] else None,
                    "descripcion": row[2] or "",
                    "tipo_mov": "Ingreso" if imp >= 0 else "Egreso",
                    "fp_codigo": row[3],
                    "total": imp,
                    "id_legacy": row[6] if len(row) > 6 else None,
                })
            conn.close()
            fuentes["sql_ok"] = True
        except Exception as e:
            fuentes["errores"].append(f"sql: {str(e)[:80]}")

    # ── 4. Cruzar ──
    def _norm(s):
        return (s or "").strip().upper()

    def _fecha_min(f):
        if not f:
            return ""
        return str(f).replace("T", " ").replace("/", "-")[:16]

    def _key(local_id, fecha, desc, monto):
        return (local_id, _fecha_min(fecha), _norm(desc), f"{abs(float(monto or 0)):.2f}")

    rows: dict = {}
    # PG primero
    for m in pg_rows:
        l = m.local
        local_id = m.local_id
        # PG no siempre tiene local_id (caso ingreso/egreso manual general),
        # usar el primer local de la ciudad como fallback para el match
        match_lid = local_id if local_id else None
        k = _key(match_lid, m.fecha, m.motivo or "", m.monto)
        row = rows.setdefault(k, {
            "key": "|".join(str(x) for x in k),
            "fecha": m.fecha.isoformat() if m.fecha else None,
            "local_id": local_id,
            "local_name": l.name if l else None,
            "tipo": m.tipo if isinstance(m.tipo, str) else m.tipo.value,
            "descripcion": m.motivo,
            "fp_codigo": None,
            "fp_descrip": None,
            "vendedor": None,
            "clink_total": None,
            "sql_total": None,
            "pg_total": None,
            "pg_id": None,
            "pg_estado": None,
            "pg_numero": None,
            "id_legacy": None,
        })
        row["pg_total"] = float(m.monto)
        row["pg_id"] = m.id
        row["pg_estado"] = m.estado if isinstance(m.estado, str) else m.estado.value
        row["pg_numero"] = m.numero

    # Clink
    for c in clink_items:
        k = _key(c["local_id"], c["fecha"], c["descripcion"], c["total"])
        row = rows.setdefault(k, {
            "key": "|".join(str(x) for x in k),
            "fecha": c["fecha"],
            "local_id": c["local_id"],
            "local_name": by_id[c["local_id"]].name if c["local_id"] in by_id else None,
            "tipo": "INGRESO" if (c.get("tipo_mov") or "").lower() == "ingreso" else "EGRESO",
            "descripcion": c["descripcion"],
            "fp_codigo": c.get("fp_codigo"),
            "fp_descrip": c.get("fp_descrip"),
            "vendedor": c.get("vendedor"),
            "clink_total": None,
            "sql_total": None,
            "pg_total": None,
            "pg_id": None,
            "pg_estado": None,
            "pg_numero": None,
            "id_legacy": None,
        })
        row["clink_total"] = c["total"]
        # Llenar metadatos vacíos si no los tenía
        if not row.get("fp_codigo"):
            row["fp_codigo"] = c.get("fp_codigo")
            row["fp_descrip"] = c.get("fp_descrip")
        if not row.get("vendedor"):
            row["vendedor"] = c.get("vendedor")

    # SQL
    for s in sql_items:
        k = _key(s["local_id"], s["fecha"], s["descripcion"], s["total"])
        row = rows.setdefault(k, {
            "key": "|".join(str(x) for x in k),
            "fecha": s["fecha"],
            "local_id": s["local_id"],
            "local_name": by_id[s["local_id"]].name if s["local_id"] in by_id else None,
            "tipo": "INGRESO" if (s.get("tipo_mov") or "").lower() == "ingreso" else "EGRESO",
            "descripcion": s["descripcion"],
            "fp_codigo": s.get("fp_codigo"),
            "fp_descrip": None,
            "vendedor": None,
            "clink_total": None,
            "sql_total": None,
            "pg_total": None,
            "pg_id": None,
            "pg_estado": None,
            "pg_numero": None,
            "id_legacy": None,
        })
        row["sql_total"] = s["total"]
        row["id_legacy"] = s.get("id_legacy")
        if not row.get("fp_codigo"):
            row["fp_codigo"] = s.get("fp_codigo")

    arr = list(rows.values())
    arr.sort(key=lambda x: str(x.get("fecha") or ""), reverse=True)
    return {"items": arr, "fuentes": fuentes,
            "fecha_desde": f_desde.isoformat(),
            "fecha_hasta": f_hasta.isoformat()}


@router.get("/gastos-comparado-global")
async def gastos_comparado_global(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    ciudad: Optional[str] = Query(None, description="Filtrar por ciudad (BAHIA BLANCA, NEUQUEN, ...)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vista global cruzada de gastos para todos los locales (o ciudad).

    Trae TODOS los movimientos en el rango (sin filtrar por tipo de gasto)
    y los cruza por (local, fecha-min, descripción, monto-abs).
    El frontend filtra después por descripción / FP / vendedor / ciudad.
    """
    import asyncio
    import httpx
    from app.core.config import get_settings

    f_desde = fecha_desde or date.today()
    f_hasta = fecha_hasta or date.today()

    locales_q = db.query(Local).filter(Local.is_active == True, Local.ciudad.isnot(None))
    if ciudad:
        locales_q = locales_q.filter(Local.ciudad == ciudad.upper())
    locales = locales_q.all()
    by_id = {l.id: l for l in locales}
    LEGACY_BY_PG = {"MDQ": "MTGMDQ", "MUNDOROC": "MUNDOROCA"}
    by_legacy = {LEGACY_BY_PG.get(l.code, l.code): l for l in locales}
    fuentes = {"clink_ok": False, "sql_ok": False, "errores": []}

    # PG (todos los caja_movimientos del rango, todos los tipos)
    pg_q = (db.query(CajaMovimiento)
            .options(selectinload(CajaMovimiento.local))
            .filter(CajaMovimiento.fecha >= f_desde,
                    CajaMovimiento.fecha <= f_hasta))
    if ciudad:
        pg_q = pg_q.join(Caja, CajaMovimiento.caja_id == Caja.id).filter(Caja.ciudad == ciudad.upper())
    pg_rows = pg_q.order_by(CajaMovimiento.fecha.desc()).all()

    # CLINK
    clink_items: list[dict] = []
    settings = get_settings()
    if settings.CLINK_API_KEY:
        base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
        headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}
        targets = [l for l in locales if l.clink_cod_local]

        async def _fetch(cli, l):
            try:
                r = await cli.get(
                    f"{base}/api/v1/Movimientos",
                    params={"codLocal": l.clink_cod_local,
                            "fechaDesde": f_desde.isoformat(),
                            "fechaHasta": f_hasta.isoformat()},
                    headers=headers,
                )
                r.raise_for_status()
                return l, r.json().get("data") or [], None
            except Exception as e:
                return l, None, str(e)[:80]

        try:
            async with httpx.AsyncClient(timeout=10.0) as cli:
                results = await asyncio.gather(*[_fetch(cli, l) for l in targets])
            had_ok = False
            for l, raw, err in results:
                if err:
                    fuentes["errores"].append(f"clink/{l.name}: {err}")
                    continue
                had_ok = True
                for m in (raw or []):
                    clink_items.append({
                        "local_id": l.id,
                        "fecha": m.get("fechaActualizacion"),
                        "descripcion": m.get("descripcion") or "",
                        "tipo_mov": m.get("tipoMov"),
                        "fp_codigo": m.get("fpCodigo"),
                        "fp_descrip": m.get("fpDescrip"),
                        "total": float(m.get("total") or 0),
                        "vendedor": m.get("apellido"),
                    })
            fuentes["clink_ok"] = had_ok
        except Exception as e:
            fuentes["errores"].append(f"clink/general: {str(e)[:80]}")

    # SQL
    sql_items: list[dict] = []
    legacy_codes = [LEGACY_BY_PG.get(l.code, l.code) for l in locales if l.code]
    legacy_codes = [c for c in legacy_codes if c]
    if legacy_codes:
        try:
            import pyodbc
            conn = pyodbc.connect(
                "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
                "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126",
                timeout=8,
            )
            cur = conn.cursor()
            placeholders = ",".join("?" for _ in legacy_codes)
            cur.execute(f"""
                SELECT LOCAL, FechaActualizacion, DescripcionMovimiento,
                       FPCodigo, MCImporte, Id
                FROM CAJAS
                WHERE CAST(FechaActualizacion AS DATE) BETWEEN ? AND ?
                  AND LOCAL IN ({placeholders})
                ORDER BY FechaActualizacion DESC
            """, [f_desde.isoformat(), f_hasta.isoformat()] + legacy_codes)
            for row in cur.fetchall():
                legacy_code = (row[0] or "").strip()
                l = by_legacy.get(legacy_code)
                if not l:
                    continue
                imp = float(row[4] or 0)
                sql_items.append({
                    "local_id": l.id,
                    "fecha": str(row[1]) if row[1] else None,
                    "descripcion": row[2] or "",
                    "tipo_mov": "Ingreso" if imp >= 0 else "Egreso",
                    "fp_codigo": row[3],
                    "total": imp,
                    "id_legacy": row[5] if len(row) > 5 else None,
                })
            conn.close()
            fuentes["sql_ok"] = True
        except Exception as e:
            fuentes["errores"].append(f"sql: {str(e)[:80]}")

    def _norm(s): return (s or "").strip().upper()
    def _fecha_min(f):
        if not f:
            return ""
        return str(f).replace("T", " ").replace("/", "-")[:16]
    def _key(local_id, fecha, desc, monto):
        return (local_id, _fecha_min(fecha), _norm(desc), f"{abs(float(monto or 0)):.2f}")

    rows: dict = {}
    for m in pg_rows:
        l = m.local
        k = _key(m.local_id, m.fecha, m.motivo or "", m.monto)
        row = rows.setdefault(k, {
            "key": "|".join(str(x) for x in k),
            "fecha": m.fecha.isoformat() if m.fecha else None,
            "local_id": m.local_id,
            "local_name": l.name if l else None,
            "ciudad": l.ciudad if l else None,
            "tipo": m.tipo if isinstance(m.tipo, str) else m.tipo.value,
            "descripcion": m.motivo,
            "fp_codigo": None,
            "fp_descrip": None,
            "vendedor": None,
            "clink_total": None,
            "sql_total": None,
            "pg_total": None,
            "pg_id": None,
            "pg_estado": None,
            "pg_numero": None,
            "id_legacy": None,
        })
        row["pg_total"] = float(m.monto)
        row["pg_id"] = m.id
        row["pg_estado"] = m.estado if isinstance(m.estado, str) else m.estado.value
        row["pg_numero"] = m.numero

    for c in clink_items:
        k = _key(c["local_id"], c["fecha"], c["descripcion"], c["total"])
        row = rows.setdefault(k, {
            "key": "|".join(str(x) for x in k),
            "fecha": c["fecha"],
            "local_id": c["local_id"],
            "local_name": by_id[c["local_id"]].name if c["local_id"] in by_id else None,
            "ciudad": by_id[c["local_id"]].ciudad if c["local_id"] in by_id else None,
            "tipo": "INGRESO" if (c.get("tipo_mov") or "").lower() == "ingreso" else "EGRESO",
            "descripcion": c["descripcion"],
            "fp_codigo": c.get("fp_codigo"),
            "fp_descrip": c.get("fp_descrip"),
            "vendedor": c.get("vendedor"),
            "clink_total": None,
            "sql_total": None,
            "pg_total": None,
            "pg_id": None,
            "pg_estado": None,
            "pg_numero": None,
            "id_legacy": None,
        })
        row["clink_total"] = c["total"]
        if not row.get("fp_codigo"):
            row["fp_codigo"] = c.get("fp_codigo")
            row["fp_descrip"] = c.get("fp_descrip")
        if not row.get("vendedor"):
            row["vendedor"] = c.get("vendedor")

    for s in sql_items:
        k = _key(s["local_id"], s["fecha"], s["descripcion"], s["total"])
        row = rows.setdefault(k, {
            "key": "|".join(str(x) for x in k),
            "fecha": s["fecha"],
            "local_id": s["local_id"],
            "local_name": by_id[s["local_id"]].name if s["local_id"] in by_id else None,
            "ciudad": by_id[s["local_id"]].ciudad if s["local_id"] in by_id else None,
            "tipo": "INGRESO" if (s.get("tipo_mov") or "").lower() == "ingreso" else "EGRESO",
            "descripcion": s["descripcion"],
            "fp_codigo": s.get("fp_codigo"),
            "fp_descrip": None,
            "vendedor": None,
            "clink_total": None,
            "sql_total": None,
            "pg_total": None,
            "pg_id": None,
            "pg_estado": None,
            "pg_numero": None,
            "id_legacy": None,
        })
        row["sql_total"] = s["total"]
        row["id_legacy"] = s.get("id_legacy")
        if not row.get("fp_codigo"):
            row["fp_codigo"] = s.get("fp_codigo")

    arr = list(rows.values())
    arr.sort(key=lambda x: str(x.get("fecha") or ""), reverse=True)
    return {"items": arr, "fuentes": fuentes,
            "fecha_desde": f_desde.isoformat(),
            "fecha_hasta": f_hasta.isoformat()}


@router.get("/gastos-locales")
def gastos_locales(
    local_id: Optional[int] = Query(None),
    ciudad: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    include_live: bool = Query(True, description="Incluir gastos en vivo de Clink"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vista combinada de gastos locales:

    - PG (caja_movimientos con tipo=EGRESO_GASTO): histórico legacy importado
      + lo que se carga manual desde el form. Filtrados retiros.
    - Clink (live): movimientos tipo gasto del rango de fechas, con descripcion
      en {COMPRAS, GASTOS VARIOS, CADETE, ...}. Marcados con `estado='LIVE'`
      y `fuente='CLINK'` (no se pueden aceptar/rechazar — son lectura solo).

    Si `include_live=false`, solo PG.
    """
    from sqlalchemy import not_, or_
    from concurrent.futures import ThreadPoolExecutor
    import httpx
    from app.core.config import get_settings

    # ── 1. PG query (igual que antes, retiros excluidos) ────────────
    q = (db.query(CajaMovimiento)
         .options(selectinload(CajaMovimiento.local),
                  selectinload(CajaMovimiento.aceptado_por),
                  selectinload(CajaMovimiento.created_by))
         .filter(CajaMovimiento.tipo == MovimientoTipo.EGRESO_GASTO.value)
         .filter(not_(or_(
             CajaMovimiento.motivo.ilike("%RETIRO DE EFECTIVO%"),
             CajaMovimiento.motivo.ilike("%RETIRO DE DINERO%"),
             CajaMovimiento.motivo.ilike("%RETIRO DOLARES%"),
         ))))
    if local_id:
        q = q.filter(CajaMovimiento.local_id == local_id)
    if ciudad:
        q = q.join(Caja, CajaMovimiento.caja_id == Caja.id).filter(Caja.ciudad == ciudad.upper())
    if estado and estado.upper() != "LIVE":
        q = q.filter(CajaMovimiento.estado == estado.upper())
    if desde:
        q = q.filter(CajaMovimiento.fecha >= desde)
    if hasta:
        q = q.filter(CajaMovimiento.fecha <= hasta)
    rows = q.order_by(CajaMovimiento.fecha.desc(), CajaMovimiento.id.desc()).all()
    pg_items = [{**_serialize_mov(m), "fuente": "PG"} for m in rows]

    # ── 2. Clink live (descripcion en gastos, sin retiros) ─────────
    live_items: list[dict] = []
    if include_live:
        settings = get_settings()
        if settings.CLINK_API_KEY:
            GASTO_DESCS = {
                "COMPRAS",
                "COMPRAS Y GASTOS VARIOS",
                "GASTOS VARIOS",
                "CADETE",
                "Pago de resúmenes C/C",
                "AJUSTE POR NOTA DE CRÉDITO",
                "AJUSTE POR NOTA CREDITO",
            }
            target_locales = (db.query(Local)
                              .filter(Local.is_active == True,
                                      Local.clink_cod_local.isnot(None)))
            if local_id:
                target_locales = target_locales.filter(Local.id == local_id)
            if ciudad:
                target_locales = target_locales.filter(Local.ciudad == ciudad.upper())
            target_locales = target_locales.all()

            f_desde = (desde or date.today()).isoformat()
            f_hasta = (hasta or date.today()).isoformat()

            base = (settings.CLINK_API_BASE or "https://api.clinkboxip.com.ar").rstrip("/")
            headers = {"x-api-key": settings.CLINK_API_KEY, "accept": "application/json"}

            def _fetch_sync(l):
                try:
                    with httpx.Client(timeout=5.0) as cli:
                        r = cli.get(
                            f"{base}/api/v1/Movimientos",
                            params={"codLocal": l.clink_cod_local,
                                    "fechaDesde": f_desde, "fechaHasta": f_hasta},
                            headers=headers,
                        )
                        r.raise_for_status()
                        return l, r.json().get("data") or []
                except Exception:
                    return l, None

            with ThreadPoolExecutor(max_workers=10) as ex:
                results = list(ex.map(_fetch_sync, target_locales))
            for l, raw in results:
                if raw is None:
                    continue
                for m in raw:
                    desc = (m.get("descripcion") or "").strip()
                    if desc not in GASTO_DESCS:
                        continue
                    if "RETIRO" in desc.upper():
                        continue
                    total = float(m.get("total") or 0)
                    live_items.append({
                        "id": None,
                        "caja_id": None,
                        "fecha": (m.get("fechaActualizacion") or "")[:10],
                        "tipo": "EGRESO_GASTO",
                        "local_id": l.id,
                        "local_name": l.name,
                        "monto": abs(total),
                        "motivo": f"{desc} ({m.get('fpDescrip') or m.get('fpCodigo') or 'N/A'})",
                        "comprobante_url": None,
                        "estado": "LIVE",
                        "aceptado_at": None,
                        "aceptado_por_name": None,
                        "transfer_id": None,
                        "created_by_name": m.get("apellido"),
                        "created_at": m.get("fechaActualizacion"),
                        "fuente": "CLINK",
                    })

    # ── 3. Combinar y filtrar por estado=LIVE si se pide ────────────
    if estado and estado.upper() == "LIVE":
        all_items = live_items
    else:
        all_items = pg_items + live_items
    def _key(x):
        f = x.get("fecha")
        c = x.get("created_at")
        return (str(f) if f else "", str(c) if c else "")
    all_items.sort(key=_key, reverse=True)
    return all_items
