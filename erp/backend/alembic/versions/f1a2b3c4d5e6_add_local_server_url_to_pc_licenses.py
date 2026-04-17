"""add_local_server_url_to_pc_licenses

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-04-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'pc_licenses',
        sa.Column('local_server_url', sa.String(200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('pc_licenses', 'local_server_url')
