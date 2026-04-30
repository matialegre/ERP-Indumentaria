"""
Modelo Provider — proveedores
"""

from sqlalchemy import String, Boolean, ForeignKey, Text, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Provider(Base, TimestampMixin):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cuit: Mapped[str | None] = mapped_column(String(13))
    contact_name: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    # Datos Tango / Fiscales
    legal_name: Mapped[str | None] = mapped_column(String(300))  # Razón social
    tax_id_type: Mapped[str | None] = mapped_column(String(20))  # Tipo documento
    tax_condition: Mapped[str | None] = mapped_column(String(50))  # Condición IVA
    gross_income: Mapped[str | None] = mapped_column(String(50))  # Ingresos brutos
    domicilio: Mapped[str | None] = mapped_column(String(500))
    cp: Mapped[str | None] = mapped_column(String(10))
    localidad: Mapped[str | None] = mapped_column(String(100))
    provincia: Mapped[str | None] = mapped_column(String(100))
    pais: Mapped[str | None] = mapped_column(String(50), default="Argentina")

    # Contacto
    vendor_name: Mapped[str | None] = mapped_column(String(200))  # Nombre vendedor
    fax: Mapped[str | None] = mapped_column(String(50))

    # Retenciones
    ret_iva_pct: Mapped[float | None] = mapped_column(Numeric(6, 4))
    ret_iibb_pct: Mapped[float | None] = mapped_column(Numeric(6, 4))
    ret_ganancias_pct: Mapped[float | None] = mapped_column(Numeric(6, 4))
    ret_suss_pct: Mapped[float | None] = mapped_column(Numeric(6, 4))

    # Configuración de alertas
    days_alert_sin_rv: Mapped[int | None] = mapped_column(Integer)  # Días sin RV antes de alerta

    # Logo
    logo_filename: Mapped[str | None] = mapped_column(String(500))

    # Tango code
    tango_code: Mapped[str | None] = mapped_column(String(50))  # Código en sistema Tango
    order_prefix: Mapped[str | None] = mapped_column(String(20))  # Prefijo para numeración

    # Marcas comerciales que maneja este proveedor (separadas por coma, ej: "Nike,Adidas,Puma")
    brands: Mapped[str | None] = mapped_column(String(1000))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Multi-tenant
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False
    )

    # Relaciones
    company = relationship("Company", back_populates="providers")
    contacts = relationship("ProviderContact", back_populates="provider", lazy="selectin")
