"""
Router DEPOSITO — Gestión de depósito para indumentaria

Endpoints:
  GET  /deposito/resumen               — dashboard: stock por local + alertas
  GET  /deposito/stock-por-local       — stock de todas las variantes, agrupado por local
  GET  /deposito/stock-por-local/{lid} — stock de un local específico
  POST /deposito/transferencias        — crear transferencia (estado: BORRADOR)
  GET  /deposito/transferencias        — listar transferencias con filtros
  GET  /deposito/transferencias/{id}   — detalle con items
  PATCH /deposito/transferencias/{id}/confirmar — confirmar envío (descuenta origen)
  PATCH /deposito/transferencias/{id}/recibir   — confirmar recepción (suma destino)
  PATCH /deposito/transferencias/{id}/anular    — anular (revierte si estaba CONFIRMADA)
  GET  /deposito/alertas               — variantes con stock bajo mínimo por local
  POST /deposito/conteos               — iniciar conteo físico
  GET  /deposito/conteos               — listar conteos
  GET  /deposito/conteos/{id}          — detalle + items
  PATCH /deposito/conteos/{id}/item    — actualizar stock físico de un ítem
  POST /deposito/conteos/{id}/aplicar  — aplicar diferencias → StockMovement
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel, Field
from datetime import date

from app.db.session import get_db
from app.models.deposito import (
    StockLocal, Transferencia, TransferenciaItem,
    ConteoInventario, ConteoItem,
    TransferenciaEstado, ConteoEstado,
    DepositoTarea, TareaEstado, TareaPrioridad,
)
from app.models.product import Product, ProductVariant
from app.models.stock_movement import StockMovement, MovementType
from app.models.local import Local
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles


router = APIRouter(prefix="/deposito", tags=["Depósito"])

_DEPOSITO_ROLES = (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPOSITO)
_DEPOSITO_VER   = (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DEPOSITO, UserRole.COMPRAS, UserRole.LOCAL)


# ══════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════

def _company(user: User) -> int | None:
    return user.company_id


def _next_trf_number(db: Session, company_id: int) -> str:
    count = db.query(func.count(Transferencia.id)).filter(
        Transferencia.company_id == company_id
    ).scalar() or 0
    return f"TRF-{(count + 1):05d}"


def _next_conteo_number(db: Session, company_id: int) -> str:
    count = db.query(func.count(ConteoInventario.id)).filter(
        ConteoInventario.company_id == company_id
    ).scalar() or 0
    return f"CNT-{(count + 1):05d}"


def _get_or_create_stock_local(
    db: Session, variant_id: int, local_id: int | None, company_id: int
) -> StockLocal:
    sl = db.query(StockLocal).filter(
        StockLocal.variant_id == variant_id,
        StockLocal.local_id == local_id,
        StockLocal.company_id == company_id,
    ).first()
    if not sl:
        sl = StockLocal(
            variant_id=variant_id, local_id=local_id,
            company_id=company_id, cantidad=0,
        )
        db.add(sl)
        db.flush()
    return sl


# ══════════════════════════════════════════════════════
#  SCHEMAS
# ══════════════════════════════════════════════════════

class StockLocalOut(BaseModel):
    variant_id:   int
    sku:          str
    barcode:      str | None = None
    size:         str
    color:        str
    product_id:   int
    product_code: str
    product_name: str
    brand:        str | None = None
    categoria:    str | None = None
    local_id:     int | None
    local_name:   str | None
    cantidad:     int
    model_config = {"from_attributes": True}


class TransferenciaItemIn(BaseModel):
    variant_id:       int
    cantidad_enviada: int = Field(..., ge=1)
    notas_item:       str | None = None


class TransferenciaIn(BaseModel):
    origen_local_id:  int | None = None   # None = depósito central
    destino_local_id: int | None = None   # None = depósito central
    notas:            str | None = None
    items:            list[TransferenciaItemIn]


class TransferenciaItemOut(BaseModel):
    id:               int
    variant_id:       int
    sku:              str
    product_name:     str
    size:             str
    color:            str
    cantidad_enviada: int
    cantidad_recibida: int | None = None
    notas_item:       str | None = None
    model_config = {"from_attributes": True}


class TransferenciaOut(BaseModel):
    id:                int
    numero:            str
    estado:            str
    origen_local_id:   int | None
    origen_local_name: str | None
    destino_local_id:  int | None
    destino_local_name: str | None
    notas:             str | None
    creado_por_name:   str | None
    created_at:        str
    items:             list[TransferenciaItemOut] = []
    model_config = {"from_attributes": True}


class RecibirItemIn(BaseModel):
    item_id:           int
    cantidad_recibida: int = Field(..., ge=0)


class RecibirIn(BaseModel):
    items: list[RecibirItemIn]


class ConteoIn(BaseModel):
    local_id: int | None = None   # None = depósito central
    notas:    str | None = None


class ConteoItemUpdate(BaseModel):
    stock_fisico: int = Field(..., ge=0)


class ConteoItemOut(BaseModel):
    id:            int
    variant_id:    int
    sku:           str
    product_name:  str
    size:          str
    color:         str
    stock_sistema: int
    stock_fisico:  int | None
    diferencia:    int | None
    ajustado:      bool
    model_config = {"from_attributes": True}


class ConteoOut(BaseModel):
    id:           int
    local_id:     int | None
    local_name:   str | None
    estado:       str
    notas:        str | None
    creado_por:   str | None
    created_at:   str
    total_items:  int
    items_contados: int
    items:        list[ConteoItemOut] = []
    model_config = {"from_attributes": True}


class AlertaItem(BaseModel):
    variant_id:   int
    sku:          str
    product_name: str
    size:         str
    color:        str
    local_id:     int | None
    local_name:   str | None
    cantidad:     int
    umbral:       int


# ══════════════════════════════════════════════════════
#  RESUMEN / DASHBOARD
# ══════════════════════════════════════════════════════

@router.get("/resumen")
def resumen_deposito(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_DEPOSITO_VER)),
):
    """Dashboard: totales de stock por local + alertas críticas."""
    cid = _company(user)

    # Locales de la empresa
    locales = db.query(Local).filter(Local.company_id == cid, Local.is_active == True).all()

    # Stock total global
    q = db.query(ProductVariant).join(Product).filter(Product.company_id == cid)
    total_unidades = q.with_entities(
        func.coalesce(func.sum(ProductVariant.stock), 0)
    ).scalar()
    total_variantes = q.count()
    sin_stock = q.filter(ProductVariant.stock <= 0).count()
    stock_bajo = q.filter(ProductVariant.stock.between(1, 4)).count()

    # Stock por local (desde stock_by_local)
    por_local = []
    for local in locales:
        total_local = db.query(
            func.coalesce(func.sum(StockLocal.cantidad), 0)
        ).filter(
            StockLocal.local_id == local.id,
            StockLocal.company_id == cid,
        ).scalar()
        por_local.append({
            "local_id":   local.id,
            "local_name": local.name,
            "local_code": local.code,
            "total":      int(total_local),
        })

    # Depósito central (local_id = None)
    total_deposito = db.query(
        func.coalesce(func.sum(StockLocal.cantidad), 0)
    ).filter(
        StockLocal.local_id == None,
        StockLocal.company_id == cid,
    ).scalar()
    por_local.insert(0, {
        "local_id":   None,
        "local_name": "Depósito Central",
        "local_code": "DEPOSITO",
        "total":      int(total_deposito),
    })

    # Transferencias recientes (últimas 5)
    trf_recientes = db.query(Transferencia).filter(
        Transferencia.company_id == cid
    ).order_by(Transferencia.created_at.desc()).limit(5).all()

    transferencias_recientes = [
        {
            "id":      t.id,
            "numero":  t.numero,
            "estado":  t.estado.value,
            "origen":  t.origen_local.name if t.origen_local else "Depósito Central",
            "destino": t.destino_local.name if t.destino_local else "Depósito Central",
            "created_at": t.created_at.isoformat(),
        }
        for t in trf_recientes
    ]

    return {
        "stock_global": {
            "total_unidades":   int(total_unidades),
            "total_variantes":  total_variantes,
            "sin_stock":        sin_stock,
            "stock_bajo":       stock_bajo,
        },
        "stock_por_local":            por_local,
        "transferencias_recientes":   transferencias_recientes,
    }


# ══════════════════════════════════════════════════════
#  STOCK POR LOCAL
# ══════════════════════════════════════════════════════

@router.get("/stock-por-local")
def stock_por_local(
    local_id:  Optional[int]  = Query(None),
    search:    Optional[str]  = Query(None),
    categoria: Optional[str]  = Query(None),
    skip:      int             = Query(0, ge=0),
    limit:     int             = Query(50, ge=1, le=500),
    db:        Session         = Depends(get_db),
    user:      User            = Depends(require_roles(*_DEPOSITO_VER)),
):
    """
    Lista stock de variantes en una ubicación.
    Si local_id no se indica, devuelve el depósito central (local_id=None).
    """
    cid = _company(user)
    q = db.query(StockLocal).join(
        ProductVariant, StockLocal.variant_id == ProductVariant.id
    ).join(
        Product, ProductVariant.product_id == Product.id
    ).filter(
        StockLocal.company_id == cid,
        StockLocal.local_id == local_id,
    )

    if search:
        term = f"%{search}%"
        q = q.filter(
            Product.name.ilike(term) |
            Product.code.ilike(term) |
            ProductVariant.sku.ilike(term) |
            ProductVariant.color.ilike(term)
        )
    if categoria:
        q = q.filter(Product.category.ilike(f"%{categoria}%"))

    total = q.count()
    rows  = q.order_by(Product.name, ProductVariant.size).offset(skip).limit(limit).all()

    local_name = None
    if local_id:
        loc = db.query(Local).get(local_id)
        local_name = loc.name if loc else None
    else:
        local_name = "Depósito Central"

    items = [
        StockLocalOut(
            variant_id   = sl.variant_id,
            sku          = sl.variant.sku,
            barcode      = sl.variant.barcode,
            size         = sl.variant.size,
            color        = sl.variant.color,
            product_id   = sl.variant.product_id,
            product_code = sl.variant.product.code,
            product_name = sl.variant.product.name,
            brand        = sl.variant.product.brand,
            categoria    = sl.variant.product.category,
            local_id     = local_id,
            local_name   = local_name,
            cantidad     = sl.cantidad,
        )
        for sl in rows
    ]
    return {"items": items, "total": total, "skip": skip, "limit": limit,
            "local_id": local_id, "local_name": local_name}


# ══════════════════════════════════════════════════════
#  TRANSFERENCIAS
# ══════════════════════════════════════════════════════

def _trf_out(t: Transferencia) -> dict:
    return TransferenciaOut(
        id                 = t.id,
        numero             = t.numero,
        estado             = t.estado.value,
        origen_local_id    = t.origen_local_id,
        origen_local_name  = t.origen_local.name if t.origen_local else "Depósito Central",
        destino_local_id   = t.destino_local_id,
        destino_local_name = t.destino_local.name if t.destino_local else "Depósito Central",
        notas              = t.notas,
        creado_por_name    = t.creado_por.full_name if t.creado_por else None,
        created_at         = t.created_at.isoformat(),
        items=[
            TransferenciaItemOut(
                id               = i.id,
                variant_id       = i.variant_id,
                sku              = i.variant.sku,
                product_name     = i.variant.product.name,
                size             = i.variant.size,
                color            = i.variant.color,
                cantidad_enviada = i.cantidad_enviada,
                cantidad_recibida= i.cantidad_recibida,
                notas_item       = i.notas_item,
            )
            for i in t.items
        ]
    ).model_dump()


@router.post("/transferencias", status_code=201)
def crear_transferencia(
    data: TransferenciaIn,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """Crea una transferencia en estado BORRADOR."""
    cid = _company(user)

    if data.origen_local_id == data.destino_local_id:
        raise HTTPException(400, "Origen y destino deben ser distintos")
    if not data.items:
        raise HTTPException(400, "Debe incluir al menos un ítem")

    # Verificar variantes pertenecen a la empresa
    for it in data.items:
        v = db.query(ProductVariant).join(Product).filter(
            ProductVariant.id == it.variant_id,
            Product.company_id == cid,
        ).first()
        if not v:
            raise HTTPException(404, f"Variante {it.variant_id} no encontrada")

    numero = _next_trf_number(db, cid)
    trf = Transferencia(
        numero           = numero,
        estado           = TransferenciaEstado.BORRADOR,
        origen_local_id  = data.origen_local_id,
        destino_local_id = data.destino_local_id,
        notas            = data.notas,
        company_id       = cid,
        creado_por_id    = user.id,
    )
    db.add(trf)
    db.flush()

    for it in data.items:
        db.add(TransferenciaItem(
            transferencia_id = trf.id,
            variant_id       = it.variant_id,
            cantidad_enviada = it.cantidad_enviada,
            notas_item       = it.notas_item,
        ))

    db.commit()
    db.refresh(trf)
    return _trf_out(trf)


@router.get("/transferencias")
def listar_transferencias(
    estado:   Optional[str] = Query(None),
    local_id: Optional[int] = Query(None),
    skip:     int            = Query(0, ge=0),
    limit:    int            = Query(50, ge=1, le=200),
    db:       Session        = Depends(get_db),
    user:     User           = Depends(require_roles(*_DEPOSITO_VER)),
):
    cid = _company(user)
    q = db.query(Transferencia).filter(Transferencia.company_id == cid)
    if estado:
        q = q.filter(Transferencia.estado == estado)
    if local_id:
        q = q.filter(
            (Transferencia.origen_local_id == local_id) |
            (Transferencia.destino_local_id == local_id)
        )
    total = q.count()
    items = q.order_by(Transferencia.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_trf_out(t) for t in items], "total": total, "skip": skip, "limit": limit}


@router.get("/transferencias/{trf_id}")
def detalle_transferencia(
    trf_id: int,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_DEPOSITO_VER)),
):
    trf = db.query(Transferencia).filter(
        Transferencia.id == trf_id,
        Transferencia.company_id == _company(user),
    ).first()
    if not trf:
        raise HTTPException(404, "Transferencia no encontrada")
    return _trf_out(trf)


@router.patch("/transferencias/{trf_id}/confirmar")
def confirmar_transferencia(
    trf_id: int,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """
    Confirma el envío: descuenta stock del origen en stock_by_local.
    No descuenta el stock global (ProductVariant.stock) hasta recibir.
    """
    trf = db.query(Transferencia).filter(
        Transferencia.id == trf_id,
        Transferencia.company_id == _company(user),
    ).first()
    if not trf:
        raise HTTPException(404, "Transferencia no encontrada")
    if trf.estado != TransferenciaEstado.BORRADOR:
        raise HTTPException(400, f"Solo se pueden confirmar transferencias en BORRADOR (estado actual: {trf.estado.value})")

    cid = _company(user)
    errores = []

    for item in trf.items:
        sl = _get_or_create_stock_local(db, item.variant_id, trf.origen_local_id, cid)
        if sl.cantidad < item.cantidad_enviada:
            errores.append(
                f"SKU {item.variant.sku}: stock disponible {sl.cantidad}, necesario {item.cantidad_enviada}"
            )

    if errores:
        raise HTTPException(409, {"detail": "Stock insuficiente", "errores": errores})

    for item in trf.items:
        sl = _get_or_create_stock_local(db, item.variant_id, trf.origen_local_id, cid)
        sl.cantidad -= item.cantidad_enviada

    trf.estado = TransferenciaEstado.CONFIRMADA
    trf.confirmado_por_id = user.id
    db.commit()
    db.refresh(trf)
    return _trf_out(trf)


@router.patch("/transferencias/{trf_id}/recibir")
def recibir_transferencia(
    trf_id: int,
    data:   RecibirIn,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """
    Confirma la recepción: suma stock al destino.
    Las cantidades recibidas pueden diferir de las enviadas (diferencias).
    Si se recibe menos, el sobrante queda como pérdida/ajuste pendiente.
    """
    trf = db.query(Transferencia).filter(
        Transferencia.id == trf_id,
        Transferencia.company_id == _company(user),
    ).first()
    if not trf:
        raise HTTPException(404, "Transferencia no encontrada")
    if trf.estado != TransferenciaEstado.CONFIRMADA:
        raise HTTPException(400, f"Solo se pueden recibir transferencias CONFIRMADAS (estado: {trf.estado.value})")

    cid = _company(user)
    cantidades = {r.item_id: r.cantidad_recibida for r in data.items}

    for item in trf.items:
        recibida = cantidades.get(item.id, item.cantidad_enviada)
        item.cantidad_recibida = recibida

        # Sumar al destino en stock_by_local
        sl_dest = _get_or_create_stock_local(db, item.variant_id, trf.destino_local_id, cid)
        sl_dest.cantidad += recibida

        # Registrar movimiento de stock
        mov = StockMovement(
            type          = MovementType.TRANSFERENCIA,
            variant_id    = item.variant_id,
            quantity      = recibida,
            reference     = f"TRF {trf.numero}",
            notes         = f"Transferencia de {trf.origen_local.name if trf.origen_local else 'Depósito'} → {trf.destino_local.name if trf.destino_local else 'Depósito'}",
            company_id    = cid,
            created_by_id = user.id,
        )
        db.add(mov)

    trf.estado = TransferenciaEstado.RECIBIDA
    trf.recibido_por_id = user.id
    db.commit()
    db.refresh(trf)
    return _trf_out(trf)


@router.patch("/transferencias/{trf_id}/anular")
def anular_transferencia(
    trf_id: int,
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """
    Anula la transferencia.
    Si estaba CONFIRMADA, revierte el stock descontado del origen.
    """
    trf = db.query(Transferencia).filter(
        Transferencia.id == trf_id,
        Transferencia.company_id == _company(user),
    ).first()
    if not trf:
        raise HTTPException(404, "Transferencia no encontrada")
    if trf.estado == TransferenciaEstado.RECIBIDA:
        raise HTTPException(400, "No se puede anular una transferencia ya recibida")
    if trf.estado == TransferenciaEstado.ANULADA:
        raise HTTPException(400, "La transferencia ya está anulada")

    cid = _company(user)

    # Si estaba CONFIRMADA, devolver stock al origen
    if trf.estado == TransferenciaEstado.CONFIRMADA:
        for item in trf.items:
            sl = _get_or_create_stock_local(db, item.variant_id, trf.origen_local_id, cid)
            sl.cantidad += item.cantidad_enviada

    trf.estado = TransferenciaEstado.ANULADA
    db.commit()
    db.refresh(trf)
    return _trf_out(trf)


# ══════════════════════════════════════════════════════
#  ALERTAS DE STOCK
# ══════════════════════════════════════════════════════

@router.get("/alertas", response_model=list[AlertaItem])
def alertas_stock(
    umbral:   int            = Query(5, ge=0),
    local_id: Optional[int] = Query(None),
    db:       Session        = Depends(get_db),
    user:     User           = Depends(require_roles(*_DEPOSITO_VER)),
):
    """Variantes con stock ≤ umbral en una ubicación."""
    cid = _company(user)
    q = db.query(StockLocal).join(
        ProductVariant, StockLocal.variant_id == ProductVariant.id
    ).join(
        Product, ProductVariant.product_id == Product.id
    ).filter(
        StockLocal.company_id == cid,
        StockLocal.cantidad <= umbral,
        ProductVariant.is_active == True,
    )
    if local_id is not None:
        q = q.filter(StockLocal.local_id == local_id)

    rows = q.order_by(StockLocal.cantidad.asc()).limit(200).all()

    return [
        AlertaItem(
            variant_id   = sl.variant_id,
            sku          = sl.variant.sku,
            product_name = sl.variant.product.name,
            size         = sl.variant.size,
            color        = sl.variant.color,
            local_id     = sl.local_id,
            local_name   = sl.local.name if sl.local else "Depósito Central",
            cantidad     = sl.cantidad,
            umbral       = umbral,
        )
        for sl in rows
    ]


# ══════════════════════════════════════════════════════
#  CONTEO FÍSICO
# ══════════════════════════════════════════════════════

def _conteo_out(c: ConteoInventario, include_items: bool = True) -> dict:
    total = len(c.items)
    contados = sum(1 for i in c.items if i.stock_fisico is not None)
    return ConteoOut(
        id           = c.id,
        local_id     = c.local_id,
        local_name   = c.local.name if c.local else "Depósito Central",
        estado       = c.estado.value,
        notas        = c.notas,
        creado_por   = c.creado_por.full_name if c.creado_por else None,
        created_at   = c.created_at.isoformat(),
        total_items  = total,
        items_contados = contados,
        items = [
            ConteoItemOut(
                id           = i.id,
                variant_id   = i.variant_id,
                sku          = i.variant.sku,
                product_name = i.variant.product.name,
                size         = i.variant.size,
                color        = i.variant.color,
                stock_sistema= i.stock_sistema,
                stock_fisico = i.stock_fisico,
                diferencia   = i.diferencia,
                ajustado     = i.ajustado,
            )
            for i in c.items
        ] if include_items else [],
    ).model_dump()


@router.post("/conteos", status_code=201)
def iniciar_conteo(
    data: ConteoIn,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """
    Inicia un conteo físico tomando snapshot del stock actual de la ubicación.
    Genera un ítem por cada variante activa.
    """
    cid = _company(user)

    # Solo puede haber un conteo EN_CURSO por local
    activo = db.query(ConteoInventario).filter(
        ConteoInventario.company_id == cid,
        ConteoInventario.local_id == data.local_id,
        ConteoInventario.estado == ConteoEstado.EN_CURSO,
    ).first()
    if activo:
        raise HTTPException(409, f"Ya existe un conteo en curso (ID {activo.id}) para esta ubicación")

    conteo = ConteoInventario(
        local_id      = data.local_id,
        notas         = data.notas,
        company_id    = cid,
        creado_por_id = user.id,
    )
    db.add(conteo)
    db.flush()

    # Snapshot de stock actual (desde stock_by_local o stock global si no hay registro)
    variantes = db.query(ProductVariant).join(Product).filter(
        Product.company_id == cid,
        ProductVariant.is_active == True,
    ).all()

    for v in variantes:
        sl = db.query(StockLocal).filter(
            StockLocal.variant_id == v.id,
            StockLocal.local_id == data.local_id,
            StockLocal.company_id == cid,
        ).first()
        cantidad_actual = sl.cantidad if sl else 0

        db.add(ConteoItem(
            conteo_id     = conteo.id,
            variant_id    = v.id,
            stock_sistema = cantidad_actual,
        ))

    db.commit()
    db.refresh(conteo)
    return _conteo_out(conteo)


@router.get("/conteos")
def listar_conteos(
    skip:  int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db:    Session = Depends(get_db),
    user:  User    = Depends(require_roles(*_DEPOSITO_VER)),
):
    cid = _company(user)
    q = db.query(ConteoInventario).filter(ConteoInventario.company_id == cid)
    total = q.count()
    items = q.order_by(ConteoInventario.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "items": [_conteo_out(c, include_items=False) for c in items],
        "total": total, "skip": skip, "limit": limit,
    }


@router.get("/conteos/{conteo_id}")
def detalle_conteo(
    conteo_id: int,
    db:        Session = Depends(get_db),
    user:      User    = Depends(require_roles(*_DEPOSITO_VER)),
):
    c = db.query(ConteoInventario).filter(
        ConteoInventario.id == conteo_id,
        ConteoInventario.company_id == _company(user),
    ).first()
    if not c:
        raise HTTPException(404, "Conteo no encontrado")
    return _conteo_out(c)


@router.patch("/conteos/{conteo_id}/item/{item_id}")
def actualizar_item_conteo(
    conteo_id: int,
    item_id:   int,
    data:      ConteoItemUpdate,
    db:        Session = Depends(get_db),
    user:      User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """Actualizar la cantidad física contada para un ítem."""
    c = db.query(ConteoInventario).filter(
        ConteoInventario.id == conteo_id,
        ConteoInventario.company_id == _company(user),
    ).first()
    if not c:
        raise HTTPException(404, "Conteo no encontrado")
    if c.estado != ConteoEstado.EN_CURSO:
        raise HTTPException(400, "El conteo ya no está en curso")

    item = db.query(ConteoItem).filter(
        ConteoItem.id == item_id,
        ConteoItem.conteo_id == conteo_id,
    ).first()
    if not item:
        raise HTTPException(404, "Ítem no encontrado")

    item.stock_fisico = data.stock_fisico
    item.diferencia   = data.stock_fisico - item.stock_sistema
    db.commit()
    return {
        "id": item.id,
        "stock_sistema": item.stock_sistema,
        "stock_fisico":  item.stock_fisico,
        "diferencia":    item.diferencia,
    }


@router.post("/conteos/{conteo_id}/aplicar")
def aplicar_conteo(
    conteo_id: int,
    db:        Session = Depends(get_db),
    user:      User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    """
    Aplica las diferencias del conteo físico:
    - Si diferencia > 0: INGRESO (sobrante)
    - Si diferencia < 0: EGRESO (faltante)
    - Si diferencia = 0: sin movimiento
    Los ítems sin stock_fisico cargado se omiten.
    """
    cid = _company(user)
    c = db.query(ConteoInventario).filter(
        ConteoInventario.id == conteo_id,
        ConteoInventario.company_id == cid,
    ).first()
    if not c:
        raise HTTPException(404, "Conteo no encontrado")
    if c.estado != ConteoEstado.EN_CURSO:
        raise HTTPException(400, "El conteo ya fue aplicado o cancelado")

    ajustes_ok = 0
    ajustes_err = []

    for item in c.items:
        if item.stock_fisico is None:
            continue

        diferencia = item.stock_fisico - item.stock_sistema
        if diferencia == 0:
            item.ajustado = True
            continue

        # Actualizar stock_by_local
        sl = _get_or_create_stock_local(db, item.variant_id, c.local_id, cid)
        nuevo = sl.cantidad + diferencia

        if nuevo < 0:
            ajustes_err.append({
                "variant_id": item.variant_id,
                "sku":        item.variant.sku,
                "diferencia": diferencia,
                "error":      "Stock resultante negativo — se ajusta a 0",
            })
            nuevo = 0

        sl.cantidad = nuevo
        item.diferencia = diferencia
        item.ajustado = True

        # También ajustar stock global (ProductVariant.stock)
        variant = db.query(ProductVariant).get(item.variant_id)
        if variant:
            variant.stock = max(0, variant.stock + diferencia)

        # Registro en historial
        tipo = MovementType.INGRESO if diferencia > 0 else MovementType.EGRESO
        db.add(StockMovement(
            type          = tipo,
            variant_id    = item.variant_id,
            quantity      = abs(diferencia),
            reference     = f"Conteo físico #{conteo_id}",
            notes         = f"Diferencia conteo: sistema={item.stock_sistema}, físico={item.stock_fisico}",
            company_id    = cid,
            created_by_id = user.id,
        ))
        ajustes_ok += 1

    c.estado = ConteoEstado.APLICADO
    c.aplicado_por_id = user.id
    db.commit()

    return {
        "ok":            True,
        "ajustes_ok":    ajustes_ok,
        "ajustes_err":   ajustes_err,
        "conteo_id":     conteo_id,
    }


# ══════════════════════════════════════════════════════
#  TAREAS DIARIAS DE DEPÓSITO
# ══════════════════════════════════════════════════════

class TareaIn(BaseModel):
    titulo:        str = Field(..., min_length=1, max_length=200)
    descripcion:   str | None = None
    fecha:         date
    prioridad:     str = "MEDIA"
    asignado_a_id: int


class TareaUpdate(BaseModel):
    titulo:        str | None = None
    descripcion:   str | None = None
    fecha:         date | None = None
    prioridad:     str | None = None
    estado:        str | None = None
    asignado_a_id: int | None = None


def _tarea_out(t: DepositoTarea) -> dict:
    return {
        "id":              t.id,
        "titulo":          t.titulo,
        "descripcion":     t.descripcion,
        "fecha":           t.fecha.isoformat(),
        "estado":          t.estado.value if t.estado else None,
        "prioridad":       t.prioridad.value if t.prioridad else None,
        "asignado_a_id":   t.asignado_a_id,
        "asignado_a_name": t.asignado_a.full_name if t.asignado_a else None,
        "creado_por_id":   t.creado_por_id,
        "creado_por_name": t.creado_por.full_name if t.creado_por else None,
        "created_at":      t.created_at.isoformat() if t.created_at else None,
        "updated_at":      t.updated_at.isoformat() if t.updated_at else None,
    }


@router.post("/tareas")
def crear_tarea(
    data: TareaIn,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    cid = _company(user)
    asignado = db.query(User).filter(User.id == data.asignado_a_id).first()
    if not asignado:
        raise HTTPException(404, "Usuario asignado no encontrado")

    tarea = DepositoTarea(
        titulo        = data.titulo,
        descripcion   = data.descripcion,
        fecha         = data.fecha,
        prioridad     = TareaPrioridad(data.prioridad),
        estado        = TareaEstado.PENDIENTE,
        asignado_a_id = data.asignado_a_id,
        creado_por_id = user.id,
        company_id    = cid,
    )
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    return _tarea_out(tarea)


@router.get("/tareas")
def listar_tareas(
    fecha:  date | None = None,
    estado: str | None = None,
    asignado_a_id: int | None = None,
    skip:   int = Query(0, ge=0),
    limit:  int = Query(50, ge=1, le=200),
    db:     Session = Depends(get_db),
    user:   User    = Depends(require_roles(*_DEPOSITO_VER)),
):
    cid = _company(user)
    q = db.query(DepositoTarea).filter(DepositoTarea.company_id == cid)
    if fecha:
        q = q.filter(DepositoTarea.fecha == fecha)
    if estado:
        q = q.filter(DepositoTarea.estado == TareaEstado(estado))
    if asignado_a_id:
        q = q.filter(DepositoTarea.asignado_a_id == asignado_a_id)
    total = q.count()
    items = q.order_by(DepositoTarea.fecha.desc(), DepositoTarea.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_tarea_out(t) for t in items], "total": total}


@router.get("/tareas/{tarea_id}")
def detalle_tarea(
    tarea_id: int,
    db:       Session = Depends(get_db),
    user:     User    = Depends(require_roles(*_DEPOSITO_VER)),
):
    cid = _company(user)
    t = db.query(DepositoTarea).filter(DepositoTarea.id == tarea_id, DepositoTarea.company_id == cid).first()
    if not t:
        raise HTTPException(404, "Tarea no encontrada")
    return _tarea_out(t)


@router.patch("/tareas/{tarea_id}")
def actualizar_tarea(
    tarea_id: int,
    data:     TareaUpdate,
    db:       Session = Depends(get_db),
    user:     User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    cid = _company(user)
    t = db.query(DepositoTarea).filter(DepositoTarea.id == tarea_id, DepositoTarea.company_id == cid).first()
    if not t:
        raise HTTPException(404, "Tarea no encontrada")

    if data.titulo is not None:
        t.titulo = data.titulo
    if data.descripcion is not None:
        t.descripcion = data.descripcion
    if data.fecha is not None:
        t.fecha = data.fecha
    if data.prioridad is not None:
        t.prioridad = TareaPrioridad(data.prioridad)
    if data.estado is not None:
        t.estado = TareaEstado(data.estado)
    if data.asignado_a_id is not None:
        t.asignado_a_id = data.asignado_a_id

    db.commit()
    db.refresh(t)
    return _tarea_out(t)


@router.delete("/tareas/{tarea_id}")
def eliminar_tarea(
    tarea_id: int,
    db:       Session = Depends(get_db),
    user:     User    = Depends(require_roles(*_DEPOSITO_ROLES)),
):
    cid = _company(user)
    t = db.query(DepositoTarea).filter(DepositoTarea.id == tarea_id, DepositoTarea.company_id == cid).first()
    if not t:
        raise HTTPException(404, "Tarea no encontrada")
    db.delete(t)
    db.commit()
    return {"ok": True}
