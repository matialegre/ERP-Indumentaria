"""
import_cajas_legacy.py

Importa movimientos legacy de SQL Server (DATOS.CAJAS) a la tabla
caja_movimientos del ERP nuevo.

Solo trae **gastos / retiros / traspasos**. NO trae ventas POS
(`Cobro de Factura de ventas`, `Sobrante`, `Faltante`, etc).

Mapeo:
- CAJAS.LOCAL (string code) → caja_id (vía ciudad del local en PG)
- DescripcionMovimiento → tipo del movimiento nuevo
- ABS(MCImporte) → monto (el signo lo aplica el tipo de movimiento)
- estado: ACEPTADO (estos ya fueron auditados en producción legacy)

Uso:
    python import_cajas_legacy.py --dry-run
    python import_cajas_legacy.py --apply
    python import_cajas_legacy.py --apply --since 2026-01-01
    python import_cajas_legacy.py --apply --reset    # borra todo y re-importa

CUIDADO: --reset trunca caja_movimientos antes de importar.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone
from pathlib import Path

# Force UTF-8 stdout on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import psycopg2
import pyodbc

# ─── Config ────────────────────────────────────────────────────────────

SRC_CONN = (
    "DRIVER={SQL Server};SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126"
)
PG_DSN = dict(
    host="localhost", port=2048, dbname="erp_mundooutdoor",
    user="erp_user", password="MundoOutdoor2026!", client_encoding="UTF8",
)

# CAJAS.LOCAL → ciudad PG  (Cordoba se omite — no hay caja para MTGCBA)
LOCAL_TO_CIUDAD = {
    "DEPOSITO":  "BAHIA BLANCA",
    "MONBAHIA":  "BAHIA BLANCA",
    "MTGBBPS":   "BAHIA BLANCA",
    "MUNDOAL":   "BAHIA BLANCA",
    "MUNDOBBPS": "BAHIA BLANCA",
    "MTGCOM":    "NEUQUEN",
    "NQNALB":    "NEUQUEN",
    "NQNSHOP":   "NEUQUEN",
    "MTGROCA":   "ROCA",
    "MUNDOROCA": "ROCA",
    "MTGJBJ":    "MAR DEL PLATA",
    "MTGMDQ":    "MAR DEL PLATA",
    "MUNDOCAB":  "CABA",
    # MTGCBA → CORDOBA (no hay caja, se omite)
}

# CAJAS.LOCAL → locals.code en PG (algunos difieren por truncamiento)
LOCAL_TO_PG_CODE = {
    "DEPOSITO":  "DEPOSITO",
    "MONBAHIA":  "MONBAHIA",
    "MTGBBPS":   "MTGBBPS",
    "MUNDOAL":   "MUNDOAL",
    "MUNDOBBPS": "MUNDOBBPS",
    "MTGCOM":    "MTGCOM",
    "NQNALB":    "NQNALB",
    "NQNSHOP":   "NQNSHOP",
    "MTGROCA":   "MTGROCA",
    "MUNDOROCA": "MUNDOROC",   # <- truncado en PG
    "MTGJBJ":    "MTGJBJ",
    "MTGMDQ":    "MDQ",         # <- nombre simple en PG
    "MUNDOCAB":  "MUNDOCAB",
}

# DescripcionMovimiento → tipo nuevo
DESC_TO_TIPO = {
    # EGRESO_GASTO
    "RETIRO DE EFECTIVO":                   "EGRESO_GASTO",
    "RETIRO DE DINERO":                     "EGRESO_GASTO",
    "RETIRO DOLARES":                       "EGRESO_GASTO",
    "COMPRAS":                              "EGRESO_GASTO",
    "COMPRAS Y GASTOS VARIOS":              "EGRESO_GASTO",
    "GASTOS VARIOS":                        "EGRESO_GASTO",
    "CADETE":                               "EGRESO_GASTO",
    "Pago de resúmenes C/C":                "EGRESO_GASTO",
    # TRASPASO_OUT
    "Transferencia a otra caja":            "TRASPASO_OUT",
    "ENVIO DE DINERO A OTRA CAJA":          "TRASPASO_OUT",
    "ENVIO DE DINERO A CAJA TESORO":        "TRASPASO_OUT",
    "ENVIO DE DINERO":                      "TRASPASO_OUT",
    # TRASPASO_IN
    "Aportes de otra caja":                 "TRASPASO_IN",
    "Aportes de otra caja sin justificar":  "TRASPASO_IN",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    parser.add_argument("--since", default=None,
                        help="Solo importar desde esta fecha (YYYY-MM-DD)")
    parser.add_argument("--reset", action="store_true",
                        help="DELETE FROM caja_movimientos antes de importar")
    parser.add_argument("--estado", default="ACEPTADO",
                        choices=["PENDIENTE", "ACEPTADO"],
                        help="Estado para los movimientos importados")
    args = parser.parse_args()

    # Conexiones
    src = pyodbc.connect(SRC_CONN, timeout=30)
    src_cur = src.cursor()
    pg = psycopg2.connect(**PG_DSN)
    pg.autocommit = False
    pg_cur = pg.cursor()

    # Resolver caja_id por ciudad
    pg_cur.execute("SELECT id, ciudad FROM cajas")
    caja_id_by_ciudad = {ciudad: cid for cid, ciudad in pg_cur.fetchall()}
    print(f"[init] cajas en PG: {len(caja_id_by_ciudad)} ({list(caja_id_by_ciudad)})")

    # Resolver local_id por code
    pg_cur.execute("SELECT id, code FROM locals WHERE code IS NOT NULL")
    local_id_by_code = {code: lid for lid, code in pg_cur.fetchall()}
    print(f"[init] locals en PG: {len(local_id_by_code)}")

    # Resolver company_id + admin user (creator)
    pg_cur.execute("SELECT id FROM companies ORDER BY id LIMIT 1")
    company_id = pg_cur.fetchone()[0]
    pg_cur.execute("SELECT id FROM users WHERE role IN ('SUPERADMIN','ADMIN') ORDER BY id LIMIT 1")
    admin_id = pg_cur.fetchone()[0]
    print(f"[init] company_id={company_id} admin_id={admin_id}")

    # Reset si --reset
    if args.reset:
        print("[reset] DELETE FROM caja_movimientos...")
        pg_cur.execute("DELETE FROM caja_movimientos")
        print(f"[reset] {pg_cur.rowcount} filas borradas")

    # Query de origen
    descripciones = list(DESC_TO_TIPO.keys())
    placeholders = ",".join("?" for _ in descripciones)
    sql = f"""
        SELECT LOCAL, FechaActualizacion, DescripcionMovimiento, MCImporte, FPCodigo, Id
        FROM CAJAS
        WHERE DescripcionMovimiento IN ({placeholders})
    """
    params = list(descripciones)
    if args.since:
        sql += " AND FechaActualizacion >= ?"
        params.append(args.since)
    sql += " ORDER BY FechaActualizacion ASC"

    print(f"[query] descripciones filtradas: {len(descripciones)}")
    if args.since:
        print(f"[query] desde: {args.since}")
    src_cur.execute(sql, params)

    # Procesar batch
    aceptado_at = datetime.now(timezone.utc) if args.estado == "ACEPTADO" else None
    inserted = 0
    skipped = 0
    skip_reasons: dict[str, int] = {}

    INSERT_SQL = """
        INSERT INTO caja_movimientos
        (caja_id, fecha, tipo, local_id, monto, motivo, estado,
         aceptado_por_id, aceptado_at, created_by_id, company_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
    """

    for row in src_cur.fetchall():
        local_code, fecha, desc, importe, fp, src_id = row
        local_code = (local_code or "").strip()
        ciudad = LOCAL_TO_CIUDAD.get(local_code)
        if not ciudad:
            skipped += 1
            skip_reasons[f"local sin ciudad: {local_code}"] = skip_reasons.get(f"local sin ciudad: {local_code}", 0) + 1
            continue
        caja_id = caja_id_by_ciudad.get(ciudad)
        if not caja_id:
            skipped += 1
            skip_reasons[f"ciudad sin caja: {ciudad}"] = skip_reasons.get(f"ciudad sin caja: {ciudad}", 0) + 1
            continue
        local_id = local_id_by_code.get(LOCAL_TO_PG_CODE.get(local_code, ""))
        tipo = DESC_TO_TIPO.get(desc)
        if not tipo:
            skipped += 1
            continue
        monto = abs(float(importe or 0))
        if monto == 0:
            skipped += 1
            continue
        motivo = f"[Legacy {src_id}] {desc}"
        if fp:
            motivo += f" (FP: {fp})"

        if isinstance(fecha, str):
            fecha_d = datetime.fromisoformat(fecha.split(" ")[0]).date() if "-" in fecha else datetime.strptime(fecha[:10], "%Y-%m-%d").date()
        elif hasattr(fecha, "date"):
            fecha_d = fecha.date()
        else:
            fecha_d = fecha
        pg_cur.execute(INSERT_SQL, (
            caja_id, fecha_d, tipo, local_id, monto, motivo,
            args.estado,
            admin_id if args.estado == "ACEPTADO" else None,
            aceptado_at,
            admin_id, company_id,
        ))
        inserted += 1
        if inserted % 500 == 0:
            print(f"[progress] {inserted} insertados...")

    print(f"\n[stats] insertados: {inserted}")
    print(f"[stats] skipped: {skipped}")
    if skip_reasons:
        print("[stats] skip detail:")
        for k, v in sorted(skip_reasons.items(), key=lambda x: -x[1]):
            print(f"    {k}: {v}")

    # Verificación post-import
    pg_cur.execute("""
        SELECT c.ciudad, COUNT(*) FROM caja_movimientos m
        JOIN cajas c ON c.id = m.caja_id
        GROUP BY c.ciudad ORDER BY c.ciudad
    """)
    print("\n[verify] movimientos por ciudad (incluye los preexistentes):")
    for row in pg_cur.fetchall():
        print(f"    {row[0]:<15} {row[1]}")

    if args.apply:
        pg.commit()
        print("\n[done] COMMIT aplicado.")
    else:
        pg.rollback()
        print("\n[done] dry-run → ROLLBACK. Nada persistido.")

    src.close()
    pg.close()


if __name__ == "__main__":
    main()
