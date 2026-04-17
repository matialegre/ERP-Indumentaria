"""
Modelo User — usuarios del ERP con roles
"""

import enum
from sqlalchemy import String, Boolean, ForeignKey, Enum, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from app.db.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    MEGAADMIN = "MEGAADMIN"
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    COMPRAS = "COMPRAS"
    ADMINISTRACION = "ADMINISTRACION"
    GESTION_PAGOS = "GESTION_PAGOS"
    LOCAL = "LOCAL"
    VENDEDOR = "VENDEDOR"
    DEPOSITO = "DEPOSITO"
    SUPERVISOR = "SUPERVISOR"
    MONITOREO = "MONITOREO"
    TRANSPORTE = "TRANSPORTE"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=True),
        nullable=False,
        default=UserRole.VENDEDOR,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Multi-tenant: NULL para SUPERADMIN (accede a todo)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True
    )
    local_id: Mapped[int | None] = mapped_column(
        ForeignKey("locals.id"), nullable=True
    )

    # Relaciones
    company = relationship("Company", back_populates="users")
    local = relationship("Local", foreign_keys=[local_id])

    # Restricción de módulos por usuario (None = sin restricción, usa los de la empresa)
    # Cuando está seteado, el usuario solo ve los módulos en esta lista
    modules_override: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)

    # Módulos donde el usuario tiene acceso de solo lectura (puede ver pero no modificar)
    # None = sin restricción (puede editar todo lo que puede ver)
    modules_readonly: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)

    # Configuración personalizada del dashboard (lista de widget IDs + posición)
    dashboard_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=None)
