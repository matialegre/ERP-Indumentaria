"""add_ml_competitor_tracker

Revision ID: da585e492fa8
Revises: b1c2d3e4f5a6
Create Date: 2026-04-15 15:23:49.567708
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = 'da585e492fa8'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ml_tracked_sellers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.String(length=50), nullable=False),
        sa.Column('nickname', sa.String(length=200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('check_interval_hours', sa.Integer(), nullable=False, server_default='24'),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'seller_id', name='uq_ml_tracked_seller'),
    )
    op.create_index('ix_ml_tracked_sellers_company', 'ml_tracked_sellers', ['company_id'])

    op.create_table(
        'ml_competitor_snapshots',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('tracked_seller_id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.String(length=50), nullable=False),
        sa.Column('item_id', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('price', sa.Numeric(14, 2), nullable=False),
        sa.Column('sold_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('available_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('thumbnail', sa.String(length=500), nullable=True),
        sa.Column('permalink', sa.String(length=500), nullable=True),
        sa.Column('scanned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('price_prev', sa.Numeric(14, 2), nullable=True),
        sa.Column('price_changed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sales_since_last', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['tracked_seller_id'], ['ml_tracked_sellers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ml_snapshots_seller_item', 'ml_competitor_snapshots', ['tracked_seller_id', 'item_id'])
    op.create_index('ix_ml_snapshots_scanned_at',  'ml_competitor_snapshots', ['scanned_at'])
    op.create_index('ix_ml_snapshots_company',     'ml_competitor_snapshots', ['company_id'])


def downgrade() -> None:
    op.drop_table('ml_competitor_snapshots')
    op.drop_table('ml_tracked_sellers')

def downgrade() -> None:
    op.drop_table('ml_competitor_snapshots')
    op.drop_table('ml_tracked_sellers')

