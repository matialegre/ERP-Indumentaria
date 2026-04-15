"""
Servicio Dragonfish — consulta de stock y registro de movimientos.
Porta la lógica de 07_dragon_api.py y 09_dragon_movement.py del standalone.
"""
from __future__ import annotations

import re
import json
import logging
import requests
from typing import Dict, Optional, Any
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# ── Helpers ──────────────────────────────────────────────────────────────────

ALLOWED_BASES = {"DEPOSITO", "MONBAHIA", "MTGBBPS", "BBPS", "MTGROCA",
                 "MUNDOAL", "MUNDOCAB", "MUNDOROC", "NQNALB", "NQNSHOP", "MTGCOM"}

DEPOT_ALIAS = {"DEPOSITO": "DEP", "BBPS": "MTGBBPS", "DEPO": "DEP"}

STOCK_FIELD_MAP = {
    "DEP": "stock_dep", "MUNDOAL": "stock_mundoal", "MONBAHIA": "stock_monbahia",
    "MTGBBPS": "stock_mtgbbps", "MUNDOCAB": "stock_mundocab", "NQNSHOP": "stock_nqnshop",
    "MTGCOM": "stock_mtgcom", "MTGROCA": "stock_mtgroca", "MUNDOROC": "stock_mundoroc",
    "NQNALB": "stock_nqnalb",
}


def _norm(s: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(s or "").strip().upper())


def _eq_talle(a: str, b: str) -> bool:
    return a == b or a.lstrip("0") == b.lstrip("0")


# ── Stock query ──────────────────────────────────────────────────────────────

def get_stock_per_deposit(
    sku: str,
    api_bases: list[str],
    api_key: str,
    id_cliente: str = "PRUEBA-WEB",
    timeout: int = 30,
) -> Dict[str, int]:
    """
    Consulta stock por depósito en Dragonfish API.
    Returns: {"DEP": 5, "MUNDOAL": 3, ...}
    """
    headers = {
        "accept": "application/json",
        "IdCliente": id_cliente,
        "Authorization": api_key,
    }

    s_in = (sku or "").strip()
    if s_in.upper().startswith("TDRK20"):
        query_val = "TDRK20"
    else:
        query_val = s_in.split("-")[0] if "-" in s_in else s_in

    parts = s_in.split("-")
    color_q = parts[1].strip() if len(parts) >= 3 else None
    talle_q = parts[2].strip() if len(parts) >= 3 else None

    data = None
    last_exc = None
    for base in api_bases:
        if not base:
            continue
        url = base.rstrip("/")
        params = {"query": query_val, "page": 1, "limit": 100}
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=timeout, allow_redirects=True)
            if resp.status_code in (400, 401, 404, 405):
                last_exc = requests.HTTPError(f"HTTP {resp.status_code}")
                continue
            resp.raise_for_status()
            data = resp.json()
            break
        except (requests.Timeout, requests.HTTPError, Exception) as e:
            last_exc = e
            continue

    if data is None:
        if last_exc:
            raise last_exc
        raise requests.HTTPError("No se pudo obtener stock: sin bases válidas")

    result: Dict[str, int] = {}
    color_norm = _norm(color_q) if color_q else None
    talle_norm = _norm(talle_q) if talle_q else None
    query_art = query_val.strip().upper()

    resultados = data.get("Resultados") if isinstance(data, dict) else None
    if not isinstance(resultados, list):
        return result

    for item in resultados:
        if not isinstance(item, dict):
            continue
        art = str(item.get("Articulo", "")).strip().upper()
        if art != query_art:
            continue
        if color_norm or talle_norm:
            it_color = _norm(item.get("Color") or item.get("COLOR") or "")
            it_talle = _norm(item.get("Talle") or item.get("TALLE") or "")
            if color_norm and it_color != color_norm:
                continue
            if talle_norm and not _eq_talle(it_talle, talle_norm):
                continue

        for s in item.get("Stock", []):
            depot_raw = str(s.get("BaseDeDatos", "")).strip().upper()
            if depot_raw not in ALLOWED_BASES:
                continue
            depot = DEPOT_ALIAS.get(depot_raw, depot_raw)
            total = int(s.get("Stock") or 0)
            result[depot] = max(result.get(depot, 0), total)

    return result


# ── Stock movement ───────────────────────────────────────────────────────────

def _dragon_date() -> str:
    zona = timezone(timedelta(hours=-3))
    ms = int(datetime.now(zona).timestamp() * 1000)
    return f"/Date({ms}-0300)/"


def _dragon_time() -> str:
    zona = timezone(timedelta(hours=-3))
    return datetime.now(zona).strftime("%H:%M:%S")


def _parse_sku(sku: str):
    if not sku:
        return ("", None, None)
    parts = sku.split("-")
    if len(parts) >= 3:
        return (parts[0].strip(), parts[1].strip(), parts[2].strip())
    return (parts[0].strip(), None, None)


def _normalize_code(code: str) -> str:
    parts = [p for p in str(code or "").strip().upper().split("-") if p]
    return "-".join(parts) if parts else str(code or "").strip().upper()


def move_stock(
    *,
    sku: str,
    qty: int,
    observacion: str,
    mov_url: str,
    api_key: str,
    id_cliente: str = "PRUEBA-WEB",
    base_datos: str = "MELI",
    origen_destino: str = "MELI",
    tipo: int = 2,
    barcode: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Registra movimiento WOO→WOO en Dragonfish.
    tipo=2 resta, tipo=1 suma.
    """
    if not mov_url:
        return {"ok": False, "error": "DRAGON_MOV_URL no configurada"}

    articulo_raw, color_raw, talle_raw = _parse_sku(sku)
    if not articulo_raw:
        return {"ok": False, "error": "SKU/artículo inválido"}

    code_norm = _normalize_code(barcode or sku)

    parts = (sku or "").split("-")
    color_send = color_raw or (parts[1].strip() if len(parts) >= 3 else "")
    talle_send = talle_raw or (parts[2].strip() if len(parts) >= 3 else "")

    headers = {
        "accept": "application/json",
        "IdCliente": id_cliente,
        "Authorization": api_key,
        "Content-Type": "application/json",
        "BaseDeDatos": base_datos,
    }

    fecha = _dragon_date()
    hora = _dragon_time()

    body = {
        "OrigenDestino": origen_destino,
        "Tipo": tipo,
        "Motivo": "API",
        "vendedor": "API",
        "Remito": "-",
        "CompAfec": [],
        "Fecha": fecha,
        "Observacion": observacion,
        "MovimientoDetalle": [{
            "Articulo": code_norm,
            "ArticuloDetalle": "",
            "Color": color_send,
            "Talle": talle_send,
            "Cantidad": qty,
            "NroItem": 1,
        }],
        "InformacionAdicional": {
            "FechaAltaFW": fecha,
            "HoraAltaFW": hora,
            "EstadoTransferencia": "PENDIENTE",
            "BaseDeDatosAltaFW": base_datos,
            "BaseDeDatosModificacionFW": base_datos,
            "SerieAltaFW": "901224",
            "SerieModificacionFW": "901224",
            "UsuarioAltaFW": "API",
            "UsuarioModificacionFW": "API",
        },
    }

    logger.info("Dragon MOVE → %s qty=%d od=%s base=%s", code_norm, qty, origen_destino, base_datos)

    try:
        resp = requests.post(mov_url, headers=headers, data=json.dumps(body), timeout=120)
        status = resp.status_code
        try:
            data = resp.json() if resp.content else None
        except Exception:
            data = resp.text

        ok = status in (201, 409)

        numero = None
        if isinstance(data, dict):
            for k in ("Numero", "NroMovimiento", "Id", "IdMovimiento", "NumeroMovimiento"):
                if k in data and data[k]:
                    try:
                        numero = int(str(data[k]).strip())
                    except Exception:
                        pass
                    break
        if numero is None and isinstance(data, (str, bytes)):
            m = re.search(r"\b(\d{5,})\b", data if isinstance(data, str) else data.decode(errors="ignore"))
            numero = int(m.group(1)) if m else None

        return {"ok": ok, "status": status, "data": data, "numero": numero, "error": None if ok else str(data)[:500]}
    except requests.Timeout as e:
        return {"ok": False, "status": 0, "error": f"timeout: {e}"}
    except Exception as e:
        return {"ok": False, "status": 0, "error": f"error: {e}"}
