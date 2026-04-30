"""crear tablas cajas + caja_movimientos + seed 6 ciudades

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa


revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cajas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("ciudad", sa.String(50), nullable=False, unique=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("saldo_inicial", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_cajas_ciudad", "cajas", ["ciudad"])

    op.create_table(
        "caja_movimientos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("caja_id", sa.Integer, sa.ForeignKey("cajas.id"), nullable=False),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("local_id", sa.Integer, sa.ForeignKey("locals.id"), nullable=True),
        sa.Column("monto", sa.Numeric(14, 2), nullable=False),
        sa.Column("motivo", sa.Text, nullable=True),
        sa.Column("comprobante_url", sa.String(500), nullable=True),
        sa.Column("estado", sa.String(15), nullable=False, server_default="PENDIENTE"),
        sa.Column("aceptado_por_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("aceptado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transfer_id", sa.String(36), nullable=True),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_caja_mov_caja", "caja_movimientos", ["caja_id"])
    op.create_index("ix_caja_mov_tipo", "caja_movimientos", ["tipo"])
    op.create_index("ix_caja_mov_estado", "caja_movimientos", ["estado"])
    op.create_index("ix_caja_mov_transfer", "caja_movimientos", ["transfer_id"])

    # Seed: 6 cajas, una por ciudad (Cordoba queda fuera por pedido del usuario)
    op.execute("""
        INSERT INTO cajas (ciudad, nombre, saldo_inicial, company_id)
        SELECT 'BAHIA BLANCA', 'Caja Bahía Blanca', 0, (SELECT id FROM companies ORDER BY id LIMIT 1)
        UNION ALL SELECT 'NEUQUEN', 'Caja Neuquén', 0, (SELECT id FROM companies ORDER BY id LIMIT 1)
        UNION ALL SELECT 'ROCA', 'Caja General Roca', 0, (SELECT id FROM companies ORDER BY id LIMIT 1)
        UNION ALL SELECT 'MAR DEL PLATA', 'Caja Mar del Plata', 0, (SELECT id FROM companies ORDER BY id LIMIT 1)
        UNION ALL SELECT 'VILLA MARIA', 'Caja Villa María', 0, (SELECT id FROM companies ORDER BY id LIMIT 1)
        UNION ALL SELECT 'CABA', 'Caja CABA / Palermo', 0, (SELECT id FROM companies ORDER BY id LIMIT 1)
    """)


def downgrade() -> None:
    op.drop_index("ix_caja_mov_transfer", table_name="caja_movimientos")
    op.drop_index("ix_caja_mov_estado", table_name="caja_movimientos")
    op.drop_index("ix_caja_mov_tipo", table_name="caja_movimientos")
    op.drop_index("ix_caja_mov_caja", table_name="caja_movimientos")
    op.drop_table("caja_movimientos")
    op.drop_index("ix_cajas_ciudad", table_name="cajas")
    op.drop_table("cajas")
