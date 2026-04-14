"""
Router SUPERTREND — Análisis de competencia y tendencias de mercado.

Endpoints:
  Competidores:
    GET    /supertrend/competitors        listar
    POST   /supertrend/competitors        crear
    PUT    /supertrend/competitors/{id}   actualizar
    DELETE /supertrend/competitors/{id}   eliminar

  Tendencias:
    GET    /supertrend/trends             listar
    POST   /supertrend/trends             crear
    PUT    /supertrend/trends/{id}        actualizar
    DELETE /supertrend/trends/{id}        eliminar

  Dashboard:
    GET    /supertrend/dashboard          resumen y métricas clave
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel
from decimal import Decimal

from app.db.session import get_db
from app.models.supertrend import CompetitorEntry, TrendIndicator, TrendDirection
from app.models.user import User
from app.api.deps import get_current_user
from app.api.module_guard import RequireModule


# ── Schemas ────────────────────────────────────────────────────────────────────

class CompetitorCreate(BaseModel):
    competitor_name: str
    competitor_url: Optional[str] = None
    product_name: str
    category: Optional[str] = None
    sku_reference: Optional[str] = None
    competitor_price: Decimal
    our_price: Optional[Decimal] = None
    currency: str = "ARS"
    notes: Optional[str] = None


class CompetitorUpdate(BaseModel):
    competitor_name: Optional[str] = None
    competitor_url: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    sku_reference: Optional[str] = None
    competitor_price: Optional[Decimal] = None
    our_price: Optional[Decimal] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CompetitorOut(BaseModel):
    id: int
    competitor_name: str
    competitor_url: Optional[str]
    product_name: str
    category: Optional[str]
    sku_reference: Optional[str]
    competitor_price: float
    our_price: Optional[float]
    currency: str
    notes: Optional[str]
    is_active: bool
    price_diff_pct: Optional[float]  # calculado: (our - comp) / comp * 100
    model_config = {"from_attributes": True}


class TrendCreate(BaseModel):
    name: str
    category: Optional[str] = None
    business_type: Optional[str] = None
    direction: TrendDirection = TrendDirection.STABLE
    relevance: int = 3
    source: Optional[str] = None
    description: Optional[str] = None
    action: Optional[str] = None


class TrendUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    business_type: Optional[str] = None
    direction: Optional[TrendDirection] = None
    relevance: Optional[int] = None
    source: Optional[str] = None
    description: Optional[str] = None
    action: Optional[str] = None
    is_active: Optional[bool] = None


class TrendOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    business_type: Optional[str]
    direction: str
    relevance: int
    source: Optional[str]
    description: Optional[str]
    action: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}


# ── Router ─────────────────────────────────────────────────────────────────────

router = APIRouter(
    prefix="/supertrend",
    tags=["supertrend"],
    dependencies=[Depends(RequireModule("SUPERTREND"))],
)


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _company_id(user: User) -> Optional[int]:
    return user.company_id


def _to_competitor_out(e: CompetitorEntry) -> dict:
    diff = None
    if e.our_price and e.competitor_price and e.competitor_price != 0:
        diff = round((float(e.our_price) - float(e.competitor_price)) / float(e.competitor_price) * 100, 2)
    return {
        "id": e.id,
        "competitor_name": e.competitor_name,
        "competitor_url": e.competitor_url,
        "product_name": e.product_name,
        "category": e.category,
        "sku_reference": e.sku_reference,
        "competitor_price": float(e.competitor_price),
        "our_price": float(e.our_price) if e.our_price else None,
        "currency": e.currency,
        "notes": e.notes,
        "is_active": e.is_active,
        "price_diff_pct": diff,
    }


def _to_trend_out(t: TrendIndicator) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "business_type": t.business_type,
        "direction": t.direction.value,
        "relevance": t.relevance,
        "source": t.source,
        "description": t.description,
        "action": t.action,
        "is_active": t.is_active,
    }


# ─── Competidores ──────────────────────────────────────────────────────────────

@router.get("/competitors")
def list_competitors(
    category: Optional[str] = Query(None),
    competitor_name: Optional[str] = Query(None),
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(CompetitorEntry)
    if user.company_id:
        q = q.filter(CompetitorEntry.company_id == user.company_id)
    if active_only:
        q = q.filter(CompetitorEntry.is_active == True)
    if category:
        q = q.filter(CompetitorEntry.category.ilike(f"%{category}%"))
    if competitor_name:
        q = q.filter(CompetitorEntry.competitor_name.ilike(f"%{competitor_name}%"))

    total = q.count()
    items = q.order_by(CompetitorEntry.competitor_name, CompetitorEntry.product_name).offset(skip).limit(limit).all()
    return {"total": total, "items": [_to_competitor_out(e) for e in items]}


@router.post("/competitors", status_code=201)
def create_competitor(
    body: CompetitorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = CompetitorEntry(
        company_id=_company_id(user) or 0,
        **body.model_dump(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_competitor_out(entry)


@router.put("/competitors/{entry_id}")
def update_competitor(
    entry_id: int,
    body: CompetitorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(CompetitorEntry).get(entry_id)
    if not entry:
        raise HTTPException(404, "Entrada no encontrada")
    if user.company_id and entry.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return _to_competitor_out(entry)


@router.delete("/competitors/{entry_id}", status_code=204)
def delete_competitor(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(CompetitorEntry).get(entry_id)
    if not entry:
        raise HTTPException(404, "Entrada no encontrada")
    if user.company_id and entry.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    db.delete(entry)
    db.commit()


# ─── Tendencias ────────────────────────────────────────────────────────────────

@router.get("/trends")
def list_trends(
    direction: Optional[TrendDirection] = Query(None),
    category: Optional[str] = Query(None),
    business_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(TrendIndicator)
    if user.company_id:
        q = q.filter(TrendIndicator.company_id == user.company_id)
    if active_only:
        q = q.filter(TrendIndicator.is_active == True)
    if direction:
        q = q.filter(TrendIndicator.direction == direction)
    if category:
        q = q.filter(TrendIndicator.category.ilike(f"%{category}%"))
    if business_type:
        q = q.filter(TrendIndicator.business_type.ilike(f"%{business_type}%"))

    total = q.count()
    items = q.order_by(TrendIndicator.relevance.desc(), TrendIndicator.name).offset(skip).limit(limit).all()
    return {"total": total, "items": [_to_trend_out(t) for t in items]}


@router.post("/trends", status_code=201)
def create_trend(
    body: TrendCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not 1 <= body.relevance <= 5:
        raise HTTPException(422, "relevance debe estar entre 1 y 5")
    trend = TrendIndicator(
        company_id=_company_id(user) or 0,
        **body.model_dump(),
    )
    db.add(trend)
    db.commit()
    db.refresh(trend)
    return _to_trend_out(trend)


@router.put("/trends/{trend_id}")
def update_trend(
    trend_id: int,
    body: TrendUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trend = db.query(TrendIndicator).get(trend_id)
    if not trend:
        raise HTTPException(404, "Tendencia no encontrada")
    if user.company_id and trend.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    data = body.model_dump(exclude_none=True)
    if "relevance" in data and not 1 <= data["relevance"] <= 5:
        raise HTTPException(422, "relevance debe estar entre 1 y 5")
    for k, v in data.items():
        setattr(trend, k, v)
    db.commit()
    db.refresh(trend)
    return _to_trend_out(trend)


@router.delete("/trends/{trend_id}", status_code=204)
def delete_trend(
    trend_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trend = db.query(TrendIndicator).get(trend_id)
    if not trend:
        raise HTTPException(404, "Tendencia no encontrada")
    if user.company_id and trend.company_id != user.company_id:
        raise HTTPException(403, "Sin acceso")
    db.delete(trend)
    db.commit()


# ─── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cid = user.company_id

    # ── Competidores ──
    cq = db.query(CompetitorEntry).filter(CompetitorEntry.is_active == True)
    if cid:
        cq = cq.filter(CompetitorEntry.company_id == cid)

    competitors = cq.all()
    total_competitors = len(competitors)

    # Cuántos productos estamos más caros / más baratos / sin precio
    mas_caros = sum(1 for c in competitors if c.our_price and c.competitor_price and c.our_price > c.competitor_price)
    mas_baratos = sum(1 for c in competitors if c.our_price and c.competitor_price and c.our_price < c.competitor_price)
    sin_precio = sum(1 for c in competitors if not c.our_price)

    # Diferencia promedio de precio
    diffs = [
        (float(c.our_price) - float(c.competitor_price)) / float(c.competitor_price) * 100
        for c in competitors if c.our_price and c.competitor_price and c.competitor_price != 0
    ]
    avg_diff_pct = round(sum(diffs) / len(diffs), 2) if diffs else None

    # Categorías únicas con competidores
    categories_comp = list({c.category for c in competitors if c.category})

    # ── Tendencias ──
    tq = db.query(TrendIndicator).filter(TrendIndicator.is_active == True)
    if cid:
        tq = tq.filter(TrendIndicator.company_id == cid)

    trends = tq.all()
    trends_up = [_to_trend_out(t) for t in trends if t.direction == TrendDirection.UP]
    trends_down = [_to_trend_out(t) for t in trends if t.direction == TrendDirection.DOWN]
    trends_stable = [_to_trend_out(t) for t in trends if t.direction == TrendDirection.STABLE]

    # Top 5 tendencias alcistas por relevancia
    top_trends = sorted(trends_up, key=lambda t: t["relevance"], reverse=True)[:5]

    # Últimos competidores registrados (5)
    recent_competitors = sorted(competitors, key=lambda c: c.created_at, reverse=True)[:5]

    return {
        "competitors": {
            "total": total_competitors,
            "mas_caros": mas_caros,
            "mas_baratos": mas_baratos,
            "sin_precio_propio": sin_precio,
            "diferencia_promedio_pct": avg_diff_pct,
            "categorias": categories_comp,
            "recientes": [_to_competitor_out(c) for c in recent_competitors],
        },
        "trends": {
            "total": len(trends),
            "up": len(trends_up),
            "stable": len(trends_stable),
            "down": len(trends_down),
            "top_alcistas": top_trends,
        },
    }
