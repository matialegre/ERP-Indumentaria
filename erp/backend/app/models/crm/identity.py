"""CRM Identities — Multi-channel identities per customer."""

from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CrmIdentity(Base, TimestampMixin):
    __tablename__ = "crm_identities"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "provider", "handle",
            name="uq_crm_identity_provider_handle",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True,
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id"), nullable=False, index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    handle: Mapped[str] = mapped_column(String(200), nullable=False)
