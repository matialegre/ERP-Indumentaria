from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ImprovementNote(Base):
    __tablename__ = "improvement_notes"

    id = Column(Integer, primary_key=True, index=True)
    page = Column(String(100), nullable=False, index=True)
    page_label = Column(String(150))
    text = Column(Text, nullable=False)
    images = Column(JSON, default=list)
    priority = Column(String(20), default="NORMAL")  # LOW / NORMAL / HIGH / CRITICA
    is_done = Column(Boolean, default=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Chat de mejoras — respuesta del bot ───────────────────────────────
    ai_reply = Column(Text, nullable=True)
    ai_reply_at = Column(DateTime(timezone=True), nullable=True)

    # ── Nota del administrador (crítica / feedback al empleado) ───────────
    admin_note = Column(Text, nullable=True)
    admin_note_by = Column(String(100), nullable=True)   # nombre del admin
    admin_note_at = Column(DateTime(timezone=True), nullable=True)

    # ── Aprobación ───────────────────────────────────────────────────────────
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    author = relationship("User", foreign_keys=[author_id])
