"""
Modelos RRHH — módulo de Recursos Humanos (inspirado en Naaloo)
Incluye: Empleado, Ausencia, Fichaje, DocumentoRRHH, ComunicacionRRHH
"""

import enum
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, Date, DateTime,
    ForeignKey, Enum, JSON, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from datetime import date, datetime
from app.db.base import Base, TimestampMixin


# ── Enums ────────────────────────────────────────────────────────────────────

class EstadoEmpleado(str, enum.Enum):
    ACTIVO     = "ACTIVO"
    LICENCIA   = "LICENCIA"
    VACACIONES = "VACACIONES"
    BAJA       = "BAJA"


class ModalidadEmpleado(str, enum.Enum):
    PRESENCIAL = "PRESENCIAL"
    REMOTO     = "REMOTO"
    HIBRIDO    = "HIBRIDO"


class TipoAusencia(str, enum.Enum):
    VACACIONES          = "VACACIONES"
    ENFERMEDAD          = "ENFERMEDAD"
    LICENCIA_MATERNIDAD = "LICENCIA_MATERNIDAD"
    LICENCIA_PATERNIDAD = "LICENCIA_PATERNIDAD"
    ESTUDIO             = "ESTUDIO"
    DUELO               = "DUELO"
    PERSONAL            = "PERSONAL"
    OTRO                = "OTRO"


class EstadoAusencia(str, enum.Enum):
    PENDIENTE  = "PENDIENTE"
    APROBADA   = "APROBADA"
    RECHAZADA  = "RECHAZADA"
    CANCELADA  = "CANCELADA"


class TipoFichaje(str, enum.Enum):
    PRESENCIAL = "PRESENCIAL"
    REMOTO     = "REMOTO"


class OrigenFichaje(str, enum.Enum):
    MANUAL = "MANUAL"
    APP    = "APP"


class EstadoFichaje(str, enum.Enum):
    OK        = "OK"
    TARDANZA  = "TARDANZA"
    AUSENTE   = "AUSENTE"
    MEDIO_DIA = "MEDIO_DIA"


class TipoDocumentoRRHH(str, enum.Enum):
    RECIBO_SUELDO = "RECIBO_SUELDO"
    CONTRATO      = "CONTRATO"
    CERTIFICADO   = "CERTIFICADO"
    CONSTANCIA    = "CONSTANCIA"
    ACUERDO       = "ACUERDO"
    OTRO          = "OTRO"


class EstadoFirma(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    FIRMADO   = "FIRMADO"
    RECHAZADO = "RECHAZADO"


class TipoComunicacion(str, enum.Enum):
    GENERAL     = "GENERAL"
    URGENTE     = "URGENTE"
    INFORMATIVO = "INFORMATIVO"
    FELICITACION = "FELICITACION"


# ── Modelos ──────────────────────────────────────────────────────────────────

class Empleado(Base, TimestampMixin):
    """Legajo digital del empleado."""
    __tablename__ = "rrhh_empleados"

    id:             Mapped[int]           = mapped_column(primary_key=True, autoincrement=True)
    company_id:     Mapped[int]           = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    # Datos personales
    numero_legajo:  Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    nombre:         Mapped[str]           = mapped_column(String(100), nullable=False)
    apellido:       Mapped[str]           = mapped_column(String(100), nullable=False)
    dni:            Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cuil:           Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fecha_nacimiento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    email:          Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    telefono:       Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    direccion:      Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    foto_url:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Datos laborales
    fecha_ingreso:  Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_egreso:   Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado:         Mapped[EstadoEmpleado] = mapped_column(
        Enum(EstadoEmpleado, name="estado_empleado"), default=EstadoEmpleado.ACTIVO, nullable=False
    )
    cargo:          Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    departamento:   Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    categoria:      Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    modalidad:      Mapped[ModalidadEmpleado] = mapped_column(
        Enum(ModalidadEmpleado, name="modalidad_empleado"), default=ModalidadEmpleado.PRESENCIAL, nullable=False
    )
    sueldo_basico:  Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    local_id:       Mapped[Optional[int]]   = mapped_column(ForeignKey("locals.id"), nullable=True)

    # Contacto de emergencia
    emergencia_nombre: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    emergencia_tel:    Mapped[Optional[str]] = mapped_column(String(50),  nullable=True)

    # Datos adicionales (horarios, observaciones)
    horario:        Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notas:          Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    datos_extra:    Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # El empleado puede tener un usuario ERP asociado (opcional)
    user_id:        Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Relaciones
    local   = relationship("Local",  foreign_keys=[local_id],  lazy="selectin")
    user    = relationship("User",   foreign_keys=[user_id],   lazy="selectin")
    ausencias    = relationship("Ausencia",        back_populates="empleado", lazy="dynamic")
    fichajes     = relationship("Fichaje",         back_populates="empleado", lazy="dynamic")
    documentos   = relationship("DocumentoRRHH",   back_populates="empleado", lazy="dynamic")


class Ausencia(Base, TimestampMixin):
    """Solicitud de ausencia/vacación del empleado."""
    __tablename__ = "rrhh_ausencias"

    id:           Mapped[int]           = mapped_column(primary_key=True, autoincrement=True)
    company_id:   Mapped[int]           = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    empleado_id:  Mapped[int]           = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=False, index=True)

    tipo:         Mapped[TipoAusencia]  = mapped_column(
        Enum(TipoAusencia, name="tipo_ausencia"), nullable=False
    )
    fecha_desde:  Mapped[date]          = mapped_column(Date, nullable=False)
    fecha_hasta:  Mapped[date]          = mapped_column(Date, nullable=False)
    dias:         Mapped[int]           = mapped_column(Integer, nullable=False, default=1)

    estado:       Mapped[EstadoAusencia] = mapped_column(
        Enum(EstadoAusencia, name="estado_ausencia"), default=EstadoAusencia.PENDIENTE, nullable=False
    )
    motivo:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comentario_aprobacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aprobado_por_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    aprobado_at:  Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relaciones
    empleado     = relationship("Empleado", back_populates="ausencias",   lazy="selectin")
    aprobado_por = relationship("User",     foreign_keys=[aprobado_por_id], lazy="selectin")


class Fichaje(Base, TimestampMixin):
    """Registro de entrada/salida del empleado."""
    __tablename__ = "rrhh_fichajes"

    id:           Mapped[int]            = mapped_column(primary_key=True, autoincrement=True)
    company_id:   Mapped[int]            = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    empleado_id:  Mapped[int]            = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=False, index=True)

    fecha:        Mapped[date]           = mapped_column(Date, nullable=False, index=True)
    hora_entrada: Mapped[Optional[str]]  = mapped_column(String(8), nullable=True)   # "HH:MM:SS"
    hora_salida:  Mapped[Optional[str]]  = mapped_column(String(8), nullable=True)
    horas_trabajadas: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    tipo:         Mapped[TipoFichaje]    = mapped_column(
        Enum(TipoFichaje, name="tipo_fichaje"), default=TipoFichaje.PRESENCIAL, nullable=False
    )
    origen:       Mapped[OrigenFichaje]  = mapped_column(
        Enum(OrigenFichaje, name="origen_fichaje"), default=OrigenFichaje.MANUAL, nullable=False
    )
    estado:       Mapped[EstadoFichaje]  = mapped_column(
        Enum(EstadoFichaje, name="estado_fichaje"), default=EstadoFichaje.OK, nullable=False
    )

    latitud:      Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitud:     Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    observacion:  Mapped[Optional[str]]   = mapped_column(Text, nullable=True)

    # Relaciones
    empleado = relationship("Empleado", back_populates="fichajes", lazy="selectin")


class DocumentoRRHH(Base, TimestampMixin):
    """Documentos del empleado: recibos de sueldo, contratos, etc."""
    __tablename__ = "rrhh_documentos"

    id:           Mapped[int]                  = mapped_column(primary_key=True, autoincrement=True)
    company_id:   Mapped[int]                  = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    empleado_id:  Mapped[Optional[int]]        = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=True, index=True)

    tipo:         Mapped[TipoDocumentoRRHH]    = mapped_column(
        Enum(TipoDocumentoRRHH, name="tipo_documento_rrhh"), nullable=False
    )
    nombre:       Mapped[str]                  = mapped_column(String(300), nullable=False)
    periodo:      Mapped[Optional[str]]        = mapped_column(String(7), nullable=True)   # "YYYY-MM"
    archivo_base64: Mapped[Optional[str]]      = mapped_column(Text, nullable=True)
    archivo_nombre: Mapped[Optional[str]]      = mapped_column(String(300), nullable=True)
    archivo_mime:   Mapped[Optional[str]]      = mapped_column(String(100), nullable=True)

    estado_firma: Mapped[EstadoFirma]          = mapped_column(
        Enum(EstadoFirma, name="estado_firma_rrhh"), default=EstadoFirma.PENDIENTE, nullable=False
    )
    firmado_at:   Mapped[Optional[datetime]]   = mapped_column(DateTime(timezone=True), nullable=True)
    firmado_ip:   Mapped[Optional[str]]        = mapped_column(String(50), nullable=True)
    enviado_at:   Mapped[Optional[datetime]]   = mapped_column(DateTime(timezone=True), nullable=True)
    notas:        Mapped[Optional[str]]        = mapped_column(Text, nullable=True)

    # Relaciones
    empleado = relationship("Empleado", back_populates="documentos", lazy="selectin")


class ComunicacionRRHH(Base, TimestampMixin):
    """Comunicaciones masivas al equipo de trabajo."""
    __tablename__ = "rrhh_comunicaciones"

    id:            Mapped[int]                 = mapped_column(primary_key=True, autoincrement=True)
    company_id:    Mapped[int]                 = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    enviado_por_id: Mapped[int]                = mapped_column(ForeignKey("users.id"), nullable=False)

    asunto:        Mapped[str]                 = mapped_column(String(300), nullable=False)
    cuerpo:        Mapped[str]                 = mapped_column(Text, nullable=False)
    tipo:          Mapped[TipoComunicacion]    = mapped_column(
        Enum(TipoComunicacion, name="tipo_comunicacion_rrhh"), default=TipoComunicacion.GENERAL, nullable=False
    )
    # JSON: {"target": "ALL"} o {"target": "DEPARTAMENTO", "valor": "Ventas"} o {"target": "EMPLEADOS", "ids": [1,2,3]}
    destinatarios: Mapped[Optional[dict]]      = mapped_column(JSON, nullable=True)
    total_lecturas: Mapped[int]                = mapped_column(Integer, default=0, nullable=False)
    archivada:     Mapped[bool]                = mapped_column(Boolean, default=False, nullable=False)

    enviado_por = relationship("User", foreign_keys=[enviado_por_id], lazy="selectin")
    lecturas    = relationship("LecturaComunicacion", back_populates="comunicacion", lazy="dynamic")


class LecturaComunicacion(Base):
    """Registro de quién leyó cada comunicación."""
    __tablename__ = "rrhh_lecturas_comunicacion"

    id:               Mapped[int]      = mapped_column(primary_key=True, autoincrement=True)
    comunicacion_id:  Mapped[int]      = mapped_column(ForeignKey("rrhh_comunicaciones.id"), nullable=False, index=True)
    empleado_id:      Mapped[int]      = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=False)
    leido_at:         Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    comunicacion = relationship("ComunicacionRRHH", back_populates="lecturas", lazy="selectin")
    empleado     = relationship("Empleado", lazy="selectin")


# ── Módulo Naaloo ─────────────────────────────────────────────────────────────

class DocumentoPublico(Base, TimestampMixin):
    """Documentos públicos visibles para todos los empleados (reglamentos, comunicados, etc.)."""
    __tablename__ = "rrhh_documentos_publicos"

    id:              Mapped[int]           = mapped_column(primary_key=True, autoincrement=True)
    company_id:      Mapped[int]           = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    nombre:          Mapped[str]           = mapped_column(String(300), nullable=False)
    descripcion:     Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    archivo_base64:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    archivo_nombre:  Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    archivo_mime:    Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    activo:          Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)
    creado_por_id:   Mapped[int]           = mapped_column(ForeignKey("users.id"), nullable=False)

    creado_por = relationship("User", foreign_keys=[creado_por_id], lazy="selectin")


class FeedPost(Base, TimestampMixin):
    """Post del feed social (automático o manual)."""
    __tablename__ = "rrhh_feed_posts"

    id:                        Mapped[int]           = mapped_column(primary_key=True, autoincrement=True)
    company_id:                Mapped[int]           = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    # tipo: CUMPLEANOS | ANIVERSARIO | PRIMER_DIA | MANUAL
    tipo:                      Mapped[str]           = mapped_column(String(50), nullable=False, default="MANUAL")
    titulo:                    Mapped[str]           = mapped_column(String(300), nullable=False)
    cuerpo:                    Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    imagen_url:                Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    empleado_protagonista_id:  Mapped[Optional[int]] = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=True)
    creado_por_id:             Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    empleado_protagonista = relationship("Empleado", foreign_keys=[empleado_protagonista_id], lazy="selectin")
    creado_por            = relationship("User",     foreign_keys=[creado_por_id],             lazy="selectin")
    reacciones            = relationship("FeedReaccion",  back_populates="post", lazy="selectin")
    comentarios           = relationship("FeedComentario", back_populates="post", lazy="selectin",
                                         order_by="FeedComentario.created_at")


class FeedReaccion(Base):
    """Reacción (like/emoji) a un post del feed."""
    __tablename__ = "rrhh_feed_reacciones"

    id:          Mapped[int]      = mapped_column(primary_key=True, autoincrement=True)
    post_id:     Mapped[int]      = mapped_column(ForeignKey("rrhh_feed_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    empleado_id: Mapped[int]      = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=False)
    emoji:       Mapped[str]      = mapped_column(String(10), nullable=False, default="❤️")
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post     = relationship("FeedPost",    back_populates="reacciones", lazy="selectin")
    empleado = relationship("Empleado",    lazy="selectin")


class FeedComentario(Base, TimestampMixin):
    """Comentario en un post del feed."""
    __tablename__ = "rrhh_feed_comentarios"

    id:          Mapped[int]      = mapped_column(primary_key=True, autoincrement=True)
    post_id:     Mapped[int]      = mapped_column(ForeignKey("rrhh_feed_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    empleado_id: Mapped[int]      = mapped_column(ForeignKey("rrhh_empleados.id"), nullable=False)
    texto:       Mapped[str]      = mapped_column(Text, nullable=False)

    post     = relationship("FeedPost",  back_populates="comentarios", lazy="selectin")
    empleado = relationship("Empleado",  lazy="selectin")
