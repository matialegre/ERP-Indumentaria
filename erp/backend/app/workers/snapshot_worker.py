"""
Worker que sincroniza tablas SQL Server -> Postgres local cada 15 minutos.

Tablas sincronizadas (usadas por el módulo Informes):
  VENTAS, ARTICULOS, STOCKS, FICHACOMPRO, VENTAS_MERCADOLIBRE, MEDIOS_PAGOS

Estrategia: FULL RELOAD por tabla (TRUNCATE + bulk insert via COPY FROM STDIN).
Performance estimada: <2 min para todas las tablas (~1.4M filas).

Puede correrse:
  - Standalone: python snapshot_worker.py [--once] [--interval 900]
  - Como thread del backend (start_worker_thread() en main.py)
"""
from __future__ import annotations
import os
import sys
import time
import io
import logging
import argparse
import threading
from datetime import datetime
from typing import Optional

import pyodbc
import psycopg2

# ── Config ───────────────────────────────────────────────────────────────────
SRC_CONN_STR = (
    "DRIVER={SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126"
)
PG_DSN = dict(
    host="localhost", port=2048,
    user="postgres", password="0896",
    dbname="informes_snapshot",
    client_encoding="UTF8",
)
TABLES = ["VENTAS", "ARTICULOS", "STOCKS", "FICHACOMPRO", "VENTAS_MERCADOLIBRE", "MEDIOS_PAGOS"]
DEFAULT_INTERVAL = 15 * 60  # 15 min
BATCH_SIZE = 10_000

logger = logging.getLogger("snapshot_worker")


# ── Helpers ──────────────────────────────────────────────────────────────────
def _get_src_conn():
    return pyodbc.connect(SRC_CONN_STR, timeout=30)


def _get_pg_conn():
    os.environ.setdefault("PGCLIENTENCODING", "UTF8")
    return psycopg2.connect(**PG_DSN)


def _format_value(v) -> str:
    """Convierte un valor Python a representación COPY-safe (NULL como \\N, escapes tab/newline/backslash)."""
    if v is None:
        return r"\N"
    if isinstance(v, bool):
        return "t" if v else "f"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat(sep=" ")
    s = str(v)
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def _sync_table(src_cur, pg_conn, table: str) -> tuple[int, int]:
    """Sincroniza una tabla. Retorna (rows_synced, duration_ms)."""
    pg_table = table.lower()
    t0 = time.perf_counter()

    pcur = pg_conn.cursor()
    pcur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name=%s AND table_schema='public' ORDER BY ordinal_position",
        (pg_table,),
    )
    pg_cols = [r[0] for r in pcur.fetchall()]
    if not pg_cols:
        raise RuntimeError(f"Tabla {pg_table} no existe en Postgres")
    quoted_cols = ", ".join(f'"{c}"' for c in pg_cols)

    src_cols_sql = ", ".join(f"[{c}]" for c in pg_cols)
    src_cur.execute(f"SELECT {src_cols_sql} FROM {table}")

    pcur.execute(f'TRUNCATE TABLE "{pg_table}"')

    rows_synced = 0
    while True:
        rows = src_cur.fetchmany(BATCH_SIZE)
        if not rows:
            break
        buf = io.StringIO()
        for row in rows:
            buf.write("\t".join(_format_value(v) for v in row))
            buf.write("\n")
        buf.seek(0)
        pcur.copy_expert(
            f'COPY "{pg_table}" ({quoted_cols}) FROM STDIN WITH (FORMAT text)',
            buf,
        )
        rows_synced += len(rows)
        logger.debug(f"  {table}: {rows_synced:,} filas...")

    pg_conn.commit()
    dur_ms = int((time.perf_counter() - t0) * 1000)
    return rows_synced, dur_ms


def _record_sync(pg_conn, table: str, rows: int, dur_ms: int, status: str, err: Optional[str] = None):
    pcur = pg_conn.cursor()
    pcur.execute(
        """
        INSERT INTO _meta_sync (table_name, last_sync, rows_synced, duration_ms, status, error_message)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (table_name) DO UPDATE SET
            last_sync = EXCLUDED.last_sync,
            rows_synced = EXCLUDED.rows_synced,
            duration_ms = EXCLUDED.duration_ms,
            status = EXCLUDED.status,
            error_message = EXCLUDED.error_message
        """,
        (table, datetime.now(), rows, dur_ms, status, err),
    )
    pg_conn.commit()


def run_sync_once() -> dict:
    """Ejecuta una sincronización completa. Retorna resumen."""
    summary = {"started_at": datetime.now().isoformat(), "tables": [], "ok": True, "total_ms": 0}
    t0 = time.perf_counter()

    src_conn = None
    pg_conn = None
    try:
        logger.info("Conectando a SQL Server remoto...")
        src_conn = _get_src_conn()
        src_cur = src_conn.cursor()
        logger.info("Conectando a Postgres local...")
        pg_conn = _get_pg_conn()

        for table in TABLES:
            try:
                logger.info(f"Sincronizando {table}...")
                rows, dur_ms = _sync_table(src_cur, pg_conn, table)
                _record_sync(pg_conn, table, rows, dur_ms, "ok")
                logger.info(f"  -> {table}: {rows:,} filas en {dur_ms}ms")
                summary["tables"].append({"table": table, "rows": rows, "duration_ms": dur_ms, "status": "ok"})
            except Exception as e:
                logger.exception(f"Error sincronizando {table}")
                try:
                    _record_sync(pg_conn, table, 0, 0, "error", str(e)[:500])
                except Exception:
                    pass
                summary["tables"].append({"table": table, "status": "error", "error": str(e)[:200]})
                summary["ok"] = False
    finally:
        if src_conn:
            src_conn.close()
        if pg_conn:
            pg_conn.close()

    summary["total_ms"] = int((time.perf_counter() - t0) * 1000)
    summary["finished_at"] = datetime.now().isoformat()
    logger.info(f"Sync completo en {summary['total_ms']}ms (ok={summary['ok']})")
    return summary


# ── Loop ─────────────────────────────────────────────────────────────────────
_thread: Optional[threading.Thread] = None
_stop_event: Optional[threading.Event] = None


def _loop(interval: int, stop_event: threading.Event):
    while not stop_event.is_set():
        try:
            run_sync_once()
        except Exception:
            logger.exception("Error en ciclo de sync")
        for _ in range(interval):
            if stop_event.is_set():
                return
            time.sleep(1)


def start_worker_thread(interval: int = DEFAULT_INTERVAL) -> bool:
    """Inicia el worker en un thread daemon. Si ya está corriendo no hace nada."""
    global _thread, _stop_event
    if _thread and _thread.is_alive():
        return False
    _stop_event = threading.Event()
    _thread = threading.Thread(target=_loop, args=(interval, _stop_event), daemon=True, name="snapshot-worker")
    _thread.start()
    logger.info(f"Worker snapshot iniciado (intervalo={interval}s)")
    return True


def stop_worker_thread():
    global _stop_event, _thread
    if _stop_event:
        _stop_event.set()
    _thread = None


# ── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Hacer una sola sincronización y salir")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL, help="Intervalo en segundos (default 900)")
    args = parser.parse_args()

    if args.once:
        summary = run_sync_once()
        ok = summary["ok"]
        print("\n=== RESUMEN ===")
        for t in summary["tables"]:
            print(f"  {t}")
        print(f"Total: {summary['total_ms']}ms  ok={ok}")
        sys.exit(0 if ok else 1)
    else:
        evt = threading.Event()
        try:
            _loop(args.interval, evt)
        except KeyboardInterrupt:
            evt.set()
            print("\nDetenido por el usuario.")
