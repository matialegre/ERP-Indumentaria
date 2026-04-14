"""tablas_faltantes

Revision ID: 94a448aece46
Revises: 002_gap6_gap8
Create Date: 2026-04-13 09:47:12.860553
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '94a448aece46'
down_revision: Union[str, None] = '002_gap6_gap8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Todas las 56 tablas ya existen en la DB — creadas via create_all() en main.py.
    # Esta migración SÓLO estampa el estado actual en el historial de Alembic.
    #
    # Lo que autogenerate detectó pero NO aplicamos (intencional):
    #   - Drop de índices de performance (ix_notification_device_id, ix_po_*, ix_pi_*, etc.)
    #     → Esos índices son útiles y deben MANTENERSE en la DB.
    #   - ALTER pedidos.expected_date NOT NULL
    #     → Riesgoso sin verificar datos existentes.
    #
    # Tablas incorporadas al historial de Alembic con esta migración:
    #   account_movements, afip_configs, afip_queue, audit_logs, bank_accounts,
    #   credit_notes, customer_companies, customers, device_registry,
    #   kanban_boards, kanban_cards, kanban_columns, mail_configs, mechanic_rates,
    #   mercadopago_configs, mercadopago_transactions, notifications, payment_invoice_links,
    #   payment_vouchers, plans, price_list_files, price_list_items, provider_contacts,
    #   purchase_invoice_items, purchase_invoices, purchase_order_items, purchase_orders,
    #   shipments, storage_files, sync_conflicts, sync_events, sync_retry_queue,
    #   transports, vehicles, whatsapp_messages, work_order_checklists,
    #   work_order_history, work_order_items, work_orders
    pass


def downgrade() -> None:
    pass
