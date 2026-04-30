"""locals: clink_cod_local (mapping a Clinkbox API)

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa


revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("locals", sa.Column("clink_cod_local", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("locals", "clink_cod_local")
