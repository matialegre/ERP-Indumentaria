"""add_employee_scores

Revision ID: 0f40793fd33d
Revises: e72b38db536f
Create Date: 2026-04-14 10:27:34.959174
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = '0f40793fd33d'
down_revision: Union[str, None] = 'e72b38db536f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('employee_scores',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('employee_id', sa.Integer(), nullable=False),
    sa.Column('scored_by_id', sa.Integer(), nullable=False),
    sa.Column('categoria', sa.String(length=100), nullable=False),
    sa.Column('puntuacion', sa.Integer(), nullable=False),
    sa.Column('comentario', sa.Text(), nullable=True),
    sa.Column('periodo', sa.String(length=7), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
    sa.ForeignKeyConstraint(['employee_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['scored_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employee_scores_company_id'), 'employee_scores', ['company_id'], unique=False)
    op.create_index(op.f('ix_employee_scores_employee_id'), 'employee_scores', ['employee_id'], unique=False)
    op.create_index(op.f('ix_employee_scores_periodo'), 'employee_scores', ['periodo'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_employee_scores_periodo'), table_name='employee_scores')
    op.drop_index(op.f('ix_employee_scores_employee_id'), table_name='employee_scores')
    op.drop_index(op.f('ix_employee_scores_company_id'), table_name='employee_scores')
    op.drop_table('employee_scores')
