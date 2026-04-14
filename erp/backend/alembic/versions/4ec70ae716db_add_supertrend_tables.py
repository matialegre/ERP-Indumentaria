"""add_supertrend_tables

Revision ID: 4ec70ae716db
Revises: 0cd0b7116d11
Create Date: 2026-04-13 11:30:25.561014
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '4ec70ae716db'
down_revision: Union[str, None] = '0cd0b7116d11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = inspector.get_table_names()

    if 'supertrend_competitors' not in existing:
        op.create_table(
            'supertrend_competitors',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('competitor_name', sa.String(length=200), nullable=False),
            sa.Column('competitor_url', sa.String(length=500), nullable=True),
            sa.Column('product_name', sa.String(length=300), nullable=False),
            sa.Column('category', sa.String(length=150), nullable=True),
            sa.Column('sku_reference', sa.String(length=100), nullable=True),
            sa.Column('competitor_price', sa.Numeric(14, 2), nullable=False),
            sa.Column('our_price', sa.Numeric(14, 2), nullable=True),
            sa.Column('currency', sa.String(length=10), nullable=False, server_default='ARS'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_supertrend_competitors_company', 'supertrend_competitors', ['company_id'])

    if 'supertrend_trends' not in existing:
        op.create_table(
            'supertrend_trends',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('company_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=300), nullable=False),
            sa.Column('category', sa.String(length=150), nullable=True),
            sa.Column('business_type', sa.String(length=100), nullable=True),
            sa.Column('direction', sa.Enum('UP', 'STABLE', 'DOWN', name='trend_direction'), nullable=False),
            sa.Column('relevance', sa.Integer(), nullable=False, server_default='3'),
            sa.Column('source', sa.String(length=300), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('action', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_supertrend_trends_company', 'supertrend_trends', ['company_id'])


def downgrade() -> None:
    op.drop_index('ix_supertrend_trends_company', table_name='supertrend_trends')
    op.drop_table('supertrend_trends')
    op.drop_index('ix_supertrend_competitors_company', table_name='supertrend_competitors')
    op.drop_table('supertrend_competitors')
    op.execute("DROP TYPE IF EXISTS trend_direction")
