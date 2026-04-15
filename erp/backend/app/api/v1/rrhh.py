"""
rrhh.py — Router del módulo de Recursos Humanos
Endpoints: Empleados, Ausencias, Fichajes, Documentos, Comunicaciones, Naaloo Portal
"""

from typing import Optional, List
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.rrhh import (
    Empleado, EstadoEmpleado, ModalidadEmpleado,
    Ausencia, TipoAusencia, EstadoAusencia,
    Fichaje, TipoFichaje, OrigenFichaje, EstadoFichaje,
    DocumentoRRHH, TipoDocumentoRRHH, EstadoFirma,
    ComunicacionRRHH, TipoComunicacion, LecturaComunicacion,
    DocumentoPublico, FeedPost, FeedReaccion, FeedComentario,
)

router = APIRouter(prefix="/rrhh", tags=["RRHH"])

_ADMIN_ROLES = (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPERVISOR)


def _check_company(user: User):
    if user.company_id is None:
        raise HTTPException(400, "Sin empresa asignada")
    return user.company_id


# ═══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

# ── Empleado ────────────────────────────────────────────────────────────────

class EmpleadoCreate(BaseModel):
    numero_legajo:     Optional[str]   = None
    nombre:            str
    apellido:          str
    dni:               Optional[str]   = None
    cuil:              Optional[str]   = None
    fecha_nacimiento:  Optional[date]  = None
    email:             Optional[str]   = None
    telefono:          Optional[str]   = None
    direccion:         Optional[str]   = None
    fecha_ingreso:     Optional[date]  = None
    cargo:             Optional[str]   = None
    departamento:      Optional[str]   = None
    categoria:         Optional[str]   = None
    modalidad:         Optional[ModalidadEmpleado] = ModalidadEmpleado.PRESENCIAL
    sueldo_basico:     Optional[float] = None
    local_id:          Optional[int]   = None
    emergencia_nombre: Optional[str]   = None
    emergencia_tel:    Optional[str]   = None
    horario:           Optional[str]   = None
    notas:             Optional[str]   = None
    user_id:           Optional[int]   = None


class EmpleadoUpdate(BaseModel):
    numero_legajo:     Optional[str]   = None
    nombre:            Optional[str]   = None
    apellido:          Optional[str]   = None
    dni:               Optional[str]   = None
    cuil:              Optional[str]   = None
    fecha_nacimiento:  Optional[date]  = None
    fecha_egreso:      Optional[date]  = None
    email:             Optional[str]   = None
    telefono:          Optional[str]   = None
    direccion:         Optional[str]   = None
    fecha_ingreso:     Optional[date]  = None
    estado:            Optional[EstadoEmpleado]    = None
    cargo:             Optional[str]   = None
    departamento:      Optional[str]   = None
    categoria:         Optional[str]   = None
    modalidad:         Optional[ModalidadEmpleado] = None
    sueldo_basico:     Optional[float] = None
    local_id:          Optional[int]   = None
    emergencia_nombre: Optional[str]   = None
    emergencia_tel:    Optional[str]   = None
    horario:           Optional[str]   = None
    notas:             Optional[str]   = None
    user_id:           Optional[int]   = None


class EmpleadoOut(BaseModel):
    id:               int
    company_id:       int
    numero_legajo:    Optional[str]
    nombre:           str
    apellido:         str
    nombre_completo:  str
    dni:              Optional[str]
    cuil:             Optional[str]
    fecha_nacimiento: Optional[date]
    email:            Optional[str]
    telefono:         Optional[str]
    direccion:        Optional[str]
    fecha_ingreso:    Optional[date]
    fecha_egreso:     Optional[date]
    estado:           str
    cargo:            Optional[str]
    departamento:     Optional[str]
    categoria:        Optional[str]
    modalidad:        str
    sueldo_basico:    Optional[float]
    local_id:         Optional[int]
    local_nombre:     Optional[str]
    emergencia_nombre: Optional[str]
    emergencia_tel:    Optional[str]
    horario:          Optional[str]
    notas:            Optional[str]
    user_id:          Optional[int]
    created_at:       datetime
    updated_at:       datetime

    model_config = {"from_attributes": True}


# ── Ausencia ─────────────────────────────────────────────────────────────────

class AusenciaCreate(BaseModel):
    empleado_id: int
    tipo:        TipoAusencia
    fecha_desde: date
    fecha_hasta: date
    motivo:      Optional[str] = None


class AusenciaUpdate(BaseModel):
    tipo:        Optional[TipoAusencia]   = None
    fecha_desde: Optional[date]           = None
    fecha_hasta: Optional[date]           = None
    motivo:      Optional[str]            = None


class AprobarAusencia(BaseModel):
    estado:               EstadoAusencia
    comentario_aprobacion: Optional[str] = None


class AusenciaOut(BaseModel):
    id:          int
    company_id:  int
    empleado_id: int
    empleado_nombre: str
    tipo:        str
    fecha_desde: date
    fecha_hasta: date
    dias:        int
    estado:      str
    motivo:      Optional[str]
    comentario_aprobacion: Optional[str]
    aprobado_por_id: Optional[int]
    aprobado_por_nombre: Optional[str]
    aprobado_at: Optional[datetime]
    created_at:  datetime

    model_config = {"from_attributes": True}


# ── Fichaje ──────────────────────────────────────────────────────────────────

class FichajeCreate(BaseModel):
    empleado_id:  int
    fecha:        date
    hora_entrada: Optional[str] = None
    hora_salida:  Optional[str] = None
    tipo:         Optional[TipoFichaje]   = TipoFichaje.PRESENCIAL
    origen:       Optional[OrigenFichaje] = OrigenFichaje.MANUAL
    estado:       Optional[EstadoFichaje] = EstadoFichaje.OK
    latitud:      Optional[float]         = None
    longitud:     Optional[float]         = None
    observacion:  Optional[str]           = None


class FichajeUpdate(BaseModel):
    hora_entrada: Optional[str]           = None
    hora_salida:  Optional[str]           = None
    tipo:         Optional[TipoFichaje]   = None
    estado:       Optional[EstadoFichaje] = None
    observacion:  Optional[str]           = None


class FichajeOut(BaseModel):
    id:              int
    company_id:      int
    empleado_id:     int
    empleado_nombre: str
    fecha:           date
    hora_entrada:    Optional[str]
    hora_salida:     Optional[str]
    horas_trabajadas: Optional[float]
    tipo:            str
    origen:          str
    estado:          str
    latitud:         Optional[float]
    longitud:        Optional[float]
    observacion:     Optional[str]
    created_at:      datetime

    model_config = {"from_attributes": True}


# ── Documento RRHH ───────────────────────────────────────────────────────────

class DocumentoCreate(BaseModel):
    empleado_id:    Optional[int]              = None
    tipo:           TipoDocumentoRRHH
    nombre:         str
    periodo:        Optional[str]              = None
    archivo_base64: Optional[str]              = None
    archivo_nombre: Optional[str]              = None
    archivo_mime:   Optional[str]              = None
    notas:          Optional[str]              = None


class DocumentoOut(BaseModel):
    id:              int
    company_id:      int
    empleado_id:     Optional[int]
    empleado_nombre: Optional[str]
    tipo:            str
    nombre:          str
    periodo:         Optional[str]
    archivo_nombre:  Optional[str]
    archivo_mime:    Optional[str]
    archivo_base64:  Optional[str]
    estado_firma:    str
    firmado_at:      Optional[datetime]
    enviado_at:      Optional[datetime]
    notas:           Optional[str]
    created_at:      datetime

    model_config = {"from_attributes": True}


# ── Comunicación ─────────────────────────────────────────────────────────────

class ComunicacionCreate(BaseModel):
    asunto:        str
    cuerpo:        str
    tipo:          Optional[TipoComunicacion] = TipoComunicacion.GENERAL
    destinatarios: Optional[dict]             = None   # {"target": "ALL"} etc.


class ComunicacionOut(BaseModel):
    id:             int
    company_id:     int
    asunto:         str
    cuerpo:         str
    tipo:           str
    destinatarios:  Optional[dict]
    total_lecturas: int
    archivada:      bool
    enviado_por_id: int
    enviado_por_nombre: str
    created_at:     datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _calc_dias(desde: date, hasta: date) -> int:
    delta = (hasta - desde).days + 1
    return max(delta, 1)


def _calc_horas(entrada: Optional[str], salida: Optional[str]) -> Optional[float]:
    if not entrada or not salida:
        return None
    try:
        h1, m1, *_ = map(int, entrada.split(":"))
        h2, m2, *_ = map(int, salida.split(":"))
        total = (h2 * 60 + m2) - (h1 * 60 + m1)
        return round(max(total, 0) / 60, 2)
    except Exception:
        return None


def _emp_out(e: Empleado) -> EmpleadoOut:
    return EmpleadoOut(
        id=e.id, company_id=e.company_id,
        numero_legajo=e.numero_legajo,
        nombre=e.nombre, apellido=e.apellido,
        nombre_completo=f"{e.nombre} {e.apellido}",
        dni=e.dni, cuil=e.cuil,
        fecha_nacimiento=e.fecha_nacimiento,
        email=e.email, telefono=e.telefono, direccion=e.direccion,
        fecha_ingreso=e.fecha_ingreso, fecha_egreso=e.fecha_egreso,
        estado=e.estado.value,
        cargo=e.cargo, departamento=e.departamento, categoria=e.categoria,
        modalidad=e.modalidad.value,
        sueldo_basico=e.sueldo_basico,
        local_id=e.local_id,
        local_nombre=e.local.nombre if e.local else None,
        emergencia_nombre=e.emergencia_nombre, emergencia_tel=e.emergencia_tel,
        horario=e.horario, notas=e.notas,
        user_id=e.user_id,
        created_at=e.created_at, updated_at=e.updated_at,
    )


def _aus_out(a: Ausencia) -> AusenciaOut:
    return AusenciaOut(
        id=a.id, company_id=a.company_id, empleado_id=a.empleado_id,
        empleado_nombre=f"{a.empleado.nombre} {a.empleado.apellido}" if a.empleado else str(a.empleado_id),
        tipo=a.tipo.value,
        fecha_desde=a.fecha_desde, fecha_hasta=a.fecha_hasta, dias=a.dias,
        estado=a.estado.value,
        motivo=a.motivo,
        comentario_aprobacion=a.comentario_aprobacion,
        aprobado_por_id=a.aprobado_por_id,
        aprobado_por_nombre=a.aprobado_por.full_name if a.aprobado_por else None,
        aprobado_at=a.aprobado_at,
        created_at=a.created_at,
    )


def _fich_out(f: Fichaje) -> FichajeOut:
    return FichajeOut(
        id=f.id, company_id=f.company_id, empleado_id=f.empleado_id,
        empleado_nombre=f"{f.empleado.nombre} {f.empleado.apellido}" if f.empleado else str(f.empleado_id),
        fecha=f.fecha,
        hora_entrada=f.hora_entrada, hora_salida=f.hora_salida,
        horas_trabajadas=f.horas_trabajadas,
        tipo=f.tipo.value, origen=f.origen.value, estado=f.estado.value,
        latitud=f.latitud, longitud=f.longitud, observacion=f.observacion,
        created_at=f.created_at,
    )


def _doc_out(d: DocumentoRRHH) -> DocumentoOut:
    return DocumentoOut(
        id=d.id, company_id=d.company_id,
        empleado_id=d.empleado_id,
        empleado_nombre=f"{d.empleado.nombre} {d.empleado.apellido}" if d.empleado else None,
        tipo=d.tipo.value, nombre=d.nombre, periodo=d.periodo,
        archivo_nombre=d.archivo_nombre, archivo_mime=d.archivo_mime,
        archivo_base64=d.archivo_base64,
        estado_firma=d.estado_firma.value,
        firmado_at=d.firmado_at, enviado_at=d.enviado_at, notas=d.notas,
        created_at=d.created_at,
    )


def _com_out(c: ComunicacionRRHH) -> ComunicacionOut:
    return ComunicacionOut(
        id=c.id, company_id=c.company_id,
        asunto=c.asunto, cuerpo=c.cuerpo, tipo=c.tipo.value,
        destinatarios=c.destinatarios,
        total_lecturas=c.total_lecturas,
        archivada=c.archivada,
        enviado_por_id=c.enviado_por_id,
        enviado_por_nombre=c.enviado_por.full_name if c.enviado_por else str(c.enviado_por_id),
        created_at=c.created_at,
    )


# ═══════════════════════════════════════════════════════════════════════════
# EMPLEADOS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/empleados", response_model=list[EmpleadoOut])
def list_empleados(
    estado:      Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    buscar:      Optional[str] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    q = db.query(Empleado).filter(Empleado.company_id == cid)
    if estado:
        q = q.filter(Empleado.estado == estado)
    if departamento:
        q = q.filter(Empleado.departamento == departamento)
    if buscar:
        like = f"%{buscar}%"
        q = q.filter(
            (Empleado.nombre.ilike(like))
            | (Empleado.apellido.ilike(like))
            | (Empleado.dni.ilike(like))
            | (Empleado.cuil.ilike(like))
            | (Empleado.cargo.ilike(like))
        )
    return [_emp_out(e) for e in q.order_by(Empleado.apellido, Empleado.nombre).all()]


@router.get("/empleados/{emp_id}", response_model=EmpleadoOut)
def get_empleado(
    emp_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    emp = db.query(Empleado).filter(Empleado.id == emp_id, Empleado.company_id == cid).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    return _emp_out(emp)


@router.post("/empleados", response_model=EmpleadoOut, status_code=201)
def create_empleado(
    body: EmpleadoCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    emp = Empleado(company_id=cid, **body.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _emp_out(emp)


@router.put("/empleados/{emp_id}", response_model=EmpleadoOut)
def update_empleado(
    emp_id: int,
    body:   EmpleadoUpdate,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    emp = db.query(Empleado).filter(Empleado.id == emp_id, Empleado.company_id == cid).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(emp, k, v)
    db.commit()
    db.refresh(emp)
    return _emp_out(emp)


@router.delete("/empleados/{emp_id}", status_code=204)
def delete_empleado(
    emp_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    emp = db.query(Empleado).filter(Empleado.id == emp_id, Empleado.company_id == cid).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    db.delete(emp)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# AUSENCIAS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/ausencias", response_model=list[AusenciaOut])
def list_ausencias(
    empleado_id: Optional[int] = Query(None),
    estado:      Optional[str] = Query(None),
    tipo:        Optional[str] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    q = db.query(Ausencia).filter(Ausencia.company_id == cid)
    if empleado_id:
        q = q.filter(Ausencia.empleado_id == empleado_id)
    if estado:
        q = q.filter(Ausencia.estado == estado)
    if tipo:
        q = q.filter(Ausencia.tipo == tipo)
    return [_aus_out(a) for a in q.order_by(Ausencia.fecha_desde.desc()).all()]


@router.post("/ausencias", response_model=AusenciaOut, status_code=201)
def create_ausencia(
    body: AusenciaCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    # Verificar que el empleado pertenece a la empresa
    emp = db.query(Empleado).filter(Empleado.id == body.empleado_id, Empleado.company_id == cid).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    dias = _calc_dias(body.fecha_desde, body.fecha_hasta)
    aus = Ausencia(
        company_id=cid,
        empleado_id=body.empleado_id,
        tipo=body.tipo,
        fecha_desde=body.fecha_desde,
        fecha_hasta=body.fecha_hasta,
        dias=dias,
        motivo=body.motivo,
    )
    db.add(aus)
    db.commit()
    db.refresh(aus)
    return _aus_out(aus)


@router.patch("/ausencias/{aus_id}/aprobar", response_model=AusenciaOut)
def aprobar_ausencia(
    aus_id: int,
    body:   AprobarAusencia,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    aus = db.query(Ausencia).filter(Ausencia.id == aus_id, Ausencia.company_id == cid).first()
    if not aus:
        raise HTTPException(404, "Ausencia no encontrada")
    aus.estado = body.estado
    aus.comentario_aprobacion = body.comentario_aprobacion
    aus.aprobado_por_id = user.id
    aus.aprobado_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(aus)
    return _aus_out(aus)


@router.delete("/ausencias/{aus_id}", status_code=204)
def delete_ausencia(
    aus_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    aus = db.query(Ausencia).filter(Ausencia.id == aus_id, Ausencia.company_id == cid).first()
    if not aus:
        raise HTTPException(404, "Ausencia no encontrada")
    db.delete(aus)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# FICHAJES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/fichajes", response_model=list[FichajeOut])
def list_fichajes(
    empleado_id: Optional[int]  = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    q = db.query(Fichaje).filter(Fichaje.company_id == cid)
    if empleado_id:
        q = q.filter(Fichaje.empleado_id == empleado_id)
    if fecha_desde:
        q = q.filter(Fichaje.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.filter(Fichaje.fecha <= fecha_hasta)
    return [_fich_out(f) for f in q.order_by(Fichaje.fecha.desc()).all()]


@router.post("/fichajes", response_model=FichajeOut, status_code=201)
def create_fichaje(
    body: FichajeCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    emp = db.query(Empleado).filter(Empleado.id == body.empleado_id, Empleado.company_id == cid).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado")
    horas = _calc_horas(body.hora_entrada, body.hora_salida)
    fich = Fichaje(
        company_id=cid,
        empleado_id=body.empleado_id,
        fecha=body.fecha,
        hora_entrada=body.hora_entrada,
        hora_salida=body.hora_salida,
        horas_trabajadas=horas,
        tipo=body.tipo,
        origen=body.origen,
        estado=body.estado,
        latitud=body.latitud,
        longitud=body.longitud,
        observacion=body.observacion,
    )
    db.add(fich)
    db.commit()
    db.refresh(fich)
    return _fich_out(fich)


@router.put("/fichajes/{fich_id}", response_model=FichajeOut)
def update_fichaje(
    fich_id: int,
    body:    FichajeUpdate,
    db:      Session = Depends(get_db),
    user:    User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    fich = db.query(Fichaje).filter(Fichaje.id == fich_id, Fichaje.company_id == cid).first()
    if not fich:
        raise HTTPException(404, "Fichaje no encontrado")
    data = body.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(fich, k, v)
    fich.horas_trabajadas = _calc_horas(fich.hora_entrada, fich.hora_salida)
    db.commit()
    db.refresh(fich)
    return _fich_out(fich)


@router.delete("/fichajes/{fich_id}", status_code=204)
def delete_fichaje(
    fich_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    fich = db.query(Fichaje).filter(Fichaje.id == fich_id, Fichaje.company_id == cid).first()
    if not fich:
        raise HTTPException(404, "Fichaje no encontrado")
    db.delete(fich)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENTOS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/documentos", response_model=list[DocumentoOut])
def list_documentos(
    empleado_id: Optional[int] = Query(None),
    tipo:        Optional[str] = Query(None),
    periodo:     Optional[str] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    q = db.query(DocumentoRRHH).filter(DocumentoRRHH.company_id == cid)
    if empleado_id:
        q = q.filter(DocumentoRRHH.empleado_id == empleado_id)
    if tipo:
        q = q.filter(DocumentoRRHH.tipo == tipo)
    if periodo:
        q = q.filter(DocumentoRRHH.periodo == periodo)
    return [_doc_out(d) for d in q.order_by(DocumentoRRHH.created_at.desc()).all()]


@router.post("/documentos", response_model=DocumentoOut, status_code=201)
def create_documento(
    body: DocumentoCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    if body.empleado_id:
        emp = db.query(Empleado).filter(Empleado.id == body.empleado_id, Empleado.company_id == cid).first()
        if not emp:
            raise HTTPException(404, "Empleado no encontrado")
    doc = DocumentoRRHH(company_id=cid, **body.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.patch("/documentos/{doc_id}/firmar", response_model=DocumentoOut)
def firmar_documento(
    doc_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """El empleado (o admin) firma el documento."""
    cid = _check_company(user)
    doc = db.query(DocumentoRRHH).filter(DocumentoRRHH.id == doc_id, DocumentoRRHH.company_id == cid).first()
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    if doc.estado_firma == EstadoFirma.FIRMADO:
        raise HTTPException(400, "El documento ya fue firmado")
    doc.estado_firma = EstadoFirma.FIRMADO
    doc.firmado_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(doc)
    return _doc_out(doc)


@router.delete("/documentos/{doc_id}", status_code=204)
def delete_documento(
    doc_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    doc = db.query(DocumentoRRHH).filter(DocumentoRRHH.id == doc_id, DocumentoRRHH.company_id == cid).first()
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    db.delete(doc)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# COMUNICACIONES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/comunicaciones", response_model=list[ComunicacionOut])
def list_comunicaciones(
    archivada: Optional[bool] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    q = db.query(ComunicacionRRHH).filter(ComunicacionRRHH.company_id == cid)
    if archivada is not None:
        q = q.filter(ComunicacionRRHH.archivada == archivada)
    return [_com_out(c) for c in q.order_by(ComunicacionRRHH.created_at.desc()).all()]


@router.post("/comunicaciones", response_model=ComunicacionOut, status_code=201)
def create_comunicacion(
    body: ComunicacionCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    com = ComunicacionRRHH(
        company_id=cid,
        enviado_por_id=user.id,
        asunto=body.asunto,
        cuerpo=body.cuerpo,
        tipo=body.tipo,
        destinatarios=body.destinatarios or {"target": "ALL"},
    )
    db.add(com)
    db.commit()
    db.refresh(com)
    return _com_out(com)


@router.patch("/comunicaciones/{com_id}/archivar", response_model=ComunicacionOut)
def archivar_comunicacion(
    com_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    com = db.query(ComunicacionRRHH).filter(ComunicacionRRHH.id == com_id, ComunicacionRRHH.company_id == cid).first()
    if not com:
        raise HTTPException(404, "Comunicación no encontrada")
    com.archivada = not com.archivada
    db.commit()
    db.refresh(com)
    return _com_out(com)


@router.post("/comunicaciones/{com_id}/leer", status_code=204)
def marcar_leida(
    com_id:     int,
    empleado_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Registra que un empleado leyó la comunicación."""
    cid = _check_company(user)
    com = db.query(ComunicacionRRHH).filter(ComunicacionRRHH.id == com_id, ComunicacionRRHH.company_id == cid).first()
    if not com:
        raise HTTPException(404, "Comunicación no encontrada")
    ya = db.query(LecturaComunicacion).filter(
        LecturaComunicacion.comunicacion_id == com_id,
        LecturaComunicacion.empleado_id == empleado_id,
    ).first()
    if not ya:
        db.add(LecturaComunicacion(comunicacion_id=com_id, empleado_id=empleado_id))
        com.total_lecturas = (com.total_lecturas or 0) + 1
        db.commit()


@router.delete("/comunicaciones/{com_id}", status_code=204)
def delete_comunicacion(
    com_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    com = db.query(ComunicacionRRHH).filter(ComunicacionRRHH.id == com_id, ComunicacionRRHH.company_id == cid).first()
    if not com:
        raise HTTPException(404, "Comunicación no encontrada")
    db.query(LecturaComunicacion).filter(LecturaComunicacion.comunicacion_id == com_id).delete()
    db.delete(com)
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# STATS / DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/stats")
def get_stats(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    total_emp  = db.query(Empleado).filter(Empleado.company_id == cid).count()
    activos    = db.query(Empleado).filter(Empleado.company_id == cid, Empleado.estado == EstadoEmpleado.ACTIVO).count()
    ausencias_pendientes = db.query(Ausencia).filter(
        Ausencia.company_id == cid, Ausencia.estado == EstadoAusencia.PENDIENTE
    ).count()
    docs_pendientes = db.query(DocumentoRRHH).filter(
        DocumentoRRHH.company_id == cid, DocumentoRRHH.estado_firma == EstadoFirma.PENDIENTE
    ).count()
    comunicaciones = db.query(ComunicacionRRHH).filter(
        ComunicacionRRHH.company_id == cid, ComunicacionRRHH.archivada == False
    ).count()
    return {
        "total_empleados":       total_emp,
        "empleados_activos":     activos,
        "ausencias_pendientes":  ausencias_pendientes,
        "docs_pendientes_firma": docs_pendientes,
        "comunicaciones_activas": comunicaciones,
    }


# ═══════════════════════════════════════════════════════════════════════════
# NAALOO — PORTAL EMPLEADO
# ═══════════════════════════════════════════════════════════════════════════

def _legajo_pct(e: Empleado) -> float:
    """Calcula el porcentaje de completitud del legajo (0-100)."""
    campos = [
        e.nombre, e.apellido,           # 20%
        e.dni, e.cuil,                  # 20%
        e.fecha_nacimiento,             # 10%
        e.email,                        # 10%
        e.telefono,                     # 10%
        e.fecha_ingreso,                # 10%
        e.cargo,                        # 10%
        e.emergencia_nombre,            # 10%
    ]
    filled = sum(1 for c in campos if c)
    return round(filled / len(campos) * 100, 2)


def _inbox_items(cid: int, emp_id: int, db: Session) -> list:
    """Genera items del buzón de entrada para el empleado."""
    today = date.today()
    items = []

    # 1. Documentos pendientes de firma
    docs = db.query(DocumentoRRHH).filter(
        DocumentoRRHH.company_id == cid,
        DocumentoRRHH.empleado_id == emp_id,
        DocumentoRRHH.estado_firma == EstadoFirma.PENDIENTE,
    ).order_by(DocumentoRRHH.created_at.desc()).all()
    for d in docs:
        items.append({
            "tipo": "DOCUMENTO_FIRMAR",
            "icono": "✍️",
            "titulo": f"Tenés un documento para firmar: {d.nombre}",
            "subtitulo": "Mundo Outdoor",
            "fecha": d.created_at.strftime("%d/%m/%Y %H:%M") if d.created_at else "",
            "doc_id": d.id,
        })

    # 2. Comunicaciones recientes (últimos 30 días)
    comunicaciones = db.query(ComunicacionRRHH).filter(
        ComunicacionRRHH.company_id == cid,
        ComunicacionRRHH.archivada == False,
        ComunicacionRRHH.created_at >= datetime.now(timezone.utc) - timedelta(days=30),
    ).order_by(ComunicacionRRHH.created_at.desc()).limit(5).all()
    for c in comunicaciones:
        items.append({
            "tipo": "COMUNICACION",
            "icono": "📢",
            "titulo": c.asunto,
            "subtitulo": c.enviado_por.full_name if c.enviado_por else "Mundo Outdoor",
            "fecha": c.created_at.strftime("%d/%m/%Y %H:%M") if c.created_at else "",
            "com_id": c.id,
        })

    # 3. Cumpleaños recientes (últimos 14 días + próximos 3)
    todos_emp = db.query(Empleado).filter(
        Empleado.company_id == cid,
        Empleado.estado == EstadoEmpleado.ACTIVO,
        Empleado.fecha_nacimiento != None,
    ).all()
    for e in todos_emp:
        if not e.fecha_nacimiento:
            continue
        try:
            cumple = e.fecha_nacimiento.replace(year=today.year)
        except ValueError:
            cumple = e.fecha_nacimiento.replace(year=today.year, day=28)
        diff = (today - cumple).days
        if -3 <= diff <= 14:
            items.append({
                "tipo": "CUMPLEANOS",
                "icono": "🎈",
                "titulo": f"¡Hoy es el cumpleaños de {e.nombre} {e.apellido}!",
                "subtitulo": "Mundo Outdoor",
                "fecha": cumple.strftime("%d/%m/%Y 07:17"),
                "empleado_id": e.id,
            })

    # 4. Aniversarios recientes
    todos_ing = db.query(Empleado).filter(
        Empleado.company_id == cid,
        Empleado.estado == EstadoEmpleado.ACTIVO,
        Empleado.fecha_ingreso != None,
    ).all()
    for e in todos_ing:
        if not e.fecha_ingreso:
            continue
        anios = today.year - e.fecha_ingreso.year
        if anios <= 0:
            continue
        try:
            aniv = e.fecha_ingreso.replace(year=today.year)
        except ValueError:
            aniv = e.fecha_ingreso.replace(year=today.year, day=28)
        diff = (today - aniv).days
        if 0 <= diff <= 14:
            items.append({
                "tipo": "ANIVERSARIO",
                "icono": "🎉",
                "titulo": f"¡Celebramos el aniversario de {e.nombre} {e.apellido} en Mundo Outdoor!",
                "subtitulo": "Mundo Outdoor",
                "fecha": aniv.strftime("%d/%m/%Y 08:00"),
                "empleado_id": e.id,
            })

    # 5. Primer día recientes
    primer_dia = db.query(Empleado).filter(
        Empleado.company_id == cid,
        Empleado.fecha_ingreso != None,
        Empleado.fecha_ingreso >= today - timedelta(days=14),
    ).all()
    for e in primer_dia:
        items.append({
            "tipo": "PRIMER_DIA",
            "icono": "🐣",
            "titulo": f"Hoy es el primer día de {e.nombre} {e.apellido}",
            "subtitulo": "Mundo Outdoor",
            "fecha": e.fecha_ingreso.strftime("%d/%m/%Y 15:30") if e.fecha_ingreso else "",
            "empleado_id": e.id,
        })

    # Ordenar por fecha descendente (aproximado)
    return sorted(items, key=lambda x: x.get("fecha", ""), reverse=True)


@router.get("/naaloo/home")
def naaloo_home(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Dashboard principal del portal Naaloo para el empleado logueado."""
    cid = _check_company(user)
    today = date.today()
    tomorrow = today + timedelta(days=1)

    # Buscar empleado vinculado al usuario
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid,
        Empleado.user_id == user.id,
    ).first()

    # Ausencias aprobadas
    aus_q = db.query(Ausencia).filter(
        Ausencia.company_id == cid,
        Ausencia.estado == EstadoAusencia.APROBADA,
    )

    def _aus_simple(a):
        return {
            "id": a.id,
            "empleado_nombre": f"{a.empleado.nombre} {a.empleado.apellido}" if a.empleado else "",
            "fecha_desde": str(a.fecha_desde),
            "fecha_hasta": str(a.fecha_hasta),
            "tipo": a.tipo.value,
        }

    ausencias_hoy = [
        _aus_simple(a) for a in aus_q.all()
        if a.fecha_desde <= today <= a.fecha_hasta
    ]
    ausencias_manana = [
        _aus_simple(a) for a in aus_q.all()
        if a.fecha_desde <= tomorrow <= a.fecha_hasta
    ]
    aus_proximas_raw = aus_q.filter(Ausencia.fecha_desde > tomorrow).order_by(Ausencia.fecha_desde).limit(10).all()
    ausencias_proximas = [_aus_simple(a) for a in aus_proximas_raw]

    # Eventos próximos (cumpleaños + aniversarios próximos 90 días)
    todos = db.query(Empleado).filter(
        Empleado.company_id == cid,
        Empleado.estado == EstadoEmpleado.ACTIVO,
    ).all()
    eventos = []
    for e in todos:
        # Cumpleaños
        if e.fecha_nacimiento:
            try:
                prox = e.fecha_nacimiento.replace(year=today.year)
                if prox < today:
                    prox = e.fecha_nacimiento.replace(year=today.year + 1)
            except ValueError:
                prox = e.fecha_nacimiento.replace(year=today.year, day=28)
            if (prox - today).days <= 90:
                eventos.append({
                    "tipo": "CUMPLEANOS",
                    "icono": "🎂",
                    "titulo": f"Cumpleaños de {e.nombre} {e.apellido}",
                    "fecha": str(prox),
                    "empleado_id": e.id,
                })
        # Aniversario
        if e.fecha_ingreso:
            anios = today.year - e.fecha_ingreso.year
            if anios > 0:
                try:
                    prox_aniv = e.fecha_ingreso.replace(year=today.year)
                    if prox_aniv < today:
                        prox_aniv = e.fecha_ingreso.replace(year=today.year + 1)
                except ValueError:
                    prox_aniv = e.fecha_ingreso.replace(year=today.year, day=28)
                if (prox_aniv - today).days <= 90:
                    eventos.append({
                        "tipo": "ANIVERSARIO",
                        "icono": "📣",
                        "titulo": f"Celebramos a {e.nombre} {e.apellido} en Mundo Outdoor",
                        "fecha": str(prox_aniv),
                        "empleado_id": e.id,
                    })
    eventos.sort(key=lambda x: x["fecha"])

    inbox_count = len(_inbox_items(cid, emp.id if emp else 0, db))

    return {
        "empleado": _emp_out(emp) if emp else None,
        "legajo_pct": _legajo_pct(emp) if emp else 0,
        "ausencias_hoy":     ausencias_hoy,
        "ausencias_manana":  ausencias_manana,
        "ausencias_proximas": ausencias_proximas,
        "eventos": eventos[:20],
        "inbox_count": inbox_count,
    }


@router.get("/naaloo/inbox")
def naaloo_inbox(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Buzón de entrada del empleado logueado."""
    cid = _check_company(user)
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid, Empleado.user_id == user.id,
    ).first()
    emp_id = emp.id if emp else 0
    return _inbox_items(cid, emp_id, db)


@router.get("/naaloo/fichaje-hoy")
def naaloo_fichaje_hoy(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Fichaje del día del empleado logueado."""
    cid = _check_company(user)
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid, Empleado.user_id == user.id,
    ).first()
    if not emp:
        return {"fichaje": None, "empleado_vinculado": False}
    today = date.today()
    fich = db.query(Fichaje).filter(
        Fichaje.company_id == cid,
        Fichaje.empleado_id == emp.id,
        Fichaje.fecha == today,
    ).first()
    return {
        "fichaje": _fich_out(fich) if fich else None,
        "empleado_vinculado": True,
        "empleado_id": emp.id,
    }


@router.post("/naaloo/fichar")
def naaloo_fichar(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Toggle clock-in / clock-out del empleado logueado."""
    cid = _check_company(user)
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid, Empleado.user_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(400, "Tu usuario no tiene un empleado vinculado. Pedí al administrador que te asigne.")
    today = date.today()
    now_str = datetime.now().strftime("%H:%M:%S")
    fich = db.query(Fichaje).filter(
        Fichaje.company_id == cid,
        Fichaje.empleado_id == emp.id,
        Fichaje.fecha == today,
    ).first()
    if not fich:
        # Primer fichaje del día → entrada
        fich = Fichaje(
            company_id=cid,
            empleado_id=emp.id,
            fecha=today,
            hora_entrada=now_str,
            tipo=TipoFichaje.PRESENCIAL,
            origen=OrigenFichaje.APP,
            estado=EstadoFichaje.OK,
        )
        db.add(fich)
        accion = "ENTRADA"
    elif not fich.hora_salida:
        # Tiene entrada, falta salida
        fich.hora_salida = now_str
        fich.horas_trabajadas = _calc_horas(fich.hora_entrada, fich.hora_salida)
        accion = "SALIDA"
    else:
        # Ya fichó entrada y salida — resetear para nuevo ciclo
        fich.hora_salida = None
        fich.hora_entrada = now_str
        fich.horas_trabajadas = None
        accion = "ENTRADA"
    db.commit()
    db.refresh(fich)
    return {"accion": accion, "fichaje": _fich_out(fich)}


# ── Documentos Públicos ──────────────────────────────────────────────────────

class DocPublicoCreate(BaseModel):
    nombre:         str
    descripcion:    Optional[str] = None
    archivo_base64: Optional[str] = None
    archivo_nombre: Optional[str] = None
    archivo_mime:   Optional[str] = None


class DocPublicoOut(BaseModel):
    id:             int
    company_id:     int
    nombre:         str
    descripcion:    Optional[str]
    archivo_nombre: Optional[str]
    archivo_mime:   Optional[str]
    archivo_base64: Optional[str]
    activo:         bool
    creado_por_nombre: Optional[str]
    created_at:     datetime

    model_config = {"from_attributes": True}


@router.get("/documentos-publicos", response_model=list[DocPublicoOut])
def list_docs_publicos(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    docs = db.query(DocumentoPublico).filter(
        DocumentoPublico.company_id == cid,
        DocumentoPublico.activo == True,
    ).order_by(DocumentoPublico.created_at.desc()).all()
    return [
        DocPublicoOut(
            id=d.id, company_id=d.company_id,
            nombre=d.nombre, descripcion=d.descripcion,
            archivo_nombre=d.archivo_nombre, archivo_mime=d.archivo_mime,
            archivo_base64=d.archivo_base64,
            activo=d.activo,
            creado_por_nombre=d.creado_por.full_name if d.creado_por else None,
            created_at=d.created_at,
        )
        for d in docs
    ]


@router.post("/documentos-publicos", response_model=DocPublicoOut, status_code=201)
def create_doc_publico(
    body: DocPublicoCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    doc = DocumentoPublico(
        company_id=cid,
        creado_por_id=user.id,
        **body.model_dump(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocPublicoOut(
        id=doc.id, company_id=doc.company_id,
        nombre=doc.nombre, descripcion=doc.descripcion,
        archivo_nombre=doc.archivo_nombre, archivo_mime=doc.archivo_mime,
        archivo_base64=doc.archivo_base64, activo=doc.activo,
        creado_por_nombre=doc.creado_por.full_name if doc.creado_por else None,
        created_at=doc.created_at,
    )


@router.delete("/documentos-publicos/{doc_id}", status_code=204)
def delete_doc_publico(
    doc_id: int,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    doc = db.query(DocumentoPublico).filter(
        DocumentoPublico.id == doc_id, DocumentoPublico.company_id == cid
    ).first()
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    doc.activo = False
    db.commit()


# ── Feed Social ───────────────────────────────────────────────────────────────

class FeedPostCreate(BaseModel):
    titulo:    str
    cuerpo:    Optional[str] = None
    imagen_url: Optional[str] = None
    empleado_protagonista_id: Optional[int] = None


class FeedComentarioCreate(BaseModel):
    texto: str


class FeedComentarioOut(BaseModel):
    id:              int
    empleado_nombre: str
    texto:           str
    created_at:      datetime

    model_config = {"from_attributes": True}


class FeedPostOut(BaseModel):
    id:              int
    company_id:      int
    tipo:            str
    titulo:          str
    cuerpo:          Optional[str]
    imagen_url:      Optional[str]
    empleado_protagonista_nombre: Optional[str]
    creado_por_nombre: Optional[str]
    total_reacciones: int
    yo_reaccione:     bool
    mis_emojis:       list[str]
    comentarios:      list[FeedComentarioOut]
    created_at:       datetime

    model_config = {"from_attributes": True}


def _post_out(p: FeedPost, emp_id: Optional[int]) -> FeedPostOut:
    reacciones = list(p.reacciones) if p.reacciones else []
    mis = [r.emoji for r in reacciones if r.empleado_id == emp_id]
    comentarios_list = list(p.comentarios) if p.comentarios else []
    return FeedPostOut(
        id=p.id, company_id=p.company_id,
        tipo=p.tipo, titulo=p.titulo, cuerpo=p.cuerpo,
        imagen_url=p.imagen_url,
        empleado_protagonista_nombre=(
            f"{p.empleado_protagonista.nombre} {p.empleado_protagonista.apellido}"
            if p.empleado_protagonista else None
        ),
        creado_por_nombre=p.creado_por.full_name if p.creado_por else "Mundo Outdoor",
        total_reacciones=len(reacciones),
        yo_reaccione=len(mis) > 0,
        mis_emojis=mis,
        comentarios=[
            FeedComentarioOut(
                id=c.id,
                empleado_nombre=f"{c.empleado.nombre} {c.empleado.apellido}" if c.empleado else "?",
                texto=c.texto,
                created_at=c.created_at,
            )
            for c in comentarios_list
        ],
        created_at=p.created_at,
    )


@router.get("/feed", response_model=list[FeedPostOut])
def get_feed(
    limit: int = Query(20, le=50),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid, Empleado.user_id == user.id,
    ).first()
    emp_id = emp.id if emp else None
    posts = db.query(FeedPost).filter(
        FeedPost.company_id == cid,
    ).order_by(FeedPost.created_at.desc()).limit(limit).all()
    return [_post_out(p, emp_id) for p in posts]


@router.post("/feed", response_model=FeedPostOut, status_code=201)
def create_feed_post(
    body: FeedPostCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    cid = _check_company(user)
    post = FeedPost(
        company_id=cid,
        tipo="MANUAL",
        titulo=body.titulo,
        cuerpo=body.cuerpo,
        imagen_url=body.imagen_url,
        empleado_protagonista_id=body.empleado_protagonista_id,
        creado_por_id=user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_out(post, None)


@router.post("/feed/{post_id}/reaccionar")
def reaccionar_feed(
    post_id: int,
    emoji: str = Query("❤️"),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Toggle reacción en un post del feed."""
    cid = _check_company(user)
    post = db.query(FeedPost).filter(FeedPost.id == post_id, FeedPost.company_id == cid).first()
    if not post:
        raise HTTPException(404, "Post no encontrado")
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid, Empleado.user_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(400, "Tu usuario no tiene empleado vinculado")
    existing = db.query(FeedReaccion).filter(
        FeedReaccion.post_id == post_id,
        FeedReaccion.empleado_id == emp.id,
        FeedReaccion.emoji == emoji,
    ).first()
    if existing:
        db.delete(existing)
        accion = "REMOVIDA"
    else:
        db.add(FeedReaccion(post_id=post_id, empleado_id=emp.id, emoji=emoji))
        accion = "AGREGADA"
    db.commit()
    db.refresh(post)
    return {"accion": accion, "total": len(list(post.reacciones))}


@router.post("/feed/{post_id}/comentar", response_model=FeedComentarioOut, status_code=201)
def comentar_feed(
    post_id: int,
    body: FeedComentarioCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    cid = _check_company(user)
    post = db.query(FeedPost).filter(FeedPost.id == post_id, FeedPost.company_id == cid).first()
    if not post:
        raise HTTPException(404, "Post no encontrado")
    emp = db.query(Empleado).filter(
        Empleado.company_id == cid, Empleado.user_id == user.id,
    ).first()
    if not emp:
        raise HTTPException(400, "Tu usuario no tiene empleado vinculado")
    comentario = FeedComentario(post_id=post_id, empleado_id=emp.id, texto=body.texto)
    db.add(comentario)
    db.commit()
    db.refresh(comentario)
    return FeedComentarioOut(
        id=comentario.id,
        empleado_nombre=f"{emp.nombre} {emp.apellido}",
        texto=comentario.texto,
        created_at=comentario.created_at,
    )


@router.post("/naaloo/generar-feed")
def generar_feed_automatico(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_ADMIN_ROLES)),
):
    """Genera posts automáticos del día (cumpleaños, aniversarios, primer día)."""
    cid = _check_company(user)
    today = date.today()
    generados = 0

    empleados = db.query(Empleado).filter(
        Empleado.company_id == cid,
        Empleado.estado == EstadoEmpleado.ACTIVO,
    ).all()

    for e in empleados:
        nombre_completo = f"{e.nombre} {e.apellido}"

        # Cumpleaños hoy
        if e.fecha_nacimiento:
            try:
                es_hoy = (e.fecha_nacimiento.month == today.month and
                          e.fecha_nacimiento.day == today.day)
            except Exception:
                es_hoy = False
            if es_hoy:
                existe = db.query(FeedPost).filter(
                    FeedPost.company_id == cid,
                    FeedPost.tipo == "CUMPLEANOS",
                    FeedPost.empleado_protagonista_id == e.id,
                    FeedPost.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0),
                ).first()
                if not existe:
                    db.add(FeedPost(
                        company_id=cid,
                        tipo="CUMPLEANOS",
                        titulo=f"🎂 Cumpleaños de {nombre_completo}",
                        cuerpo=f"¡Hoy es el cumpleaños de {nombre_completo}! 🎉",
                        empleado_protagonista_id=e.id,
                        creado_por_id=user.id,
                    ))
                    generados += 1

        # Aniversario hoy
        if e.fecha_ingreso:
            anios = today.year - e.fecha_ingreso.year
            es_aniv = (anios > 0 and
                       e.fecha_ingreso.month == today.month and
                       e.fecha_ingreso.day == today.day)
            if es_aniv:
                existe = db.query(FeedPost).filter(
                    FeedPost.company_id == cid,
                    FeedPost.tipo == "ANIVERSARIO",
                    FeedPost.empleado_protagonista_id == e.id,
                    FeedPost.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0),
                ).first()
                if not existe:
                    db.add(FeedPost(
                        company_id=cid,
                        tipo="ANIVERSARIO",
                        titulo=f"📣 Celebramos a {nombre_completo} en Mundo Outdoor",
                        cuerpo=f"¡{nombre_completo} cumple {anios} {'año' if anios == 1 else 'años'} con nosotros hoy! 🎊",
                        empleado_protagonista_id=e.id,
                        creado_por_id=user.id,
                    ))
                    generados += 1

        # Primer día
        if e.fecha_ingreso == today:
            existe = db.query(FeedPost).filter(
                FeedPost.company_id == cid,
                FeedPost.tipo == "PRIMER_DIA",
                FeedPost.empleado_protagonista_id == e.id,
            ).first()
            if not existe:
                db.add(FeedPost(
                    company_id=cid,
                    tipo="PRIMER_DIA",
                    titulo=f"🐣 Es el primer día de {nombre_completo}",
                    cuerpo=f"¡Damos la bienvenida a {nombre_completo}! 🫶",
                    empleado_protagonista_id=e.id,
                    creado_por_id=user.id,
                ))
                generados += 1

    db.commit()
    return {"generados": generados, "fecha": str(today)}
