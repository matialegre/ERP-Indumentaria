"""add icon_data to companies

Revision ID: 4f0e08f7b365
Revises: 9e90ee6bd204
Create Date: 2026-04-10 17:11:43.663677
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '4f0e08f7b365'
down_revision: Union[str, None] = '9e90ee6bd204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('icon_data', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'icon_data')
