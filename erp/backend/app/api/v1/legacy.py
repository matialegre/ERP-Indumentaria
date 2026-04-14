"""
Router para consultas sobre datos legacy (copiados desde SQL Server al schema legacy.*)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db, get_current_user
from app.models.user import User
from typing import Optional
import datetime

router = APIRouter(prefix="/legacy", tags=["legacy"])


@router.get("/buscar-rv")
def buscar_rv(
    numero: str = Query(..., description="Número de remito de compra (ej: R00002-00122864)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Busca el NroInterno (RV) en legacy.remitos cuyo campo comentarios contiene el número dado.
    Retorna todos los matches con sus fechas y cantidades.
    """
    result = db.execute(
        text(
            "SELECT DISTINCT nro_interno, MIN(fecha) as fecha, SUM(cantidad) as cantidad_total, COUNT(*) as items "
            "FROM legacy.remitos WHERE comentarios ILIKE :pat "
            "GROUP BY nro_interno ORDER BY fecha DESC"
        ),
        {"pat": f"%{numero}%"},
    ).fetchall()

    if not result:
        return {"found": False, "numero": numero, "matches": []}

    return {
        "found": True,
        "numero": numero,
        "matches": [
            {
                "nro_interno": r[0],
                "fecha": r[1].isoformat() if r[1] else None,
                "cantidad_total": float(r[2] or 0),
                "items": r[3],
            }
            for r in result
        ],
    }


@router.get("/precio/{cod_barras}")
def get_precio(
    cod_barras: str,
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD — precio vigente a esa fecha. Default: hoy"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna todos los precios vigentes para un código de barras.
    Incluye: precio_compra, precio_venta, precio_ml, descripcion, marca.
    """
    fecha_limite = fecha or datetime.date.today().isoformat()

    rows = db.execute(
        text("""
            SELECT DISTINCT ON (nombre_lista)
                nombre_lista, precio, marca, descripcion, fecha
            FROM legacy.listaprecios
            WHERE cod_barras = :cod AND fecha <= :fecha
            ORDER BY nombre_lista, fecha DESC
        """),
        {"cod": cod_barras, "fecha": fecha_limite},
    ).fetchall()

    if not rows:
        return {"found": False, "cod_barras": cod_barras, "precios": {}}

    precios = {}
    descripcion = None
    marca = None
    for r in rows:
        precios[r[0]] = float(r[1] or 0)
        descripcion = descripcion or r[3]
        marca = marca or r[2]

    return {
        "found": True,
        "cod_barras": cod_barras,
        "descripcion": descripcion,
        "marca": marca,
        "precios": precios,
        "precio_compra": precios.get("PRECIO DE COMPRA"),
        "precio_venta": precios.get("Ventas Publico"),
        "precio_ml": precios.get("Precio Mercado Libre"),
    }


@router.get("/stock/{cod_barras}")
def get_stock(
    cod_barras: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stock actual de un artículo por código de barras, desglosado por local.
    """
    rows = db.execute(
        text("""
            SELECT local, descripcion, talle, color, cantidad, marca, proveedor, codigo_articulo
            FROM legacy.articulos
            WHERE codigo_barras = :cod AND cantidad > 0
            ORDER BY local, talle
        """),
        {"cod": cod_barras},
    ).fetchall()

    if not rows:
        return {"found": False, "cod_barras": cod_barras, "stock_total": 0, "por_local": []}

    descripcion = rows[0][1]
    marca = rows[0][5]

    return {
        "found": True,
        "cod_barras": cod_barras,
        "descripcion": descripcion,
        "marca": marca,
        "stock_total": sum(r[4] for r in rows if r[4]),
        "por_local": [
            {"local": r[0], "talle": r[2], "color": r[3], "cantidad": r[4], "proveedor": r[6]}
            for r in rows
        ],
    }


@router.get("/buscar-producto")
def buscar_producto(
    q: str = Query(..., min_length=3, description="Texto a buscar en descripcion o codigo"),
    local: Optional[str] = Query(None),
    con_stock: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Busca artículos por descripción, código de barras, o código de artículo.
    Agrupa por código de artículo mostrando stock total.
    """
    cond_stock = "AND cantidad > 0" if con_stock else ""
    cond_local = "AND local = :local" if local else ""

    rows = db.execute(
        text(f"""
            SELECT codigo_barras, descripcion, marca, proveedor, talle, color,
                   SUM(cantidad) as stock_total, local
            FROM legacy.articulos
            WHERE (descripcion ILIKE :q OR codigo_barras ILIKE :q OR codigo_articulo ILIKE :q)
            {cond_stock} {cond_local}
            GROUP BY codigo_barras, descripcion, marca, proveedor, talle, color, local
            ORDER BY stock_total DESC
            LIMIT 100
        """),
        {"q": f"%{q}%", "local": local},
    ).fetchall()

    return {
        "query": q,
        "total": len(rows),
        "results": [
            {
                "cod_barras": r[0],
                "descripcion": r[1],
                "marca": r[2],
                "proveedor": r[3],
                "talle": r[4],
                "color": r[5],
                "stock": r[6],
                "local": r[7],
            }
            for r in rows
        ],
    }


@router.post("/comparar-precios")
def comparar_precios(
    items: list[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compara precio de compra en fecha NP vs fecha factura para detectar aumentos.
    Input: lista de {cod_barras, fecha_np, fecha_fac}
    """

    def get_precio_at(cod, fecha):
        row = db.execute(
            text("""
                SELECT precio FROM legacy.listaprecios
                WHERE cod_barras = :cod AND nombre_lista = 'PRECIO DE COMPRA' AND fecha <= :f
                ORDER BY fecha DESC LIMIT 1
            """),
            {"cod": cod, "f": fecha},
        ).fetchone()
        return float(row[0]) if row else None

    results = []
    for item in items:
        cod = item.get("cod_barras")
        fecha_np = item.get("fecha_np")
        fecha_fac = item.get("fecha_fac")

        p_np = get_precio_at(cod, fecha_np)
        p_fac = get_precio_at(cod, fecha_fac)
        diferencia = None
        pct = None
        if p_np and p_fac:
            diferencia = p_fac - p_np
            pct = round((diferencia / p_np) * 100, 2) if p_np > 0 else None

        results.append({
            "cod_barras": cod,
            "precio_np": p_np,
            "precio_fac": p_fac,
            "diferencia": diferencia,
            "pct_cambio": pct,
            "alerta": pct is not None and abs(pct) > 5,
        })

    return results


@router.get("/locales")
def get_locales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista de locales del sistema legacy."""
    rows = db.execute(
        text("SELECT local, empresa, tipo, localidad, apertura, cierre FROM legacy.locales ORDER BY local")
    ).fetchall()
    return [
        {
            "local": r[0],
            "empresa": r[1],
            "tipo": r[2],
            "localidad": r[3],
            "apertura": str(r[4]) if r[4] else None,
            "cierre": str(r[5]) if r[5] else None,
        }
        for r in rows
    ]


@router.get("/stats")
def get_legacy_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats rápidos del legacy para mostrar en dashboard."""
    total_articulos = db.execute(
        text("SELECT COUNT(DISTINCT codigo_barras) FROM legacy.articulos WHERE cantidad > 0")
    ).scalar()
    total_stock_units = db.execute(
        text("SELECT SUM(cantidad) FROM legacy.articulos WHERE cantidad > 0")
    ).scalar()
    total_locales = db.execute(text("SELECT COUNT(*) FROM legacy.locales")).scalar()
    total_remitos_rv = db.execute(
        text("SELECT COUNT(DISTINCT nro_interno) FROM legacy.remitos WHERE nro_interno IS NOT NULL")
    ).scalar()

    total_ventas_30d = db.execute(
        text("SELECT COUNT(DISTINCT comprobante_numero) FROM legacy.ventas WHERE fecha >= NOW() - INTERVAL '30 days'")
    ).scalar()
    total_monto_30d = db.execute(
        text("SELECT SUM(precio_unidad * cantidad_vendida) FROM legacy.ventas WHERE fecha >= NOW() - INTERVAL '30 days' AND local NOT ILIKE '%DRAGONFISH%'")
    ).scalar()
    total_stock_unidades = db.execute(
        text("SELECT SUM(stock) FROM legacy.stocks WHERE stock > 0")
    ).scalar()

    return {
        "articulos_con_stock": total_articulos,
        "unidades_en_stock": int(total_stock_units or 0),
        "locales": total_locales,
        "rvs_registrados": total_remitos_rv,
        "ventas_30d": total_ventas_30d or 0,
        "monto_ventas_30d": float(total_monto_30d or 0),
        "unidades_stock_real": int(total_stock_unidades or 0),
    }


@router.get("/stocks/resumen")
def get_stocks_resumen(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumen de stock total y valor por local."""
    rows = db.execute(
        text("""
            SELECT local,
                   COUNT(*) as variantes,
                   SUM(stock) as unidades,
                   SUM(stock * precio) as valor_venta,
                   SUM(stock * costo) as valor_costo,
                   COUNT(CASE WHEN stock <= 0 THEN 1 END) as sin_stock,
                   COUNT(CASE WHEN stock BETWEEN 1 AND 3 THEN 1 END) as stock_bajo
            FROM legacy.stocks
            WHERE local NOT ILIKE '%DRAGONFISH%'
            GROUP BY local
            ORDER BY unidades DESC
        """)
    ).fetchall()

    return {"por_local": [
        {"local": r[0], "variantes": r[1], "unidades": r[2],
         "valor_venta": float(r[3] or 0), "valor_costo": float(r[4] or 0),
         "sin_stock": r[5], "stock_bajo": r[6]}
        for r in rows
    ]}


@router.get("/stocks/{cod_barras}")
def get_stock_real(
    cod_barras: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stock real desde la tabla STOCKS (más actualizada que ARTICULOS)."""
    rows = db.execute(
        text("""
            SELECT local, descripcion, codigo_color, codigo_talle, stock, precio, costo, marca, proveedor
            FROM legacy.stocks
            WHERE codigo_barra = :cod
            ORDER BY local, codigo_talle
        """),
        {"cod": cod_barras}
    ).fetchall()

    if not rows:
        return {"found": False, "cod_barras": cod_barras, "stock_total": 0, "por_local": []}

    return {
        "found": True, "cod_barras": cod_barras,
        "descripcion": rows[0][1], "marca": rows[0][7],
        "precio": float(rows[0][5] or 0), "costo": float(rows[0][6] or 0),
        "stock_total": sum(r[4] for r in rows if r[4]),
        "por_local": [
            {"local": r[0], "color": r[2], "talle": r[3], "stock": r[4],
             "precio": float(r[5] or 0), "costo": float(r[6] or 0)}
            for r in rows
        ]
    }


@router.get("/ventas/por-local")
def ventas_por_local(
    dias: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumen de ventas agrupado por local, últimos N días."""
    rows = db.execute(
        text(f"SELECT local, COUNT(*) as transacciones, SUM(cantidad_vendida) as unidades, SUM(precio_unidad * cantidad_vendida) as total_bruto, SUM(monto_neto_siniva) as total_neto, COUNT(DISTINCT comprobante_numero) as comprobantes FROM legacy.ventas WHERE fecha >= NOW() - INTERVAL '{dias} days' AND local NOT ILIKE '%DRAGONFISH%' AND local NOT ILIKE '%MELI%' AND local NOT ILIKE '%WOO%' GROUP BY local ORDER BY SUM(precio_unidad * cantidad_vendida) DESC")
    ).fetchall()

    total = sum(float(r[3] or 0) for r in rows)
    return {
        "dias": dias,
        "total_bruto": total,
        "por_local": [
            {
                "local": r[0], "transacciones": r[1], "unidades": r[2],
                "total_bruto": float(r[3] or 0), "total_neto": float(r[4] or 0),
                "comprobantes": r[5],
                "pct": round(float(r[3] or 0) / total * 100, 1) if total else 0,
            }
            for r in rows
        ]
    }


@router.get("/ventas/top-productos")
def ventas_top_productos(
    dias: int = Query(30, ge=1, le=365),
    local: Optional[str] = Query(None),
    limit: int = Query(20, ge=5, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top productos por unidades vendidas."""
    where_local = f"AND local = '{local}'" if local else ""
    rows = db.execute(
        text(f"""
            SELECT articulo_descripcion, marca,
                   SUM(cantidad_vendida) as unidades,
                   SUM(precio_unidad * cantidad_vendida) as total,
                   AVG(precio_unidad) as precio_avg
            FROM legacy.ventas
            WHERE fecha >= NOW() - INTERVAL '{dias} days'
              {where_local}
              AND articulo_descripcion NOT ILIKE '%BOLSA%'
              AND articulo_descripcion NOT ILIKE '%INTERESES%'
            GROUP BY articulo_descripcion, marca
            ORDER BY unidades DESC
            LIMIT {limit}
        """)
    ).fetchall()

    return {
        "dias": dias, "local": local,
        "items": [
            {"descripcion": r[0], "marca": r[1], "unidades": r[2],
             "total": float(r[3] or 0), "precio_avg": float(r[4] or 0)}
            for r in rows
        ]
    }


@router.get("/ventas/top-vendedores")
def ventas_top_vendedores(
    dias: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(
        text(f"""
            SELECT vendedor, local,
                   COUNT(DISTINCT comprobante_numero) as ventas,
                   SUM(cantidad_vendida) as unidades,
                   SUM(precio_unidad * cantidad_vendida) as total
            FROM legacy.ventas
            WHERE fecha >= NOW() - INTERVAL '{dias} days'
              AND vendedor IS NOT NULL AND vendedor != ''
            GROUP BY vendedor, local
            ORDER BY total DESC
            LIMIT 20
        """)
    ).fetchall()

    return {"dias": dias, "items": [
        {"vendedor": r[0], "local": r[1], "ventas": r[2], "unidades": r[3], "total": float(r[4] or 0)}
        for r in rows
    ]}
