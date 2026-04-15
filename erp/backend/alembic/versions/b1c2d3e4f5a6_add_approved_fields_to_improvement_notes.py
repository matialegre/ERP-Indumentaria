"""add_approved_fields_to_improvement_notes

Revision ID: b1c2d3e4f5a6
Revises: 5803e6b459bd
Branch Labels: None
Depends On: None
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = ('5803e6b459bd', 'dc73d4b3cbb3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('improvement_notes', sa.Column('approved_by', sa.String(length=100), nullable=True))
    op.add_column('improvement_notes', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('improvement_notes', 'approved_at')
    op.drop_column('improvement_notes', 'approved_by')
