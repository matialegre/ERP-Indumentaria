"""GAP-6: add related_sync_event_id and device_id to notifications;
   GAP-8: create sync_retry_queue table.

Revision ID: 002_gap6_gap8
Revises: 001_sync_event_gap4
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002_gap6_gap8"
down_revision = "001_sync_event_gap4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── GAP-6: Notification — nuevas columnas ─────────────────────────────
    # Check if columns already exist (created by create_all() at startup)
    cols = {row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='notifications'")
    )}

    if "related_sync_event_id" not in cols:
        op.add_column(
            "notifications",
            sa.Column(
                "related_sync_event_id",
                sa.String(36),
                sa.ForeignKey("sync_events.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_notification_sync_event", "notifications", ["related_sync_event_id"],
            unique=False,
        )

    if "device_id" not in cols:
        op.add_column(
            "notifications",
            sa.Column("device_id", sa.String(100), nullable=True),
        )
        op.create_index(
            "ix_notification_device_id", "notifications", ["device_id"],
            unique=False,
        )

    # ── GAP-8: SyncRetryQueue — nueva tabla ───────────────────────────────
    # Check if table already exists (created by create_all() at startup)
    tables = {row[0] for row in conn.execute(
        sa.text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
    )}

    if "sync_retry_queue" not in tables:
        # Create enum types with IF NOT EXISTS
        conn.execute(sa.text(
            "CREATE TYPE IF NOT EXISTS sync_retry_status_enum AS ENUM "
            "('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'FALLIDO')"
        ))
        conn.execute(sa.text(
            "CREATE TYPE IF NOT EXISTS sync_retry_error_type_enum AS ENUM "
            "('RED', 'SERVIDOR', 'CONFLICTO', 'VALIDACION', 'DESCONOCIDO')"
        ))
        op.create_table(
            "sync_retry_queue",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "event_id",
                sa.String(36),
                sa.ForeignKey("sync_events.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("device_id", sa.String(100), nullable=False),
            sa.Column("event_payload", JSONB(), nullable=False),
            sa.Column(
                "status",
                sa.Enum(
                    "PENDIENTE", "PROCESANDO", "COMPLETADO", "FALLIDO",
                    name="sync_retry_status_enum",
                    create_type=False,
                ),
                nullable=False,
                server_default="PENDIENTE",
            ),
            sa.Column(
                "error_type",
                sa.Enum(
                    "RED", "SERVIDOR", "CONFLICTO", "VALIDACION", "DESCONOCIDO",
                    name="sync_retry_error_type_enum",
                    create_type=False,
                ),
                nullable=False,
                server_default="DESCONOCIDO",
            ),
            sa.Column("intentos",      sa.Integer(), nullable=False, server_default="0"),
            sa.Column("max_intentos",  sa.Integer(), nullable=False, server_default="10"),
            sa.Column("ultimo_error",  sa.Text(),    nullable=True),
            sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"),
                nullable=False,
            ),
        )
        op.create_index("ix_retry_queue_status",     "sync_retry_queue", ["status"])
        op.create_index("ix_retry_queue_next_retry", "sync_retry_queue", ["next_retry_at"])
        op.create_index("ix_retry_queue_event",      "sync_retry_queue", ["event_id"])
        op.create_index("ix_retry_queue_company",    "sync_retry_queue", ["company_id"])
    else:
        # Table exists (created by create_all) — ensure indexes exist
        indexes = {row[0] for row in conn.execute(
            sa.text("SELECT indexname FROM pg_indexes WHERE tablename='sync_retry_queue'")
        )}
        for idx_name, col in [
            ("ix_retry_queue_status",     ["status"]),
            ("ix_retry_queue_next_retry", ["next_retry_at"]),
            ("ix_retry_queue_event",      ["event_id"]),
            ("ix_retry_queue_company",    ["company_id"]),
        ]:
            if idx_name not in indexes:
                op.create_index(idx_name, "sync_retry_queue", col)


def downgrade() -> None:
    # GAP-8 rollback
    op.drop_index("ix_retry_queue_company",    table_name="sync_retry_queue")
    op.drop_index("ix_retry_queue_event",      table_name="sync_retry_queue")
    op.drop_index("ix_retry_queue_next_retry", table_name="sync_retry_queue")
    op.drop_index("ix_retry_queue_status",     table_name="sync_retry_queue")
    op.drop_table("sync_retry_queue")
    op.execute("DROP TYPE IF EXISTS sync_retry_status_enum")
    op.execute("DROP TYPE IF EXISTS sync_retry_error_type_enum")

    # GAP-6 rollback
    op.drop_index("ix_notification_sync_event", table_name="notifications")
    op.drop_index("ix_notification_device_id",  table_name="notifications")
    op.drop_column("notifications", "device_id")
    op.drop_column("notifications", "related_sync_event_id")
