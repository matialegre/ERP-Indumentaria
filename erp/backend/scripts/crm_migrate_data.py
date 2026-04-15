"""
CRM Data Migration — Migra datos del CRM standalone (SQLite) al ERP (PostgreSQL).

Uso:
  cd erp/backend
  python scripts/crm_migrate_data.py \
    --sqlite-path "D:/ERP MUNDO OUTDOOR/CRM/BACKEND/crm.db" \
    --company-id <UUID>

IMPORTANTE: Ejecutar DESPUÉS de haber corrido la migración Alembic.
"""

import argparse
import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.config import get_settings

settings = get_settings()
pg_engine = create_engine(settings.DATABASE_URL)


def ts_to_dt(unix_ts):
    if unix_ts is None:
        return None
    try:
        return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc)
    except (ValueError, TypeError, OSError):
        return None


def migrate_contacts(sqlite_cur, pg_session, company_id):
    sqlite_cur.execute("SELECT * FROM contacts")
    rows = sqlite_cur.fetchall()
    cols = [d[0] for d in sqlite_cur.description]
    count = 0

    for row in rows:
        r = dict(zip(cols, row))
        existing = pg_session.execute(
            text("SELECT id FROM customers WHERE company_id = :cid AND email = :email"),
            {"cid": company_id, "email": r.get("email", "")}
        ).fetchone()

        if existing:
            pg_session.execute(
                text("""
                    UPDATE customers SET
                        club_mundo = :club, tier = :tier, points = :points,
                        orders_count = :orders, total_spent = :spent
                    WHERE id = :id
                """),
                {
                    "id": existing[0],
                    "club": r.get("club_mundo", False),
                    "tier": r.get("tier", "standard"),
                    "points": r.get("points", 0),
                    "orders": r.get("orders_count", 0),
                    "spent": r.get("total_spent", 0),
                }
            )
        else:
            pg_session.execute(
                text("""
                    INSERT INTO customers (id, company_id, name, email, phone,
                        club_mundo, tier, points, orders_count, total_spent)
                    VALUES (:id, :cid, :name, :email, :phone,
                        :club, :tier, :points, :orders, :spent)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "cid": company_id,
                    "name": r.get("name", ""),
                    "email": r.get("email", ""),
                    "phone": r.get("phone", ""),
                    "club": r.get("club_mundo", False),
                    "tier": r.get("tier", "standard"),
                    "points": r.get("points", 0),
                    "orders": r.get("orders_count", 0),
                    "spent": r.get("total_spent", 0),
                }
            )
        count += 1

    print(f"  📇 Contacts migrados: {count}")
    return count


def migrate_table(sqlite_cur, pg_session, company_id, table_from, table_to, field_map):
    sqlite_cur.execute(f"SELECT * FROM {table_from}")
    rows = sqlite_cur.fetchall()
    cols = [d[0] for d in sqlite_cur.description]
    count = 0

    for row in rows:
        r = dict(zip(cols, row))
        pg_data = {"id": str(uuid.uuid4()), "company_id": company_id}

        for pg_col, (sqlite_col, converter) in field_map.items():
            val = r.get(sqlite_col)
            if converter:
                val = converter(val)
            pg_data[pg_col] = val

        placeholders = ", ".join(f":{k}" for k in pg_data)
        columns = ", ".join(pg_data.keys())
        pg_session.execute(
            text(f"INSERT INTO {table_to} ({columns}) VALUES ({placeholders})"),
            pg_data
        )
        count += 1

    print(f"  📦 {table_from} → {table_to}: {count} registros")
    return count


def main(sqlite_path: str, company_id: str):
    if not os.path.exists(sqlite_path):
        print(f"ERROR: No se encontró {sqlite_path}")
        sys.exit(1)

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_cur = sqlite_conn.cursor()

    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in sqlite_cur.fetchall()]
    print(f"📊 Tablas en SQLite: {', '.join(tables)}")

    with Session(pg_engine) as pg_session:
        try:
            if "contacts" in tables:
                migrate_contacts(sqlite_cur, pg_session, company_id)

            if "conversations" in tables:
                migrate_table(sqlite_cur, pg_session, company_id,
                    "conversations", "crm_conversations", {
                        "channel": ("channel", None),
                        "status": ("status", None),
                        "created_at": ("created_at", ts_to_dt),
                    })

            if "campaigns" in tables:
                migrate_table(sqlite_cur, pg_session, company_id,
                    "campaigns", "crm_campaigns", {
                        "name": ("name", None),
                        "channel": ("channel", None),
                        "status": ("status", None),
                        "subject": ("subject", None),
                        "body": ("body", None),
                        "scheduled_at": ("scheduled_at", ts_to_dt),
                    })

            pg_session.commit()
            print(f"\n🎉 Migración completada para company {company_id}")

        except Exception as e:
            pg_session.rollback()
            print(f"\n❌ Error durante migración: {e}")
            raise
        finally:
            sqlite_conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate CRM SQLite → PostgreSQL")
    parser.add_argument("--sqlite-path", required=True, help="Path al .db del CRM")
    parser.add_argument("--company-id", required=True, help="UUID de la company destino")
    args = parser.parse_args()
    main(args.sqlite_path, args.company_id)
