#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migration script: CONTROL REMITOS (SQLite) -> ERP Mundo Outdoor (PostgreSQL)

Source: X:\\ERP MUNDO OUTDOOR\\ULTIMO CONTROL\\SISTEMA PEDIDOS\\servidor\\BASE_DATOS\\pedidos.db
Target: PostgreSQL host=localhost port=2048 db=erp_mundooutdoor

Usage:
    python migrate_control_remitos.py
    python migrate_control_remitos.py --dry-run
    python migrate_control_remitos.py --table providers
    python migrate_control_remitos.py --table orders
    python migrate_control_remitos.py --table invoices
    python migrate_control_remitos.py --table payments
    python migrate_control_remitos.py --company-id 3
    python migrate_control_remitos.py --sqlite-path "C:\\other\\path\\pedidos.db"

Tables migrated:
    1. PROVEEDORES       -> providers
    2. NOTA_PEDIDO       -> purchase_orders
    3. FACTURAS          -> purchase_invoices + purchase_invoice_items (from ITEMS_JSON)
    4. COMPROBANTES_PAGO -> payment_vouchers + payment_invoice_links (from FACTURAS_JSON)

Note:
    - purchase_order_items are NOT migrated (require product_variants which may not exist).
    - Run product migration first if you need item-level order detail.
    - All records are assigned to --company-id (default: auto-detect first company in PG).
    - created_by_id defaults to the first SUPERADMIN/ADMIN user found.
"""

import argparse
import json
import logging
import os
import re
import sqlite3
import sys
import traceback
from datetime import date, datetime
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

# -- Try importing psycopg2 from the venv if not on path ------------------------
_VENV_SITE = Path(__file__).parent.parent / "backend" / "venv" / "Lib" / "site-packages"
if _VENV_SITE.exists():
    sys.path.insert(0, str(_VENV_SITE))

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not found. Run from the ERP venv or install psycopg2-binary.")
    sys.exit(1)

# -- ANSI Colors ----------------------------------------------------------------

class C:
    GREEN  = "\033[92m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    RESET  = "\033[0m"

    @staticmethod
    def ok(msg):    return f"{C.GREEN}[OK]{C.RESET} {msg}"
    @staticmethod
    def fail(msg):  return f"{C.RED}[!!]{C.RESET} {msg}"
    @staticmethod
    def warn(msg):  return f"{C.YELLOW}[??]{C.RESET} {msg}"
    @staticmethod
    def info(msg):  return f"{C.BLUE}[->]{C.RESET} {msg}"
    @staticmethod
    def head(msg):  return f"\n{C.BOLD}{C.CYAN}{'-'*60}\n  {msg}\n{'-'*60}{C.RESET}"

# -- Defaults -------------------------------------------------------------------

DEFAULT_SQLITE = (
    r"X:\ERP MUNDO OUTDOOR\ULTIMO CONTROL\SISTEMA PEDIDOS\servidor\BASE_DATOS\pedidos.db"
)

PG_CONFIG = {
    "host":     "localhost",
    "port":     2048,
    "dbname":   "erp_mundooutdoor",
    "user":     "erp_user",
    "password": "MundoOutdoor2026!",
}

# -- Logging --------------------------------------------------------------------

logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s %(message)s",
)
log = logging.getLogger("migration")

# -- Counters -------------------------------------------------------------------

class Stats:
    def __init__(self, table: str):
        self.table    = table
        self.total    = 0
        self.inserted = 0
        self.skipped  = 0
        self.errors   = 0

    def report(self):
        print(
            f"  {C.BOLD}{self.table}{C.RESET}: "
            f"{C.GREEN}{self.inserted} inserted{C.RESET}, "
            f"{C.YELLOW}{self.skipped} skipped{C.RESET}, "
            f"{C.RED}{self.errors} errors{C.RESET} "
            f"(of {self.total} source records)"
        )

# -- Date helpers ---------------------------------------------------------------

_DATE_FMTS = [
    "%d/%m/%Y", "%d/%m/%y",
    "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S",
    "%d-%m-%Y",
]

def parse_date(s: str | None) -> date | None:
    """Parse a date string in various formats. Returns None on failure."""
    if not s:
        return None
    s = s.strip()
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

def parse_datetime(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    for fmt in ["%d/%m/%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None

# -- CUIT normalizer ------------------------------------------------------------

def normalize_cuit(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11:
        return f"{digits[:2]}-{digits[2:10]}-{digits[10]}"
    return raw[:13] if raw else None

# -- SQLite schema detection ----------------------------------------------------

def get_columns(cur: sqlite3.Cursor, table: str) -> dict:
    """Return {col_name: pragma_row} for a SQLite table."""
    rows = cur.execute(f"PRAGMA table_info({table})").fetchall()
    return {row[1]: row for row in rows}

def table_exists_sqlite(cur: sqlite3.Cursor, table: str) -> bool:
    rows = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchall()
    return len(rows) > 0

# -- Safe getters ---------------------------------------------------------------

def sget(row, key: str, default=None):
    """Get value from sqlite3.Row or dict; return default if missing."""
    try:
        v = row[key]
        return v if v is not None else default
    except (IndexError, KeyError):
        return default

def zero_if_none(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default

# -- PostgreSQL helpers ---------------------------------------------------------

def pg_connect():
    return psycopg2.connect(**PG_CONFIG)

def pg_table_exists(pg_cur, table: str) -> bool:
    pg_cur.execute(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=%s",
        (table,),
    )
    return pg_cur.fetchone() is not None

def get_company_id(pg_cur, requested_id: int) -> int:
    """Validate company exists; fall back to first company with a warning."""
    pg_cur.execute("SELECT id, name FROM companies WHERE id=%s", (requested_id,))
    row = pg_cur.fetchone()
    if row:
        return row[0]
    # Not found -- use first available
    pg_cur.execute("SELECT id, name FROM companies ORDER BY id LIMIT 1")
    row = pg_cur.fetchone()
    if not row:
        print(C.fail(f"No companies found in PostgreSQL. Create one first."))
        sys.exit(1)
    print(C.warn(
        f"company_id={requested_id} not found. Using company_id={row[0]} "
        f"({row[1]}) instead. Override with --company-id."
    ))
    return row[0]

def get_admin_user_id(pg_cur) -> int:
    pg_cur.execute(
        "SELECT id FROM users WHERE role IN ('SUPERADMIN','ADMIN') ORDER BY id LIMIT 1"
    )
    row = pg_cur.fetchone()
    if not row:
        pg_cur.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        row = pg_cur.fetchone()
    if not row:
        print(C.fail("No users found in PostgreSQL. Create an admin user first."))
        sys.exit(1)
    return row[0]

def get_locals_map(pg_cur, company_id: int) -> dict:
    """Return {local_name_lower: local_id} for fuzzy matching."""
    pg_cur.execute("SELECT id, name FROM locals WHERE company_id=%s", (company_id,))
    return {row[1].lower(): row[0] for row in pg_cur.fetchall()}

def find_local_id(locals_map: dict, local_name: str | None) -> int | None:
    if not local_name:
        return None
    key = local_name.strip().lower()
    if key in locals_map:
        return locals_map[key]
    # Partial match
    for k, v in locals_map.items():
        if key in k or k in key:
            return v
    return None

# -- 1. MIGRATE PROVIDERS ------------------------------------------------------

def migrate_providers(
    sqlite_cur: sqlite3.Cursor,
    pg_conn,
    company_id: int,
    dry_run: bool,
) -> Stats:
    stats = Stats("providers")

    if not table_exists_sqlite(sqlite_cur, "PROVEEDORES"):
        print(C.warn("Table PROVEEDORES not found in SQLite -- skipping providers."))
        return stats

    cols = get_columns(sqlite_cur, "PROVEEDORES")
    print(C.info(f"Detected {len(cols)} columns in PROVEEDORES"))

    def col(name: str) -> bool:
        return name in cols

    rows = sqlite_cur.execute("SELECT * FROM PROVEEDORES ORDER BY PROVEEDOR_ID").fetchall()
    stats.total = len(rows)

    with pg_conn.cursor() as pg_cur:
        # Build existing name set for idempotency
        pg_cur.execute("SELECT LOWER(name) FROM providers WHERE company_id=%s", (company_id,))
        existing_names = {r[0] for r in pg_cur.fetchall()}
        pg_cur.execute("SELECT cuit FROM providers WHERE company_id=%s AND cuit IS NOT NULL", (company_id,))
        existing_cuits = {r[0] for r in pg_cur.fetchall()}

        for row in rows:
            stats.total  # already set
            name = sget(row, "PROVEEDOR_NOMBRE", "").strip()
            if not name:
                stats.skipped += 1
                continue

            cuit = normalize_cuit(sget(row, "CUIT"))

            # Skip if already exists by CUIT or name
            if cuit and cuit in existing_cuits:
                stats.skipped += 1
                continue
            if name.lower() in existing_names:
                stats.skipped += 1
                continue

            anulado = int(sget(row, "PROVEEDOR_ANULADO", 0) or 0)

            record = {
                "name":            name,
                "cuit":            cuit,
                "legal_name":      sget(row, "RAZON_SOCIAL") if col("RAZON_SOCIAL") else None,
                "contact_name":    sget(row, "CONTACTO")     if col("CONTACTO")     else None,
                "phone":           sget(row, "TELEFONO")     if col("TELEFONO")     else None,
                "email":           sget(row, "EMAIL")        if col("EMAIL")        else None,
                "fax":             sget(row, "FAX")          if col("FAX")          else None,
                "vendor_name":     sget(row, "VENDEDOR")     if col("VENDEDOR")     else None,
                "address":         sget(row, "DOMICILIO")    if col("DOMICILIO")    else None,
                "domicilio":       sget(row, "DOMICILIO")    if col("DOMICILIO")    else None,
                "cp":              sget(row, "CODIGO_POSTAL") if col("CODIGO_POSTAL") else None,
                "localidad":       sget(row, "LOCALIDAD")    if col("LOCALIDAD")    else None,
                "provincia":       sget(row, "PROVINCIA")    if col("PROVINCIA")    else None,
                "pais":            sget(row, "PAIS")         if col("PAIS")         else "Argentina",
                "gross_income":    sget(row, "INGRESOS_BRUTOS") if col("INGRESOS_BRUTOS") else None,
                "tax_condition":   sget(row, "CONDICION")    if col("CONDICION")    else None,
                "tax_id_type":     sget(row, "TIPO_DOCUMENTO") if col("TIPO_DOCUMENTO") else None,
                "order_prefix":    sget(row, "PREFIJO_PEDIDO") if col("PREFIJO_PEDIDO") else None,
                "tango_code":      sget(row, "CODIGO")       if col("CODIGO")       else None,
                "notes":           sget(row, "COMENTARIO")   if col("COMENTARIO")   else None,
                # Retenciones
                "ret_iva_pct":     zero_if_none(sget(row, "COEF_IVA")) if col("COEF_IVA") else None,
                "ret_iibb_pct":    zero_if_none(sget(row, "COEF_IB"))  if col("COEF_IB")  else None,
                "ret_ganancias_pct": zero_if_none(sget(row, "COEF_GANAR")) if col("COEF_GANAR") else None,
                "ret_suss_pct":    zero_if_none(sget(row, "COEF_SUSS")) if col("COEF_SUSS") else None,
                "days_alert_sin_rv": int(sget(row, "DIAS_ALERTA_FACTURA", 0) or 0) if col("DIAS_ALERTA_FACTURA") else None,
                "is_active":       anulado == 0,
                "company_id":      company_id,
                "created_at":      datetime.now(),
                "updated_at":      datetime.now(),
            }

            if dry_run:
                print(C.info(f"  [DRY] Would insert provider: {name!r} (CUIT={cuit})"))
                stats.inserted += 1
                existing_names.add(name.lower())
                if cuit:
                    existing_cuits.add(cuit)
                continue

            try:
                pg_cur.execute(
                    """
                    INSERT INTO providers (
                        name, cuit, legal_name, contact_name, phone, email, fax,
                        vendor_name, address, domicilio, cp, localidad, provincia, pais,
                        gross_income, tax_condition, tax_id_type,
                        order_prefix, tango_code, notes,
                        ret_iva_pct, ret_iibb_pct, ret_ganancias_pct, ret_suss_pct,
                        days_alert_sin_rv, is_active, company_id, created_at, updated_at
                    ) VALUES (
                        %(name)s, %(cuit)s, %(legal_name)s, %(contact_name)s, %(phone)s,
                        %(email)s, %(fax)s, %(vendor_name)s, %(address)s, %(domicilio)s,
                        %(cp)s, %(localidad)s, %(provincia)s, %(pais)s,
                        %(gross_income)s, %(tax_condition)s, %(tax_id_type)s,
                        %(order_prefix)s, %(tango_code)s, %(notes)s,
                        %(ret_iva_pct)s, %(ret_iibb_pct)s, %(ret_ganancias_pct)s,
                        %(ret_suss_pct)s, %(days_alert_sin_rv)s, %(is_active)s,
                        %(company_id)s, %(created_at)s, %(updated_at)s
                    )
                    """,
                    record,
                )
                stats.inserted += 1
                existing_names.add(name.lower())
                if cuit:
                    existing_cuits.add(cuit)
                print(C.ok(f"  Provider: {name!r}"))
            except Exception as e:
                pg_conn.rollback()
                stats.errors += 1
                print(C.fail(f"  Provider {name!r}: {e}"))
                continue

        if not dry_run:
            pg_conn.commit()

    return stats

# -- 2. MIGRATE PURCHASE ORDERS ------------------------------------------------

def migrate_purchase_orders(
    sqlite_cur: sqlite3.Cursor,
    pg_conn,
    company_id: int,
    created_by_id: int,
    dry_run: bool,
) -> tuple[Stats, dict]:
    """
    Returns (stats, sqlite_id_to_pg_id) mapping for downstream use.
    purchase_order_items are NOT migrated (require product_variants).
    """
    stats = Stats("purchase_orders")
    id_map: dict[int, int] = {}  # sqlite ID_NOTA -> postgres purchase_order id

    if not table_exists_sqlite(sqlite_cur, "NOTA_PEDIDO"):
        print(C.warn("Table NOTA_PEDIDO not found -- skipping purchase_orders."))
        return stats, id_map

    if not table_exists_sqlite(sqlite_cur, "PROVEEDORES"):
        print(C.warn("Table PROVEEDORES not found -- skipping purchase_orders."))
        return stats, id_map

    cols = get_columns(sqlite_cur, "NOTA_PEDIDO")
    print(C.info(f"Detected {len(cols)} columns in NOTA_PEDIDO"))

    rows = sqlite_cur.execute(
        "SELECT * FROM NOTA_PEDIDO ORDER BY ID_NOTA"
    ).fetchall()
    stats.total = len(rows)

    with pg_conn.cursor() as pg_cur:
        # Build provider name -> pg_id map for source provider lookup
        pg_cur.execute(
            "SELECT id, LOWER(name) FROM providers WHERE company_id=%s", (company_id,)
        )
        provider_by_name = {r[1]: r[0] for r in pg_cur.fetchall()}

        # Also build sqlite provider_id -> name lookup
        src_providers = {}
        if table_exists_sqlite(sqlite_cur, "PROVEEDORES"):
            for p in sqlite_cur.execute("SELECT PROVEEDOR_ID, PROVEEDOR_NOMBRE FROM PROVEEDORES").fetchall():
                src_providers[p[0]] = p[1]

        # Existing order numbers for idempotency
        pg_cur.execute(
            "SELECT number FROM purchase_orders WHERE company_id=%s", (company_id,)
        )
        existing_numbers = {r[0] for r in pg_cur.fetchall()}

        # Local map
        locals_map = get_locals_map(pg_cur, company_id)

        for row in rows:
            number = sget(row, "PEDIDO_NUMERO", "")
            if not number:
                number = f"MIG-{sget(row, 'ID_NOTA', '?')}"
            number = str(number).strip()

            if number in existing_numbers:
                stats.skipped += 1
                # Still build id_map for FK references downstream
                pg_cur.execute(
                    "SELECT id FROM purchase_orders WHERE number=%s AND company_id=%s",
                    (number, company_id),
                )
                existing = pg_cur.fetchone()
                if existing:
                    id_map[int(sget(row, "ID_NOTA", 0))] = existing[0]
                continue

            # Resolve provider
            src_prov_id = sget(row, "PROVEEDOR_ID")
            prov_name = src_providers.get(int(src_prov_id), "") if src_prov_id else ""
            provider_id = provider_by_name.get(prov_name.lower()) if prov_name else None

            if not provider_id:
                # Try fuzzy match
                for k, v in provider_by_name.items():
                    if prov_name and (prov_name.lower() in k or k in prov_name.lower()):
                        provider_id = v
                        break

            if not provider_id:
                stats.errors += 1
                print(C.fail(
                    f"  Order {number!r}: provider not found "
                    f"(SQLite PROVEEDOR_ID={src_prov_id}, name={prov_name!r}). "
                    f"Migrate providers first."
                ))
                continue

            raw_date = sget(row, "PEDIDO_FECHA")
            order_date = parse_date(raw_date) or date.today()

            # Determine type
            precompra = int(sget(row, "PRECOMPRA", 0) or 0)
            reposicion = int(sget(row, "REPOSICION", 0) or 0) if "REPOSICION" in cols else 0
            if precompra:
                order_type = "PRECOMPRA"
            elif reposicion:
                order_type = "REPOSICION"
            else:
                order_type = "REPOSICION"

            # Determine status
            anulado = int(sget(row, "PEDIDO_ANULADO", 0) or 0)
            finalizado = int(sget(row, "FINALIZADO_FORZADO", 0) or 0) if "FINALIZADO_FORZADO" in cols else 0
            if anulado:
                status = "ANULADO"
            elif finalizado:
                status = "COMPLETADO"
            else:
                status = "ENVIADO"  # best assumption for existing orders

            local_name = sget(row, "LOCAL")
            local_id   = find_local_id(locals_map, local_name)

            total_qty = int(sget(row, "PEDIDO_CANTIDAD", 0) or 0)

            record = {
                "number":         number,
                "prefix":         None,
                "type":           order_type,
                "status":         status,
                "date":           order_date,
                "expected_date":  None,
                "notes":          sget(row, "ACCESO"),
                "observations":   sget(row, "OBSERVACIONES"),
                "total_ordered":  total_qty if total_qty else None,
                "total_received": None,
                "provider_id":    provider_id,
                "local_id":       local_id,
                "company_id":     company_id,
                "created_by_id":  created_by_id,
                "excel_file":     sget(row, "EXCEL_WEB"),
                "pdf_file":       None,
                "created_at":     datetime.now(),
                "updated_at":     datetime.now(),
            }

            if dry_run:
                fake_id = -(sget(row, "ID_NOTA", 0))
                id_map[int(sget(row, "ID_NOTA", 0))] = fake_id
                print(C.info(f"  [DRY] Would insert order: {number!r} ({status}, {order_type})"))
                stats.inserted += 1
                existing_numbers.add(number)
                continue

            try:
                pg_cur.execute(
                    """
                    INSERT INTO purchase_orders (
                        number, prefix, type, status, date, expected_date,
                        notes, observations, total_ordered, total_received,
                        provider_id, local_id, company_id, created_by_id,
                        excel_file, pdf_file, created_at, updated_at
                    ) VALUES (
                        %(number)s, %(prefix)s, %(type)s::purchase_order_type,
                        %(status)s::purchase_order_status,
                        %(date)s, %(expected_date)s,
                        %(notes)s, %(observations)s,
                        %(total_ordered)s, %(total_received)s,
                        %(provider_id)s, %(local_id)s, %(company_id)s, %(created_by_id)s,
                        %(excel_file)s, %(pdf_file)s, %(created_at)s, %(updated_at)s
                    ) RETURNING id
                    """,
                    record,
                )
                new_id = pg_cur.fetchone()[0]
                id_map[int(sget(row, "ID_NOTA", 0))] = new_id
                stats.inserted += 1
                existing_numbers.add(number)
                print(C.ok(f"  Order: {number!r} (id={new_id})"))
            except Exception as e:
                pg_conn.rollback()
                stats.errors += 1
                print(C.fail(f"  Order {number!r}: {e}"))
                continue

        if not dry_run:
            pg_conn.commit()

    return stats, id_map

# -- 3. MIGRATE PURCHASE INVOICES ----------------------------------------------

_TIPO_DOC_MAP = {
    "FACTURA":        "FACTURA",
    "REMITO":         "REMITO",
    "REMITO_FACTURA": "REMITO_FACTURA",
    "REMITO FACTURA": "REMITO_FACTURA",
    "RF":             "REMITO_FACTURA",
    "F":              "FACTURA",
    "R":              "REMITO",
}

_SEMAFORO_MAP = {
    "VERDE":      "VERDE",
    "ROJO":       "ROJO",
    "ALERTA":     "ALERTA_REPO",
    "ALERTA_REPO": "ALERTA_REPO",
    "PENDIENTE":  "PENDIENTE",
    "ANULADO":    "ANULADO",
}

def migrate_invoices(
    sqlite_cur: sqlite3.Cursor,
    pg_conn,
    company_id: int,
    created_by_id: int,
    order_id_map: dict,
    dry_run: bool,
) -> Stats:
    stats = Stats("purchase_invoices")

    if not table_exists_sqlite(sqlite_cur, "FACTURAS"):
        print(C.warn("Table FACTURAS not found -- skipping purchase_invoices."))
        return stats

    cols = get_columns(sqlite_cur, "FACTURAS")
    print(C.info(f"Detected {len(cols)} columns in FACTURAS"))

    rows = sqlite_cur.execute("SELECT * FROM FACTURAS ORDER BY FACTURA_ID").fetchall()
    stats.total = len(rows)

    with pg_conn.cursor() as pg_cur:
        # Existing invoice numbers for idempotency
        pg_cur.execute(
            "SELECT number FROM purchase_invoices WHERE company_id=%s", (company_id,)
        )
        existing_nums = {r[0] for r in pg_cur.fetchall() if r[0]}

        locals_map = get_locals_map(pg_cur, company_id)

        for row in rows:
            numero = sget(row, "FACTURA_NUMERO", "")
            if numero:
                numero = str(numero).strip()

            # Check idempotency by number (if exists)
            if numero and numero in existing_nums:
                stats.skipped += 1
                continue

            # Resolve purchase_order_id
            sqlite_nota_id = sget(row, "ID_NOTA")
            pg_order_id = order_id_map.get(int(sqlite_nota_id)) if sqlite_nota_id else None

            if not pg_order_id:
                stats.errors += 1
                print(C.fail(
                    f"  Invoice {numero!r}: purchase_order not found "
                    f"(ID_NOTA={sqlite_nota_id}). Migrate orders first."
                ))
                continue

            # Resolve provider from order
            pg_cur.execute(
                "SELECT provider_id FROM purchase_orders WHERE id=%s", (pg_order_id,)
            )
            ord_row = pg_cur.fetchone()
            provider_id = ord_row[0] if ord_row else None

            tipo_raw = sget(row, "TIPO_DOCUMENTO", "FACTURA")
            tipo = _TIPO_DOC_MAP.get(str(tipo_raw).upper().strip(), "FACTURA")

            semaforo_raw = sget(row, "ESTADO_SEMAFORO", "ROJO")
            semaforo = _SEMAFORO_MAP.get(str(semaforo_raw).upper().strip(), "ROJO")

            anulado = int(sget(row, "FACTURA_ANULADO", 0) or 0)
            if anulado:
                semaforo = "ANULADO"

            # Ingreso (llegada de mercaderia)
            ingreso_raw = sget(row, "LLEGADA_FORZADA") if "LLEGADA_FORZADA" in cols else None
            if ingreso_raw and int(ingreso_raw or 0):
                ingreso_status = "COMPLETO"
                ingreso_date_raw = sget(row, "LLEGADA_FORZADA_FECHA") if "LLEGADA_FORZADA_FECHA" in cols else None
                ingreso_date = parse_datetime(ingreso_date_raw)
            else:
                ingreso_status = "PENDIENTE"
                ingreso_date = None

            local_name = sget(row, "LOCAL") if "LOCAL" in cols else None
            local_id = find_local_id(locals_map, local_name)

            fecha_raw = sget(row, "FACTURA_FECHA")
            factura_date = parse_date(fecha_raw)

            venc_raw = sget(row, "FECHA_VENCIMIENTO") if "FECHA_VENCIMIENTO" in cols else None
            due_date = parse_date(venc_raw)

            monto = sget(row, "MONTO_TOTAL") if "MONTO_TOTAL" in cols else None
            try:
                monto = float(monto) if monto else None
            except (TypeError, ValueError):
                monto = None

            pagado = int(sget(row, "PAGADO", 0) or 0) if "PAGADO" in cols else 0
            monto_pagado = sget(row, "MONTO_PAGADO") if "MONTO_PAGADO" in cols else None
            try:
                monto_pagado = float(monto_pagado) if monto_pagado else 0.0
            except (TypeError, ValueError):
                monto_pagado = 0.0

            es_parcial = int(sget(row, "ES_PARCIAL", 0) or 0) if "ES_PARCIAL" in cols else 0

            observations = sget(row, "OBS_PARA_COMPRAS") if "OBS_PARA_COMPRAS" in cols else None
            local_obs    = sget(row, "OBS_DE_LOCAL")     if "OBS_DE_LOCAL" in cols    else None
            compras_obs  = sget(row, "OBS_PARA_LOCALES") if "OBS_PARA_LOCALES" in cols else None

            remito_venta = sget(row, "REMITO_VENTA_NUMERO") if "REMITO_VENTA_NUMERO" in cols else None
            if remito_venta:
                remito_venta = str(remito_venta).strip() or None

            pdf_file = sget(row, "FACTURA_PDF") if "FACTURA_PDF" in cols else None

            record = {
                "number":            numero or None,
                "type":              tipo,
                "status":            semaforo,
                "date":              factura_date,
                "due_date":          due_date,
                "amount":            monto,
                "remito_venta_number": remito_venta,
                "linked_to_id":      None,
                "pdf_file":          pdf_file,
                "pdf_parsed":        False,
                "observations":      observations,
                "local_obs":         local_obs,
                "compras_obs":       compras_obs,
                "is_partial":        es_parcial == 1,
                "ingreso_status":    ingreso_status,
                "ingreso_date":      ingreso_date,
                "ingreso_photo":     sget(row, "FOTO_CONFIRMACION") if "FOTO_CONFIRMACION" in cols else None,
                "purchase_order_id": pg_order_id,
                "provider_id":       provider_id,
                "local_id":          local_id,
                "company_id":        company_id,
                "created_by_id":     created_by_id,
                "created_at":        datetime.now(),
                "updated_at":        datetime.now(),
            }

            if dry_run:
                print(C.info(
                    f"  [DRY] Would insert invoice: {numero!r} ({tipo}, {semaforo})"
                ))
                stats.inserted += 1
                if numero:
                    existing_nums.add(numero)
                continue

            try:
                pg_cur.execute(
                    """
                    INSERT INTO purchase_invoices (
                        number, type, status, date, due_date, amount,
                        remito_venta_number, linked_to_id,
                        pdf_file, pdf_parsed,
                        observations, local_obs, compras_obs,
                        is_partial, ingreso_status, ingreso_date, ingreso_photo,
                        purchase_order_id, provider_id, local_id, company_id,
                        created_by_id, created_at, updated_at
                    ) VALUES (
                        %(number)s,
                        %(type)s::purchase_invoice_type,
                        %(status)s::purchase_invoice_status,
                        %(date)s, %(due_date)s, %(amount)s,
                        %(remito_venta_number)s, %(linked_to_id)s,
                        %(pdf_file)s, %(pdf_parsed)s,
                        %(observations)s, %(local_obs)s, %(compras_obs)s,
                        %(is_partial)s,
                        %(ingreso_status)s::purchase_invoice_ingreso_status,
                        %(ingreso_date)s, %(ingreso_photo)s,
                        %(purchase_order_id)s, %(provider_id)s, %(local_id)s,
                        %(company_id)s, %(created_by_id)s,
                        %(created_at)s, %(updated_at)s
                    ) RETURNING id
                    """,
                    record,
                )
                new_invoice_id = pg_cur.fetchone()[0]
                stats.inserted += 1
                if numero:
                    existing_nums.add(numero)

                # Migrate invoice items from ITEMS_JSON
                items_json_raw = sget(row, "ITEMS_JSON") if "ITEMS_JSON" in cols else None
                if items_json_raw:
                    _migrate_invoice_items(pg_cur, new_invoice_id, items_json_raw)

                print(C.ok(f"  Invoice: {numero!r} (id={new_invoice_id}, {tipo})"))
            except Exception as e:
                pg_conn.rollback()
                stats.errors += 1
                print(C.fail(f"  Invoice {numero!r}: {e}"))
                continue

        if not dry_run:
            pg_conn.commit()

    return stats

def _migrate_invoice_items(pg_cur, invoice_id: int, items_json_raw: str):
    """Parse ITEMS_JSON and insert rows into purchase_invoice_items."""
    try:
        items = json.loads(items_json_raw)
        if not isinstance(items, list):
            return
    except (json.JSONDecodeError, TypeError):
        return

    now = datetime.now()
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            code  = item.get("codigo") or item.get("code") or item.get("CODIGO") or None
            desc  = (
                item.get("descripcion") or item.get("description")
                or item.get("DESCRIPCION") or item.get("detalle") or None
            )
            size  = item.get("talle") or item.get("size") or item.get("TALLE") or None
            color = item.get("color") or item.get("COLOR") or None
            qty_inv = int(item.get("cantidad") or item.get("qty") or item.get("CANTIDAD") or 0)
            qty_rec = int(item.get("cantidad_recibida") or item.get("qty_received") or 0)
            unit_price = _safe_float(
                item.get("precio_unitario") or item.get("unit_price")
                or item.get("PRECIO_UNITARIO")
            )
            list_price = _safe_float(
                item.get("precio_lista") or item.get("list_price")
                or item.get("PRECIO_LISTA")
            )

            pg_cur.execute(
                """
                INSERT INTO purchase_invoice_items (
                    purchase_invoice_id, code, description, size, color,
                    quantity_invoiced, quantity_received, unit_price, list_price,
                    created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    invoice_id, code, desc, size, color,
                    qty_inv, qty_rec, unit_price, list_price,
                    now, now,
                ),
            )
        except Exception:
            pass  # Best-effort: don't fail the whole invoice for a bad item line

def _safe_float(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None

# -- 4. MIGRATE PAYMENT VOUCHERS -----------------------------------------------

def migrate_payments(
    sqlite_cur: sqlite3.Cursor,
    pg_conn,
    company_id: int,
    created_by_id: int,
    dry_run: bool,
) -> Stats:
    stats = Stats("payment_vouchers")

    if not table_exists_sqlite(sqlite_cur, "COMPROBANTES_PAGO"):
        print(C.warn("Table COMPROBANTES_PAGO not found -- skipping payment_vouchers."))
        return stats

    cols = get_columns(sqlite_cur, "COMPROBANTES_PAGO")
    print(C.info(f"Detected {len(cols)} columns in COMPROBANTES_PAGO"))

    rows = sqlite_cur.execute("SELECT * FROM COMPROBANTES_PAGO ORDER BY COMP_ID").fetchall()
    stats.total = len(rows)

    with pg_conn.cursor() as pg_cur:
        pg_cur.execute(
            "SELECT number FROM payment_vouchers WHERE company_id=%s", (company_id,)
        )
        existing_nums = {r[0] for r in pg_cur.fetchall() if r[0]}

        # Build pg provider name -> id map (case-insensitive)
        pg_cur.execute(
            "SELECT id, LOWER(name) FROM providers WHERE company_id=%s", (company_id,)
        )
        prov_by_name = {r[1]: r[0] for r in pg_cur.fetchall()}

        # Build pg invoice number -> id map
        pg_cur.execute(
            "SELECT id, number FROM purchase_invoices WHERE company_id=%s AND number IS NOT NULL",
            (company_id,),
        )
        invoice_by_number = {r[1]: r[0] for r in pg_cur.fetchall()}

        for row in rows:
            numero = sget(row, "NUMERO", "")
            if numero:
                numero = str(numero).strip()

            if numero and numero in existing_nums:
                stats.skipped += 1
                continue

            fecha_raw = sget(row, "FECHA")
            pago_date = parse_date(fecha_raw) or date.today()

            monto_bruto    = zero_if_none(sget(row, "MONTO_BRUTO"))
            ret_iibb       = zero_if_none(sget(row, "RET_IIBB")       if "RET_IIBB"       in cols else 0)
            ret_ganancias  = zero_if_none(sget(row, "RET_GANANCIAS")   if "RET_GANANCIAS"  in cols else 0)
            ret_iva        = zero_if_none(sget(row, "RET_IVA")         if "RET_IVA"         in cols else 0)
            ret_suss       = zero_if_none(sget(row, "RET_SUSS")        if "RET_SUSS"       in cols else 0)
            monto_neto     = zero_if_none(sget(row, "MONTO_NETO"))

            # Resolve provider
            prov_nombre = sget(row, "PROVEEDOR_NOMBRE", "") if "PROVEEDOR_NOMBRE" in cols else ""
            provider_id = prov_by_name.get(prov_nombre.lower()) if prov_nombre else None
            if not provider_id:
                # Try by SQLite proveedor_id -> fetch name -> lookup
                src_prov_id = sget(row, "PROVEEDOR_ID") if "PROVEEDOR_ID" in cols else None
                if src_prov_id and table_exists_sqlite(sqlite_cur, "PROVEEDORES"):
                    src = sqlite_cur.execute(
                        "SELECT PROVEEDOR_NOMBRE FROM PROVEEDORES WHERE PROVEEDOR_ID=?",
                        (src_prov_id,),
                    ).fetchone()
                    if src:
                        provider_id = prov_by_name.get(src[0].lower())

            if not provider_id:
                stats.errors += 1
                print(C.fail(
                    f"  Payment {numero!r}: provider not found "
                    f"({prov_nombre!r}). Migrate providers first."
                ))
                continue

            record = {
                "number":          numero or None,
                "date":            pago_date,
                "status":          "PAGADO",  # historical records are already paid
                "amount_gross":    monto_bruto,
                "amount_iibb":     ret_iibb,
                "amount_ganancias": ret_ganancias,
                "amount_iva":      ret_iva,
                "amount_suss":     ret_suss,
                "amount_net":      monto_neto,
                "amount_paid":     monto_neto,
                "payment_date":    pago_date,
                "bank_account_id": None,
                "notes":           sget(row, "OBSERVACION") if "OBSERVACION" in cols else None,
                "pdf_file":        None,
                "provider_id":     provider_id,
                "company_id":      company_id,
                "created_by_id":   created_by_id,
                "created_at":      datetime.now(),
                "updated_at":      datetime.now(),
            }

            if dry_run:
                print(C.info(
                    f"  [DRY] Would insert payment: {numero!r} "
                    f"(gross={monto_bruto}, net={monto_neto})"
                ))
                stats.inserted += 1
                if numero:
                    existing_nums.add(numero)
                continue

            try:
                pg_cur.execute(
                    """
                    INSERT INTO payment_vouchers (
                        number, date, status, amount_gross,
                        amount_iibb, amount_ganancias, amount_iva, amount_suss,
                        amount_net, amount_paid, payment_date,
                        bank_account_id, notes, pdf_file,
                        provider_id, company_id, created_by_id,
                        created_at, updated_at
                    ) VALUES (
                        %(number)s, %(date)s,
                        %(status)s::payment_status,
                        %(amount_gross)s,
                        %(amount_iibb)s, %(amount_ganancias)s,
                        %(amount_iva)s, %(amount_suss)s,
                        %(amount_net)s, %(amount_paid)s, %(payment_date)s,
                        %(bank_account_id)s, %(notes)s, %(pdf_file)s,
                        %(provider_id)s, %(company_id)s, %(created_by_id)s,
                        %(created_at)s, %(updated_at)s
                    ) RETURNING id
                    """,
                    record,
                )
                new_voucher_id = pg_cur.fetchone()[0]
                stats.inserted += 1
                if numero:
                    existing_nums.add(numero)
                print(C.ok(f"  Payment: {numero!r} (id={new_voucher_id})"))

                # Link invoices from FACTURAS_JSON
                facturas_json_raw = sget(row, "FACTURAS_JSON") if "FACTURAS_JSON" in cols else None
                if facturas_json_raw:
                    _migrate_payment_links(
                        pg_cur, new_voucher_id, facturas_json_raw, invoice_by_number
                    )

            except Exception as e:
                pg_conn.rollback()
                stats.errors += 1
                print(C.fail(f"  Payment {numero!r}: {e}"))
                continue

        if not dry_run:
            pg_conn.commit()

    return stats

def _migrate_payment_links(
    pg_cur,
    voucher_id: int,
    facturas_json_raw: str,
    invoice_by_number: dict,
):
    """Parse FACTURAS_JSON and insert payment_invoice_links."""
    try:
        items = json.loads(facturas_json_raw)
        if not isinstance(items, list):
            return
    except (json.JSONDecodeError, TypeError):
        return

    now = datetime.now()
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            inv_num = item.get("numero") or item.get("number") or item.get("NUMERO")
            inv_id  = invoice_by_number.get(str(inv_num).strip()) if inv_num else None
            amount  = _safe_float(item.get("monto") or item.get("amount"))

            if not inv_id:
                continue

            pg_cur.execute(
                """
                INSERT INTO payment_invoice_links (
                    payment_voucher_id, purchase_invoice_id, amount, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (voucher_id, inv_id, amount, now, now),
            )
        except Exception:
            pass

# -- Main -----------------------------------------------------------------------

ALL_TABLES = ["providers", "orders", "invoices", "payments"]

def main():
    parser = argparse.ArgumentParser(
        description="Migrate CONTROL REMITOS (SQLite) -> ERP Mundo Outdoor (PostgreSQL)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be migrated without writing to PostgreSQL",
    )
    parser.add_argument(
        "--table",
        choices=ALL_TABLES + ["all"],
        default="all",
        metavar="TABLE",
        help=(
            "Migrate only a specific table. "
            f"Choices: {', '.join(ALL_TABLES)}, all (default: all)"
        ),
    )
    parser.add_argument(
        "--sqlite-path",
        default=DEFAULT_SQLITE,
        metavar="PATH",
        help=f"Path to the SQLite database (default: {DEFAULT_SQLITE})",
    )
    parser.add_argument(
        "--company-id",
        type=int,
        default=None,
        metavar="ID",
        help="company_id to assign to migrated records (default: auto-detect first company)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show debug output",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # -- Banner -----------------------------------------------------------------
    print(C.head("CONTROL REMITOS -> ERP Mundo Outdoor -- Data Migration"))
    if args.dry_run:
        print(C.warn("DRY RUN MODE -- no data will be written to PostgreSQL\n"))

    # -- Validate SQLite --------------------------------------------------------
    sqlite_path = Path(args.sqlite_path)
    if not sqlite_path.exists():
        print(C.fail(f"SQLite file not found: {sqlite_path}"))
        print(C.info(f"Checked path: {sqlite_path.resolve()}"))
        print(C.info("Override with: --sqlite-path <path>"))
        sys.exit(1)

    print(C.ok(f"SQLite source: {sqlite_path}"))
    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    # Print available source tables
    src_tables = sqlite_cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    print(C.info(f"Source tables: {[t[0] for t in src_tables]}"))

    # -- Connect PostgreSQL -----------------------------------------------------
    print(C.info(f"Connecting to PostgreSQL @ {PG_CONFIG['host']}:{PG_CONFIG['port']}..."))
    try:
        pg_conn = pg_connect()
        pg_conn.autocommit = False
    except Exception as e:
        print(C.fail(f"PostgreSQL connection failed: {e}"))
        sys.exit(1)
    print(C.ok("PostgreSQL connected"))

    with pg_conn.cursor() as cur:
        company_id    = get_company_id(cur, args.company_id if args.company_id else 1)
        created_by_id = get_admin_user_id(cur)

    print(C.ok(f"Using company_id={company_id}, created_by_id={created_by_id}"))

    # -- Run migrations ---------------------------------------------------------
    do_all       = args.table == "all"
    all_stats    = []
    order_id_map = {}

    if do_all or args.table == "providers":
        print(C.head("1/4 -- Providers"))
        st = migrate_providers(sqlite_cur, pg_conn, company_id, args.dry_run)
        all_stats.append(st)

    if do_all or args.table == "orders":
        print(C.head("2/4 -- Purchase Orders (Notas de Pedido)"))
        if not order_id_map:
            # Build order_id_map from existing PG data (for partial runs)
            with pg_conn.cursor() as cur:
                # We can't reverse-map perfectly without storing source IDs,
                # so just run and accumulate
                pass
        st, order_id_map = migrate_purchase_orders(
            sqlite_cur, pg_conn, company_id, created_by_id, args.dry_run
        )
        all_stats.append(st)

    if do_all or args.table == "invoices":
        print(C.head("3/4 -- Purchase Invoices (Facturas/Remitos)"))
        if not order_id_map:
            print(C.warn(
                "order_id_map is empty. Run orders migration first, or use --table all. "
                "Invoices without a matching order will be skipped."
            ))
        st = migrate_invoices(
            sqlite_cur, pg_conn, company_id, created_by_id, order_id_map, args.dry_run
        )
        all_stats.append(st)

    if do_all or args.table == "payments":
        print(C.head("4/4 -- Payment Vouchers (Comprobantes de Pago)"))
        st = migrate_payments(
            sqlite_cur, pg_conn, company_id, created_by_id, args.dry_run
        )
        all_stats.append(st)

    # -- Summary report ---------------------------------------------------------
    print(C.head("Migration Summary"))
    total_inserted = total_skipped = total_errors = total_src = 0
    for st in all_stats:
        st.report()
        total_inserted += st.inserted
        total_skipped  += st.skipped
        total_errors   += st.errors
        total_src      += st.total

    print()
    print(
        f"  {C.BOLD}TOTAL{C.RESET}: "
        f"{C.GREEN}{total_inserted} inserted{C.RESET}, "
        f"{C.YELLOW}{total_skipped} skipped{C.RESET}, "
        f"{C.RED}{total_errors} errors{C.RESET} "
        f"(of {total_src} source records)"
    )

    if args.dry_run:
        print(C.warn("\nDRY RUN -- no data was written. Re-run without --dry-run to apply."))
    elif total_errors == 0:
        print(C.ok("\nMigration completed successfully."))
    else:
        print(C.warn(f"\nMigration completed with {total_errors} error(s). Review output above."))

    sqlite_conn.close()
    pg_conn.close()
    sys.exit(1 if total_errors > 0 else 0)


if __name__ == "__main__":
    main()
