"""variant_id nullable en purchase_order_items

El parser de Excel produce ítems con code/descripcion/cantidad pero sin
variant_id (los códigos del proveedor no siempre tienen un ProductVariant
matcheado al momento de crear la nota). La resolución de variant_id pasa
a ser opcional — se puede completar después al vincular factura o al
confirmar recepción.

También mergea los dos heads previos (add_pendiente_001 + c4df4b415dd4).

Revision ID: a5b7c9d1e3f2
Revises: c4df4b415dd4, add_pendiente_001
Create Date: 2026-04-24

"""
from alembic import op
import sqlalchemy as sa


revision = "a5b7c9d1e3f2"
down_revision = ("c4df4b415dd4", "add_pendiente_001")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "purchase_order_items",
        "variant_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "purchase_order_items",
        "variant_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
