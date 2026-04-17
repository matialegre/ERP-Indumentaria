"""add_build_deployed_at_to_improvement_notes

Revision ID: d1e2f3a4b5c6
Revises: a1b2c3d4e5f6, da585e492fa8
Create Date: 2026-04-16 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'da585e492fa8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'improvement_notes',
        sa.Column('build_deployed_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('improvement_notes', 'build_deployed_at')
