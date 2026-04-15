"""
Modelo para eventos de webhook de MercadoLibre.
Persiste cada notificación recibida para procesamiento asíncrono.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from app.db.base import Base


class MeliWebhookEvent(Base):
    __tablename__ = "meli_webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    topic = Column(String(100), nullable=True, index=True)
    resource = Column(String(500), nullable=True)
    resource_id = Column(String(100), nullable=True)
    user_id = Column(String(50), nullable=True)
    application_id = Column(String(50), nullable=True)
    payload_raw = Column(JSON, nullable=True)
    status = Column(String(20), default="pending", index=True)  # pending | processed | failed
    attempts = Column(Integer, default=0)
    processed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
