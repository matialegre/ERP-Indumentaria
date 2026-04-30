"""caja_movimientos: agregar columna numero

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa


revision = "f4a5b6c7d8e9"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("caja_movimientos", sa.Column("numero", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("caja_movimientos", "numero")
