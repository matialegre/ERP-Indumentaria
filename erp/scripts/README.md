# ERP Mundo Outdoor — Migration & Utility Scripts

## `migrate_control_remitos.py`

Migrates historical data from **CONTROL REMITOS** (SQLite) to the new **ERP** (PostgreSQL).

### What is migrated

| SQLite table       | PostgreSQL table(s)                                 |
|--------------------|-----------------------------------------------------|
| `PROVEEDORES`      | `providers`                                         |
| `NOTA_PEDIDO`      | `purchase_orders`                                   |
| `FACTURAS`         | `purchase_invoices` + `purchase_invoice_items`      |
| `COMPROBANTES_PAGO`| `payment_vouchers` + `payment_invoice_links`        |

> **Not migrated:** `purchase_order_items` — requires `product_variants` to exist first.
> Migrate products separately, then re-run if item-level order detail is needed.

### Prerequisites

1. ERP backend venv activated (or psycopg2-binary installed):
   ```bat
   cd X:\ERP MUNDO OUTDOOR\erp\backend
   .\venv\Scripts\activate
   ```
2. PostgreSQL running on port 2048 with at least one company and one admin user.
3. Alembic migrations applied (`alembic upgrade head`).

### Usage

```bat
cd X:\ERP MUNDO OUTDOOR\erp\scripts

# Full migration (all tables, auto-detect company)
python migrate_control_remitos.py

# Dry run — preview without writing
python migrate_control_remitos.py --dry-run

# Migrate only providers
python migrate_control_remitos.py --table providers

# Migrate only purchase orders
python migrate_control_remitos.py --table orders

# Migrate only invoices (requires orders to have been migrated first)
python migrate_control_remitos.py --table invoices

# Migrate only payment vouchers
python migrate_control_remitos.py --table payments

# Use a specific company ID
python migrate_control_remitos.py --company-id 3

# Override SQLite path
python migrate_control_remitos.py --sqlite-path "C:\other\path\pedidos.db"

# Verbose output
python migrate_control_remitos.py --verbose

# Combine flags
python migrate_control_remitos.py --dry-run --table providers --company-id 3
```

### Recommended migration order

Always run in this order to respect foreign keys:

```
1. providers
2. orders      (depends on providers)
3. invoices    (depends on orders + providers)
4. payments    (depends on providers + invoices)
```

Running `--table all` (the default) handles this automatically.

### Idempotency

The script is safe to re-run:
- Providers are skipped if a matching **name** or **CUIT** already exists.
- Orders are skipped if the **number** already exists.
- Invoices are skipped if the **number** already exists (nulls are re-evaluated).
- Payments are skipped if the **number** already exists.

### Default paths

| Setting          | Value                                                                              |
|------------------|------------------------------------------------------------------------------------|
| SQLite source    | `X:\ERP MUNDO OUTDOOR\ULTIMO CONTROL\SISTEMA PEDIDOS\servidor\BASE_DATOS\pedidos.db` |
| PostgreSQL host  | `localhost:2048`                                                                   |
| Database         | `erp_mundooutdoor`                                                                 |
| Default company  | Auto-detected (first company in `companies` table)                                |

### Exit codes

| Code | Meaning                          |
|------|----------------------------------|
| 0    | Success (0 errors)               |
| 1    | Completed with one or more errors|
