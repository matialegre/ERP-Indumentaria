"""Add PENDIENTE to purchase_order_status enum and migrate ENVIADO rows

Revision ID: add_pendiente_001
Revises: None (standalone)
"""
from alembic import op

revision = 'add_pendiente_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add PENDIENTE to the PostgreSQL enum type
    op.execute("ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'PENDIENTE'")
    # Migrate existing ENVIADO rows to PENDIENTE
    op.execute("UPDATE purchase_orders SET status = 'PENDIENTE' WHERE status = 'ENVIADO'")


def downgrade():
    # Revert PENDIENTE back to ENVIADO
    op.execute("UPDATE purchase_orders SET status = 'ENVIADO' WHERE status = 'PENDIENTE'")
