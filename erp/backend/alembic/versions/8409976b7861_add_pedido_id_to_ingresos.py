"""add pedido_id to ingresos

Revision ID: 8409976b7861
Revises: a3f9e1d7c2b4
Create Date: 2026-03-27 16:58:06.606988
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '8409976b7861'
down_revision: Union[str, None] = 'a3f9e1d7c2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ingresos', sa.Column('pedido_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_ingresos_pedido_id', 'ingresos', 'pedidos', ['pedido_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_ingresos_pedido_id', 'ingresos', type_='foreignkey')
    op.drop_column('ingresos', 'pedido_id')
    op.create_index('ix_products_company_category', 'products', ['company_id', 'category'], unique=False)
    op.create_index('ix_products_company_brand', 'products', ['company_id', 'brand'], unique=False)
    op.create_index('ix_products_category', 'products', ['category'], unique=False)
    op.create_index('ix_products_brand', 'products', ['brand'], unique=False)
    op.create_index('ix_product_variants_stock', 'product_variants', ['stock'], unique=False)
    op.create_index('ix_product_variants_product_id', 'product_variants', ['product_id'], unique=False)
    op.create_index('ix_product_variants_is_active', 'product_variants', ['is_active'], unique=False)
    op.create_index('ix_product_variants_barcode', 'product_variants', ['barcode'], unique=False)
    op.create_index('ix_pedidos_status', 'pedidos', ['status'], unique=False)
    op.create_index('ix_pedidos_provider_id', 'pedidos', ['provider_id'], unique=False)
    op.create_index('ix_pedidos_date', 'pedidos', ['date'], unique=False)
    op.create_index('ix_pedidos_company_status', 'pedidos', ['company_id', 'status'], unique=False)
    op.create_index('ix_pedidos_company_id', 'pedidos', ['company_id'], unique=False)
    op.alter_column('pedidos', 'expected_date',
               existing_type=sa.DATE(),
               nullable=True)
    op.create_index('ix_pedido_items_variant_id', 'pedido_items', ['variant_id'], unique=False)
    op.create_index('ix_pedido_items_pedido_id', 'pedido_items', ['pedido_id'], unique=False)
    op.create_index('ix_locals_is_active', 'locals', ['is_active'], unique=False)
    op.create_index('ix_locals_company_id', 'locals', ['company_id'], unique=False)
    op.drop_constraint(None, 'ingresos', type_='foreignkey')
    op.create_index('ix_ingresos_status', 'ingresos', ['status'], unique=False)
    op.create_index('ix_ingresos_provider_id', 'ingresos', ['provider_id'], unique=False)
    op.create_index('ix_ingresos_date', 'ingresos', ['date'], unique=False)
    op.create_index('ix_ingresos_created_by_id', 'ingresos', ['created_by_id'], unique=False)
    op.create_index('ix_ingresos_company_status', 'ingresos', ['company_id', 'status'], unique=False)
    op.create_index('ix_ingresos_company_id', 'ingresos', ['company_id'], unique=False)
    op.create_index('ix_ingresos_company_date', 'ingresos', ['company_id', 'date'], unique=False)
    op.drop_column('ingresos', 'pedido_id')
    op.create_index('ix_ingreso_items_variant_id', 'ingreso_items', ['variant_id'], unique=False)
    op.create_index('ix_ingreso_items_ingreso_id', 'ingreso_items', ['ingreso_id'], unique=False)
    # ### end Alembic commands ###
