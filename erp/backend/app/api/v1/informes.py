"""
informes.py — Módulo de Informes completo
=========================================
Ejecuta reportes contra SQL Server (192.168.0.109:9970 / DATOS).
Acceso restringido a ADMIN, SUPERADMIN y MEGAADMIN.
"""

from datetime import date, timedelta
from typing import Optional, Any

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user, require_roles
from app.models.user import User, UserRole

# ── Conexión SQL Server ────────────────────────────────────────────────────────

# Postgres local snapshot (sincronizado cada 15 min desde SQL Server por snapshot_worker)
_PG_DSN = (
    "host=localhost port=2048 dbname=informes_snapshot "
    "user=erp_user password=MundoOutdoor2026!"
)


def _get_conn():
    try:
        import psycopg2
        return psycopg2.connect(_PG_DSN, client_encoding="UTF8")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Postgres snapshot no disponible: {exc}")


def _mes_actual() -> tuple[date, date]:
    hoy = date.today()
    return hoy.replace(day=1), hoy


def _parse_fechas(desde: Optional[str], hasta: Optional[str]) -> tuple[date, date]:
    if desde and hasta:
        try:
            return date.fromisoformat(desde), date.fromisoformat(hasta)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")
    return _mes_actual()


def _rows_to_dicts(cursor) -> list[dict]:
    # Postgres devuelve identificadores unquoted en minúsculas.
    # Mantenemos compat con el frontend forzando UPPER.
    cols = [c[0].upper() for c in cursor.description]
    rows = cursor.fetchall()
    result = []
    for row in rows:
        d = {}
        for i, col in enumerate(cols):
            val = row[i]
            if hasattr(val, 'isoformat'):
                val = val.isoformat()[:10]
            elif isinstance(val, float):
                val = round(val, 2)
            from decimal import Decimal
            if isinstance(val, Decimal):
                val = float(val)
                val = round(val, 2)
            d[col] = val
        result.append(d)
    return result


def _locales_clause(csv: Optional[str], col_sql: str) -> tuple[str, list]:
    """
    Construye un fragmento SQL para filtrar por uno o múltiples locales.
    - csv: "Local1,Local2" o None/""
    - col_sql: expresión SQL de la columna de local, ej. "REPLACE(LOCAL,'DRAGONFISH_','')"
    Devuelve (sql_fragment, params_list). Si no hay filtro, devuelve ("1=1", []).
    """
    if not csv or not csv.strip():
        return ("1=1", [])
    vals = [v.strip() for v in csv.split(",") if v.strip()]
    if not vals:
        return ("1=1", [])
    placeholders = ",".join(["%s"] * len(vals))
    return (f"{col_sql} IN ({placeholders})", vals)


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/informes", tags=["Informes"])

_ADMIN_ROLES = [UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION]


# ── Snapshot status (info de la "foto" local SQL Server -> Postgres) ─────────

@router.get("/snapshot-status")
def snapshot_status(current_user: User = Depends(get_current_user)):
    """Devuelve info del último sync del snapshot local.

    Returns:
        { last_sync_at: ISO|None, oldest_sync_at: ISO|None, tables: [...], all_ok: bool }
    """
    try:
        conn = _get_conn()
    except HTTPException:
        return {"last_sync_at": None, "oldest_sync_at": None, "tables": [], "all_ok": False, "error": "snapshot_unavailable"}
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name, last_sync, rows_synced, duration_ms, status, error_message
            FROM _meta_sync ORDER BY table_name
        """)
        tables = []
        last = None; oldest = None; all_ok = True
        for tn, ts, rows, dur, st, err in cur.fetchall():
            tables.append({
                "table": tn,
                "last_sync_at": ts.isoformat() if ts else None,
                "rows": rows,
                "duration_ms": dur,
                "status": st,
                "error": err,
            })
            if st != "ok":
                all_ok = False
            if ts:
                if last is None or ts > last: last = ts
                if oldest is None or ts < oldest: oldest = ts
        return {
            "last_sync_at": last.isoformat() if last else None,
            "oldest_sync_at": oldest.isoformat() if oldest else None,
            "tables": tables,
            "all_ok": all_ok,
        }
    finally:
        conn.close()


@router.post("/snapshot-refresh")
def snapshot_refresh(current_user: User = Depends(get_current_user)):
    """Dispara una sincronización manual del snapshot (en background)."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    import threading
    from app.workers.snapshot_worker import run_sync_once
    def _bg():
        try:
            run_sync_once()
        except Exception:
            pass
    threading.Thread(target=_bg, daemon=True, name="snapshot-manual").start()
    return {"started": True}



# ── 1. Ventas por Vendedor [ELIMINADO] / Evaluación de Empleados [ELIMINADO] ──
# Removido — innecesario según mejora aprobada.


# ── 2. Ventas Agrupadas (por día y local) ────────────────────────────────────

_SQL_VENTAS_AGRUPADAS = """
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CANTIDAD_VENDIDA * -1
            ELSE CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN MONTO_VENTA_NETO_IVA * -1
            ELSE MONTO_VENTA_NETO_IVA
        END
    ) AS MONTO_VENDIDO,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO LIKE 'TKF%%' OR COMPROBANTE_TIPO = 'TIQUE'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS CANTIDAD_FACTURAS,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO = 'AUTOCON' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS CANTIDAD_NOTA_CREDITO
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND {LOCAL_FILTER}
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY FECHA DESC, MONTO_VENDIDO DESC
"""

_SQL_VENTAS_AGRUPADAS_SIN_DIA = """
SELECT
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CANTIDAD_VENDIDA * -1
            ELSE CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN MONTO_VENTA_NETO_IVA * -1
            ELSE MONTO_VENTA_NETO_IVA
        END
    ) AS MONTO_VENDIDO,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO LIKE 'TKF%%' OR COMPROBANTE_TIPO = 'TIQUE'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS CANTIDAD_FACTURAS,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO = 'AUTOCON' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS CANTIDAD_NOTA_CREDITO
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND {LOCAL_FILTER}
GROUP BY
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY MONTO_VENDIDO DESC
"""


@router.get("/ventas-agrupadas")
def informe_ventas_agrupadas(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    unificar_dias: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        base_sql = _SQL_VENTAS_AGRUPADAS_SIN_DIA if unificar_dias else _SQL_VENTAS_AGRUPADAS
        sql = base_sql.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 3. Artículos por Ticket ───────────────────────────────────────────────────

_SQL_ARTICULOS_TICKET = """
SELECT
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    COUNT(DISTINCT COMPROBANTE_NUMERO) AS TOTAL_TICKETS,
    SUM(
        CANTIDAD_VENDIDA * CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN -1
            ELSE 1
        END
    ) AS TOTAL_ARTICULOS
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND PRECIO_UNIDAD > 10
    AND {LOCAL_FILTER}
GROUP BY
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY
    LOCAL ASC
"""


@router.get("/articulos-por-ticket")
def informe_articulos_ticket(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_ARTICULOS_TICKET.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 4. Ventas por Vendedor [ELIMINADO — mejora id=110] ───────────────────────
# El informe "Ventas por Vendedor" fue removido del sistema.


# ── 5. Ventas por Marca ───────────────────────────────────────────────────────

_SQL_VENTAS_MARCA_DESGLOSE = """
WITH ARTICULOS_DEPURADO AS (
    SELECT *
    FROM (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY CODIGO_ARTICULO, COLOR_DESCRIPCION, TALLE_DESCRIPCION
                ORDER BY CODIGO_ARTICULO
            ) AS RN
        FROM ARTICULOS
    ) A
    WHERE RN = 1
)
SELECT
    COALESCE(NULLIF(TRIM(V.MARCA), ''), 'SIN MARCA') AS MARCA,
    REPLACE(V.LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN V.COMPROBANTE_TIPO = 'AUTOCONS' OR V.COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN V.CANTIDAD_VENDIDA * -1
            ELSE V.CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    SUM(
        CASE
            WHEN V.COMPROBANTE_TIPO = 'AUTOCONS' OR V.COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN V.MONTO_VENTA_NETO_IVA * -1
            ELSE V.MONTO_VENTA_NETO_IVA
        END
    ) AS MONTO_VENDIDO
FROM VENTAS V
LEFT JOIN ARTICULOS_DEPURADO A
    ON V.CODIGO_ARTICULO = A.CODIGO_ARTICULO
    AND V.CODIGO_COLOR = A.COLOR_DESCRIPCION
    AND V.CODIGO_TALLE = A.TALLE_DESCRIPCION
WHERE
    CAST(V.FECHA AS DATE) BETWEEN %s AND %s
    AND V.PRECIO_UNIDAD > 10
    AND {LOCAL_FILTER_V}
    AND (%s IS NULL OR %s = '' OR V.MARCA = %s)
    AND (%s IS NULL OR %s = '' OR A.PROVEEDOR = %s)
GROUP BY
    COALESCE(NULLIF(TRIM(V.MARCA), ''), 'SIN MARCA'),
    REPLACE(V.LOCAL, 'DRAGONFISH_', '')
ORDER BY MARCA ASC, MONTO_VENDIDO DESC
"""


_SQL_VENTAS_MARCA = """
WITH ARTICULOS_DEPURADO AS (
    SELECT *
    FROM (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY CODIGO_ARTICULO, COLOR_DESCRIPCION, TALLE_DESCRIPCION
                ORDER BY CODIGO_ARTICULO
            ) AS RN
        FROM ARTICULOS
    ) A
    WHERE RN = 1
), STOCK_VALOR AS (
    SELECT
        COALESCE(NULLIF(TRIM(MARCA), ''), 'SIN MARCA') AS MARCA,
        SUM(CAST(STOCK AS DECIMAL(18,4)) * COALESCE(CAST(COSTO AS DECIMAL(18,4)), 0)) AS STOCK_VALORIZADO
    FROM STOCKS
    WHERE {LOCAL_FILTER_S}
      AND (%s IS NULL OR %s = '' OR MARCA = %s)
      AND (%s IS NULL OR %s = '' OR PROVEEDOR = %s)
    GROUP BY COALESCE(NULLIF(TRIM(MARCA), ''), 'SIN MARCA')
)
SELECT
    COALESCE(NULLIF(TRIM(V.MARCA), ''), 'SIN MARCA') AS MARCA,
    SUM(
        CASE
            WHEN V.COMPROBANTE_TIPO = 'AUTOCONS' OR V.COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN V.CANTIDAD_VENDIDA * -1
            ELSE V.CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    SUM(
        CASE
            WHEN V.COMPROBANTE_TIPO = 'AUTOCONS' OR V.COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN V.MONTO_VENTA_NETO_IVA * -1
            ELSE V.MONTO_VENTA_NETO_IVA
        END
    ) AS MONTO_VENDIDO,
    COALESCE(SV.STOCK_VALORIZADO, 0) AS STOCK_VALORIZADO
FROM VENTAS V
LEFT JOIN ARTICULOS_DEPURADO A
    ON V.CODIGO_ARTICULO = A.CODIGO_ARTICULO
    AND V.CODIGO_COLOR = A.COLOR_DESCRIPCION
    AND V.CODIGO_TALLE = A.TALLE_DESCRIPCION
LEFT JOIN STOCK_VALOR SV
    ON COALESCE(NULLIF(TRIM(V.MARCA), ''), 'SIN MARCA') = SV.MARCA
WHERE
    CAST(V.FECHA AS DATE) BETWEEN %s AND %s
    AND V.PRECIO_UNIDAD > 10
    AND {LOCAL_FILTER_V}
    AND (%s IS NULL OR %s = '' OR V.MARCA = %s)
    AND (%s IS NULL OR %s = '' OR A.PROVEEDOR = %s)
GROUP BY
    COALESCE(NULLIF(TRIM(V.MARCA), ''), 'SIN MARCA')
ORDER BY MONTO_VENDIDO DESC
"""


@router.get("/ventas-marca")
def informe_ventas_marca(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    desglose_local: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc_v, lp_v = _locales_clause(local, "REPLACE(V.LOCAL,'DRAGONFISH_','')")
    lc_s, lp_s = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        if desglose_local:
            sql = _SQL_VENTAS_MARCA_DESGLOSE.replace("{LOCAL_FILTER_V}", lc_v)
            cursor.execute(sql, (
                str(fecha_desde), str(fecha_hasta),
                *lp_v,
                mv, mv, mv,
                pv, pv, pv,
            ))
        else:
            sql = _SQL_VENTAS_MARCA.replace("{LOCAL_FILTER_V}", lc_v).replace("{LOCAL_FILTER_S}", lc_s)
            cursor.execute(sql, (
                *lp_s,
                mv, mv, mv,
                pv, pv, pv,
                str(fecha_desde), str(fecha_hasta),
                *lp_v,
                mv, mv, mv,
                pv, pv, pv,
            ))
        return {
            "fecha_desde": str(fecha_desde),
            "fecha_hasta": str(fecha_hasta),
            "rows": _rows_to_dicts(cursor),
            "desglose_local": desglose_local,
        }
    finally:
        conn.close()


# ── 6. Ventas por Artículo ────────────────────────────────────────────────────

_SQL_VENTAS_ARTICULO_DESGLOSE = """
WITH VentasFiltradas AS (
    SELECT
        REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
        CODIGO_ARTICULO,
        TRIM(
            CASE
                WHEN POSITION(' Variante' IN ARTICULO_DESCRIPCION) > 0
                THEN LEFT(ARTICULO_DESCRIPCION, POSITION(' Variante' IN ARTICULO_DESCRIPCION) - 1)
                ELSE ARTICULO_DESCRIPCION
            END
        ) AS ARTICULO_LIMPIO,
        COALESCE(CODIGO_COLOR, '') AS CODIGO_COLOR,
        COALESCE(CODIGO_TALLE, '') AS CODIGO_TALLE,
        CANTIDAD_VENDIDA
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND {LOCAL_FILTER_V}
      AND (%s IS NULL OR %s = '' OR MARCA = %s)
      AND UPPER(CODIGO_ARTICULO) NOT IN (
          'AJUSTE','NRMPBSABS6NB0ST','NRMPBSABS2','1','3',
          'PTF3539APCOUT','PTF4539APCOUT','PTR2530APCOUT',
          'PTF7050APCOUT','DESCUENTO','NRMPBSABS1','NRMPBSABS5','2'
      )
), StockActual AS (
    SELECT
        CODIGO_ARTICULO,
        COALESCE(CODIGO_COLOR, '') AS CODIGO_COLOR,
        COALESCE(CODIGO_TALLE, '') AS CODIGO_TALLE,
        REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
        SUM(CAST(STOCK AS DECIMAL(18,4))) AS STOCK_ACTUAL
    FROM STOCKS
    WHERE {LOCAL_FILTER_S}
    GROUP BY CODIGO_ARTICULO, COALESCE(CODIGO_COLOR, ''), COALESCE(CODIGO_TALLE, ''), REPLACE(LOCAL, 'DRAGONFISH_', '')
)
SELECT
    V.LOCAL,
    V.CODIGO_ARTICULO,
    V.ARTICULO_LIMPIO,
    V.CODIGO_COLOR,
    V.CODIGO_TALLE,
    SUM(V.CANTIDAD_VENDIDA) AS TOTAL_VENDIDO,
    COALESCE(MAX(S.STOCK_ACTUAL), 0) AS STOCK_ACTUAL
FROM VentasFiltradas V
LEFT JOIN StockActual S
    ON V.CODIGO_ARTICULO = S.CODIGO_ARTICULO
    AND V.CODIGO_COLOR = S.CODIGO_COLOR
    AND V.CODIGO_TALLE = S.CODIGO_TALLE
    AND V.LOCAL = S.LOCAL
GROUP BY V.LOCAL, V.CODIGO_ARTICULO, V.ARTICULO_LIMPIO, V.CODIGO_COLOR, V.CODIGO_TALLE
ORDER BY SUM(V.CANTIDAD_VENDIDA) DESC
"""

_SQL_VENTAS_ARTICULO_TOTAL = """
WITH VentasFiltradas AS (
    SELECT
        CODIGO_ARTICULO,
        TRIM(
            CASE
                WHEN POSITION(' Variante' IN ARTICULO_DESCRIPCION) > 0
                THEN LEFT(ARTICULO_DESCRIPCION, POSITION(' Variante' IN ARTICULO_DESCRIPCION) - 1)
                ELSE ARTICULO_DESCRIPCION
            END
        ) AS ARTICULO_LIMPIO,
        COALESCE(CODIGO_COLOR, '') AS CODIGO_COLOR,
        COALESCE(CODIGO_TALLE, '') AS CODIGO_TALLE,
        CANTIDAD_VENDIDA
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND {LOCAL_FILTER_V}
      AND (%s IS NULL OR %s = '' OR MARCA = %s)
      AND UPPER(CODIGO_ARTICULO) NOT IN (
          'AJUSTE','NRMPBSABS6NB0ST','NRMPBSABS2','1','3',
          'PTF3539APCOUT','PTF4539APCOUT','PTR2530APCOUT',
          'PTF7050APCOUT','DESCUENTO','NRMPBSABS1','NRMPBSABS5','2'
      )
), StockActual AS (
    SELECT
        CODIGO_ARTICULO,
        COALESCE(CODIGO_COLOR, '') AS CODIGO_COLOR,
        COALESCE(CODIGO_TALLE, '') AS CODIGO_TALLE,
        SUM(CAST(STOCK AS DECIMAL(18,4))) AS STOCK_ACTUAL
    FROM STOCKS
    WHERE {LOCAL_FILTER_S}
    GROUP BY CODIGO_ARTICULO, COALESCE(CODIGO_COLOR, ''), COALESCE(CODIGO_TALLE, '')
)
SELECT
    V.CODIGO_ARTICULO,
    V.ARTICULO_LIMPIO,
    V.CODIGO_COLOR,
    V.CODIGO_TALLE,
    SUM(V.CANTIDAD_VENDIDA) AS TOTAL_VENDIDO,
    COALESCE(MAX(S.STOCK_ACTUAL), 0) AS STOCK_ACTUAL
FROM VentasFiltradas V
LEFT JOIN StockActual S
    ON V.CODIGO_ARTICULO = S.CODIGO_ARTICULO
    AND V.CODIGO_COLOR = S.CODIGO_COLOR
    AND V.CODIGO_TALLE = S.CODIGO_TALLE
GROUP BY V.CODIGO_ARTICULO, V.ARTICULO_LIMPIO, V.CODIGO_COLOR, V.CODIGO_TALLE
ORDER BY SUM(V.CANTIDAD_VENDIDA) DESC
"""


@router.get("/ventas-articulo")
def informe_ventas_articulo(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    desglose_local: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc_v, lp_v = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    lc_s, lp_s = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    mv = marca if marca and marca.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        if desglose_local:
            sql = _SQL_VENTAS_ARTICULO_DESGLOSE.replace("{LOCAL_FILTER_V}", lc_v).replace("{LOCAL_FILTER_S}", lc_s)
            cursor.execute(sql, (
                str(fecha_desde), str(fecha_hasta),
                *lp_v,
                mv, mv, mv,
                *lp_s,
            ))
        else:
            sql = _SQL_VENTAS_ARTICULO_TOTAL.replace("{LOCAL_FILTER_V}", lc_v).replace("{LOCAL_FILTER_S}", lc_s)
            cursor.execute(sql, (
                str(fecha_desde), str(fecha_hasta),
                *lp_v,
                mv, mv, mv,
                *lp_s,
            ))
        return {
            "fecha_desde": str(fecha_desde),
            "fecha_hasta": str(fecha_hasta),
            "rows": _rows_to_dicts(cursor),
            "desglose_local": desglose_local,
        }
    finally:
        conn.close()


# ── 7. Ventas con Código de Promoción ────────────────────────────────────────

_SQL_VENTAS_PROMO = """
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    TRIM(CASE
        WHEN POSITION(' Variante' IN ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, POSITION(' Variante' IN ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END) AS ARTICULO,
    MAX(PRECIO_UNIDAD) AS PRECIO_LISTA,
    SUM(DESCUENTO) AS DESCUENTO,
    SUM(MONTO_VENTA_NETO_IVA) AS PRECIO_NETO,
    COALESCE(CODIGOPROMOCION, '') AS CODIGOPROMOCION,
    MAX(NOMBREPROMOCION) AS NOMBRE_PROMO,
    MAX(MEDIO_PAGO) AS FORMA_PAGO,
    SUM(CANTIDAD_VENDIDA) AS CANTIDAD
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND CODIGOPROMOCION IS NOT NULL
    AND CODIGOPROMOCION <> ''
    AND (%s IS NULL OR %s = '' OR CODIGO_ARTICULO = %s)
    AND {LOCAL_FILTER}
    AND (%s IS NULL OR %s = '' OR MARCA = %s)
    AND (%s IS NULL OR %s = '' OR COALESCE(CODIGOPROMOCION, '') = %s)
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', ''),
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    TRIM(CASE
        WHEN POSITION(' Variante' IN ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, POSITION(' Variante' IN ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END),
    COALESCE(CODIGOPROMOCION, '')
ORDER BY FECHA ASC, LOCAL ASC, COMPROBANTE_NUMERO ASC
"""


@router.get("/ventas-promo")
def informe_ventas_promo(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    codigo_articulo: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    codigo_promo: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    cv = codigo_articulo if codigo_articulo and codigo_articulo.strip() else None
    mv = marca if marca and marca.strip() else None
    cpv = codigo_promo if codigo_promo and codigo_promo.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_VENTAS_PROMO.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            cv, cv, cv,
            *lp,
            mv, mv, mv,
            cpv, cpv, cpv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 8. Medio de Pago ─────────────────────────────────────────────────────────

_SQL_MEDIO_PAGO = """
SELECT
    v.FECHA_DIA AS FECHA,
    COALESCE(mp.FORMAPAGODETALLE, 'Sin Especificar') AS MEDIO_PAGO,
    REPLACE(mp.LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN mp.COMPROBANTE_TIPO = 'AUTOCONS' OR mp.COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN -mp.MONTOPAGO
            ELSE mp.MONTOPAGO
        END
    ) AS MONTO_VENDIDO
FROM MEDIOS_PAGOS mp
INNER JOIN (
    SELECT IDVENTA, LOCAL, CAST(MIN(FECHA) AS DATE) AS FECHA_DIA
    FROM VENTAS GROUP BY IDVENTA, LOCAL
) v ON v.IDVENTA = (mp.IDVENTA)::text AND v.LOCAL = mp.LOCAL
WHERE
    v.FECHA_DIA BETWEEN %s AND %s
    AND {LOCAL_FILTER_MP}
    AND (%s IS NULL OR %s = '' OR mp.FORMAPAGODETALLE = %s)
GROUP BY
    v.FECHA_DIA,
    COALESCE(mp.FORMAPAGODETALLE, 'Sin Especificar'),
    REPLACE(mp.LOCAL, 'DRAGONFISH_', '')
ORDER BY FECHA DESC, MONTO_VENDIDO DESC
"""


@router.get("/medio-pago")
def informe_medio_pago(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    medio_pago: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(mp.LOCAL,'DRAGONFISH_','')")
    mpv = medio_pago if medio_pago and medio_pago.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_MEDIO_PAGO.replace("{LOCAL_FILTER_MP}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
            mpv, mpv, mpv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 9. Ventas y Stock ─────────────────────────────────────────────────────────

_SQL_VENTAS_STOCK = """
WITH ResumenVentas AS (
    SELECT
        CODIGO_ARTICULO,
        SUM(CASE
                WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
                THEN CANTIDAD_VENDIDA * -1
                ELSE CANTIDAD_VENDIDA
            END) AS TOTAL_VENDIDO
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND PRECIO_UNIDAD > 10
      AND {LOCAL_FILTER}
    GROUP BY CODIGO_ARTICULO
),
ResumenStock AS (
    SELECT
        CODIGO_ARTICULO,
        MAX(LTRIM(RTRIM(
            CASE
                WHEN POSITION('Variante' IN DESCRIPCION) > 0
                THEN LEFT(DESCRIPCION, POSITION('Variante' IN DESCRIPCION) - 1)
                ELSE DESCRIPCION
            END
        ))) AS DESCRIPCION,
        SUM(STOCK) AS TOTAL_STOCK
    FROM STOCKS
    WHERE (%s IS NULL OR %s = '' OR MARCA = %s)
      AND (%s IS NULL OR %s = '' OR PROVEEDOR = %s)
      AND {LOCAL_FILTER}
    GROUP BY CODIGO_ARTICULO
)
SELECT
    S.CODIGO_ARTICULO,
    S.DESCRIPCION,
    COALESCE(S.TOTAL_STOCK, 0) AS STOCK_ACTUAL,
    COALESCE(V.TOTAL_VENDIDO, 0) AS CANTIDAD_VENDIDA
FROM ResumenStock S
LEFT JOIN ResumenVentas V ON S.CODIGO_ARTICULO = V.CODIGO_ARTICULO
ORDER BY CANTIDAD_VENDIDA DESC, STOCK_ACTUAL DESC
"""


@router.get("/ventas-stock")
def informe_ventas_stock(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_VENTAS_STOCK.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
            mv, mv, mv,
            pv, pv, pv,
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 10. Stock Valorizado ──────────────────────────────────────────────────────

_SQL_STOCK_VALORIZADO = """
WITH StocksUnicos AS (
    SELECT DISTINCT
        CODIGO_ARTICULO,
        CODIGO_COLOR,
        CODIGO_TALLE,
        LOCAL,
        STOCK,
        COSTO,
        MARCA,
        PROVEEDOR
    FROM STOCKS
)
SELECT
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CAST(STOCK AS DECIMAL(18,4)) * COALESCE(CAST(COSTO AS DECIMAL(18,4)), 0)
    ) AS VALOR_TOTAL
FROM StocksUnicos
WHERE (%s IS NULL OR %s = '' OR MARCA = %s)
  AND (%s IS NULL OR %s = '' OR PROVEEDOR = %s)
  AND {LOCAL_FILTER}
GROUP BY REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY LOCAL
"""


@router.get("/stock-valorizado")
def informe_stock_valorizado(
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_STOCK_VALORIZADO.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            mv, mv, mv,
            pv, pv, pv,
            *lp,
        ))
        return {"rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 11. Fichas de Compras por Local ──────────────────────────────────────────

_SQL_FICHAS_LOCALES = """
WITH SS AS (
    SELECT
        LOCAL,
        COUNT(COMPRO) AS COMPRAS
    FROM FICHACOMPRO
    WHERE COMPRO = 'SI'
      AND CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND {LOCAL_FILTER_RAW}
    GROUP BY LOCAL
),
ST AS (
    SELECT
        LOCAL,
        COUNT(*) AS TOTAL
    FROM FICHACOMPRO
    WHERE CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND {LOCAL_FILTER_RAW}
    GROUP BY LOCAL
)
SELECT
    ST.LOCAL,
    %s AS DESDE,
    %s AS HASTA,
    ST.TOTAL AS TOTAL_OPERACIONES,
    COALESCE(SS.COMPRAS, 0) AS COMPRAS_EFECTIVAS,
    CASE
        WHEN ST.TOTAL = 0 THEN 0
        ELSE ROUND((COALESCE(SS.COMPRAS, 0) * 100.0) / ST.TOTAL, 2)
    END AS PORCENTAJE_CONVERSION
FROM ST
LEFT JOIN SS ON SS.LOCAL = ST.LOCAL
ORDER BY PORCENTAJE_CONVERSION DESC
"""


@router.get("/fichas-locales")
def informe_fichas_locales(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "LOCAL")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_FICHAS_LOCALES.replace("{LOCAL_FILTER_RAW}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
            str(fecha_desde), str(fecha_hasta),
            *lp,
            str(fecha_desde), str(fecha_hasta),
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 12. Fichas de Compras Diarias ─────────────────────────────────────────────

_SQL_FICHAS_DIARIAS = """
WITH SS AS (
    SELECT
        CAST(FECHA AS DATE) AS FECHA_DIA,
        COUNT(COMPRO) AS COMPRAS
    FROM FICHACOMPRO
    WHERE COMPRO = 'SI'
      AND CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND {LOCAL_FILTER_RAW}
    GROUP BY CAST(FECHA AS DATE)
),
ST AS (
    SELECT
        CAST(FECHA AS DATE) AS FECHA_DIA,
        COUNT(*) AS TOTAL
    FROM FICHACOMPRO
    WHERE CAST(FECHA AS DATE) BETWEEN %s AND %s
      AND {LOCAL_FILTER_RAW}
    GROUP BY CAST(FECHA AS DATE)
)
SELECT
    ST.FECHA_DIA,
    ST.TOTAL AS TOTAL_OPERACIONES_DIA,
    COALESCE(SS.COMPRAS, 0) AS COMPRAS_EFECTIVAS_DIA,
    CASE
        WHEN ST.TOTAL = 0 THEN 0
        ELSE ROUND((COALESCE(SS.COMPRAS, 0) * 100.0) / ST.TOTAL, 2)
    END AS PORCENTAJE_DIARIO
FROM ST
LEFT JOIN SS ON SS.FECHA_DIA = ST.FECHA_DIA
ORDER BY ST.FECHA_DIA ASC
"""


@router.get("/fichas-diarias")
def informe_fichas_diarias(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "LOCAL")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_FICHAS_DIARIAS.replace("{LOCAL_FILTER_RAW}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 13. MercadoLibre por Categoría ───────────────────────────────────────────

_SQL_ML_CATEGORIAS = """
SELECT
    v.CATEGORY_NAME AS CATEGORIA,
    SUM(CASE WHEN v.DATE_CREATED >= %s AND v.DATE_CREATED < ((%s)::date + 1) THEN v.CANTIDAD ELSE 0 END) AS UNIDADES,
    SUM(CASE WHEN v.DATE_CREATED >= %s AND v.DATE_CREATED < ((%s)::date + 1) THEN v.TOTAL_AMOUNT ELSE 0 END) AS VENTAS
FROM VENTAS_MERCADOLIBRE v
WHERE
    v.ESTADO = 'VENTA_COMPLETADA'
    AND (%s IS NULL OR %s = '' OR v.CATEGORY_NAME = %s)
    AND {LOCAL_FILTER_ML}
GROUP BY v.CATEGORY_NAME
ORDER BY VENTAS DESC
"""


@router.get("/mercadolibre-categorias")
def informe_ml_categorias(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    catv = categoria if categoria and categoria.strip() else None
    lc, lp = _locales_clause(local, "v.LOCAL")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_ML_CATEGORIAS.replace("{LOCAL_FILTER_ML}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            str(fecha_desde), str(fecha_hasta),
            catv, catv, catv,
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 14. MercadoLibre por Producto ─────────────────────────────────────────────

_SQL_ML_PRODUCTOS = """
SELECT
    v.PRODUCT_NAME AS PRODUCTO,
    SUM(CASE WHEN v.DATE_CREATED >= %s AND v.DATE_CREATED < ((%s)::date + 1) THEN v.CANTIDAD ELSE 0 END) AS UNIDADES,
    SUM(CASE WHEN v.DATE_CREATED >= %s AND v.DATE_CREATED < ((%s)::date + 1) THEN v.TOTAL_AMOUNT ELSE 0 END) AS VENTAS
FROM VENTAS_MERCADOLIBRE v
WHERE
    v.ESTADO = 'VENTA_COMPLETADA'
    AND (%s IS NULL OR v.PRODUCT_NAME LIKE '%%' || %s || '%%')
    AND {LOCAL_FILTER_ML}
GROUP BY v.PRODUCT_NAME
ORDER BY VENTAS DESC
"""


@router.get("/mercadolibre-productos")
def informe_ml_productos(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    producto: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    pv = producto if producto and producto.strip() else None
    lc, lp = _locales_clause(local, "v.LOCAL")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_ML_PRODUCTOS.replace("{LOCAL_FILTER_ML}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            str(fecha_desde), str(fecha_hasta),
            pv, pv,
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 15. Ticket Promedio ───────────────────────────────────────────────────────

_SQL_TICKET_PROMEDIO = """
WITH Tickets AS (
    SELECT
        CAST(FECHA AS DATE) AS FECHA,
        REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
        COMPROBANTE_NUMERO,
        SUM(MONTO_VENTA_NETO_IVA) AS MONTO_TICKET,
        COUNT(*) AS ARTICULOS_TICKET
    FROM VENTAS
    WHERE
        CAST(FECHA AS DATE) BETWEEN %s AND %s
        AND PRECIO_UNIDAD > 10
        AND COMPROBANTE_TIPO NOT LIKE 'NCR%%'
        AND COMPROBANTE_TIPO != 'AUTOCONS'
        AND COMPROBANTE_TIPO != 'AUTOCON'
        AND {LOCAL_FILTER}
    GROUP BY
        CAST(FECHA AS DATE),
        REPLACE(LOCAL, 'DRAGONFISH_', ''),
        COMPROBANTE_NUMERO
)
SELECT
    LOCAL,
    COUNT(*) AS TOTAL_TICKETS,
    SUM(MONTO_TICKET) AS MONTO_TOTAL,
    CAST(ROUND(AVG(MONTO_TICKET), 0) AS DECIMAL(18,0)) AS TICKET_PROMEDIO
FROM Tickets
GROUP BY LOCAL
ORDER BY LOCAL ASC
"""


@router.get("/ticket-promedio")
def informe_ticket_promedio(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_TICKET_PROMEDIO.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 16. Ventas por Categoría ──────────────────────────────────────────────────

_SQL_VENTAS_CATEGORIA = """
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    CASE
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%ZAPATILLA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOTA %%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOTIN%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SANDALIA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CALZADO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%ALPARGATA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%ESCARPINES%%'
        THEN 'CALZADO'
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%CAMPERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%REMERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%PANTALON%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BUZO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CHOMBA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CAMISA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CALZA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BERMUDA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%POLAR%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CAMISETA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%MUSCULOSA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%VESTIDO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%POLERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SHORT%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%JEAN%%'
        THEN 'INDUMENTARIA'
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%MOCHILA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOLSO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GORRA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GUANTE%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GORRO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BEANIE%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%RIÑONERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BUFF%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%MEDIAS%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%ANTEOJOS%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%LENTES%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BASTONES%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GUANTES%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%MANTA%%'
        THEN 'ACCESORIOS'
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%CARPA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOLSA DE DORMIR%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SLEEPING%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%COLCHON%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SILLA CAMP%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%LINTERNA%%'
        THEN 'CAMPING/EQUIPAMIENTO'
        ELSE 'OTROS'
    END AS CATEGORIA,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CANTIDAD_VENDIDA * -1
            ELSE CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN MONTO_VENTA_NETO_IVA * -1
            ELSE MONTO_VENTA_NETO_IVA
        END
    ) AS MONTO_VENDIDO
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND PRECIO_UNIDAD > 10
    AND {LOCAL_FILTER}
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', ''),
    CASE
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%ZAPATILLA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOTA %%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOTIN%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SANDALIA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CALZADO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%ALPARGATA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%ESCARPINES%%'
        THEN 'CALZADO'
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%CAMPERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%REMERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%PANTALON%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BUZO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CHOMBA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CAMISA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CALZA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BERMUDA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%POLAR%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%CAMISETA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%MUSCULOSA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%VESTIDO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%POLERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SHORT%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%JEAN%%'
        THEN 'INDUMENTARIA'
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%MOCHILA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOLSO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GORRA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GUANTE%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GORRO%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BEANIE%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%RIÑONERA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BUFF%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%MEDIAS%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%ANTEOJOS%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%LENTES%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BASTONES%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%GUANTES%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%MANTA%%'
        THEN 'ACCESORIOS'
        WHEN UPPER(ARTICULO_DESCRIPCION) LIKE '%%CARPA%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%BOLSA DE DORMIR%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SLEEPING%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%COLCHON%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%SILLA CAMP%%'
          OR UPPER(ARTICULO_DESCRIPCION) LIKE '%%LINTERNA%%'
        THEN 'CAMPING/EQUIPAMIENTO'
        ELSE 'OTROS'
    END
ORDER BY FECHA DESC, MONTO_VENDIDO DESC
"""


@router.get("/ventas-categoria")
def informe_ventas_categoria(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_VENTAS_CATEGORIA.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 17. Stock Actual por Producto ─────────────────────────────────────────────

_SQL_STOCK_ACTUAL = """
SELECT
    CODIGO_ARTICULO,
    MAX(LTRIM(RTRIM(
        CASE
            WHEN POSITION('Variante' IN DESCRIPCION) > 0
            THEN LEFT(DESCRIPCION, POSITION('Variante' IN DESCRIPCION) - 1)
            ELSE DESCRIPCION
        END
    ))) AS DESCRIPCION,
    MAX(MARCA) AS MARCA,
    MAX(PROVEEDOR) AS PROVEEDOR,
    SUM(STOCK) AS STOCK_TOTAL
FROM STOCKS
WHERE (%s IS NULL OR %s = '' OR MARCA = %s)
  AND (%s IS NULL OR %s = '' OR PROVEEDOR = %s)
  AND {LOCAL_FILTER}
GROUP BY CODIGO_ARTICULO
HAVING SUM(STOCK) > 0
ORDER BY STOCK_TOTAL DESC
"""


@router.get("/stock-actual")
def informe_stock_actual(
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    proveedor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_STOCK_ACTUAL.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            mv, mv, mv,
            pv, pv, pv,
            *lp,
        ))
        return {"rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 18. Productos sin movimiento ──────────────────────────────────────────────

_SQL_PRODUCTOS_SIN_MOVIMIENTO = """
WITH UltimasVentas AS (
    SELECT
        CODIGO_ARTICULO,
        MAX(CAST(FECHA AS DATE)) AS ULTIMA_VENTA
    FROM VENTAS
    WHERE PRECIO_UNIDAD > 10
    GROUP BY CODIGO_ARTICULO
),
StockPorArticulo AS (
    SELECT
        CODIGO_ARTICULO,
        MAX(LTRIM(RTRIM(
            CASE
                WHEN POSITION('Variante' IN DESCRIPCION) > 0
                THEN LEFT(DESCRIPCION, POSITION('Variante' IN DESCRIPCION) - 1)
                ELSE DESCRIPCION
            END
        ))) AS DESCRIPCION,
        MAX(MARCA) AS MARCA,
        MAX(PROVEEDOR) AS PROVEEDOR,
        SUM(STOCK) AS STOCK_TOTAL
    FROM STOCKS
    WHERE (%s IS NULL OR %s = '' OR MARCA = %s)
      AND {LOCAL_FILTER}
    GROUP BY CODIGO_ARTICULO
)
SELECT
    S.CODIGO_ARTICULO,
    S.DESCRIPCION,
    S.MARCA,
    S.PROVEEDOR,
    S.STOCK_TOTAL AS STOCK_ACTUAL,
    UV.ULTIMA_VENTA,
    (('2000-01-01')::date - (COALESCE(UV.ULTIMA_VENTA)::date), CURRENT_DATE) AS DIAS_SIN_MOVIMIENTO
FROM StockPorArticulo S
LEFT JOIN UltimasVentas UV ON S.CODIGO_ARTICULO = UV.CODIGO_ARTICULO
WHERE S.STOCK_TOTAL > 0
  AND (UV.ULTIMA_VENTA IS NULL OR ((CURRENT_DATE)::date - (UV.ULTIMA_VENTA)::date) >= %s)
ORDER BY DIAS_SIN_MOVIMIENTO DESC, S.STOCK_TOTAL DESC
"""


@router.get("/productos-sin-movimiento")
def informe_productos_sin_movimiento(
    dias: int = Query(30),
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    mv = marca if marca and marca.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_PRODUCTOS_SIN_MOVIMIENTO.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            mv, mv, mv,
            *lp,
            dias,
        ))
        return {"dias": dias, "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 19. Declaración Shopping ─────────────────────────────────────────────────

_SQL_DECLARACION_SHOPPING = """
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN MONTO_VENTA_NETO_IVA * -1
            ELSE MONTO_VENTA_NETO_IVA
        END
    ) AS MONTO_VENDIDO,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CANTIDAD_VENDIDA * -1
            ELSE CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO LIKE 'TKF%%' OR COMPROBANTE_TIPO = 'TIQUE'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS CANTIDAD_TICKETS
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND {LOCAL_FILTER}
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY FECHA ASC
"""


@router.get("/declaracion-shopping")
def informe_declaracion_shopping(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_DECLARACION_SHOPPING.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "local": local, "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 20b. Ventas por Día (detalle diario para Estado de Resultado) ─────────────

_SQL_VENTAS_DIARIAS = """
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN MONTO_VENTA_NETO_IVA * -1
            ELSE MONTO_VENTA_NETO_IVA
        END
    ) AS VENTAS_NETAS,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CANTIDAD_VENDIDA * -1
            ELSE CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO LIKE 'TKF%%' OR COMPROBANTE_TIPO = 'TIQUE'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS TICKETS,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO = 'AUTOCON' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS NOTAS_CREDITO
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND {LOCAL_FILTER}
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY FECHA DESC, VENTAS_NETAS DESC
"""


@router.get("/ventas-diarias")
def informe_ventas_diarias(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Detalle diario de ventas por fecha y local. Usado por Estado de Resultado."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_VENTAS_DIARIAS.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 20. Ventas por Local (Estado de Resultado) ───────────────────────────────

_SQL_VENTAS_POR_LOCAL = """
SELECT
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN MONTO_VENTA_NETO_IVA * -1
            ELSE MONTO_VENTA_NETO_IVA
        END
    ) AS VENTAS_NETAS,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CANTIDAD_VENDIDA * -1
            ELSE CANTIDAD_VENDIDA
        END
    ) AS CANTIDAD_VENDIDA,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO LIKE 'TKF%%' OR COMPROBANTE_TIPO = 'TIQUE'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', (COMPROBANTE_NUMERO)::text)
            ELSE NULL
        END
    ) AS TICKETS
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN %s AND %s
    AND {LOCAL_FILTER}
GROUP BY
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY VENTAS_NETAS DESC
"""


@router.get("/ventas-por-local")
def informe_ventas_por_local(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Ventas netas totales agrupadas por local para el período. Usado por Estado de Resultado."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lc, lp = _locales_clause(local, "REPLACE(LOCAL,'DRAGONFISH_','')")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        sql = _SQL_VENTAS_POR_LOCAL.replace("{LOCAL_FILTER}", lc)
        cursor.execute(sql, (
            str(fecha_desde), str(fecha_hasta),
            *lp,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 21. Locales disponibles (para filtros) ────────────────────────────────────

@router.get("/locales-disponibles")
def get_locales_disponibles(current_user: User = Depends(get_current_user)):
    """Devuelve lista de locales únicos disponibles en SQL Server para los filtros."""
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL
            FROM VENTAS
            WHERE LOCAL IS NOT NULL AND LOCAL <> ''
            ORDER BY LOCAL
        """)
        rows = cursor.fetchall()
        # Deduplicar después del REPLACE (DRAGONFISH_X y X quedan igual)
        seen = set()
        result = []
        for row in rows:
            v = row[0]
            if v and v not in seen:
                seen.add(v)
                result.append(v)
        return result
    finally:
        conn.close()



@router.get("/marcas-disponibles")
def get_marcas_disponibles(current_user: User = Depends(get_current_user)):
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT MARCA FROM VENTAS
            WHERE MARCA IS NOT NULL AND MARCA <> ''
            UNION
            SELECT DISTINCT MARCA FROM STOCKS
            WHERE MARCA IS NOT NULL AND MARCA <> ''
            ORDER BY MARCA
        """)
        return [row[0] for row in cursor.fetchall()]
    finally:
        conn.close()


@router.get("/proveedores-disponibles")
def get_proveedores_disponibles(current_user: User = Depends(get_current_user)):
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT PROVEEDOR FROM VENTAS
            WHERE PROVEEDOR IS NOT NULL AND PROVEEDOR <> ''
            UNION
            SELECT DISTINCT PROVEEDOR FROM STOCKS
            WHERE PROVEEDOR IS NOT NULL AND PROVEEDOR <> ''
            ORDER BY PROVEEDOR
        """)
        return [row[0] for row in cursor.fetchall()]
    finally:
        conn.close()


# ── 16. Stock por locales (para tabla multi-local en StockPage) ────────────────

@router.get("/stock-locales")
def stock_por_locales(
    locales: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna stock de SQL Server pivoteado por local.
    locales: lista separada por comas (ej: deposito,mnbahia,mundoal)
    Devuelve una fila por variante con columnas dinámicas por cada local seleccionado.
    """
    locale_list = [l.strip() for l in (locales or "").split(",") if l.strip()]
    if not locale_list:
        # Sin locales seleccionados: devolver lista de locales disponibles
        return {"rows": [], "locales": []}

    conn = _get_conn()
    try:
        cursor = conn.cursor()

        # Construir SELECT dinámico con CASE por cada local
        local_cases = ", ".join(
            f'SUM(CASE WHEN REPLACE(LOCAL,\'DRAGONFISH_\',\'\')=%s THEN STOCK ELSE 0 END) AS "{loc}"'
            for loc in locale_list
        )
        params = list(locale_list)  # para los CASE

        where_clauses = []
        if marca:
            where_clauses.append("MARCA = %s")
            params.append(marca)
        if search:
            where_clauses.append("(DESCRIPCION LIKE %s OR CODIGO_ARTICULO LIKE %s)")
            params += [f"%{search}%", f"%{search}%"]

        # Filtrar solo locales solicitados
        placeholders = ",".join("%s" for _ in locale_list)
        where_clauses.append(f"REPLACE(LOCAL,'DRAGONFISH_','') IN ({placeholders})")
        params += locale_list

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        sql_query = f"""
            SELECT
                CODIGO_ARTICULO,
                CODIGO_COLOR,
                CODIGO_TALLE,
                MAX(MARCA) AS MARCA,
                MAX(LTRIM(RTRIM(
                    CASE
                        WHEN POSITION('Variante' IN DESCRIPCION) > 0
                        THEN LEFT(DESCRIPCION, POSITION('Variante' IN DESCRIPCION) - 1)
                        ELSE DESCRIPCION
                    END
                ))) AS DESCRIPCION,
                {local_cases}
            FROM STOCKS
            {where_sql}
            GROUP BY CODIGO_ARTICULO, CODIGO_COLOR, CODIGO_TALLE
            ORDER BY MAX(MARCA), MAX(DESCRIPCION), CODIGO_COLOR, CODIGO_TALLE
        """
        cursor.execute(sql_query, params)
        rows = _rows_to_dicts(cursor)
        return {"rows": rows, "locales": locale_list}
    finally:
        conn.close()
