from sqlalchemy import Column, Integer, String, Text, Date, Numeric, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ServiceExpiration(Base):
    __tablename__ = "service_expirations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=True)
    images = Column(JSON, default=list)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company", foreign_keys=[company_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
