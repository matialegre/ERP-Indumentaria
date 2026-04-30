"""add_brands_columns

Revision ID: 8312adc622fe
Revises: f1a2b3c4d5e6
Create Date: 2026-04-21 10:08:56.120543
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '8312adc622fe'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('providers', sa.Column('brands', sa.String(length=1000), nullable=True))
    op.add_column('purchase_orders', sa.Column('selected_brands', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('purchase_orders', 'selected_brands')
    op.drop_column('providers', 'brands')
