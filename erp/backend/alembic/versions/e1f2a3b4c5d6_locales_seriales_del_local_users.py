"""locales_seriales_del_local_users

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-04-16

- Agrega local_id FK a pc_licenses
- Migra las 11 PC Licenses existentes al local SAN MARTIN (id=37)
- Elimina los 15 usuarios con role=LOCAL
"""

from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None

SAN_MARTIN_LOCAL_ID = 37


def upgrade():
    # 1. Agregar local_id a pc_licenses (nullable)
    op.add_column(
        'pc_licenses',
        sa.Column('local_id', sa.Integer(), sa.ForeignKey('locals.id'), nullable=True)
    )

    # 2. Crear índice para búsqueda por local
    op.create_index('ix_pc_licenses_local_id', 'pc_licenses', ['local_id'])

    # 3. Migrar todas las PC Licenses existentes al local SAN MARTIN
    op.execute(
        f"UPDATE pc_licenses SET local_id = {SAN_MARTIN_LOCAL_ID} WHERE local_id IS NULL"
    )

    # 4. Eliminar los 15 usuarios con role='LOCAL'
    op.execute("DELETE FROM users WHERE role = 'LOCAL'")


def downgrade():
    # Revertir: quitar local_id de pc_licenses (no se pueden restaurar usuarios)
    op.drop_index('ix_pc_licenses_local_id', table_name='pc_licenses')
    op.drop_column('pc_licenses', 'local_id')
