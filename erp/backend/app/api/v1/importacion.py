"""
Router IMPORTACION — módulo de importación internacional para indumentaria.

Endpoints:
  GET    /import-orders/                 — lista con filtros
  GET    /import-orders/stats            — estadísticas del módulo
  GET    /import-orders/export           — export CSV
  POST   /import-orders/                 — crear orden borrador
  GET    /import-orders/{id}             — detalle
  PUT    /import-orders/{id}             — actualizar cabecera
  DELETE /import-orders/{id}             — eliminar borrador
  POST   /import-orders/{id}/items       — agregar ítem
  PUT    /import-orders/{id}/items/{iid} — actualizar ítem
  DELETE /import-orders/{id}/items/{iid} — eliminar ítem

  -- Workflow --
  POST   /import-orders/{id}/confirmar   — BORRADOR → CONFIRMADO
  POST   /import-orders/{id}/embarcar    — CONFIRMADO → EMBARCADO
  POST   /import-orders/{id}/en-transito — EMBARCADO → EN_TRANSITO
  POST   /import-orders/{id}/en-aduana   — EN_TRANSITO → EN_ADUANA
  POST   /import-orders/{id}/disponible  — EN_ADUANA → DISPONIBLE
  POST   /import-orders/{id}/anular      — → ANULADO
  POST   /import-orders/{id}/reabrir     — ANULADO → BORRADOR

  -- Liquidación --
  POST   /import-orders/{id}/liquidar    — calcular costo landing y distribuir entre ítems
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
from pydantic import BaseModel
import datetime

from app.db.session import get_db
from app.models.importacion import (
    ImportOrder, ImportOrderItem, ImportOrderStatus, ImportOrderType
)
from app.models.provider import Provider
from app.models.product import ProductVariant
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.v1.export_utils import export_csv

router = APIRouter(prefix="/import-orders", tags=["Importación"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ImportOrderItemOut(BaseModel):
    id: int
    variant_id: int | None = None
    codigo_comercial: str | None = None
    descripcion_comercial: str
    posicion_arancelaria: str | None = None
    cantidad: int
    precio_unitario_usd: float
    subtotal_usd: float
    costo_landing_unit_usd: float | None = None
    # variante desnormalizada
    sku: str | None = None
    size: str | None = None
    color: str | None = None
    product_name: str | None = None
    model_config = {"from_attributes": True}


class ImportOrderItemCreate(BaseModel):
    variant_id: int | None = None
    codigo_comercial: str | None = None
    descripcion_comercial: str
    posicion_arancelaria: str | None = None
    cantidad: int
    precio_unitario_usd: float


class ImportOrderItemUpdate(BaseModel):
    codigo_comercial: str | None = None
    descripcion_comercial: str | None = None
    posicion_arancelaria: str | None = None
    cantidad: int | None = None
    precio_unitario_usd: float | None = None


class ImportOrderOut(BaseModel):
    id: int
    numero: str
    referencia: str | None = None
    tipo: str
    estado: str
    provider_id: int
    provider_name: str | None = None
    pais_origen: str | None = None
    ciudad_origen: str | None = None
    puerto_origen: str | None = None
    puerto_destino: str | None = None
    incoterm: str | None = None
    numero_bl: str | None = None
    numero_factura_proveedor: str | None = None
    numero_dua: str | None = None
    fecha_orden: datetime.date | None = None
    fecha_embarque: datetime.date | None = None
    fecha_eta: datetime.date | None = None
    fecha_arribo_real: datetime.date | None = None
    fecha_despacho_aduana: datetime.date | None = None
    fecha_disponible: datetime.date | None = None
    valor_fob_usd: float | None = None
    flete_usd: float | None = None
    seguro_usd: float | None = None
    otros_gastos_usd: float | None = None
    tipo_cambio: float | None = None
    derechos_aduana_ars: float | None = None
    iva_importacion_ars: float | None = None
    estadistica_ars: float | None = None
    percepciones_ars: float | None = None
    honorarios_despachante_ars: float | None = None
    otros_costos_ars: float | None = None
    total_unidades: int | None = None
    costo_landing_total_usd: float | None = None
    costo_unit_usd: float | None = None
    liquidacion_confirmada: bool = False
    notas: str | None = None
    created_at: datetime.datetime | None = None
    items: list[ImportOrderItemOut] = []
    model_config = {"from_attributes": True}


class ImportOrderCreate(BaseModel):
    provider_id: int
    tipo: ImportOrderType = ImportOrderType.MARITIMO
    referencia: str | None = None
    pais_origen: str | None = None
    ciudad_origen: str | None = None
    puerto_origen: str | None = None
    puerto_destino: str | None = None
    incoterm: str | None = "FOB"
    fecha_orden: datetime.date | None = None
    fecha_eta: datetime.date | None = None
    notas: str | None = None


class ImportOrderUpdate(BaseModel):
    provider_id: int | None = None
    tipo: ImportOrderType | None = None
    referencia: str | None = None
    pais_origen: str | None = None
    ciudad_origen: str | None = None
    puerto_origen: str | None = None
    puerto_destino: str | None = None
    incoterm: str | None = None
    numero_bl: str | None = None
    numero_factura_proveedor: str | None = None
    numero_dua: str | None = None
    fecha_orden: datetime.date | None = None
    fecha_embarque: datetime.date | None = None
    fecha_eta: datetime.date | None = None
    fecha_arribo_real: datetime.date | None = None
    fecha_despacho_aduana: datetime.date | None = None
    fecha_disponible: datetime.date | None = None
    valor_fob_usd: float | None = None
    flete_usd: float | None = None
    seguro_usd: float | None = None
    otros_gastos_usd: float | None = None
    tipo_cambio: float | None = None
    derechos_aduana_ars: float | None = None
    iva_importacion_ars: float | None = None
    estadistica_ars: float | None = None
    percepciones_ars: float | None = None
    honorarios_despachante_ars: float | None = None
    otros_costos_ars: float | None = None
    notas: str | None = None


class LiquidacionIn(BaseModel):
    tipo_cambio: float
    derechos_aduana_ars: float = 0
    iva_importacion_ars: float = 0
    estadistica_ars: float = 0
    percepciones_ars: float = 0
    honorarios_despachante_ars: float = 0
    otros_costos_ars: float = 0
    confirmar: bool = False   # True = guarda definitivamente


# ── Helpers ────────────────────────────────────────────────────────────────────

def _serialize_item(item: ImportOrderItem) -> ImportOrderItemOut:
    data = ImportOrderItemOut.model_validate(item)
    if item.variant:
        data.sku = item.variant.sku
        data.size = item.variant.size
        data.color = item.variant.color
        if hasattr(item.variant, 'product') and item.variant.product:
            data.product_name = item.variant.product.name
    return data


def _serialize(order: ImportOrder) -> ImportOrderOut:
    data = ImportOrderOut.model_validate(order)
    data.items = [_serialize_item(i) for i in order.items]
    if order.provider:
        data.provider_name = order.provider.name
    return data


def _generate_numero(db: Session, company_id: int) -> str:
    year = datetime.date.today().year
    count = db.query(func.count(ImportOrder.id)).filter(
        ImportOrder.company_id == company_id,
    ).scalar() or 0
    return f"IMP-{year}-{count + 1:04d}"


def _get_order(db: Session, order_id: int, company_id: int) -> ImportOrder:
    order = db.query(ImportOrder).filter(
        ImportOrder.id == order_id,
        ImportOrder.company_id == company_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de importación no encontrada")
    return order


VALID_TRANSITIONS: dict[ImportOrderStatus, list[ImportOrderStatus]] = {
    ImportOrderStatus.BORRADOR:    [ImportOrderStatus.CONFIRMADO, ImportOrderStatus.ANULADO],
    ImportOrderStatus.CONFIRMADO:  [ImportOrderStatus.EMBARCADO, ImportOrderStatus.ANULADO, ImportOrderStatus.BORRADOR],
    ImportOrderStatus.EMBARCADO:   [ImportOrderStatus.EN_TRANSITO, ImportOrderStatus.ANULADO],
    ImportOrderStatus.EN_TRANSITO: [ImportOrderStatus.EN_ADUANA, ImportOrderStatus.ANULADO],
    ImportOrderStatus.EN_ADUANA:   [ImportOrderStatus.DISPONIBLE, ImportOrderStatus.ANULADO],
    ImportOrderStatus.DISPONIBLE:  [],
    ImportOrderStatus.ANULADO:     [ImportOrderStatus.BORRADOR],
}


def _transition(order: ImportOrder, nuevo_estado: ImportOrderStatus) -> None:
    allowed = VALID_TRANSITIONS.get(order.estado, [])
    if nuevo_estado not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"No se puede pasar de {order.estado} a {nuevo_estado}"
        )
    order.estado = nuevo_estado


# ── Endpoints — Lista y creación ───────────────────────────────────────────────

@router.get("/", response_model=list[ImportOrderOut])
def list_import_orders(
    estado:      Optional[str] = None,
    provider_id: Optional[int] = None,
    q:           Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista órdenes de importación con filtros."""
    query = db.query(ImportOrder).filter(
        ImportOrder.company_id == current_user.company_id
    )
    if estado:
        query = query.filter(ImportOrder.estado == estado)
    if provider_id:
        query = query.filter(ImportOrder.provider_id == provider_id)
    if q:
        query = query.filter(
            or_(
                ImportOrder.numero.ilike(f"%{q}%"),
                ImportOrder.referencia.ilike(f"%{q}%"),
                ImportOrder.numero_bl.ilike(f"%{q}%"),
                ImportOrder.numero_dua.ilike(f"%{q}%"),
                ImportOrder.pais_origen.ilike(f"%{q}%"),
            )
        )
    orders = query.order_by(ImportOrder.id.desc()).offset(skip).limit(limit).all()
    return [_serialize(o) for o in orders]


@router.get("/stats")
def import_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumen de estadísticas del módulo de importación."""
    base = db.query(ImportOrder).filter(ImportOrder.company_id == current_user.company_id)
    total = base.count()
    by_estado = {
        s.value: base.filter(ImportOrder.estado == s).count()
        for s in ImportOrderStatus
    }
    fob_total = db.query(func.sum(ImportOrder.valor_fob_usd)).filter(
        ImportOrder.company_id == current_user.company_id,
        ImportOrder.estado != ImportOrderStatus.ANULADO,
    ).scalar() or 0
    unidades_total = db.query(func.sum(ImportOrder.total_unidades)).filter(
        ImportOrder.company_id == current_user.company_id,
        ImportOrder.estado != ImportOrderStatus.ANULADO,
    ).scalar() or 0
    return {
        "total": total,
        "por_estado": by_estado,
        "valor_fob_total_usd": float(fob_total),
        "unidades_total": int(unidades_total),
    }


@router.get("/export")
def export_import_orders(
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export CSV de órdenes de importación."""
    query = db.query(ImportOrder).filter(ImportOrder.company_id == current_user.company_id)
    if estado:
        query = query.filter(ImportOrder.estado == estado)
    orders = query.order_by(ImportOrder.id.desc()).all()
    rows = [
        {
            "numero": o.numero,
            "referencia": o.referencia,
            "estado": o.estado,
            "tipo": o.tipo,
            "proveedor": o.provider.name if o.provider else "",
            "pais_origen": o.pais_origen,
            "incoterm": o.incoterm,
            "numero_bl": o.numero_bl,
            "numero_dua": o.numero_dua,
            "fecha_orden": o.fecha_orden,
            "fecha_eta": o.fecha_eta,
            "fecha_disponible": o.fecha_disponible,
            "valor_fob_usd": o.valor_fob_usd,
            "flete_usd": o.flete_usd,
            "cif_total_usd": o.cif_usd,
            "total_unidades": o.total_unidades,
            "costo_unit_usd": o.costo_unit_usd,
        }
        for o in orders
    ]
    return export_csv(rows, "importaciones")


@router.post("/", response_model=ImportOrderOut, status_code=201)
def create_import_order(
    body: ImportOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    """Crea una nueva orden de importación en estado BORRADOR."""
    numero = _generate_numero(db, current_user.company_id)
    order = ImportOrder(
        numero=numero,
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _serialize(order)


# ── Endpoints — CRUD ───────────────────────────────────────────────────────────

@router.get("/{order_id}", response_model=ImportOrderOut)
def get_import_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize(_get_order(db, order_id, current_user.company_id))


@router.put("/{order_id}", response_model=ImportOrderOut)
def update_import_order(
    order_id: int,
    body: ImportOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    order = _get_order(db, order_id, current_user.company_id)
    if order.estado not in (ImportOrderStatus.BORRADOR, ImportOrderStatus.CONFIRMADO):
        raise HTTPException(422, "Solo se puede editar en estado BORRADOR o CONFIRMADO")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return _serialize(order)


@router.delete("/{order_id}", status_code=204)
def delete_import_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    order = _get_order(db, order_id, current_user.company_id)
    if order.estado != ImportOrderStatus.BORRADOR:
        raise HTTPException(422, "Solo se puede eliminar en estado BORRADOR")
    db.delete(order)
    db.commit()


# ── Ítems ──────────────────────────────────────────────────────────────────────

@router.post("/{order_id}/items", response_model=ImportOrderOut)
def add_item(
    order_id: int,
    body: ImportOrderItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    order = _get_order(db, order_id, current_user.company_id)
    if order.estado not in (ImportOrderStatus.BORRADOR, ImportOrderStatus.CONFIRMADO):
        raise HTTPException(422, "Solo se pueden agregar ítems en BORRADOR o CONFIRMADO")
    subtotal = round(body.cantidad * body.precio_unitario_usd, 2)
    item = ImportOrderItem(
        import_order_id=order_id,
        subtotal_usd=subtotal,
        **body.model_dump(),
    )
    db.add(item)
    # Actualizar FOB total
    order.valor_fob_usd = (order.valor_fob_usd or 0) + subtotal
    db.commit()
    db.refresh(order)
    return _serialize(order)


@router.put("/{order_id}/items/{item_id}", response_model=ImportOrderOut)
def update_item(
    order_id: int,
    item_id: int,
    body: ImportOrderItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    order = _get_order(db, order_id, current_user.company_id)
    item = db.query(ImportOrderItem).filter(
        ImportOrderItem.id == item_id,
        ImportOrderItem.import_order_id == order_id,
    ).first()
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    old_subtotal = item.subtotal_usd
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    new_subtotal = round(item.cantidad * item.precio_unitario_usd, 2)
    item.subtotal_usd = new_subtotal
    order.valor_fob_usd = (order.valor_fob_usd or 0) - old_subtotal + new_subtotal
    db.commit()
    db.refresh(order)
    return _serialize(order)


@router.delete("/{order_id}/items/{item_id}", response_model=ImportOrderOut)
def delete_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    order = _get_order(db, order_id, current_user.company_id)
    item = db.query(ImportOrderItem).filter(
        ImportOrderItem.id == item_id,
        ImportOrderItem.import_order_id == order_id,
    ).first()
    if not item:
        raise HTTPException(404, "Ítem no encontrado")
    order.valor_fob_usd = max(0, (order.valor_fob_usd or 0) - item.subtotal_usd)
    db.delete(item)
    db.commit()
    db.refresh(order)
    return _serialize(order)


# ── Workflow ───────────────────────────────────────────────────────────────────

def _workflow_endpoint(nuevo_estado: ImportOrderStatus, required_fields: list[str] | None = None):
    """Factory para endpoints de transición de estado."""
    async def _endpoint(
        order_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(
            require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
        ),
    ):
        order = _get_order(db, order_id, current_user.company_id)
        if required_fields:
            missing = [f for f in required_fields if not getattr(order, f, None)]
            if missing:
                raise HTTPException(422, f"Faltan campos para avanzar: {', '.join(missing)}")
        _transition(order, nuevo_estado)
        db.commit()
        db.refresh(order)
        return _serialize(order)
    return _endpoint


router.add_api_route(
    "/{order_id}/confirmar",   _workflow_endpoint(ImportOrderStatus.CONFIRMADO, ["provider_id", "fecha_orden"]),
    methods=["POST"], response_model=ImportOrderOut,
)
router.add_api_route(
    "/{order_id}/embarcar",    _workflow_endpoint(ImportOrderStatus.EMBARCADO),
    methods=["POST"], response_model=ImportOrderOut,
)
router.add_api_route(
    "/{order_id}/en-transito", _workflow_endpoint(ImportOrderStatus.EN_TRANSITO, ["numero_bl"]),
    methods=["POST"], response_model=ImportOrderOut,
)
router.add_api_route(
    "/{order_id}/en-aduana",   _workflow_endpoint(ImportOrderStatus.EN_ADUANA, ["fecha_arribo_real"]),
    methods=["POST"], response_model=ImportOrderOut,
)
router.add_api_route(
    "/{order_id}/anular",      _workflow_endpoint(ImportOrderStatus.ANULADO),
    methods=["POST"], response_model=ImportOrderOut,
)
router.add_api_route(
    "/{order_id}/reabrir",     _workflow_endpoint(ImportOrderStatus.BORRADOR),
    methods=["POST"], response_model=ImportOrderOut,
)


@router.post("/{order_id}/disponible", response_model=ImportOrderOut)
def marcar_disponible(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS)
    ),
):
    """Marca la orden como DISPONIBLE. Requiere liquidación confirmada."""
    order = _get_order(db, order_id, current_user.company_id)
    if not order.liquidacion_confirmada:
        raise HTTPException(422, "Debe confirmar la liquidación antes de marcar como disponible")
    _transition(order, ImportOrderStatus.DISPONIBLE)
    order.fecha_disponible = datetime.date.today()
    db.commit()
    db.refresh(order)
    return _serialize(order)


# ── Liquidación ────────────────────────────────────────────────────────────────

@router.post("/{order_id}/liquidar", response_model=ImportOrderOut)
def liquidar(
    order_id: int,
    body: LiquidacionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPRAS, UserRole.ADMINISTRACION)
    ),
):
    """
    Calcula la liquidación de la importación:
    - Guarda todos los costos ARS
    - Calcula costo_landing_total_usd = FOB + flete + seguro
    - Calcula costo_unit_usd = costo_landing / total_unidades
    - Distribuye costo_landing_unit_usd en cada ítem proporcionalmente
    - Si `confirmar=True`, congela la liquidación (no se puede volver a calcular)
    """
    order = _get_order(db, order_id, current_user.company_id)

    if order.liquidacion_confirmada:
        raise HTTPException(422, "La liquidación ya fue confirmada y no puede modificarse")

    if not order.items:
        raise HTTPException(422, "La orden no tiene ítems. Agregue artículos antes de liquidar")

    # Actualizar costos ARS
    order.tipo_cambio               = body.tipo_cambio
    order.derechos_aduana_ars       = body.derechos_aduana_ars
    order.iva_importacion_ars       = body.iva_importacion_ars
    order.estadistica_ars           = body.estadistica_ars
    order.percepciones_ars          = body.percepciones_ars
    order.honorarios_despachante_ars= body.honorarios_despachante_ars
    order.otros_costos_ars          = body.otros_costos_ars

    # Calcular totales USD
    total_unidades = sum(i.cantidad for i in order.items)
    fob_total = sum(i.subtotal_usd for i in order.items)
    order.valor_fob_usd        = fob_total
    order.total_unidades       = total_unidades
    order.costo_landing_total_usd = round(
        fob_total + (order.flete_usd or 0) + (order.seguro_usd or 0), 2
    )

    if total_unidades > 0:
        order.costo_unit_usd = round(order.costo_landing_total_usd / total_unidades, 4)
        # Distribuir proporcionalmente entre ítems
        for item in order.items:
            item.costo_landing_unit_usd = round(
                order.costo_landing_total_usd * (item.cantidad / total_unidades) / item.cantidad, 4
            )
    else:
        order.costo_unit_usd = 0

    if body.confirmar:
        order.liquidacion_confirmada = True

    db.commit()
    db.refresh(order)
    return _serialize(order)
