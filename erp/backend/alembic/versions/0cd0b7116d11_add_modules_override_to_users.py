"""add_modules_override_to_users

Revision ID: 0cd0b7116d11
Revises: 94a448aece46
Create Date: 2026-04-13 11:25:45.701826
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '0cd0b7116d11'
down_revision: Union[str, None] = '94a448aece46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('modules_override', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'modules_override')
