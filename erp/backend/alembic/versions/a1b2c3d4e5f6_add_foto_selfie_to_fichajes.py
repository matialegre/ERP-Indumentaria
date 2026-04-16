"""add foto_selfie to rrhh_fichajes

Revision ID: a1b2c3d4e5f6
Revises: c8f2a1b3d4e5
Branch Labels: None
Depends On: None

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c8f2a1b3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("rrhh_fichajes")]
    if "foto_selfie" not in cols:
        op.add_column("rrhh_fichajes", sa.Column("foto_selfie", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("rrhh_fichajes", "foto_selfie")
