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

_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes"
)

_CONN_STR_FALLBACK = (
    "DRIVER={SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
)


def _get_conn():
    try:
        import pyodbc
        try:
            return pyodbc.connect(_CONN_STR, timeout=0)
        except Exception:
            return pyodbc.connect(_CONN_STR_FALLBACK, timeout=0)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"SQL Server no disponible: {exc}")


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
    cols = [c[0] for c in cursor.description]
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
            d[col] = val
        result.append(d)
    return result


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/informes", tags=["Informes"])

_ADMIN_ROLES = [UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ADMINISTRACION]


# ── 1. Evaluación de Empleados (NUEVO) ───────────────────────────────────────

_SQL_EMPLEADOS = """
WITH DetallePorComprobante AS (
    SELECT
        CAST(FECHA AS DATE) AS FECHA,
        VENDEDOR,
        REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
        COMPROBANTE_NUMERO,
        COMPROBANTE_TIPO,
        SUM(
            CASE
                WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
                THEN -1
                ELSE 1
            END
        ) AS CantidadArticulos
    FROM VENTAS
    WHERE
        CAST(FECHA AS DATE) BETWEEN ? AND ?
        AND PRECIO_UNIDAD > 10
        AND VENDEDOR IS NOT NULL
        AND VENDEDOR <> 'Sin Vendedor'
        AND VENDEDOR <> ''
        AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
    GROUP BY
        CAST(FECHA AS DATE),
        VENDEDOR,
        REPLACE(LOCAL, 'DRAGONFISH_', ''),
        COMPROBANTE_NUMERO,
        COMPROBANTE_TIPO
)
SELECT
    FECHA,
    VENDEDOR,
    LOCAL,
    COUNT(*) AS TOTAL_TICKETS,
    SUM(CASE WHEN CantidadArticulos > 1 THEN 1 ELSE 0 END) AS TICKETS_MULTIARTICULO,
    SUM(CantidadArticulos) AS TOTAL_ARTICULOS,
    CAST(
        CASE WHEN COUNT(*) > 0
            THEN CAST(SUM(CantidadArticulos) AS FLOAT) / COUNT(*)
            ELSE 0
        END
    AS DECIMAL(10,2)) AS PROMEDIO_ARTICULOS_TICKET
FROM DetallePorComprobante
GROUP BY
    FECHA,
    VENDEDOR,
    LOCAL
ORDER BY
    FECHA DESC,
    TOTAL_ARTICULOS DESC
"""


@router.get("/empleados")
def informe_empleados(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    vendedor: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Evaluación de empleados: tickets y artículos por día y vendedor."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    local_val = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_EMPLEADOS, (
            str(fecha_desde), str(fecha_hasta),
            local_val, local_val, local_val
        ))
        rows = _rows_to_dicts(cursor)
        if vendedor:
            rows = [r for r in rows if vendedor.lower() in str(r.get("VENDEDOR", "")).lower()]
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": rows}
    finally:
        conn.close()


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
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', CONVERT(VARCHAR(100), COMPROBANTE_NUMERO))
            ELSE NULL
        END
    ) AS CANTIDAD_FACTURAS,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO = 'AUTOCON' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN CONCAT(REPLACE(LOCAL, 'DRAGONFISH_', ''), '|', COMPROBANTE_TIPO, '|', CONVERT(VARCHAR(100), COMPROBANTE_NUMERO))
            ELSE NULL
        END
    ) AS CANTIDAD_NOTA_CREDITO
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN ? AND ?
    AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY FECHA DESC, MONTO_VENDIDO DESC
"""


@router.get("/ventas-agrupadas")
def informe_ventas_agrupadas(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    local_val = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_VENTAS_AGRUPADAS, (
            str(fecha_desde), str(fecha_hasta),
            local_val, local_val, local_val
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 3. Artículos por Ticket ───────────────────────────────────────────────────

_SQL_ARTICULOS_TICKET = """
SELECT
    MIN(CAST(FECHA AS DATE)) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    VENDEDOR,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    SUM(
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%%'
            THEN -1
            ELSE 1
        END
    ) AS CANTIDAD_ARTICULOS
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN ? AND ?
    AND PRECIO_UNIDAD > 10
    AND VENDEDOR IS NOT NULL
    AND VENDEDOR <> 'Sin Vendedor'
    AND VENDEDOR <> ''
    AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
GROUP BY
    REPLACE(LOCAL, 'DRAGONFISH_', ''),
    VENDEDOR,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO
HAVING COUNT(*) >= ?
ORDER BY FECHA DESC, LOCAL ASC
"""


@router.get("/articulos-por-ticket")
def informe_articulos_ticket(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    min_articulos: int = Query(1),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    local_val = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_ARTICULOS_TICKET, (
            str(fecha_desde), str(fecha_hasta),
            local_val, local_val, local_val,
            min_articulos
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 4. Ventas por Vendedor ────────────────────────────────────────────────────

_SQL_VENTAS_VENDEDOR = """
SELECT
    MARCA,
    CODIGO_ARTICULO,
    TRIM(CASE
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END) AS ARTICULO_LIMPIO,
    SUM(CANTIDAD_VENDIDA) AS TOTAL_VENDIDO,
    VENDEDOR,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN ? AND ?
    AND VENDEDOR IS NOT NULL
    AND VENDEDOR <> 'Sin Vendedor'
    AND VENDEDOR <> ''
    AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
    AND (? IS NULL OR ? = '' OR MARCA = ?)
    AND (? IS NULL OR ? = '' OR CODIGO_ARTICULO = ?)
GROUP BY
    MARCA,
    CODIGO_ARTICULO,
    TRIM(CASE
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END),
    VENDEDOR,
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY MARCA ASC, TOTAL_VENDIDO DESC
"""


@router.get("/ventas-vendedor")
def informe_ventas_vendedor(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    codigo_articulo: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lv = local if local and local.strip() else None
    mv = marca if marca and marca.strip() else None
    cv = codigo_articulo if codigo_articulo and codigo_articulo.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_VENTAS_VENDEDOR, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
            mv, mv, mv,
            cv, cv, cv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 5. Ventas por Marca ───────────────────────────────────────────────────────

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
)
SELECT
    CAST(V.FECHA AS DATE) AS FECHA,
    V.MARCA,
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
    CAST(V.FECHA AS DATE) BETWEEN ? AND ?
    AND V.PRECIO_UNIDAD > 10
    AND (? IS NULL OR ? = '' OR REPLACE(V.LOCAL, 'DRAGONFISH_', '') = ?)
    AND (? IS NULL OR ? = '' OR V.MARCA = ?)
    AND (? IS NULL OR ? = '' OR A.PROVEEDOR = ?)
GROUP BY
    CAST(V.FECHA AS DATE),
    V.MARCA,
    REPLACE(V.LOCAL, 'DRAGONFISH_', '')
ORDER BY FECHA DESC, V.MARCA ASC
"""


@router.get("/ventas-marca")
def informe_ventas_marca(
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
    lv = local if local and local.strip() else None
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_VENTAS_MARCA, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
            mv, mv, mv,
            pv, pv, pv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 6. Ventas por Artículo ────────────────────────────────────────────────────

_SQL_VENTAS_ARTICULO = """
WITH VentasFiltradas AS (
    SELECT
        REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
        CODIGO_ARTICULO,
        TRIM(
            CASE
                WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
                THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
                ELSE ARTICULO_DESCRIPCION
            END
        ) AS ARTICULO_LIMPIO,
        CANTIDAD_VENDIDA
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN ? AND ?
      AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
      AND (? IS NULL OR ? = '' OR MARCA = ?)
      AND UPPER(CODIGO_ARTICULO) NOT IN (
          'AJUSTE','NRMPBSABS6NB0ST','NRMPBSABS2','1','3',
          'PTF3539APCOUT','PTF4539APCOUT','PTR2530APCOUT',
          'PTF7050APCOUT','DESCUENTO','NRMPBSABS1','NRMPBSABS5','2'
      )
)
SELECT
    LOCAL,
    CODIGO_ARTICULO,
    ARTICULO_LIMPIO,
    SUM(CANTIDAD_VENDIDA) AS TOTAL_VENDIDO
FROM VentasFiltradas
GROUP BY LOCAL, CODIGO_ARTICULO, ARTICULO_LIMPIO
ORDER BY SUM(CANTIDAD_VENDIDA) DESC
"""


@router.get("/ventas-articulo")
def informe_ventas_articulo(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lv = local if local and local.strip() else None
    mv = marca if marca and marca.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_VENTAS_ARTICULO, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
            mv, mv, mv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 7. Ventas con Código de Promoción ────────────────────────────────────────

_SQL_VENTAS_PROMO = """
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    VENDEDOR,
    ISNULL(CODIGOPROMOCION, '') AS CODIGOPROMOCION,
    CODIGO_ARTICULO,
    TRIM(CASE
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END) AS ARTICULO,
    SUM(CANTIDAD_VENDIDA) AS TOTAL_CANTIDAD
FROM VENTAS
WHERE
    CAST(FECHA AS DATE) BETWEEN ? AND ?
    AND VENDEDOR IS NOT NULL
    AND VENDEDOR <> 'Sin Vendedor'
    AND VENDEDOR <> ''
    AND (? IS NULL OR ? = '' OR CODIGO_ARTICULO = ?)
    AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
    AND (? IS NULL OR ? = '' OR MARCA = ?)
GROUP BY
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', ''),
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    VENDEDOR,
    ISNULL(CODIGOPROMOCION, ''),
    CODIGO_ARTICULO,
    TRIM(CASE
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END)
ORDER BY FECHA ASC, LOCAL ASC, COMPROBANTE_NUMERO ASC
"""


@router.get("/ventas-promo")
def informe_ventas_promo(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    local: Optional[str] = Query(None),
    codigo_articulo: Optional[str] = Query(None),
    marca: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    fecha_desde, fecha_hasta = _parse_fechas(desde, hasta)
    lv = local if local and local.strip() else None
    cv = codigo_articulo if codigo_articulo and codigo_articulo.strip() else None
    mv = marca if marca and marca.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_VENTAS_PROMO, (
            str(fecha_desde), str(fecha_hasta),
            cv, cv, cv,
            lv, lv, lv,
            mv, mv, mv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 8. Medio de Pago ─────────────────────────────────────────────────────────

_SQL_MEDIO_PAGO = """
SELECT
    v.FECHA_DIA AS FECHA,
    ISNULL(mp.FORMAPAGODETALLE, 'Sin Especificar') AS MEDIO_PAGO,
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
) v ON v.IDVENTA = CONVERT(VARCHAR(50), mp.IDVENTA) AND v.LOCAL = mp.LOCAL
WHERE
    v.FECHA_DIA BETWEEN ? AND ?
    AND (? IS NULL OR ? = '' OR REPLACE(mp.LOCAL, 'DRAGONFISH_', '') = ?)
    AND (? IS NULL OR ? = '' OR mp.FORMAPAGODETALLE = ?)
GROUP BY
    v.FECHA_DIA,
    ISNULL(mp.FORMAPAGODETALLE, 'Sin Especificar'),
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
    lv = local if local and local.strip() else None
    mpv = medio_pago if medio_pago and medio_pago.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_MEDIO_PAGO, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
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
    WHERE CAST(FECHA AS DATE) BETWEEN ? AND ?
      AND PRECIO_UNIDAD > 10
      AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
    GROUP BY CODIGO_ARTICULO
),
ResumenStock AS (
    SELECT
        CODIGO_ARTICULO,
        MAX(LTRIM(RTRIM(
            CASE
                WHEN CHARINDEX('Variante', DESCRIPCION) > 0
                THEN LEFT(DESCRIPCION, CHARINDEX('Variante', DESCRIPCION) - 1)
                ELSE DESCRIPCION
            END
        ))) AS DESCRIPCION,
        SUM(STOCK) AS TOTAL_STOCK
    FROM STOCKS
    WHERE (? IS NULL OR ? = '' OR MARCA = ?)
      AND (? IS NULL OR ? = '' OR PROVEEDOR = ?)
      AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
    GROUP BY CODIGO_ARTICULO
)
SELECT
    S.CODIGO_ARTICULO,
    S.DESCRIPCION,
    ISNULL(S.TOTAL_STOCK, 0) AS STOCK_ACTUAL,
    ISNULL(V.TOTAL_VENDIDO, 0) AS CANTIDAD_VENDIDA
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
    lv = local if local and local.strip() else None
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_VENTAS_STOCK, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
            mv, mv, mv,
            pv, pv, pv,
            lv, lv, lv,
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
        CAST(STOCK AS DECIMAL(18,4)) * ISNULL(CAST(COSTO AS DECIMAL(18,4)), 0)
    ) AS VALOR_TOTAL
FROM StocksUnicos
WHERE (? IS NULL OR ? = '' OR MARCA = ?)
  AND (? IS NULL OR ? = '' OR PROVEEDOR = ?)
  AND (? IS NULL OR ? = '' OR REPLACE(LOCAL, 'DRAGONFISH_', '') = ?)
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
    lv = local if local and local.strip() else None
    mv = marca if marca and marca.strip() else None
    pv = proveedor if proveedor and proveedor.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_STOCK_VALORIZADO, (
            mv, mv, mv,
            pv, pv, pv,
            lv, lv, lv,
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
      AND CAST(FECHA AS DATE) BETWEEN ? AND ?
      AND (? IS NULL OR ? = '' OR LOCAL = ?)
    GROUP BY LOCAL
),
ST AS (
    SELECT
        LOCAL,
        COUNT(*) AS TOTAL
    FROM FICHACOMPRO
    WHERE CAST(FECHA AS DATE) BETWEEN ? AND ?
      AND (? IS NULL OR ? = '' OR LOCAL = ?)
    GROUP BY LOCAL
)
SELECT
    ST.LOCAL,
    ? AS DESDE,
    ? AS HASTA,
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
    lv = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_FICHAS_LOCALES, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
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
      AND CAST(FECHA AS DATE) BETWEEN ? AND ?
      AND (? IS NULL OR ? = '' OR LOCAL = ?)
    GROUP BY CAST(FECHA AS DATE)
),
ST AS (
    SELECT
        CAST(FECHA AS DATE) AS FECHA_DIA,
        COUNT(*) AS TOTAL
    FROM FICHACOMPRO
    WHERE CAST(FECHA AS DATE) BETWEEN ? AND ?
      AND (? IS NULL OR ? = '' OR LOCAL = ?)
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
    lv = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_FICHAS_DIARIAS, (
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
            str(fecha_desde), str(fecha_hasta),
            lv, lv, lv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 13. MercadoLibre por Categoría ───────────────────────────────────────────

_SQL_ML_CATEGORIAS = """
SELECT
    v.CATEGORY_NAME AS CATEGORIA,
    SUM(CASE WHEN v.DATE_CREATED >= ? AND v.DATE_CREATED < DATEADD(DAY, 1, ?) THEN v.CANTIDAD ELSE 0 END) AS UNIDADES,
    SUM(CASE WHEN v.DATE_CREATED >= ? AND v.DATE_CREATED < DATEADD(DAY, 1, ?) THEN v.TOTAL_AMOUNT ELSE 0 END) AS VENTAS
FROM VENTAS_MERCADOLIBRE v
WHERE
    v.ESTADO = 'VENTA_COMPLETADA'
    AND (? IS NULL OR ? = '' OR v.CATEGORY_NAME = ?)
    AND (? IS NULL OR ? = '' OR v.LOCAL = ?)
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
    lv = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_ML_CATEGORIAS, (
            str(fecha_desde), str(fecha_hasta),
            str(fecha_desde), str(fecha_hasta),
            catv, catv, catv,
            lv, lv, lv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 14. MercadoLibre por Producto ─────────────────────────────────────────────

_SQL_ML_PRODUCTOS = """
SELECT
    v.PRODUCT_NAME AS PRODUCTO,
    SUM(CASE WHEN v.DATE_CREATED >= ? AND v.DATE_CREATED < DATEADD(DAY, 1, ?) THEN v.CANTIDAD ELSE 0 END) AS UNIDADES,
    SUM(CASE WHEN v.DATE_CREATED >= ? AND v.DATE_CREATED < DATEADD(DAY, 1, ?) THEN v.TOTAL_AMOUNT ELSE 0 END) AS VENTAS
FROM VENTAS_MERCADOLIBRE v
WHERE
    v.ESTADO = 'VENTA_COMPLETADA'
    AND (? IS NULL OR v.PRODUCT_NAME LIKE '%' + ? + '%')
    AND (? IS NULL OR ? = '' OR v.LOCAL = ?)
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
    lv = local if local and local.strip() else None
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_ML_PRODUCTOS, (
            str(fecha_desde), str(fecha_hasta),
            str(fecha_desde), str(fecha_hasta),
            pv, pv,
            lv, lv, lv,
        ))
        return {"fecha_desde": str(fecha_desde), "fecha_hasta": str(fecha_hasta), "rows": _rows_to_dicts(cursor)}
    finally:
        conn.close()


# ── 15. Locales disponibles (para filtros) ────────────────────────────────────

@router.get("/locales-disponibles")
def get_locales_disponibles(current_user: User = Depends(get_current_user)):
    """Devuelve lista de locales únicos disponibles en SQL Server para los filtros."""
    if current_user.role not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Sin permiso")
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL
            FROM VENTAS
            WHERE LOCAL IS NOT NULL AND LOCAL <> ''
            ORDER BY LOCAL
        """)
        return [row[0] for row in cursor.fetchall() if row[0]]
    finally:
        conn.close()
