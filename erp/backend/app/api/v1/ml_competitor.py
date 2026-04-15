"""
Router ML Competitor Tracker — seguimiento de competencia en MercadoLibre Argentina.

Usa la API pública de ML (sin autenticación) para rastrear publicaciones de vendedores.

Endpoints:
  GET    /supertrend/ml-sellers              → listar vendedores rastreados
  POST   /supertrend/ml-sellers              → agregar vendedor a rastrear
  PATCH  /supertrend/ml-sellers/{id}         → actualizar config
  DELETE /supertrend/ml-sellers/{id}         → eliminar vendedor + snapshots
  POST   /supertrend/ml-sellers/{id}/scan    → escanear ahora (manual)
  POST   /supertrend/ml-sellers/scan-all     → escanear todos los activos
  GET    /supertrend/ml-sellers/{id}/items   → último snapshot del vendedor
  GET    /supertrend/ml-sellers/{id}/history → historial de precio de un item
  GET    /supertrend/ml-sellers/{id}/price-changes → items con precio cambiado
  GET    /supertrend/ml-sellers/{id}/top-sales     → ranking por ventas del día
  GET    /supertrend/ml-sellers/stats              → resumen global
"""

import time
import threading
import requests as _req
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.db.session import get_db
from app.models.ml_competitor import MLTrackedSeller, MLCompetitorSnapshot
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/supertrend/ml-sellers", tags=["ml-competitor"])

ML_SEARCH_URL = "https://api.mercadolibre.com/sites/MLA/search"
ML_USER_URL   = "https://api.mercadolibre.com/users/{seller_id}"
ML_LIMIT      = 50
RATE_DELAY    = 0.3   # segundos entre requests para no superar rate limit
MAX_RETRIES   = 3


# ── Schemas ────────────────────────────────────────────────────────────────────

class SellerCreate(BaseModel):
    seller_id: str
    nickname: Optional[str] = None
    notes: Optional[str] = None
    check_interval_hours: int = 24

class SellerUpdate(BaseModel):
    nickname: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    check_interval_hours: Optional[int] = None

class SellerOut(BaseModel):
    id: int
    seller_id: str
    nickname: Optional[str]
    notes: Optional[str]
    is_active: bool
    check_interval_hours: int
    last_checked_at: Optional[datetime]
    total_snapshots: int = 0
    model_config = {"from_attributes": True}

class ItemSnapshotOut(BaseModel):
    item_id: str
    title: str
    price: float
    price_prev: Optional[float]
    price_changed: bool
    sold_quantity: int
    available_quantity: int
    sales_since_last: int
    thumbnail: Optional[str]
    permalink: Optional[str]
    scanned_at: datetime
    model_config = {"from_attributes": True}


# ── ML API helpers ─────────────────────────────────────────────────────────────

def _ml_get(url: str, params: dict = None, retries: int = MAX_RETRIES) -> dict:
    """GET con reintentos y backoff ante rate-limit (HTTP 429)."""
    for attempt in range(retries):
        try:
            resp = _req.get(url, params=params, timeout=15)
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 5)) + attempt * 2
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except _req.exceptions.RequestException as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    return {}


def _fetch_all_items(seller_id: str) -> list[dict]:
    """
    Obtiene todas las publicaciones activas de un vendedor paginando la API.
    Maneja vendedores con cientos de items via offset.
    """
    items = []
    offset = 0

    while True:
        data = _ml_get(ML_SEARCH_URL, params={
            "seller_id": seller_id,
            "status": "active",
            "limit": ML_LIMIT,
            "offset": offset,
        })

        results = data.get("results", [])
        if not results:
            break

        items.extend(results)

        paging = data.get("paging", {})
        total  = paging.get("total", 0)
        offset += len(results)

        if offset >= total or offset >= 1000:  # cap 1000 items por seguridad
            break

        time.sleep(RATE_DELAY)

    return items


def _fetch_seller_nickname(seller_id: str) -> Optional[str]:
    """Obtiene el nickname del vendedor desde la API pública de ML."""
    try:
        data = _ml_get(ML_USER_URL.format(seller_id=seller_id))
        return data.get("nickname")
    except Exception:
        return None


# ── Scanner ────────────────────────────────────────────────────────────────────

def _scan_seller(db: Session, tracked: MLTrackedSeller) -> dict:
    """
    Escanea un vendedor: trae sus publicaciones activas, detalle por item,
    compara con el último snapshot y persiste las diferencias incluyendo variantes.
    """
    from app.models.ml_competitor import MLCompetitorVariantSnapshot
    import json

    now = datetime.now(timezone.utc)
    seller_id = tracked.seller_id

    try:
        items = _fetch_all_items(seller_id)
    except Exception as e:
        return {"ok": False, "error": str(e), "items": 0}

    if not items:
        tracked.last_checked_at = now
        db.commit()
        return {"ok": True, "items": 0, "price_changes": 0, "new_sales": 0, "stock_changes": 0}

    # Load previous snapshots indexed by item_id
    prev_rows = db.query(MLCompetitorSnapshot).filter(
        MLCompetitorSnapshot.tracked_seller_id == tracked.id,
    ).order_by(desc(MLCompetitorSnapshot.scanned_at)).all()

    prev_by_item: dict[str, MLCompetitorSnapshot] = {}
    for row in prev_rows:
        if row.item_id not in prev_by_item:
            prev_by_item[row.item_id] = row

    # Load previous variant snapshots indexed by (item_id, variation_id)
    prev_var_rows = db.query(MLCompetitorVariantSnapshot).filter(
        MLCompetitorVariantSnapshot.company_id == tracked.company_id,
    ).order_by(desc(MLCompetitorVariantSnapshot.scanned_at)).all()

    prev_vars: dict[str, MLCompetitorVariantSnapshot] = {}
    for vr in prev_var_rows:
        key = f"{vr.item_id}:{vr.variation_id}"
        if key not in prev_vars:
            prev_vars[key] = vr

    price_changes = 0
    new_sales_total = 0
    stock_changes = 0
    variant_count = 0

    for item in items:
        item_id        = str(item.get("id", ""))
        title          = item.get("title", "")
        price          = float(item.get("price", 0) or 0)
        original_price = float(item.get("original_price") or 0) if item.get("original_price") else None
        sold_quantity  = int(item.get("sold_quantity", 0) or 0)
        avail_quantity = int(item.get("available_quantity", 0) or 0)
        thumbnail      = item.get("thumbnail")
        permalink      = item.get("permalink")
        status         = item.get("status", "active")
        catalog        = item.get("catalog_listing", False) or False

        prev = prev_by_item.get(item_id)
        price_prev       = float(prev.price) if prev else None
        price_changed    = (prev is not None) and (price != price_prev)
        sales_since_last = max(0, sold_quantity - prev.sold_quantity) if prev else 0

        if price_changed:
            price_changes += 1
        new_sales_total += sales_since_last

        snap = MLCompetitorSnapshot(
            company_id=tracked.company_id,
            tracked_seller_id=tracked.id,
            seller_id=seller_id,
            item_id=item_id,
            title=title,
            price=price,
            original_price=original_price,
            sold_quantity=sold_quantity,
            available_quantity=avail_quantity,
            thumbnail=thumbnail,
            permalink=permalink,
            status=status,
            catalog_listing=catalog,
            scanned_at=now,
            price_prev=price_prev,
            price_changed=price_changed,
            sales_since_last=sales_since_last,
        )
        db.add(snap)
        db.flush()  # Get snap.id for variant FK

        # Fetch item detail for variants
        try:
            detail = _ml_get(f"https://api.mercadolibre.com/items/{item_id}")
            time.sleep(RATE_DELAY)
        except Exception:
            detail = {}

        variations = detail.get("variations") or []
        for var in variations:
            var_id = str(var.get("id", ""))
            if not var_id:
                continue

            # Build attributes dict
            attrs = {}
            for combo in (var.get("attribute_combinations") or []):
                attrs[combo.get("name", "")] = combo.get("value_name", "")

            var_avail = int(var.get("available_quantity", 0) or 0)
            var_price = float(var.get("price") or price)  # fallback to item price

            # Compare with previous variant snapshot
            var_key = f"{item_id}:{var_id}"
            prev_var = prev_vars.get(var_key)
            var_stock_prev = prev_var.available_quantity if prev_var else None
            var_stock_changed = (prev_var is not None) and (var_avail != var_stock_prev)

            if var_stock_changed:
                stock_changes += 1

            var_snap = MLCompetitorVariantSnapshot(
                snapshot_id=snap.id,
                company_id=tracked.company_id,
                item_id=item_id,
                variation_id=var_id,
                attributes_json=json.dumps(attrs, ensure_ascii=False) if attrs else None,
                available_quantity=var_avail,
                price=var_price,
                scanned_at=now,
                stock_prev=var_stock_prev,
                stock_changed=var_stock_changed,
            )
            db.add(var_snap)
            variant_count += 1

    tracked.last_checked_at = now
    db.commit()

    return {
        "ok": True,
        "items": len(items),
        "variants": variant_count,
        "price_changes": price_changes,
        "new_sales": new_sales_total,
        "stock_changes": stock_changes,
        "scanned_at": now.isoformat(),
    }


# ── Background scheduler ────────────────────────────────────────────────────────

_scheduler_started = False
_scheduler_lock    = threading.Lock()


def _scheduler_worker():
    """Hilo de fondo que escanea vendedores según su check_interval_hours."""
    from app.db.session import SessionLocal
    while True:
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            sellers = db.query(MLTrackedSeller).filter(MLTrackedSeller.is_active == True).all()
            for s in sellers:
                interval = timedelta(hours=s.check_interval_hours or 24)
                last     = s.last_checked_at
                if last is None or (now - last) >= interval:
                    _scan_seller(db, s)
                    time.sleep(RATE_DELAY * 5)  # pausa entre vendedores
            db.close()
        except Exception:
            pass
        time.sleep(3600)  # re-chequear cada hora cuáles tocan


def _ensure_scheduler():
    global _scheduler_started
    with _scheduler_lock:
        if not _scheduler_started:
            t = threading.Thread(target=_scheduler_worker, daemon=True)
            t.start()
            _scheduler_started = True


# ── CRUD endpoints ─────────────────────────────────────────────────────────────

@router.get("", response_model=list[SellerOut])
def list_sellers(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    _ensure_scheduler()
    sellers = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.company_id == user.company_id
    ).order_by(MLTrackedSeller.id).all()

    result = []
    for s in sellers:
        total = db.query(func.count(MLCompetitorSnapshot.id)).filter(
            MLCompetitorSnapshot.tracked_seller_id == s.id
        ).scalar() or 0
        out = SellerOut(
            id=s.id, seller_id=s.seller_id, nickname=s.nickname,
            notes=s.notes, is_active=s.is_active,
            check_interval_hours=s.check_interval_hours,
            last_checked_at=s.last_checked_at, total_snapshots=total,
        )
        result.append(out)
    return result


@router.post("", response_model=SellerOut)
def add_seller(
    body: SellerCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    # Verificar que no exista ya
    existing = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.company_id == user.company_id,
        MLTrackedSeller.seller_id  == body.seller_id,
    ).first()
    if existing:
        raise HTTPException(400, f"Vendedor {body.seller_id} ya está siendo rastreado")

    # Auto-fetch nickname si no se proveyó
    nickname = body.nickname or _fetch_seller_nickname(body.seller_id)

    seller = MLTrackedSeller(
        company_id=user.company_id,
        seller_id=body.seller_id,
        nickname=nickname,
        notes=body.notes,
        check_interval_hours=body.check_interval_hours,
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    _ensure_scheduler()
    return SellerOut(
        id=seller.id, seller_id=seller.seller_id, nickname=seller.nickname,
        notes=seller.notes, is_active=seller.is_active,
        check_interval_hours=seller.check_interval_hours,
        last_checked_at=seller.last_checked_at, total_snapshots=0,
    )


@router.patch("/{seller_db_id}", response_model=SellerOut)
def update_seller(
    seller_db_id: int,
    body: SellerUpdate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")
    if body.nickname is not None:
        seller.nickname = body.nickname
    if body.notes is not None:
        seller.notes = body.notes
    if body.is_active is not None:
        seller.is_active = body.is_active
    if body.check_interval_hours is not None:
        seller.check_interval_hours = body.check_interval_hours
    db.commit()
    db.refresh(seller)
    total = db.query(func.count(MLCompetitorSnapshot.id)).filter(
        MLCompetitorSnapshot.tracked_seller_id == seller.id
    ).scalar() or 0
    return SellerOut(
        id=seller.id, seller_id=seller.seller_id, nickname=seller.nickname,
        notes=seller.notes, is_active=seller.is_active,
        check_interval_hours=seller.check_interval_hours,
        last_checked_at=seller.last_checked_at, total_snapshots=total,
    )


@router.delete("/{seller_db_id}")
def remove_seller(
    seller_db_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")
    db.delete(seller)
    db.commit()
    return {"ok": True}


# ── Scan endpoints ─────────────────────────────────────────────────────────────

class IngestItemIn(BaseModel):
    """Un item de ML tal como viene del endpoint search de ML (campos que usamos)."""
    id: str
    title: str
    price: float
    original_price: Optional[float] = None
    sold_quantity: int = 0
    available_quantity: int = 0
    thumbnail: Optional[str] = None
    permalink: Optional[str] = None
    status: Optional[str] = "active"
    catalog_listing: Optional[bool] = False

class IngestVariantIn(BaseModel):
    item_id: str
    variation_id: str
    attributes: Optional[dict] = None
    available_quantity: int = 0
    price: Optional[float] = None

class IngestBody(BaseModel):
    items: list[IngestItemIn]
    variants: Optional[list[IngestVariantIn]] = None


@router.post("/{seller_db_id}/ingest")
def ingest_seller_items(
    seller_db_id: int,
    body: IngestBody,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """
    Recibe items ya obtenidos por el CLIENTE desde la API pública de ML
    y los persiste como snapshot. Esto evita que el servidor haga requests
    a ML (que puede estar bloqueado por IP).
    """
    from app.models.ml_competitor import MLCompetitorVariantSnapshot
    import json

    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    now = datetime.now(timezone.utc)
    seller_id = seller.seller_id

    # Load previous snapshots indexed by item_id
    prev_rows = db.query(MLCompetitorSnapshot).filter(
        MLCompetitorSnapshot.tracked_seller_id == seller.id,
    ).order_by(desc(MLCompetitorSnapshot.scanned_at)).all()
    prev_by_item: dict[str, MLCompetitorSnapshot] = {}
    for row in prev_rows:
        if row.item_id not in prev_by_item:
            prev_by_item[row.item_id] = row

    # Load previous variant snapshots
    prev_var_rows = db.query(MLCompetitorVariantSnapshot).filter(
        MLCompetitorVariantSnapshot.company_id == seller.company_id,
    ).order_by(desc(MLCompetitorVariantSnapshot.scanned_at)).all()
    prev_vars: dict[str, MLCompetitorVariantSnapshot] = {}
    for vr in prev_var_rows:
        key = f"{vr.item_id}:{vr.variation_id}"
        if key not in prev_vars:
            prev_vars[key] = vr

    price_changes = 0
    new_sales_total = 0
    stock_changes = 0
    variant_count = 0

    for item in body.items:
        prev = prev_by_item.get(item.id)
        price_prev       = float(prev.price) if prev else None
        price_changed    = (prev is not None) and (item.price != price_prev)
        sales_since_last = max(0, item.sold_quantity - prev.sold_quantity) if prev else 0

        if price_changed:
            price_changes += 1
        new_sales_total += sales_since_last

        snap = MLCompetitorSnapshot(
            company_id=seller.company_id,
            tracked_seller_id=seller.id,
            seller_id=seller_id,
            item_id=item.id,
            title=item.title,
            price=item.price,
            original_price=item.original_price,
            sold_quantity=item.sold_quantity,
            available_quantity=item.available_quantity,
            thumbnail=item.thumbnail,
            permalink=item.permalink,
            status=item.status or "active",
            catalog_listing=item.catalog_listing or False,
            scanned_at=now,
            price_prev=price_prev,
            price_changed=price_changed,
            sales_since_last=sales_since_last,
        )
        db.add(snap)
        db.flush()

        # Process variants if provided
        for var in (body.variants or []):
            if var.item_id != item.id:
                continue
            var_key = f"{var.item_id}:{var.variation_id}"
            prev_var = prev_vars.get(var_key)
            var_stock_prev = prev_var.available_quantity if prev_var else None
            var_stock_changed = (prev_var is not None) and (var.available_quantity != var_stock_prev)
            if var_stock_changed:
                stock_changes += 1
            var_snap = MLCompetitorVariantSnapshot(
                snapshot_id=snap.id,
                company_id=seller.company_id,
                item_id=var.item_id,
                variation_id=var.variation_id,
                attributes_json=json.dumps(var.attributes, ensure_ascii=False) if var.attributes else None,
                available_quantity=var.available_quantity,
                price=var.price or item.price,
                scanned_at=now,
                stock_prev=var_stock_prev,
                stock_changed=var_stock_changed,
            )
            db.add(var_snap)
            variant_count += 1

    seller.last_checked_at = now
    db.commit()

    return {
        "ok": True,
        "items": len(body.items),
        "variants": variant_count,
        "price_changes": price_changes,
        "new_sales": new_sales_total,
        "stock_changes": stock_changes,
        "scanned_at": now.isoformat(),
    }


@router.post("/{seller_db_id}/scan")
def scan_seller_now(
    seller_db_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Escanea el vendedor de forma síncrona (server-side). Si el servidor tiene acceso a la API ML, usa este endpoint. Si no, usar /ingest con datos del cliente."""
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    result = _scan_seller(db, seller)
    if not result.get("ok"):
        raise HTTPException(503, detail={"error": "ml_blocked", "message": result.get("error", "La API de ML no responde desde el servidor")})
    return {"ok": True, **result}


@router.post("/scan-all")
def scan_all_sellers(
    background_tasks: BackgroundTasks,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Escanea todos los vendedores activos de la empresa en background."""
    sellers = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.company_id == user.company_id,
        MLTrackedSeller.is_active  == True,
    ).all()
    ids = [s.id for s in sellers]

    def _run():
        from app.db.session import SessionLocal
        db2 = SessionLocal()
        try:
            for sid in ids:
                s = db2.query(MLTrackedSeller).filter(MLTrackedSeller.id == sid).first()
                if s:
                    _scan_seller(db2, s)
                    time.sleep(RATE_DELAY * 5)
        finally:
            db2.close()

    background_tasks.add_task(_run)
    return {"ok": True, "message": f"Escaneo de {len(ids)} vendedor(es) iniciado en background"}


# ── Data endpoints ─────────────────────────────────────────────────────────────

@router.get("/{seller_db_id}/items", response_model=list[ItemSnapshotOut])
def get_latest_items(
    seller_db_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Último snapshot de cada publicación del vendedor."""
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    # Subconsulta: max scanned_at por item_id
    latest = (
        db.query(
            MLCompetitorSnapshot.item_id,
            func.max(MLCompetitorSnapshot.scanned_at).label("max_scanned"),
        )
        .filter(MLCompetitorSnapshot.tracked_seller_id == seller_db_id)
        .group_by(MLCompetitorSnapshot.item_id)
        .subquery()
    )
    rows = (
        db.query(MLCompetitorSnapshot)
        .join(latest, (MLCompetitorSnapshot.item_id == latest.c.item_id) &
                      (MLCompetitorSnapshot.scanned_at == latest.c.max_scanned))
        .filter(MLCompetitorSnapshot.tracked_seller_id == seller_db_id)
        .order_by(desc(MLCompetitorSnapshot.sold_quantity))
        .all()
    )
    return [ItemSnapshotOut(
        item_id=r.item_id, title=r.title, price=float(r.price),
        price_prev=float(r.price_prev) if r.price_prev else None,
        price_changed=r.price_changed, sold_quantity=r.sold_quantity,
        available_quantity=r.available_quantity,
        sales_since_last=r.sales_since_last, thumbnail=r.thumbnail,
        permalink=r.permalink, scanned_at=r.scanned_at,
    ) for r in rows]


@router.get("/{seller_db_id}/price-changes", response_model=list[ItemSnapshotOut])
def get_price_changes(
    seller_db_id: int,
    days: int = Query(7, ge=1, le=90),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Items donde se detectó cambio de precio en los últimos N días."""
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(MLCompetitorSnapshot)
        .filter(
            MLCompetitorSnapshot.tracked_seller_id == seller_db_id,
            MLCompetitorSnapshot.price_changed == True,
            MLCompetitorSnapshot.scanned_at >= since,
        )
        .order_by(desc(MLCompetitorSnapshot.scanned_at))
        .limit(200)
        .all()
    )
    return [ItemSnapshotOut(
        item_id=r.item_id, title=r.title, price=float(r.price),
        price_prev=float(r.price_prev) if r.price_prev else None,
        price_changed=r.price_changed, sold_quantity=r.sold_quantity,
        available_quantity=r.available_quantity,
        sales_since_last=r.sales_since_last, thumbnail=r.thumbnail,
        permalink=r.permalink, scanned_at=r.scanned_at,
    ) for r in rows]


@router.get("/{seller_db_id}/top-sales", response_model=list[ItemSnapshotOut])
def get_top_sales(
    seller_db_id: int,
    days: int = Query(1, ge=1, le=30),
    limit: int = Query(20, le=100),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Ranking de items por ventas acumuladas en los últimos N días."""
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Subconsulta: sum de sales_since_last por item_id
    sales_sub = (
        db.query(
            MLCompetitorSnapshot.item_id,
            func.sum(MLCompetitorSnapshot.sales_since_last).label("total_sales"),
        )
        .filter(
            MLCompetitorSnapshot.tracked_seller_id == seller_db_id,
            MLCompetitorSnapshot.scanned_at >= since,
            MLCompetitorSnapshot.sales_since_last > 0,
        )
        .group_by(MLCompetitorSnapshot.item_id)
        .order_by(desc("total_sales"))
        .limit(limit)
        .subquery()
    )

    # Traer último snapshot de cada item del ranking
    latest = (
        db.query(
            MLCompetitorSnapshot.item_id,
            func.max(MLCompetitorSnapshot.scanned_at).label("max_scanned"),
        )
        .filter(MLCompetitorSnapshot.tracked_seller_id == seller_db_id)
        .group_by(MLCompetitorSnapshot.item_id)
        .subquery()
    )

    rows = (
        db.query(MLCompetitorSnapshot)
        .join(sales_sub, MLCompetitorSnapshot.item_id == sales_sub.c.item_id)
        .join(latest, (MLCompetitorSnapshot.item_id == latest.c.item_id) &
                      (MLCompetitorSnapshot.scanned_at == latest.c.max_scanned))
        .filter(MLCompetitorSnapshot.tracked_seller_id == seller_db_id)
        .order_by(desc(sales_sub.c.total_sales))
        .all()
    )
    return [ItemSnapshotOut(
        item_id=r.item_id, title=r.title, price=float(r.price),
        price_prev=float(r.price_prev) if r.price_prev else None,
        price_changed=r.price_changed, sold_quantity=r.sold_quantity,
        available_quantity=r.available_quantity,
        sales_since_last=r.sales_since_last, thumbnail=r.thumbnail,
        permalink=r.permalink, scanned_at=r.scanned_at,
    ) for r in rows]


@router.get("/{seller_db_id}/history")
def get_item_history(
    seller_db_id: int,
    item_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Historial de precio y ventas de un item específico."""
    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(MLCompetitorSnapshot)
        .filter(
            MLCompetitorSnapshot.tracked_seller_id == seller_db_id,
            MLCompetitorSnapshot.item_id == item_id,
            MLCompetitorSnapshot.scanned_at >= since,
        )
        .order_by(MLCompetitorSnapshot.scanned_at)
        .all()
    )
    return [
        {
            "scanned_at": r.scanned_at.isoformat(),
            "price": float(r.price),
            "price_prev": float(r.price_prev) if r.price_prev else None,
            "price_changed": r.price_changed,
            "sold_quantity": r.sold_quantity,
            "sales_since_last": r.sales_since_last,
            "available_quantity": r.available_quantity,
        }
        for r in rows
    ]


@router.get("/{seller_db_id}/variants")
def get_latest_variants(
    seller_db_id: int,
    item_id: str = Query(None),
    stock_changed_only: bool = Query(False),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Últimas variantes con stock por item. Si item_id se pasa, filtra a ese item."""
    import json
    from app.models.ml_competitor import MLCompetitorVariantSnapshot

    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    # Latest variant snapshot per (item_id, variation_id)
    latest = (
        db.query(
            MLCompetitorVariantSnapshot.item_id,
            MLCompetitorVariantSnapshot.variation_id,
            func.max(MLCompetitorVariantSnapshot.scanned_at).label("max_scanned"),
        )
        .filter(MLCompetitorVariantSnapshot.company_id == seller.company_id)
        .group_by(MLCompetitorVariantSnapshot.item_id, MLCompetitorVariantSnapshot.variation_id)
        .subquery()
    )

    q = (
        db.query(MLCompetitorVariantSnapshot)
        .join(latest, (
            (MLCompetitorVariantSnapshot.item_id == latest.c.item_id) &
            (MLCompetitorVariantSnapshot.variation_id == latest.c.variation_id) &
            (MLCompetitorVariantSnapshot.scanned_at == latest.c.max_scanned)
        ))
        .filter(MLCompetitorVariantSnapshot.company_id == seller.company_id)
    )

    if item_id:
        q = q.filter(MLCompetitorVariantSnapshot.item_id == item_id)
    if stock_changed_only:
        q = q.filter(MLCompetitorVariantSnapshot.stock_changed == True)

    rows = q.order_by(MLCompetitorVariantSnapshot.item_id, MLCompetitorVariantSnapshot.variation_id).limit(500).all()

    return [
        {
            "item_id": r.item_id,
            "variation_id": r.variation_id,
            "attributes": json.loads(r.attributes_json) if r.attributes_json else {},
            "available_quantity": r.available_quantity,
            "price": float(r.price) if r.price else None,
            "stock_prev": r.stock_prev,
            "stock_changed": r.stock_changed,
            "scanned_at": r.scanned_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/{seller_db_id}/stock-changes")
def get_stock_changes(
    seller_db_id: int,
    days: int = Query(7, ge=1, le=90),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Variantes donde hubo cambio de stock (agotado o repuesto) en los últimos N días."""
    import json
    from app.models.ml_competitor import MLCompetitorVariantSnapshot

    seller = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.id == seller_db_id,
        MLTrackedSeller.company_id == user.company_id,
    ).first()
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(MLCompetitorVariantSnapshot)
        .filter(
            MLCompetitorVariantSnapshot.company_id == seller.company_id,
            MLCompetitorVariantSnapshot.stock_changed == True,
            MLCompetitorVariantSnapshot.scanned_at >= since,
        )
        .order_by(desc(MLCompetitorVariantSnapshot.scanned_at))
        .limit(300)
        .all()
    )

    # Enrich with item title from snapshot
    item_ids = list({r.item_id for r in rows})
    titles = {}
    if item_ids:
        snaps = db.query(MLCompetitorSnapshot.item_id, MLCompetitorSnapshot.title).filter(
            MLCompetitorSnapshot.tracked_seller_id == seller_db_id,
            MLCompetitorSnapshot.item_id.in_(item_ids),
        ).all()
        for s in snaps:
            titles[s.item_id] = s.title

    return [
        {
            "item_id": r.item_id,
            "item_title": titles.get(r.item_id, ""),
            "variation_id": r.variation_id,
            "attributes": json.loads(r.attributes_json) if r.attributes_json else {},
            "available_quantity": r.available_quantity,
            "stock_prev": r.stock_prev,
            "change_type": "agotado" if r.available_quantity == 0 and (r.stock_prev or 0) > 0 else ("repuesto" if r.available_quantity > 0 and (r.stock_prev or 0) == 0 else "cambio"),
            "scanned_at": r.scanned_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/stats")
def get_stats(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Resumen global: sellers, items, price changes, sales, stock changes."""
    from app.models.ml_competitor import MLCompetitorVariantSnapshot

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    sellers = db.query(MLTrackedSeller).filter(
        MLTrackedSeller.company_id == user.company_id,
    ).all()

    active_sellers = [s for s in sellers if s.is_active]
    seller_ids = [s.id for s in sellers]

    # Find last scan time across all sellers
    last_scan = None
    for s in sellers:
        if s.last_checked_at and (last_scan is None or s.last_checked_at > last_scan):
            last_scan = s.last_checked_at

    total_items = 0
    total_snapshots = 0
    price_changes_today = 0
    sales_today = 0
    stock_changes_today = 0

    if seller_ids:
        total_items = db.query(func.count(func.distinct(MLCompetitorSnapshot.item_id))).filter(
            MLCompetitorSnapshot.tracked_seller_id.in_(seller_ids)
        ).scalar() or 0

        total_snapshots = db.query(func.count(MLCompetitorSnapshot.id)).filter(
            MLCompetitorSnapshot.tracked_seller_id.in_(seller_ids)
        ).scalar() or 0

        price_changes_today = db.query(func.count(MLCompetitorSnapshot.id)).filter(
            MLCompetitorSnapshot.tracked_seller_id.in_(seller_ids),
            MLCompetitorSnapshot.price_changed == True,
            MLCompetitorSnapshot.scanned_at >= today,
        ).scalar() or 0

        sales_today = db.query(func.sum(MLCompetitorSnapshot.sales_since_last)).filter(
            MLCompetitorSnapshot.tracked_seller_id.in_(seller_ids),
            MLCompetitorSnapshot.scanned_at >= today,
        ).scalar() or 0

        stock_changes_today = db.query(func.count(MLCompetitorVariantSnapshot.id)).filter(
            MLCompetitorVariantSnapshot.company_id == user.company_id,
            MLCompetitorVariantSnapshot.stock_changed == True,
            MLCompetitorVariantSnapshot.scanned_at >= today,
        ).scalar() or 0

    return {
        "total_sellers": len(sellers),
        "active_sellers": len(active_sellers),
        "total_items": total_items,
        "total_snapshots": total_snapshots,
        "price_changes_today": price_changes_today,
        "sales_today": int(sales_today),
        "stock_changes_today": stock_changes_today,
        "last_scan": last_scan.isoformat() if last_scan else None,
    }
