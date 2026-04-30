"""locals: empresa + ciudad

Agrega columnas para agrupar locales en el módulo Cajas:
- empresa: 'RM INDUMENTARIA' / 'RM NEUQUEN' (espejo del legacy LOCALES.EMPRESA)
- ciudad: 'BAHIA BLANCA' / 'NEUQUEN' / 'ROCA' / 'MAR DEL PLATA' / 'VILLA MARIA' / 'CABA' / 'CORDOBA'

La columna `code` ya existe — se reusa como código legacy (MONBAHIA, MTGBBPS, etc).

Revision ID: c1d2e3f4a5b6
Revises: a5b7c9d1e3f2
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4a5b6"
down_revision = "a5b7c9d1e3f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("locals", sa.Column("empresa", sa.String(50), nullable=True))
    op.add_column("locals", sa.Column("ciudad", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("locals", "ciudad")
    op.drop_column("locals", "empresa")
