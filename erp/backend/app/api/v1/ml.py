"""
Router ML (MercadoLibre) — proxy a la API oficial de ML con auto-refresh de token.
Soporta múltiples cuentas (valen / neuquen).

Endpoints:
  GET /ml/status          → estado del token + info del usuario ML
  GET /ml/indicators      → métricas del vendedor (reputación, items activos, ventas)
  GET /ml/orders          → listado de órdenes/ventas
  GET /ml/questions       → preguntas de compradores (UNANSWERED por defecto)
  POST /ml/questions/{id}/answer  → responder una pregunta
  GET /ml/items           → publicaciones activas del vendedor
  GET /ml/accounts        → lista de cuentas configuradas
"""

import json
import time
import threading
from pathlib import Path
from typing import Optional

import requests as _requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User

# ── Multi-account Token Manager ────────────────────────────────────────────────

ML_BASE = "https://api.mercadolibre.com"

ACCOUNTS = {
    "valen":   Path(r"D:\ERP MUNDO OUTDOOR\super trend\token_valen.json"),
    "neuquen": Path(r"D:\ERP MUNDO OUTDOOR\super trend\token_neuquen.json"),
}
# Fallback: si existe el token.json legacy, usarlo como "valen"
_LEGACY = Path(r"D:\ERP MUNDO OUTDOOR\super trend\token.json")


class _TokenManager:
    def __init__(self, token_file: Path):
        self._file = token_file
        self._lock = threading.Lock()
        self._cache: dict = {}

    def _load(self) -> dict:
        if self._file.exists():
            return json.loads(self._file.read_text(encoding="utf-8"))
        # intentar legacy
        if _LEGACY.exists():
            return json.loads(_LEGACY.read_text(encoding="utf-8"))
        return {}

    def _save(self, data: dict):
        self._file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _is_expired(self, t: dict) -> bool:
        created = t.get("created_at", 0)
        expires = t.get("expires_in", 21600)
        return time.time() > (created + expires - 300)  # 5 min buffer

    def _do_refresh(self, t: dict) -> dict:
        resp = _requests.post(
            f"{ML_BASE}/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": t["client_id"],
                "client_secret": t["client_secret"],
                "refresh_token": t["refresh_token"],
            },
            timeout=15,
        )
        resp.raise_for_status()
        new = resp.json()
        new["client_id"] = t["client_id"]
        new["client_secret"] = t["client_secret"]
        new["user_id"] = t.get("user_id") or new.get("user_id")
        new["label"] = t.get("label", "")
        new["created_at"] = int(time.time())
        self._save(new)
        return new

    def get_token(self) -> str:
        with self._lock:
            if not self._cache:
                self._cache = self._load()
            if not self._cache:
                raise HTTPException(502, f"Token ML no configurado ({self._file.name})")
            if self._is_expired(self._cache):
                try:
                    self._cache = self._do_refresh(self._cache)
                except Exception as e:
                    raise HTTPException(502, f"No se pudo renovar el token ML: {e}")
            return self._cache["access_token"]

    def get_user_id(self) -> str:
        with self._lock:
            if not self._cache:
                self._cache = self._load()
        return str(self._cache.get("user_id", ""))

    def get_label(self) -> str:
        with self._lock:
            if not self._cache:
                self._cache = self._load()
        return self._cache.get("label", self._file.stem)

    def get_cache(self) -> dict:
        with self._lock:
            if not self._cache:
                self._cache = self._load()
        return dict(self._cache)

    def call(self, method: str, path: str, **kwargs):
        token = self.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{ML_BASE}{path}"
        resp = _requests.request(method, url, headers=headers, timeout=20, **kwargs)
        if resp.status_code == 401:
            with self._lock:
                try:
                    self._cache = self._do_refresh(self._cache)
                except Exception as e:
                    raise HTTPException(502, f"Token ML inválido: {e}")
            resp = _requests.request(
                method, url,
                headers={"Authorization": f"Bearer {self._cache['access_token']}"},
                timeout=20, **kwargs,
            )
        if not resp.ok:
            raise HTTPException(resp.status_code, f"ML API error: {resp.text[:300]}")
        return resp.json()


_managers: dict[str, _TokenManager] = {
    name: _TokenManager(path) for name, path in ACCOUNTS.items()
}


def _get_manager(account: str) -> _TokenManager:
    mgr = _managers.get(account.lower())
    if not mgr:
        raise HTTPException(400, f"Cuenta ML '{account}' no existe. Opciones: {list(_managers.keys())}")
    return mgr


# Compat helpers — usados por el módulo depósito (siempre usa cuenta "valen")
def _get_token() -> str:
    return _managers["valen"].get_token()

def _get_user_id() -> str:
    return _managers["valen"].get_user_id()

def _ml(method: str, path: str, **kwargs):
    return _managers["valen"].call(method, path, **kwargs)


# ── Router ─────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/ml", tags=["mercadolibre"])


# ── /cash-flow ────────────────────────────────────────────────────────────────

MP_BASE = "https://api.mercadopago.com"


@router.get("/cash-flow")
def ml_cash_flow(current_user: User = Depends(get_current_user)):
    """Dinero disponible y a acreditar de cada cuenta ML (vía MP API)."""
    results = []
    for name, mgr in _managers.items():
        entry = {"account": name, "label": mgr.get_label(), "available": None, "pending": None, "total": None, "error": None, "currency": "ARS"}
        try:
            token = mgr.get_token()
            user_id = mgr.get_user_id()
            resp = _requests.get(
                f"{ML_BASE}/users/{user_id}/mercadopago_account/balance",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            if resp.ok:
                data = resp.json()
                entry["available"] = data.get("available_balance", 0)
                entry["pending"] = data.get("unavailable_balance", 0)
                entry["total"] = data.get("total_amount", (entry["available"] or 0) + (entry["pending"] or 0))
                entry["currency"] = data.get("currency_id", "ARS")
            else:
                entry["error"] = f"MP API {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            entry["error"] = str(e)
        results.append(entry)
    return results


# ── /accounts ─────────────────────────────────────────────────────────────────

@router.get("/accounts")
def ml_accounts(current_user: User = Depends(get_current_user)):
    """Lista las cuentas ML configuradas."""
    result = []
    for name, mgr in _managers.items():
        try:
            cache = mgr.get_cache()
            result.append({
                "key": name,
                "label": cache.get("label", name),
                "user_id": cache.get("user_id"),
                "configured": bool(cache),
            })
        except Exception:
            result.append({"key": name, "label": name, "user_id": None, "configured": False})
    return result


# ── /status ───────────────────────────────────────────────────────────────────

@router.get("/status")
def ml_status(
    account: str = Query("valen"),
    current_user: User = Depends(get_current_user),
):
    """Estado del token y datos básicos del vendedor ML."""
    mgr = _get_manager(account)
    cache = mgr.get_cache()
    created = cache.get("created_at", 0)
    expires_in = cache.get("expires_in", 21600)
    remaining = max(0, int((created + expires_in) - time.time()))

    user_id = mgr.get_user_id()
    try:
        user_info = mgr.call("GET", f"/users/{user_id}")
    except Exception as e:
        user_info = {"error": str(e)}

    return {
        "token_ok": remaining > 0,
        "token_remaining_seconds": remaining,
        "user_id": user_id,
        "account": account,
        "label": mgr.get_label(),
        "user_info": user_info,
    }


# ── /indicators ───────────────────────────────────────────────────────────────

@router.get("/indicators")
def ml_indicators(
    account: str = Query("valen"),
    current_user: User = Depends(get_current_user),
):
    """Métricas clave del vendedor: reputación, items activos, ventas del mes."""
    mgr = _get_manager(account)
    user_id = mgr.get_user_id()

    # User profile + reputation
    user = mgr.call("GET", f"/users/{user_id}")

    # Active listings count
    items_resp = mgr.call("GET", f"/users/{user_id}/items/search", params={"status": "active", "limit": 1})
    active_items = items_resp.get("paging", {}).get("total", 0)

    # Paused listings
    paused_resp = mgr.call("GET", f"/users/{user_id}/items/search", params={"status": "paused", "limit": 1})
    paused_items = paused_resp.get("paging", {}).get("total", 0)

    # Orders last 30 days (summary)
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    date_from_30d = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000-00:00")
    orders_resp = mgr.call("GET", "/orders/search", params={
        "seller": user_id,
        "order.status": "paid",
        "order.date_created.from": date_from_30d,
        "limit": 1,
    })
    total_orders_30d = orders_resp.get("paging", {}).get("total", 0)

    # Today's orders (paid only — ID-113/114 fix)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S.000-00:00")
    today_resp = mgr.call("GET", "/orders/search", params={
        "seller": user_id,
        "order.status": "paid",
        "order.date_created.from": today_start,
        "limit": 1,
    })
    today_orders = today_resp.get("paging", {}).get("total", 0)

    # Unanswered questions count
    try:
        q_resp = mgr.call("GET", "/questions/search", params={
            "seller_id": user_id, "status": "UNANSWERED", "limit": 1,
        })
        unanswered_questions = q_resp.get("total", 0)
    except Exception:
        unanswered_questions = 0

    reputation = user.get("seller_reputation", {})
    metrics = reputation.get("metrics", {})

    return {
        "nickname": user.get("nickname"),
        "email": user.get("email"),
        "reputation_level": reputation.get("level_id"),
        "reputation_power_seller_status": reputation.get("power_seller_status"),
        "transactions_completed": reputation.get("transactions", {}).get("completed", 0),
        "transactions_canceled": reputation.get("transactions", {}).get("canceled", 0),
        "ratings_positive_pct": metrics.get("sales", {}).get("ratings", {}).get("positive") if metrics else None,
        "claims_rate": metrics.get("claims", {}).get("rate") if metrics else None,
        "delayed_handling_rate": metrics.get("delayed_handling_time", {}).get("rate") if metrics else None,
        "cancellations_rate": metrics.get("cancellations", {}).get("rate") if metrics else None,
        "active_items": active_items,
        "paused_items": paused_items,
        "orders_last_30d": total_orders_30d,
        "today_orders": today_orders,
        "unanswered_questions": unanswered_questions,
        "registration_date": user.get("registration_date"),
        "site_id": user.get("site_id"),
        "permalink": user.get("permalink"),
        "account": account,
        "label": mgr.get_label(),
    }


# ── /orders ───────────────────────────────────────────────────────────────────

@router.get("/orders")
def ml_orders(
    limit: int = Query(50, le=50),
    offset: int = Query(0, ge=0),
    status: str = Query("paid"),   # paid | confirmed | cancelled | all
    days: int = Query(30, ge=1, le=365),
    account: str = Query("valen"),
    current_user: User = Depends(get_current_user),
):
    """Listado de órdenes/ventas del vendedor."""
    from datetime import datetime, timedelta, timezone
    mgr = _get_manager(account)
    user_id = mgr.get_user_id()

    date_from = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000-00:00")

    params = {
        "seller": user_id,
        "sort": "date_desc",
        "limit": limit,
        "offset": offset,
        "order.date_created.from": date_from,
    }
    if status != "all":
        params["order.status"] = status

    data = mgr.call("GET", "/orders/search", params=params)
    results = data.get("results", [])

    orders = []
    for o in results:
        order_items = o.get("order_items", [])
        first_item = order_items[0] if order_items else {}
        # Detect fulfillment/shipping type (ID-118)
        tags = o.get("tags", []) or []
        shipping = o.get("shipping", {}) or {}
        ship_tags = shipping.get("tags") or []
        logistic_type = shipping.get("logistic_type") or ""
        if "fulfillment" in tags or logistic_type == "fulfillment":
            fulfillment_type = "Full"
        elif "flex" in ship_tags or logistic_type == "flex":
            fulfillment_type = "Flex"
        else:
            fulfillment_type = "Colecta"
        orders.append({
            "id": o.get("id"),
            "status": o.get("status"),
            "status_detail": o.get("status_detail"),
            "date_created": o.get("date_created"),
            "date_closed": o.get("date_closed"),
            "total_amount": o.get("total_amount"),
            "currency_id": o.get("currency_id"),
            "buyer_nickname": o.get("buyer", {}).get("nickname"),
            "item_title": first_item.get("item", {}).get("title"),
            "item_quantity": first_item.get("quantity"),
            "unit_price": first_item.get("unit_price"),
            "full_unit_price": first_item.get("full_unit_price"),  # ID-117: pre-discount price
            "sku": first_item.get("item", {}).get("seller_sku"),
            "shipping_id": shipping.get("id"),
            "tags": tags,
            "fulfillment_type": fulfillment_type,  # ID-118
        })

    return {
        "total": data.get("paging", {}).get("total", 0),
        "offset": offset,
        "limit": limit,
        "orders": orders,
        "account": account,
    }


# ── /questions ────────────────────────────────────────────────────────────────

@router.get("/questions")
def ml_questions(
    status: str = Query("UNANSWERED"),  # UNANSWERED | ANSWERED | CLOSED | DELETED | UNDER_REVIEW
    limit: int = Query(50, le=50),
    offset: int = Query(0, ge=0),
    account: str = Query("valen"),
    current_user: User = Depends(get_current_user),
):
    """Preguntas de compradores sobre las publicaciones del vendedor."""
    mgr = _get_manager(account)
    user_id = mgr.get_user_id()
    params = {
        "seller_id": user_id,
        "status": status,
        "limit": limit,
        "offset": offset,
        "sort_fields": "date_created",
        "sort_types": "DESC",
    }
    data = mgr.call("GET", "/questions/search", params=params)
    questions = []
    for q in data.get("questions", []):
        questions.append({
            "id": q.get("id"),
            "text": q.get("text"),
            "status": q.get("status"),
            "date_created": q.get("date_created"),
            "item_id": q.get("item_id"),
            "seller_id": q.get("seller_id"),
            "buyer_id": q.get("from", {}).get("id"),
            "answer": q.get("answer"),
        })

    # Fetch item titles for questions
    item_ids = list({q["item_id"] for q in questions if q["item_id"]})
    item_titles: dict = {}
    if item_ids:
        chunk = item_ids[:20]  # ML allows up to 20 in one call
        try:
            items_resp = mgr.call("GET", "/items", params={"ids": ",".join(chunk)})
            for entry in items_resp:
                body = entry.get("body", {})
                item_titles[body.get("id")] = body.get("title")
        except Exception:
            pass

    for q in questions:
        q["item_title"] = item_titles.get(q["item_id"])

    return {
        "total": data.get("total", len(questions)),
        "offset": offset,
        "limit": limit,
        "questions": questions,
        "account": account,
    }


# ── /questions/{id}/answer ────────────────────────────────────────────────────

class AnswerBody(BaseModel):
    text: str
    account: str = "valen"


@router.post("/questions/{question_id}/answer")
def ml_answer_question(
    question_id: int,
    body: AnswerBody,
    current_user: User = Depends(get_current_user),
):
    """Responder una pregunta de comprador directamente desde el ERP."""
    if not body.text or len(body.text.strip()) < 5:
        raise HTTPException(400, "La respuesta debe tener al menos 5 caracteres")
    mgr = _get_manager(body.account)
    result = mgr.call("POST", "/answers", json={"question_id": question_id, "text": body.text.strip()})
    return result


# ── /items ────────────────────────────────────────────────────────────────────

@router.get("/items")
def ml_items(
    status: str = Query("active"),  # active | paused | closed | under_review
    limit: int = Query(50, le=50),
    offset: int = Query(0, ge=0),
    account: str = Query("valen"),
    current_user: User = Depends(get_current_user),
):
    """Publicaciones del vendedor."""
    mgr = _get_manager(account)
    user_id = mgr.get_user_id()
    search = mgr.call("GET", f"/users/{user_id}/items/search", params={
        "status": status, "limit": limit, "offset": offset
    })
    item_ids = search.get("results", [])
    total = search.get("paging", {}).get("total", 0)

    items = []
    if item_ids:
        chunk = item_ids[:20]
        try:
            detail = _ml("GET", "/items", params={"ids": ",".join(chunk), "attributes": "id,title,price,currency_id,available_quantity,sold_quantity,status,permalink,thumbnail"})
            for entry in detail:
                body = entry.get("body", {})
                items.append({
                    "id": body.get("id"),
                    "title": body.get("title"),
                    "price": body.get("price"),
                    "currency_id": body.get("currency_id"),
                    "available_quantity": body.get("available_quantity"),
                    "sold_quantity": body.get("sold_quantity"),
                    "status": body.get("status"),
                    "permalink": body.get("permalink"),
                    "thumbnail": body.get("thumbnail"),
                })
        except Exception:
            pass

    return {"total": total, "offset": offset, "limit": limit, "items": items, "account": account}


# ══════════════════════════════════════════════════════════════════════════════
# MÓDULO DEPÓSITO — Picking de órdenes ML (COMPLETO)
# ══════════════════════════════════════════════════════════════════════════════

from datetime import timedelta, timezone
from typing import List, Optional
import json as _json
import logging as _logging

from fastapi import Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, Date
from app.db.session import get_db
from app.models.meli_order import MeliOrder
from app.models.meli_config import MeliConfig
from app.models.meli_webhook import MeliWebhookEvent
from app.services.dragonfish import get_stock_per_deposit, move_stock, STOCK_FIELD_MAP
from app.services.meli_assigner import auto_assign_orders, assign_single_order
from app.services.meli_notes import publish_note
from app.services.meli_sku import resolve_sku, is_out_sku

_log = _logging.getLogger("ml.deposito")


def _parse_sku_talle_color(item: dict) -> tuple:
    """Extrae SKU, talle, color y variation_id de un item de orden ML."""
    sku = item.get("item", {}).get("seller_sku") or item.get("item", {}).get("id")
    talle = None
    color = None
    for attr in item.get("item", {}).get("variation_attributes", []) or []:
        name = (attr.get("name") or "").upper()
        val = attr.get("value_name") or ""
        if name in ("TALLE", "SIZE", "TAMANHO"):
            talle = val
        elif name in ("COLOR", "COR", "COLOUR"):
            color = val
    custom = item.get("item", {}).get("seller_custom_field") or ""
    if custom and not sku:
        sku = custom
    variation_id = str(item.get("item", {}).get("variation_id") or "") or None
    return sku, talle, color, variation_id


def _get_config(db: Session, company_id: int) -> Optional[MeliConfig]:
    """Get or create MeliConfig for company."""
    cfg = db.query(MeliConfig).filter(MeliConfig.company_id == company_id).first()
    return cfg


def _get_dragon_params(cfg: Optional[MeliConfig]) -> dict:
    """Extract Dragonfish connection params from config."""
    if not cfg:
        return {}
    bases = [b.strip() for b in (cfg.dragon_api_bases or "").split(",") if b.strip()]
    return {
        "api_bases": bases,
        "api_key": cfg.dragon_api_key or "",
        "id_cliente": cfg.dragon_id_cliente or "PRUEBA-WEB",
        "mov_url": cfg.dragon_mov_url or "",
        "base_datos": cfg.dragon_base_datos or "MELI",
    }


def _get_token_for_account(cfg: Optional[MeliConfig], account: str = "1") -> dict:
    """Get ML token data for account 1 or 2."""
    if not cfg:
        return {}
    if account == "2":
        return {
            "access_token": cfg.ml2_access_token or "",
            "client_id": cfg.ml2_client_id or "",
            "client_secret": cfg.ml2_client_secret or "",
            "refresh_token": cfg.ml2_refresh_token or "",
            "user_id": cfg.ml2_user_id or "",
        }
    return {
        "access_token": cfg.ml1_access_token or "",
        "client_id": cfg.ml1_client_id or "",
        "client_secret": cfg.ml1_client_secret or "",
        "refresh_token": cfg.ml1_refresh_token or "",
        "user_id": cfg.ml1_user_id or "",
    }


def _order_to_dict(o: MeliOrder) -> dict:
    return {
        "id": o.id,
        "order_id": o.order_id,
        "pack_id": o.pack_id,
        "item_id": o.item_id,
        "shipment_id": o.shipment_id,
        "variation_id": o.variation_id,
        "item_title": o.item_title,
        "sku": o.sku,
        "sku_real": o.sku_real,
        "barcode": o.barcode,
        "quantity": o.quantity,
        "unit_price": o.unit_price,
        "talle": o.talle,
        "color": o.color,
        "buyer_nickname": o.buyer_nickname,
        "shipping_status": o.shipping_status,
        "shipping_substatus": o.shipping_substatus,
        "fulfillment": o.fulfillment,
        "order_status": o.order_status,
        "nota": o.nota,
        "comentario": o.comentario,
        "venta_tipo": o.venta_tipo,
        "deposito_asignado": o.deposito_asignado,
        "asignado_flag": o.asignado_flag,
        "asignacion_detalle": o.asignacion_detalle,
        "movimiento_realizado": o.movimiento_realizado,
        "numero_movimiento": o.numero_movimiento,
        "agotamiento_flag": o.agotamiento_flag,
        "estado_picking": o.estado_picking,
        "motivo_falla": o.motivo_falla,
        "printed": o.printed,
        "meli_account": o.meli_account,
        "seller_id": o.seller_id,
        "stock_dep": o.stock_dep,
        "stock_mundoal": o.stock_mundoal,
        "stock_monbahia": o.stock_monbahia,
        "stock_mtgbbps": o.stock_mtgbbps,
        "stock_mundocab": o.stock_mundocab,
        "stock_nqnshop": o.stock_nqnshop,
        "stock_mtgcom": o.stock_mtgcom,
        "stock_mtgroca": o.stock_mtgroca,
        "stock_mundoroc": o.stock_mundoroc,
        "stock_nqnalb": o.stock_nqnalb,
        "stock_real": o.stock_real,
        "fecha_orden": o.fecha_orden.isoformat() if o.fecha_orden else None,
        "fecha_picking": o.fecha_picking.isoformat() if o.fecha_picking else None,
        "fecha_sync": o.fecha_sync.isoformat() if o.fecha_sync else None,
        "fecha_asignacion": o.fecha_asignacion.isoformat() if o.fecha_asignacion else None,
    }


def _sync_orders_to_db(db: Session, company_id: int, orders: list, seller_id: str, account: str = "1"):
    """Persiste/actualiza las órdenes ML en la tabla meli_orders."""
    synced = 0
    for o in orders:
        order_id = o.get("id")
        if not order_id:
            continue
        for item in o.get("order_items", []) or []:
            sku, talle, color, variation_id = _parse_sku_talle_color(item)
            fecha_str = o.get("date_created") or o.get("date_closed")
            fecha_orden = None
            if fecha_str:
                try:
                    from dateutil import parser as dp
                    fecha_orden = dp.parse(fecha_str)
                except Exception:
                    pass

            item_id = item.get("item", {}).get("id")
            existing = db.query(MeliOrder).filter(
                MeliOrder.company_id == company_id,
                MeliOrder.order_id == order_id,
                MeliOrder.item_id == item_id,
            ).first()

            # Detect fulfillment
            tags = o.get("tags", [])
            fulfillment = None
            if "fulfillment" in tags or "pack_order" in str(tags):
                fulfillment = "full"
            ship_tags = (o.get("shipping") or {}).get("tags", [])
            if isinstance(ship_tags, list):
                if "fulfillment" in ship_tags:
                    fulfillment = "full"
                elif "flex" in ship_tags:
                    fulfillment = "flex"

            if existing:
                existing.shipping_status = (o.get("shipping") or {}).get("status")
                existing.shipping_substatus = (o.get("shipping") or {}).get("substatus")
                existing.order_status = o.get("status")
                existing.fecha_sync = datetime.utcnow()
                existing.fulfillment = fulfillment
                if not existing.variation_id and variation_id:
                    existing.variation_id = variation_id
            else:
                pack_id = o.get("pack_id")
                meli_order = MeliOrder(
                    company_id=company_id,
                    order_id=order_id,
                    pack_id=pack_id,
                    item_id=item_id,
                    shipment_id=(o.get("shipping") or {}).get("id"),
                    variation_id=variation_id,
                    item_title=item.get("item", {}).get("title"),
                    sku=sku,
                    quantity=item.get("quantity", 1),
                    unit_price=item.get("unit_price"),
                    talle=talle,
                    color=color,
                    buyer_nickname=(o.get("buyer") or {}).get("nickname"),
                    buyer_id=(o.get("buyer") or {}).get("id"),
                    shipping_status=(o.get("shipping") or {}).get("status"),
                    shipping_substatus=(o.get("shipping") or {}).get("substatus"),
                    order_status=o.get("status"),
                    tags=_json.dumps(o.get("tags", [])),
                    fulfillment=fulfillment,
                    venta_tipo="pack" if pack_id else "single",
                    estado_picking="PENDIENTE",
                    printed=False,
                    fecha_orden=fecha_orden,
                    fecha_sync=datetime.utcnow(),
                    meli_account=account,
                    seller_id=seller_id,
                )
                db.add(meli_order)
                synced += 1
    db.commit()
    return synced


# ══════════════════════════════════════════════════════════════════════════════
# FASE 0 — Configuración ML
# ══════════════════════════════════════════════════════════════════════════════

class MeliConfigBody(BaseModel):
    ml1_client_id: Optional[str] = None
    ml1_client_secret: Optional[str] = None
    ml1_access_token: Optional[str] = None
    ml1_refresh_token: Optional[str] = None
    ml1_user_id: Optional[str] = None
    ml2_client_id: Optional[str] = None
    ml2_client_secret: Optional[str] = None
    ml2_access_token: Optional[str] = None
    ml2_refresh_token: Optional[str] = None
    ml2_user_id: Optional[str] = None
    dragon_api_bases: Optional[str] = None
    dragon_api_key: Optional[str] = None
    dragon_id_cliente: Optional[str] = None
    dragon_mov_url: Optional[str] = None
    dragon_base_datos: Optional[str] = None
    clusters: Optional[dict] = None
    lejanos: Optional[list] = None
    printer_zebra_name: Optional[str] = None
    printer_list_name: Optional[str] = None
    webhook_secret: Optional[str] = None
    auto_assign_enabled: Optional[bool] = None
    auto_notes_enabled: Optional[bool] = None


@router.get("/config")
def ml_get_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtiene la configuración ML de la empresa."""
    company_id = current_user.company_id or 1
    cfg = _get_config(db, company_id)
    if not cfg:
        return {"configured": False}
    return {
        "configured": True,
        "ml1_client_id": cfg.ml1_client_id,
        "ml1_user_id": cfg.ml1_user_id,
        "ml1_has_token": bool(cfg.ml1_access_token),
        "ml2_client_id": cfg.ml2_client_id,
        "ml2_user_id": cfg.ml2_user_id,
        "ml2_has_token": bool(cfg.ml2_access_token),
        "dragon_api_bases": cfg.dragon_api_bases,
        "dragon_id_cliente": cfg.dragon_id_cliente,
        "dragon_mov_url": cfg.dragon_mov_url,
        "dragon_base_datos": cfg.dragon_base_datos,
        "dragon_has_key": bool(cfg.dragon_api_key),
        "clusters": cfg.clusters,
        "lejanos": cfg.lejanos,
        "printer_zebra_name": cfg.printer_zebra_name,
        "printer_list_name": cfg.printer_list_name,
        "auto_assign_enabled": cfg.auto_assign_enabled,
        "auto_notes_enabled": cfg.auto_notes_enabled,
    }


@router.put("/config")
def ml_put_config(
    body: MeliConfigBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Guarda/actualiza la configuración ML."""
    company_id = current_user.company_id or 1
    cfg = db.query(MeliConfig).filter(MeliConfig.company_id == company_id).first()
    if not cfg:
        cfg = MeliConfig(company_id=company_id)
        db.add(cfg)

    for field, val in body.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(cfg, field, val)

    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# FASE 1 — Dragonfish stock & movimientos
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dragonfish/stock")
def ml_dragonfish_stock(
    sku: str = Query(..., description="SKU a consultar (ej: ART-COLOR-TALLE)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta stock por depósito en Dragonfish API."""
    cfg = _get_config(db, current_user.company_id or 1)
    dp = _get_dragon_params(cfg)
    if not dp.get("api_bases"):
        raise HTTPException(400, "Dragonfish no configurado. Ir a Config ML.")
    try:
        stock = get_stock_per_deposit(sku, **{k: dp[k] for k in ("api_bases", "api_key", "id_cliente")})
        total = sum(stock.values())
        return {"sku": sku, "stock_por_deposito": stock, "total": total}
    except Exception as e:
        raise HTTPException(502, f"Error consultando Dragonfish: {e}")


class MovementBody(BaseModel):
    sku: str
    qty: int
    observacion: str = ""
    origen_destino: Optional[str] = None
    tipo: int = 2  # 2=resta, 1=suma
    barcode: Optional[str] = None


@router.post("/dragonfish/movement")
def ml_dragonfish_movement(
    body: MovementBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra un movimiento de stock en Dragonfish."""
    cfg = _get_config(db, current_user.company_id or 1)
    dp = _get_dragon_params(cfg)
    if not dp.get("mov_url"):
        raise HTTPException(400, "URL de movimiento Dragonfish no configurada.")
    result = move_stock(
        sku=body.sku, qty=body.qty, observacion=body.observacion,
        mov_url=dp["mov_url"], api_key=dp["api_key"], id_cliente=dp["id_cliente"],
        base_datos=dp["base_datos"], origen_destino=body.origen_destino or dp["base_datos"],
        tipo=body.tipo, barcode=body.barcode,
    )
    if not result.get("ok"):
        raise HTTPException(502, f"Error en movimiento Dragonfish: {result.get('error')}")
    return result


# ══════════════════════════════════════════════════════════════════════════════
# SYNC (mejorado con enriquecimiento Dragonfish + multi-cuenta)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/deposito/sync")
def ml_deposito_sync(
    days: int = Query(7, ge=1, le=60),
    enrich_stock: bool = Query(True, description="Enriquecer con stock Dragonfish"),
    account: str = Query("1", description="Cuenta ML: 1 o 2"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sincroniza órdenes recientes desde ML API a PostgreSQL."""
    from datetime import datetime as dt, timedelta, timezone as tz

    user_id = _get_user_id()
    now = dt.now(tz.utc)
    date_from = (now - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000-00:00")

    all_orders: list = []
    offset = 0
    limit = 50
    while True:
        params = {
            "seller": user_id,
            "sort": "date_desc",
            "limit": limit,
            "offset": offset,
            "order.date_created.from": date_from,
        }
        data = _ml("GET", "/orders/search", params=params)
        results = data.get("results", [])
        if not results:
            break
        all_orders.extend(results)
        if len(results) < limit:
            break
        offset += limit
        if offset >= 500:
            break

    company_id = current_user.company_id or 1
    synced = _sync_orders_to_db(db, company_id, all_orders, user_id, account)

    # Enrich with Dragonfish stock
    enriched = 0
    if enrich_stock:
        cfg = _get_config(db, company_id)
        dp = _get_dragon_params(cfg)
        if dp.get("api_bases") and dp.get("api_key"):
            pending = db.query(MeliOrder).filter(
                MeliOrder.company_id == company_id,
                MeliOrder.estado_picking == "PENDIENTE",
                MeliOrder.stock_real.is_(None),
            ).limit(200).all()

            sku_cache: dict = {}
            for o in pending:
                sku = o.sku or ""
                if not sku:
                    continue
                if sku not in sku_cache:
                    try:
                        sku_cache[sku] = get_stock_per_deposit(
                            sku, api_bases=dp["api_bases"], api_key=dp["api_key"], id_cliente=dp["id_cliente"]
                        )
                    except Exception:
                        sku_cache[sku] = {}
                stock = sku_cache[sku]
                total = 0
                for depot, qty in stock.items():
                    field = STOCK_FIELD_MAP.get(depot)
                    if field:
                        setattr(o, field, qty)
                    total += qty
                o.stock_real = total
                enriched += 1
            db.commit()

    return {"ok": True, "fetched": len(all_orders), "new_records": synced, "enriched": enriched, "days": days}


# ══════════════════════════════════════════════════════════════════════════════
# DEPOSITO — CRUD / Picking
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/deposito/orders")
def ml_deposito_orders(
    estado_picking: Optional[str] = Query(None),
    deposito: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    include_all: bool = Query(False, description="Incluir todos los estados"),
    limit: int = Query(300, le=1000),
    meli_account: Optional[str] = Query(None, description="Filtrar por cuenta ML: 1 o 2"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista órdenes ML con filtros para el workflow de picking."""
    from datetime import datetime as dt
    company_id = current_user.company_id or 1
    q = db.query(MeliOrder).filter(MeliOrder.company_id == company_id)

    if meli_account:
        q = q.filter(MeliOrder.meli_account == meli_account)

    if estado_picking:
        q = q.filter(MeliOrder.estado_picking == estado_picking)
    elif not include_all:
        q = q.filter(MeliOrder.estado_picking == "PENDIENTE")

    if deposito:
        q = q.filter(MeliOrder.deposito_asignado == deposito)
    if desde:
        try:
            q = q.filter(MeliOrder.fecha_orden >= dt.strptime(desde, "%Y-%m-%d"))
        except ValueError:
            pass
    if hasta:
        try:
            from datetime import time as dtime
            q = q.filter(MeliOrder.fecha_orden <= dt.combine(dt.strptime(hasta, "%Y-%m-%d"), dtime.max))
        except ValueError:
            pass
    if search:
        s = f"%{search}%"
        q = q.filter(or_(
            MeliOrder.item_title.ilike(s),
            MeliOrder.sku.ilike(s),
            MeliOrder.buyer_nickname.ilike(s),
            MeliOrder.nota.ilike(s),
            MeliOrder.barcode.ilike(s),
        ))

    orders = q.order_by(MeliOrder.fecha_orden.desc()).limit(limit).all()
    return [_order_to_dict(o) for o in orders]


@router.post("/deposito/orders/{order_db_id}/pick")
def ml_deposito_pick(
    order_db_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marca una orden como PICKEADA."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    order.estado_picking = "PICKEADO"
    order.printed = True
    order.fecha_picking = datetime.utcnow()
    db.commit()
    return {"ok": True, "estado_picking": "PICKEADO"}


class FailBody(BaseModel):
    motivo: str = "Sin stock"


@router.post("/deposito/orders/{order_db_id}/fail")
def ml_deposito_fail(
    order_db_id: int,
    body: FailBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marca una orden como FALLADA con motivo."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    order.estado_picking = "FALLADO"
    order.motivo_falla = body.motivo
    db.commit()
    return {"ok": True, "estado_picking": "FALLADO", "motivo": body.motivo}


@router.post("/deposito/orders/{order_db_id}/revert")
def ml_deposito_revert(
    order_db_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revierte una orden a PENDIENTE."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    order.estado_picking = "PENDIENTE"
    order.printed = False
    order.motivo_falla = None
    order.fecha_picking = None
    db.commit()
    return {"ok": True, "estado_picking": "PENDIENTE"}


class PatchOrderBody(BaseModel):
    deposito_asignado: Optional[str] = None
    nota: Optional[str] = None
    comentario: Optional[str] = None
    estado_picking: Optional[str] = None
    barcode: Optional[str] = None


@router.patch("/deposito/orders/{order_db_id}")
def ml_deposito_patch(
    order_db_id: int,
    body: PatchOrderBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Actualiza campos editables de una orden."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    for field in ("deposito_asignado", "nota", "comentario", "barcode"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(order, field, val)
    if body.estado_picking and body.estado_picking in ("PENDIENTE", "PICKEADO", "FALLADO", "CANCELADO"):
        order.estado_picking = body.estado_picking
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# FASE 3 — Asignación automática
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/deposito/auto-assign")
def ml_deposito_auto_assign(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Asigna depósito automáticamente a todas las órdenes pendientes sin asignar."""
    company_id = current_user.company_id or 1
    cfg = _get_config(db, company_id)
    dp = _get_dragon_params(cfg)
    if not dp.get("api_bases") or not dp.get("api_key"):
        raise HTTPException(400, "Dragonfish no configurado")

    clusters = (cfg.clusters if cfg else None) or {"A": ["DEPO", "DEP", "MUNDOAL", "MONBAHIA", "MTGBBPS"], "B": ["MUNDOROC", "MTGROCA"]}
    lejanos = (cfg.lejanos if cfg else None) or ["MTGCOM", "NQNSHOP", "NQNALB", "MUNDOCAB"]

    pending = db.query(MeliOrder).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.estado_picking == "PENDIENTE",
        MeliOrder.asignado_flag == False,
    ).all()

    if not pending:
        return {"ok": True, "message": "No hay órdenes pendientes sin asignar", "asignadas": 0}

    result = auto_assign_orders(
        pending, clusters, lejanos,
        api_bases=dp["api_bases"], api_key=dp["api_key"], id_cliente=dp["id_cliente"],
    )
    db.commit()
    return {"ok": True, **{k: v for k, v in result.items() if k != "detalles"}, "total_procesadas": len(pending)}


class ManualAssignBody(BaseModel):
    deposito: str


@router.post("/deposito/orders/{order_db_id}/assign")
def ml_deposito_manual_assign(
    order_db_id: int,
    body: ManualAssignBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Asignación manual de depósito."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    order.deposito_asignado = body.deposito
    order.asignado_flag = True
    order.fecha_asignacion = datetime.utcnow()
    order.asignacion_detalle = {"tipo": "manual", "deposito": body.deposito}
    db.commit()
    return {"ok": True, "deposito": body.deposito}


# ══════════════════════════════════════════════════════════════════════════════
# FASE 3b — Movimiento Dragonfish post-asignación
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/deposito/orders/{order_db_id}/move-stock")
def ml_deposito_move_stock(
    order_db_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra movimiento de descuento de stock en Dragonfish para una orden asignada."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    if not order.deposito_asignado:
        raise HTTPException(400, "Orden no tiene depósito asignado")
    if order.movimiento_realizado:
        return {"ok": True, "message": "Movimiento ya realizado", "numero": order.numero_movimiento}

    cfg = _get_config(db, company_id)
    dp = _get_dragon_params(cfg)
    if not dp.get("mov_url"):
        raise HTTPException(400, "URL de movimiento Dragonfish no configurada")

    observacion = f"ML ORD {order.order_id} - {order.item_title or ''}"[:200]
    result = move_stock(
        sku=order.sku or "", qty=order.quantity or 1, observacion=observacion,
        mov_url=dp["mov_url"], api_key=dp["api_key"], id_cliente=dp["id_cliente"],
        base_datos=dp["base_datos"], origen_destino=dp["base_datos"],
        tipo=2, barcode=order.barcode,
    )
    if result.get("ok"):
        order.movimiento_realizado = True
        order.numero_movimiento = result.get("numero")
        order.observacion_movimiento = observacion
        db.commit()
    return result


# ══════════════════════════════════════════════════════════════════════════════
# FASE 4 — Notas multi-cuenta
# ══════════════════════════════════════════════════════════════════════════════

class NoteBody(BaseModel):
    text: str = ""
    deposito: str = ""
    qty: int = 1
    agotado: bool = False
    numero_mov: Optional[int] = None


@router.post("/deposito/orders/{order_db_id}/note")
def ml_deposito_publish_note(
    order_db_id: int,
    body: NoteBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publica nota en la orden de MercadoLibre."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")

    cfg = _get_config(db, company_id)
    account = order.meli_account or "1"
    tok = _get_token_for_account(cfg, account)
    if not tok.get("access_token"):
        raise HTTPException(400, f"Token ML cuenta {account} no configurado")

    result = publish_note(
        order_id=str(order.order_id),
        access_token=tok["access_token"],
        client_id=tok.get("client_id", ""),
        client_secret=tok.get("client_secret", ""),
        refresh_token_str=tok.get("refresh_token", ""),
        deposito=body.deposito or order.deposito_asignado or "",
        qty=body.qty,
        agotado=body.agotado,
        observacion=body.text,
        numero_mov=body.numero_mov,
    )

    if result.get("ok"):
        order.nota = result.get("note", "")
        # Update token if refreshed
        if result.get("new_token") and cfg:
            if account == "2":
                cfg.ml2_access_token = result["new_token"]
            else:
                cfg.ml1_access_token = result["new_token"]
        db.commit()

    return result


# ══════════════════════════════════════════════════════════════════════════════
# FASE 5 — Webhook
# ══════════════════════════════════════════════════════════════════════════════

# Mapa de user_id de ML → nombre de cuenta en _managers
_ML_USER_ID_TO_ACCOUNT = {
    "756086955": "neuquen",   # RM Neuquén
    "209611492": "valen",     # RM Indumentaria / Valen
}


def _account_for_event(event: "MeliWebhookEvent") -> str:
    """Devuelve el nombre de cuenta (_managers key) para el evento de webhook."""
    uid = (event.user_id or "").strip()
    return _ML_USER_ID_TO_ACCOUNT.get(uid, "valen")


def _process_ml_webhook_event(event: "MeliWebhookEvent", db: Session):
    """
    Procesa un evento de webhook ML en segundo plano.
    Para preguntas: auto-fetch la pregunta y crea una notificación interna.
    Para órdenes: crea notificación de nueva venta.
    """
    from datetime import datetime as _dt
    try:
        topic = (event.topic or "").lower()
        resource_id = event.resource_id

        if topic == "questions" and resource_id:
            # Fetch question detail from ML API using the correct account
            try:
                account_name = _account_for_event(event)
                mgr = _managers.get(account_name) or _managers.get("valen")
                if mgr:
                    q_data = mgr.call("GET", f"/questions/{resource_id}")
                    question_text = q_data.get("text", "")
                    item_id = q_data.get("item_id", "")
                    # Try to get item title
                    item_title = ""
                    try:
                        item_data = mgr.call("GET", f"/items/{item_id}", params={"attributes": "title"})
                        item_title = item_data.get("title", item_id)
                    except Exception:
                        item_title = item_id

                    # Store enriched data in payload_raw
                    enriched = dict(event.payload_raw or {})
                    enriched["_question_text"] = question_text
                    enriched["_item_title"] = item_title
                    enriched["_item_id"] = item_id
                    event.payload_raw = enriched

                    # Create internal notification
                    from app.models.notification import Notification, NotificationType
                    account_label = mgr.get_label() if mgr else account_name
                    notif = Notification(
                        type=NotificationType.INFO,
                        title=f"🛒 Nueva pregunta ML ({account_label}): {item_title[:50]}",
                        message=question_text[:300] if question_text else f"Pregunta en publicación {item_id}",
                        company_id=1,
                        to_role="ADMIN",
                    )
                    db.add(notif)
            except Exception as ex:
                _log.warning("No se pudo enriquecer pregunta ML %s: %s", resource_id, ex)

        elif topic == "orders_v2" and resource_id:
            try:
                from app.models.notification import Notification, NotificationType
                notif = Notification(
                    type=NotificationType.INFO,
                    title="💰 Nueva venta ML",
                    message=f"Orden #{resource_id} recibida en MercadoLibre",
                    company_id=1,
                    to_role="ADMIN",
                )
                db.add(notif)
            except Exception as ex:
                _log.warning("No se pudo crear notif para orden ML %s: %s", resource_id, ex)

        event.status = "processed"
        event.processed_at = _dt.utcnow()
        event.attempts = (event.attempts or 0) + 1
        db.commit()

    except Exception as e:
        _log.error("Error procesando webhook ML event %s: %s", event.id, e)
        event.status = "failed"
        event.error = str(e)
        event.attempts = (event.attempts or 0) + 1
        try:
            db.commit()
        except Exception:
            db.rollback()


@router.post("/webhook", include_in_schema=True)
async def ml_webhook(
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """Receptor de webhooks ML. Persiste y procesa automáticamente."""
    event = MeliWebhookEvent(
        topic=payload.get("topic"),
        resource=payload.get("resource"),
        resource_id=str(payload.get("resource", "")).split("/")[-1] if payload.get("resource") else None,
        user_id=str(payload.get("user_id", "")),
        application_id=str(payload.get("application_id", "")),
        payload_raw=payload,
        status="pending",
    )
    db.add(event)
    db.commit()
    _log.info("Webhook recibido: topic=%s resource=%s id=%d", event.topic, event.resource, event.id)

    # Auto-process in background thread to not block ML's 200ms timeout
    import threading
    t = threading.Thread(target=_process_ml_webhook_event, args=(event, db), daemon=True)
    t.start()

    return {"status": "received", "event_id": event.id}


@router.get("/webhook/events")
def ml_webhook_events(
    status: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    seller_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista eventos de webhook ML."""
    q = db.query(MeliWebhookEvent)
    if status:
        q = q.filter(MeliWebhookEvent.status == status)
    if topic:
        q = q.filter(MeliWebhookEvent.topic == topic)
    if seller_id:
        q = q.filter(MeliWebhookEvent.user_id == seller_id)
    events = q.order_by(MeliWebhookEvent.received_at.desc()).limit(limit).all()
    return [{
        "id": e.id,
        "received_at": e.received_at.isoformat() if e.received_at else None,
        "topic": e.topic,
        "resource": e.resource,
        "resource_id": e.resource_id,
        "seller_id": e.user_id,
        "status": e.status,
        "attempts": e.attempts,
        "processed_at": e.processed_at.isoformat() if e.processed_at else None,
        "question_text": (e.payload_raw or {}).get("_question_text"),
        "item_title": (e.payload_raw or {}).get("_item_title"),
    } for e in events]


@router.get("/webhook/questions")
def ml_webhook_questions(
    seller_id: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    hours: int = Query(72, ge=1, le=720),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Consultas (preguntas) recibidas via webhook en las últimas N horas.
    seller_id: filtrar por vendedor (756086955=Neuquén, 209611492=Valen/Indumentaria).
    Permite mostrar preguntas en tiempo real en el frontend.
    """
    from datetime import datetime as _dt, timedelta as _td
    since = _dt.utcnow() - _td(hours=hours)
    q = db.query(MeliWebhookEvent).filter(
        MeliWebhookEvent.topic == "questions",
        MeliWebhookEvent.received_at >= since,
    )
    if seller_id:
        q = q.filter(MeliWebhookEvent.user_id == seller_id)
    events = q.order_by(MeliWebhookEvent.received_at.desc()).limit(limit).all()

    result = []
    for e in events:
        payload = e.payload_raw or {}
        question_text = payload.get("_question_text") or ""
        item_title = payload.get("_item_title") or payload.get("_item_id") or ""
        item_id = payload.get("_item_id") or ""
        # Determine account label
        uid = (e.user_id or "").strip()
        acc_name = _ML_USER_ID_TO_ACCOUNT.get(uid, "valen")
        mgr = _managers.get(acc_name)
        account_label = mgr.get_label() if mgr else acc_name
        result.append({
            "event_id": e.id,
            "question_id": e.resource_id,
            "received_at": e.received_at.isoformat() if e.received_at else None,
            "question_text": question_text,
            "item_id": item_id,
            "item_title": item_title,
            "seller_id": e.user_id,
            "account": acc_name,
            "account_label": account_label,
            "status": e.status,
            "enriched": bool(question_text),
        })
    return result


# ══════════════════════════════════════════════════════════════════════════════
# FASE 6 — Scanner / SKU resolver
# ══════════════════════════════════════════════════════════════════════════════

class ScanBody(BaseModel):
    barcode: str


@router.post("/deposito/scan")
def ml_deposito_scan(
    body: ScanBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Busca orden pendiente por barcode o SKU y la marca como PICKEADA."""
    company_id = current_user.company_id or 1
    barcode = body.barcode.strip()

    order = db.query(MeliOrder).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.estado_picking == "PENDIENTE",
        or_(
            MeliOrder.sku == barcode,
            MeliOrder.sku_real == barcode,
            MeliOrder.barcode == barcode,
            MeliOrder.item_id == barcode,
        ),
    ).first()

    if not order:
        # Try partial match
        s = f"%{barcode}%"
        order = db.query(MeliOrder).filter(
            MeliOrder.company_id == company_id,
            MeliOrder.estado_picking == "PENDIENTE",
            or_(MeliOrder.sku.ilike(s), MeliOrder.barcode.ilike(s)),
        ).first()

    if not order:
        return {"found": False, "barcode": barcode, "message": "No se encontró orden pendiente para este código"}

    order.estado_picking = "PICKEADO"
    order.printed = True
    order.fecha_picking = datetime.utcnow()
    order.barcode = barcode
    db.commit()

    return {"found": True, "barcode": barcode, "order": _order_to_dict(order)}


@router.post("/deposito/resolve-skus")
def ml_deposito_resolve_skus(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resuelve SKUs con sufijo -OUT usando la API de ML."""
    company_id = current_user.company_id or 1
    token = _get_token()

    pending = db.query(MeliOrder).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.sku_real.is_(None),
        MeliOrder.sku.isnot(None),
    ).limit(100).all()

    resolved = 0
    for o in pending:
        if not is_out_sku(o.sku or ""):
            o.sku_real = o.sku
            resolved += 1
            continue
        real = resolve_sku(token, o.item_id or "", o.variation_id, o.sku or "")
        o.sku_real = real
        resolved += 1

    db.commit()
    return {"ok": True, "resolved": resolved}


# ══════════════════════════════════════════════════════════════════════════════
# FASE 7 — Impresión (etiquetas ML + lista PDF)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/deposito/orders/{order_db_id}/label")
def ml_deposito_label(
    order_db_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Descarga la etiqueta de envío desde ML API."""
    company_id = current_user.company_id or 1
    order = db.query(MeliOrder).filter(MeliOrder.id == order_db_id, MeliOrder.company_id == company_id).first()
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    if not order.shipment_id:
        raise HTTPException(400, "Orden sin shipment_id")

    from fastapi.responses import Response
    token = _get_token()
    try:
        resp = _requests.get(
            f"{ML_BASE}/shipment_labels",
            params={"shipment_ids": str(order.shipment_id), "response_type": "zpl2"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if resp.ok:
            return Response(content=resp.content, media_type="application/octet-stream",
                            headers={"Content-Disposition": f"attachment; filename=label_{order.shipment_id}.zpl"})
        # Try PDF
        resp2 = _requests.get(
            f"{ML_BASE}/shipment_labels",
            params={"shipment_ids": str(order.shipment_id), "response_type": "pdf"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if resp2.ok:
            return Response(content=resp2.content, media_type="application/pdf",
                            headers={"Content-Disposition": f"attachment; filename=label_{order.shipment_id}.pdf"})
        raise HTTPException(502, f"ML API error: {resp.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Error descargando etiqueta: {e}")


class PrintListBody(BaseModel):
    order_ids: List[int]
    title: Optional[str] = None


@router.post("/deposito/print-list")
def ml_deposito_print_list(
    body: PrintListBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Genera PDF con lista de picking para las órdenes seleccionadas."""
    from fastapi.responses import Response
    import io

    company_id = current_user.company_id or 1
    orders = db.query(MeliOrder).filter(
        MeliOrder.id.in_(body.order_ids),
        MeliOrder.company_id == company_id,
    ).all()

    if not orders:
        raise HTTPException(404, "No se encontraron órdenes")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas as pdf_canvas
    except ImportError:
        raise HTTPException(500, "reportlab no instalado. pip install reportlab")

    buf = io.BytesIO()
    width, height = A4
    c = pdf_canvas.Canvas(buf, pagesize=A4)

    y = height - 40
    title = body.title or "Lista de artículos pendientes"
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, y, title)
    y -= 30

    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Artículo")
    c.drawString(280, y, "Talle")
    c.drawString(330, y, "Color")
    c.drawString(400, y, "Cant")
    c.drawString(440, y, "Depósito")
    c.drawString(515, y, "✔")
    y -= 8
    c.line(40, y, width - 40, y)
    y -= 22

    c.setFont("Helvetica", 10)
    for o in orders:
        if y < 80:
            c.showPage()
            y = height - 60
            c.setFont("Helvetica", 10)

        art = (o.item_title or "")[:40]
        c.drawString(40, y, art)
        c.drawString(280, y, (o.talle or "")[:8])
        c.drawString(330, y, (o.color or "")[:10])
        c.drawRightString(435, y, str(o.quantity or 1))
        c.drawString(440, y, (o.deposito_asignado or "N/A")[:10])
        c.rect(515, y - 4, 14, 14)
        y -= 20

    c.save()
    pdf_bytes = buf.getvalue()

    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="lista_picking.pdf"'})


# ══════════════════════════════════════════════════════════════════════════════
# FASE 8 — Estadísticas detalladas
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/deposito/stats")
def ml_deposito_stats(
    meli_account: Optional[str] = Query(None, description="Filtrar por cuenta ML: 1 o 2"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estadísticas del día para el panel de depósito."""
    from datetime import datetime as dt
    company_id = current_user.company_id or 1
    hoy_inicio = dt.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    base_filter = [MeliOrder.company_id == company_id]
    if meli_account:
        base_filter.append(MeliOrder.meli_account == meli_account)

    total_pendiente = db.query(MeliOrder).filter(
        *base_filter, MeliOrder.estado_picking == "PENDIENTE",
    ).count()

    pickeados_hoy = db.query(MeliOrder).filter(
        *base_filter, MeliOrder.estado_picking == "PICKEADO",
        MeliOrder.fecha_picking >= hoy_inicio,
    ).count()

    fallados_hoy = db.query(MeliOrder).filter(
        *base_filter, MeliOrder.estado_picking == "FALLADO",
        MeliOrder.updated_at >= hoy_inicio,
    ).count()

    total_sync = db.query(MeliOrder).filter(*base_filter).count()

    sin_asignar = db.query(MeliOrder).filter(
        *base_filter, MeliOrder.estado_picking == "PENDIENTE",
        MeliOrder.asignado_flag == False,
    ).count()

    return {
        "total_pendiente": total_pendiente,
        "pickeados_hoy": pickeados_hoy,
        "fallados_hoy": fallados_hoy,
        "total_sync": total_sync,
        "sin_asignar": sin_asignar,
    }


@router.get("/deposito/stats/detailed")
def ml_deposito_stats_detailed(
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estadísticas detalladas con breakdowns."""
    from datetime import datetime as dt, timedelta
    company_id = current_user.company_id or 1
    desde = dt.utcnow() - timedelta(days=days)

    # Por estado
    estado_counts = {}
    for estado in ("PENDIENTE", "PICKEADO", "FALLADO", "CANCELADO"):
        estado_counts[estado] = db.query(MeliOrder).filter(
            MeliOrder.company_id == company_id, MeliOrder.estado_picking == estado,
        ).count()

    # Por depósito
    deposito_rows = db.query(
        MeliOrder.deposito_asignado, func.count(MeliOrder.id)
    ).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.deposito_asignado.isnot(None),
        MeliOrder.fecha_orden >= desde,
    ).group_by(MeliOrder.deposito_asignado).all()
    por_deposito = {r[0]: r[1] for r in deposito_rows}

    # Pickeados por día (últimos N días)
    pickeados_dia = db.query(
        cast(MeliOrder.fecha_picking, Date), func.count(MeliOrder.id)
    ).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.estado_picking == "PICKEADO",
        MeliOrder.fecha_picking >= desde,
    ).group_by(cast(MeliOrder.fecha_picking, Date)).order_by(cast(MeliOrder.fecha_picking, Date)).all()

    # Motivos de falla
    falla_rows = db.query(
        MeliOrder.motivo_falla, func.count(MeliOrder.id)
    ).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.estado_picking == "FALLADO",
        MeliOrder.motivo_falla.isnot(None),
    ).group_by(MeliOrder.motivo_falla).all()
    por_motivo = {r[0]: r[1] for r in falla_rows}

    # Top 10 productos
    top_products = db.query(
        MeliOrder.item_title, func.count(MeliOrder.id).label("cnt")
    ).filter(
        MeliOrder.company_id == company_id,
        MeliOrder.fecha_orden >= desde,
    ).group_by(MeliOrder.item_title).order_by(func.count(MeliOrder.id).desc()).limit(10).all()

    return {
        "por_estado": estado_counts,
        "por_deposito": por_deposito,
        "pickeados_por_dia": [{"fecha": r[0].isoformat() if r[0] else None, "cantidad": r[1]} for r in pickeados_dia],
        "por_motivo_falla": por_motivo,
        "top_productos": [{"titulo": r[0], "cantidad": r[1]} for r in top_products],
        "days": days,
    }
