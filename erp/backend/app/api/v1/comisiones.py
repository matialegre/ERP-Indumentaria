"""
comisiones.py — Módulo de comisiones por vendedor
===================================================
Calcula comisiones basadas en la cantidad de artículos por ticket:
  - 1 artículo : sin comisión
  - 2 artículos: $1.000
  - 3 artículos: $2.000
  - N artículos: (N-1) * $1.000

Fuente de datos: SQL Server 192.168.0.109:9970 / DATOS / VENTAS
"""

from datetime import date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User

# ── Conexión SQL Server (misma que sql_server.py) ─────────────────────────────

_CONN_STR = (
    "DRIVER={SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
)


def _get_conn():
    try:
        import pyodbc
        return pyodbc.connect(_CONN_STR, timeout=10)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"SQL Server no disponible: {exc}")


# ── Helpers de fechas ─────────────────────────────────────────────────────────

def _mes_anterior() -> tuple[date, date]:
    """Devuelve (primer_dia, ultimo_dia) del mes anterior."""
    hoy = date.today()
    primer_dia_este_mes = hoy.replace(day=1)
    ultimo_dia_mes_anterior = primer_dia_este_mes - timedelta(days=1)
    primer_dia_mes_anterior = ultimo_dia_mes_anterior.replace(day=1)
    return primer_dia_mes_anterior, ultimo_dia_mes_anterior


# ── Schemas ───────────────────────────────────────────────────────────────────

class VendedorResumen(BaseModel):
    vendedor: str
    total_tickets: int
    tickets_con_comision: int
    total_articulos: int
    total_comision: float
    model_config = {"from_attributes": True}


class ComisionesResumenOut(BaseModel):
    fecha_desde: str
    fecha_hasta: str
    vendedores: list[VendedorResumen]
    gran_total: float
    model_config = {"from_attributes": True}


class TicketDetalle(BaseModel):
    comprobante_numero: str
    comprobante_tipo: str
    cantidad_articulos: int
    comision_ticket: float
    model_config = {"from_attributes": True}


class VendedorDetalleOut(BaseModel):
    vendedor: str
    fecha_desde: str
    fecha_hasta: str
    tickets: list[TicketDetalle]
    total_comision: float
    model_config = {"from_attributes": True}


class FacturaItem(BaseModel):
    descripcion: str
    cantidad: float
    precio_unidad: float
    model_config = {"from_attributes": True}


class FacturaDetalleOut(BaseModel):
    comprobante_numero: str
    comprobante_tipo: str
    items: list[FacturaItem]
    model_config = {"from_attributes": True}


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/comisiones", tags=["Comisiones"])


def _build_sql_resumen(locales: List[str]) -> tuple[str, list]:
    local_filter = ""
    extra_params: list = []
    if locales:
        placeholders = ",".join("?" * len(locales))
        local_filter = f"        AND LOCAL IN ({placeholders})\n"
        extra_params = list(locales)

    sql = f"""
WITH DetallePorComprobante AS (
    SELECT
        VENDEDOR,
        COMPROBANTE_NUMERO,
        COMPROBANTE_TIPO,
        SUM(
            CASE 
                WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
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
{local_filter}    GROUP BY 
        VENDEDOR, 
        COMPROBANTE_NUMERO, 
        COMPROBANTE_TIPO
),
ComisionesCalculadas AS (
    SELECT 
        VENDEDOR,
        COMPROBANTE_NUMERO,
        COMPROBANTE_TIPO,
        CantidadArticulos,
        CASE 
            WHEN CantidadArticulos > 1 THEN (CantidadArticulos - 1) * 1000 
            ELSE 0 
        END AS ComisionTicket
    FROM DetallePorComprobante
)
SELECT 
    VENDEDOR,
    COUNT(*)                                          AS TotalTickets,
    SUM(CASE WHEN ComisionTicket > 0 THEN 1 ELSE 0 END) AS TicketsConComision,
    SUM(CantidadArticulos)                            AS TotalArticulos,
    SUM(ComisionTicket)                               AS TOTAL_COMISION
FROM ComisionesCalculadas
GROUP BY VENDEDOR
ORDER BY TOTAL_COMISION DESC
"""
    return sql, extra_params


def _build_sql_detalle(locales: List[str]) -> tuple[str, list]:
    local_filter = ""
    extra_params: list = []
    if locales:
        placeholders = ",".join("?" * len(locales))
        local_filter = f"        AND LOCAL IN ({placeholders})\n"
        extra_params = list(locales)

    sql = f"""
WITH DetallePorComprobante AS (
    SELECT
        VENDEDOR,
        COMPROBANTE_NUMERO,
        COMPROBANTE_TIPO,
        SUM(
            CASE 
                WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
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
{local_filter}    GROUP BY 
        VENDEDOR, 
        COMPROBANTE_NUMERO, 
        COMPROBANTE_TIPO
)
SELECT 
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    CantidadArticulos,
    CASE 
        WHEN CantidadArticulos > 1 THEN (CantidadArticulos - 1) * 1000 
        ELSE 0 
    END AS ComisionTicket
FROM DetallePorComprobante
WHERE VENDEDOR = ?
ORDER BY CantidadArticulos DESC, COMPROBANTE_NUMERO
"""
    return sql, extra_params


@router.get("/resumen", response_model=ComisionesResumenOut)
def get_comisiones_resumen(
    desde: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    hasta: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el resumen de comisiones agrupado por vendedor.
    Por defecto usa el mes anterior completo.
    """
    if desde and hasta:
        try:
            fecha_desde = date.fromisoformat(desde)
            fecha_hasta = date.fromisoformat(hasta)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")
    else:
        fecha_desde, fecha_hasta = _mes_anterior()

    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_RESUMEN, (str(fecha_desde), str(fecha_hasta)))
        rows = cursor.fetchall()

        vendedores = []
        gran_total = 0.0
        for row in rows:
            comision = float(row[4]) if row[4] else 0.0
            gran_total += comision
            vendedores.append(VendedorResumen(
                vendedor=str(row[0]).strip(),
                total_tickets=int(row[1]),
                tickets_con_comision=int(row[2]),
                total_articulos=int(row[3]) if row[3] else 0,
                total_comision=comision,
            ))

        return ComisionesResumenOut(
            fecha_desde=str(fecha_desde),
            fecha_hasta=str(fecha_hasta),
            vendedores=vendedores,
            gran_total=gran_total,
        )
    finally:
        conn.close()


@router.get("/detalle/{vendedor}", response_model=VendedorDetalleOut)
def get_comisiones_detalle(
    vendedor: str,
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el detalle ticket-a-ticket de las comisiones de un vendedor específico.
    """
    if desde and hasta:
        try:
            fecha_desde = date.fromisoformat(desde)
            fecha_hasta = date.fromisoformat(hasta)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")
    else:
        fecha_desde, fecha_hasta = _mes_anterior()

    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(_SQL_DETALLE, (str(fecha_desde), str(fecha_hasta), vendedor))
        rows = cursor.fetchall()

        tickets = []
        total = 0.0
        for row in rows:
            comision = float(row[3]) if row[3] else 0.0
            total += comision
            tickets.append(TicketDetalle(
                comprobante_numero=str(row[0]).strip() if row[0] else "",
                comprobante_tipo=str(row[1]).strip() if row[1] else "",
                cantidad_articulos=int(row[2]) if row[2] else 0,
                comision_ticket=comision,
            ))

        return VendedorDetalleOut(
            vendedor=vendedor,
            fecha_desde=str(fecha_desde),
            fecha_hasta=str(fecha_hasta),
            tickets=tickets,
            total_comision=total,
        )
    finally:
        conn.close()


@router.get("/factura/{comprobante_numero}", response_model=FacturaDetalleOut)
def get_factura_detalle(
    comprobante_numero: str,
    current_user: User = Depends(get_current_user),
):
    conn = _get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT DESCRIPCION, CANTIDAD, PRECIO_UNIDAD, COMPROBANTE_TIPO
            FROM VENTAS
            WHERE COMPROBANTE_NUMERO = ?
              AND PRECIO_UNIDAD > 10
            ORDER BY DESCRIPCION
            """,
            (comprobante_numero,),
        )
        rows = cursor.fetchall()
        items = []
        tipo = ""
        for row in rows:
            if not tipo and row[3]:
                tipo = str(row[3]).strip()
            items.append(FacturaItem(
                descripcion=str(row[0]).strip() if row[0] else "",
                cantidad=float(row[1]) if row[1] else 0.0,
                precio_unidad=float(row[2]) if row[2] else 0.0,
            ))
        return FacturaDetalleOut(
            comprobante_numero=comprobante_numero,
            comprobante_tipo=tipo,
            items=items,
        )
    finally:
        conn.close()
