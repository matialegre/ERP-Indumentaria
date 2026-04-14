"""007_performance_indexes

Revision ID: c8f2a1b3d4e5
Revises: 379ca4b050c0
Create Date: 2026-04-07 00:00:00.000000

Agrega índices de performance para purchase_orders, purchase_invoices,
providers y payment_vouchers — todos ausentes del head actual (379ca4b050c0
los había borrado con el autogenerate de migración 005).
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c8f2a1b3d4e5'
down_revision: Union[str, None] = '379ca4b050c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # purchase_orders — filtros frecuentes en el list endpoint
    op.create_index("ix_po_company_status", "purchase_orders", ["company_id", "status"])
    op.create_index("ix_po_provider_company", "purchase_orders", ["provider_id", "company_id"])
    op.create_index("ix_po_local_company", "purchase_orders", ["local_id", "company_id"])
    op.create_index("ix_po_date", "purchase_orders", ["date"])

    # purchase_invoices
    op.create_index("ix_pi_order_id", "purchase_invoices", ["purchase_order_id"])
    op.create_index("ix_pi_company_status", "purchase_invoices", ["company_id", "status"])
    op.create_index("ix_pi_provider_company", "purchase_invoices", ["provider_id", "company_id"])

    # providers
    op.create_index("ix_prov_company_active", "providers", ["company_id", "is_active"])

    # payment_vouchers
    op.create_index("ix_pv_company_status", "payment_vouchers", ["company_id", "status"])
    op.create_index("ix_pv_provider", "payment_vouchers", ["provider_id"])


def downgrade() -> None:
    op.drop_index("ix_po_company_status", "purchase_orders")
    op.drop_index("ix_po_provider_company", "purchase_orders")
    op.drop_index("ix_po_local_company", "purchase_orders")
    op.drop_index("ix_po_date", "purchase_orders")
    op.drop_index("ix_pi_order_id", "purchase_invoices")
    op.drop_index("ix_pi_company_status", "purchase_invoices")
    op.drop_index("ix_pi_provider_company", "purchase_invoices")
    op.drop_index("ix_prov_company_active", "providers")
    op.drop_index("ix_pv_company_status", "payment_vouchers")
    op.drop_index("ix_pv_provider", "payment_vouchers")
