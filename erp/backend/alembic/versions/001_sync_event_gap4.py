"""Add payload_antes, campos_modificados, version_catalogo to sync_events

Revision ID: 001_sync_event_gap4
Revises:
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = "001_sync_event_gap4"
down_revision = "4f0e08f7b365"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # These columns are added to the existing sync_events table.
    # All nullable or with a safe default so existing rows are unaffected.
    op.add_column(
        "sync_events",
        sa.Column("payload_antes", JSONB, nullable=True),
    )
    op.add_column(
        "sync_events",
        sa.Column("campos_modificados", JSONB, nullable=True),
    )
    op.add_column(
        "sync_events",
        sa.Column("version_catalogo", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("sync_events", "version_catalogo")
    op.drop_column("sync_events", "campos_modificados")
    op.drop_column("sync_events", "payload_antes")
