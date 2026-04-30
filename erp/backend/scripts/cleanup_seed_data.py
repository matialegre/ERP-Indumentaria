"""
cleanup_seed_data.py

Limpia datos basura / duplicados en el ERP:

  1. Borra las 5 notas de pedido seed (MIDING S-001..005) — tienen 0 items
     y vinculan a locales que no existen en la lista real.
  2. Borra 16 locales contaminados, dejando los 11 reales
     (IDs 28, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43).
  3. Renombra ID 28 "Mundo Palermo" → "Mundo Outdoor Palermo" (canónico).
  4. Deduplica Miding (CUIT 30708565594): 5 rows + 1 row con CUIT NULL
     se colapsan en ID 314. Copia legal_name de ID 380 antes de borrar.
  5. Deduplica Montagne (CUIT 30522982225): 5 rows se colapsan en ID 321
     (que ya tiene 1 payment_voucher apuntándolo).
  6. Deduplica Himeba (287 → 286) y Bahia Blanca Plaza Shopping (210 → 209).

Uso:

    python cleanup_seed_data.py --dry-run    # BEGIN + SQL + verify + ROLLBACK
    python cleanup_seed_data.py --apply      # BEGIN + SQL + verify + COMMIT

Antes de tocar nada se exporta pg_dump --data-only de las tablas afectadas
a erp/backend/scripts/backups/cleanup_YYYYMMDD_HHMMSS.sql
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Force UTF-8 stdout on Windows (default cp1252 chokes on accents)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import psycopg2

# ───────────────────────── Config ─────────────────────────

DB_HOST = "localhost"
DB_PORT = 2048
DB_NAME = "erp_mundooutdoor"
DB_USER = "erp_user"
DB_PASS = "MundoOutdoor2026!"

PG_DUMP_CANDIDATES = [
    r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
    r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "pg_dump",
]

BACKUP_TABLES = [
    "locals",
    "providers",
    "purchase_orders",
    "purchase_order_items",
    "purchase_invoices",
]

# ───────────────────────── SQL ─────────────────────────

CLEANUP_SQL = """
-- 1. Borrar las 5 notas de pedido seed (y sus items si hubiera)
DELETE FROM purchase_order_items
 WHERE purchase_order_id IN (116, 117, 118, 119, 120);

DELETE FROM purchase_orders
 WHERE id IN (116, 117, 118, 119, 120);

-- 2. Borrar locales contaminados (FKs a seed orders ya liberados)
DELETE FROM locals
 WHERE id IN (19, 20, 21, 22, 23, 24, 25, 26, 27,
              29, 30, 31, 32, 33, 44, 45);

-- 3. Renombrar ID 28 al nombre canónico
UPDATE locals
   SET name = 'Mundo Outdoor Palermo'
 WHERE id = 28;

-- 4. Fusionar Miding (CUIT 30708565594):
--    copiar legal_name del ID 380 al ganador 314, renombrar, borrar duplicados
UPDATE providers
   SET legal_name = 'MIDING S.R.L.',
       name = 'Miding S.R.L'
 WHERE id = 314;

DELETE FROM providers
 WHERE id IN (315, 316, 317, 318, 380);

-- 5. Fusionar Montagne (CUIT 30522982225):
--    el ganador 321 ya es referenciado por payment_vouchers, solo renombrar
UPDATE providers
   SET name = 'Montagne Outdoors S.A'
 WHERE id = 321;

DELETE FROM providers
 WHERE id IN (322, 323, 324, 325);

-- 6. Fusionar Himeba (CUIT 30592711857): conservar 286, borrar 287
DELETE FROM providers WHERE id = 287;

-- 7. Fusionar Bahia Blanca Plaza Shopping (CUIT 30688117417):
--    conservar 209, borrar 210
DELETE FROM providers WHERE id = 210;
"""

# (label, sql, expected_value) — si alguno falla, ROLLBACK
VERIFY_QUERIES: list[tuple[str, str, int]] = [
    (
        "locals total == 11",
        "SELECT COUNT(*) FROM locals;",
        11,
    ),
    (
        "Miding + Montagne deduplicados == 2",
        "SELECT COUNT(*) FROM providers "
        "WHERE cuit IN ('30708565594', '30522982225');",
        2,
    ),
    (
        "purchase_orders vacío == 0",
        "SELECT COUNT(*) FROM purchase_orders;",
        0,
    ),
    (
        "Himeba dedup (CUIT 30592711857) == 1",
        "SELECT COUNT(*) FROM providers WHERE cuit = '30592711857';",
        1,
    ),
    (
        "Bahia Blanca Plaza Shopping dedup (CUIT 30688117417) == 1",
        "SELECT COUNT(*) FROM providers WHERE cuit = '30688117417';",
        1,
    ),
    (
        "ID 28 renombrado a 'Mundo Outdoor Palermo'",
        "SELECT COUNT(*) FROM locals "
        "WHERE id = 28 AND name = 'Mundo Outdoor Palermo';",
        1,
    ),
]

# ───────────────────────── Helpers ─────────────────────────


def find_pg_dump() -> str:
    for candidate in PG_DUMP_CANDIDATES:
        if candidate == "pg_dump" or Path(candidate).exists():
            return candidate
    raise RuntimeError(
        "pg_dump no encontrado. Instalá PostgreSQL client o ajustá PG_DUMP_CANDIDATES."
    )


def do_backup() -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(__file__).parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    backup_file = backup_dir / f"cleanup_{ts}.sql"

    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASS

    cmd = [
        find_pg_dump(),
        "-h", DB_HOST,
        "-p", str(DB_PORT),
        "-U", DB_USER,
        "-d", DB_NAME,
        "--data-only",
        "--no-owner",
        "--no-privileges",
    ]
    for t in BACKUP_TABLES:
        cmd.extend(["-t", t])

    print(f"[backup] pg_dump -> {backup_file.name}")
    with backup_file.open("w", encoding="utf-8") as fh:
        result = subprocess.run(
            cmd, env=env, stdout=fh, stderr=subprocess.PIPE, text=True
        )

    if result.returncode != 0:
        backup_file.unlink(missing_ok=True)
        raise RuntimeError(f"pg_dump falló: {result.stderr.strip()}")

    size = backup_file.stat().st_size
    print(f"[backup] OK - {backup_file} ({size:,} bytes)")
    return backup_file


def run_cleanup(apply_changes: bool) -> None:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
    )
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("[sql]  ejecutando cleanup SQL (en transacción)...")
        cur.execute(CLEANUP_SQL)

        print("[verify] corriendo queries de verificación:")
        all_ok = True
        for label, query, expected in VERIFY_QUERIES:
            cur.execute(query)
            got = cur.fetchone()[0]
            ok = got == expected
            tag = "OK  " if ok else "FAIL"
            print(f"  [{tag}] {label}  (got={got}, expected={expected})")
            if not ok:
                all_ok = False

        cur.execute("SELECT id, name FROM locals ORDER BY name;")
        print("[verify] locals finales:")
        for lid, name in cur.fetchall():
            print(f"    {lid:>3}  {name}")

        cur.execute(
            "SELECT id, name, cuit FROM providers "
            "WHERE cuit IN ('30708565594','30522982225','30592711857','30688117417') "
            "ORDER BY cuit, id;"
        )
        print("[verify] providers deduplicados:")
        for pid, name, cuit in cur.fetchall():
            print(f"    {pid:>3}  {cuit}  {name}")

        if not all_ok:
            conn.rollback()
            print("[done] verificacion FALLO -> ROLLBACK. No se cambio nada.")
            sys.exit(1)

        if apply_changes:
            conn.commit()
            print("[done] verificacion OK -> COMMIT aplicado.")
        else:
            conn.rollback()
            print("[done] verificacion OK -> ROLLBACK (dry-run). Nada persistido.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ───────────────────────── Entry point ─────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--dry-run",
        action="store_true",
        help="Correr en transacción y hacer ROLLBACK al final.",
    )
    group.add_argument(
        "--apply",
        action="store_true",
        help="Correr en transacción y COMMIT si verificación OK.",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="No correr pg_dump antes (útil en dry-run repetitivo).",
    )
    args = parser.parse_args()

    if not args.skip_backup:
        do_backup()
    else:
        print("[backup] saltado por --skip-backup")

    run_cleanup(apply_changes=args.apply)


if __name__ == "__main__":
    main()
