"""
Integración directa con SQL Server (192.168.0.109:9970 - base DATOS).
  - Health check
  - Búsqueda de RV por número de documento
  - Re-asociación de remito_venta_number en PurchaseInvoices
  - Precio de compra por código de barras
  - Detalle de artículo por código de barras
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import pyodbc

from app.db.session import get_db
from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceStatus
from app.models.user import User
from app.api.deps import get_current_user

# ── Conexión ───────────────────────────────────────────

SERVER = "192.168.0.109"
PORT = 9970
DATABASE = "DATOS"
UID = "MUNDO"
PWD = "sanmartin126"

_CONN_STR = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={SERVER},{PORT};"
    f"DATABASE={DATABASE};"
    f"UID={UID};"
    f"PWD={PWD};"
    f"TrustServerCertificate=yes"
)


def _get_sql_connection():
    """Abre conexión a SQL Server. Lanza HTTPException 503 si no disponible."""
    try:
        return pyodbc.connect(_CONN_STR, timeout=10)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"SQL Server no disponible: {exc}",
        )


# ── Schemas ────────────────────────────────────────────

class HealthOut(BaseModel):
    status: str
    remitos_count: int
    message: str
    model_config = {"from_attributes": True}


class BuscarRVOut(BaseModel):
    numero_doc: str
    rv_encontrados: list[int]
    count: int
    model_config = {"from_attributes": True}


class RVResultItem(BaseModel):
    invoice_id: int
    invoice_number: str
    rv_found: Optional[int] = None
    action: str  # SET | PROPAGATE | ALREADY_HAS | NO_MATCH
    model_config = {"from_attributes": True}


class ReAsociarPreviewOut(BaseModel):
    results: list[RVResultItem]
    model_config = {"from_attributes": True}


class ReAsociarEjecutarOut(BaseModel):
    results: list[RVResultItem]
    updated: int
    unchanged: int
    model_config = {"from_attributes": True}


class PrecioCompraBody(BaseModel):
    codigo: str
    fecha: str  # YYYY-MM-DD


class PrecioCompraOut(BaseModel):
    codigo: str
    precio_compra: Optional[float] = None
    fecha_precio: Optional[str] = None
    encontrado: bool
    model_config = {"from_attributes": True}


class ArticuloBody(BaseModel):
    codigo_barras: str


class ArticuloOut(BaseModel):
    codigo_barras: str
    color_descripcion: Optional[str] = None
    talle_descripcion: Optional[str] = None
    codigo_articulo: Optional[str] = None
    descripcion: Optional[str] = None
    encontrado: bool
    model_config = {"from_attributes": True}


# ── Router ─────────────────────────────────────────────

router = APIRouter(prefix="/sql-server", tags=["SQL Server"])


# ── Helpers ────────────────────────────────────────────

def _fetch_sql_remitos(conn) -> list[tuple]:
    """Trae todos los (NroInterno, Comentarios) de REMITOS con Comentarios no vacíos."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT NroInterno, RTRIM(Comentarios) as Comentarios "
        "FROM REMITOS WHERE Comentarios IS NOT NULL AND Comentarios != '' "
        "ORDER BY NroInterno DESC"
    )
    return cursor.fetchall()


def _build_rv_plan(
    invoices: list[PurchaseInvoice],
    sql_remitos: list[tuple],
) -> dict[int, tuple[str, str]]:
    """
    Devuelve dict: invoice_id -> (rv_str, action)
    action: SET | PROPAGATE | ALREADY_HAS | NO_MATCH
    """
    by_id = {inv.id: inv for inv in invoices}
    rv_map: dict[int, str] = {}      # invoice_id -> rv (str)
    action_map: dict[int, str] = {}  # invoice_id -> action

    # Fase 1: invoices que ya tienen RV
    for inv in invoices:
        if inv.remito_venta_number:
            rv_map[inv.id] = inv.remito_venta_number
            action_map[inv.id] = "ALREADY_HAS"

    # Fase 2: búsqueda directa en SQL Server Comentarios
    for inv in invoices:
        if inv.id in rv_map:
            continue
        nro = (inv.number or "").strip()
        if not nro:
            continue
        best_rv = None
        for nro_int, com in sql_remitos:
            if nro in (com or ""):
                if best_rv is None or nro_int > best_rv:
                    best_rv = nro_int
        if best_rv is not None:
            rv_map[inv.id] = str(best_rv)
            action_map[inv.id] = "SET"

    # Fase 3: propagación bidireccional iterativa
    changed = True
    while changed:
        changed = False
        for inv in invoices:
            if inv.id in rv_map:
                continue

            # forward: este doc apunta a otro con RV
            if inv.linked_to_id and inv.linked_to_id in rv_map:
                rv_map[inv.id] = rv_map[inv.linked_to_id]
                action_map[inv.id] = "PROPAGATE"
                changed = True
                continue

            # reverse: otro doc apunta a este y ya tiene RV
            for other in invoices:
                if other.linked_to_id == inv.id and other.id in rv_map:
                    rv_map[inv.id] = rv_map[other.id]
                    action_map[inv.id] = "PROPAGATE"
                    changed = True
                    break

    return {inv_id: (rv_map[inv_id], action_map[inv_id]) for inv_id in rv_map}


# ── Endpoints ──────────────────────────────────────────

@router.get("/health", response_model=HealthOut)
def sql_server_health(current_user: User = Depends(get_current_user)):
    """Verifica la conexión a SQL Server y devuelve el conteo de REMITOS."""
    conn = _get_sql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM REMITOS")
        count = cursor.fetchone()[0]
        return HealthOut(status="ok", remitos_count=count, message="Conexión exitosa")
    except Exception as exc:
        return HealthOut(status="error", remitos_count=0, message=str(exc))
    finally:
        conn.close()


@router.get("/buscar-rv/{numero_doc}", response_model=BuscarRVOut)
def buscar_rv(
    numero_doc: str,
    current_user: User = Depends(get_current_user),
):
    """Busca NroInterno de REMITOS cuyo campo Comentarios contenga el número de documento dado."""
    conn = _get_sql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT DISTINCT NroInterno FROM REMITOS "
            "WHERE Comentarios LIKE ? AND Comentarios IS NOT NULL",
            (f"%{numero_doc}%",),
        )
        rows = cursor.fetchall()
        rv_list = [int(row[0]) for row in rows]
        return BuscarRVOut(numero_doc=numero_doc, rv_encontrados=rv_list, count=len(rv_list))
    finally:
        conn.close()


@router.post("/re-asociar-rv/preview", response_model=ReAsociarPreviewOut)
def re_asociar_rv_preview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DRY RUN: calcula qué remito_venta_number se asignaría a cada factura de compra
    sin modificar la base de datos PostgreSQL.
    """
    invoices = (
        db.query(PurchaseInvoice)
        .filter(PurchaseInvoice.status != PurchaseInvoiceStatus.ANULADO)
        .all()
    )

    conn = _get_sql_connection()
    try:
        sql_remitos = _fetch_sql_remitos(conn)
    finally:
        conn.close()

    plan = _build_rv_plan(invoices, sql_remitos)
    by_id = {inv.id: inv for inv in invoices}

    results: list[RVResultItem] = []
    for inv in invoices:
        if inv.id in plan:
            rv_str, action = plan[inv.id]
            rv_int = None
            try:
                rv_int = int(rv_str)
            except (ValueError, TypeError):
                pass
            results.append(RVResultItem(
                invoice_id=inv.id,
                invoice_number=inv.number or "",
                rv_found=rv_int,
                action=action,
            ))
        else:
            results.append(RVResultItem(
                invoice_id=inv.id,
                invoice_number=inv.number or "",
                rv_found=None,
                action="NO_MATCH",
            ))

    return ReAsociarPreviewOut(results=results)


@router.post("/re-asociar-rv/ejecutar", response_model=ReAsociarEjecutarOut)
def re_asociar_rv_ejecutar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ejecuta la re-asociación: actualiza remito_venta_number en PostgreSQL para
    facturas de compra que tengan coincidencia en SQL Server o propagación de vínculo.
    """
    invoices = (
        db.query(PurchaseInvoice)
        .filter(PurchaseInvoice.status != PurchaseInvoiceStatus.ANULADO)
        .all()
    )

    conn = _get_sql_connection()
    try:
        sql_remitos = _fetch_sql_remitos(conn)
    finally:
        conn.close()

    plan = _build_rv_plan(invoices, sql_remitos)

    results: list[RVResultItem] = []
    updated = 0
    unchanged = 0

    for inv in invoices:
        if inv.id in plan:
            rv_str, action = plan[inv.id]
            rv_int = None
            try:
                rv_int = int(rv_str)
            except (ValueError, TypeError):
                pass

            results.append(RVResultItem(
                invoice_id=inv.id,
                invoice_number=inv.number or "",
                rv_found=rv_int,
                action=action,
            ))

            if action != "ALREADY_HAS" and rv_str:
                inv.remito_venta_number = rv_str
                updated += 1
            else:
                unchanged += 1
        else:
            results.append(RVResultItem(
                invoice_id=inv.id,
                invoice_number=inv.number or "",
                rv_found=None,
                action="NO_MATCH",
            ))
            unchanged += 1

    db.commit()
    return ReAsociarEjecutarOut(results=results, updated=updated, unchanged=unchanged)


@router.post("/precio-compra", response_model=PrecioCompraOut)
def precio_compra(
    body: PrecioCompraBody,
    current_user: User = Depends(get_current_user),
):
    """Devuelve el precio de compra más reciente para un código de barras hasta la fecha dada."""
    conn = _get_sql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT TOP 1 PRECIOS, NombreListaPrecio, fecha "
            "FROM LISTAPRECIOS "
            "WHERE CodBarrasEditable = ? "
            "  AND NombreListaPrecio = 'PRECIO DE COMPRA' "
            "  AND fecha <= ? "
            "ORDER BY fecha DESC",
            (body.codigo, body.fecha),
        )
        row = cursor.fetchone()
        if row:
            precio = float(row[0]) if row[0] is not None else None
            fecha_str = str(row[2])[:10] if row[2] else None
            return PrecioCompraOut(
                codigo=body.codigo,
                precio_compra=precio,
                fecha_precio=fecha_str,
                encontrado=True,
            )
        return PrecioCompraOut(codigo=body.codigo, encontrado=False)
    finally:
        conn.close()


@router.post("/articulo", response_model=ArticuloOut)
def get_articulo(
    body: ArticuloBody,
    current_user: User = Depends(get_current_user),
):
    """Devuelve el detalle de un artículo buscando por código de barras en SQL Server."""
    conn = _get_sql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT RTRIM(COLOR_DESCRIPCION), RTRIM(TALLE_DESCRIPCION), "
            "RTRIM(CODIGO_ARTICULO), RTRIM(CODIGO_BARRAS), RTRIM(DESCRIPCION) "
            "FROM ARTICULOS WHERE RTRIM(CODIGO_BARRAS) = ?",
            (body.codigo_barras,),
        )
        row = cursor.fetchone()
        if row:
            return ArticuloOut(
                codigo_barras=body.codigo_barras,
                color_descripcion=row[0],
                talle_descripcion=row[1],
                codigo_articulo=row[2],
                descripcion=row[4],
                encontrado=True,
            )
        return ArticuloOut(codigo_barras=body.codigo_barras, encontrado=False)
    finally:
        conn.close()
