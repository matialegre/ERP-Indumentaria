"""004_performance_indexes

Revision ID: a3f9e1d7c2b4
Revises: fccde5b572e2
Create Date: 2026-03-27 00:00:00.000000

Agrega índices de performance en todas las tablas de transacciones.
Las tablas ya existen (creadas por create_all) — solo creamos los índices.
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a3f9e1d7c2b4'
down_revision: Union[str, None] = 'fccde5b572e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Products ─────────────────────────────────────────────
    op.create_index('ix_products_company_id', 'products', ['company_id'], if_not_exists=True)
    op.create_index('ix_products_brand', 'products', ['brand'], if_not_exists=True)
    op.create_index('ix_products_category', 'products', ['category'], if_not_exists=True)
    op.create_index('ix_products_is_active', 'products', ['is_active'], if_not_exists=True)
    op.create_index('ix_products_company_brand', 'products', ['company_id', 'brand'], if_not_exists=True)
    op.create_index('ix_products_company_category', 'products', ['company_id', 'category'], if_not_exists=True)
    op.create_index('ix_products_created_at', 'products', ['created_at'], if_not_exists=True)

    # ── ProductVariants ──────────────────────────────────────
    op.create_index('ix_product_variants_product_id', 'product_variants', ['product_id'], if_not_exists=True)
    op.create_index('ix_product_variants_is_active', 'product_variants', ['is_active'], if_not_exists=True)
    op.create_index('ix_product_variants_stock', 'product_variants', ['stock'], if_not_exists=True)
    op.create_index('ix_product_variants_barcode', 'product_variants', ['barcode'], if_not_exists=True)

    # ── Ingresos ─────────────────────────────────────────────
    op.create_index('ix_ingresos_company_id', 'ingresos', ['company_id'], if_not_exists=True)
    op.create_index('ix_ingresos_status', 'ingresos', ['status'], if_not_exists=True)
    op.create_index('ix_ingresos_date', 'ingresos', ['date'], if_not_exists=True)
    op.create_index('ix_ingresos_provider_id', 'ingresos', ['provider_id'], if_not_exists=True)
    op.create_index('ix_ingresos_created_by_id', 'ingresos', ['created_by_id'], if_not_exists=True)
    op.create_index('ix_ingresos_company_status', 'ingresos', ['company_id', 'status'], if_not_exists=True)
    op.create_index('ix_ingresos_company_date', 'ingresos', ['company_id', 'date'], if_not_exists=True)

    # ── IngresoItems ─────────────────────────────────────────
    op.create_index('ix_ingreso_items_ingreso_id', 'ingreso_items', ['ingreso_id'], if_not_exists=True)
    op.create_index('ix_ingreso_items_variant_id', 'ingreso_items', ['variant_id'], if_not_exists=True)

    # ── Pedidos ──────────────────────────────────────────────
    op.create_index('ix_pedidos_company_id', 'pedidos', ['company_id'], if_not_exists=True)
    op.create_index('ix_pedidos_status', 'pedidos', ['status'], if_not_exists=True)
    op.create_index('ix_pedidos_date', 'pedidos', ['date'], if_not_exists=True)
    op.create_index('ix_pedidos_provider_id', 'pedidos', ['provider_id'], if_not_exists=True)
    op.create_index('ix_pedidos_company_status', 'pedidos', ['company_id', 'status'], if_not_exists=True)

    # ── PedidoItems ──────────────────────────────────────────
    op.create_index('ix_pedido_items_pedido_id', 'pedido_items', ['pedido_id'], if_not_exists=True)
    op.create_index('ix_pedido_items_variant_id', 'pedido_items', ['variant_id'], if_not_exists=True)

    # ── Sales ────────────────────────────────────────────────
    op.create_index('ix_sales_company_id', 'sales', ['company_id'], if_not_exists=True)
    op.create_index('ix_sales_status', 'sales', ['status'], if_not_exists=True)
    op.create_index('ix_sales_date', 'sales', ['date'], if_not_exists=True)
    op.create_index('ix_sales_local_id', 'sales', ['local_id'], if_not_exists=True)
    op.create_index('ix_sales_type', 'sales', ['type'], if_not_exists=True)
    op.create_index('ix_sales_company_status', 'sales', ['company_id', 'status'], if_not_exists=True)
    op.create_index('ix_sales_company_date', 'sales', ['company_id', 'date'], if_not_exists=True)

    # ── SaleItems ────────────────────────────────────────────
    op.create_index('ix_sale_items_sale_id', 'sale_items', ['sale_id'], if_not_exists=True)
    op.create_index('ix_sale_items_variant_id', 'sale_items', ['variant_id'], if_not_exists=True)

    # ── StockMovements ───────────────────────────────────────
    op.create_index('ix_stock_movements_company_id', 'stock_movements', ['company_id'], if_not_exists=True)
    op.create_index('ix_stock_movements_variant_id', 'stock_movements', ['variant_id'], if_not_exists=True)
    op.create_index('ix_stock_movements_type', 'stock_movements', ['type'], if_not_exists=True)
    op.create_index('ix_stock_movements_created_at', 'stock_movements', ['created_at'], if_not_exists=True)
    op.create_index('ix_stock_movements_created_by_id', 'stock_movements', ['created_by_id'], if_not_exists=True)

    # ── Users ────────────────────────────────────────────────
    op.create_index('ix_users_company_id', 'users', ['company_id'], if_not_exists=True)
    op.create_index('ix_users_role', 'users', ['role'], if_not_exists=True)
    op.create_index('ix_users_is_active', 'users', ['is_active'], if_not_exists=True)

    # ── Providers ────────────────────────────────────────────
    op.create_index('ix_providers_company_id', 'providers', ['company_id'], if_not_exists=True)
    op.create_index('ix_providers_is_active', 'providers', ['is_active'], if_not_exists=True)

    # ── Locals ───────────────────────────────────────────────
    op.create_index('ix_locals_company_id', 'locals', ['company_id'], if_not_exists=True)
    op.create_index('ix_locals_is_active', 'locals', ['is_active'], if_not_exists=True)


def downgrade() -> None:
    op.drop_index('ix_products_company_id', 'products', if_exists=True)
    op.drop_index('ix_products_brand', 'products', if_exists=True)
    op.drop_index('ix_products_category', 'products', if_exists=True)
    op.drop_index('ix_products_is_active', 'products', if_exists=True)
    op.drop_index('ix_products_company_brand', 'products', if_exists=True)
    op.drop_index('ix_products_company_category', 'products', if_exists=True)
    op.drop_index('ix_products_created_at', 'products', if_exists=True)
    op.drop_index('ix_product_variants_product_id', 'product_variants', if_exists=True)
    op.drop_index('ix_product_variants_is_active', 'product_variants', if_exists=True)
    op.drop_index('ix_product_variants_stock', 'product_variants', if_exists=True)
    op.drop_index('ix_product_variants_barcode', 'product_variants', if_exists=True)
    op.drop_index('ix_ingresos_company_id', 'ingresos', if_exists=True)
    op.drop_index('ix_ingresos_status', 'ingresos', if_exists=True)
    op.drop_index('ix_ingresos_date', 'ingresos', if_exists=True)
    op.drop_index('ix_ingresos_provider_id', 'ingresos', if_exists=True)
    op.drop_index('ix_ingresos_created_by_id', 'ingresos', if_exists=True)
    op.drop_index('ix_ingresos_company_status', 'ingresos', if_exists=True)
    op.drop_index('ix_ingresos_company_date', 'ingresos', if_exists=True)
    op.drop_index('ix_ingreso_items_ingreso_id', 'ingreso_items', if_exists=True)
    op.drop_index('ix_ingreso_items_variant_id', 'ingreso_items', if_exists=True)
    op.drop_index('ix_pedidos_company_id', 'pedidos', if_exists=True)
    op.drop_index('ix_pedidos_status', 'pedidos', if_exists=True)
    op.drop_index('ix_pedidos_date', 'pedidos', if_exists=True)
    op.drop_index('ix_pedidos_provider_id', 'pedidos', if_exists=True)
    op.drop_index('ix_pedidos_company_status', 'pedidos', if_exists=True)
    op.drop_index('ix_pedido_items_pedido_id', 'pedido_items', if_exists=True)
    op.drop_index('ix_pedido_items_variant_id', 'pedido_items', if_exists=True)
    op.drop_index('ix_sales_company_id', 'sales', if_exists=True)
    op.drop_index('ix_sales_status', 'sales', if_exists=True)
    op.drop_index('ix_sales_date', 'sales', if_exists=True)
    op.drop_index('ix_sales_local_id', 'sales', if_exists=True)
    op.drop_index('ix_sales_type', 'sales', if_exists=True)
    op.drop_index('ix_sales_company_status', 'sales', if_exists=True)
    op.drop_index('ix_sales_company_date', 'sales', if_exists=True)
    op.drop_index('ix_sale_items_sale_id', 'sale_items', if_exists=True)
    op.drop_index('ix_sale_items_variant_id', 'sale_items', if_exists=True)
    op.drop_index('ix_stock_movements_company_id', 'stock_movements', if_exists=True)
    op.drop_index('ix_stock_movements_variant_id', 'stock_movements', if_exists=True)
    op.drop_index('ix_stock_movements_type', 'stock_movements', if_exists=True)
    op.drop_index('ix_stock_movements_created_at', 'stock_movements', if_exists=True)
    op.drop_index('ix_stock_movements_created_by_id', 'stock_movements', if_exists=True)
    op.drop_index('ix_users_company_id', 'users', if_exists=True)
    op.drop_index('ix_users_role', 'users', if_exists=True)
    op.drop_index('ix_users_is_active', 'users', if_exists=True)
    op.drop_index('ix_providers_company_id', 'providers', if_exists=True)
    op.drop_index('ix_providers_is_active', 'providers', if_exists=True)
    op.drop_index('ix_locals_company_id', 'locals', if_exists=True)
    op.drop_index('ix_locals_is_active', 'locals', if_exists=True)
