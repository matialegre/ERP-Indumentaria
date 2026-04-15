"""
Servicio de asignación pack-aware de depósito.
Porta la lógica de 08_assign_tx.py del standalone.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Any
from collections import defaultdict

from app.services.dragonfish import get_stock_per_deposit, move_stock, STOCK_FIELD_MAP

logger = logging.getLogger(__name__)

DEFAULT_CLUSTERS = {
    "A": ["DEPO", "DEP", "MUNDOAL", "MTGBBL", "MONBAHIA", "MTGBBPS"],
    "B": ["MUNDOROC", "MTGROCA"],
}
DEFAULT_LEJANOS = ["MTGCOM", "NQNSHOP", "NQNALB", "MUNDOCAB"]


def _get_cluster(depot: str, clusters: Dict[str, List[str]]) -> Optional[str]:
    """Retorna el cluster al que pertenece un depósito."""
    dep_up = depot.upper()
    for cid, members in clusters.items():
        if dep_up in [m.upper() for m in members]:
            return cid
    return None


def _depots_with_stock(stock: Dict[str, int], qty: int) -> List[str]:
    """Depósitos con stock >= qty."""
    return [d for d, s in stock.items() if s >= qty]


def assign_single_order(
    sku: str,
    qty: int,
    stock: Dict[str, int],
    clusters: Dict[str, List[str]],
    lejanos: List[str],
) -> Dict[str, Any]:
    """
    Asigna depósito para una orden individual.
    Returns: {"deposito": str|None, "tipo": "unico"|"cluster"|"lejano"|"sin_stock", "detalle": dict}
    """
    available = _depots_with_stock(stock, qty)
    if not available:
        return {"deposito": None, "tipo": "sin_stock", "detalle": {"stock": stock, "qty": qty}}

    # Prioridad: depósitos de cluster A > B > lejanos
    cluster_order = list(clusters.keys())

    for cid in cluster_order:
        members = [m.upper() for m in clusters[cid]]
        matching = [d for d in available if d.upper() in members]
        if matching:
            best = max(matching, key=lambda d: stock.get(d, 0))
            return {"deposito": best, "tipo": "unico", "detalle": {"stock": stock[best], "cluster": cid}}

    # Lejanos
    lejanos_up = [l.upper() for l in lejanos]
    matching = [d for d in available if d.upper() in lejanos_up]
    if matching:
        best = max(matching, key=lambda d: stock.get(d, 0))
        return {"deposito": best, "tipo": "lejano", "detalle": {"stock": stock[best]}}

    # Cualquier depósito con stock
    best = max(available, key=lambda d: stock.get(d, 0))
    return {"deposito": best, "tipo": "unico", "detalle": {"stock": stock[best]}}


def assign_pack(
    items: List[Dict[str, Any]],
    clusters: Dict[str, List[str]],
    lejanos: List[str],
    api_bases: list[str],
    api_key: str,
    id_cliente: str,
) -> Dict[str, Any]:
    """
    Asigna depósito para un pack (multiventa).
    Busca depósito único para todo el pack, si no cluster, si no DIVIDIDO.
    
    items: [{"sku": "...", "qty": N, "order_db_id": M}, ...]
    """
    all_stock: Dict[str, Dict[str, int]] = {}
    for it in items:
        sku = it.get("sku") or ""
        if sku and sku not in all_stock:
            try:
                all_stock[sku] = get_stock_per_deposit(
                    sku, api_bases=api_bases, api_key=api_key, id_cliente=id_cliente
                )
            except Exception as e:
                logger.error("Error obteniendo stock para %s: %s", sku, e)
                all_stock[sku] = {}

    # Estrategia 1: depósito único que tenga TODO
    all_depots = set()
    for s in all_stock.values():
        all_depots.update(s.keys())

    for depot in sorted(all_depots):
        can_fulfill = True
        for it in items:
            sku = it.get("sku", "")
            qty = it.get("qty", 1)
            available = all_stock.get(sku, {}).get(depot, 0)
            if available < qty:
                can_fulfill = False
                break
        if can_fulfill:
            return {
                "tipo": "unico",
                "deposito": depot,
                "items": [{**it, "deposito": depot} for it in items],
                "stock": all_stock,
            }

    # Estrategia 2: mismo cluster
    cluster_order = list(clusters.keys())
    for cid in cluster_order:
        members = [m.upper() for m in clusters[cid]]
        cluster_depots = [d for d in all_depots if d.upper() in members]
        if not cluster_depots:
            continue

        can_cluster = True
        item_assignments = []
        for it in items:
            sku = it.get("sku", "")
            qty = it.get("qty", 1)
            found = False
            for depot in cluster_depots:
                if all_stock.get(sku, {}).get(depot, 0) >= qty:
                    item_assignments.append({**it, "deposito": depot})
                    found = True
                    break
            if not found:
                can_cluster = False
                break

        if can_cluster:
            primary = max(set(a["deposito"] for a in item_assignments),
                          key=lambda d: sum(1 for a in item_assignments if a["deposito"] == d))
            return {
                "tipo": "cluster",
                "deposito": primary,
                "cluster": cid,
                "items": item_assignments,
                "stock": all_stock,
            }

    # Estrategia 3: DIVIDIDO
    item_assignments = []
    for it in items:
        sku = it.get("sku", "")
        qty = it.get("qty", 1)
        stock = all_stock.get(sku, {})
        result = assign_single_order(sku, qty, stock, clusters, lejanos)
        item_assignments.append({**it, "deposito": result.get("deposito")})

    return {
        "tipo": "dividido",
        "deposito": None,
        "items": item_assignments,
        "stock": all_stock,
    }


def auto_assign_orders(
    orders,
    clusters: Dict[str, List[str]],
    lejanos: List[str],
    api_bases: list[str],
    api_key: str,
    id_cliente: str,
) -> Dict[str, Any]:
    """
    Asigna depósito automáticamente a todas las órdenes pendientes.
    orders: lista de MeliOrder objects (sin deposito_asignado, estado_picking=PENDIENTE)
    
    Returns: {"asignadas": N, "divididas": N, "sin_stock": N, "detalles": [...]}
    """
    # Agrupar por pack_id
    packs = defaultdict(list)
    singles = []
    for o in orders:
        if o.pack_id:
            packs[o.pack_id].append(o)
        else:
            singles.append(o)

    results = {"asignadas": 0, "divididas": 0, "sin_stock": 0, "detalles": []}

    # Procesar packs
    for pack_id, pack_orders in packs.items():
        items = [{"sku": o.sku or "", "qty": o.quantity or 1, "order_db_id": o.id} for o in pack_orders]
        result = assign_pack(items, clusters, lejanos, api_bases, api_key, id_cliente)

        for it in result.get("items", []):
            depot = it.get("deposito")
            db_id = it.get("order_db_id")
            order_obj = next((o for o in pack_orders if o.id == db_id), None)
            if order_obj and depot:
                order_obj.deposito_asignado = depot
                order_obj.asignado_flag = True
                order_obj.venta_tipo = "pack"
                order_obj.asignacion_detalle = {"tipo": result["tipo"], "pack_id": pack_id}
                _set_stock_fields(order_obj, result.get("stock", {}).get(order_obj.sku or "", {}))
                results["asignadas"] += 1
            elif order_obj:
                results["sin_stock"] += 1

        if result["tipo"] == "dividido":
            results["divididas"] += 1
        results["detalles"].append({"pack_id": pack_id, **result})

    # Procesar singles
    for o in singles:
        sku = o.sku or ""
        qty = o.quantity or 1
        try:
            stock = get_stock_per_deposit(sku, api_bases=api_bases, api_key=api_key, id_cliente=id_cliente)
        except Exception:
            stock = {}

        result = assign_single_order(sku, qty, stock, clusters, lejanos)
        depot = result.get("deposito")
        if depot:
            o.deposito_asignado = depot
            o.asignado_flag = True
            o.venta_tipo = "single"
            o.asignacion_detalle = {"tipo": result["tipo"], "stock_at_assign": stock}
            _set_stock_fields(o, stock)
            results["asignadas"] += 1
        else:
            results["sin_stock"] += 1
        results["detalles"].append({"order_id": o.order_id, **result})

    return results


def _set_stock_fields(order, stock: Dict[str, int]):
    """Sets the stock_xxx fields on a MeliOrder from a stock dict."""
    total = 0
    for depot, qty in stock.items():
        field = STOCK_FIELD_MAP.get(depot)
        if field:
            setattr(order, field, qty)
        total += qty
    order.stock_real = total
