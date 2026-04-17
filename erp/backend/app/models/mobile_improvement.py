from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class MobileImprovement(Base):
    __tablename__ = "mobile_improvements"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    platform    = Column(String(20), default="both")   # android / ios / both
    status      = Column(String(30), default="pendiente")  # pendiente / en_desarrollo / publicada / descartada
    priority    = Column(String(20), default="NORMAL")     # LOW / NORMAL / HIGH / CRITICA
    category    = Column(String(50), nullable=True)        # ux / funcionalidad / rendimiento / diseño / otro
    author_name = Column(String(100), nullable=True)
    author_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    company_id  = Column(Integer, ForeignKey("companies.id"), nullable=True)
    votes       = Column(Integer, default=0)
    admin_reply = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
