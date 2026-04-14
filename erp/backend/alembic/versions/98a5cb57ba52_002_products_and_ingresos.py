"""002_products_and_ingresos

Revision ID: 98a5cb57ba52
Revises: 1539ccd2cdde
Create Date: 2026-03-26 16:57:41.019113
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '98a5cb57ba52'
down_revision: Union[str, None] = '1539ccd2cdde'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = inspector.get_table_names()

    if 'products' not in existing:
        op.create_table(
            'products',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('code', sa.String(length=50), nullable=False),
            sa.Column('name', sa.String(length=300), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('brand', sa.String(length=100), nullable=True),
            sa.Column('category', sa.String(length=100), nullable=True),
            sa.Column('base_cost', sa.Numeric(12, 2), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('code', 'company_id', name='uq_products_code_company'),
        )

    if 'product_variants' not in existing:
        op.create_table(
            'product_variants',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('product_id', sa.Integer(), nullable=False),
            sa.Column('size', sa.String(length=20), nullable=False),
            sa.Column('color', sa.String(length=50), nullable=False),
            sa.Column('sku', sa.String(length=80), nullable=False),
            sa.Column('barcode', sa.String(length=50), nullable=True),
            sa.Column('stock', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('sku', name='uq_product_variants_sku'),
        )

    if 'ingresos' not in existing:
        op.create_table(
            'ingresos',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('type', sa.String(length=7), nullable=False),
            sa.Column('number', sa.String(length=50), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(length=10), nullable=False, server_default='BORRADOR'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('total', sa.Numeric(14, 2), nullable=True),
            sa.Column('provider_id', sa.Integer(), nullable=False),
            sa.Column('pedido_id', sa.Integer(), nullable=True),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['provider_id'], ['providers.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'ingreso_items' not in existing:
        op.create_table(
            'ingreso_items',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('ingreso_id', sa.Integer(), nullable=False),
            sa.Column('variant_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('unit_cost', sa.Numeric(12, 2), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['ingreso_id'], ['ingresos.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id']),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade() -> None:
    op.drop_table('ingreso_items')
    op.drop_table('ingresos')
    op.drop_table('product_variants')
    op.drop_table('products')
