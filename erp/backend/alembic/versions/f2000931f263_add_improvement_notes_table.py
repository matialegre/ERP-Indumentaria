"""add improvement_notes table

Revision ID: f2000931f263
Revises: 726700e8d4db
Create Date: 2026-04-07 14:56:45.422401
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'f2000931f263'
down_revision: Union[str, None] = '726700e8d4db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use IF NOT EXISTS so this is idempotent (create_all may have already run)
    connection = op.get_bind()
    connection.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS improvement_notes (
            id SERIAL PRIMARY KEY,
            page VARCHAR(100) NOT NULL,
            page_label VARCHAR(150),
            text TEXT NOT NULL,
            images JSON,
            priority VARCHAR(20) DEFAULT 'NORMAL',
            is_done BOOLEAN DEFAULT FALSE,
            author_id INTEGER REFERENCES users(id),
            author_name VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        )
    """))
    connection.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_improvement_notes_id ON improvement_notes(id)"
    ))
    connection.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_improvement_notes_page ON improvement_notes(page)"
    ))


def downgrade() -> None:
    op.drop_table('improvement_notes')
