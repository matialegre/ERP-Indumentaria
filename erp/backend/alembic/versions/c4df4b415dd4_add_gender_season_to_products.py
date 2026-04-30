"""add_gender_season_to_products

Revision ID: c4df4b415dd4
Revises: 8312adc622fe
Create Date: 2026-04-21 13:22:06.062220
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4df4b415dd4'
down_revision: Union[str, None] = '8312adc622fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('gender', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('season', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'season')
    op.drop_column('products', 'gender')
