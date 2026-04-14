"""deposito_module

Revision ID: e72b38db536f
Revises: 4ec70ae716db
Create Date: 2026-04-13 12:10:31.066908
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = 'e72b38db536f'
down_revision: Union[str, None] = '4ec70ae716db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tablas deposito (stock_by_local, transferencias, transferencia_items,
    # conteos_inventario, conteo_items) ya fueron creadas via Base.metadata.create_all().
    # Esta migración solo registra el estado en el historial de Alembic.
    pass


def downgrade() -> None:
    pass
