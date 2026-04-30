"""
RFID Models — gestión completa de etiquetas, lectores, escaneos e inventario RFID.
Propuesta: 30 tiendas + 1 CD, 500K etiquetas anuales, payback 9 meses.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from enum import Enum
import uuid


class RFIDTagStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DAMAGED = "DAMAGED"
    LOST = "LOST"
    ARCHIVED = "ARCHIVED"


class RFIDReaderType(str, Enum):
    HANDHELD = "HANDHELD"  # Portátil de mano
    FIXED_GATE = "FIXED_GATE"  # Portal antihurto entrada/salida
    FIXED_CD = "FIXED_CD"  # Túnel CD recepción automática
    COUNTER = "COUNTER"  # Punto de venta


class RFIDScanType(str, Enum):
    INVENTORY = "INVENTORY"  # Inventario general
    RECEIVING = "RECEIVING"  # Recepción CD
    ANTI_THEFT = "ANTI_THEFT"  # Portales salida
    POS = "POS"  # Punto de venta
    TRANSFER = "TRANSFER"  # Transferencia entre locales


class RFIDAlertType(str, Enum):
    DISCREPANCY = "DISCREPANCY"  # Stock en sistema ≠ físico
    THEFT_ATTEMPT = "THEFT_ATTEMPT"  # Intento de extracción sin pagar
    TAG_DAMAGE = "TAG_DAMAGE"  # Etiqueta dañada
    READER_ERROR = "READER_ERROR"  # Error de lectura
    UNUSUAL_MOVEMENT = "UNUSUAL_MOVEMENT"  # Movimiento anormal


class RFIDTag(Base):
    """
    Etiqueta RFID física — una por prenda por temporada.
    Costo: USD 0.07 por unidad a volumen (200K+).
    """
    __tablename__ = "rfid_tags"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Código único de la etiqueta (EPC — Electronic Product Code)
    epc = Column(String(24), unique=True, nullable=False, index=True)  # Ej: "30147B2D12345678ABCD"
    
    # Producto asociado (opcional — una etiqueta puede no tener producto si es defectuosa)
    product_variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    
    # Local / CD actual (dónde está físicamente)
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=True)
    
    # Estado de la etiqueta
    status = Column(SQLEnum(RFIDTagStatus), default=RFIDTagStatus.ACTIVE, nullable=False, index=True)
    
    # Ubicación dentro del local (sala, probador, depósito, etc.)
    location = Column(String(100), nullable=True)  # Ej: "SALA", "PROBADOR", "DEPOSITO"
    
    # Contador de escaneos (para detectar lecturas problemáticas)
    scan_count = Column(Integer, default=0)
    
    # Última lectura exitosa
    last_scan_at = Column(DateTime, nullable=True)
    
    # Fechas
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    variant = relationship("ProductVariant", lazy="selectin")
    local = relationship("Local", lazy="selectin")
    scans = relationship("RFIDScan", back_populates="tag", cascade="all, delete-orphan")


class RFIDReader(Base):
    """
    Dispositivo lector RFID — handheld, portales, túnel CD, etc.
    Inversión inicial: ~USD 258K para 30 tiendas + CD.
    """
    __tablename__ = "rfid_readers"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Identificador único del dispositivo
    device_id = Column(String(50), unique=True, nullable=False, index=True)  # MAC, serial, UUID
    
    # Tipo de lector
    reader_type = Column(SQLEnum(RFIDReaderType), nullable=False, index=True)
    
    # Local donde está instalado (NULL = móvil sin local fijo)
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=True)
    
    # Nombre descriptivo
    name = Column(String(100), nullable=False)  # Ej: "Handheld #1 — Tienda Neuquén"
    
    # Modelo / fabricante
    model = Column(String(100), nullable=True)  # Ej: "Zebra FX9600"
    
    # Rango de lectura en metros
    read_range_meters = Column(Float, default=10.0, nullable=False)
    
    # Último conectado
    last_online_at = Column(DateTime, nullable=True)
    is_online = Column(Boolean, default=False)
    
    # Firmware version
    firmware_version = Column(String(50), nullable=True)
    
    # Datos agregados (cache para rápido acceso)
    total_scans = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    local = relationship("Local", lazy="selectin")
    scans = relationship("RFIDScan", back_populates="reader", cascade="all, delete-orphan")


class RFIDScan(Base):
    """
    Escaneo individual de una etiqueta por un lector.
    Alta frecuencia: 1.000 etiquetas/segundo.
    """
    __tablename__ = "rfid_scans"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Tag y reader
    tag_id = Column(Integer, ForeignKey("rfid_tags.id"), nullable=False, index=True)
    reader_id = Column(Integer, ForeignKey("rfid_readers.id"), nullable=False, index=True)
    
    # Tipo de scan (inventario, recepción, antihurto, POS, etc.)
    scan_type = Column(SQLEnum(RFIDScanType), nullable=False, index=True)
    
    # Sesión de lectura (agrupa múltiples scans del mismo evento)
    session_id = Column(String(36), ForeignKey("rfid_scan_sessions.id"), nullable=True, index=True)
    
    # Local donde sucedió el scan
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=True)
    
    # Ubicación dentro del local (si es disponible)
    location = Column(String(100), nullable=True)
    
    # Señal RSSI (Received Signal Strength Indicator) — calidad de lectura
    rssi = Column(Integer, nullable=True)  # Rango típico: -90 a -40 dBm
    
    # OK o error
    is_valid = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Usuario que inició el scan (opcional)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relaciones
    tag = relationship("RFIDTag", back_populates="scans", lazy="selectin")
    reader = relationship("RFIDReader", back_populates="scans", lazy="selectin")
    session = relationship("RFIDScanSession", back_populates="scans", lazy="selectin")
    local = relationship("Local", lazy="selectin")
    user = relationship("User", lazy="selectin")


class RFIDScanSession(Base):
    """
    Sesión de escaneo — agrupa múltiples scans (ej: inventario completo de una tienda).
    """
    __tablename__ = "rfid_scan_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Local donde se realizó
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=False, index=True)
    
    # Lector que inició la sesión
    reader_id = Column(Integer, ForeignKey("rfid_readers.id"), nullable=True)
    
    # Tipo de sesión
    scan_type = Column(SQLEnum(RFIDScanType), nullable=False, index=True)
    
    # Descripción (ej: "Inventario semanal tienda Neuquén")
    description = Column(String(255), nullable=True)
    
    # Usuario responsable
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Resultados agregados
    total_tags_read = Column(Integer, default=0)
    unique_tags = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    
    # Status
    is_completed = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relaciones
    local = relationship("Local", lazy="selectin")
    reader = relationship("RFIDReader", lazy="selectin")
    user = relationship("User", lazy="selectin")
    scans = relationship("RFIDScan", back_populates="session", cascade="all, delete-orphan")


class RFIDAlert(Base):
    """
    Alertas generadas por anomalías detectadas en el sistema RFID.
    Ej: discrepancias stock, intentos de robo, etiquetas dañadas.
    """
    __tablename__ = "rfid_alerts"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Tipo de alerta
    alert_type = Column(SQLEnum(RFIDAlertType), nullable=False, index=True)
    
    # Referencia a datos relacionados
    tag_id = Column(Integer, ForeignKey("rfid_tags.id"), nullable=True)
    reader_id = Column(Integer, ForeignKey("rfid_readers.id"), nullable=True)
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=True)
    scan_id = Column(Integer, ForeignKey("rfid_scans.id"), nullable=True)
    
    # Descripción de la alerta
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Severidad: INFO, WARNING, CRITICAL
    severity = Column(String(20), default="WARNING", nullable=False)  # INFO | WARNING | CRITICAL
    
    # Status de la alerta
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relaciones
    tag = relationship("RFIDTag", lazy="selectin")
    reader = relationship("RFIDReader", lazy="selectin")
    local = relationship("Local", lazy="selectin")
    scan = relationship("RFIDScan", lazy="selectin")


class RFIDInventorySnapshot(Base):
    """
    Snapshot de inventario RFID en un momento dado — para comparar vs ERP.
    Genera reportes de discrepancias y propuestas de ajuste.
    """
    __tablename__ = "rfid_inventory_snapshots"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Local
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=False, index=True)
    
    # Sesión de scan que originó
    session_id = Column(String(36), ForeignKey("rfid_scan_sessions.id"), nullable=True)
    
    # JSON con estructura: {variant_id: {physical_count, system_count, discrepancy, location}}
    data = Column(Text, nullable=False)  # JSON serializado
    
    # Totales
    total_variants = Column(Integer, default=0)
    total_physical = Column(Integer, default=0)
    total_system = Column(Integer, default=0)
    total_discrepancies = Column(Integer, default=0)
    
    # Precisión de inventario (%)
    accuracy_percentage = Column(Float, default=0.0)
    
    # Status
    is_reconciled = Column(Boolean, default=False)
    reconciled_at = Column(DateTime, nullable=True)
    reconciled_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    local = relationship("Local", lazy="selectin")
    session = relationship("RFIDScanSession", lazy="selectin")


class RFIDMetrics(Base):
    """
    Métricas agregadas diarias — para dashboards de rendimiento.
    KPIs: precisión, velocidad inventario, merma, etc.
    """
    __tablename__ = "rfid_metrics"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    
    # Período
    date = Column(DateTime, nullable=False, index=True)  # Medianoche UTC
    
    # Por local (NULL = consolidado empresa)
    local_id = Column(Integer, ForeignKey("locals.id"), nullable=True)
    
    # KPIs de precisión
    inventory_accuracy_percentage = Column(Float, default=0.0)  # % coincidencia stock RFID vs ERP
    
    # KPIs de eficiencia
    avg_inventory_time_minutes = Column(Float, default=0.0)
    tags_scanned_total = Column(Integer, default=0)
    scans_per_second = Column(Float, default=0.0)
    
    # KPIs de pérdida
    estimated_shrinkage_percentage = Column(Float, default=0.0)  # % de merma detectada
    lost_tags_count = Column(Integer, default=0)
    damaged_tags_count = Column(Integer, default=0)
    
    # KPIs de operación
    readers_online_count = Column(Integer, default=0)
    reader_errors_count = Column(Integer, default=0)
    alerts_generated = Column(Integer, default=0)
    
    # ROI calculado
    estimated_savings_usd = Column(Float, default=0.0)  # Beneficio acumulado del día
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    local = relationship("Local", lazy="selectin")


class RFIDContenido(Base):
    """
    Repositorio de archivos del modulo RFID: imagenes, videos, PDFs, presentaciones.
    Los archivos se guardan localmente en D:/ERP MUNDO OUTDOOR/erp/rfid_contenido/.
    """
    __tablename__ = "rfid_contenido"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, nullable=True, index=True)  # nullable: MEGAADMIN sin company

    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String(20), nullable=False)  # image | video | pdf | other
    path_archivo = Column(String(500), nullable=False)
    nombre_original = Column(String(255), nullable=False)
    size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    uploader = relationship("User", lazy="selectin")
