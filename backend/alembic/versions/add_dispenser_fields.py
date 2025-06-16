"""Add enhanced dispenser fields

Revision ID: add_dispenser_fields
Revises: 
Create Date: 2025-06-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_dispenser_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to dispensers table
    op.add_column('dispensers', sa.Column('make', sa.String(100), nullable=True))
    op.add_column('dispensers', sa.Column('model', sa.String(100), nullable=True))
    op.add_column('dispensers', sa.Column('serial_number', sa.String(100), nullable=True))
    op.add_column('dispensers', sa.Column('meter_type', sa.String(100), nullable=True))
    op.add_column('dispensers', sa.Column('number_of_nozzles', sa.String(20), nullable=True))


def downgrade():
    # Remove columns
    op.drop_column('dispensers', 'number_of_nozzles')
    op.drop_column('dispensers', 'meter_type')
    op.drop_column('dispensers', 'serial_number')
    op.drop_column('dispensers', 'model')
    op.drop_column('dispensers', 'make')