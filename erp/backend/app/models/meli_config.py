"""
Modelo de configuración de MercadoLibre por empresa.
Almacena tokens OAuth (multi-cuenta), credenciales Dragonfish,
clusters de depósitos y configuración general del módulo ML.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from app.db.base import Base


class MeliConfig(Base):
    __tablename__ = "meli_config"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, nullable=False, unique=True, index=True)

    # ── Cuenta ML 1 (principal) ──────────────────────────────────────────
    ml1_client_id = Column(String(100), nullable=True)
    ml1_client_secret = Column(String(200), nullable=True)
    ml1_access_token = Column(Text, nullable=True)
    ml1_refresh_token = Column(Text, nullable=True)
    ml1_user_id = Column(String(50), nullable=True)
    ml1_expires_at = Column(DateTime, nullable=True)

    # ── Cuenta ML 2 (secundaria) ─────────────────────────────────────────
    ml2_client_id = Column(String(100), nullable=True)
    ml2_client_secret = Column(String(200), nullable=True)
    ml2_access_token = Column(Text, nullable=True)
    ml2_refresh_token = Column(Text, nullable=True)
    ml2_user_id = Column(String(50), nullable=True)
    ml2_expires_at = Column(DateTime, nullable=True)

    # ── Dragonfish API ───────────────────────────────────────────────────
    dragon_api_bases = Column(Text, nullable=True, default="http://deposito_2:8009/api.Dragonfish/ConsultaStockYPreciosEntreLocales")
    dragon_api_key = Column(Text, nullable=True)
    dragon_id_cliente = Column(String(100), nullable=True, default="PRUEBA-WEB")
    dragon_mov_url = Column(String(500), nullable=True, default="http://190.211.201.217:8009/api.Dragonfish/Movimientodestock/")
    dragon_base_datos = Column(String(50), nullable=True, default="MELI")

    # ── Clusters de depósitos (JSON) ─────────────────────────────────────
    clusters = Column(JSON, nullable=True, default=lambda: {
        "A": ["DEPO", "DEP", "MUNDOAL", "MTGBBL", "MONBAHIA", "MTGBBPS"],
        "B": ["MUNDOROC", "MTGROCA"],
    })
    lejanos = Column(JSON, nullable=True, default=lambda: ["MTGCOM", "NQNSHOP", "NQNALB", "MUNDOCAB"])

    # ── Config impresora ─────────────────────────────────────────────────
    printer_zebra_name = Column(String(200), nullable=True)
    printer_list_name = Column(String(200), nullable=True)

    # ── General ──────────────────────────────────────────────────────────
    webhook_secret = Column(String(200), nullable=True)
    auto_assign_enabled = Column(Boolean, default=False)
    auto_notes_enabled = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
