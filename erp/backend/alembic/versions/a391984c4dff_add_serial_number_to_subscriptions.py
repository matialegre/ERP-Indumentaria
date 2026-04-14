"""add_serial_number_to_subscriptions

Revision ID: a391984c4dff
Revises: 0f40793fd33d
Create Date: 2026-04-14 10:38:14.744108
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = 'a391984c4dff'
down_revision: Union[str, None] = '0f40793fd33d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add serial_number to company_subscriptions
    # Use server_default temporarily to handle existing rows
    op.add_column('company_subscriptions', sa.Column(
        'serial_number', sa.String(length=64), nullable=True
    ))

    # Generate serials for existing rows via SQL
    op.execute("""
        UPDATE company_subscriptions
        SET serial_number = CONCAT(
            'MO-',
            UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4)),
            '-',
            UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4)),
            '-',
            UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4))
        )
        WHERE serial_number IS NULL
    """)

    # Now enforce NOT NULL and unique
    op.alter_column('company_subscriptions', 'serial_number', nullable=False)
    op.create_unique_constraint('uq_subscription_serial', 'company_subscriptions', ['serial_number'])


def downgrade() -> None:
    op.drop_constraint('uq_subscription_serial', 'company_subscriptions', type_='unique')
    op.drop_column('company_subscriptions', 'serial_number')
