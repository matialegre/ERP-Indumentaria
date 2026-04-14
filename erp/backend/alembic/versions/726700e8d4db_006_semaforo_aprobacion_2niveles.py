"""006_semaforo_aprobacion_2niveles

Revision ID: 726700e8d4db
Revises: c8f2a1b3d4e5
Create Date: 2026-04-06 19:06:40.999654
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '726700e8d4db'
down_revision: Union[str, None] = 'c8f2a1b3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the semaforo_estado enum type
    op.execute("CREATE TYPE semaforo_estado AS ENUM ('ROJO', 'AMARILLO', 'VERDE')")

    # Add new columns to purchase_invoices
    op.add_column('purchase_invoices', sa.Column(
        'estado_semaforo',
        sa.Enum('ROJO', 'AMARILLO', 'VERDE', name='semaforo_estado', create_constraint=True),
        nullable=False,
        server_default='ROJO',
    ))
    op.add_column('purchase_invoices', sa.Column('confirmado_local_at', sa.DateTime(), nullable=True))
    op.add_column('purchase_invoices', sa.Column('confirmado_admin_at', sa.DateTime(), nullable=True))
    op.add_column('purchase_invoices', sa.Column('confirmado_local_by_id', sa.Integer(), nullable=True))
    op.add_column('purchase_invoices', sa.Column('confirmado_admin_by_id', sa.Integer(), nullable=True))

    # Foreign keys for approval columns
    op.create_foreign_key(
        'fk_pi_confirmado_local_by', 'purchase_invoices', 'users',
        ['confirmado_local_by_id'], ['id'],
    )
    op.create_foreign_key(
        'fk_pi_confirmado_admin_by', 'purchase_invoices', 'users',
        ['confirmado_admin_by_id'], ['id'],
    )

    # Remove server_default after backfill (keep column non-null with model default)
    op.alter_column('purchase_invoices', 'estado_semaforo', server_default=None)


def downgrade() -> None:
    op.drop_constraint('fk_pi_confirmado_admin_by', 'purchase_invoices', type_='foreignkey')
    op.drop_constraint('fk_pi_confirmado_local_by', 'purchase_invoices', type_='foreignkey')
    op.drop_column('purchase_invoices', 'confirmado_admin_by_id')
    op.drop_column('purchase_invoices', 'confirmado_local_by_id')
    op.drop_column('purchase_invoices', 'confirmado_admin_at')
    op.drop_column('purchase_invoices', 'confirmado_local_at')
    op.drop_column('purchase_invoices', 'estado_semaforo')
    op.execute("DROP TYPE semaforo_estado")
