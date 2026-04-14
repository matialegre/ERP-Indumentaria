"""add pedidos sales stock_movements

Revision ID: fccde5b572e2
Revises: 98a5cb57ba52
Create Date: 2026-03-26 17:24:42.358718
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'fccde5b572e2'
down_revision: Union[str, None] = '98a5cb57ba52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = inspector.get_table_names()

    if 'pedidos' not in existing:
        op.create_table(
            'pedidos',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('number', sa.String(length=50), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('expected_date', sa.Date(), nullable=True),
            sa.Column('status', sa.String(length=16), nullable=False, server_default='BORRADOR'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('total', sa.Numeric(14, 2), nullable=True),
            sa.Column('provider_id', sa.Integer(), nullable=False),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['provider_id'], ['providers.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'pedido_items' not in existing:
        op.create_table(
            'pedido_items',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('pedido_id', sa.Integer(), nullable=False),
            sa.Column('variant_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('received_qty', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('unit_cost', sa.Numeric(12, 2), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['pedido_id'], ['pedidos.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'sales' not in existing:
        op.create_table(
            'sales',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('type', sa.String(length=12), nullable=False),
            sa.Column('number', sa.String(length=50), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(length=8), nullable=False, server_default='BORRADOR'),
            sa.Column('customer_name', sa.String(length=200), nullable=True),
            sa.Column('customer_cuit', sa.String(length=13), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('subtotal', sa.Numeric(14, 2), nullable=True),
            sa.Column('tax', sa.Numeric(14, 2), nullable=True),
            sa.Column('total', sa.Numeric(14, 2), nullable=True),
            sa.Column('local_id', sa.Integer(), nullable=True),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['local_id'], ['locals.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'sale_items' not in existing:
        op.create_table(
            'sale_items',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('sale_id', sa.Integer(), nullable=False),
            sa.Column('variant_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
            sa.Column('discount_pct', sa.Numeric(5, 2), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    if 'stock_movements' not in existing:
        op.create_table(
            'stock_movements',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('type', sa.String(length=13), nullable=False),
            sa.Column('variant_id', sa.Integer(), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('reference', sa.String(length=200), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id']),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade() -> None:
    op.drop_table('stock_movements')
    op.drop_table('sale_items')
    op.drop_table('sales')
    op.drop_table('pedido_items')
    op.drop_table('pedidos')

