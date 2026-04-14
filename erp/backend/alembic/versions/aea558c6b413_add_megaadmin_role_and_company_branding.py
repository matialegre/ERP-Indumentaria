"""add_megaadmin_role_and_company_branding

Revision ID: aea558c6b413
Revises: f2000931f263
Create Date: 2026-04-10 14:07:27.178626
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'aea558c6b413'
down_revision: Union[str, None] = 'f2000931f263'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add MEGAADMIN to user_role enum (PostgreSQL requires ALTER TYPE)
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MEGAADMIN' BEFORE 'SUPERADMIN'")

    # Create industry_type enum and add branding columns to companies
    industry_type = sa.Enum('INDUMENTARIA', 'KIOSCO', 'MECANICO', 'DEPOSITO', 'RESTAURANTE',
                            'FERRETERIA', 'FARMACIA', 'LIBRERIA', 'OTRO',
                            name='industry_type')
    industry_type.create(op.get_bind(), checkfirst=True)

    op.add_column('companies', sa.Column('app_name', sa.String(length=200), nullable=True))
    op.add_column('companies', sa.Column('short_name', sa.String(length=10), nullable=True))
    op.add_column('companies', sa.Column('primary_color', sa.String(length=7), server_default='#1e40af', nullable=True))
    op.add_column('companies', sa.Column('secondary_color', sa.String(length=7), server_default='#3b82f6', nullable=True))
    op.add_column('companies', sa.Column('favicon_url', sa.Text(), nullable=True))
    op.add_column('companies', sa.Column('industry_type', sa.Enum('INDUMENTARIA', 'KIOSCO', 'MECANICO', 'DEPOSITO', 'RESTAURANTE', 'FERRETERIA', 'FARMACIA', 'LIBRERIA', 'OTRO', name='industry_type', create_constraint=True), nullable=True))
    op.add_column('companies', sa.Column('welcome_message', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'welcome_message')
    op.drop_column('companies', 'industry_type')
    op.drop_column('companies', 'favicon_url')
    op.drop_column('companies', 'secondary_color')
    op.drop_column('companies', 'primary_color')
    op.drop_column('companies', 'short_name')
    op.drop_column('companies', 'app_name')

    sa.Enum(name='industry_type').drop(op.get_bind(), checkfirst=True)
    # Note: PostgreSQL does not support removing values from enums.
    # MEGAADMIN cannot be removed in downgrade without recreating the type.
